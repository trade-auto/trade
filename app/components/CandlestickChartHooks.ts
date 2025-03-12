import { useCallback, useState, useRef, useEffect } from 'react';
import { IChartApi, ISeriesApi, Time } from 'lightweight-charts';
import { ExtendedCandlestickData, DateRange, MASettings, SeriesMarker } from './CandlestickChartTypes';
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
        const [ema60Data, ema120Data, ema240Data, ema360Data, ema600Data, ema900Data] = await Promise.all([
          Promise.resolve(calculateEMA(allProcessedData, 60)),
          Promise.resolve(calculateEMA(allProcessedData, 120)),
          Promise.resolve(calculateEMA(allProcessedData, 240)),
          Promise.resolve(calculateEMA(allProcessedData, 360)),
          Promise.resolve(calculateEMA(allProcessedData, 600)),
          Promise.resolve(calculateEMA(allProcessedData, 900))
        ]);
        
        if (
          sixtyEMASeriesRef.current && 
          oneTwentyEMASeriesRef.current && 
          twoFortyEMASeriesRef.current && 
          threeHundredSixtyEMASeriesRef.current &&
          sixHundredEMASeriesRef.current &&
          nineHundredEMASeriesRef.current
        ) {
          // EMA 데이터 설정
          sixtyEMASeriesRef.current.setData(ema60Data);
          oneTwentyEMASeriesRef.current.setData(ema120Data);
          twoFortyEMASeriesRef.current.setData(ema240Data);
          threeHundredSixtyEMASeriesRef.current.setData(ema360Data);
          sixHundredEMASeriesRef.current.setData(ema600Data);
          nineHundredEMASeriesRef.current.setData(ema900Data);
          
          // 시리즈 가시성 설정
          sixtyEMASeriesRef.current.applyOptions({ visible: showMA.sixty });
          oneTwentyEMASeriesRef.current.applyOptions({ visible: showMA.oneTwenty });
          twoFortyEMASeriesRef.current.applyOptions({ visible: showMA.twoForty });
          threeHundredSixtyEMASeriesRef.current.applyOptions({ visible: showMA.threeHundredSixty });
          sixHundredEMASeriesRef.current.applyOptions({ visible: showMA.sixHundred });
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
        
        // 차트에 표시할 신호 수 제한 (최근 50개만 표시)
        const limitedSignals = signals.length > 50 ? signals.slice(-50) : signals;
        
        // 로그에 신호 수 출력
        console.log(`총 신호 수: ${signals.length}, 차트에 표시될 신호 수: ${limitedSignals.length}`);
        console.log(`매수 신호: ${(signals as any[]).filter(s => s.position === 'buy').length}, 매도 신호: ${(signals as any[]).filter(s => s.position === 'sell').length}`);
        
        const strategyMarkers = createTradeMarkers(limitedSignals);  
        // 매수/매도 포인트 계산
        setMarkers(strategyMarkers);
        
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
      const ma600 = calculateSmoothMA(600, sixHundredEMASeriesRef);
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
      
      if (ma600 && sixHundredEMASeriesRef.current) {
        sixHundredEMASeriesRef.current.update(ma600);
      }
      
      if (ma900 && nineHundredEMASeriesRef.current) {
        nineHundredEMASeriesRef.current.update(ma900);
      }
      
      // 매수 조건 체크 및 로그 출력 (성능 최적화: 3초마다 한 번씩만 수행)
      if (ma60 && ma120 && ma240 && ma600 && Date.now() % 3000 < 1000) {
        // 조건 1: MA240 상향 연속 봉 체크
        let ma240UpCount = 0;
        
        // 이전 MA240 값들 가져오기
        const ma240Values: number[] = [];
        if (twoFortyEMASeriesRef.current) {
          const seriesData = twoFortyEMASeriesRef.current.data() as { time: Time; value: number }[];
          // 최근 10개 값 가져오기 (현재 값 포함)
          for (let i = Math.max(0, seriesData.length - 10); i < seriesData.length; i++) {
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
        
        // 조건 2: MA60 > MA120 연속 봉 체크
        let ma60AboveMa120Count = 0;
        const ma60Values: number[] = [];
        const ma120Values: number[] = [];
        
        if (sixtyEMASeriesRef.current && oneTwentyEMASeriesRef.current) {
          const ma60Data = sixtyEMASeriesRef.current.data() as { time: Time; value: number }[];
          const ma120Data = oneTwentyEMASeriesRef.current.data() as { time: Time; value: number }[];
          
          // 최근 10개 값 가져오기
          for (let i = Math.max(0, ma60Data.length - 10); i < ma60Data.length; i++) {
            ma60Values.push(ma60Data[i].value);
          }
          
          for (let i = Math.max(0, ma120Data.length - 10); i < ma120Data.length; i++) {
            ma120Values.push(ma120Data[i].value);
          }
        }
        
        // 현재 값 추가
        ma60Values.push(ma60.value);
        ma120Values.push(ma120.value);
        
        // MA60 > MA120 연속 봉 체크
        const minLength = Math.min(ma60Values.length, ma120Values.length);
        for (let i = 0; i < minLength; i++) {
          if (ma60Values[ma60Values.length - 1 - i] > ma120Values[ma120Values.length - 1 - i]) {
            ma60AboveMa120Count++;
          } else {
            break;
          }
        }
        
        // 조건 3: MA60 > MA240 연속 봉 체크
        let ma60AboveMa240Count = 0;
        
        // MA60 > MA240 연속 봉 체크
        for (let i = 0; i < Math.min(ma60Values.length, ma240Values.length); i++) {
          if (ma60Values[ma60Values.length - 1 - i] > ma240Values[ma240Values.length - 1 - i]) {
            ma60AboveMa240Count++;
          } else {
            break;
          }
        }
        
        // 조건 4: MA600 상승세 연속 봉 체크
        let ma600UpCount = 0;
        const ma600Values: number[] = [];
        
        if (sixHundredEMASeriesRef.current) {
          const ma600Data = sixHundredEMASeriesRef.current.data() as { time: Time; value: number }[];
          
          // 최근 10개 값 가져오기
          for (let i = Math.max(0, ma600Data.length - 10); i < ma600Data.length; i++) {
            ma600Values.push(ma600Data[i].value);
          }
        }
        
        // 현재 값 추가
        ma600Values.push(ma600.value);
        
        // MA600 상승세 연속 봉 체크
        for (let i = 1; i < ma600Values.length; i++) {
          if (ma600Values[i] > ma600Values[i-1]) {
            ma600UpCount++;
          } else {
            break;
          }
        }
        
        // 조건 5: MA60 < MA600 연속 봉 체크
        let ma60BelowMa600Count = 0;
        
        // MA60 < MA600 연속 봉 체크
        for (let i = 0; i < Math.min(ma60Values.length, ma600Values.length); i++) {
          if (ma60Values[ma60Values.length - 1 - i] < ma600Values[ma600Values.length - 1 - i]) {
            ma60BelowMa600Count++;
          } else {
            break;
          }
        }
        
        // 각 조건의 최소 필요 봉 수 설정
        const minMa240UpCount = 5;
        const minMa60AboveMa120Count = 3;
        const minMa60AboveMa240Count = 3;
        const minMa600UpCount = 2;
        const minMa60BelowMa600Count = 3;
        
        // 각 조건 충족 여부
        const isMa240UpValid = ma240UpCount >= minMa240UpCount;
        const isMa60AboveMa120Valid = ma60AboveMa120Count >= minMa60AboveMa120Count;
        const isMa60AboveMa240Valid = ma60AboveMa240Count >= minMa60AboveMa240Count;
        const isMa600UpValid = ma600UpCount >= minMa600UpCount;
        const isMa60BelowMa600Valid = ma60BelowMa600Count >= minMa60BelowMa600Count;
        
        // 5번째 조건 사용 여부 체크
        const { useFifthCondition } = useUpbitStore.getState();
        const isFifthConditionValid = !useFifthCondition || isMa60BelowMa600Valid;
        
        // 모든 조건 로그 출력
        console.log('\n=== 매수 조건 체크 ===');
        console.log({
          '조건 1 (MA240 상향)': `${ma240UpCount}/${minMa240UpCount} 봉 ${isMa240UpValid ? '✅' : '❌'}`,
          '조건 2 (MA60 > MA120)': `${ma60AboveMa120Count}/${minMa60AboveMa120Count} 봉 ${isMa60AboveMa120Valid ? '✅' : '❌'}`,
          '조건 3 (MA60 > MA240)': `${ma60AboveMa240Count}/${minMa60AboveMa240Count} 봉 ${isMa60AboveMa240Valid ? '✅' : '❌'}`,
          '조건 4 (MA600 상승세)': `${ma600UpCount}/${minMa600UpCount} 봉 ${isMa600UpValid ? '✅' : '❌'}`,
          '조건 5 (MA60 < MA600)': `${ma60BelowMa600Count}/${minMa60BelowMa600Count} 봉 ${isMa60BelowMa600Valid ? '✅' : '❌'} ${!useFifthCondition ? '[비활성화됨]' : ''}`,
          '최종 판정': (isMa240UpValid && isMa60AboveMa120Valid && isMa60AboveMa240Valid && isMa600UpValid && isFifthConditionValid) ? 
            '✅ 매수 신호 발생!' : '❌ 매수 조건 불충족'
        });
        
        // 현재 가격과 주요 이동평균선 값 출력
        const currentPrice = data[data.length - 1].close;
        console.log('\n=== 현재 가격 및 이동평균선 ===');
        console.log({
          '현재 가격': currentPrice.toLocaleString('ko-KR'),
          'MA60': ma60?.value.toLocaleString('ko-KR'),
          'MA120': ma120?.value.toLocaleString('ko-KR'),
          'MA240': ma240?.value.toLocaleString('ko-KR'),
          'MA600': ma600?.value.toLocaleString('ko-KR')
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
              
              // 차트에 표시할 신호 수 제한 (최근 50개만 표시)
              const limitedSignals = signals.length > 50 ? signals.slice(-50) : signals;
              
              // 로그에 신호 수 출력
              console.log(`총 신호 수: ${signals.length}, 차트에 표시될 신호 수: ${limitedSignals.length}`);
              console.log(`매수 신호: ${(signals as any[]).filter(s => s.position === 'buy').length}, 매도 신호: ${(signals as any[]).filter(s => s.position === 'sell').length}`);
              
              const strategyMarkers = createTradeMarkers(limitedSignals);
              setMarkers(strategyMarkers);
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
              
              const strategyMarkers = createTradeMarkers(limitedSignals);
              setMarkers(strategyMarkers);
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
          
          const strategyMarkers = createTradeMarkers(limitedSignals);
          console.log(`자동 업데이트: 마커 ${strategyMarkers.length}개 생성 (매수: ${(signals as any[]).filter(s => s.position === 'buy').length}개, 매도: ${(signals as any[]).filter(s => s.position === 'sell').length}개)`);
          
          // 마커 업데이트
          setMarkers(strategyMarkers);
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
  }, [isAutoUpdate, isRealtimeAPIEnabled, chartType, symbol, allData, updateMovingAverages, setAllData, setMarkers, setChartPrice]);
  
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
      
      if (currentStrategy === 'BOLLINGER') {
        console.log('볼링거 전략은 최소 900개의 캔들이 필요합니다.');
        console.log('5번째 조건(MA60 < MA600) 상태:', useUpbitStore.getState().useFifthCondition ? '활성화' : '비활성화');
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
        
        const strategyMarkers = createTradeMarkers(limitedSignals);
        console.log(`전략 변경 후 마커 ${strategyMarkers.length}개 생성 (매수: ${(signals as any[]).filter(s => s.position === 'buy').length}개, 매도: ${(signals as any[]).filter(s => s.position === 'sell').length}개)`);
        
        // 마커 업데이트
        setMarkers(strategyMarkers);
      }
    }
  }, [currentStrategy, allData]);

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