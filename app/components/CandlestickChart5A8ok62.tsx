import { useEffect, useRef, useState, useCallback } from 'react';
//import { useUpbitStore, TradeStrategy } from '../store/useUpbitStore';
import { useUpbitStore } from '../store/useUpbitStore';
import {
  createChart,
  LineData,
  Time,
  CandlestickSeries,
  LineSeries,
  IChartApi,
  ISeriesApi,
  SeriesMarker,
  createSeriesMarkers,
  HistogramSeries,
  BusinessDay
} from 'lightweight-charts';
import DatePicker from 'react-datepicker';
import "react-datepicker/dist/react-datepicker.css";
import { getCurrentPrice, get3SecMA } from '../api/upbitOrder';
import { useUpbitWebSocket } from '../hooks/useUpbitWebSocket';
import { ExtendedCandlestickData } from '../types/candlestick';
import { CrossPoint, DateRange, BacktestResult, Trade, UpbitCandle, ChartProps } from '../types/type';
import { getInitialDateRange } from '../handler/chart';



export const CandlestickChart: React.FC<ChartProps> = ({ 
  symbol, 
  chartType,
  initialAutoUpdate = false,
  mode,  // 추가
  handleOrder  // 추가
}) => {
  const container = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
 
  const sixtyEMASeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
 
  const oneTwentyEMASeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const twoFortyEMASeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const threeHundredSixtyEMASeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  

  const crossPointsRef = useRef<CrossPoint[]>([]);
  const volumeSeriesRef = useRef<ISeriesApi<"Histogram"> | null>(null);
  const isLoadingRef = useRef<boolean>(false); // 데이터 로딩 상태를 추적하기 위한 ref
  
  const {  tickers,  orderLimits, maPeriods,  showMA, updateShowMA } = useUpbitStore();
  const [lastUpdated, setLastUpdated] = useState<string>('-');
  const [chartPrice, setChartPrice] = useState<number>(0);
  const [backtestResult, setBacktestResult] = useState<BacktestResult | null>(null);
  const [currentPrice, setCurrentPrice] = useState<number>(0);
  
  // 초기 날짜 범위 상태를 chartType에 따라 설정
  const [dateRange, setDateRange] = useState<DateRange>(getInitialDateRange(chartType));
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [progress, setProgress] = useState<number>(0);
  


  // 자동 업데이트 상태 추가
  const [isAutoUpdate, setIsAutoUpdate] = useState<boolean>(initialAutoUpdate);

  // 매수/매도 신호 생성 로직 수정

  // 컴포넌트 레벨에서 tradeStrategy 가져오기
  //const { tradeStrategy } = useUpbitStore();


  const createTradeMarkers = useCallback((crossPoints: CrossPoint[]): SeriesMarker<Time>[] => {
    return crossPoints.map(point => ({
          time: point.time,
      position: point.position === 'buy' ? 'belowBar' : 'aboveBar',
      color: point.position === 'buy' ? '#2196F3' : '#e91e63',
      shape: point.position === 'buy' ? 'arrowUp' : 'arrowDown',
      text: point.position === 'buy' ? '매수' : '매도',
          size: 2
    }));
  }, []); // 의존성 없음 - 순수 함수


  // 차트 타입에 따른 API 엔드포인트 결정
  const getChartEndpoint = (type: string) => {
    if (type.startsWith('seconds/')) {
      return 'seconds'; // 초봉 API 엔드포인트
    }
    const minutes = parseInt(type);
    if (minutes <= 240) { // 1분봉, 3분봉, 일봉(240분)
      return `minutes/${type}`;
    } else if (minutes === 7200) { // 월봉
      return 'months';
    } else { // 년봉
      return 'years';
    }
  };



  // 전체 데이터 로드 함수를 먼저 선언
  

  // 그 다음에 resetAndLoadData 함수 선언
  const resetAndLoadData = useCallback(async (start: Date, end: Date) => {
    // 모든 시리즈 초기화
    if (candleSeriesRef.current) {
      candleSeriesRef.current.setData([]);
      // 마커 초기화 추가
      createSeriesMarkers(candleSeriesRef.current, []);
    }
    if (volumeSeriesRef.current) {
      volumeSeriesRef.current.setData([]);
    }
 
    if (sixtyEMASeriesRef.current) {
      sixtyEMASeriesRef.current.setData([]);
    }
 
    if (oneTwentyEMASeriesRef.current) {
      oneTwentyEMASeriesRef.current.setData([]);
    }
    if (threeHundredSixtyEMASeriesRef.current) {
      threeHundredSixtyEMASeriesRef.current.setData([]);
    }
    if (twoFortyEMASeriesRef.current) {
      twoFortyEMASeriesRef.current.setData([]);
    }

    // crossPoints 초기화 추가
    crossPointsRef.current = [];

    // 데이터 새로 로드
    await loadAllData(start, end);
  }, [loadAllData]);

  // 차트 초기화
  useEffect(() => {
    if (!container.current) return;

    // Create chart
    const chart = createChart(container.current, {
      layout: {
        background: { color: '#1e1e1e' },
        textColor: '#d1d4dc',
      },
      grid: {
        vertLines: { color: '#2B2B2B' },
        horzLines: { color: '#2B2B2B' },
      },
      width: container.current.clientWidth,
      height: 400,
      timeScale: {
        timeVisible: true,
        secondsVisible: true,
        borderColor: '#2B2B2B',
        tickMarkFormatter: (time: number) => {
          const date = new Date(time * 1000);
          return chartType.startsWith('seconds/') 
            ? date.toLocaleTimeString('ko-KR', { 
                hour: '2-digit', 
                minute: '2-digit', 
                second: '2-digit' 
              })
            : date.toLocaleString('ko-KR', { 
                year: 'numeric', 
                month: '2-digit', 
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit'
              });
        }
      },
      rightPriceScale: {
        scaleMargins: {
          top: 0.1,
          bottom: 0.2,
        },
        borderVisible: false,
      },
      crosshair: {
        mode: 1,
        vertLine: {
          width: 2,
          color: '#555',
          style: 0,
        },
        horzLine: {
          width: 2,
          color: '#555',
          style: 0,
        },
      },
    });

    chartRef.current = chart;

    // Create series using addSeries method
    const candlestickSeries = chart.addSeries(CandlestickSeries, {
      upColor: '#26a69a',
      downColor: '#ef5350',
      borderVisible: false,
      wickUpColor: '#26a69a',
      wickDownColor: '#ef5350',
    });
    candleSeriesRef.current = candlestickSeries;

    // Create volume series
    const volumeSeries = chart.addSeries(HistogramSeries, {
      color: '#26a69a',
      priceFormat: {
        type: 'volume',
      },
      priceScaleId: 'volume',
    });
    volumeSeriesRef.current = volumeSeries;

    // 모든 MA 시리즈 생성
    const createMASeries = (color: string) => {
      return chart.addSeries(LineSeries, {
        color: color,
      lineWidth: 2,
        visible: true,
      });
    };

    // MA 시리즈 초기화
   // 40MA
    sixtyEMASeriesRef.current = createMASeries('#0000FF'); // 60MA
    oneTwentyEMASeriesRef.current = createMASeries('#800080'); // 120MA
    twoFortyEMASeriesRef.current = createMASeries('#FFA500'); // 240MA
    threeHundredSixtyEMASeriesRef.current = createMASeries('#000000'); // 360MA

    // 초기 데이터 로드
    if (dateRange.startDate && dateRange.endDate) {
    loadAllData(dateRange.startDate, dateRange.endDate);
    }

    // 윈도우 리사이즈 핸들러
    const handleResize = () => {
      if (container.current && chartRef.current) {
        chartRef.current.applyOptions({
          width: container.current.clientWidth,
        });
      }
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
      }
    };
  }, [loadAllData, chartType, dateRange.endDate, dateRange.startDate]);

  // MA 표시 상태 변경 시 업데이트
  useEffect(() => {
    if (!chartRef.current || !candleSeriesRef.current) return;

    const candleData = candleSeriesRef.current.data() as ExtendedCandlestickData[];
    
    // 각 MA 시리즈 업데이트
    if (candleData.length > 0) {
      if (sixtyEMASeriesRef.current) {
        const sixtyEMA = calculateEMA(candleData, maPeriods.sixty);
        sixtyEMASeriesRef.current.setData(sixtyEMA);
        sixtyEMASeriesRef.current.applyOptions({ visible: showMA.sixty });
      }

      if (oneTwentyEMASeriesRef.current) {
        const oneTwentyEMA = calculateEMA(candleData, maPeriods.oneTwenty);
        oneTwentyEMASeriesRef.current.setData(oneTwentyEMA);
        oneTwentyEMASeriesRef.current.applyOptions({ visible: showMA.oneTwenty });
      }

      if (threeHundredSixtyEMASeriesRef.current) {
        const threeHundredSixtyEMA = calculateEMA(candleData, maPeriods.threeHundredSixty);
        threeHundredSixtyEMASeriesRef.current.setData(threeHundredSixtyEMA);
        threeHundredSixtyEMASeriesRef.current.applyOptions({ visible: showMA.threeHundredSixty });
      }

      if (twoFortyEMASeriesRef.current) {
        const twoFortyEMA = calculateEMA(candleData, maPeriods.twoForty);
        twoFortyEMASeriesRef.current.setData(twoFortyEMA);
        twoFortyEMASeriesRef.current.applyOptions({ visible: showMA.twoForty });
      }
    }
  }, [showMA, maPeriods]);  // candleData 제거

  // 차트 생성 시 스크롤 이벤트 구독
  useEffect(() => {
    if (!chartRef.current) return;

    const handleVisibleTimeRangeChange = () => {
      const visibleRange = chartRef.current?.timeScale().getVisibleRange();
      if (!visibleRange) return;

      // 왼쪽 끝(과거)으로 스크롤이 충분히 이동했을 때 추가 데이터 로드
      const candleData = candleSeriesRef.current?.data() as ExtendedCandlestickData[];
      if (!candleData || candleData.length === 0) return;

      const oldestVisible = visibleRange.from as number;
      const oldestData = candleData[0].time as number;
      
      // 보이는 영역의 시작이 현재 데이터의 시작 부분에 가까워지면 추가 데이터 로드
      if (oldestVisible - oldestData < 10 && !isLoadingRef.current && dateRange.endDate) {
        isLoadingRef.current = true;
        const newStartDate = new Date(oldestData * 1000);
        loadAllData(newStartDate, dateRange.endDate).finally(() => {
          isLoadingRef.current = false;
        });
      }
    };

    chartRef.current.timeScale().subscribeVisibleTimeRangeChange(handleVisibleTimeRangeChange);

    return () => {
      chartRef.current?.timeScale().unsubscribeVisibleTimeRangeChange(handleVisibleTimeRangeChange);
    };
  }, [loadAllData, chartType, dateRange.endDate, dateRange.startDate]);

  // 실시간 가격 업데이트 처리
  useEffect(() => {
    if (!candleSeriesRef.current || !chartRef.current) return;

    // 현재 캔들 데이터 가져오기
    const candleData = candleSeriesRef.current.data() as ExtendedCandlestickData[];
    if (candleData.length === 0) return;

    // 마지막 캔들 정보 업데이트
    const lastCandle = candleData[candleData.length - 1];
    if (!lastCandle) return;

    // 차트 가격 업데이트
    setChartPrice(lastCandle.close);

    // 현재 시간이 마지막 캔들의 시간보다 크면 새 캔들 추가
    const currentTime = Math.floor(Date.now() / 1000);
    const lastCandleTime = lastCandle.time as number;

    if (currentTime > lastCandleTime && currentPrice > 0) {
      const newCandle = {
        time: currentTime as Time,
        open: currentPrice,
          high: currentPrice,
          low: currentPrice,
        close: currentPrice
      };
      candleSeriesRef.current.update(newCandle);
    }
  }, [currentPrice, chartType]);

  // EMA 계산 함수
  const calculateEMA = useCallback((data: ExtendedCandlestickData[], period: number): LineData<Time>[] => {
    if (!data || data.length === 0 || period <= 0) return [];
    
    const emaData: LineData<Time>[] = [];
    const multiplier = 2 / (period + 1);
    let initialSMA = 0;
    
    const validData = data.filter(item => item && item.close !== undefined);
    if (validData.length === 0) return [];
    
    for (let i = 0; i < Math.min(period, validData.length); i++) {
      initialSMA += validData[i].close;
    }
    initialSMA /= Math.min(period, validData.length);
    
    if (validData.length > 0) {
      emaData.push({
        time: validData[0].time,
        value: initialSMA
      });
    }
    
    for (let i = 1; i < validData.length; i++) {
      const previousEMA = emaData[i - 1].value;
      const currentEMA = (validData[i].close - previousEMA) * multiplier + previousEMA;
      
      emaData.push({
        time: validData[i].time,
        value: currentEMA
      });
    }
    
    return emaData;
  }, []); // 의존성 배열이 비어있음 - 함수가 순수하고 외부 의존성이 없기 때문

  // 백테스트 결과 계산 함수 수정
  const calculateBacktestResult = useCallback((candleData: ExtendedCandlestickData[], crossPoints: CrossPoint[]): BacktestResult => {
    const trades: Trade[] = [];
    let buyPoint: CrossPoint | null = null;
    const feeRate = 0.0005;
    
    for (let i = 0; i < crossPoints.length; i++) {
      const point = crossPoints[i];
      if (point.position === 'buy') {
        buyPoint = point;
      } else if (point.position === 'sell' && buyPoint) {
        if (point.isAbove360MA) {
          continue;
        }
        const entryPrice = buyPoint.price;
        const exitPrice = point.price;
        const returnRate = (exitPrice - entryPrice) / entryPrice;
        
        trades.push({
          entryTime: buyPoint.time,
          exitTime: point.time,
          entryPrice,
          exitPrice,
          return: returnRate,
          isSuccess: returnRate > 0,
          mode: mode === 'test' ? 'test-auto' : 'live-auto',
          angles: {
            entryMa360: buyPoint.slopes.ma360,
            exitMa360: point.slopes.ma360,
            entryMa120: buyPoint.slopes.ma120,
            exitMa120: point.slopes.ma120
          }
        });
        buyPoint = null;
      }
    }

    const totalTrades = trades.length;
    const successfulTrades = trades.filter(trade => trade.isSuccess).length;
    const totalReturn = trades.reduce((sum, trade) => sum + trade.return, 0);
    const totalNetReturn = trades.reduce((sum, trade) => sum + (trade.return - (feeRate * 2)), 0);
    
    return {
      totalTrades,
      successfulTrades,
      totalReturn,
      totalNetReturn,
      successRate: totalTrades > 0 ? (successfulTrades / totalTrades) * 100 : 0,
      averageReturn: totalTrades > 0 ? totalReturn / totalTrades : 0,
      averageNetReturn: totalTrades > 0 ? totalNetReturn / totalTrades : 0,
      trades
    };
  }, [mode]); // mode만 의존성으로 추가
  
  const findCrossPoints = useCallback((sixtyEMA: LineData<Time>[]): CrossPoint[] => {
    const crossPoints: CrossPoint[] = [];
    let lastAction: 'buy' | 'sell' | null = null;
    let lastActionTime: number = 0;
    const startTime = Math.floor(Date.now() / 1000) - 3600; // 현재 시간에서 60분 전 부터 매매
    
    // 필요한 MA 데이터 가져오기
    const ma360Data = threeHundredSixtyEMASeriesRef.current?.data() as LineData<Time>[];
    const ma240Data = twoFortyEMASeriesRef.current?.data() as LineData<Time>[];
    const ma120Data = oneTwentyEMASeriesRef.current?.data() as LineData<Time>[];
    
    // 조건 지속 시간 추적을 위한 변수들
    const MIN_TIME_BETWEEN_TRADES = 30; // 30초 - 루프 외부로 이동
    
    for (let i = 11; i < sixtyEMA.length; i++) {
      const currentTime = sixtyEMA[i].time as number;
      
      // 시작 시간 이전의 신호는 무시
      if (currentTime < startTime) continue;
      
      const currSixty = sixtyEMA[i].value;
      
      // 240MA 관련 데이터 계산
      const tolerance = 3; // 초 단위 허용 오차
      const ma240Index = ma240Data ? ma240Data.findIndex(d => Math.abs((d.time as number) - (sixtyEMA[i].time as number)) < tolerance) : -1;
      const ma120Index = ma120Data ? ma120Data.findIndex(d => Math.abs((d.time as number) - (sixtyEMA[i].time as number)) < tolerance) : -1;
      const ma360Index = ma360Data ? ma360Data.findIndex(d => Math.abs((d.time as number) - (sixtyEMA[i].time as number)) < tolerance) : -1;
      
      // 10초 전 인덱스 계산
      const prevIndex = i - 5;
      if (prevIndex < 0 || !sixtyEMA[prevIndex] || !sixtyEMA[i]) continue;
      
      // 현재 시점과 10초 전 시점의 120MA와 240MA 값 가져오기
      const curr120MA = ma120Index >= 0 && ma120Data && ma120Data[ma120Index] ? ma120Data[ma120Index].value : 0;
      const curr240MA = ma240Index >= 0 && ma240Data && ma240Data[ma240Index] ? ma240Data[ma240Index].value : 0;
      const curr360MA = ma360Index >= 0 && ma360Data && ma360Data[ma360Index] ? ma360Data[ma360Index].value : 0;
      
      // 10초 전 120MA와 240MA 인덱스 찾기
      const prev120Index = ma120Data ? ma120Data.findIndex(d => Math.abs((d.time as number) - (sixtyEMA[prevIndex].time as number)) < tolerance) : -1;
      const prev240Index = ma240Data ? ma240Data.findIndex(d => Math.abs((d.time as number) - (sixtyEMA[prevIndex].time as number)) < tolerance) : -1;
      const prev360Index = ma360Data ? ma360Data.findIndex(d => Math.abs((d.time as number) - (sixtyEMA[prevIndex].time as number)) < tolerance) : -1;
      const prev120MA = prev120Index >= 0 && ma120Data ? ma120Data[prev120Index].value : 0;
      const prev240MA = prev240Index >= 0 && ma240Data ? ma240Data[prev240Index].value : 0;
      const prev360MA = prev360Index >= 0 && ma360Data ? ma360Data[prev360Index].value : 0;   
      // 이격도 계산 (120MA와 240MA 간의 차이)
      const currentGap = Math.abs(curr120MA - curr240MA);
      const previousGap = Math.abs(prev120MA - prev240MA);
      
      // 이격도가 10초 전보다 근접했는지 확인
      const gapNarrowing = currentGap < previousGap;
      
      // 60MA와 120MA의 교차 여부 확인 + 정배열/역배열 상태에서의 위치 확인
      const buyCross = (sixtyEMA[prevIndex].value < prev120MA) && (currSixty > curr120MA); // 상방 돌파
      const sellCross = (sixtyEMA[prevIndex].value > prev120MA) && (currSixty < curr120MA); // 하방 돌파
      const sixtyAbove120 = (sixtyEMA[prevIndex].value > prev120MA) && (currSixty > curr120MA); // 60MA가 계속 120MA 위에 있음
      const sixtyBelow120 = (sixtyEMA[prevIndex].value < prev120MA) && (currSixty < curr120MA); // 60MA가 계속 120MA 아래에 있음
      const buyCrossOrAbove = buyCross || sixtyAbove120; // 매수 조건: 상방 돌파 또는 계속 위에 있음
      const sellCrossOrBelow = sellCross || sixtyBelow120; // 매도 조건: 하방 돌파 또는 계속 아래에 있음
      
      // 60MA와 120MA의 기울기 차이 계산 (60MA가 120MA보다 얼마나 빠르게 상승하는지)
      const sixtyMA_slope = currSixty - sixtyEMA[prevIndex].value;
      const onetwentyMA_slope = curr120MA - prev120MA;
      const slopeDifference = sixtyMA_slope - onetwentyMA_slope;

      // 60MA가 120MA를 큰 기울기로 상방 관통하는지 확인
      const strongBuyCross = buyCross && (slopeDifference > 0.5); // 0.5는 기울기 차이 임계값으로 조정 가능
      
      // 기울기 계산 (각도 단위) - 수정된 방식
      const timeDiff = 10; // 10초
      const slope120MA = Math.atan2(curr120MA - prev120MA, timeDiff) * (180 / Math.PI);
      const slope240MA = Math.atan2(curr240MA - prev240MA, timeDiff) * (180 / Math.PI);
      const slope360MA = Math.atan2(curr360MA - prev360MA, timeDiff) * (180 / Math.PI);

      // 기울기 조건
      const sloped360 = 15;
      const is360MAUpward = slope360MA > sloped360; // 상향 기울기
      const buySlope = (slope120MA >= 10) && (slope240MA >= 10); // 10도 이상 상향
      const sellSlope = (slope120MA <= -2) && (slope240MA <= -2); // -2도 이하 하향

      // 360MA 기울기가 +/- 15도 이내인지 확인 (횡보 상태)
      const is360MASideways = Math.abs(slope360MA) <= sloped360;
      
      // 시간 간격 조건 확인
      const timeSinceLastAction = currentTime - lastActionTime;
      console.log({
        currentTime,
        lastActionTime,
        timeSinceLastAction,
        MIN_TIME_BETWEEN_TRADES,
        skipThisIteration: timeSinceLastAction < MIN_TIME_BETWEEN_TRADES
      });

      //if (timeSinceLastAction < MIN_TIME_BETWEEN_TRADES) continue; // 30초 간격 유지

      // 정배열/역배열 상태 확인
      const ma360Value = ma360Index >= 0 && ma360Data && ma360Data[ma360Index] ? ma360Data[ma360Index].value : 0;
      const isProperAlignmentFull = (curr240MA > ma360Value);
      const isReverseAlignment = (ma360Value > curr240MA) && (curr240MA > curr120MA);

      // 60MA, 120MA, 240MA의 정배열/역배열 상태 확인
      const isFullProperAlignment = (currSixty > curr120MA) && (curr120MA > curr240MA); // 완전 정배열: 60MA > 120MA > 240MA
      const isFullReverseAlignment = (currSixty < curr120MA) && (curr120MA < curr240MA); // 완전 역배열: 60MA < 120MA < 240MA
      let prev60MASlope: number = 0;
      let prev60MASlopeTime: number = 0;
      const SLOPE_CHANGE_THRESHOLD = 30; //
            // 60MA와 120MA의 기울기가 하강인지 확인
      const slope60MA = sixtyMA_slope; // 60MA 기울기
      const is60MADownward = slope60MA < 0; // 60MA 기울기가 음수이면 하강
      const is120MADownward = slope120MA < 0; // 120MA 기울기가 음수이면 하강
      const isBothMADownward = is60MADownward && is120MADownward; // 두 MA 모두 하강 기울기

      const isRapidSlopeChange = (
        currentTime - prev60MASlopeTime <= SLOPE_CHANGE_THRESHOLD && // 30초 이내
        prev60MASlope < -5 && // 이전에 급하강 (-5도 이하)
        slope60MA > 5 // 현재 급상승 (5도 이상)
      );
      
      // 현재 60MA 기울기 저장
      if (Math.abs(slope60MA) > 5) { // 의미 있는 기울기 변화만 저장
        prev60MASlope = slope60MA;
        prev60MASlopeTime = currentTime;
      }
      
        // 시간 간격 조건 다시 확인 (중요한 조건이므로 이중 확인)
       // const timeSinceLastAction = currentTime - lastActionTime;
        console.log({
          currentTime: new Date(currentTime * 1000).toLocaleTimeString(),
          lastActionTime: lastActionTime > 0 ? new Date(lastActionTime * 1000).toLocaleTimeString() : 'Not set',
          timeSinceLastAction,
          MIN_TIME_BETWEEN_TRADES,
          lastAction,
          insideIs360MASidewaysBlock: true
        });
        
        //if ((!is360MASideways) && (timeSinceLastAction >= MIN_TIME_BETWEEN_TRADES)  ) {
        
          if ((!is360MASideways) && (timeSinceLastAction >= MIN_TIME_BETWEEN_TRADES)) {  // 60MA와 120MA가 하강 기울기인지 확인
          if (isBothMADownward && !isRapidSlopeChange) { // 급격한 기울기 변화가 없을 때만 스킵
            console.log(`Skipping buy: Both 60MA and 120MA are downward sloping. Waiting for 30 seconds.`);
            // 하강 기울기일 때는 lastActionTime을 업데이트하여 30초 동안 매수하지 않음
            lastActionTime = currentTime;
          } 
   // 매수 조건
   if ((lastAction !== 'buy' && 
    (isRapidSlopeChange || // 30초 이내 60MA 기울기가 급하강에서 급상승으로 변경
     (!isBothMADownward && // 60MA와 120MA가 모두 하강 기울기가 아닐 때
      (strongBuyCross || // 60MA가 120MA를 큰 기울기로 상방 관통
       (gapNarrowing && buyCrossOrAbove && buySlope) || 
       (isFullProperAlignment && buyCrossOrAbove) || 
       (isProperAlignmentFull && buyCrossOrAbove && is360MAUpward))
     )) && 
              !isReverseAlignment)) {
            // 매수 신호 생성 코드
            console.log(`BUY signal generated at ${new Date(currentTime * 1000).toLocaleTimeString()}`);
            
            // 360MA 위에 있는지 확인
            const isAbove360MA = currSixty > curr360MA;
            
          crossPoints.push({
              time: sixtyEMA[i].time,
            position: 'buy',
              price: currSixty,
              isAbove360MA: isAbove360MA,
              slopes: {
                ma60: sixtyMA_slope,
                ma120: onetwentyMA_slope,
                ma240: curr240MA - (prev240Index >= 0 && ma240Data ? ma240Data[prev240Index].value : 0),
                ma360: curr360MA - (prev360Index >= 0 && ma360Data ? ma360Data[prev360Index].value : 0)
              },
              deviations: {
                ma120: ((currSixty / curr120MA) * 100) - 100,
                ma240: ((currSixty / curr240MA) * 100) - 100
              }
          });
        lastAction = 'buy';
        lastActionTime = currentTime;
        }
          // 매도 조건
          else if (lastAction == 'buy' && 
                   ((gapNarrowing && sellCrossOrBelow && sellSlope) ||
                    (isFullReverseAlignment && sellCrossOrBelow))) {
            
            // 360MA 위에 있는지 확인
            const isAbove360MA = currSixty > curr360MA;
            
            // 360MA 위에 있으면 매도하지 않음
            if (isAbove360MA) {
              console.log(`SELL signal ignored - price is above 360MA at ${new Date(currentTime * 1000).toLocaleTimeString()}`);
            } else {
              // 매도 신호 생성 코드
              console.log(`SELL signal generated at ${new Date(currentTime * 1000).toLocaleTimeString()}`);
              crossPoints.push({
                time: sixtyEMA[i].time,
                position: 'sell',
                price: currSixty,
                isAbove360MA: isAbove360MA,
                slopes: {
                  ma60: currSixty - sixtyEMA[i-1].value,
                  ma120: curr120MA - (prev120Index >= 0 && ma120Data ? ma120Data[prev120Index].value : 0),
                  ma240: curr240MA - (prev240Index >= 0 && ma240Data ? ma240Data[prev240Index].value : 0),
                  ma360: ma360Index >= 0 && ma360Data ? ma360Data[ma360Index].value - (ma360Index > 0 ? ma360Data[ma360Index-1].value : 0) : 0
                }
              });
              lastAction = 'sell';
              lastActionTime = currentTime;
            }
          }
        } else {
          console.log(`Skipping trade: Last action (${lastAction}) was ${timeSinceLastAction} seconds ago, need to wait ${MIN_TIME_BETWEEN_TRADES - timeSinceLastAction} more seconds`);
        }
      // } else {
      //   console.log("360MA 기울기가 작아서 매수/매도 하지 않음");
      // }
    }
    
    return crossPoints;
  }, [threeHundredSixtyEMASeriesRef, twoFortyEMASeriesRef, oneTwentyEMASeriesRef]); // 의존성 추가
  // 마커 업데이트를 위한 함수 통합
  const updateChartMarkers = useCallback((crossPoints: CrossPoint[]) => {
    if (!candleSeriesRef.current) return;
    
    try {
      // 기존 마커 제거
      createSeriesMarkers(candleSeriesRef.current, []);
      
      // 새 마커 생성 및 설정
      const markers = createTradeMarkers(crossPoints);
    createSeriesMarkers(candleSeriesRef.current, markers);
    } catch (error) {
      console.error('마커 업데이트 실패:', error);
    }
  }, [createTradeMarkers]); // tradeStrategy 제거
