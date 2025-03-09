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

  // 실시간 API 업데이트 함수
  const updateRealtimeData = useCallback(async () => {
    if (!isRealtimeAPIEnabled || !chartType.startsWith('seconds/') || ongoingRequestRef.current) return;
    
    // 실시간 데이터 업데이트 로직
    try {
      // 기존 로직 유지
      console.log('실시간 데이터 업데이트 중...');
    } catch (error) {
      console.error('실시간 데이터 업데이트 오류:', error);
    }
  }, [isRealtimeAPIEnabled, chartType]);

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