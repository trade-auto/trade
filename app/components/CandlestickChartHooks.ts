import { useCallback, useState, useRef, useEffect } from 'react';
import { IChartApi, ISeriesApi, Time } from 'lightweight-charts';
import { ExtendedCandlestickData, DateRange, MASettings, SeriesMarker } from './CandlestickChartTypes';
import { getInitialDateRange, calculateEMA, getChartEndpoint, createTradeMarkers, calculateBacktestResult } from './CandlestickChartUtils';
import useUpbitStore from '../store/useUpbitStore';
import { UpbitCandle } from '../types/candlestick';

export const useChartData = (
  symbol: string,
  chartType: string,
  initialAutoUpdate: boolean,
  mode?: 'live' | 'test'
) => {
  // 차트 상태
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [chartHeight, setChartHeight] = useState(500);
  const [chartPrice, setChartPrice] = useState(0);
  const [progress, setProgress] = useState(0);
  const [allData, setAllData] = useState<ExtendedCandlestickData[]>([]);
  const [markers, setMarkers] = useState<SeriesMarker<Time>[]>([]);
  const [backtestResult, setBacktestResult] = useState<any | null>(null);
  
  // 자동 업데이트 및 실시간 API 상태
  const [isAutoUpdate, setIsAutoUpdate] = useState<boolean>(initialAutoUpdate);
  const [isRealtimeAPIEnabled, setIsRealtimeAPIEnabled] = useState<boolean>(false);
  const [lastSymbol, setLastSymbol] = useState<string>(symbol);
  
  // 설정 상태
  const [dateRange, setDateRange] = useState<DateRange>(getInitialDateRange(chartType));
  const [showMA, setShowMA] = useState<MASettings>({
    sixty: true,
    oneTwenty: true,
    twoForty: true,
    threeHundredSixty: true,
    threeHundred: true,
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
  const threeHundredEMASeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
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
  }>({
    isUpdating: false,
    lastUpdateTime: null,
    updateCount: 0
  });

  // 실시간 API 업데이트로 전환하는 함수
  const switchToRealtimeAfterUpdate = useCallback(() => {
    // 자동 업데이트 중지
    setIsAutoUpdate(false);
    // 잠시 후 실시간 API 활성화
    setTimeout(() => {
      setIsRealtimeAPIEnabled(true);
    }, 500);
  }, []);

  // 데이터 로드 함수
  const loadData = useCallback(async () => {
    if (ongoingRequestRef.current) return;
    
    ongoingRequestRef.current = true;
    
    try {
      const endpoint = getChartEndpoint(chartType);
      const allProcessedData: ExtendedCandlestickData[] = [];
      let currentTo = dateRange.endDate ? dateRange.endDate : new Date();
      const startDate = dateRange.startDate;
      
      // 필요한 데이터 개수 계산
      const totalDays = Math.ceil((currentTo.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
      const estimatedCandles = chartType.startsWith('minutes/') ? totalDays * 24 * 60 / parseInt(chartType.split('/')[1]) :
                             chartType === 'days' ? totalDays :
                             chartType === 'weeks' ? Math.ceil(totalDays / 7) :
                             Math.ceil(totalDays / 30);
      
      const batchSize = 200;
      const expectedBatches = Math.ceil(estimatedCandles / batchSize);
      let currentBatch = 0;
      
      // 시작 날짜에 도달할 때까지 반복해서 데이터 가져오기
      while (true) {
        const to = currentTo.toISOString();
        
        // 진행률 업데이트
        currentBatch++;
        setProgress(Math.min(30, (currentBatch / expectedBatches) * 30));
        
        const response = await fetch(
          `https://api.upbit.com/v1/candles/${endpoint}?market=${symbol}&to=${to}&count=${batchSize}`
        );
        
        if (!response.ok) {
          throw new Error('데이터 로딩 실패');
        }
        
        const data: UpbitCandle[] = await response.json();
        
        if (!data || data.length === 0) break;
        
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
        
        // 마지막 캔들의 시간으로 다음 요청의 기준 시간 설정
        const lastCandle = data[data.length - 1];
        currentTo = new Date(lastCandle.candle_date_time_kst);
        
        // 시작 날짜에 도달했거나 지났으면 중단
        if (currentTo <= startDate) break;
        
        // API 호출 제한을 위한 딜레이
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      // 한 번만 정렬
      allProcessedData.sort((a, b) => {
        if (typeof a.time === 'number' && typeof b.time === 'number') {
          return a.time - b.time;
        }
        return 0;
      });
      
      setProgress(50);
      
      // 차트 업데이트를 위한 데이터 준비
      if (candleSeriesRef.current && volumeSeriesRef.current) {
        // 캔들 데이터 설정
        candleSeriesRef.current.setData(allProcessedData);
        
        // 볼륨 데이터 설정
        const volumeData = allProcessedData.map((d) => ({
          time: d.time,
          value: d.volume,
          color: d.close >= d.open ? '#26a69a' : '#ef5350',
        }));
        volumeSeriesRef.current.setData(volumeData);
        
        setProgress(70);
        
        // EMA 계산 및 설정 - 병렬 처리
        const [ema60Data, ema120Data, ema240Data, ema360Data, ema300Data, ema900Data] = await Promise.all([
          Promise.resolve(calculateEMA(allProcessedData, 60)),
          Promise.resolve(calculateEMA(allProcessedData, 120)),
          Promise.resolve(calculateEMA(allProcessedData, 240)),
          Promise.resolve(calculateEMA(allProcessedData, 360)),
          Promise.resolve(calculateEMA(allProcessedData, 300)),
          Promise.resolve(calculateEMA(allProcessedData, 900))
        ]);
        
        if (
          sixtyEMASeriesRef.current && 
          oneTwentyEMASeriesRef.current && 
          twoFortyEMASeriesRef.current && 
          threeHundredSixtyEMASeriesRef.current &&
          threeHundredEMASeriesRef.current &&
          nineHundredEMASeriesRef.current
        ) {
          // EMA 데이터 설정
          sixtyEMASeriesRef.current.setData(ema60Data);
          oneTwentyEMASeriesRef.current.setData(ema120Data);
          twoFortyEMASeriesRef.current.setData(ema240Data);
          threeHundredSixtyEMASeriesRef.current.setData(ema360Data);
          threeHundredEMASeriesRef.current.setData(ema300Data);
          nineHundredEMASeriesRef.current.setData(ema900Data);
          
          // 시리즈 가시성 설정
          sixtyEMASeriesRef.current.applyOptions({ visible: showMA.sixty });
          oneTwentyEMASeriesRef.current.applyOptions({ visible: showMA.oneTwenty });
          twoFortyEMASeriesRef.current.applyOptions({ visible: showMA.twoForty });
          threeHundredSixtyEMASeriesRef.current.applyOptions({ visible: showMA.threeHundredSixty });
          threeHundredEMASeriesRef.current.applyOptions({ visible: showMA.threeHundred });
          nineHundredEMASeriesRef.current.applyOptions({ visible: showMA.nineHundred });
        }
        
        setProgress(85);
        
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
        const strategyMarkers = createTradeMarkers(signals);  
        // 매수/매도 포인트 계산
        setMarkers(strategyMarkers);
        
        // 백테스트 결과 계산
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
      }
      
      // 모든 데이터 저장
      setAllData(allProcessedData);
      
      // 전체 데이터 로드 후 실시간 API로 전환 (자동 업데이트 모드일 경우)
      if (isAutoUpdate && chartType === 'seconds/60') {
        // 자동 업데이트에서 실시간 업데이트로 전환
        switchToRealtimeAfterUpdate();
      }
      
    } catch (error) {
      console.error('데이터 로드 오류:', error);
    } finally {
      setProgress(100);
      ongoingRequestRef.current = false;
    }
  }, [dateRange, symbol, chartType, showMA, isAutoUpdate, switchToRealtimeAfterUpdate, mode]);

  // 차트 초기화 콜백
  const handleChartReady = useCallback((
    chartApi: IChartApi,
    candleSeries: ISeriesApi<"Candlestick">,
    volumeSeries: ISeriesApi<"Histogram">,
    sixtyEMASeries: ISeriesApi<"Line">,
    oneTwentyEMASeries: ISeriesApi<"Line">,
    twoFortyEMASeries: ISeriesApi<"Line">,
    threeHundredSixtyEMASeries: ISeriesApi<"Line">,
    threeHundredEMASeries: ISeriesApi<"Line">,
    nineHundredEMASeries: ISeriesApi<"Line">
  ) => {
    chartRef.current = chartApi;
    candleSeriesRef.current = candleSeries;
    volumeSeriesRef.current = volumeSeries;
    sixtyEMASeriesRef.current = sixtyEMASeries;
    oneTwentyEMASeriesRef.current = oneTwentyEMASeries;
    twoFortyEMASeriesRef.current = twoFortyEMASeries;
    threeHundredSixtyEMASeriesRef.current = threeHundredSixtyEMASeries;
    threeHundredEMASeriesRef.current = threeHundredEMASeries;
    nineHundredEMASeriesRef.current = nineHundredEMASeries;
    
    // 볼륨 시리즈 설정
    chartApi.priceScale('volume').applyOptions({
      scaleMargins: {
        top: 0.8,
        bottom: 0,
      },
      borderVisible: false,
    });
    
    // 차트 준비 후 데이터 로드
    loadData();
  }, [loadData]);

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
      threeHundredEMASeriesRef.current &&
      nineHundredEMASeriesRef.current
    ) {
      sixtyEMASeriesRef.current.applyOptions({ visible: newShowMA.sixty });
      oneTwentyEMASeriesRef.current.applyOptions({ visible: newShowMA.oneTwenty });
      twoFortyEMASeriesRef.current.applyOptions({ visible: newShowMA.twoForty });
      threeHundredSixtyEMASeriesRef.current.applyOptions({ visible: newShowMA.threeHundredSixty });
      threeHundredEMASeriesRef.current.applyOptions({ visible: newShowMA.threeHundred });
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
    if (data.length < 60) return; // 최소 60개 데이터 필요
    
    const startTime = Date.now();
    console.log('이동평균선 업데이트 시작');
    
    try {
      // 마지막 캔들 시간
      const lastTime = data[data.length - 1].time;
      
      // 이동평균선 계산 함수 (부드러운 이동평균 사용)
      const calculateSmoothMA = (period: number, seriesRef: React.MutableRefObject<ISeriesApi<"Line"> | null>) => {
        if (data.length < period) return null;
        
        // 성능 최적화: 단순 이동평균 계산 (슬라이스 최소화)
        let sum = 0;
        const startIdx = Math.max(0, data.length - period);
        for (let i = startIdx; i < data.length; i++) {
          sum += data[i].close;
        }
        const sma = sum / (data.length - startIdx);
        
        // 이전 값 가져오기
        let prevValue: number | null = null;
        if (seriesRef.current) {
          const seriesData = seriesRef.current.data() as { time: Time; value: number }[];
          prevValue = seriesData.length > 0 ? seriesData[seriesData.length - 1].value : null;
        }
        
        // 새 값 계산
        let newValue: number;
        
        if (prevValue === null) {
          // 이전 값이 없으면 SMA 사용
          newValue = sma;
        } else {
          // 이전 값이 있으면 부드러운 전환 적용
          
          // 1. 지수 이동평균 계산 (EMA)
          const alpha = 2 / (period + 1);
          const ema = (data[data.length - 1].close - prevValue) * alpha + prevValue;
          
          // 2. 변화율 제한 적용
          const changePercent = Math.abs((ema - prevValue) / prevValue * 100);
          
          // 각 이동평균선별 최대 변화율 설정
          let maxChangePercent: number;
          if (period <= 60) {
            maxChangePercent = 0.3; // 60MA는 최대 0.3% 변화
          } else if (period <= 120) {
            maxChangePercent = 0.25; // 120MA는 최대 0.25% 변화
          } else if (period <= 240) {
            maxChangePercent = 0.2; // 240MA는 최대 0.2% 변화
          } else if (period <= 360) {
            maxChangePercent = 0.15; // 360MA는 최대 0.15% 변화
          } else {
            maxChangePercent = 0.1; // 900MA는 최대 0.1% 변화
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
      
      // 각 이동평균선 계산
      const ma60 = calculateSmoothMA(60, sixtyEMASeriesRef);
      const ma120 = calculateSmoothMA(120, oneTwentyEMASeriesRef);
      const ma240 = calculateSmoothMA(240, twoFortyEMASeriesRef);
      const ma360 = calculateSmoothMA(360, threeHundredSixtyEMASeriesRef);
      const ma300 = calculateSmoothMA(300, threeHundredEMASeriesRef);
      const ma900 = calculateSmoothMA(900, nineHundredEMASeriesRef);
      
      // 이동평균선 차트 업데이트
      if (ma60 && sixtyEMASeriesRef.current) {
        sixtyEMASeriesRef.current.update(ma60);
      }
      
      if (ma120 && oneTwentyEMASeriesRef.current) {
        oneTwentyEMASeriesRef.current.update(ma120);
      }
      
      if (ma240 && twoFortyEMASeriesRef.current) {
        twoFortyEMASeriesRef.current.update(ma240);
      }
      
      if (ma360 && threeHundredSixtyEMASeriesRef.current) {
        threeHundredSixtyEMASeriesRef.current.update(ma360);
      }
      
      if (ma300 && threeHundredEMASeriesRef.current) {
        threeHundredEMASeriesRef.current.update(ma300);
      }
      
      if (ma900 && nineHundredEMASeriesRef.current) {
        nineHundredEMASeriesRef.current.update(ma900);
      }
      
      // 매수 조건 체크 및 로그 출력 (성능 최적화: 3초마다 한 번씩만 수행)
      if (ma60 && ma120 && ma240 && ma900 && Date.now() % 3000 < 1000) {
        // 조건 1: MA240 상향 5봉 이상 체크
        let ma240UpCount = 0;
        
        // 이전 MA240 값들 가져오기
        const ma240Values: number[] = [];
        if (twoFortyEMASeriesRef.current) {
          const seriesData = twoFortyEMASeriesRef.current.data() as { time: Time; value: number }[];
          // 최근 6개 값 가져오기 (현재 값 포함)
          for (let i = Math.max(0, seriesData.length - 6); i < seriesData.length; i++) {
            ma240Values.push(seriesData[i].value);
          }
        }
        
        // 현재 값 추가
        ma240Values.push(ma240.value);
        
        // 상승 추세 확인
        for (let i = 1; i < ma240Values.length; i++) {
          if (ma240Values[i] > ma240Values[i-1]) {
            ma240UpCount++;
          } else {
            break;
          }
        }
        
        // 조건 2: MA60 > MA120
        const isAbove120 = ma60.value > ma120.value;
        
        // 조건 3: MA60 > MA240
        const isAbove240 = ma60.value > ma240.value;
        
        // 조건 4: MA900 상승세
        let isMA900Upward = false;
        if (nineHundredEMASeriesRef.current) {
          const seriesData = nineHundredEMASeriesRef.current.data() as { time: Time; value: number }[];
          if (seriesData.length > 1) {
            const prevMA900 = seriesData[seriesData.length - 1].value;
            isMA900Upward = ma900.value > prevMA900;
          }
        }
        
        // 조건 5: MA60 < MA900
        const isBelow900 = ma60.value < ma900.value;
        
        // 모든 조건 로그 출력
        console.log('\n=== 매수 조건 체크 ===');
        console.log({
          '조건 1 (MA240 상향 5봉 이상)': `${ma240UpCount}/5 ${ma240UpCount >= 5 ? '✅' : '❌'}`,
          '조건 2 (MA60 > MA120)': `${ma60.value.toFixed(0)} > ${ma120.value.toFixed(0)} ${isAbove120 ? '✅' : '❌'}`,
          '조건 3 (MA60 > MA240)': `${ma60.value.toFixed(0)} > ${ma240.value.toFixed(0)} ${isAbove240 ? '✅' : '❌'}`,
          '조건 4 (MA900 상승세)': `${isMA900Upward ? '✅' : '❌'}`,
          '조건 5 (MA60 < MA900)': `${ma60.value.toFixed(0)} < ${ma900.value.toFixed(0)} ${isBelow900 ? '✅' : '❌'}`,
          '최종 판정': (ma240UpCount >= 5 && isAbove120 && isAbove240 && isMA900Upward && isBelow900) ? 
            '✅ 매수 신호 발생!' : '❌ 매수 조건 불충족'
        });
        
        // 현재 가격과 주요 이동평균선 값 출력
        const currentPrice = data[data.length - 1].close;
        console.log('\n=== 현재 가격 및 이동평균선 ===');
        console.log({
          '현재 가격': currentPrice.toLocaleString('ko-KR'),
          'MA60': ma60.value.toLocaleString('ko-KR'),
          'MA120': ma120.value.toLocaleString('ko-KR'),
          'MA240': ma240.value.toLocaleString('ko-KR'),
          'MA900': ma900.value.toLocaleString('ko-KR')
        });
      }
      
      const endTime = Date.now();
      console.log(`이동평균선 업데이트 완료: ${endTime - startTime}ms 소요`);
    } catch (error) {
      console.error('이동평균선 업데이트 오류:', error);
    }
  }, []);

  // 실시간 API 업데이트 함수
  const updateRealtimeData = useCallback(async () => {
    // 이미 업데이트 중이면 중복 요청 방지 (단, 3초 이상 걸리면 강제로 새로운 요청 허용)
    if (!isRealtimeAPIEnabled || !chartType.startsWith('seconds/')) return;
    
    const now = Date.now();
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
      const endpoint = getChartEndpoint(chartType);
      
      // API 호출 시작 시간 기록
      const apiStartTime = Date.now();
      
      const response = await fetch(
        `https://api.upbit.com/v1/candles/${endpoint}?market=${symbol}&to=${to}&count=2`
      );
      
      // API 호출 소요 시간 계산
      const apiTime = Date.now() - apiStartTime;
      console.log(`API 호출 소요 시간: ${apiTime}ms`);
      
      if (!response.ok) {
        throw new Error('실시간 데이터 로딩 실패');
      }
      
      const data: UpbitCandle[] = await response.json();
      
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
              
              const strategyMarkers = createTradeMarkers(signals);
              setMarkers(strategyMarkers);
              console.log(`마커 업데이트 완료: ${strategyMarkers.length}개 (매수: ${signals.filter((s: any) => s.position === 'buy').length}개, 매도: ${signals.filter((s: any) => s.position === 'sell').length}개)`);
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
              
              const strategyMarkers = createTradeMarkers(signals);
              setMarkers(strategyMarkers);
              console.log(`마커 업데이트 완료: ${strategyMarkers.length}개 (매수: ${signals.filter((s: any) => s.position === 'buy').length}개, 매도: ${signals.filter((s: any) => s.position === 'sell').length}개)`);
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
          updateCount: prev.updateCount + 1
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
      // 1초마다 업데이트 (매매 상태를 더 자주 체크하기 위해)
      const timer = setInterval(() => {
        updateRealtimeData();
      }, 1000);
      
      timeoutRef.current = timer;
      
      console.log('실시간 업데이트 타이머 설정: 1초 간격');
      
      return () => {
        if (timeoutRef.current) {
          clearInterval(timeoutRef.current);
          timeoutRef.current = null;
          console.log('실시간 업데이트 타이머 해제');
        }
      };
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
      
      const response = await fetch(
        `https://api.upbit.com/v1/candles/${endpoint}?market=${symbol}&to=${to}&count=200`
      );
      
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
      
      // 차트 업데이트
      if (candleSeriesRef.current) {
        candleSeriesRef.current.setData(processedData);
      }
      
      // 볼륨 업데이트
      if (volumeSeriesRef.current) {
        const volumeData = processedData.map((d) => ({
          time: d.time,
          value: d.volume,
          color: d.close >= d.open ? '#26a69a' : '#ef5350',
        }));
        volumeSeriesRef.current.setData(volumeData);
      }
      
      // 이동평균선 업데이트
      updateMovingAverages(processedData);
      
      // 전략 분석 실행 및 마커 업데이트
      if (processedData.length > 900) {
        console.log('자동 업데이트: 전략 분석 실행 및 마커 업데이트...');
        const analysisResult = useUpbitStore.getState().analyzeRealtimeData(processedData);
        
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
          
          const strategyMarkers = createTradeMarkers(signals);
          setMarkers(strategyMarkers);
          console.log(`자동 업데이트: 마커 업데이트 완료: ${strategyMarkers.length}개 (매수: ${signals.filter((s: any) => s.position === 'buy').length}개, 매도: ${signals.filter((s: any) => s.position === 'sell').length}개)`);
        }
      }
      
      // 현재 가격 업데이트
      if (processedData.length > 0) {
        setChartPrice(processedData[processedData.length - 1].close);
      }
      
      // 데이터 저장
      setAllData(processedData);
      
      console.log('자동 업데이트 완료');
    } catch (error) {
      console.error('자동 업데이트 오류:', error);
    } finally {
      ongoingRequestRef.current = false;
    }
  }, [isAutoUpdate, isRealtimeAPIEnabled, chartType, symbol, updateMovingAverages]);
  
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
    threeHundredEMASeriesRef,
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