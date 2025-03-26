import { useCallback, useState, useRef, useEffect } from 'react';
import { IChartApi, ISeriesApi, Time, SeriesMarker } from 'lightweight-charts';
import { ExtendedCandlestickData, DateRange, MASettings } from './CandlestickChartTypes';
import { getInitialDateRange, calculateEMA, getChartEndpoint, createTradeMarkers, calculateBacktestResult } from './CandlestickChartUtils';
import useUpbitStore from '../store/useUpbitStore';
import { UpbitCandle } from '../types/candlestick';
import { TradeStrategy, TradeSignal } from '../strategies/types';

// Time 타입을 timestamp로 변환하는 헬퍼 함수
const getTimeAsTimestamp = (time: Time): number => {
  if (typeof time === 'number') {
    return time;
  } else if (typeof time === 'string') {
    return new Date(time).getTime() / 1000;
  } else {
    // BusinessDay 타입 처리 (year, month, day 속성을 가진 객체)
    const bd = time as any;
    return new Date(bd.year, bd.month - 1, bd.day).getTime() / 1000;
  }
};

// 초기 이동평균선 설정을 로드하는 함수
const loadInitialMASettings = (): MASettings => {
  // 로컬 스토리지에서 설정 불러오기
  if (typeof window !== 'undefined') {
    try {
      const savedSettings = localStorage.getItem('maSettings');
      if (savedSettings) {
        return JSON.parse(savedSettings);
      }
    } catch (error) {
      console.error('이동평균선 설정 로드 실패:', error);
    }
  }
  
  // 기본 설정값
  const defaultSettings: MASettings = {
    five: false,
    ten: false,
    twenty: false,
    thirty: false,
    fortyEight: false,
    sixty: false,
    ninety: false,
    oneTwenty: false,
    twoForty: false,
    threeHundredSixty: false,
    sixHundred: false,
    nineHundred: false,
  };
  return defaultSettings;
};

