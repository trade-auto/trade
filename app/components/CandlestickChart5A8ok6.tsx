import { useEffect, useRef, useState, useCallback } from 'react';
import { useUpbitStore } from '../store/useUpbitStore';
import {
  createChart,
  ColorType,
  DeepPartial,
  ChartOptions,
  CandlestickData,
  LineData,
  Time,
  CandlestickSeries,
  LineSeries,
  IChartApi,
  ISeriesApi,
  SeriesMarker,
  createSeriesMarkers,
  HistogramData,
  HistogramSeries,
  HistogramSeriesPartialOptions,
  HistogramStyleOptions,
  SeriesOptionsCommon,
  SeriesOptions,
} from 'lightweight-charts';
import DatePicker from 'react-datepicker';
import "react-datepicker/dist/react-datepicker.css";
import { getCurrentPrice, get3SecMA } from '../api/upbitOrder';
import { useUpbitWebSocket } from '../hooks/useUpbitWebSocket';
import { ExtendedCandlestickData } from '../types/candlestick';

interface ChartProps {
  symbol: string;
  chartType: string;
  initialAutoUpdate?: boolean;  // 초기 자동 업데이트 상태를 위한 prop 추가
  mode: 'live' | 'test';  // 추가
  handleOrder: (params: {
    market: string;
    side: 'bid' | 'ask';
    volume: string;
    price: string;
    ord_type: string;
    mode: string;
  }) => Promise<void>;
}

interface UpbitCandle {
  candle_date_time_kst: string;
  opening_price: number;
  high_price: number;
  low_price: number;
  trade_price: number;
  candle_acc_trade_volume: number;
}

interface CrossPoint {
  time: Time;
  position: 'buy' | 'sell';
  value: number;
}

interface BacktestResult {
  totalTrades: number;
  successfulTrades: number;
  totalReturn: number;
  successRate: number;
  averageReturn: number;
  trades: Trade[];  // Trade 인터페이스를 사용하도록 변경
}

interface TickerData {
  trade_volume: number;
  trade_price: number;
  opening_price: number;
  high_price: number;
  low_price: number;
  prev_closing_price: number;
  change: string;
  change_price: number;
  change_rate: number;
  signed_change_price: number;
  signed_change_rate: number;
  trade_date: string;
  trade_time: string;
  trade_timestamp: number;
  timestamp: number;
  acc_trade_price: number;
  acc_trade_price_24h: number;
  acc_trade_volume: number;
  acc_trade_volume_24h: number;
  highest_52_week_price: number;
  highest_52_week_date: string;
  lowest_52_week_price: number;
  lowest_52_week_date: string;
  market_state: string;
}

// Define a Trade interface
interface Trade {
  entryTime: Time;
  exitTime: Time;
  entryPrice: number;
  exitPrice: number;
  return: number;
  isSuccess: boolean;
  isAutomatic?: boolean;
  mode: 'test' | 'test-auto' | 'live-auto';  // 'live'를 'live-auto'로 변경
  slopes?: {
    ma30?: number;
    ma40?: number;
    ma60?: number;
    ma120?: number;
    ma360?: number;
  };
}

// 날짜 선택을 위한 인터페이스 추가
interface DateRange {
  startDate: Date;
  endDate: Date | null;
}

// BusinessDay 타입 정의 (일봉, 월봉, 년봉 데이터가 이 형식으로 올 경우)
interface BusinessDay {
  year: number;
  month: number;
  day: number;
}

/**
 * chartType에 따라 초기 날짜 범위를 반환한다.
 * chartType이 "seconds/"이면 최근 10분, "일봉", "월봉", "년봉" 문자열 포함 여부로 처리
 */
const getInitialDateRange = (type: string): DateRange => {
  const now = new Date();
  let startDate: Date;
  
  if (type.startsWith('seconds/')) {
    startDate = new Date(now.getTime() - 30 * 60 * 1000);
  } else if (type === 'minutes/1') {
    startDate = new Date(now.getTime() - 60 * 60 * 1000);
  } else {
    startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  }
  
    return {
    startDate,
    endDate: null
  };
};

/**
 * chartType에 따라 x축의 tick 표시 형식을 반환한다.
 * - 초봉: HH:mm:ss  
 * - 일봉: YYYY.MM.DD HH:mm  
 * - 월봉: YYYY년 M월  
 * - 년봉: YYYY년  
 * - 기본 분봉: HH:mm  
 *
 * 데이터의 시간 값은 timestamp(number) 또는 BusinessDay 객체일 수 있으므로
 * 이를 구분하여 Date 객체로 변환한 후 포맷팅한다.
 */
