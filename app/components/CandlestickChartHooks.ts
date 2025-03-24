import { useCallback, useState, useRef, useEffect } from 'react';
import { IChartApi, ISeriesApi, Time, SeriesMarker } from 'lightweight-charts';
import { ExtendedCandlestickData, DateRange, MASettings } from './CandlestickChartTypes';
import { getInitialDateRange, calculateEMA, getChartEndpoint, createTradeMarkers, calculateBacktestResult } from './CandlestickChartUtils';
import useUpbitStore from '../store/useUpbitStore';
import { UpbitCandle } from '../types/candlestick';
import { TradeStrategy, TradeSignal } from '../strategies/types';

export const useChartData = (
  symbol: string,
  chartType: string,
  initialAutoUpdate: boolean,
  mode?: 'live' | 'test'
) => {
  // 차트 상태
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [chartHeight, setChartHeight] = useState(500);
  const [chartPrice, setChartPrice] = useState<number | null>(null);
  const [progress, setProgress] = useState(0);
  const [allData, setAllData] = useState<ExtendedCandlestickData[]>([]);
  const [markers, setMarkers] = useState<SeriesMarker<Time>[]>([]);
  const [backtestResult, setBacktestResult] = useState<any | null>(null);
  
  // 자동 업데이트 및 실시간 API 상태
  const [isAutoUpdate, setIsAutoUpdate] = useState<boolean>(initialAutoUpdate);
  const [isRealtimeAPIEnabled, setIsRealtimeAPIEnabled] = useState<boolean>(false);
  const [lastSymbol, setLastSymbol] = useState<string>(symbol);
  const [currentStrategy, setCurrentStrategy] = useState<TradeStrategy>(useUpbitStore.getState().tradeStrategy);
  
  // 설정 상태
  const [dateRange, setDateRange] = useState<DateRange>(getInitialDateRange(chartType));
  const [showMA, setShowMA] = useState<MASettings>({
    sixty: true,
    oneTwenty: true,
    twoForty: true,
    threeHundredSixty: true,
    sixHundred: true,
    nineHundred: true,
  });
  
  // 차트 레퍼런스
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<"Histogram"> | null>(null);
  const sixtyEMASeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const oneTwentyEMASeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const twoFortyEMASeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const threeHundredSixtyEMASeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const sixHundredEMASeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const nineHundredEMASeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const markerPluginRef = useRef<any | null>(null);
  
  // 기타 상태
  const ongoingRequestRef = useRef<boolean>(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // 실시간 업데이트 상태
  const [realtimeUpdateStatus, setRealtimeUpdateStatus] = useState<{
    isUpdating: boolean;
    lastUpdateTime: string | null;
    updateCount: number;
    markers: SeriesMarker<Time>[];
  }>({
    isUpdating: false,
    lastUpdateTime: null,
    updateCount: 0,
    markers: []
  });

  // 마커 업데이트 함수 수정
  const updateMarkers = useCallback((newMarkers: SeriesMarker<Time>[]) => {
    setMarkers(newMarkers);
    // 실시간 업데이트 상태에도 마커 정보 반영
    setRealtimeUpdateStatus(prev => ({
      ...prev,
      markers: newMarkers
    }));
  }, []);

  // 실시간 API 업데이트로 전환하는 함수
  const switchToRealtimeAfterUpdate = useCallback(() => {
    console.log('실시간 업데이트로 전환 시작...');
    
    // 일정 시간 후 실시간 API 활성화
    setTimeout(() => {
      // 설정된 타임아웃 정리
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      
      timeoutRef.current = setTimeout(() => {
        if (!isRealtimeAPIEnabled) {
          console.log('⚠️ 실시간 API가 활성화되지 않았습니다. 다시 시도합니다.');
      setIsRealtimeAPIEnabled(true);
        }
    }, 500);
    }, 1500);
  }, [isAutoUpdate, isRealtimeAPIEnabled]);

  // 차트 타입이 변경되면 데이터 다시 로드
  useEffect(() => {
    console.log(`차트 타입이 변경되었습니다: ${chartType}`);
    // 이전 요청 취소
    ongoingRequestRef.current = false;
    
    // 실시간 API가 활성화되어 있다면 비활성화
    if (isRealtimeAPIEnabled) {
      console.log('차트 타입 변경으로 실시간 API를 비활성화합니다.');
      setIsRealtimeAPIEnabled(false);
    }
    
    // 타이머가 있다면 정리
    if (timeoutRef.current) {
      clearInterval(timeoutRef.current);
      timeoutRef.current = null;
      console.log('업데이트 타이머 정리 완료');
    }
    
    // 데이터 초기화
    setAllData([]);
    
    // 마커 초기화
    updateMarkers([]);
    
    // 캔들 시리즈 초기화 - 실제 초기화는 CandlestickChartCore.tsx에서 처리
    // 여기서는 상태만 초기화하고, 차트 데이터는 loadData() 후 processLoadedData()에서 업데이트됨
    
    // 백테스트 결과 초기화
    setBacktestResult(null);
    
    console.log(`차트 타입 변경으로 모든 데이터 초기화 완료. 새로운 타입(${chartType})의 데이터를 로드합니다.`);
    
    // 새로운 날짜 범위 설정 (선택적)
    setDateRange(getInitialDateRange(chartType));
    
    // 데이터 다시 로드
    loadData();
  }, [chartType]);

  // 데이터 로드 함수
  const loadData = useCallback(async () => {
    if (ongoingRequestRef.current) return;
    
    ongoingRequestRef.current = true;
    console.log(`데이터 로드 시작: 차트타입=${chartType}, 기간=${dateRange.startDate.toLocaleString()} ~ ${dateRange.endDate?.toLocaleString() || '현재'}`);
    
    try {
      const endpoint = getChartEndpoint(chartType);
      let currentTo = dateRange.endDate ? dateRange.endDate : new Date();
      const startDate = dateRange.startDate;
      
      // 필요한 데이터 개수 계산
      const totalDays = Math.ceil((currentTo.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
      let estimatedCandles = 0;
      
      if (chartType.startsWith('seconds/')) {
        // 초봉 차트는 하루에 24시간 * 60분 * 60초 / (초 간격)
        const secondsInterval = parseInt(chartType.split('/')[1]);
        estimatedCandles = totalDays * 24 * 60 * 60 / secondsInterval;
      } else if (chartType.startsWith('minutes/')) {
        // 분봉 차트는 하루에 24시간 * 60분 / (분 간격)
        const minutesInterval = parseInt(chartType.split('/')[1]);
        estimatedCandles = totalDays * 24 * 60 / minutesInterval;
      } else if (chartType === 'days') {
        estimatedCandles = totalDays;
      } else if (chartType === 'weeks') {
        estimatedCandles = Math.ceil(totalDays / 7);
      } else {
        estimatedCandles = Math.ceil(totalDays / 30);
      }
      
      console.log(`예상 캔들 수: ${estimatedCandles}개, 총 일수: ${totalDays}일`);
      
      // 목표 캔들 수 설정
      let targetCandles = 200; // 기본값
      if (chartType.startsWith('minutes/')) {
        const minutesInterval = parseInt(chartType.split('/')[1]);
        if (minutesInterval === 5) {
          targetCandles = 576; // 5분봉 576개
        } else if (minutesInterval === 15) {
          targetCandles = 672; // 15분봉 672개
        }
      }
      
      // API 요청 당 최대 캔들 수 제한 (업비트 API 제한)
      const maxCandlesPerRequest = 200;
      
      // 필요한 API 요청 횟수 계산
      const requestsNeeded = Math.ceil(targetCandles / maxCandlesPerRequest);
      console.log(`목표 캔들 수: ${targetCandles}개, 필요한 API 요청 횟수: ${requestsNeeded}회`);
      
      let allProcessedData: ExtendedCandlestickData[] = [];
      let currentBatch = 0;
      
      // 목표 캔들 수에 도달할 때까지 반복해서 데이터 가져오기
      while (allProcessedData.length < targetCandles) {
        const to = currentTo.toISOString();
        
        // 진행률 업데이트
        currentBatch++;
        setProgress(Math.min(30, (currentBatch / requestsNeeded) * 30));
        
        // API URL 구성 - 차트 타입에 따라 다른 엔드포인트 사용
        let apiUrl = '';
        
        if (chartType.startsWith('seconds/')) {
          // 초봉 차트를 위해 내부 API 사용
          const unit = chartType.split('/')[1]; // 60 추출
          apiUrl = `/api/candles/seconds?market=${symbol}&count=200`; // 초기 로드는 200개 캔들
          console.log(`초봉 API 요청: ${apiUrl} (내부 API 사용)`);
        } else if (chartType.startsWith('minutes/')) {
          const unit = chartType.split('/')[1]; // 5 또는 15 추출
          apiUrl = `https://api.upbit.com/v1/candles/minutes/${unit}?market=${symbol}&to=${to}&count=${maxCandlesPerRequest}`;
          console.log(`${unit}분봉 API 요청: ${apiUrl}`);
        } else {
          apiUrl = `https://api.upbit.com/v1/candles/${endpoint}?market=${symbol}&to=${to}&count=${maxCandlesPerRequest}`;
          console.log(`기타 차트 API 요청: ${apiUrl}`);
        }
        
        console.log(`API URL: ${apiUrl} (차트 타입: ${chartType})`);
        
        const response = await fetch(apiUrl);
        
        if (!response.ok) {
          const errorText = await response.text();
          console.error(`데이터 로딩 실패: HTTP ${response.status} - ${apiUrl}`);
          console.error(`에러 응답: ${errorText}`);
          throw new Error(`데이터 로딩 실패: HTTP ${response.status} - ${errorText}`);
        }
        
        const data: UpbitCandle[] = await response.json();
        
        if (!data || data.length === 0) {
          console.log('더 이상 불러올 데이터가 없습니다.');
          break;
        }
        
        console.log(`데이터 ${data.length}개 수신 완료. 첫번째 캔들 시간: ${data[0].candle_date_time_kst}, 마지막 캔들 시간: ${data[data.length-1].candle_date_time_kst}`);
        
        // 데이터 처리
        const processedData = data.map((candle: UpbitCandle) => ({
          time: new Date(candle.candle_date_time_kst).getTime() / 1000 as Time,
          open: candle.opening_price,
          high: candle.high_price,
          low: candle.low_price,
          close: candle.trade_price,
          volume: candle.candle_acc_trade_volume,
        }));
        
        // 시작 날짜보다 이전 데이터는 필터링
        const filteredData = processedData.filter(
            candle => new Date((candle.time as number) * 1000) >= startDate
        );
        
        allProcessedData.push(...filteredData);
        
        // 목표 캔들 수에 도달했거나 더 많다면 중단
        if (allProcessedData.length >= targetCandles) {
          console.log(`목표 캔들 수(${targetCandles}개)에 도달했거나 초과했습니다(현재: ${allProcessedData.length}개). 데이터 로드를 중단합니다.`);
          break;
        }
        
        // 마지막 캔들의 시간으로 다음 요청의 기준 시간 설정
        const lastCandle = data[data.length - 1];
        currentTo = new Date(lastCandle.candle_date_time_kst);
        
        // 시작 날짜에 도달했거나 지났으면 중단
        if (currentTo <= startDate) {
          console.log('시작 날짜에 도달하여 데이터 로드를 중단합니다.');
          break;
        }
        
        // API 호출 제한을 위한 딜레이
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      if (allProcessedData.length === 0) {
        console.error('로드된 데이터가 없습니다. 날짜 범위를 확인하세요.');
        ongoingRequestRef.current = false;
        setProgress(0);
        return;
      }
      
      // 한 번만 정렬
      allProcessedData.sort((a, b) => {
        if (typeof a.time === 'number' && typeof b.time === 'number') {
          return a.time - b.time;
        }
        return 0;
      });
      
      console.log(`총 ${allProcessedData.length}개 캔들 데이터 처리 완료`);
      setProgress(50);
      
      // 모든 데이터 처리가 완료되면 결과 적용
      processLoadedData(allProcessedData);
      
      // 모든 데이터 저장
      setAllData(allProcessedData);
      
      // 전체 데이터 로드 후 실시간 API로 전환 (자동 업데이트 모드일 경우)
      console.log('데이터 로드 완료, 실시간 전환 조건 확인:', {
        isAutoUpdate,
        chartType,
        timeframe: chartType === 'seconds/60' ? '1분봉' : chartType
      });
      
      if (isAutoUpdate && chartType === 'seconds/60') {
        console.log('✅ 조건 충족: 실시간 업데이트로 전환 예정');
        console.log('- isAutoUpdate:', isAutoUpdate);
        console.log('- chartType:', chartType);
        console.log('- 데이터 개수:', allProcessedData.length);
        
        // 데이터가 충분한지 확인 (최소 100개 이상)
        if (allProcessedData.length >= 100) {
          console.log('✅ 데이터가 충분합니다. 실시간 업데이트로 전환합니다.');
        // 자동 업데이트에서 실시간 업데이트로 전환
        switchToRealtimeAfterUpdate();
        } else {
          console.log('❌ 데이터가 부족합니다. 더 많은 데이터를 로드한 후 다시 시도합니다.');
        }
      } else {
        console.log('❌ 실시간 업데이트 전환 조건 미충족');
        console.log('- isAutoUpdate:', isAutoUpdate);
        console.log('- chartType:', chartType);
        
        if (!isAutoUpdate) {
          console.log('  → 자동 업데이트가 비활성화되어 있습니다. 활성화 후 다시 시도하세요.');
        }
        
        if (chartType !== 'seconds/60') {
          console.log(`  → 차트 타입이 초봉(seconds/60)이 아닙니다. 현재: ${chartType}`);
        }
      }
      
    } catch (error) {
      console.error('차트 데이터 로드 중 오류 발생:', error);
    } finally {
      ongoingRequestRef.current = false;
    }
  }, [symbol, chartType, dateRange, isRealtimeAPIEnabled, isAutoUpdate, setAllData, setChartPrice, setProgress]);

  // 차트 초기화 콜백
  const handleChartReady = useCallback((
    chartApi: IChartApi,
    candleSeries: ISeriesApi<"Candlestick">,
    volumeSeries: ISeriesApi<"Histogram">,
    sixtyEMASeries: ISeriesApi<"Line">,
    oneTwentyEMASeries: ISeriesApi<"Line">,
    twoFortyEMASeries: ISeriesApi<"Line">,
    threeHundredSixtyEMASeries: ISeriesApi<"Line">,
    sixHundredEMASeries: ISeriesApi<"Line">,
    nineHundredEMASeries: ISeriesApi<"Line">
  ) => {
    chartRef.current = chartApi;
    candleSeriesRef.current = candleSeries;
    volumeSeriesRef.current = volumeSeries;
    sixtyEMASeriesRef.current = sixtyEMASeries;
    oneTwentyEMASeriesRef.current = oneTwentyEMASeries;
    twoFortyEMASeriesRef.current = twoFortyEMASeries;
    threeHundredSixtyEMASeriesRef.current = threeHundredSixtyEMASeries;
    sixHundredEMASeriesRef.current = sixHundredEMASeries;
    nineHundredEMASeriesRef.current = nineHundredEMASeries;
    
    // 볼륨 시리즈 설정
    chartApi.priceScale('volume').applyOptions({
      scaleMargins: {
        top: 0.8,
        bottom: 0,
      },
      borderVisible: false,
    });
    
    // 이동평균선 스타일 설정
    if (twoFortyEMASeriesRef.current) {
      twoFortyEMASeriesRef.current.applyOptions({
        color: '#FFFF00',  // 밝은 노란색으로 변경
        lineWidth: 2,      // 선 두께를 두껍게
        visible: showMA.twoForty
      });
      console.log('240MA 스타일 설정 완료 - 색상: 노란색, 두께: 2px, 표시 여부:', showMA.twoForty);
    }
    
    // 차트 준비 후 데이터 로드
    loadData();
  }, [loadData, showMA]);

  // 전체화면 토글
  const toggleFullscreen = useCallback(() => {
    const elem = document.documentElement;
    
    if (!isFullscreen) {
      if (elem.requestFullscreen) {
        elem.requestFullscreen();
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    }
    
    setIsFullscreen(!isFullscreen);
  }, [isFullscreen]);

  // 이동평균선 표시 설정 업데이트
  const updateShowMA = useCallback((newShowMA: MASettings) => {
    setShowMA(newShowMA);
    
    if (
      sixtyEMASeriesRef.current && 
      oneTwentyEMASeriesRef.current && 
      twoFortyEMASeriesRef.current && 
      threeHundredSixtyEMASeriesRef.current &&
      sixHundredEMASeriesRef.current &&
      nineHundredEMASeriesRef.current
    ) {
      sixtyEMASeriesRef.current.applyOptions({ visible: newShowMA.sixty });
      oneTwentyEMASeriesRef.current.applyOptions({ visible: newShowMA.oneTwenty });
      twoFortyEMASeriesRef.current.applyOptions({ visible: newShowMA.twoForty });
      threeHundredSixtyEMASeriesRef.current.applyOptions({ visible: newShowMA.threeHundredSixty });
      sixHundredEMASeriesRef.current.applyOptions({ visible: newShowMA.sixHundred });
      nineHundredEMASeriesRef.current.applyOptions({ visible: newShowMA.nineHundred });
    }
  }, []);

  // 차트 높이 변경 핸들러
  const handleHeightChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setChartHeight(Number(e.target.value));
  }, []);

  // 자동 업데이트 토글 핸들러
  const handleAutoUpdateToggle = useCallback(() => {
    setIsAutoUpdate(prev => !prev);
  }, []);

  // 실시간 API 토글 핸들러
  const handleRealtimeAPIToggle = useCallback(() => {
    setIsRealtimeAPIEnabled(prev => !prev);
  }, []);

  // 이동평균선 업데이트 함수 최적화
  const updateMovingAverages = useCallback((data: ExtendedCandlestickData[]) => {
    // 최소 60개 데이터는 필요 (모든 이평선을 계산하지 않더라도 차트를 표시하기 위함)
    if (data.length < 60) {
      console.log('데이터가 60개 미만이어서 이동평균선을 업데이트할 수 없습니다:', data.length);
      return;
    }
    
    const startTime = Date.now();
    console.log('이동평균선 업데이트 시작 - 데이터 길이:', data.length);
    
    try {
      // 마지막 캔들 시간
      const lastTime = data[data.length - 1].time;
      
      // 이동평균선 계산 함수 (부드러운 이동평균 사용)
      const calculateSmoothMA = (period: number, seriesRef: React.MutableRefObject<ISeriesApi<"Line"> | null>) => {
        // 데이터가 충분한지 확인
        if (data.length < period) {
          console.log(`데이터가 부족하여 ${period}MA를 계산할 수 없습니다. 필요: ${period}, 현재: ${data.length}`);
          return null;
        }
        
        // 이전 값 가져오기
        let prevValue: number | null = null;
        let hasData = false;
        
        if (seriesRef.current) {
          const seriesData = seriesRef.current.data() as { time: Time; value: number }[];
          if (seriesData && seriesData.length > 0) {
            prevValue = seriesData[seriesData.length - 1].value;
            hasData = true;
          }
        }
        
        // 이전 데이터가 없고, 데이터가 충분하지 않으면 계산할 수 없음
        if (!hasData && data.length < period * 1.2) {
          console.log(`${period}MA 초기 계산을 위한 데이터가 부족합니다. 필요: ${Math.round(period * 1.2)}, 현재: ${data.length}`);
          return null;
        }
        
        // 성능 최적화: 단순 이동평균 계산 (슬라이스 최소화)
        let sum = 0;
        const startIdx = Math.max(0, data.length - period);
        for (let i = startIdx; i < data.length; i++) {
          sum += data[i].close;
        }
        const sma = sum / (data.length - startIdx);
        
        // 새 값 계산
        let newValue: number;
        
        if (prevValue === null) {
          // 이전 값이 없으면 SMA 사용
          newValue = sma;
          console.log(`${period}MA 초기값 설정:`, newValue.toFixed(2));
        } else {
          // 이전 값이 있으면 부드러운 전환 적용
          
          // 1. 지수 이동평균 계산 (EMA)
          const alpha = 2 / (period + 1);
          const ema = (data[data.length - 1].close - prevValue) * alpha + prevValue;
          
          // 2. 변화율 제한 적용 (실시간 업데이트에서는 제한 완화)
          const changePercent = Math.abs((ema - prevValue) / prevValue * 100);
          
          // 각 이동평균선별 최대 변화율 설정 - 실시간 업데이트를 위해 값 증가
          let maxChangePercent: number;
          if (period <= 60) {
            maxChangePercent = 1.0; // 60MA는 최대 1.0% 변화
          } else if (period <= 120) {
            maxChangePercent = 0.9; // 120MA는 최대 0.9% 변화
          } else if (period <= 240) {
            maxChangePercent = 0.8; // 240MA는 최대 0.8% 변화
          } else if (period <= 360) {
            maxChangePercent = 0.7; // 360MA는 최대 0.7% 변화
          } else if (period <= 600) {
            maxChangePercent = 0.6; // 600MA는 최대 0.6% 변화
          } else {
            maxChangePercent = 0.5; // 900MA는 최대 0.5% 변화
          }
          
          if (changePercent > maxChangePercent) {
            // 변화율이 너무 크면 제한
            const maxChange = prevValue * (maxChangePercent / 100);
            newValue = prevValue + (ema > prevValue ? maxChange : -maxChange);
          } else {
            newValue = ema;
          }
        }
        
        return {
          time: lastTime,
          value: newValue
        };
      };
      
      // 모든 이동평균선 계산 시도 (단기 이평선)
      const ma60 = calculateSmoothMA(60, sixtyEMASeriesRef);
      const ma120 = calculateSmoothMA(120, oneTwentyEMASeriesRef);
      const ma240 = calculateSmoothMA(240, twoFortyEMASeriesRef);
      
      // 장기 이평선 (데이터가 충분할 때)
      const ma360 = data.length >= 360 ? calculateSmoothMA(360, threeHundredSixtyEMASeriesRef) : null;
      const ma600 = data.length >= 600 ? calculateSmoothMA(600, sixHundredEMASeriesRef) : null;
      const ma900 = data.length >= 900 ? calculateSmoothMA(900, nineHundredEMASeriesRef) : null;
      
      // 이동평균선 차트 업데이트 - 모든 MA 상태 로깅
      console.log('이동평균선 업데이트 상태:');
      
      if (ma60 && sixtyEMASeriesRef.current) {
        sixtyEMASeriesRef.current.update(ma60);
        sixtyEMASeriesRef.current.applyOptions({ visible: showMA.sixty });
        console.log('- 60MA 업데이트:', ma60.value.toFixed(2), showMA.sixty ? '(표시)' : '(숨김)');
      } else {
        console.log('- 60MA 업데이트 실패:', ma60 ? '시리즈 참조 없음' : '계산 결과 없음');
      }
      
      if (ma120 && oneTwentyEMASeriesRef.current) {
        oneTwentyEMASeriesRef.current.update(ma120);
        oneTwentyEMASeriesRef.current.applyOptions({ visible: showMA.oneTwenty });
        console.log('- 120MA 업데이트:', ma120.value.toFixed(2), showMA.oneTwenty ? '(표시)' : '(숨김)');
      } else {
        console.log('- 120MA 업데이트 실패:', ma120 ? '시리즈 참조 없음' : '계산 결과 없음');
      }
      
      if (ma240 && twoFortyEMASeriesRef.current) {
        twoFortyEMASeriesRef.current.update(ma240);
        twoFortyEMASeriesRef.current.applyOptions({ visible: showMA.twoForty });
        console.log('- 240MA 업데이트:', ma240.value.toFixed(2), showMA.twoForty ? '(표시)' : '(숨김)');
        
        // 240MA 현재 데이터 확인
        const currentData = twoFortyEMASeriesRef.current.data() as { time: Time; value: number }[];
        console.log(`- 240MA 현재 데이터 개수: ${currentData.length}개, 시리즈 표시 상태: ${showMA.twoForty ? '표시' : '숨김'}`);
      } else {
        console.log('- 240MA 업데이트 실패:', ma240 ? '시리즈 참조 없음' : '계산 결과 없음');
      }
      
      // 장기 이평선 업데이트 (360, 600, 900)
      if (ma360 && threeHundredSixtyEMASeriesRef.current) {
        threeHundredSixtyEMASeriesRef.current.update(ma360);
        threeHundredSixtyEMASeriesRef.current.applyOptions({ visible: showMA.threeHundredSixty });
        console.log('- 360MA 업데이트:', ma360.value.toFixed(2), showMA.threeHundredSixty ? '(표시)' : '(숨김)');
      } else if (data.length >= 360) {
        console.log('- 360MA 업데이트 실패:', ma360 ? '시리즈 참조 없음' : '계산 결과 없음');
      } else {
        console.log('- 360MA 업데이트 건너뜀: 데이터 부족 (필요: 360, 현재:', data.length, ')');
      }
      
      if (ma600 && sixHundredEMASeriesRef.current) {
        sixHundredEMASeriesRef.current.update(ma600);
        sixHundredEMASeriesRef.current.applyOptions({ visible: showMA.sixHundred });
        console.log('- 600MA 업데이트:', ma600.value.toFixed(2), showMA.sixHundred ? '(표시)' : '(숨김)');
      } else if (data.length >= 600) {
        console.log('- 600MA 업데이트 실패:', ma600 ? '시리즈 참조 없음' : '계산 결과 없음');
      } else {
        console.log('- 600MA 업데이트 건너뜀: 데이터 부족 (필요: 600, 현재:', data.length, ')');
      }
      
      if (ma900 && nineHundredEMASeriesRef.current) {
        nineHundredEMASeriesRef.current.update(ma900);
        nineHundredEMASeriesRef.current.applyOptions({ visible: showMA.nineHundred });
        console.log('- 900MA 업데이트:', ma900.value.toFixed(2), showMA.nineHundred ? '(표시)' : '(숨김)');
      } else if (data.length >= 900) {
        console.log('- 900MA 업데이트 실패:', ma900 ? '시리즈 참조 없음' : '계산 결과 없음');
          } else {
        console.log('- 900MA 업데이트 건너뜀: 데이터 부족 (필요: 900, 현재:', data.length, ')');
      }
      
      const endTime = Date.now();
      console.log(`이동평균선 업데이트 완료: ${endTime - startTime}ms 소요`);
    } catch (error) {
      console.error('이동평균선 업데이트 오류:', error);
    }
  }, [showMA]);

  // 실시간 API 업데이트 함수
  const updateRealtimeData = useCallback(async () => {
    // 이미 업데이트 중이면 중복 요청 방지 (단, 3초 이상 걸리면 강제로 새로운 요청 허용)
    if (!isRealtimeAPIEnabled || !chartType.startsWith('seconds/')) {
      console.log('실시간 데이터 업데이트 무시: API 비활성화 또는 차트 타입 불일치', {
        isRealtimeAPIEnabled,
        chartType
      });
      return;
    }
    
    const now = Date.now();
    console.log('실시간 데이터 업데이트 시도:', new Date(now).toLocaleTimeString());
    
    if (ongoingRequestRef.current) {
      const lastRequestTime = ongoingRequestRef.current as unknown as number;
      // 마지막 요청 시작 후 3초가 지났으면 새 요청 허용
      if (now - lastRequestTime < 3000) {
        console.log(`이전 요청 진행 중... (${((now - lastRequestTime) / 1000).toFixed(1)}초 경과)`);
        return;
      } else {
        console.log('이전 요청 타임아웃, 새 요청 시작');
      }
    }
    
    // 요청 시작 시간 기록
    ongoingRequestRef.current = now as any; // 타입 오류 해결
    
    try {
      console.log('실시간 데이터 업데이트 시작:', new Date().toLocaleTimeString());
      setRealtimeUpdateStatus(prev => ({
        ...prev,
        isUpdating: true
      }));
      
      // 현재 시간 기준으로 최신 데이터 가져오기
      const to = new Date().toISOString();
      
      // API 호출 시작 시간 기록
      const apiStartTime = Date.now();
      
      // 초봉 차트일 경우 내부 API를 사용
      let apiUrl = '';
      let data: UpbitCandle[] = [];
      
      if (chartType.startsWith('seconds/')) {
        // 초봉 차트를 위해 내부 API 사용
        const unit = chartType.split('/')[1]; // 60 추출
        apiUrl = `/api/candles/seconds?market=${symbol}&count=2`; // 실시간 업데이트는 최근 2개만 필요
        console.log(`초봉 자동 업데이트 API 요청: ${apiUrl} (내부 API 사용)`);
      } else if (chartType.startsWith('minutes/')) {
        // 분봉 차트는 기존대로 업비트 API 직접 호출
        const minUnit = chartType.split('/')[1]; // 5 또는 15 추출
        apiUrl = `https://api.upbit.com/v1/candles/minutes/${minUnit}?market=${symbol}&to=${to}&count=2`; // 실시간 업데이트는 최근 2개만
        console.log(`분봉 자동 업데이트 API 요청: ${apiUrl}`);
      } else {
        console.log('지원하지 않는 차트 타입:', chartType);
        ongoingRequestRef.current = false;
        return;
      }
      
      const response = await fetch(apiUrl);
      
      // API 호출 소요 시간 계산
      const apiTime = Date.now() - apiStartTime;
      console.log(`API 호출 소요 시간: ${apiTime}ms`);
      
      if (!response.ok) {
        throw new Error(`실시간 데이터 로딩 실패: ${response.status} ${response.statusText}`);
      }
      
      data = await response.json();
      
      if (!data || data.length === 0) {
        console.log('새로운 데이터 없음');
        ongoingRequestRef.current = false;
        return;
      }
      
      // 데이터 처리 시작 시간 기록
      const processStartTime = Date.now();
      
      // 가장 최신 캔들 가져오기
      const latestCandle = data[0];
      
      // 데이터 처리
      const newCandle = {
        time: new Date(latestCandle.candle_date_time_kst).getTime() / 1000 as Time,
        open: latestCandle.opening_price,
        high: latestCandle.high_price,
        low: latestCandle.low_price,
        close: latestCandle.trade_price,
        volume: latestCandle.candle_acc_trade_volume,
      };
      
      // 현재 차트에 있는 마지막 캔들 확인
      let shouldUpdate = true;
      if (allData.length > 0) {
        const lastCandle = allData[allData.length - 1];
        // 같은 시간의 캔들이면 업데이트, 다른 시간이면 추가
        if (lastCandle.time === newCandle.time) {
          // 마지막 캔들 업데이트
          const updatedData = [...allData.slice(0, -1), newCandle];
          setAllData(updatedData);
          
          // 차트 업데이트
          if (candleSeriesRef.current) {
            candleSeriesRef.current.update(newCandle);
          }
          
          // 볼륨 업데이트
          if (volumeSeriesRef.current) {
            volumeSeriesRef.current.update({
              time: newCandle.time,
              value: newCandle.volume,
              color: newCandle.close >= newCandle.open ? '#26a69a' : '#ef5350',
            });
          }
          
          // 이동평균선 업데이트 (성능 최적화: 1초마다 하지 않고 3초마다 수행)
          const shouldUpdateMA = Date.now() % 3000 < 1000;
          if (shouldUpdateMA) {
            updateMovingAverages(updatedData);
          }
          
          console.log('기존 캔들 업데이트:', newCandle);
          
          // 전략 분석 실행 및 마커 업데이트 (새 캔들이 추가될 때)
          if (updatedData.length > 900) {
            console.log('전략 분석 실행 및 마커 업데이트...');
            const analysisResult = useUpbitStore.getState().analyzeRealtimeData(updatedData);
            
            if (analysisResult && analysisResult.signals) {
              const signals = analysisResult.signals
                .filter((signal: any) => signal.position !== null)
                .map((signal: any) => ({
                  ...signal,
                  time: signal.time as unknown as Time,
                  position: signal.position as 'buy' | 'sell',
                  metadata: signal.metadata ? {
                    ...signal.metadata,
                    ma60: signal.metadata.ma60 || 0
                  } : undefined
                }));
              
              // 차트에 표시할 신호 수 제한 (최근 50개만 표시)
              const limitedSignals = signals.length > 50 ? signals.slice(-50) : signals;
              
              // 로그에 신호 수 출력
              console.log(`총 신호 수: ${signals.length}, 차트에 표시될 신호 수: ${limitedSignals.length}`);
              console.log(`매수 신호: ${(signals as any[]).filter(s => s.position === 'buy').length}, 매도 신호: ${(signals as any[]).filter(s => s.position === 'sell').length}`);
              
              const strategyMarkers = createTradeMarkers(limitedSignals as TradeSignal[]);
              updateMarkers(strategyMarkers);
              console.log(`마커 업데이트 완료: ${strategyMarkers.length}개 (매수: ${(signals as any[]).filter(s => s.position === 'buy').length}개, 매도: ${(signals as any[]).filter(s => s.position === 'sell').length}개)`);
            }
          }
        } else if ((newCandle.time as number) > (lastCandle.time as number)) {
          // 새 캔들 추가
          const updatedData = [...allData, newCandle];
          setAllData(updatedData);
          
          // 차트에 새 캔들 추가
          if (candleSeriesRef.current) {
            candleSeriesRef.current.update(newCandle);
          }
          
          // 볼륨 추가
          if (volumeSeriesRef.current) {
            volumeSeriesRef.current.update({
              time: newCandle.time,
              value: newCandle.volume,
              color: newCandle.close >= newCandle.open ? '#26a69a' : '#ef5350',
            });
          }
          
          // 이동평균선 업데이트 (새 캔들이 추가될 때는 항상 수행)
          updateMovingAverages(updatedData);
          
          console.log('새 캔들 추가:', newCandle);
          
          // 전략 분석 실행 및 마커 업데이트 (새 캔들이 추가될 때)
          if (updatedData.length > 900) {
            console.log('전략 분석 실행 및 마커 업데이트...');
            const analysisResult = useUpbitStore.getState().analyzeRealtimeData(updatedData);
            
            if (analysisResult && analysisResult.signals) {
              const signals = analysisResult.signals
                .filter((signal: any) => signal.position !== null)
                .map((signal: any) => ({
                  ...signal,
                  time: signal.time as unknown as Time,
                  position: signal.position as 'buy' | 'sell',
                  metadata: signal.metadata ? {
                    ...signal.metadata,
                    ma60: signal.metadata.ma60 || 0
                  } : undefined
                }));
              
              // 차트에 표시할 신호 수 제한 (최근 50개만 표시)
              const limitedSignals = signals.length > 50 ? signals.slice(-50) : signals;
              
              // 로그에 신호 수 출력
              console.log(`총 신호 수: ${signals.length}, 차트에 표시될 신호 수: ${limitedSignals.length}`);
              console.log(`매수 신호: ${(signals as any[]).filter(s => s.position === 'buy').length}, 매도 신호: ${(signals as any[]).filter(s => s.position === 'sell').length}`);
              
              const strategyMarkers = createTradeMarkers(limitedSignals as TradeSignal[]);
              console.log(`마커 업데이트 완료: ${strategyMarkers.length}개 (매수: ${(signals as any[]).filter(s => s.position === 'buy').length}개, 매도: ${(signals as any[]).filter(s => s.position === 'sell').length}개)`);
            }
          }
        } else {
          shouldUpdate = false;
          console.log('이전 캔들 무시:', newCandle);
        }
      } else {
        // 데이터가 없는 경우 첫 캔들 추가
        setAllData([newCandle]);
        
        if (candleSeriesRef.current) {
          candleSeriesRef.current.setData([newCandle]);
        }
        
        if (volumeSeriesRef.current) {
          volumeSeriesRef.current.setData([{
            time: newCandle.time,
            value: newCandle.volume,
            color: newCandle.close >= newCandle.open ? '#26a69a' : '#ef5350',
          }]);
        }
        
        console.log('첫 캔들 추가:', newCandle);
      }
      
      // 데이터 처리 소요 시간 계산
      const processTime = Date.now() - processStartTime;
      console.log(`데이터 처리 소요 시간: ${processTime}ms`);
      
      // 현재 가격 업데이트
      if (shouldUpdate) {
        setChartPrice(newCandle.close);
        
        // 업데이트 상태 갱신
        setRealtimeUpdateStatus(prev => ({
          isUpdating: false,
          lastUpdateTime: new Date().toLocaleString('ko-KR'),
          updateCount: prev.updateCount + 1,
          markers: prev.markers
        }));
      }
      
      // 전체 소요 시간 계산
      const totalTime = Date.now() - now;
      console.log(`실시간 업데이트 완료: ${totalTime}ms 소요`);
      
    } catch (error) {
      console.error('실시간 데이터 업데이트 오류:', error);
    } finally {
      ongoingRequestRef.current = false;
      setRealtimeUpdateStatus(prev => ({
        ...prev,
        isUpdating: false
      }));
    }
  }, [isRealtimeAPIEnabled, chartType, symbol, allData, updateMovingAverages]);

  // 실시간 업데이트 타이머 설정
  useEffect(() => {
    if (isRealtimeAPIEnabled && chartType.startsWith('seconds/')) {
      console.log('실시간 업데이트 타이머 설정 중...', {
        isRealtimeAPIEnabled,
        chartType,
        timestamp: new Date().toLocaleTimeString()
      });
      
      // 1초마다 업데이트 (매매 상태를 더 자주 체크하기 위해)
      const timer = setInterval(() => {
        updateRealtimeData();
      }, 1000);
      
      timeoutRef.current = timer;
      
      console.log('실시간 업데이트 타이머 설정 완료: 1초 간격');
      
      return () => {
        if (timeoutRef.current) {
          clearInterval(timeoutRef.current);
          timeoutRef.current = null;
          console.log('실시간 업데이트 타이머 해제');
        }
      };
    } else {
      console.log('실시간 업데이트 타이머를 설정하지 않음:', {
        isRealtimeAPIEnabled,
        chartType,
        timestamp: new Date().toLocaleTimeString()
      });
    }
  }, [isRealtimeAPIEnabled, chartType, updateRealtimeData]);

  // 자동 업데이트 함수 (실시간 API 사용하지 않을 때)
  const handleAutoUpdate = useCallback(async () => {
    if (!isAutoUpdate || isRealtimeAPIEnabled || ongoingRequestRef.current) return;
    
    ongoingRequestRef.current = true;
    
    try {
      console.log('자동 업데이트 시작...');
      
      // 현재 시간 기준으로 최신 데이터 가져오기
      const now = new Date();
      const to = now.toISOString();
      const endpoint = getChartEndpoint(chartType);
      
      // 데이터 수집 최적화: 900개 이평선 계산을 위해 충분한 데이터 확보
      const dataNeeded = Math.max(1000, allData.length); // 최소 1000개 또는 현재 보유 데이터 이상
      let countToFetch = Math.min(1000, dataNeeded); // API 제한을 고려하여 최대 1000개
      
      console.log(`자동 업데이트: ${countToFetch}개의 데이터 요청 중...`);
      
      // minutes/5, minutes/15 등의 경우 unit 파라미터를 추가
      let apiUrl = `https://api.upbit.com/v1/candles/${endpoint}?market=${symbol}&to=${to}&count=${countToFetch}`;
      if (chartType.startsWith('minutes/')) {
        const unit = chartType.split('/')[1]; // 5 또는 15 추출
        apiUrl = `https://api.upbit.com/v1/candles/minutes/${unit}?market=${symbol}&to=${to}&count=${countToFetch}`;
        console.log(`분봉 자동 업데이트 API 요청: ${apiUrl}`);
      }
      
      const response = await fetch(apiUrl);
      
      if (!response.ok) {
        throw new Error('자동 업데이트 데이터 로딩 실패');
      }
      
      const data: UpbitCandle[] = await response.json();
      
      if (!data || data.length === 0) {
        console.log('새로운 데이터 없음');
        return;
      }
      
      // 데이터 처리
      const processedData = data.map((candle: UpbitCandle) => ({
        time: new Date(candle.candle_date_time_kst).getTime() / 1000 as Time,
        open: candle.opening_price,
        high: candle.high_price,
        low: candle.low_price,
        close: candle.trade_price,
        volume: candle.candle_acc_trade_volume,
      })).reverse(); // 시간 순으로 정렬
      
      // 기존 데이터와 새 데이터를 결합하여 연속성 유지
      // 중복 제거를 위해 시간별로 그룹화
      const timeMap = new Map();
      
      // 기존 데이터 추가
      allData.forEach(candle => {
        timeMap.set(candle.time, candle);
      });
      
      // 새 데이터 추가 (덮어쓰기)
      processedData.forEach(candle => {
        timeMap.set(candle.time, candle);
      });
      
      // 맵을 배열로 변환하고 시간순으로 정렬
      const combinedData = Array.from(timeMap.values())
        .sort((a, b) => (a.time as number) - (b.time as number));
      
      console.log(`통합 데이터: 총 ${combinedData.length}개 캔들 (기존: ${allData.length}, 새로운: ${processedData.length})`);
      
      // 차트 업데이트 - 통합된 데이터 사용
      if (candleSeriesRef.current) {
        // 전체 데이터로 캔들 차트 업데이트 (setData는 기존 데이터를 대체함)
        candleSeriesRef.current.setData(combinedData);
        console.log('캔들 차트 업데이트 완료: 통합 데이터 사용');
      }
      
      // 볼륨 업데이트 - 통합된 데이터 사용
      if (volumeSeriesRef.current) {
        const volumeData = combinedData.map((d) => ({
          time: d.time,
          value: d.volume,
          color: d.close >= d.open ? '#26a69a' : '#ef5350',
        }));
        volumeSeriesRef.current.setData(volumeData);
        console.log('볼륨 차트 업데이트 완료: 통합 데이터 사용');
      }
      
      // 이동평균선 업데이트 - 통합된 데이터 사용
      updateMovingAverages(combinedData);
      
      // 통합 데이터로 분석 및 마커 업데이트
      if (combinedData.length > 900) {
        console.log('자동 업데이트: 전략 분석 실행 및 마커 업데이트...');
        
        // 전체 통합 데이터로 분석 실행
        const analysisResult = useUpbitStore.getState().analyzeRealtimeData(combinedData);
        
        console.log('분석 결과:', analysisResult?.signals?.length ?? 0, '개의 신호 발견');
        
        if (analysisResult && analysisResult.signals) {
          const signals = analysisResult.signals
            .filter((signal: any) => signal.position !== null)
            .map((signal: any) => ({
              ...signal,
              time: signal.time as unknown as Time,
              position: signal.position as 'buy' | 'sell',
              metadata: signal.metadata ? {
                ...signal.metadata,
                ma60: signal.metadata.ma60 || 0,
                ma120: signal.metadata.ma120 || 0,
                ma240: signal.metadata.ma240 || 0,
                ma900: signal.metadata.ma900 || 0,
                upperBand: signal.metadata.upperBand || 0,
                lowerBand: signal.metadata.lowerBand || 0,
                deviation: signal.metadata.deviation || 0,
                isAbove900MA: signal.metadata.isAbove900MA || false
              } : undefined
            }));
          
          // 차트에 표시할 신호 수 제한 (최근 50개만 표시)
          const limitedSignals = signals.length > 50 ? signals.slice(-50) : signals;
          
          // 로그에 신호 수 출력
          console.log(`총 신호 수: ${signals.length}, 차트에 표시될 신호 수: ${limitedSignals.length}`);
          console.log(`매수 신호: ${(signals as any[]).filter(s => s.position === 'buy').length}, 매도 신호: ${(signals as any[]).filter(s => s.position === 'sell').length}`);
          
          const strategyMarkers = createTradeMarkers(limitedSignals as TradeSignal[]);
          console.log(`자동 업데이트: 마커 ${strategyMarkers.length}개 생성 (매수: ${(signals as any[]).filter(s => s.position === 'buy').length}개, 매도: ${(signals as any[]).filter(s => s.position === 'sell').length}개)`);
          
          // 마커 업데이트
          updateMarkers(strategyMarkers);
        }
      }
      
      // 통합 데이터를 차트에 저장
      setAllData(combinedData);
      
      // 현재 가격 업데이트
      if (combinedData.length > 0) {
        setChartPrice(combinedData[combinedData.length - 1].close);
      }
      
      console.log('자동 업데이트 완료: 차트와 마커가 업데이트되었습니다.');
    } catch (error) {
      console.error('자동 업데이트 오류:', error);
    } finally {
      ongoingRequestRef.current = false;
    }
  }, [isAutoUpdate, isRealtimeAPIEnabled, chartType, symbol, allData, updateMovingAverages, setAllData, updateMarkers, setChartPrice]);
  
  // 자동 업데이트 타이머 설정
  useEffect(() => {
    if (isAutoUpdate && !isRealtimeAPIEnabled) {
      // 10초마다 자동 업데이트
      const timer = setInterval(() => {
        handleAutoUpdate();
      }, 10000);
      
      timeoutRef.current = timer;
      
      console.log('자동 업데이트 타이머 설정: 10초 간격');
      
      return () => {
        if (timeoutRef.current) {
          clearInterval(timeoutRef.current);
          timeoutRef.current = null;
          console.log('자동 업데이트 타이머 해제');
        }
      };
    }
  }, [isAutoUpdate, isRealtimeAPIEnabled, handleAutoUpdate]);

  // 전략 변경 감지를 위한 구독
  useEffect(() => {
    // 초기 전략 설정
    setCurrentStrategy(useUpbitStore.getState().tradeStrategy);
    
    // 스토어 구독
    const unsubscribe = useUpbitStore.subscribe((state) => {
      const newStrategy = state.tradeStrategy;
      // 현재 상태에서 최신 값을 가져옴
      setCurrentStrategy(prevStrategy => {
        if (newStrategy !== prevStrategy) {
          console.log(`전략 변경 감지: ${prevStrategy} -> ${newStrategy}`);
          return newStrategy;
        }
        return prevStrategy;
      });
    });
    
    return () => {
      unsubscribe();
    };
  }, []);

  // 전략 변경 시 데이터 재분석
  useEffect(() => {
    if (allData.length > 0) {
      console.log(`전략이 ${currentStrategy}로 변경되어 데이터를 다시 분석합니다.`);
      console.log(`분석할 데이터 크기: ${allData.length}개 캔들`);
      
      if (currentStrategy === 'MACD' as any) {
        console.log('MACD 전략은 최소 35개의 캔들이 필요합니다.');
      }
      
      // 마커 초기화
      setMarkers([]);
      
      // 데이터 재분석
      const analysisResult = useUpbitStore.getState().analyzeRealtimeData(allData);
      
      console.log('분석 결과:', analysisResult?.signals?.length ?? 0, '개의 신호 발견');
      
      if (analysisResult && analysisResult.signals) {
        const signals = analysisResult.signals
          .filter((signal: any) => signal.position !== null)
          .map((signal: any) => ({
            ...signal,
            time: signal.time as unknown as Time,
            position: signal.position as 'buy' | 'sell',
            metadata: signal.metadata ? {
              ...signal.metadata,
              ma60: signal.metadata.ma60 || 0
            } : undefined
          }));
        
        // 차트에 표시할 신호 수 제한 (최근 50개만 표시)
        const limitedSignals = signals.length > 50 ? signals.slice(-50) : signals;
        
        // 로그에 신호 수 출력
        console.log(`총 신호 수: ${signals.length}, 차트에 표시될 신호 수: ${limitedSignals.length}`);
        console.log(`매수 신호: ${(signals as any[]).filter(s => s.position === 'buy').length}, 매도 신호: ${(signals as any[]).filter(s => s.position === 'sell').length}`);
        
        const strategyMarkers = createTradeMarkers(limitedSignals as TradeSignal[]);
        console.log(`전략 변경 후 마커 ${strategyMarkers.length}개 생성 (매수: ${(signals as any[]).filter(s => s.position === 'buy').length}개, 매도: ${(signals as any[]).filter(s => s.position === 'sell').length}개)`);
        
        // 마커 업데이트
        updateMarkers(strategyMarkers);
      }
    }
  }, [currentStrategy, allData]);

  const processLoadedData = useCallback((allProcessedData: ExtendedCandlestickData[]) => {
    // 캔들 데이터 설정
    if (candleSeriesRef.current) {
      candleSeriesRef.current.setData(allProcessedData);
      console.log(`캔들 데이터 설정 완료: ${allProcessedData.length}개`);
    }
    
    // 볼륨 데이터 설정
    if (volumeSeriesRef.current) {
      const volumeData = allProcessedData.map((d) => ({
        time: d.time,
        value: d.volume,
        color: d.close >= d.open ? '#26a69a' : '#ef5350',
      }));
      volumeSeriesRef.current.setData(volumeData);
      console.log(`볼륨 데이터 설정 완료: ${volumeData.length}개`);
    }
    
    // 이동평균선 설정
    const updateEMAs = async () => {
      try {
        console.log('이동평균선 계산 시작 (캔들 개수: ' + allProcessedData.length + '개)');
        
        // 짧은 기간의 이평선 계산
        const [ema60Data, ema120Data, ema240Data] = await Promise.all([
          Promise.resolve(calculateEMA(allProcessedData, 60)),
          Promise.resolve(calculateEMA(allProcessedData, 120)),
          Promise.resolve(calculateEMA(allProcessedData, 240))
        ]);
        
        console.log('이동평균선 계산 결과:');
        console.log(`- 60MA: ${ema60Data.length}개`);
        console.log(`- 120MA: ${ema120Data.length}개`);
        console.log(`- 240MA: ${ema240Data.length}개`);
        
        // 이동평균선 데이터 설정 및 가시성 조정
        if (sixtyEMASeriesRef.current) {
          sixtyEMASeriesRef.current.setData(ema60Data);
          sixtyEMASeriesRef.current.applyOptions({ visible: showMA.sixty });
          console.log(`60MA 설정 완료 (표시: ${showMA.sixty ? '보임' : '숨김'}, 데이터: ${ema60Data.length}개)`);
          
          // 시리즈 데이터 및 속성 검증
          const currentData = sixtyEMASeriesRef.current.data();
          console.log(`60MA 설정 후 실제 데이터 확인: ${(currentData as any[]).length}개, 첫번째 값:`, 
                     (currentData as any[])[0]?.value, '마지막 값:', (currentData as any[])[(currentData as any[]).length-1]?.value);
          
          const options = sixtyEMASeriesRef.current.options();
          console.log(`60MA 옵션 정보:`, { visible: options.visible, color: options.color, lineWidth: options.lineWidth });
        }
        
        if (oneTwentyEMASeriesRef.current) {
          oneTwentyEMASeriesRef.current.setData(ema120Data);
          oneTwentyEMASeriesRef.current.applyOptions({ visible: showMA.oneTwenty });
          console.log(`120MA 설정 완료 (표시: ${showMA.oneTwenty ? '보임' : '숨김'}, 데이터: ${ema120Data.length}개)`);
          
          // 시리즈 데이터 및 속성 검증
          const currentData = oneTwentyEMASeriesRef.current.data();
          console.log(`120MA 설정 후 실제 데이터 확인: ${(currentData as any[]).length}개`);
        }
        
        if (twoFortyEMASeriesRef.current) {
          twoFortyEMASeriesRef.current.setData(ema240Data);
          twoFortyEMASeriesRef.current.applyOptions({ visible: showMA.twoForty });
          console.log(`240MA 설정 완료 (표시: ${showMA.twoForty ? '보임' : '숨김'}, 데이터: ${ema240Data.length}개)`);
          
          // 시리즈 데이터 및 속성 검증
          const currentData = twoFortyEMASeriesRef.current.data();
          console.log(`240MA 설정 후 실제 데이터 확인: ${(currentData as any[]).length}개`);
        }
        
        // 장기 이평선 계산 및 설정
        let ema360Data: { time: Time; value: number }[] = [];
        let ema600Data: { time: Time; value: number }[] = [];
        let ema900Data: { time: Time; value: number }[] = [];
        
        if (allProcessedData.length >= 360) {
          ema360Data = calculateEMA(allProcessedData, 360);
          if (threeHundredSixtyEMASeriesRef.current) {
            threeHundredSixtyEMASeriesRef.current.setData(ema360Data);
            threeHundredSixtyEMASeriesRef.current.applyOptions({ visible: showMA.threeHundredSixty });
          }
        }
        
        if (allProcessedData.length >= 600) {
          ema600Data = calculateEMA(allProcessedData, 600);
          if (sixHundredEMASeriesRef.current) {
            sixHundredEMASeriesRef.current.setData(ema600Data);
            sixHundredEMASeriesRef.current.applyOptions({ visible: showMA.sixHundred });
          }
        }
        
        if (allProcessedData.length >= 900) {
          ema900Data = calculateEMA(allProcessedData, 900);
          if (nineHundredEMASeriesRef.current) {
            nineHundredEMASeriesRef.current.setData(ema900Data);
            nineHundredEMASeriesRef.current.applyOptions({ visible: showMA.nineHundred });
          }
        }
        
        // 매매 신호 분석 및 마커 생성
        const selectedStrategy = useUpbitStore.getState().strategies[useUpbitStore.getState().tradeStrategy];
        const analysisResult = selectedStrategy.analyze(allProcessedData);
        const signals = analysisResult.signals
          .filter(signal => signal.position !== null)
          .map(signal => ({
            ...signal,
            time: signal.time as unknown as Time,
            position: signal.position as 'buy' | 'sell',
            metadata: signal.metadata ? {
              ...signal.metadata,
              ma60: signal.metadata.ma60 || 0,
              ma120: signal.metadata.ma120 || 0,
              ma240: signal.metadata.ma240 || 0,
              ma900: signal.metadata.ma900 || 0,
              upperBand: signal.metadata.upperBand || 0,
              lowerBand: signal.metadata.lowerBand || 0,
              deviation: signal.metadata.deviation || 0,
              isAbove900MA: signal.metadata.isAbove900MA || false
            } : undefined
          }));
        
        // 차트에 표시할 신호 수 제한 (최근 50개만 표시)
        const limitedSignals = signals.length > 50 ? signals.slice(-50) : signals;
        
        // 로그에 신호 수 출력
        console.log(`총 신호 수: ${signals.length}, 차트에 표시될 신호 수: ${limitedSignals.length}`);
        console.log(`매수 신호: ${(signals as any[]).filter(s => s.position === 'buy').length}, 매도 신호: ${(signals as any[]).filter(s => s.position === 'sell').length}`);
        
        const strategyMarkers = createTradeMarkers(limitedSignals as TradeSignal[]);
        updateMarkers(strategyMarkers);
        
        // 백테스트 결과 계산 (전체 신호 사용)
        const backtestResult = calculateBacktestResult(allProcessedData, signals, mode || 'test');
        setBacktestResult(backtestResult);
        
        // 현재 가격 설정
        if (allProcessedData.length > 0) {
          const lastCandle = allProcessedData[allProcessedData.length - 1];
          setChartPrice(lastCandle.close);
        }
        
        // 타임스케일 피팅
        if (chartRef.current) {
          chartRef.current.timeScale().fitContent();
        }
        
        console.log('이동평균선 및 마커 설정 완료');
      } catch (error) {
        console.error('이동평균선 계산 및 설정 중 오류 발생:', error);
      }
    };
    
    updateEMAs();
  }, [showMA, mode, updateMarkers]);

  return {
    // 상태
    isFullscreen,
    chartHeight,
    chartPrice,
    progress,
    allData,
    markers,
    backtestResult,
    isAutoUpdate,
    isRealtimeAPIEnabled,
    lastSymbol,
    dateRange,
    showMA,
    realtimeUpdateStatus,
    
    // 레퍼런스
    chartRef,
    candleSeriesRef,
    volumeSeriesRef,
    sixtyEMASeriesRef,
    oneTwentyEMASeriesRef,
    twoFortyEMASeriesRef,
    threeHundredSixtyEMASeriesRef,
    sixHundredEMASeriesRef,
    nineHundredEMASeriesRef,
    markerPluginRef,
    ongoingRequestRef,
    timeoutRef,
    
    // 함수
    setIsFullscreen,
    setChartHeight,
    setChartPrice,
    setProgress,
    setAllData,
    setMarkers,
    setBacktestResult,
    setIsAutoUpdate,
    setIsRealtimeAPIEnabled,
    setLastSymbol,
    setDateRange,
    setShowMA,
    setRealtimeUpdateStatus,
    switchToRealtimeAfterUpdate,
    loadData,
    handleChartReady,
    toggleFullscreen,
    updateShowMA,
    handleHeightChange,
    handleAutoUpdateToggle,
    handleRealtimeAPIToggle,
    updateRealtimeData
  };
}; 