const loadAllData = useCallback(async (startDate: Date, endDate: Date) => {
    if (!candleSeriesRef.current) return;
    
    try {
      setIsLoading(true);
      setProgress(0);
      
      const endpoint = getChartEndpoint(chartType);
      const count = chartType.startsWith('seconds/') ? 200 : 200; // 초봉은 200개씩 가져오기
      
      let currentDate = new Date(endDate);
      let allCandleData: UpbitCandle[] = [];
      
      while (currentDate >= startDate) {
        setProgress(Math.min(90, (allCandleData.length / 1000) * 100));
        
        const response = await fetch(
          `https://api.upbit.com/v1/candles/${endpoint}?market=${symbol}&to=${currentDate.toISOString()}&count=${count}`
        );
        
        if (!response.ok) {
          throw new Error('데이터 로딩 실패');
        }

        const data = await response.json() as UpbitCandle[];
        if (!data || data.length === 0) break;

        allCandleData = [...allCandleData, ...data];
        currentDate = new Date(data[data.length - 1].candle_date_time_kst);
        
        // API 호출 간격 조절
        await new Promise(resolve => setTimeout(resolve, 500)); //sky
      }

      // 데이터 정렬 및 중복 제거
      const uniqueData = Array.from(new Map(
        allCandleData.map(item => [item.candle_date_time_kst, item])
      ).values());

      const sortedData = uniqueData
        .sort((a, b) => new Date(a.candle_date_time_kst).getTime() - new Date(b.candle_date_time_kst).getTime())
        .filter(candle => {
          const candleTime = new Date(candle.candle_date_time_kst);
          return candleTime >= startDate && candleTime <= endDate;
        });

      // 차트 데이터 업데이트
      const formattedData = sortedData.map(candle => ({
        time: (new Date(candle.candle_date_time_kst).getTime() / 1000) as Time,
        open: candle.opening_price,
        high: candle.high_price,
        low: candle.low_price,
        close: candle.trade_price,
        volume: candle.candle_acc_trade_volume
      })) as ExtendedCandlestickData[];

      // 차트 업데이트
      candleSeriesRef.current.setData(formattedData);
      
      // 모든 EMA 계산 및 업데이트
 
      const sixtyEMAData = calculateEMA(formattedData, maPeriods.sixty);
      const oneTwentyEMAData = calculateEMA(formattedData, maPeriods.oneTwenty);
      const twoFortyEMAData = calculateEMA(formattedData, maPeriods.twoForty);
      const threeHundredSixtyEMAData = calculateEMA(formattedData, maPeriods.threeHundredSixty);

      // 각 EMA 시리즈 업데이트
 
      if (sixtyEMASeriesRef.current) {
        sixtyEMASeriesRef.current.setData(sixtyEMAData);
      }
  
      if (oneTwentyEMASeriesRef.current) {
        oneTwentyEMASeriesRef.current.setData(oneTwentyEMAData);
      }
      if (threeHundredSixtyEMASeriesRef.current) {
        threeHundredSixtyEMASeriesRef.current.setData(threeHundredSixtyEMAData);
      }
      if (twoFortyEMASeriesRef.current) {
        twoFortyEMASeriesRef.current.setData(twoFortyEMAData);
      }
          
      // 거래 신호 업데이트
      const crossPoints = findCrossPoints(sixtyEMAData);
          crossPointsRef.current = crossPoints;
          
      // 통합된 마커 업데이트 함수 사용
      updateChartMarkers(crossPoints);

        // 백테스팅 결과 업데이트
      const result = calculateBacktestResult(formattedData, crossPoints);
      if (result.trades.length > 0) {
        setBacktestResult(result);
      } else {
        setBacktestResult(null);
      }

      setProgress(100);
    } catch (error) {
      console.error('데이터 로딩 오류:', error);
      alert('데이터 로딩 중 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
      setProgress(0);
    }
  }, [
    symbol, 
    chartType, 
    maPeriods, 
    //tradeStrategy,
    calculateBacktestResult,
    calculateEMA,
    findCrossPoints,
    updateChartMarkers
  ]); 
  // 시세 차이 계산
  const priceDiff = currentPrice > 0 && chartPrice > 0 
    ? currentPrice - chartPrice 
    : 0;
  const priceDiffPercentage = currentPrice > 0 && chartPrice > 0
    ? (priceDiff / chartPrice) * 100
    : 0;

  // 거래량 기반 신호 판단 함수
  const evaluateVolumeSignals = useCallback((candleData: ExtendedCandlestickData[], currentVolume: number, currentPrice: number): string => {
    const calculateVMA = (data: ExtendedCandlestickData[], period: number): number => {
      const volumes = data.slice(-period).map(candle => candle.volume || 0);
      const totalVolume = volumes.reduce((sum, volume) => sum + volume, 0);
      return totalVolume / period;
    };

    const VMA10 = calculateVMA(candleData, 10);
    const lastCandle = candleData[candleData.length - 1];
    const volumeRatio = (currentVolume / VMA10) * 100;

    if (currentVolume >= VMA10 * 2) {
      if (currentPrice > lastCandle.close) {
        return '강한 매수 신호';
      } else {
        return '강한 매도 신호';
      }
    }

    if (volumeRatio > 150) {
      return '강한 상승 신호';
    } else if (volumeRatio < 50) {
      return '약한 매매세력';
    }

    return '';
  }, []); // 의존성 없음 - 순수 함수

  // 컴포넌트 최상위 레벨에 선언
  const calculateOBV = useCallback((data: ExtendedCandlestickData[]): number => {
    let obv = 0;
    for (let i = 1; i < data.length; i++) {
      const currentCandle = data[i];
      const previousCandle = data[i - 1];
      if (currentCandle.close > previousCandle.close) {
        obv += currentCandle.volume || 0;
      } else if (currentCandle.close < previousCandle.close) {
        obv -= currentCandle.volume || 0;
      }
    }
    return obv;
  }, []);

  // useEffect 내부에서 사용
  useEffect(() => {
    if (!candleSeriesRef.current || !volumeSeriesRef.current) return;
    const candleData = candleSeriesRef.current.data() as ExtendedCandlestickData[];
    if (candleData.length === 0) return;
    const lastCandle = candleData[candleData.length - 1];
    if (!lastCandle) return;
    const currentVolume = lastCandle.volume || 0;
    const currentPrice = lastCandle.close;
    const volumeSignal = evaluateVolumeSignals(candleData, currentVolume, currentPrice);
    const obv = calculateOBV(candleData);
    console.log('Volume Signal:', volumeSignal);
    console.log('OBV:', obv);
  }, [evaluateVolumeSignals, calculateOBV]);

  // 컴포넌트 내부에 상태 추가
  const [isFullscreen, setIsFullscreen] = useState(false);
  const chartContainerRef = useRef<HTMLDivElement>(null);

  // 전체화면 토글 함수 추가
  const toggleFullscreen = () => {
    if (!chartContainerRef.current) return;

    if (!document.fullscreenElement) {
      chartContainerRef.current.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  // 전체화면 변경 이벤트 감지
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  // 상태 추가
  const [chartHeight, setChartHeight] = useState<number>(400);

  // 차트 높이 조절 핸들러 추가
  const handleHeightChange = (height: number) => {
    setChartHeight(height);
    if (chartRef.current) {
      chartRef.current.applyOptions({
        height: height
      });
    }
  };

 

  // chartType이 변경될 때 날짜 범위도 함께 갱신
  useEffect(() => {
    setDateRange(getInitialDateRange(chartType));
  }, [chartType]);

  // CSV 다운로드를 위한 날짜 선택 상태 추가
  const [csvDateRange, setCsvDateRange] = useState<{
    startDate: Date | null;
    endDate: Date | null;
  }>({
    startDate: null,
    endDate: null
  });

  // CSV 다운로드 관련 상태 추가
  const [csvLoading, setCsvLoading] = useState<boolean>(false);
  const [csvProgress, setCsvProgress] = useState<number>(0);

  // CSV 저장 함수 수정
  const saveToCSV = async () => {
    if (!csvDateRange.startDate || !csvDateRange.endDate) {
      alert('날짜를 선택해주세요');
      return;
    }

    try {
      setCsvLoading(true);
      setCsvProgress(0);
      setAllData([]); // 데이터 초기화

      // 날짜 변환 로직 수정 - 시간대 변환 없이 직접 사용
      const startDate = new Date(csvDateRange.startDate);
      const endDate = new Date(csvDateRange.endDate);
      
      // 시작 시간을 해당 날짜의 00:00:00으로 설정
      startDate.setHours(0, 0, 0, 0);
      
      // 종료 시간을 해당 날짜의 23:59:59로 설정
      endDate.setHours(23, 59, 59, 999);
      
      console.log('CSV 다운로드 시작 - 날짜 범위:', {
        원본: {
          startDate: csvDateRange.startDate?.toISOString(),
          endDate: csvDateRange.endDate?.toISOString()
        },
        변환후: {
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString()
        }
      });

      // 현재 날짜 확인
      const now = new Date();
      if (endDate > now) {
        console.warn('미래 날짜가 선택됨. 현재 날짜로 조정합니다.');
        endDate.setTime(now.getTime());
      }
      
      // 날짜 범위가 너무 넓은지 확인 (최대 30일)
      const MAX_DAYS = 30;
      const daysDiff = Math.floor((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
      
      if (daysDiff > MAX_DAYS) {
        console.warn(`선택한 기간이 너무 깁니다: ${daysDiff}일. 최대 ${MAX_DAYS}일로 제한합니다.`);
        startDate.setTime(endDate.getTime() - (MAX_DAYS * 24 * 60 * 60 * 1000));
      }

      // 데이터 로딩 시작
      setCsvProgress(10);
      
      // API 요청 준비
      const count = 200; // 한 번에 가져올 최대 캔들 수
      let tempData: UpbitCandle[] = [];
      
      // 종료일부터 시작하여 과거로 거슬러 올라가는 방식
      let currentDate = new Date(endDate);
      let retryCount = 0;
      const MAX_RETRIES = 3;
      const MAX_REQUESTS = 50; // 최대 API 요청 횟수 제한
      let requestCount = 0;
      
      while (currentDate >= startDate && retryCount < MAX_RETRIES && requestCount < MAX_REQUESTS) {
        requestCount++;
        setCsvProgress(Math.min(90, (tempData.length / 2000) * 100));
        
        // ISO 문자열로 변환 (UTC 기준)
        const currentDateISO = currentDate.toISOString();
        const apiUrl = `https://api.upbit.com/v1/candles/minutes/1?market=${symbol}&to=${currentDateISO}&count=${count}`;
        console.log(`API 요청 #${requestCount}: ${apiUrl}`);
        
        try {
          const response = await fetch(apiUrl);
          
          if (!response.ok) {
            const errorText = await response.text();
            console.error(`API 응답 오류: 상태 코드 ${response.status}`, errorText);
            
            // 429 (Too Many Requests) 오류 처리
            if (response.status === 429) {
              console.log('요청 제한 초과. 5초 대기 후 재시도...');
              await new Promise(resolve => setTimeout(resolve, 5000));
              retryCount++;
              continue;
            }
            
            throw new Error(`API 요청 실패: ${response.status} - ${errorText}`);
          }

          const data = await response.json();
          console.log(`API 응답 데이터 수신: ${data?.length || 0}개`);
          
          if (!data || data.length === 0) {
            console.warn('API에서 데이터를 반환하지 않음. 루프 종료');
            break;
          }

          // 데이터 추가
          tempData = [...tempData, ...data];
          console.log(`누적 데이터: ${tempData.length}개`);
          
          // 다음 요청을 위해 날짜 업데이트
          const oldestCandleDate = new Date(data[data.length - 1].candle_date_time_utc);
          
          // 1분을 빼서 중복을 방지
          oldestCandleDate.setMinutes(oldestCandleDate.getMinutes() - 1);
          
          const prevDate = new Date(currentDate);
          currentDate = oldestCandleDate;
          
          console.log(`다음 요청 날짜 업데이트: ${prevDate.toISOString()} -> ${currentDate.toISOString()}`);
          
          // 진행 상황 업데이트
          setAllData([...tempData]); // 새 배열 생성하여 상태 업데이트 보장
          
          // API 요청 제한 방지를 위한 지연
          await new Promise(resolve => setTimeout(resolve, 300));
          
          // 재시도 카운터 초기화
          retryCount = 0;
        } catch (apiError) {
          console.error('API 호출 오류:', apiError);
          retryCount++;
          
          if (retryCount >= MAX_RETRIES) {
            console.error(`최대 재시도 횟수(${MAX_RETRIES})에 도달했습니다.`);
            break;
          }
          
          console.log(`${retryCount}번째 재시도... 2초 후 다시 시도합니다.`);
          await new Promise(resolve => setTimeout(resolve, 2000));
          continue;
        }
      }

      console.log(`API 요청 완료. 총 데이터: ${tempData.length}개, 총 요청 수: ${requestCount}`);

      if (tempData.length === 0) {
        throw new Error('데이터를 가져오지 못했습니다. 다른 날짜 범위를 선택해 주세요.');
      }

      // 중복 제거 (candle_date_time_utc 기준)
      const uniqueData = Array.from(
        new Map(tempData.map(item => [item.candle_date_time_utc, item])).values()
      );
      
      console.log(`중복 제거 후 데이터: ${uniqueData.length}개 (${tempData.length - uniqueData.length}개 중복 제거)`);

      // 데이터 정렬 (시간 오름차순)
      const sortedData = uniqueData.sort(
        (a, b) => new Date(a.candle_date_time_utc).getTime() - new Date(b.candle_date_time_utc).getTime()
      );
      
      // 필터링 전 데이터 범위 확인
      if (sortedData.length > 0) {
        const firstCandleTime = new Date(sortedData[0].candle_date_time_utc);
        const lastCandleTime = new Date(sortedData[sortedData.length - 1].candle_date_time_utc);
        
        console.log('정렬된 데이터 범위:', {
          첫데이터: firstCandleTime.toISOString(),
          마지막데이터: lastCandleTime.toISOString(),
          필터시작: startDate.toISOString(),
          필터종료: endDate.toISOString()
        });
      }
      
      // 필터링 적용 (UTC 기준)
      const finalData = sortedData.filter(candle => {
        const candleTime = new Date(candle.candle_date_time_utc);
        return candleTime >= startDate && candleTime <= endDate;
      });

      console.log(`필터링 후 데이터: ${finalData.length}개`);
      
      if (finalData.length === 0) {
        console.error('필터링 후 데이터가 없음. 필터링 전 데이터:', {
          sortedDataLength: sortedData.length,
          firstItem: sortedData.length > 0 ? new Date(sortedData[0].candle_date_time_utc).toISOString() : null,
          lastItem: sortedData.length > 0 ? new Date(sortedData[sortedData.length - 1].candle_date_time_utc).toISOString() : null,
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString()
        });
        
        // 필터링 없이 모든 데이터 사용
        console.log('필터링을 건너뛰고 모든 데이터를 사용합니다.');
        setAllData(sortedData);
        setCsvProgress(100);
        console.log('CSV 데이터 로드 완료 (필터링 없이)');
        return;
      }

      setAllData(finalData);
      setCsvProgress(100);
      console.log('CSV 데이터 로드 완료');

    } catch (error: unknown) {
      console.error('CSV 다운로드 중 오류:', error);
      console.error('오류 세부 정보:', {
        name: error instanceof Error ? error.name : 'Unknown error',
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });
      alert(`데이터 다운로드 중 오류: ${error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.'}`);
    } finally {
      setCsvLoading(false);
      setCsvProgress(0);
    }
  };

  // 컴포넌트 상단에 상태 추가
  const [allData, setAllData] = useState<UpbitCandle[]>([]);

  // useEffect 수정
  useEffect(() => {
    if (!isAutoUpdate) return;

    const updateInterval = setInterval(async () => {
      try {
        const now = new Date();
        const thirtyMinutesAgo = new Date(now.getTime() - 60 * 60 * 1000); //sky
        
        // 데이터 로드 전에 이전 데이터 초기화
        if (candleSeriesRef.current) {
          candleSeriesRef.current.setData([]);
        }
        
        await loadAllData(thirtyMinutesAgo, now);
      } catch (error) {
        console.error('자동 업데이트 오류:', error);
        setIsAutoUpdate(false); // 오류 발생 시 자동 업데이트 중지
      }
    }, 10000); // 10초마다 업데이트

    return () => {
      clearInterval(updateInterval);
    };
  }, [isAutoUpdate, loadAllData]);

  // 날짜 범위 변경 핸들러 추가
  const handleDateRangeChange = (start: Date) => {
    const endTime = new Date(start.getTime() + 30 * 60 * 1000);
    setDateRange({ 
      startDate: start,
      endDate: endTime
    });
    resetAndLoadData(start, endTime);
  };

  // 종료 날짜 변경 핸들러 추가
  const handleEndDateChange = (end: Date) => {
    if (!dateRange.startDate) return;
    setDateRange({
      startDate: dateRange.startDate,
      endDate: end
    });
    resetAndLoadData(dateRange.startDate, end);
  };

  
  // 상태 변수 추가





  // 상태 추가

  // 주문 수량 계산 함수
  const calculateOrderVolume = (price: number) => {
    if (price <= 0) return '0';
    const amount = orderLimits.maxOrderPrice * 0.25; // 최대 주문 금액의 25%
    return (amount / price).toFixed(4);
  };



  const updatePrices = useCallback(async () => {
    if (isLoadingRef.current) return;
      
      try {
        isLoadingRef.current = true;
        const [current, ma3] = await Promise.all([
          getCurrentPrice(symbol),
          get3SecMA(symbol)
        ]);
        
        if (current && ma3) {
          setCurrentPrice(current);
        }
      } catch (error) {
        console.error('가격 업데이트 중 오류:', error);
      } finally {
        isLoadingRef.current = false;
      }
  }, [symbol]);
  // 가격 정보 업데이트 함수
  useEffect(() => {
    let interval: NodeJS.Timeout;

    // 가격 업데이트 함수 선언
   

    // 초기 업데이트
    updatePrices();
    
    // 자동 업데이트가 활성화된 경우에만 인터벌 설정
    if (isAutoUpdate) {
      interval = setInterval(updatePrices, 10000); // 3초마다 업데이트
    }

    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [symbol, isAutoUpdate]); // isAutoUpdate 의존성 추가


  // 자동 업데이트 토글 핸들러 수정
  const handleAutoUpdateToggle = () => {
    if (!isAutoUpdate) {
      // 자동 업데이트 활성화 시 웹소켓 비활성화
      if (isWebSocketEnabled) {
        disconnectWebSocket();
        setIsWebSocketEnabled(false);
      }
    }
    setIsAutoUpdate(!isAutoUpdate);
  };

  // 상태 추가
  const [isWebSocketEnabled, setIsWebSocketEnabled] = useState<boolean>(false);
  const {  disconnectWebSocket, setOnCandleComplete } = useUpbitWebSocket();

  // useEffect 내에서 tickers 변경 감지
  useEffect(() => {
    const currentTicker = tickers[symbol];
    if (currentTicker) {
      setLastUpdated(new Date().toLocaleString());
    }
  }, [tickers, symbol]);

  // new: 캔들 완료 처리 함수 (완료된 캔들을 누적 업데이트)
  const handleCompletedCandle = useCallback((newCandle: ExtendedCandlestickData) => {
    // 기존 완료된 캔들 데이터 취득 (없다면 빈 배열)
    const existingData = candleSeriesRef.current?.data() as ExtendedCandlestickData[] || [];

    // 새 캔들을 누적
    const updatedData = [...existingData, newCandle];
    candleSeriesRef.current?.setData(updatedData);

    // EMA 재계산
    const sixtyEMAData = calculateEMA(updatedData, maPeriods.sixty);
    const oneTwentyEMAData = calculateEMA(updatedData, maPeriods.oneTwenty);
    const twoFortyEMAData = calculateEMA(updatedData, maPeriods.twoForty);
    const threeHundredSixtyEMAData = calculateEMA(updatedData, maPeriods.threeHundredSixty);
 
    sixtyEMASeriesRef.current?.setData(sixtyEMAData);
    oneTwentyEMASeriesRef.current?.setData(oneTwentyEMAData);
    twoFortyEMASeriesRef.current?.setData(twoFortyEMAData);
    threeHundredSixtyEMASeriesRef.current?.setData(threeHundredSixtyEMAData);

    // 크로스 포인트(매수/매도 신호) 계산 및 마커 업데이트
    const crossPoints = findCrossPoints(sixtyEMAData);
    crossPointsRef.current = crossPoints;
    const markers = createTradeMarkers(crossPoints);
    if (candleSeriesRef.current) {
      createSeriesMarkers(candleSeriesRef.current, markers);
    }

    // 백테스팅 결과 업데이트
    const result = calculateBacktestResult(updatedData, crossPoints);
    setBacktestResult(result);
  }, [maPeriods, calculateEMA, findCrossPoints, createTradeMarkers, calculateBacktestResult]);

  // WebSocket에서 캔들 완료 시 호출하는 콜백 등록:
  useEffect(() => {
    setOnCandleComplete((completedCandle: ExtendedCandlestickData) => {
      handleCompletedCandle(completedCandle);
    });
  }, [setOnCandleComplete, handleCompletedCandle]);

  // 마커 업데이트 함수 추가
  const updateTradeMarkers = (candleSeries: ISeriesApi<"Candlestick">, markers: SeriesMarker<Time>[]) => {
    try {
      // 기존 마커들을 모두 대체
      ((candleSeries as unknown) as { setMarkers(markers: SeriesMarker<Time>[]): void }).setMarkers(markers);
    } catch (error: unknown) {
      console.error('마커 업데이트 실패:', error);
    }
  };

  // 새: 실시간 API 업데이트 토글 상태를 추가
  const [isRealtimeAPIEnabled, setIsRealtimeAPIEnabled] = useState<boolean>(false);
  
  // 실시간 API 업데이트를 위한 interval ref 추가
  const apiIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const handleRealtimeAPIToggle = () => {
    if (!isRealtimeAPIEnabled) {
      // 다른 업데이트 모드 비활성화
      setIsAutoUpdate(false);
      setIsWebSocketEnabled(false);
      if (isWebSocketEnabled) {
        disconnectWebSocket();
      }
      
      // 자동 업데이트와 유사한 구조로 수정
      apiIntervalRef.current = setInterval(async () => {
        try {
          // 초봉 데이터 한 개만 가져오기
          const response = await fetch(
            `https://api.upbit.com/v1/candles/seconds?market=${symbol}&count=1`
          );
          const data = await response.json();
          
          if (data && data[0]) {
            const existingData = Array.from(candleSeriesRef.current?.data() ?? []) as ExtendedCandlestickData[];
            const lastDataTime = existingData.length > 0 ? new Date(existingData[existingData.length - 1].time as string).getTime() : 0;
            const newDataTime = new Date(data[0].candle_date_time_kst).getTime();

            // 새로운 데이터인 경우에만 추가
            if (newDataTime > lastDataTime) {
              const newCandle = {
                time: Math.floor(new Date(data[0].candle_date_time_kst).getTime() / 1000) as Time,
                open: data[0].opening_price,
                high: data[0].high_price,
                low: data[0].low_price,
                close: data[0].trade_price,
                volume: data[0].candle_acc_trade_volume
              };

              const updatedData = existingData.filter(candle => 
                (candle.time as number) !== Math.floor(newDataTime / 1000)
              ).concat(newCandle)
                .sort((a, b) => (a.time as number) - (b.time as number));

              candleSeriesRef.current?.setData(updatedData);
              
              // MA 데이터 업데이트
              
              const sixtyEMAData = calculateEMA(updatedData, maPeriods.sixty);
              const oneTwentyEMAData = calculateEMA(updatedData, maPeriods.oneTwenty);
              const twoFortyEMAData = calculateEMA(updatedData, maPeriods.twoForty);
              const threeHundredSixtyEMAData = calculateEMA(updatedData, maPeriods.threeHundredSixty);
              sixtyEMASeriesRef.current?.setData(sixtyEMAData);
              oneTwentyEMASeriesRef.current?.setData(oneTwentyEMAData);
              twoFortyEMASeriesRef.current?.setData(twoFortyEMAData);
              threeHundredSixtyEMASeriesRef.current?.setData(threeHundredSixtyEMAData);
              // 크로스 포인트 및 마커 업데이트
              const crossPoints = findCrossPoints(sixtyEMAData);
              crossPointsRef.current = crossPoints;
              const markers = createTradeMarkers(crossPoints);
              if (candleSeriesRef.current) {
                updateTradeMarkers(candleSeriesRef.current, markers);
                const lastCrossPoint = crossPoints[crossPoints.length - 1];
                const timestampInSeconds = Math.floor(data[0].timestamp / 1000);
                if (lastCrossPoint && Math.abs(Number(lastCrossPoint.time) - timestampInSeconds) <= 1) {
                  console.log('크로스 포인트 감지:', lastCrossPoint.position);
                  try {
                    await handleOrder({
                      market: symbol,
                      side: lastCrossPoint.position === 'buy' ? 'bid' : 'ask',
                      volume: calculateOrderVolume(data[0].trade_price),
                      price: data[0].trade_price.toString(),
                      ord_type: 'limit',
                      mode: mode
                    });
                  } catch (error) {
                    console.error('주문 실행 중 오류:', error);
                  }
                }
                
                // 크로스 포인트 및 마커 업데이트
                if (candleSeriesRef.current) {
                  updateTradeMarkers(candleSeriesRef.current, markers);
                }
              }
              setCurrentPrice(data[0].trade_price);
            }
          }
        } catch (error) {
          console.error('실시간 API 업데이트 중 오류:', error);
        }
      }, 1000);  // 1초마다 업데이트
    } else {
      // interval 정리
      if (apiIntervalRef.current) {
        clearInterval(apiIntervalRef.current);
        apiIntervalRef.current = null;
      }
    }
    setIsRealtimeAPIEnabled((prev) => !prev);
  };

  // 컴포넌트 언마운트 시 정리
  useEffect(() => {
    return () => {
      if (apiIntervalRef.current) {
        clearInterval(apiIntervalRef.current);
      }
    };
  }, []);





  // 차트 업데이트 부분 수정
  useEffect(() => {
    if (!chartRef.current) return;

    // 기존 시리즈 제거
    const removeSeries = (series: ISeriesApi<"Line"> | null) => {
      if (series && chartRef.current) {
        try {
          chartRef.current.removeSeries(series);
        } catch (error) {
          console.error('시리즈 제거 중 오류:', error);
        }
      }
    };

 
    removeSeries(sixtyEMASeriesRef.current);
 
    removeSeries(oneTwentyEMASeriesRef.current);
    removeSeries(twoFortyEMASeriesRef.current);
    removeSeries(threeHundredSixtyEMASeriesRef.current);

    // 새 시리즈 추가
  
    if (showMA.sixty) {
      sixtyEMASeriesRef.current = chartRef.current.addSeries(LineSeries);
      sixtyEMASeriesRef.current.applyOptions({
        color: '#0000FF',  // 파란색
        lineWidth: 2,
      });
    }
    if (showMA.oneTwenty) {
      oneTwentyEMASeriesRef.current = chartRef.current.addSeries(LineSeries);
      oneTwentyEMASeriesRef.current.applyOptions({
        color: '#FFFF00',  // 노란색
        lineWidth: 2,
      });
    }
    if (showMA.twoForty) {
      twoFortyEMASeriesRef.current = chartRef.current.addSeries(LineSeries);
      twoFortyEMASeriesRef.current.applyOptions({
        color: 'rgba(255, 165, 0, 0.8)', // 오렌지색
        lineWidth: 2,
      });
    }
    if (showMA.threeHundredSixty) {
      threeHundredSixtyEMASeriesRef.current = chartRef.current.addSeries(LineSeries);
      threeHundredSixtyEMASeriesRef.current.applyOptions({
        color: '#800080',  // 보라색
        lineWidth: 2,
      });
    }

    // 데이터 업데이트
    if (candleSeriesRef.current) {
      const candleData = candleSeriesRef.current.data() as ExtendedCandlestickData[];
 
      if (showMA.sixty) {
        const sixtyEMA = calculateEMA(candleData, maPeriods.sixty);
        sixtyEMASeriesRef.current?.setData(sixtyEMA);
      }
      if (showMA.oneTwenty && oneTwentyEMASeriesRef.current) {
        const oneTwentyEMA = calculateEMA(candleData, maPeriods.oneTwenty);
        oneTwentyEMASeriesRef.current.setData(oneTwentyEMA);
        oneTwentyEMASeriesRef.current.applyOptions({
          color: '#FFFF00',  // 노란색
          lineWidth: 2,
          visible: showMA.oneTwenty,
        });
      }
      if (showMA.twoForty && twoFortyEMASeriesRef.current) {
        const twoFortyEMA = calculateEMA(candleData, maPeriods.twoForty);
        twoFortyEMASeriesRef.current.setData(twoFortyEMA);
        twoFortyEMASeriesRef.current.applyOptions({
            color: 'rgba(255, 165, 0, 0.8)', // 오렌지색
          lineWidth: 2,
          visible: showMA.twoForty,
        });
      }
      if (showMA.threeHundredSixty && threeHundredSixtyEMASeriesRef.current) {
        const threeHundredSixtyEMA = calculateEMA(candleData, maPeriods.threeHundredSixty);
        threeHundredSixtyEMASeriesRef.current.setData(threeHundredSixtyEMA);
        threeHundredSixtyEMASeriesRef.current.applyOptions({
          color: '#800080',  // 보라색
          lineWidth: 2,
          visible: showMA.threeHundredSixty,
        });
      }
    }
  }, [maPeriods, showMA]);
  // 상태 선언을 먼저
  const [candleData, setCandleData] = useState<ExtendedCandlestickData[]>([]);
  // 데이터 업데이트 useEffect 수정
  useEffect(() => {
    if (candleSeriesRef.current) {
      const candleData = candleSeriesRef.current.data() as ExtendedCandlestickData[];
      
      // ... 기존 MA 업데이트 ...

      // 360MA 업데이트
      if (showMA.threeHundredSixty && threeHundredSixtyEMASeriesRef.current) {
        const threeHundredSixtyEMA = calculateEMA(candleData, maPeriods.threeHundredSixty);
        threeHundredSixtyEMASeriesRef.current.setData(threeHundredSixtyEMA);
        threeHundredSixtyEMASeriesRef.current.applyOptions({
          color: '#800080',  // 보라색
          lineWidth: 2,
          visible: showMA.threeHundredSixty,
        });
      }
    }
  }, [candleData, showMA, maPeriods]);  // 의존성 배열에 showMA와 maPeriods 추가



  // 캔들 데이터 업데이트 함수
  const updateCandleData = useCallback(() => {
    if (candleSeriesRef.current) {
      setCandleData(candleSeriesRef.current.data() as ExtendedCandlestickData[]);
    }
  }, []);

  // 데이터가 변경될 때마다 candleData 업데이트
  useEffect(() => {
    updateCandleData();
  }, [updateCandleData]);

 
  // 백테스트 결과 업데이트 시 기울기 저장
  useEffect(() => {
    if (backtestResult?.trades && candleSeriesRef.current) {
      const candleData = candleSeriesRef.current.data() as ExtendedCandlestickData[];
      
      // 각 거래별로 진입/청산 시점의 기울기 계산
      const updatedTrades = backtestResult.trades.map(trade => {
        const entryTime = trade.entryTime as number;
        const exitTime = trade.exitTime as number;
        
        // 진입 시점 기울기 계산
        const entryIndex = candleData.findIndex(d => (d.time as number) === entryTime);
        const entryMa360 = entryIndex > 0 ? calculateSlope(
          candleData.slice(Math.max(0, entryIndex - 5), entryIndex + 1),
          maPeriods.threeHundredSixty
        ) : 0;
        
        // 청산 시점 기울기 계산
        const exitIndex = candleData.findIndex(d => (d.time as number) === exitTime);
        const exitMa360 = exitIndex > 0 ? calculateSlope(
          candleData.slice(Math.max(0, exitIndex - 5), exitIndex + 1),
          maPeriods.threeHundredSixty
        ) : 0;
        
          return {
            ...trade,
          angles: {
            ...trade.angles,
            entryMa40: entryIndex > 0 ? calculateSlope(
              candleData.slice(Math.max(0, entryIndex - 5), entryIndex + 1),
              maPeriods.forty
            ) : 0,
            entryMa360,
            exitMa40: exitIndex > 0 ? calculateSlope(
              candleData.slice(Math.max(0, exitIndex - 5), exitIndex + 1),
              maPeriods.forty
            ) : 0,
            exitMa360
          }
        };
      });

      setBacktestResult(prev => prev ? {
        ...prev,
        trades: updatedTrades
      } : null);
    }
  }, [backtestResult?.trades, maPeriods.threeHundredSixty]);

  // 기울기 계산 함수 추가
  const calculateSlope = (data: ExtendedCandlestickData[], period: number): number => {
    if (data.length < 2) return 0;
    
    const maData = calculateEMA(data, period);
    if (maData.length < 2) return 0;
    
    const last = maData[maData.length - 1].value;
    const prev = maData[maData.length - 2].value;
    
    return ((last - prev) / prev) * 100; // 변화율을 퍼센트로 반환
  };

  // 자동 업데이트 효과
  useEffect(() => {
    const interval: NodeJS.Timeout | null = null;
    let apiTimeout: NodeJS.Timeout | null = null;

    const handleStateChange = async () => {
      try {
        if (isAutoUpdate) {
          // 자동 업데이트 활성화 상태
          console.log('자동 업데이트 활성화');
          
          // 1. 실시간 API 비활성화
          setIsRealtimeAPIEnabled(false);
          
          // 2. 초기 업데이트 실행
          await updatePrices();
          
          // 3. 5초 후 상태 전환
          apiTimeout = setTimeout(() => {
            console.log('자동 업데이트 비활성화 및 실시간 API 활성화');
            setIsAutoUpdate(false);
            setIsRealtimeAPIEnabled(true);
          }, 10000);  // 1초에서 5초로 변경
        } else {
          console.log('자동 업데이트 비활성화');
        }
      } catch (error) {
        console.error('상태 변경 중 오류:', error);
      }
    };

    handleStateChange();

    return () => {
      if (interval) clearInterval(interval);
      if (apiTimeout) clearTimeout(apiTimeout);
    };
  }, [isAutoUpdate, updatePrices]);

  // 자동 업데이트 토글 UI
  <div className="flex items-center space-x-2 mb-4">
    <div className="text-gray-400 text-sm">자동 데이터 업데이트</div>
    <button
      onClick={() => setIsAutoUpdate(!isAutoUpdate)}
      className={`px-3 py-1 rounded ${isAutoUpdate ? 'bg-green-600' : 'bg-gray-600'}`}
    >
      {isAutoUpdate ? '활성화됨' : '비활성화됨'}
    </button>
  </div>


//  }, []); // tradeStrategy 제거

   

  // 시리즈 제거 함수
  const removeSeries = () => {
    if (chartRef.current) {
      // 각 시리즈 제거 전 존재 여부 확인
      if (candleSeriesRef.current) {
        chartRef.current.removeSeries(candleSeriesRef.current);
        candleSeriesRef.current = null;
      }
      
 
      
      if (sixtyEMASeriesRef.current) {
        chartRef.current.removeSeries(sixtyEMASeriesRef.current);
        sixtyEMASeriesRef.current = null;
      }
      
 
      
      if (oneTwentyEMASeriesRef.current) {
        chartRef.current.removeSeries(oneTwentyEMASeriesRef.current);
        oneTwentyEMASeriesRef.current = null;
      }
      if (twoFortyEMASeriesRef.current) {
        chartRef.current.removeSeries(twoFortyEMASeriesRef.current);
        twoFortyEMASeriesRef.current = null;
      }
      if (threeHundredSixtyEMASeriesRef.current) {
        chartRef.current.removeSeries(threeHundredSixtyEMASeriesRef.current);
        threeHundredSixtyEMASeriesRef.current = null;
      }
      
      if (volumeSeriesRef.current) {
        chartRef.current.removeSeries(volumeSeriesRef.current);
        volumeSeriesRef.current = null;
      }
    }
  };

  // cleanup 함수에서 사용
  useEffect(() => {
    // ... 차트 초기화 코드 ...

    return () => {
      try {
        removeSeries();
        if (chartRef.current) {
          chartRef.current.remove();
          chartRef.current = null;
        }
      } catch (error) {
        console.error('차트 정리 중 오류 발생:', error);
      }
    };
  }, []);

  // 차트 생성 시 240MA 시리즈 추가
  useEffect(() => {
    if (chartRef.current) {
      twoFortyEMASeriesRef.current = chartRef.current.addSeries(LineSeries, {
        color: 'rgba(255, 165, 0, 0.8)', // 오렌지색
        lineWidth: 2,
        visible: showMA.twoForty // 가시성 속성 추가
      });
    }
  }, []);

  // showMA 상태가 변경될 때 240MA 가시성 업데이트
  useEffect(() => {
    if (twoFortyEMASeriesRef.current) {
      twoFortyEMASeriesRef.current.applyOptions({
        visible: showMA.twoForty
      });
    }
  }, [showMA.twoForty]);

  // 데이터 업데이트 시 240MA 데이터 설정
  useEffect(() => {
    if (twoFortyEMASeriesRef.current && candleSeriesRef.current) {
      const updatedData = candleSeriesRef.current.data() as ExtendedCandlestickData[];
      const twoFortyEMAData = calculateEMA(updatedData, maPeriods.twoForty);
      twoFortyEMASeriesRef.current.setData(twoFortyEMAData);
    }
  }, [candleSeriesRef, maPeriods.twoForty]);

  // formatTime 함수 추가
  const formatTime = (time: Time): string => {
    if (typeof time === 'number') {
      return new Date(time * 1000).toLocaleString();
    } else if (typeof time === 'object' && time !== null) {
      // BusinessDay 객체인 경우
      const businessDay = time as BusinessDay;
      return new Date(businessDay.year, businessDay.month - 1, businessDay.day).toLocaleDateString();
    }
    return String(time);
  };



  useEffect(() => {
    if (crossPointsRef.current) {
      updateChartMarkers(crossPointsRef.current);
    }
  }, [crossPointsRef.current]);

  // 차트의 timeScale을 직접 조작하여 표시 범위를 1시간으로 설정
  const updateTimeScale = useCallback(async () => {
    if (!chartRef.current) return;

    const timeScale = chartRef.current.timeScale();
        if (!timeScale) return;

    try {
        const now = new Date();
        const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
        
        await timeScale.setVisibleRange({
          from: Math.floor(oneHourAgo.getTime() / 1000) as Time,
          to: Math.floor(now.getTime() / 1000) as Time
        });
      } catch (error) {
      console.error('시간 스케일 업데이트 중 오류:', error);
      }
  }, []);

  // 차트 초기화 및 데이터 업데이트 시 timeScale 업데이트
  useEffect(() => {
    const chart = chartRef.current;
    const candleSeries = candleSeriesRef.current;
    
    if (!chart || !candleSeries) return;

    // 데이터가 로드된 후에만 timeScale 업데이트
    const handleDataLoaded = () => {
      if (candleSeries.data().length > 0) {
        updateTimeScale();
      }
    };

    // 데이터 로드 이벤트 리스너 등록
    chart.subscribeClick(handleDataLoaded);

    // 초기 데이터가 있는 경우 바로 업데이트
    if (candleSeries.data().length > 0) {
      updateTimeScale();
    }

    return () => {
      chart.unsubscribeClick(handleDataLoaded);
    };
  }, [updateTimeScale]);

  // crossPoints 업데이트 시 마커 업데이트
  useEffect(() => {
    if (crossPointsRef.current) {
      updateChartMarkers(crossPointsRef.current);
    }
  }, []);

  // 파일 끝부분에 return 문 추가
  return (
    <div className="w-full min-h-screen p-4 bg-[#1e1e1e] rounded-lg">
      {/* 데이터 로딩 제어 버튼 */}
      <div className="mb-4">
        <div className="bg-gray-800 p-4 rounded-lg flex items-center justify-between">
          <div className="text-gray-400 text-sm">자동 데이터 업데이트</div>
          <div className="flex space-x-4">
            <button
              onClick={handleAutoUpdateToggle}
              className={`px-4 py-2 rounded-lg font-bold ${
                isAutoUpdate 
                  ? 'bg-green-600 hover:bg-green-700' 
                  : 'bg-gray-600 hover:bg-gray-700'
              } text-white`}
            >
              {isAutoUpdate ? '✓ 자동 업데이트' : '자동 업데이트'}
            </button>
            
            <button
              onClick={handleRealtimeAPIToggle}
              className={`px-4 py-2 rounded-lg font-bold ${
                isRealtimeAPIEnabled 
                  ? 'bg-blue-600 hover:bg-blue-700' 
                  : 'bg-gray-600 hover:bg-gray-700'
              } text-white`}
            >
              {isRealtimeAPIEnabled ? '✓ 실시간API업데이트' : '실시간API업데이트'}
            </button>
          </div>
        </div>
      </div>

      {/* 시작 날짜 설정 패널 */}
      <div className="mb-4">
        <div className="bg-gray-800 p-4 rounded-lg">
          <div className="text-gray-400 text-sm mb-2">시작 날짜</div>
          <DatePicker
            selected={dateRange.startDate}
            onChange={(date: Date | null) => {
              if (date) handleDateRangeChange(date);
            }}
            showTimeSelect
            timeFormat="HH:mm"
            timeIntervals={1}
            timeCaption="시간"
            dateFormat="yyyy-MM-dd HH:mm"
            maxDate={new Date()}
            className="bg-gray-700 text-white p-2 rounded w-full"
            popperClassName="react-datepicker-popper"
            popperPlacement="right-start"
            withPortal
            portalId="datepicker-portal"
          />
        </div>
      </div>

      {/* 종료 날짜 설정 패널 */}
      <div className="mb-4">
        <div className="bg-gray-800 p-4 rounded-lg">
          <div className="text-gray-400 text-sm mb-2">종료 날짜</div>
          <DatePicker
            selected={
              dateRange.endDate && dateRange.startDate &&
              dateRange.endDate.getTime() === new Date(dateRange.startDate.getTime() + 30 * 60 * 1000).getTime()
                ? null
                : dateRange.endDate
            }
            onChange={(date: Date | null) => {
              if (date) {
                handleEndDateChange(date);
              }
            }}
            showTimeSelect
            timeFormat="HH:mm"
            timeIntervals={1}
            timeCaption="시간"
            dateFormat="yyyy-MM-dd HH:mm"
            maxDate={new Date()}
            className="bg-gray-700 text-white p-2 rounded w-full"
            popperClassName="react-datepicker-popper"
            popperPlacement="right-start"
            withPortal
            portalId="datepicker-portal"
            placeholderText="종료 날짜 선택"
          />
        </div>
      </div>

      {/* 로딩 프로그레스 바 */}
      {isLoading && (
        <div className="mb-4">
          <div className="text-gray-400 text-sm mb-2">데이터 로딩 중... {progress.toFixed(1)}%</div>
          <div className="w-full bg-gray-700 rounded-full h-2.5">
            <div
              className="bg-blue-600 h-2.5 rounded-full"
              style={{ width: `${progress}%` }}
            ></div>
          </div>
        </div>
      )}

      {/* MA 설정 패널 - 가로 정렬 */}
      <div className="grid grid-cols-3 gap-4 bg-gray-800 p-4 rounded-lg mb-4">
        {/* MA 30 설정 */}
        <div className="bg-gray-700 p-3 rounded-lg">
          <div className="text-gray-400 text-sm mb-2">MA 설정</div>
          <div className="flex items-center space-x-2">
 
   
 
            <button
              onClick={() => updateShowMA('sixty')}
              className={`px-2 py-1 rounded ${showMA.sixty ? 'bg-blue-600' : 'bg-gray-600'}`}
            >
              {showMA.sixty ? '✓ 60MA 보기' : '60MA 숨김'}
            </button>
            <button
              onClick={() => updateShowMA('oneTwenty')}
              className={`px-2 py-1 rounded ${showMA.oneTwenty ? 'bg-blue-600' : 'bg-gray-600'}`}
            >
              {showMA.oneTwenty ? '✓ 120MA 보기' : '120MA 숨김'}
            </button>
          <button
              onClick={() => updateShowMA('twoForty')}
              className={`px-2 py-1 rounded ${showMA.twoForty ? 'bg-blue-600' : 'bg-gray-600'}`}
          >
              {showMA.twoForty ? '✓ 240MA 보기' : '240MA 숨김'}
          </button>
          <button
              onClick={() => updateShowMA('threeHundredSixty')}
              className={`px-2 py-1 rounded ${showMA.threeHundredSixty ? 'bg-blue-600' : 'bg-gray-600'}`}
          >
              {showMA.threeHundredSixty ? '✓ 360MA 보기' : '360MA 숨김'}
          </button>
          </div>
        </div>
      </div>

      {/* 시세 비교 정보 */}
      <div className="grid grid-cols-4 gap-4 mb-4">
        <div className="bg-gray-800 p-4 rounded-lg">
          <div className="text-gray-400 text-sm">Upbit WebSocket 시세</div>
          <div className="text-white text-lg font-bold">
            {currentPrice.toLocaleString()} KRW
          </div>
          <div className="text-gray-400 text-xs">
            마지막 업데이트: {lastUpdated}
          </div>
        </div>
        <div className="bg-gray-800 p-4 rounded-lg">
          <div className="text-gray-400 text-sm">차트 시세</div>
          <div className="text-white text-lg font-bold">
            {chartPrice.toLocaleString()} KRW
          </div>
        </div>
        <div className="bg-gray-800 p-4 rounded-lg">
          <div className="text-gray-400 text-sm">시세 차이</div>
          <div className={`text-lg font-bold ${priceDiff >= 0 ? 'text-green-500' : 'text-red-500'}`}>
            {priceDiff.toLocaleString()} KRW
          </div>
        </div>
        <div className="bg-gray-800 p-4 rounded-lg">
          <div className="text-gray-400 text-sm">시세 차이 (%)</div>
          <div className={`text-lg font-bold ${priceDiff >= 0 ? 'text-green-500' : 'text-red-500'}`}>
            {priceDiffPercentage.toFixed(4)}%
          </div>
        </div>
      </div>

      {/* 차트 제목과 전체화면 버튼 */}
      <div className="flex justify-between items-center mb-4">
        <div className="text-white text-lg font-bold">
          {symbol} {chartType} 차트
        </div>
        <button
          onClick={toggleFullscreen}
          className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded flex items-center"
        >
          {isFullscreen ? (
            <span>⊖ 축소</span>
          ) : (
            <span>⊕ 전체화면</span>
          )}
        </button>
      </div>

      {/* 차트 컨테이너 */}
      <div 
        ref={chartContainerRef}
        className={`relative ${isFullscreen ? 'bg-[#1e1e1e] p-4' : ''}`}
      >
        <div 
          ref={container} 
          id="chart" 
          className="w-full"
          style={{ height: isFullscreen ? '90vh' : `${chartHeight}px` }}
        />
      </div>

      {/* 백테스트 결과 요약 */}
      {backtestResult && (
        <div className="mt-4">
          <div className="text-white text-lg font-bold mb-4">백테스트 결과</div>
          <div className="grid grid-cols-6 gap-4">
          <div className="bg-gray-800 p-4 rounded-lg">
            <div className="text-gray-400 text-sm">총 거래 횟수</div>
            <div className="text-white text-lg font-bold">
              {backtestResult.totalTrades}회
            </div>
          </div>
          <div className="bg-gray-800 p-4 rounded-lg">
              <div className="text-gray-400 text-sm">성공 거래 횟수</div>
            <div className="text-white text-lg font-bold">
              {backtestResult.successfulTrades}회
            </div>
          </div>
          <div className="bg-gray-800 p-4 rounded-lg">
            <div className="text-gray-400 text-sm">성공률</div>
            <div className="text-white text-lg font-bold">
              {backtestResult.successRate.toFixed(2)}%
            </div>
          </div>
          <div className="bg-gray-800 p-4 rounded-lg">
            <div className="text-gray-400 text-sm">총 수익률</div>
            <div className={`text-lg font-bold ${
              backtestResult.totalReturn >= 0 ? 'text-green-500' : 'text-red-500'
            }`}>
              {(backtestResult.totalReturn * 100).toFixed(2)}%
            </div>
          </div>
          <div className="bg-gray-800 p-4 rounded-lg">
              <div className="text-gray-400 text-sm">총 순수익률</div>
            <div className={`text-lg font-bold ${
                backtestResult.totalNetReturn >= 0 ? 'text-green-500' : 'text-red-500'
            }`}>
                {(backtestResult.totalNetReturn * 100).toFixed(2)}%
            </div>
          </div>
            <div className="bg-gray-800 p-4 rounded-lg">
              <div className="text-gray-400 text-sm">평균 수익률</div>
            <div className={`text-lg font-bold ${
                backtestResult.averageReturn >= 0 ? 'text-green-500' : 'text-red-500'
            }`}>
                {(backtestResult.averageReturn * 100).toFixed(2)}%
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* 거래 내역 테이블 수정 */}
      {backtestResult && backtestResult.trades.length > 0 && (
        <div className="mt-4 bg-gray-800 p-4 rounded-lg">
          <div className="text-white text-lg font-bold mb-4">거래 내역</div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-white">
              <thead>
                <tr className="text-gray-400">
                  <th className="px-4 py-2">진입 시간</th>
                  <th className="px-4 py-2">청산 시간</th>
                  <th className="px-4 py-2">진입 가격</th>
                  <th className="px-4 py-2">청산 가격</th>
                  <th className="px-4 py-2">수익률</th>
                  <th className="px-4 py-2">매수 수수료</th>
                  <th className="px-4 py-2">매도 수수료</th>
                  <th className="px-4 py-2">순수익률</th>
                  <th className="px-4 py-2">100만원 투자시 수익</th>
                  <th className="px-4 py-2">100만원 투자시 순수익</th>
                </tr>
              </thead>
              <tbody>
                {backtestResult.trades.map((trade, index) => {
                  const feeRate = 0.0005; // 0.05%
                  const buyFee = feeRate * 100; // 매수 수수료 (%)
                  const sellFee = feeRate * 100; // 매도 수수료 (%)
                  const netReturn = trade.return - (feeRate * 2); // 매수+매도 수수료 차감
                  const profitAmount = 1000000 * trade.return;
                  const netProfitAmount = 1000000 * netReturn;
                  
                  return (
                    <tr key={index} className="border-t border-gray-700">
                      <td className="px-4 py-2">
                        {formatTime(trade.entryTime)}
                      </td>
                      <td className="px-4 py-2">
                        {formatTime(trade.exitTime)}
                      </td>
                      <td className="px-4 py-2">
                        {trade.entryPrice.toLocaleString()}
                      </td>
                      <td className="px-4 py-2">
                        {trade.exitPrice.toLocaleString()}
                      </td>
                      <td className={`px-4 py-2 ${trade.return >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                        {(trade.return * 100).toFixed(2)}%
                      </td>
                      <td className="px-4 py-2 text-red-500">
                        {buyFee.toFixed(2)}%
                      </td>
                      <td className="px-4 py-2 text-red-500">
                        {sellFee.toFixed(2)}%
                      </td>
                      <td className={`px-4 py-2 ${netReturn >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                        {(netReturn * 100).toFixed(2)}%
                      </td>
                      <td className={`px-4 py-2 ${trade.return >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                        {profitAmount.toLocaleString()}원
                      </td>
                      <td className={`px-4 py-2 ${netReturn >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                        {netProfitAmount.toLocaleString()}원
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 차트 높이 조절 패널 */}
      <div className="bg-gray-800 p-4 rounded-lg mb-4">
        <div className="text-gray-400 text-sm mb-2">차트 높이 조절</div>
        <div className="flex items-center space-x-4">
          <input
            type="range"
            min="200"
            max="1000"
            value={chartHeight}
            onChange={(e) => handleHeightChange(parseInt(e.target.value))}
            className="flex-1"
          />
          <div className="text-white font-bold w-20 text-center">{chartHeight}px</div>
        </div>
      </div>

      {/* CSV 다운로드 패널 */}
      <div className="mb-4">
        <div className="bg-gray-800 p-4 rounded-lg">
          <div className="flex items-center justify-between">
            <div className="text-gray-400 text-sm">CSV 다운로드 기간 설정</div>
            <div className="flex space-x-4">
              <div>
                <DatePicker
                  selected={csvDateRange.startDate}
                  onChange={(date: Date | null) => {
                    setCsvDateRange(prev => ({
                      ...prev,
                      startDate: date
                    }));
                  }}
                  showTimeSelect
                  timeFormat="HH:mm"
                  timeIntervals={1}
                  timeCaption="시간"
                  dateFormat="yyyy-MM-dd HH:mm"
                  maxDate={new Date()}
                  className="bg-gray-700 text-white p-2 rounded"
                  popperClassName="react-datepicker-popper"
                  popperPlacement="right-start"
                  withPortal
                  placeholderText="시작 날짜 선택"
                />
              </div>
              <div>
                <DatePicker
                  selected={csvDateRange.endDate}
                  onChange={(date: Date | null) => {
                    setCsvDateRange(prev => ({
                      ...prev,
                      endDate: date
                    }));
                  }}
                  showTimeSelect
                  timeFormat="HH:mm"
                  timeIntervals={1}
                  timeCaption="시간"
                  dateFormat="yyyy-MM-dd HH:mm"
                  maxDate={new Date()}
                  minDate={csvDateRange.startDate || undefined}
                  className="bg-gray-700 text-white p-2 rounded"
                  popperClassName="react-datepicker-popper"
                  popperPlacement="right-start"
                  withPortal
                  placeholderText="종료 날짜 선택"
                />
              </div>
              <div className="flex space-x-2">
                <button
                  onClick={saveToCSV}
                  disabled={csvLoading}
                  className={`px-4 py-2 rounded-lg font-bold ${
                    csvLoading 
                      ? 'bg-gray-600 cursor-not-allowed' 
                      : 'bg-blue-600 hover:bg-blue-700'
                  } text-white`}
                >
                  {csvLoading ? `데이터 가져오는 중... ${csvProgress}%` : '데이터 가져오기'}
                </button>
                <button
                  onClick={() => {
                    if (allData.length > 0) {
                      const header = 'timestamp,open,high,low,close,volume\n';
                      const csvContent = allData
                        .map(candle => {
                          const kstDate = new Date(candle.candle_date_time_kst);
                          const formattedDate = kstDate.toISOString().replace('T', ' ').slice(0, 19);
                          return `${formattedDate},${candle.opening_price},${candle.high_price},${candle.low_price},${candle.trade_price},${candle.candle_acc_trade_volume}`;
                        })
                        .join('\n');
                      
                      const fullContent = header + csvContent;
                      const blob = new Blob([fullContent], { type: 'text/csv;charset=utf-8;' });
                      const url = URL.createObjectURL(blob);
                      const fileName = `${symbol}_${chartType}_${csvDateRange.startDate?.toISOString().slice(0,19)}_${csvDateRange.endDate?.toISOString().slice(0,19)}.csv`;
                      
                      const link = document.createElement('a');
                      link.setAttribute('href', url);
                      link.setAttribute('download', fileName);
                      document.body.appendChild(link);
                      link.click();
                      document.body.removeChild(link);
                      URL.revokeObjectURL(url);
                    } else {
                      alert('먼저 데이터를 가져와주세요.');
                    }
                  }}
                  disabled={csvLoading || allData.length === 0}
                  className={`px-4 py-2 rounded-lg font-bold ${
                    csvLoading || allData.length === 0
                      ? 'bg-gray-600 cursor-not-allowed'
                      : 'bg-green-600 hover:bg-green-700'
                  } text-white`}
                >
                  CSV 다운로드
                </button>
              </div>
            </div>
          </div>
          {/* 로딩 프로그레스 바 */}
          {csvLoading && (
            <div className="mt-4">
              <div className="w-full bg-gray-700 rounded-full h-2.5">
                <div
                  className="bg-blue-600 h-2.5 rounded-full transition-all duration-300"
                  style={{ width: `${csvProgress}%` }}
                ></div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}; 