const getTickMarkFormatter = (chartType: string): ((time: number | BusinessDay, tickMarkType?: any) => string) => {
  return (time: number | BusinessDay): string => {
    let date: Date;
    if (typeof time === "number") {
      // timestamp (초 단위)인 경우
      date = new Date(time * 1000);
    } else {
      // BusinessDay 객체인 경우
      date = new Date(time.year, time.month - 1, time.day);
    }
    if (chartType.indexOf("일봉") !== -1) {
      // 일봉: 날짜와 시간 모두 표시 (예, "2023.10.12 09:30")
      const datePart = date.toLocaleDateString("ko-KR", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      });
      const timePart = date.toLocaleTimeString("ko-KR", {
        hour: "2-digit",
        minute: "2-digit",
      });
      return `${datePart} ${timePart}`;
    } else if (chartType.indexOf("월봉") !== -1) {
      // 월봉: 연도와 월 (예, "2023년 10월")
      return `${date.getFullYear()}년 ${date.getMonth() + 1}월`;
    } else if (chartType.indexOf("년봉") !== -1) {
      // 년봉: 연도만 (예, "2023년")
      return `${date.getFullYear()}년`;
    } else if (chartType.indexOf("seconds") !== -1) {
      // 초봉: HH:mm:ss
      return date.toLocaleTimeString("ko-KR", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });
    } else {
      // 기본적으로 분봉 등: HH:mm
      return date.toLocaleTimeString("ko-KR", {
        hour: "2-digit",
        minute: "2-digit",
      });
    }
  };
};

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
  const threeEMASeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const sixEMASeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const twentyEMASeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const oneTwentyEMASeriesRef = useRef<ISeriesApi<"Line"> | null>(null);  // 추가
  const threeHundredSixtyEMASeriesRef = useRef<ISeriesApi<"Line"> | null>(null);  // 360MA ref 추가
  const lastCandleRef = useRef<CandlestickData<Time> | null>(null);
  const buyMarkerSeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const sellMarkerSeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const crossPointsRef = useRef<CrossPoint[]>([]);
  const volumeSeriesRef = useRef<ISeriesApi<"Histogram"> | null>(null);
  const prevVolumeRef = useRef<number>(0); // 이전 거래량을 저장하기 위한 ref 추가
  const prevTradeTimeRef = useRef<number>(0); // 이전 거래 시간을 저장하기 위한 ref 추가
  const accVolumeRef = useRef<number>(0); // 현재 캔들의 누적 거래량을 저장하기 위한 ref 추가
  const isLoadingRef = useRef<boolean>(false); // 데이터 로딩 상태를 추적하기 위한 ref
  const oldestTimestampRef = useRef<number | null>(null); // 가장 오래된 데이터의 timestamp를 저장하기 위한 ref
  
  const { prices, tickers, updateTradeState, orderLimits, maPeriods, updateMAPeriod, showMA, updateShowMA } = useUpbitStore();
  const [tickerData, setTickerData] = useState<TickerData | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string>('-');
  const [chartPrice, setChartPrice] = useState<number>(0);
  const [backtestResult, setBacktestResult] = useState<BacktestResult | null>(null);
  const [currentPrice, setCurrentPrice] = useState<number>(0);

  // 초기 날짜 범위 상태를 chartType에 따라 설정
  const [dateRange, setDateRange] = useState<DateRange>(getInitialDateRange(chartType));
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [progress, setProgress] = useState<number>(0);
  
  // tradeId를 컴포넌트 레벨 변수로 선언
  const tradeIdRef = useRef<number>(1);

  // 상태 추가
  const [isDataLoadingEnabled, setIsDataLoadingEnabled] = useState<boolean>(false);

  // 자동 업데이트 상태 추가
  const [isAutoUpdate, setIsAutoUpdate] = useState<boolean>(initialAutoUpdate);

  // 매수/매도 신호 생성 로직 수정
  const findCrossPoints = (thirtyEMA: LineData<Time>[], fortyEMA: LineData<Time>[], sixtyEMA: LineData<Time>[]): CrossPoint[] => {
    const crossPoints: CrossPoint[] = [];
    let lastAction: 'buy' | 'sell' | null = null;
    let lastActionTime: number = 0; // 마지막 거래 시간 추적
    
    // 데이터 안정화를 위한 시작 시간 설정 (첫 데이터 + 30초)
    const stabilizationTime = (thirtyEMA[0].time as number) + 30;
    
    // 첫 번째 데이터는 건너뛰고 시작
    for (let i = 1; i < thirtyEMA.length; i++) {
      const prevThirty = thirtyEMA[i - 1].value;
      const currThirty = thirtyEMA[i].value;
      const currSixty = sixtyEMA[i].value;
      const prevSixty = sixtyEMA[i - 1].value;
      const currentTime = thirtyEMA[i].time as number;
      
      // 안정화 시간 이전이면 스킵
      if (currentTime < stabilizationTime) continue;
      
      // 마지막 거래 후 30초가 지나지 않았으면 스킵
      if (currentTime - lastActionTime < 30) continue;
      
      // 매수 조건: 30MA가 60MA를 상향돌파
      if (prevThirty <= prevSixty && currThirty > currSixty && lastAction !== 'buy') {
          crossPoints.push({
            time: thirtyEMA[i].time,
            position: 'buy',
            value: currThirty,
          });
        lastAction = 'buy';
        lastActionTime = currentTime;
        }
      // 매도 조건: 30MA가 60MA를 하향돌파
      else if (prevThirty >= prevSixty && currThirty < currSixty && lastAction !== 'sell') {
        crossPoints.push({
          time: thirtyEMA[i].time,
          position: 'sell',
          value: currThirty,
        });
        lastAction = 'sell';
        lastActionTime = currentTime;
      }
    }
    
    return crossPoints;
  };

  // 마커 생성 함수 수정
  const createTradeMarkers = (crossPoints: CrossPoint[]): SeriesMarker<Time>[] => {
    const markers: SeriesMarker<Time>[] = [];
    let tradeId = 1;
    let inTrade = false;
    let buyPoint: CrossPoint | null = null;
    
    for (let i = 0; i < crossPoints.length; i++) {
      const point = crossPoints[i];
      
      if (!inTrade && point.position === 'buy') {
        // 매수 시작
        buyPoint = point;
        inTrade = true;
        
        markers.push({
          time: point.time,
          position: 'belowBar',
          color: '#26a69a',
          shape: 'arrowUp',
          text: `매수 ${tradeId}`,
          size: 4
        });
      }
      else if (inTrade && point.position === 'sell' && buyPoint) {
        // 매도로 거래 종료
        markers.push({
          time: point.time,
          position: 'aboveBar',
          color: '#ef5350',
          shape: 'arrowDown',
          text: `매도 ${tradeId}`,
          size: 4
        });
        
        inTrade = false;
        buyPoint = null;
        tradeId++;
      }
    }
    
    return markers;
  };

  // MA 기간 변경 핸들러
  const handleMAChange = (type: 'thirty' | 'forty' | 'sixty' | 'oneTwenty' | 'threeHundredSixty', value: number) => {
    updateMAPeriod(type, value);
  };

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

  // 차트 타입에 따른 데이터 개수 결정
  const getChartCount = (type: string) => {
    if (type.startsWith('seconds/')) {
      return 1500; // 초봉 데이터 개수 증가 (330 -> 500)
    }
    const minutes = parseInt(type);
    if (minutes <= 3) return 430;     // 분봉
    if (minutes === 240) return 200;  // 일봉 (200일)
    if (minutes === 7200) return 200; // 월봉 (200개월)
    return 30;                        // 년봉 (30년)
  };

  // 전체 데이터 로드 함수를 먼저 선언
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
        await new Promise(resolve => setTimeout(resolve, 200));
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
      const thirtyEMAData = calculateEMA(formattedData, maPeriods.thirty);
      const fortyEMAData = calculateEMA(formattedData, maPeriods.forty);
      const sixtyEMAData = calculateEMA(formattedData, maPeriods.sixty);
      const oneTwentyEMAData = calculateEMA(formattedData, maPeriods.oneTwenty);
      const threeHundredSixtyEMAData = calculateEMA(formattedData, maPeriods.threeHundredSixty);

      // 각 EMA 시리즈 업데이트
      if (threeEMASeriesRef.current) {
        threeEMASeriesRef.current.setData(thirtyEMAData);
      }
      if (sixEMASeriesRef.current) {
        sixEMASeriesRef.current.setData(fortyEMAData);
      }
      if (twentyEMASeriesRef.current) {
        twentyEMASeriesRef.current.setData(sixtyEMAData);
      }
      if (oneTwentyEMASeriesRef.current) {
        oneTwentyEMASeriesRef.current.setData(oneTwentyEMAData);
      }
      if (threeHundredSixtyEMASeriesRef.current) {
        threeHundredSixtyEMASeriesRef.current.setData(threeHundredSixtyEMAData);
      }
      
      // 거래 신호 업데이트
          const crossPoints = findCrossPoints(thirtyEMAData, fortyEMAData, sixtyEMAData);  // twentyEMAData를 sixtyEMAData로 수정
          crossPointsRef.current = crossPoints;
          
      // 매수/매도 마커 업데이트 추가
          const markers = createTradeMarkers(crossPoints);
          if (candleSeriesRef.current) {
            createSeriesMarkers(candleSeriesRef.current, markers);
        }

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
  }, [symbol, chartType, maPeriods]);

  // 그 다음에 resetAndLoadData 함수 선언
  const resetAndLoadData = useCallback(async (start: Date, end: Date) => {
    // 모든 시리즈 초기화
    if (candleSeriesRef.current) {
      candleSeriesRef.current.setData([]);
    }
    if (volumeSeriesRef.current) {
      volumeSeriesRef.current.setData([]);
    }
    if (threeEMASeriesRef.current) {
      threeEMASeriesRef.current.setData([]);
    }
    if (sixEMASeriesRef.current) {
      sixEMASeriesRef.current.setData([]);
    }
    if (twentyEMASeriesRef.current) {
      twentyEMASeriesRef.current.setData([]);
    }
    if (oneTwentyEMASeriesRef.current) {
      oneTwentyEMASeriesRef.current.setData([]);
    }
    if (threeHundredSixtyEMASeriesRef.current) {
      threeHundredSixtyEMASeriesRef.current.setData([]);
    }

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
        secondsVisible: false,
        tickMarkFormatter: getTickMarkFormatter(chartType),
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
    threeEMASeriesRef.current = createMASeries('#FF0000');  // 30MA
    sixEMASeriesRef.current = createMASeries('#00FF00');    // 40MA
    twentyEMASeriesRef.current = createMASeries('#0000FF'); // 60MA
    oneTwentyEMASeriesRef.current = createMASeries('#FFFF00'); // 120MA
    threeHundredSixtyEMASeriesRef.current = createMASeries('#800080'); // 360MA

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
  }, [loadAllData]);

  // MA 표시 상태 변경 시 업데이트
  useEffect(() => {
    if (!chartRef.current || !candleSeriesRef.current) return;

    const candleData = candleSeriesRef.current.data() as ExtendedCandlestickData[];
    
    // 각 MA 시리즈 업데이트
    if (candleData.length > 0) {
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
  }, [loadAllData]);

  // 실시간 가격 업데이트 처리
  useEffect(() => {
    if (!currentPrice || !candleSeriesRef.current || !lastCandleRef.current || !tickerData) return;

    // WebSocket timestamp 검증
    const timestamp = Math.floor(tickerData.timestamp / 1000);
    if (!timestamp || isNaN(timestamp)) return;  // 유효하지 않은 timestamp 처리

    const lastCandle = lastCandleRef.current;
    const candleSeries = candleSeriesRef.current;
    const volumeSeries = volumeSeriesRef.current;
    
    // 거래량 계산 함수 수정
    const calculateVolume = (currentAccVolume: number, tradeTimestamp: number) => {
      if (!currentAccVolume || isNaN(currentAccVolume)) return 0;
      
      // 이전 거래 시간과 현재 거래 시간이 다르면 새로운 거래로 간주
      if (tradeTimestamp !== prevTradeTimeRef.current) {
        const volume = currentAccVolume - prevVolumeRef.current;
        prevVolumeRef.current = currentAccVolume;
        prevTradeTimeRef.current = tradeTimestamp;
        accVolumeRef.current += volume;
        return accVolumeRef.current;
      }
      
      return accVolumeRef.current;
    };
    
    // 차트 타입에 따른 캔들 간격 계산
    let interval: number;
    if (chartType.startsWith('seconds/')) {
      interval = parseInt(chartType.split('/')[1]);
      // 초봉 차트의 경우 실시간으로 새 캔들 생성
      const currentSecond = timestamp % 60;
      const lastCandleSecond = (lastCandle.time as number) % 60;
      
      // 시간 순서 검증
      if ((lastCandle.time as number) > timestamp) {
        return; // 이전 시간의 데이터는 무시
      }

      if (currentSecond !== lastCandleSecond) {
        // 새로운 캔들 생성시 거래량 초기화
        prevVolumeRef.current = tickerData.acc_trade_volume;
        prevTradeTimeRef.current = timestamp;
        accVolumeRef.current = 0;
        
        // 새로운 캔들 생성
        const newCandle: ExtendedCandlestickData = {
          time: new Date(timestamp * 1000).toISOString(),
          open: lastCandle.close,
          high: currentPrice,
          low: currentPrice,
          close: currentPrice,
          volume: 0 // 새 캔들의 초기 거래량은 0
        };
        
        if (candleSeries) {
          candleSeries.update(newCandle);
          lastCandleRef.current = newCandle;
        }

        // 거래량 업데이트
        if (volumeSeries) {
          const newVolume: HistogramData<Time> = {
            time: timestamp as Time,
            value: 0,
            color: currentPrice >= lastCandle.close ? '#26a69a80' : '#ef535080'
          };
          volumeSeries.update(newVolume);
        }
      } else {
        // 현재 캔들 업데이트
        const volume = calculateVolume(tickerData.acc_trade_volume, timestamp);
        const updatedCandle: ExtendedCandlestickData = {
          ...lastCandle,
          high: Math.max(lastCandle.high, currentPrice),
          low: Math.min(lastCandle.low, currentPrice),
          close: currentPrice,
          volume: volume
        };

        if (candleSeries) {
          candleSeries.update(updatedCandle);
          lastCandleRef.current = updatedCandle;
        }

        // 거래량 업데이트
        if (volumeSeries) {
          const updatedVolume: HistogramData<Time> = {
            time: lastCandle.time,
            value: volume,
            color: currentPrice >= lastCandle.open ? '#26a69a80' : '#ef535080'
          };
          volumeSeries.update(updatedVolume);
        }
      }
    } else {
      interval = parseInt(chartType) * 60; // minutes to seconds
      
      // 현재 시간이 마지막 캔들의 시간 + 간격을 넘었다면 새로운 캔들 생성
      if (timestamp >= (lastCandle.time as number) + interval) {
        // 새로운 캔들 생성시 거래량 초기화
        prevVolumeRef.current = tickerData.acc_trade_volume;
        prevTradeTimeRef.current = timestamp;
        accVolumeRef.current = 0;
        if (dateRange.endDate) {
        loadAllData(dateRange.startDate, dateRange.endDate);
        }
      } else {
        // 현재 캔들 업데이트
        const volume = calculateVolume(tickerData.acc_trade_volume, timestamp);
        const updatedCandle: ExtendedCandlestickData = {
          ...lastCandle,
          high: Math.max(lastCandle.high, currentPrice),
          low: Math.min(lastCandle.low, currentPrice),
          close: currentPrice,
          volume: volume
        };

        if (candleSeries) {
          candleSeries.update(updatedCandle);
          lastCandleRef.current = updatedCandle;
        }

        // 거래량 업데이트
        if (volumeSeries) {
          const updatedVolume: HistogramData<Time> = {
            time: lastCandle.time,
            value: volume,
            color: currentPrice >= lastCandle.open ? '#26a69a80' : '#ef535080'
          };
          volumeSeries.update(updatedVolume);
        }
      }
    }

    setChartPrice(currentPrice);
  }, [currentPrice, tickerData, chartType, loadAllData]);

  // EMA 계산 함수
  const calculateEMA = (data: ExtendedCandlestickData[], period: number): LineData<Time>[] => {
    if (!data || data.length === 0) return [];
    
    const k = 2 / (period + 1);
    let ema = data[0].close;
    
    return data.map(candle => ({
      time: candle.time,
      value: (ema = candle.close * k + ema * (1 - k)),
    }));
  };

  // 백테스팅 결과 계산 함수
  const calculateBacktestResult = (candleData: ExtendedCandlestickData[], crossPoints: CrossPoint[]): BacktestResult => {
    const trades: any[] = [];
    let inTrade = false;
    let entryPoint: CrossPoint | null = null;
    let totalReturn = 0;
    let successfulTrades = 0;

    // 모든 크로스 포인트에 대해 처리
    for (let i = 0; i < crossPoints.length; i++) {
      const point = crossPoints[i];
      
      if (!inTrade && point.position === 'buy') {
        // 매수 진입
        entryPoint = point;
        inTrade = true;
      }
      else if (inTrade && point.position === 'sell' && entryPoint) {
        // 매도 청산
        const returnRate = (point.value - entryPoint.value) / entryPoint.value;
        totalReturn += returnRate;
        
        if (returnRate > 0) successfulTrades++;
        
        trades.push({
          entryTime: entryPoint.time,
          exitTime: point.time,
          entryPrice: entryPoint.value,
          exitPrice: point.value,
          return: returnRate,
          isSuccess: returnRate > 0
        });
        
        inTrade = false;
        entryPoint = null;
      }
    }

    return {
      totalTrades: trades.length,
      successfulTrades,
      totalReturn,
      successRate: trades.length > 0 ? (successfulTrades / trades.length) * 100 : 0,
      averageReturn: trades.length > 0 ? totalReturn / trades.length : 0,
      trades: trades.sort((a, b) => (b.entryTime as number) - (a.entryTime as number)) // 최신 거래가 위로 오도록 정렬
    };
  };

  // 시세 차이 계산
  const priceDiff = currentPrice > 0 && chartPrice > 0 
    ? currentPrice - chartPrice 
    : 0;
  const priceDiffPercentage = currentPrice > 0 && chartPrice > 0
    ? (priceDiff / chartPrice) * 100
    : 0;

  // 거래량 기반 신호 판단 함수
  const evaluateVolumeSignals = (candleData: ExtendedCandlestickData[], currentVolume: number, currentPrice: number): string => {
    const VMA10 = calculateVMA(candleData, 10); // 10봉 평균 거래량
    const lastCandle = candleData[candleData.length - 1];
    const volumeRatio = (currentVolume / VMA10) * 100;

    if (currentVolume >= VMA10 * 2) {
      if (currentPrice > lastCandle.close) {
        return '강한 매수 신호'; // 거래량 급증 + 상승
      } else {
        return '강한 매도 신호'; // 거래량 급증 + 하락
      }
    }

    if (volumeRatio > 150) {
      return '강한 상승 신호'; // VR > 150%
    } else if (volumeRatio < 50) {
      return '약한 매매세력'; // VR < 50%
    }

    return '';
  };

  // VMA 계산 함수
  const calculateVMA = (data: ExtendedCandlestickData[], period: number): number => {
    const volumes = data.slice(-period).map(candle => candle.volume || 0);
    const totalVolume = volumes.reduce((sum, volume) => sum + volume, 0);
    return totalVolume / period;
  };

  // OBV 계산 함수
  const calculateOBV = (data: ExtendedCandlestickData[]): number => {
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
  };

  // 차트 데이터 업데이트 시 거래량 신호 평가
  useEffect(() => {
    if (!candleSeriesRef.current || !volumeSeriesRef.current) return;

    const candleData = candleSeriesRef.current.data() as ExtendedCandlestickData[];
    if (candleData.length === 0) return; // candleData가 비어 있는 경우 처리

    const lastCandle = candleData[candleData.length - 1];
    if (!lastCandle) return; // lastCandle이 undefined인 경우 처리

    const currentVolume = lastCandle.volume || 0;
    const currentPrice = lastCandle.close;

    const volumeSignal = evaluateVolumeSignals(candleData, currentVolume, currentPrice);
    const obv = calculateOBV(candleData);

    console.log('Volume Signal:', volumeSignal);
    console.log('OBV:', obv);

    // 추가적인 로직을 통해 신호를 차트에 표시하거나 백테스팅에 활용할 수 있습니다.
  }, [candleSeriesRef.current, volumeSeriesRef.current]);

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

  // useEffect에서 데이터 로딩 상태 체크 추가
  useEffect(() => {
    if (!isDataLoadingEnabled) return; // 비활성화 상태면 데이터 로딩 중지

    // 기존의 데이터 로딩 로직...
  }, [chartType, symbol, isDataLoadingEnabled]); // isDataLoadingEnabled 의존성 추가

  const loadChartData = useCallback(async () => {
    if (!chartRef.current || !candleSeriesRef.current) return;

    try {
      const endpoint = getChartEndpoint(chartType);
      const count = getChartCount(chartType);
      
      // 현재 시간에서 2시간 후로 설정
      const now = new Date();
      now.setHours(now.getHours() + 2);
      const toTime = now.toISOString();
      
      const response = await fetch(`https://api.upbit.com/v1/candles/${endpoint}?market=${symbol}&count=${count}&to=${toTime}`);
      const data = await response.json();
      
      let candleData: ExtendedCandlestickData[] = [];
      let volumeData: HistogramData<Time>[] = [];

      if (chartType.startsWith('seconds/')) {
        // 초봉 처리 로직 (기존 코드 유지)
        // ...
      } else {
        // 분봉, 일봉, 월봉, 년봉 데이터 처리
        candleData = data.map((item: UpbitCandle) => {
          let timestamp: number;
          const date = new Date(item.candle_date_time_kst);
          
          if (parseInt(chartType) === 240) { // 일봉
            date.setHours(9, 0, 0, 0); // 한국 시장 시작 시간으로 설정
            timestamp = Math.floor(date.getTime() / 1000);
          } else if (parseInt(chartType) === 7200) { // 월봉
            date.setDate(1);
            date.setHours(9, 0, 0, 0);
            timestamp = Math.floor(date.getTime() / 1000);
          } else if (parseInt(chartType) === 86400) { // 년봉
            date.setMonth(0, 1);
            date.setHours(9, 0, 0, 0);
            timestamp = Math.floor(date.getTime() / 1000);
          } else { // 분봉
            timestamp = Math.floor(date.getTime() / 1000) + (2 * 60 * 60);
          }

          return {
            time: timestamp as Time,
            open: item.opening_price,
            high: item.high_price,
            low: item.low_price,
            close: item.trade_price,
            volume: item.candle_acc_trade_volume
          };
        }).reverse();

        // volumeData도 동일한 시간 처리 적용
        volumeData = data.map((item: UpbitCandle) => {
          let timestamp: number;
          const date = new Date(item.candle_date_time_kst);
          
          if (parseInt(chartType) === 240) { // 일봉
            date.setHours(9, 0, 0, 0);
            timestamp = Math.floor(date.getTime() / 1000);
          } else if (parseInt(chartType) === 7200) { // 월봉
            date.setDate(1);
            date.setHours(9, 0, 0, 0);
            timestamp = Math.floor(date.getTime() / 1000);
          } else if (parseInt(chartType) === 86400) { // 년봉
            date.setMonth(0, 1);
            date.setHours(9, 0, 0, 0);
            timestamp = Math.floor(date.getTime() / 1000);
          } else { // 분봉
            timestamp = Math.floor(date.getTime() / 1000) + (2 * 60 * 60);
          }

          return {
            time: timestamp as Time,
            value: item.candle_acc_trade_volume,
            color: item.trade_price >= item.opening_price ? '#26a69a80' : '#ef535080'
          };
        }).reverse();
      }

      // 마지막 캔들 저장
      lastCandleRef.current = candleData[candleData.length - 1];

      // 이동평균 계산
      const threeEMAData = calculateEMA(candleData, maPeriods.thirty);
      const sixEMAData = calculateEMA(candleData, maPeriods.forty);
      const twentyEMAData = calculateEMA(candleData, maPeriods.sixty);

      // 크로스 포인트 찾기
      const crossPoints = findCrossPoints(threeEMAData, sixEMAData, twentyEMAData);
      crossPointsRef.current = crossPoints;

      // 데이터 설정
      candleSeriesRef.current.setData(candleData);
      if (volumeSeriesRef.current) {
        volumeSeriesRef.current.setData(volumeData);
      }
      if (threeEMASeriesRef.current) {
        threeEMASeriesRef.current.setData(threeEMAData);
      }
      if (sixEMASeriesRef.current) {
        sixEMASeriesRef.current.setData(sixEMAData);
      }
      if (twentyEMASeriesRef.current) {
        twentyEMASeriesRef.current.setData(twentyEMAData);
      }

      // 매수/매도 마커 업데이트
      const markers = createTradeMarkers(crossPoints);
      if (candleSeriesRef.current) {
        createSeriesMarkers(candleSeriesRef.current, markers);
      }

      // 백테스팅 결과 업데이트
      const result = calculateBacktestResult(candleData, crossPoints);
      setBacktestResult(result);

      // 마지막 가격 설정
      setChartPrice(candleData[candleData.length - 1].close);

    } catch (error) {
      console.error('Error loading chart data:', error);
    }
  }, [chartType, symbol, maPeriods]);

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

      // KST 시간을 UTC로 변환하여 API 요청 (10시간(36000000ms) 땡겨줌)
      const kstStart = new Date(csvDateRange.startDate.getTime() + 9 * 60 * 60 * 1000);
      const kstEnd = new Date(csvDateRange.endDate.getTime() + 9 * 60 * 60 * 1000);
      const utcStart = new Date(kstStart.getTime() );//- 10 * 60 * 60 * 1000);
      const utcEnd = new Date(kstEnd.getTime() );//- 10 * 60 * 60 * 1000);

      // 데이터 로딩 시작
      setCsvProgress(20);
      
      // API 요청 준비
      const count = 200;
      let tempData: any[] = [];
      let currentDate = utcEnd;
      
      while (currentDate >= utcStart) {
        setCsvProgress(Math.min(90, (tempData.length / 1000) * 100));
        
        const apiUrl = `https://api.upbit.com/v1/candles/minutes/1?market=${symbol}&to=${currentDate.toISOString()}&count=${count}`;
        
        try {
          const response = await fetch(apiUrl);
          
          if (!response.ok) {
            throw new Error(`API 요청 실패: ${response.status}`);
          }

          const data = await response.json();
          if (!data || data.length === 0) break;

          tempData = [...tempData, ...data];
          currentDate = new Date(data[data.length - 1].candle_date_time_kst);
          
          setAllData(tempData);
          await new Promise(resolve => setTimeout(resolve, 1000));
        } catch (apiError) {
          console.error('API 호출 오류:', apiError);
          await new Promise(resolve => setTimeout(resolve, 2000));
          continue;
        }
      }

      // 데이터 필터링 (KST 기준)
      const filteredData = tempData
        .sort((a, b) => new Date(a.candle_date_time_kst).getTime() - new Date(b.candle_date_time_kst).getTime())
        .filter(candle => {
          const candleTime = new Date(candle.candle_date_time_kst);
          return candleTime >= kstStart && candleTime <= kstEnd;
        });

      if (filteredData.length === 0) {
        throw new Error('선택한 기간의 데이터가 없습니다.');
      }

      setAllData(filteredData);
      setCsvProgress(100);

    } catch (error: any) {
      console.error('CSV 다운로드 중 오류:', error);
      alert(`데이터 다운로드 중 오류: ${error?.message || '알 수 없는 오류가 발생했습니다.'}`);
    } finally {
      setCsvLoading(false);
      setCsvProgress(0);
    }
  };

  // 컴포넌트 상단에 상태 추가
  const [allData, setAllData] = useState<any[]>([]);

  // useEffect 수정
  useEffect(() => {
    if (!isAutoUpdate) return;

    const updateInterval = setInterval(async () => {
      try {
        const now = new Date();
        const thirtyMinutesAgo = new Date(now.getTime() - 30 * 60 * 1000);
        
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

  // 날짜 초기화 함수 추가
  const resetDate = useCallback(() => {
    const initialDateRange = getInitialDateRange(chartType);
    setDateRange(initialDateRange);
    if (initialDateRange.startDate) {
      const endTime = new Date(initialDateRange.startDate.getTime() + 30 * 60 * 1000);
      resetAndLoadData(initialDateRange.startDate, endTime);
    }
  }, [chartType, resetAndLoadData]);

  // 상태 변수 추가
  const [ma3Price, setMa3Price] = useState<number | null>(null);
  const [lastTradeType, setLastTradeType] = useState<'bid' | 'ask' | null>(null);

  // 기존 useEffect 수정
  useEffect(() => {
    if (mode === 'test' && currentPrice && ma3Price) {
      const now = new Date();
      const currentTime = now.toLocaleTimeString('ko-KR', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      });

      // 매수 조건 (현재가가 3MA보다 0.1% 이상 하락)
      if (currentPrice < ma3Price * 0.999) {
        if (lastTradeType === null) {
          // 매수 마커 추가 및 거래 상태 업데이트
          updateTradeState({
            lastTradeType: 'bid',
            statusChangeTime: currentTime,
            currentPrice: currentPrice,
            actionStartTime: now,
            isTrading: true
          });
          // 기존 마커 추가 로직...
        }
      }
      // 매도 조건 (현재가가 3MA보다 0.1% 이상 상승)
      else if (currentPrice > ma3Price * 1.001) {
        if (lastTradeType === 'bid') {
          // 매도 마커 추가 및 거래 상태 업데이트
          updateTradeState({
            lastTradeType: 'ask',
            statusChangeTime: currentTime,
            currentPrice: currentPrice,
            actionStartTime: now,
            isTrading: true
          });
          // 기존 마커 추가 로직...
        }
      }
    }
  }, [currentPrice, ma3Price, lastTradeType, mode]);

  // 상태 변수 추가
  const [tradeCycles, setTradeCycles] = useState<{ cycle: string[], times: string[], time: string }[]>([]);

  // 매매 사이클 업데이트 함수 수정
  const updateTradeCycle = (status: string) => {
    const currentTime = new Date().toLocaleTimeString('ko-KR', { 
      hour: '2-digit', 
      minute: '2-digit', 
      second: '2-digit' 
    });
    
    setTradeCycles((prev: { cycle: string[], times: string[], time: string }[]) => {
      const lastCycle = prev[0] || { cycle: [], times: [], time: currentTime };
      
      // 새로운 사이클 시작
      if (status === '매수 대기' || (lastCycle.cycle.length === 4)) {
        return [{ 
          cycle: [status], 
          times: [currentTime], // 새 사이클의 첫 시간 기록
          time: currentTime 
        }, ...prev].slice(0, 5);
      }

      // 현재 사이클에 상태 추가 (기존 시간들은 유지)
      if (lastCycle.cycle.length < 4) {
        const updatedCycle = {
          cycle: [...lastCycle.cycle, status],
          times: [...lastCycle.times, currentTime], // 새로운 상태의 시간만 추가
          time: lastCycle.time // 사이클의 시작 시간은 유지
        };
        return [updatedCycle, ...prev.slice(1)];
      }

      return prev;
    });
  };

  // 매수/매도 마커 업데이트 로직
  useEffect(() => {
    if (!mode || !currentPrice || !ma3Price) return;

    const { missedFirstCycle, lastTradeType, isTrading } = useUpbitStore.getState().tradeState;
    const now = new Date();
    const currentTime = now.toLocaleTimeString('ko-KR', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });

    // 매수/매도 신호 감지 및 주문 실행
    const checkAndExecuteOrder = async () => {
      try {
        if (currentPrice < ma3Price * 0.999) {

       
          // 매수 조건
          if ((missedFirstCycle && lastTradeType === 'ask') || (!missedFirstCycle && lastTradeType === null)) {
            console.log('handleOrder 실행:');
            await handleOrder({
              market: symbol,
              side: 'bid',
              volume: calculateOrderVolume(currentPrice),
              price: currentPrice.toString(),
              ord_type: 'limit',
              mode: mode
            });

            // 매수 성공 후 상태 업데이트
            updateTradeState({
              lastTradeType: 'bid',
              statusChangeTime: currentTime,
              currentPrice: currentPrice,
              actionStartTime: now,
              isTrading: true,
              theoreticalPosition: 'bid',
              missedFirstCycle: false
            });
          }
        } else if (currentPrice > ma3Price * 1.001 && lastTradeType === 'bid') {
          // 매도 조건
          await handleOrder({
            market: symbol,
            side: 'ask',
            volume: calculateOrderVolume(currentPrice),
            price: currentPrice.toString(),
            ord_type: 'limit',
            mode: mode
          });

          // 매도 성공 후 상태 업데이트
          updateTradeState({
            lastTradeType: 'ask',
            statusChangeTime: currentTime,
            currentPrice: currentPrice,
            actionStartTime: now,
            isTrading: true,
            theoreticalPosition: 'ask'
          });
        } else {
          // 대기 상태 업데이트
          updateTradeState({
            theoreticalPosition: 'wait'
          });
        }
      } catch (error) {
        console.error('주문 실행 실패:', error);
      }
    };

    // // 데이터가 준비되었을 때만 실행
    // if (isTrading && !isLoadingRef.current) {
    //   checkAndExecuteOrder();
    // }
  }, [currentPrice, ma3Price, mode]);

  // 상태 추가
  const [volume, setVolume] = useState<string>('');

  // 주문 수량 계산 함수
  const calculateOrderVolume = (price: number) => {
    if (price <= 0) return '0';
    const amount = orderLimits.maxOrderPrice * 0.25; // 최대 주문 금액의 25%
    return (amount / price).toFixed(4);
  };

  // Define the OrderDetails interface
  interface OrderDetails {
    market: string;
    side: 'bid' | 'ask';
    volume: string;
    price: string;
    ord_type: string;
    mode: string;
  }

  // Ensure only one declaration of executeOrder exists
  const executeOrder = (orderDetails: OrderDetails) => {
    console.log('주문 실행:', orderDetails);
    // 주문 실행 로직
    // ...

    // 주문 내역 업데이트
    setOrderHistory((prevHistory) => [
      ...prevHistory,
      {
        time: new Date(),
        side: orderDetails.side === 'bid' ? 'buy' : 'sell',
        price: orderDetails.price,
        volume: orderDetails.volume,
      },
    ]);

    console.log('주문 내역 업데이트:', orderHistory);
  };

  // Define the Order interface if not already defined
  interface Order {
    time: Date;
    side: 'buy' | 'sell';
    price: string;
    volume: string;
  }

  // Update the OrderHistory component to use the Order type
  const OrderHistory: React.FC<{ orderHistory: Order[] }> = ({ orderHistory }) => (
    <div>
      {orderHistory.map((order, index) => (
        <div key={index}>
          <span>{order.time.toLocaleString()}</span>
          <span>{order.side}</span>
          <span>{order.price}</span>
          <span>{order.volume}</span>
        </div>
      ))}
    </div>
  );

  // 가격 정보 업데이트 함수
  useEffect(() => {
    let interval: NodeJS.Timeout;

    const updatePrices = async () => {
      if (isLoadingRef.current) return; // 이미 로딩 중이면 스킵
      
      try {
        isLoadingRef.current = true;
        const [current, ma3] = await Promise.all([
          getCurrentPrice(symbol),
          get3SecMA(symbol)
        ]);
        
        if (current && ma3) {
          setCurrentPrice(current);
          setMa3Price(ma3);
        }
      } catch (error) {
        console.error('가격 업데이트 중 오류:', error);
      } finally {
        isLoadingRef.current = false;
      }
    };

    // 초기 업데이트
    updatePrices();
    
    // 자동 업데이트가 활성화된 경우에만 인터벌 설정
    if (isAutoUpdate) {
      interval = setInterval(updatePrices, 3000); // 3초마다 업데이트
    }

    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [symbol, isAutoUpdate]); // isAutoUpdate 의존성 추가

  // 웹소켓 토글 핸들러 수정
  const handleWebSocketToggle = () => {
    if (!isWebSocketEnabled) {
      setIsAutoUpdate(false);
      let currentCandle: ExtendedCandlestickData | null = null;
      let candleStartTime: number = 0;
      let candleHistory: ExtendedCandlestickData[] = [];

      connectWebSocket([symbol], (data) => {
        if (candleSeriesRef.current && data.type === 'trade') {
          const tradeData = {
            time: Math.floor(data.timestamp / 1000) as Time,
            open: data.trade_price,
            high: data.trade_price,
            low: data.trade_price,
            close: data.trade_price,
            volume: data.trade_volume
          };

          // 실시간 캔들스틱 업데이트 (진행 중인 캔들만 업데이트)
          candleSeriesRef.current.update(tradeData);
          
          // 거래량 업데이트
          if (volumeSeriesRef.current) {
            volumeSeriesRef.current.update({
              time: Math.floor(data.timestamp / 1000) as Time,
              value: data.trade_volume,
              color: data.trade_price >= (lastCandleRef.current?.close ?? 0)
                ? 'rgba(38, 166, 154, 0.5)'
                : 'rgba(239, 83, 80, 0.5)'
            });
          }

          // MA 업데이트 (진행 중인 캔들의 일부로만 처리)
          candleHistory.push(tradeData);
          if (candleHistory.length > Math.max(maPeriods.thirty, maPeriods.forty, maPeriods.sixty)) {
            candleHistory.shift();
          }

          const updateMA = () => {
            if (candleHistory.length > 0) {
              if (threeEMASeriesRef.current) {
                const ma30 = calculateEMA(candleHistory, maPeriods.thirty);
                threeEMASeriesRef.current.update(ma30[ma30.length - 1]);
              }
              if (sixEMASeriesRef.current) {
                const ma40 = calculateEMA(candleHistory, maPeriods.forty);
                sixEMASeriesRef.current.update(ma40[ma40.length - 1]);
              }
              if (twentyEMASeriesRef.current) {
                const ma60 = calculateEMA(candleHistory, maPeriods.sixty);
                twentyEMASeriesRef.current.update(ma60[ma60.length - 1]);
              }
            }
          };

          updateMA();
          lastCandleRef.current = tradeData;
          setCurrentPrice(data.trade_price);

          const threeEMAData = calculateEMA(candleHistory, maPeriods.thirty);
          const sixEMAData = calculateEMA(candleHistory, maPeriods.forty);
          const twentyEMAData = calculateEMA(candleHistory, maPeriods.sixty);
          const crossPoints = findCrossPoints(threeEMAData, sixEMAData, twentyEMAData);
          crossPointsRef.current = crossPoints;
          const markers = createTradeMarkers(crossPoints);
          if (candleSeriesRef.current) {
            updateTradeMarkers(candleSeriesRef.current, markers);
            
            // 가장 최근 크로스 포인트 확인
            const lastCrossPoint = crossPoints[crossPoints.length - 1];
            if (lastCrossPoint && lastCrossPoint.time === Math.floor(data.timestamp / 1000)) {
              console.log('크로스 포인트 감지:', lastCrossPoint.position);
              
              // CreateOrder 컴포넌트의 handㄹleAutomaticTrade 함수 호출
              handleOrder({
                market: symbol,
                side: lastCrossPoint.position === 'buy' ? 'bid' : 'ask',
                volume: calculateOrderVolume(data.trade_price),
                price: data.trade_price.toString(),
                ord_type: 'limit',
                mode: mode
              });
            }
          }
        }
      });
    } else {
      disconnectWebSocket();
    }
    setIsWebSocketEnabled(!isWebSocketEnabled);
  };

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
  const { connectWebSocket, disconnectWebSocket, setOnCandleComplete } = useUpbitWebSocket();

  // useEffect 내에서 tickers 변경 감지
  useEffect(() => {
    const currentTicker = tickers[symbol];
    if (currentTicker) {
      setTickerData(currentTicker);
      setLastUpdated(new Date().toLocaleString());
    }
  }, [tickers, symbol]);

  // new: 캔들 완료 처리 함수 (완료된 캔들을 누적 업데이트)
  const handleCompletedCandle = (newCandle: ExtendedCandlestickData) => {
    // 기존 완료된 캔들 데이터 취득 (없다면 빈 배열)
    const existingData = candleSeriesRef.current?.data() as ExtendedCandlestickData[] || [];

    // 새 캔들을 누적
    const updatedData = [...existingData, newCandle];
    candleSeriesRef.current?.setData(updatedData);

    // EMA 재계산
    const threeEMAData = calculateEMA(updatedData, maPeriods.thirty);
    const sixEMAData = calculateEMA(updatedData, maPeriods.forty);
    const twentyEMAData = calculateEMA(updatedData, maPeriods.sixty);

    threeEMASeriesRef.current?.setData(threeEMAData);
    sixEMASeriesRef.current?.setData(sixEMAData);
    twentyEMASeriesRef.current?.setData(twentyEMAData);

    // 크로스 포인트(매수/매도 신호) 계산 및 마커 업데이트
    const crossPoints = findCrossPoints(threeEMAData, sixEMAData, twentyEMAData);
    crossPointsRef.current = crossPoints;
    const markers = createTradeMarkers(crossPoints);
    if (candleSeriesRef.current) {
      createSeriesMarkers(candleSeriesRef.current, markers);
    }

    // 백테스팅 결과 업데이트
    const result = calculateBacktestResult(updatedData, crossPoints);
    setBacktestResult(result);
  };

  // WebSocket에서 캔들 완료 시 호출하는 콜백 등록:
  useEffect(() => {
    setOnCandleComplete((completedCandle: ExtendedCandlestickData) => {
      handleCompletedCandle(completedCandle);
    });
  }, [setOnCandleComplete, handleCompletedCandle]);

  // 마커 업데이트 함수 추가
  const updateTradeMarkers = (candleSeries: ISeriesApi<"Candlestick">, markers: SeriesMarker<Time>[]) => {
    try {
      // 마커 업데이트 전에 차트 다시 그리기
      const currentData = [...candleSeries.data()];
      candleSeries.setData([]);
      candleSeries.setData(currentData);
      
      // 새로운 마커 추가
      if (markers.length > 0) {
        createSeriesMarkers(candleSeries, markers);
      }
      
    } catch (error) {
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
              const threeEMAData = calculateEMA(updatedData, maPeriods.thirty);
              const sixEMAData = calculateEMA(updatedData, maPeriods.forty);
              const twentyEMAData = calculateEMA(updatedData, maPeriods.sixty);
              const oneTwentyEMAData = calculateEMA(updatedData, maPeriods.oneTwenty);
              threeEMASeriesRef.current?.setData(threeEMAData);
              sixEMASeriesRef.current?.setData(sixEMAData);
              twentyEMASeriesRef.current?.setData(twentyEMAData);
              oneTwentyEMASeriesRef.current?.setData(oneTwentyEMAData);
              // 크로스 포인트 및 마커 업데이트
              const crossPoints = findCrossPoints(threeEMAData, sixEMAData, twentyEMAData);
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

  const [orderHistory, setOrderHistory] = useState<Order[]>([]);


  // 컴포넌트 마운트 시 테스트 주문 실행
  useEffect(() => {
    const testHandleOrder = async () => {
      console.log('테스트 주문 시작');
      try {
        await handleOrder({
          market: symbol,
          side: 'bid', // 테스트용 매수 주문
          volume: '0.0001',
          price: '30000000',
          ord_type: 'limit',
          mode: mode
        });
        console.log('테스트 주문 전달 완료');
      } catch (error) {
        console.error('테스트 주문 실패:', error);
      }
    };

    // 컴포넌트 마운트 시 즉시 실행
    // testHandleOrder();/
  }, []); // 빈 의존성 배열로 마운트 시 한 번만 실행

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

    removeSeries(threeEMASeriesRef.current);
    removeSeries(sixEMASeriesRef.current);
    removeSeries(twentyEMASeriesRef.current);
    removeSeries(oneTwentyEMASeriesRef.current);
    removeSeries(threeHundredSixtyEMASeriesRef.current);

    // 새 시리즈 추가
    if (showMA.thirty) {
      threeEMASeriesRef.current = chartRef.current.addSeries(LineSeries);
      threeEMASeriesRef.current.applyOptions({
        color: '#FF0000',  // 빨간색
        lineWidth: 2,
      });
    }
    if (showMA.forty) {
      sixEMASeriesRef.current = chartRef.current.addSeries(LineSeries);
      sixEMASeriesRef.current.applyOptions({
        color: '#00FF00',  // 초록색
        lineWidth: 2,
      });
    }
    if (showMA.sixty) {
      twentyEMASeriesRef.current = chartRef.current.addSeries(LineSeries);
      twentyEMASeriesRef.current.applyOptions({
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
      if (showMA.thirty) {
        const thirtyEMA = calculateEMA(candleData, maPeriods.thirty);
        threeEMASeriesRef.current?.setData(thirtyEMA);
      }
      if (showMA.forty) {
        const fortyEMA = calculateEMA(candleData, maPeriods.forty);
        sixEMASeriesRef.current?.setData(fortyEMA);
      }
      if (showMA.sixty) {
        const sixtyEMA = calculateEMA(candleData, maPeriods.sixty);
        twentyEMASeriesRef.current?.setData(sixtyEMA);
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
      if (showMA.threeHundredSixty && threeHundredSixtyEMASeriesRef.current) {
        const threeHundredSixtyEMA = calculateEMA(candleData, maPeriods.threeHundredSixty);
        threeHundredSixtyEMASeriesRef.current.setData(threeHundredSixtyEMA);
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

  // 기울기 계산 함수
  const calculateSlopes = useCallback((candleData: ExtendedCandlestickData[]) => {
    if (candleData.length < 2) return null;
    
    const ma360 = calculateEMA(candleData, maPeriods.threeHundredSixty);
    return {
      ma360: ma360[ma360.length - 1].value - ma360[ma360.length - 2].value
    };
  }, [maPeriods]);

  // 거래 생성 시 기울기 저장
  const handleNewTrade = useCallback((trade: Trade) => {
    if (candleSeriesRef.current) {
      const candleData = candleSeriesRef.current.data() as ExtendedCandlestickData[];
      const slopes = calculateSlopes(candleData);
      
      return {
        ...trade,
        slopes: slopes || {
          ma360: 0
        }
      };
    }
    return trade;
  }, [calculateSlopes]);

  // 백테스트 결과 업데이트 시 기울기 저장
  useEffect(() => {
    if (backtestResult?.trades && candleSeriesRef.current) {
      const candleData = candleSeriesRef.current.data() as ExtendedCandlestickData[];
      
      // 각 거래별로 해당 시점의 기울기 계산
      const updatedTrades = backtestResult.trades.map(trade => {
        const tradeTime = trade.entryTime as number;
        const tradeCandleData = candleData.filter(d => (d.time as number) <= tradeTime);
        
        if (tradeCandleData.length > 0) {
          const slopes = calculateSlopes(tradeCandleData);
          return {
            ...trade,
            slopes: slopes || trade.slopes
          };
        }
        return trade;
      });

      setBacktestResult(prev => prev ? {
        ...prev,
        trades: updatedTrades
      } : null);
    }
  }, [backtestResult?.trades, calculateSlopes]);

  // 자동 업데이트 효과
  useEffect(() => {
    if (isAutoUpdate && candleSeriesRef.current) {
      const candleData = candleSeriesRef.current.data() as ExtendedCandlestickData[];
      
      // MA 업데이트
      if (candleData.length > 0) {
        // 120MA 업데이트
        if (showMA.oneTwenty && oneTwentyEMASeriesRef.current) {
          const oneTwentyEMA = calculateEMA(candleData, maPeriods.oneTwenty);
          oneTwentyEMASeriesRef.current.setData(oneTwentyEMA);
        }

        // 360MA 업데이트
        if (showMA.threeHundredSixty && threeHundredSixtyEMASeriesRef.current) {
          const threeHundredSixtyEMA = calculateEMA(candleData, maPeriods.threeHundredSixty);
          threeHundredSixtyEMASeriesRef.current.setData(threeHundredSixtyEMA);
        }
      }
    }
  }, [isAutoUpdate, candleData, showMA, maPeriods]);

  // 자동 업데이트 토글 UI
  <div className="flex items-center space-x-2 mb-4">
    <div className="text-gray-400 text-sm">자동 데이터 업데이트</div>
    <button
      onClick={() => setIsAutoUpdate(!isAutoUpdate)}
      className={`px-3 py-1 rounded ${
        isAutoUpdate ? 'bg-green-600' : 'bg-gray-600'
      }`}
    >
      {isAutoUpdate ? '활성화됨' : '비활성화됨'}
    </button>
  </div>

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
              {isAutoUpdate ? '자동 업데이트 활성화됨' : '자동 업데이트 비활성화됨'}
            </button>
            
            <button
              onClick={handleWebSocketToggle}
              className={`px-4 py-2 rounded-lg font-bold ${
                isWebSocketEnabled 
                  ? 'bg-purple-600 hover:bg-purple-700' 
                  : 'bg-gray-600 hover:bg-gray-700'
              } text-white`}
            >
              {isWebSocketEnabled ? '실시간 데이터 활성화됨' : '실시간 데이터 비활성화됨'}
            </button>
            
            <button
              onClick={handleRealtimeAPIToggle}
              className={`px-4 py-2 rounded-lg font-bold ${
                isRealtimeAPIEnabled 
                  ? 'bg-blue-600 hover:bg-blue-700' 
                  : 'bg-gray-600 hover:bg-gray-700'
              } text-white`}
            >
              {isRealtimeAPIEnabled ? '실시간API업데이트 활성화됨' : '실시간API업데이트 비활성화됨'}
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

      {/* MA 설정 패널 */}
      <div className="grid grid-cols-3 gap-4 mb-4">
        <div className="bg-gray-800 p-4 rounded-lg">
          <div className="text-gray-400 text-sm mb-2">MA 30 기간</div>
          <div className="flex items-center space-x-4">
            <input
              type="range"
              min="10"
              max="100"
              value={maPeriods.thirty}
              onChange={(e) => handleMAChange('thirty', parseInt(e.target.value))}
              className="flex-1"
            />
            <div className="text-white font-bold w-12 text-center">{maPeriods.thirty}</div>
            <button
              onClick={() => updateShowMA('thirty')}
              className={`px-3 py-1 rounded ${showMA.thirty ? 'bg-blue-600' : 'bg-gray-600'}`}
            >
              {showMA.thirty ? '숨기기' : '보이기'}
            </button>
          </div>
        </div>
        <div className="bg-gray-800 p-4 rounded-lg">
          <div className="text-gray-400 text-sm mb-2">MA 40 기간</div>
          <div className="flex items-center space-x-4">
            <input
              type="range"
              min="10"
              max="100"
              value={maPeriods.forty}
              onChange={(e) => handleMAChange('forty', parseInt(e.target.value))}
              className="flex-1"
            />
            <div className="text-white font-bold w-12 text-center">{maPeriods.forty}</div>
            <button
              onClick={() => updateShowMA('forty')}
              className={`px-3 py-1 rounded ${showMA.forty ? 'bg-blue-600' : 'bg-gray-600'}`}
            >
              {showMA.forty ? '숨기기' : '보이기'}
            </button>
          </div>
        </div>
        <div className="bg-gray-800 p-4 rounded-lg">
          <div className="text-gray-400 text-sm mb-2">MA 60 기간</div>
          <div className="flex items-center space-x-4">
            <input
              type="range"
              min="10"
              max="100"
              value={maPeriods.sixty}
              onChange={(e) => handleMAChange('sixty', parseInt(e.target.value))}
              className="flex-1"
            />
            <div className="text-white font-bold w-12 text-center">{maPeriods.sixty}</div>
            <button
              onClick={() => updateShowMA('sixty')}
              className={`px-3 py-1 rounded ${showMA.sixty ? 'bg-blue-600' : 'bg-gray-600'}`}
            >
              {showMA.sixty ? '숨기기' : '보이기'}
            </button>
          </div>
        </div>
        <div className="bg-gray-800 p-4 rounded-lg">
          <div className="text-gray-400 text-sm mb-2">MA 120 기간</div>
          <div className="flex items-center space-x-4">
            <input
              type="range"
              min="60"
              max="200"
              value={maPeriods.oneTwenty}
              onChange={(e) => handleMAChange('oneTwenty', parseInt(e.target.value))}
              className="flex-1"
            />
            <div className="text-white font-bold w-12 text-center">{maPeriods.oneTwenty}</div>
            <button
              onClick={() => updateShowMA('oneTwenty')}
              className={`px-3 py-1 rounded ${showMA.oneTwenty ? 'bg-blue-600' : 'bg-gray-600'}`}
            >
              {showMA.oneTwenty ? '숨기기' : '보이기'}
            </button>
          </div>
        </div>
      </div>

      {/* MA 시리즈 ref 추가/수정 */}
      <div className="bg-gray-800 p-4 rounded-lg">
        <div className="text-gray-400 text-sm mb-2">MA 360 기간</div>
        <div className="flex items-center space-x-4">
          <input
            type="range"
            min="200"
            max="500"
            value={maPeriods.threeHundredSixty}
            onChange={(e) => handleMAChange('threeHundredSixty', parseInt(e.target.value))}
            className="flex-1"
          />
          <div className="text-white font-bold w-12 text-center">{maPeriods.threeHundredSixty}</div>
          <button
            onClick={() => updateShowMA('threeHundredSixty')}
            className={`px-3 py-1 rounded ${showMA.threeHundredSixty ? 'bg-blue-600' : 'bg-gray-600'}`}
          >
            {showMA.threeHundredSixty ? '숨기기' : '보이기'}
          </button>
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

      {/* 백테스팅 결과 표시 */}
      {backtestResult && (
        <div className="grid grid-cols-5 gap-4 mt-4">
          <div className="bg-gray-800 p-4 rounded-lg">
            <div className="text-gray-400 text-sm">총 거래 횟수</div>
            <div className="text-white text-lg font-bold">
              {backtestResult.totalTrades}회
            </div>
          </div>
          <div className="bg-gray-800 p-4 rounded-lg">
            <div className="text-gray-400 text-sm">성공 거래</div>
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
            <div className="text-gray-400 text-sm">평균 수익률</div>
            <div className={`text-lg font-bold ${
              backtestResult.averageReturn >= 0 ? 'text-green-500' : 'text-red-500'
            }`}>
              {(backtestResult.averageReturn * 100).toFixed(2)}%
            </div>
          </div>
          <div className="bg-gray-800 p-4 rounded-lg col-span-5">
            <div className="text-gray-400 text-sm">100만원 투자 시 누적 수익</div>
            <div className={`text-lg font-bold ${
              backtestResult.totalReturn >= 0 ? 'text-green-500' : 'text-red-500'
            }`}>
              {((1000000 * (1 + backtestResult.totalReturn)) - 1000000).toLocaleString()}원
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
                  <th className="px-4 py-2">진입 가격 (3MA)</th>
                  <th className="px-4 py-2">매수 가격</th>
                  <th className="px-4 py-2">청산 가격 (3MA)</th>
                  <th className="px-4 py-2">매도 가격</th>
                  <th className="px-4 py-2">수익률</th>
                  <th className="px-4 py-2">100만원 투자시 수익</th>
                  <th className="px-4 py-2">체결 상태</th>
                  <th className="px-4 py-2">거래 모드</th>
                  <th className="px-4 py-2">360MA 기울기</th>
                </tr>
              </thead>
              <tbody>
                {backtestResult.trades.map((trade, index) => {
                  const profitAmount = 1000000 * trade.return;
                  const currentTime = new Date().getTime() / 1000;
                  const exitTime = trade.exitTime as number;
                  const showStatus = exitTime > currentTime;
                  
                  return (
                    <tr key={index} className="border-t border-gray-700">
                      <td className="px-4 py-2">
                        {new Date((trade.entryTime as number) * 1000).toLocaleString()}
                      </td>
                      <td className="px-4 py-2">
                        {new Date(exitTime * 1000).toLocaleString()}
                      </td>
                      <td className="px-4 py-2">{trade.entryPrice.toLocaleString()}</td>
                      <td className="px-4 py-2">{(trade.entryPrice * 1.0).toLocaleString()}</td>
                      <td className="px-4 py-2">{trade.exitPrice.toLocaleString()}</td>
                      <td className="px-4 py-2">{(trade.exitPrice * 1.0).toLocaleString()}</td>
                      <td className={`px-4 py-2 ${trade.return >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                        {(trade.return * 100).toFixed(2)}%
                      </td>
                      <td className={`px-4 py-2 ${trade.return >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                        {profitAmount.toLocaleString()}원
                      </td>
                      <td className={`px-4 py-2 ${
                        showStatus ? (
                          !exitTime 
                            ? 'text-yellow-500' 
                            : trade.return >= 0 
                              ? 'text-red-500' 
                              : 'text-blue-500'
                        ) : ''
                      }`}>
                        {showStatus ? (!exitTime ? '미체결' : '체결완료') : ''}
                      </td>
                      <td className="px-4 py-2">
                        <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                          trade.mode === 'live-auto' 
                            ? 'bg-red-500 text-white'
                            : trade.mode === 'test-auto'
                              ? 'bg-green-500 text-white'
                              : 'bg-blue-500 text-white'
                        }`}>
                          {trade.mode === 'live-auto' 
                            ? '실전자동' 
                            : trade.mode === 'test-auto'
                              ? '테스트 자동'
                              : '테스트'}
                        </span>
                      </td>
                      <td className={`px-4 py-2 ${
                        (trade.slopes?.ma360 ?? 0) > 0 ? 'text-green-500' : 'text-red-500'
                      }`}>
                        {trade.slopes?.ma360?.toFixed(4) || '-'}
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