export const useChartData = (
  symbol: string,
  chartType: string,
  initialAutoUpdate: boolean,
  mode?: 'live' | 'test',
  initialDataCount: number = 200 // 기본값 200으로 설정
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
  const [isAutoUpdate, setIsAutoUpdate] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('chartAutoUpdate');
        return saved !== null ? JSON.parse(saved) : initialAutoUpdate;
      } catch (error) {
        console.error('자동 업데이트 설정 로드 실패:', error);
      }
    }
    return initialAutoUpdate;
  });
  
  const [isRealtimeAPIEnabled, setIsRealtimeAPIEnabled] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('chartRealtimeUpdate');
        return saved !== null ? JSON.parse(saved) : false;
      } catch (error) {
        console.error('실시간 업데이트 설정 로드 실패:', error);
      }
    }
    return false;
  });
  const [lastSymbol, setLastSymbol] = useState<string>(symbol);
  const [currentStrategy, setCurrentStrategy] = useState<TradeStrategy>(useUpbitStore.getState().tradeStrategy);
  
  // 설정 상태
  const [dateRange, setDateRange] = useState<DateRange>(getInitialDateRange(chartType));
  const [showMA, setShowMA] = useState<MASettings>(loadInitialMASettings());
  
  // 차트 레퍼런스
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<"Histogram"> | null>(null);
  const fiveEMASeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const tenEMASeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const twentyEMASeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const thirtyEMASeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const fortyEightEMASeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const sixtyEMASeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const ninetyEMASeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
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
    
    // 차트 시리즈 초기화
    if (candleSeriesRef.current) {
      candleSeriesRef.current.setData([]);
    }
    if (volumeSeriesRef.current) {
      volumeSeriesRef.current.setData([]);
    }
    if (fiveEMASeriesRef.current) {
      fiveEMASeriesRef.current.setData([]);
    }
    if (tenEMASeriesRef.current) {
      tenEMASeriesRef.current.setData([]);
    }
    if (twentyEMASeriesRef.current) {
      twentyEMASeriesRef.current.setData([]);
    }
    if (thirtyEMASeriesRef.current) {
      thirtyEMASeriesRef.current.setData([]);
    }
    if (fortyEightEMASeriesRef.current) {
      fortyEightEMASeriesRef.current.setData([]);
    }
    if (sixtyEMASeriesRef.current) {
      sixtyEMASeriesRef.current.setData([]);
    }
    if (ninetyEMASeriesRef.current) {
      ninetyEMASeriesRef.current.setData([]);
    }
    if (oneTwentyEMASeriesRef.current) {
      oneTwentyEMASeriesRef.current.setData([]);
    }
    if (twoFortyEMASeriesRef.current) {
      twoFortyEMASeriesRef.current.setData([]);
    }
    if (threeHundredSixtyEMASeriesRef.current) {
      threeHundredSixtyEMASeriesRef.current.setData([]);
    }
    if (sixHundredEMASeriesRef.current) {
      sixHundredEMASeriesRef.current.setData([]);
    }
    if (nineHundredEMASeriesRef.current) {
      nineHundredEMASeriesRef.current.setData([]);
    }
    
    // 백테스트 결과 초기화
    setBacktestResult(null);
    
    // 실시간 업데이트 상태 초기화
    setRealtimeUpdateStatus({
      isUpdating: false,
      lastUpdateTime: null,
      updateCount: 0,
      markers: []
    });
    
    console.log(`차트 타입 변경으로 모든 데이터와 상태 초기화 완료. 새로운 타입(${chartType})의 데이터를 로드합니다.`);
    
    // 새로운 날짜 범위 설정
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
      let targetCandles = initialDataCount; // 전달받은 initialDataCount 사용
      if (chartType.startsWith('minutes/')) {
        const minutesInterval = parseInt(chartType.split('/')[1]);
        if (minutesInterval === 5) {
          targetCandles = Math.max(576, initialDataCount); // 5분봉 최소 576개 또는 initialDataCount
        } else if (minutesInterval === 15) {
          targetCandles = Math.max(672, initialDataCount); // 15분봉 최소 672개 또는 initialDataCount
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
          apiUrl = `/api/candles/seconds?market=${symbol}&count=200`; // 전체 데이터 로드
          console.log(`초봉 데이터 로드 API 요청: ${apiUrl} (내부 API 사용)`);
        } else if (chartType.startsWith('minutes/')) {
          // 분봉 차트는 기존대로 업비트 API 직접 호출
          const minUnit = chartType.split('/')[1]; // 5 또는 15 추출
          apiUrl = `https://api.upbit.com/v1/candles/minutes/${minUnit}?market=${symbol}&to=${to}&count=200`; // 전체 데이터 로드
          console.log(`분봉 데이터 로드 API 요청: ${apiUrl}`);
        } else {
          apiUrl = `https://api.upbit.com/v1/candles/${endpoint}?market=${symbol}&to=${to}&count=200`;
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
      const sortedAllData = [...allProcessedData].sort((a, b) => {
        return getTimeAsTimestamp(a.time) - getTimeAsTimestamp(b.time);
      });
      
      console.log(`총 ${sortedAllData.length}개 캔들 데이터 처리 완료`);
      setProgress(50);
      
      // 모든 데이터 저장
      setAllData(sortedAllData);
      
      // 이동평균선 업데이트
      updateMovingAverages(sortedAllData);
      setProgress(100);
      
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
        console.log('- 데이터 개수:', sortedAllData.length);
        
        // 데이터가 충분한지 확인 (최소 100개 이상)
        if (sortedAllData.length >= 100) {
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
    fiveEMASeries: ISeriesApi<"Line">,
    tenEMASeries: ISeriesApi<"Line">,
    twentyEMASeries: ISeriesApi<"Line">,
    thirtyEMASeries: ISeriesApi<"Line">,
    fortyEightEMASeries: ISeriesApi<"Line">,
    sixtyEMASeries: ISeriesApi<"Line">,
    ninetyEMASeries: ISeriesApi<"Line">,
    oneTwentyEMASeries: ISeriesApi<"Line">,
    twoFortyEMASeries: ISeriesApi<"Line">,
    threeHundredSixtyEMASeries: ISeriesApi<"Line">,
    sixHundredEMASeries: ISeriesApi<"Line">,
    nineHundredEMASeries: ISeriesApi<"Line">
  ) => {
    chartRef.current = chartApi;
    candleSeriesRef.current = candleSeries;
    volumeSeriesRef.current = volumeSeries;
    fiveEMASeriesRef.current = fiveEMASeries;
    tenEMASeriesRef.current = tenEMASeries;
    twentyEMASeriesRef.current = twentyEMASeries;
    thirtyEMASeriesRef.current = thirtyEMASeries;
    fortyEightEMASeriesRef.current = fortyEightEMASeries;
    sixtyEMASeriesRef.current = sixtyEMASeries;
    ninetyEMASeriesRef.current = ninetyEMASeries;
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
    
    // 로컬 스토리지에 설정 저장
    try {
      localStorage.setItem('maSettings', JSON.stringify(newShowMA));
    } catch (error) {
      console.error('이동평균선 설정 저장 실패:', error);
    }
    
    if (
      fiveEMASeriesRef.current && 
      tenEMASeriesRef.current && 
      twentyEMASeriesRef.current && 
      thirtyEMASeriesRef.current &&
      fortyEightEMASeriesRef.current &&
      sixtyEMASeriesRef.current && 
      ninetyEMASeriesRef.current && 
      oneTwentyEMASeriesRef.current && 
      twoFortyEMASeriesRef.current && 
      threeHundredSixtyEMASeriesRef.current &&
      sixHundredEMASeriesRef.current &&
      nineHundredEMASeriesRef.current
    ) {
      fiveEMASeriesRef.current.applyOptions({ visible: newShowMA.five });
      tenEMASeriesRef.current.applyOptions({ visible: newShowMA.ten });
      twentyEMASeriesRef.current.applyOptions({ visible: newShowMA.twenty });
      thirtyEMASeriesRef.current.applyOptions({ visible: newShowMA.thirty });
      fortyEightEMASeriesRef.current.applyOptions({ visible: newShowMA.fortyEight });
      sixtyEMASeriesRef.current.applyOptions({ visible: newShowMA.sixty });
      ninetyEMASeriesRef.current.applyOptions({ visible: newShowMA.ninety });
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
      const ma5 = calculateSmoothMA(5, fiveEMASeriesRef);
      const ma10 = calculateSmoothMA(10, tenEMASeriesRef);
      const ma20 = calculateSmoothMA(20, twentyEMASeriesRef);
      const ma30 = calculateSmoothMA(30, thirtyEMASeriesRef);
      const ma48 = calculateSmoothMA(48, fortyEightEMASeriesRef);
      const ma60 = calculateSmoothMA(60, sixtyEMASeriesRef);
      const ma90 = calculateSmoothMA(90, ninetyEMASeriesRef);
      const ma120 = calculateSmoothMA(120, oneTwentyEMASeriesRef);
      const ma240 = calculateSmoothMA(240, twoFortyEMASeriesRef);
      
      // 장기 이평선 (데이터가 충분할 때)
      const ma360 = data.length >= 360 ? calculateSmoothMA(360, threeHundredSixtyEMASeriesRef) : null;
      const ma600 = data.length >= 600 ? calculateSmoothMA(600, sixHundredEMASeriesRef) : null;
      const ma900 = data.length >= 900 ? calculateSmoothMA(900, nineHundredEMASeriesRef) : null;
      
      // 이동평균선 차트 업데이트 - 모든 MA 상태 로깅
      console.log('이동평균선 업데이트 상태:');
      
      if (ma5 && fiveEMASeriesRef.current) {
        fiveEMASeriesRef.current.update(ma5);
        fiveEMASeriesRef.current.applyOptions({ visible: showMA.five });
        console.log('- 5MA 업데이트:', ma5.value.toFixed(2), showMA.five ? '(표시)' : '(숨김)');
      } else {
        console.log('- 5MA 업데이트 실패:', ma5 ? '시리즈 참조 없음' : '계산 결과 없음');
      }
      
      if (ma10 && tenEMASeriesRef.current) {
        tenEMASeriesRef.current.update(ma10);
        tenEMASeriesRef.current.applyOptions({ visible: showMA.ten });
        console.log('- 10MA 업데이트:', ma10.value.toFixed(2), showMA.ten ? '(표시)' : '(숨김)');
      } else {
        console.log('- 10MA 업데이트 실패:', ma10 ? '시리즈 참조 없음' : '계산 결과 없음');
      }
      
      if (ma20 && twentyEMASeriesRef.current) {
        twentyEMASeriesRef.current.update(ma20);
        twentyEMASeriesRef.current.applyOptions({ visible: showMA.twenty });
        console.log('- 20MA 업데이트:', ma20.value.toFixed(2), showMA.twenty ? '(표시)' : '(숨김)');
        
        // 20MA 현재 데이터 확인
        const currentData = twentyEMASeriesRef.current.data() as { time: Time; value: number }[];
        console.log(`- 20MA 현재 데이터 개수: ${currentData.length}개, 시리즈 표시 상태: ${showMA.twenty ? '표시' : '숨김'}`);
      } else {
        console.log('- 20MA 업데이트 실패:', ma20 ? '시리즈 참조 없음' : '계산 결과 없음');
      }
      
      if (ma30 && thirtyEMASeriesRef.current) {
        thirtyEMASeriesRef.current.update(ma30);
        thirtyEMASeriesRef.current.applyOptions({ visible: showMA.thirty });
        console.log('- 30MA 업데이트:', ma30.value.toFixed(2), showMA.thirty ? '(표시)' : '(숨김)');
        
        // 30MA 현재 데이터 확인
        const currentData = thirtyEMASeriesRef.current.data() as { time: Time; value: number }[];
        console.log(`- 30MA 현재 데이터 개수: ${currentData.length}개, 시리즈 표시 상태: ${showMA.thirty ? '표시' : '숨김'}`);
      } else {
        console.log('- 30MA 업데이트 실패:', ma30 ? '시리즈 참조 없음' : '계산 결과 없음');
      }
      
      if (ma48 && fortyEightEMASeriesRef.current) {
        fortyEightEMASeriesRef.current.update(ma48);
        fortyEightEMASeriesRef.current.applyOptions({ visible: showMA.fortyEight });
        console.log('- 48MA 업데이트:', ma48.value.toFixed(2), showMA.fortyEight ? '(표시)' : '(숨김)');
        
        // 48MA 현재 데이터 확인
        const currentData = fortyEightEMASeriesRef.current.data() as { time: Time; value: number }[];
        console.log(`- 48MA 현재 데이터 개수: ${currentData.length}개, 시리즈 표시 상태: ${showMA.fortyEight ? '표시' : '숨김'}`);
      } else {
        console.log('- 48MA 업데이트 실패:', ma48 ? '시리즈 참조 없음' : '계산 결과 없음');
      }
      
      if (ma60 && sixtyEMASeriesRef.current) {
        sixtyEMASeriesRef.current.update(ma60);
        sixtyEMASeriesRef.current.applyOptions({ visible: showMA.sixty });
        console.log('- 60MA 업데이트:', ma60.value.toFixed(2), showMA.sixty ? '(표시)' : '(숨김)');
      } else {
        console.log('- 60MA 업데이트 실패:', ma60 ? '시리즈 참조 없음' : '계산 결과 없음');
      }
      
      if (ma90 && ninetyEMASeriesRef.current) {
        ninetyEMASeriesRef.current.update(ma90);
        ninetyEMASeriesRef.current.applyOptions({ visible: showMA.ninety });
        console.log('- 90MA 업데이트:', ma90.value.toFixed(2), showMA.ninety ? '(표시)' : '(숨김)');
      } else if (data.length >= 90) {
        console.log('- 90MA 업데이트 실패:', ma90 ? '시리즈 참조 없음' : '계산 결과 없음');
          } else {
        console.log('- 90MA 업데이트 건너뜀: 데이터 부족 (필요: 90, 현재:', data.length, ')');
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
      console.error('이동평균선 업데이트 중 오류 발생:', error);
    }
  }, [showMA]);

  // 자동 업데이트 토글
  const handleAutoUpdateToggle = useCallback(() => {
    setIsAutoUpdate(prev => {
      const newValue = !prev;
      // localStorage에 설정 저장
      try {
        localStorage.setItem('chartAutoUpdate', JSON.stringify(newValue));
      } catch (error) {
        console.error('자동 업데이트 설정 저장 실패:', error);
      }
      return newValue;
    });
  }, []);

  // 실시간 API 토글
  const handleRealtimeAPIToggle = useCallback(() => {
    setIsRealtimeAPIEnabled(prev => {
      const newValue = !prev;
      // localStorage에 설정 저장
      try {
        localStorage.setItem('chartRealtimeUpdate', JSON.stringify(newValue));
      } catch (error) {
        console.error('실시간 업데이트 설정 저장 실패:', error);
      }
      return newValue;
    });
  }, []);

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
        apiUrl = `/api/candles/seconds?market=${symbol}&count=200`; // 전체 데이터 로드
        console.log(`초봉 데이터 로드 API 요청: ${apiUrl} (내부 API 사용)`);
      } else if (chartType.startsWith('minutes/')) {
        // 분봉 차트는 기존대로 업비트 API 직접 호출
        const minUnit = chartType.split('/')[1]; // 5 또는 15 추출
        apiUrl = `https://api.upbit.com/v1/candles/minutes/${minUnit}?market=${symbol}&to=${to}&count=200`; // 전체 데이터 로드
        console.log(`분봉 데이터 로드 API 요청: ${apiUrl}`);
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
        // 요청 완료 후 상태 업데이트
        setRealtimeUpdateStatus(prev => ({
          ...prev,
          isUpdating: false
        }));
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
          
          // 이동평균선 업데이트 (매 업데이트마다 수행)
          updateMovingAverages(updatedData);
          
          console.log('기존 캔들 업데이트:', newCandle);
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
      console.error('실시간 데이터 업데이트 중 오류 발생:', error);
    } finally {
      ongoingRequestRef.current = false;
    }
  }, [symbol, chartType, dateRange, isRealtimeAPIEnabled, isAutoUpdate, setAllData, setChartPrice, setProgress]);

  // 실시간 업데이트를 위한 useEffect
  useEffect(() => {
    if (!isRealtimeAPIEnabled || !chartType.startsWith('seconds/')) {
      return;
    }

    // 초봉 차트일 경우 1초마다 업데이트
    const intervalId = setInterval(() => {
      updateRealtimeData();
    }, 1000);

    return () => {
      clearInterval(intervalId);
    };
  }, [isRealtimeAPIEnabled, chartType, updateRealtimeData]);

  return {
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
    currentStrategy,
    dateRange,
    showMA,
    chartRef,
    candleSeriesRef,
    volumeSeriesRef,
    fiveEMASeriesRef,
    tenEMASeriesRef,
    twentyEMASeriesRef,
    thirtyEMASeriesRef,
    fortyEightEMASeriesRef,
    sixtyEMASeriesRef,
    ninetyEMASeriesRef,
    oneTwentyEMASeriesRef,
    twoFortyEMASeriesRef,
    threeHundredSixtyEMASeriesRef,
    sixHundredEMASeriesRef,
    nineHundredEMASeriesRef,
    markerPluginRef,
    ongoingRequestRef,
    timeoutRef,
    realtimeUpdateStatus,
    updateMarkers,
    switchToRealtimeAfterUpdate,
    loadData,
    handleChartReady,
    toggleFullscreen,
    updateShowMA,
    handleHeightChange,
    updateMovingAverages,
    handleAutoUpdateToggle,
    handleRealtimeAPIToggle,
    updateRealtimeData
  };
}; 