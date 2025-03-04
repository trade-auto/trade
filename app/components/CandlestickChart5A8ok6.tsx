import { useEffect, useRef, useState, useCallback } from 'react';
import debug from 'debug';
const log = debug('trade:orders');
//import { useUpbitStore, TradeStrategy } from '../store/useUpbitStore';
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
import { findCrossPoints, CrossPoint, TradingStrategyConfig } from '../utils/tradingStrategy';
import { checkAndExecuteOrder, calculateOrderVolume, executeOrder, OrderDetails, TradeStateUpdate } from '../utils/orderExecutor';

// 기존 imports 아래, interfaces 선언부 위에 추가
//type TradeStrategy = 'BOLLINGER' | 'MA_CROSS' | 'MA_CROSS_DEVIATION' | 'SLOPE_FILTER';
export type TradeStrategy = 'BOLLINGER' | 'MA_CROSS' | 'MA_CROSS_DEVIATION' | 'SLOPE_FILTER';


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

interface BacktestResult {
  totalTrades: number;
  successfulTrades: number;
  totalReturn: number;
  totalNetReturn: number; // 수수료 제외 총 수익률 추가
  successRate: number;
  averageReturn: number;
  averageNetReturn: number; // 수수료 제외 평균 수익률 추가
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
  angles?: {
    entryMa40?: number;
    exitMa40?: number;
    entryMa360?: number;
    exitMa360?: number;
    entryMa120?: number;
    exitMa120?: number;
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
    // 초봉: 최근 1시간 데이터
    startDate = new Date(now.getTime() - 60 * 60 * 1000); // 30분 -> 1시간
  } else if (type === 'minutes/1') {
    // 1분봉: 최근 2시간 데이터
    startDate = new Date(now.getTime() - 2 * 60 * 60 * 1000);
  } else {
    // 일봉: 최근 1일 데이터
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
 
  const sixtyEMASeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
 
  const oneTwentyEMASeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const twoFortyEMASeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const threeHundredSixtyEMASeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  
  const lastCandleRef = useRef<CandlestickData<Time> | null>(null);
  const buyMarkerSeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const sellMarkerSeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const crossPointsRef = useRef<CrossPoint[]>([]);
  const volumeSeriesRef = useRef<ISeriesApi<"Histogram"> | null>(null);
  const prevVolumeRef = useRef<number>(0); // 이전 거래량을 저장하기 위한 ref 추가
  const prevTradeTimeRef = useRef<number>(0); // 이전 거래 시간을 저장하기 위한 ref 추가
  const accVolumeRef = useRef<number>(0); // 현재 캔들의 누적 거래량을 저장하기 위한 ref
  const isLoadingRef = useRef<boolean>(false); // 데이터 로딩 상태를 추적하기 위한 ref
  const oldestTimestampRef = useRef<number | null>(null); // 가장 오래된 데이터의 timestamp를 저장하기 위한 ref
  
  // 초기 매수 여부를 컴포넌트 상태에서 가져옴
  const [isFirstBuy, setIsFirstBuy] = useState<boolean>(true);
  
  const { prices, tickers, updateTradeState, orderLimits, maPeriods, updateMAPeriod, showMA, updateShowMA } = useUpbitStore();
  const [tickerData, setTickerData] = useState<TickerData | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string>('-');
  const [chartPrice, setChartPrice] = useState<number>(0);
  const [backtestResult, setBacktestResult] = useState<BacktestResult | null>(null);
  const [currentPrice, setCurrentPrice] = useState<number>(0);
  const [ma3Price, setMa3Price] = useState<number | null>(0); // 3초 이동평균 가격 추가
  
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
  const findCrossPointsWrapper = (sixtyEMA: LineData<Time>[], oneTwentyEMA: LineData<Time>[], twoFortyEMA: LineData<Time>[]): CrossPoint[] => {
    // 필요한 MA 데이터 가져오기
    const ma360Data = threeHundredSixtyEMASeriesRef.current?.data() as LineData<Time>[];
    
    // 설정값 정의
    const config: TradingStrategyConfig = {
      minTimeBetweenTrades: 30,
      conditionDurationThreshold: 10
    };
    
    // 유틸리티 함수 호출
    return findCrossPoints(
      sixtyEMA,
      oneTwentyEMA,
      twoFortyEMA,
      ma360Data,
      isFirstBuy,
      config
    );
  };

  // checkAndExecuteOrder 함수 대체
  // 기존 checkAndExecuteOrder 함수를 제거하고 아래 코드로 대체
  const checkAndExecuteOrderWrapper = async () => {
    try {
      if (!mode || !currentPrice || !ma3Price) return;

      const { missedFirstCycle, lastTradeType, isTrading } = useUpbitStore.getState().tradeState;
      const now = new Date();
      const currentTime = now.toLocaleTimeString('ko-KR', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      });

      console.log(`주문 실행 조건 확인: currentPrice=${currentPrice}, ma3Price=${ma3Price}, isFirstBuy=${isFirstBuy}, lastTradeType=${lastTradeType}`);
      
      // 유틸리티 함수 호출
      const orderDecision = checkAndExecuteOrder(
        crossPointsRef.current,
        currentPrice,
        ma3Price,
        isFirstBuy,
        lastTradeType
      );
      
      if (orderDecision && orderDecision.shouldExecute) {
        // 주문 상세 정보 생성
        const orderDetails: OrderDetails = {
          market: symbol,
          side: orderDecision.side,
          volume: calculateOrderVolume(orderDecision.price),
          price: orderDecision.price.toString(),
          ord_type: 'limit',
          mode: mode
        };
        
        // 주문 실행
        try {
          await executeOrder(orderDetails);
          
          // 주문 처리 및 상태 업데이트
          await handleOrder(orderDetails);
          
          // 현재 시간 정보
          const now = new Date();
          const currentTime = now.toLocaleTimeString('ko-KR', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
          });
          
          // 거래 상태 업데이트
          updateTradeState({
            lastTradeType: orderDetails.side === 'bid' ? 'bid' : 'ask',
            statusChangeTime: currentTime,
            currentPrice: parseFloat(orderDetails.price),
            actionStartTime: now,
            isTrading: true,
            theoreticalPosition: orderDetails.side === 'bid' ? 'bid' : 'ask',
            missedFirstCycle: false
          });
          
          // 초기 매수 완료 표시
          if (isFirstBuy && orderDetails.side === 'bid') {
            setIsFirstBuy(false);
          }
        } catch (error) {
          console.error('주문 실행 중 오류:', error);
        }
      }
    } catch (error) {
      console.error('주문 실행 실패:', error);
    }
  };

  // 컴포넌트 레벨에서 tradeStrategy 가져오기
  const { tradeStrategy } = useUpbitStore();

  // 새로운 각도 계산 함수 - 360MA 전용 (정규화)
  const calculateAngleNormalized = (ma: LineData<Time>[], index: number): number => {
    if (!ma || !ma[index] || index < 5) return 0;
    
    // 5개 데이터 포인트 사용 (현재 포인트와 이전 4개 포인트)
    const points = ma.slice(Math.max(0, index - 4), index + 1);
    const startPoint = points[0];
    const endPoint = points[points.length - 1];
    
    // x축은 시간 차이를 분 단위로 변환
    const dx = ((endPoint.time as number) - (startPoint.time as number)) / 60;
    // y축은 가격 차이
    const dy = endPoint.value - startPoint.value;
    
    // 각도 계산 (라디안에서 도로 변환)
    const angle = Math.atan2(dy, dx) * (180 / Math.PI);
    
    // -90도에서 90도 사이로 정규화
    return ((angle + 180) % 180) - 90;
  };

  // 새로운 각도 계산 함수 - 40MA 전용 (원시 각도)
  const calculateAngleRaw = (ma: LineData<Time>[], index: number): number => {
    if (!ma || !ma[index] || index < 5) return 0;
    const points = ma.slice(Math.max(0, index - 4), index + 1);
    const startPoint = points[0];
    const endPoint = points[points.length - 1];
    const dx = ((endPoint.time as number) - (startPoint.time as number)) / 60;
    const dy = endPoint.value - startPoint.value;
    return Math.atan2(dy, dx) * (180 / Math.PI);
  };
  //const THRESHOLD_ANGLE_40 = 5;
 //const THRESHOLD_ANGLE_40_MINUS = -5;

 //SKY
 // 최소 기울기 임계값
const MIN_SLOPE_THRESHOLD = 2; 
const MAX_SLOPE_THRESHOLD = 5;
// 360MA 관련 임계값
const THRESHOLD_ANGLE_360 = MAX_SLOPE_THRESHOLD;        // 360MA 매수 기준: 기울기가 5도 이상일 때
const THRESHOLD_ANGLE_360_MINUS = -MIN_SLOPE_THRESHOLD; // 360MA 매도 기준: 기울기가 -2도 이하일 때

// 40MA 관련 임계값
const THRESHOLD_ANGLE_40 = MAX_SLOPE_THRESHOLD;         // 40MA 매수 기준: 기울기가 5도 이상일 때
const THRESHOLD_ANGLE_40_MINUS = -MIN_SLOPE_THRESHOLD;  // 40MA 매도 기준: 기울기가 -2도 이하일 때

// 60MA 관련 임계값 추가
const THRESHOLD_ANGLE_60 = MAX_SLOPE_THRESHOLD;         // 60MA 매수 기준: 기울기가 5도 이상일 때
const THRESHOLD_ANGLE_60_MINUS = -MIN_SLOPE_THRESHOLD;  // 60MA 매도 기준: 기울기가 -2도 이하일 때

// 120MA 관련 임계값 추가
const THRESHOLD_ANGLE_120 = MAX_SLOPE_THRESHOLD;        // 120MA 매수 기준: 기울기가 5도 이상일 때
const THRESHOLD_ANGLE_120_MINUS = -MIN_SLOPE_THRESHOLD; // 120MA 매도 기준: 기울기가 -2도 이하일 때
 
 // 파일 상단에 상수 추가
const THRESHOLD_ANGLE_60_PLUS = THRESHOLD_ANGLE_60;  // 또는 원하는 값(예: 2)으로 설정
const THRESHOLD_ANGLE_120_PLUS = THRESHOLD_ANGLE_120;
  
  // 다른 상태 변수들... 360MA와 120MA의 기울기가 각각 2도 이상일 때만 매매 신호 발생
 
  // 40MA의 특정 각도(5도 이상) 이상 지속 시간을 초 단위로 계산하는 함수,
  // 5초 미만이면 0을 반환하여 5초 이상 지속되는 경우에만 표시
  // const getSustainedDuration = (ma: LineData<Time>[], index: number, threshold: number): number => {
  //   if (!ma || index < 0) return 0;
  //   let startIndex = index;
  //   for (let j = index; j >= 0; j--) {
  //     const angle = calculateAngleRaw(ma, j);
  //     if (angle >= threshold) {
  //       startIndex = j;
  //     } else {
  //       break;
  //     }
  //   }
  //   const duration = (ma[index].time as number) - (ma[startIndex].time as number);
  //   return duration >= 1 ? duration : 0; // 5초 미만이면 0으로 처리
  // };

  const createTradeMarkers = (crossPoints: CrossPoint[], strategy: TradeStrategy): SeriesMarker<Time>[] => {
    return crossPoints.map(point => ({
          time: point.time,
      position: point.position === 'buy' ? 'belowBar' : 'aboveBar',
      color: point.position === 'buy' ? '#2196F3' : '#e91e63',
      shape: point.position === 'buy' ? 'arrowUp' : 'arrowDown',
      text: point.position === 'buy' ? '매수' : '매도',
          size: 2
    }));
  };

  // MA 기간 변경 핸들러
  const handleMAChange = (type:   'sixty' | 'oneTwenty' | 'twoForty' | 'threeHundredSixty', value: number) => {
    updateMAPeriod(type, value);
    
    // MA 데이터 업데이트
    if (candleSeriesRef.current) {
      const candleData = candleSeriesRef.current.data() as ExtendedCandlestickData[];
      
      if (type === 'sixty' && sixtyEMASeriesRef.current) {
        const sixtyEMAData = calculateEMA(candleData, value);
        sixtyEMASeriesRef.current.setData(sixtyEMAData);
      } else if (type === 'oneTwenty' && oneTwentyEMASeriesRef.current) {
        const oneTwentyEMAData = calculateEMA(candleData, value);
        oneTwentyEMASeriesRef.current.setData(oneTwentyEMAData);
      } else if (type === 'twoForty' && twoFortyEMASeriesRef.current) {
        const twoFortyEMAData = calculateEMA(candleData, value);
        twoFortyEMASeriesRef.current.setData(twoFortyEMAData);
      } else if (type === 'threeHundredSixty' && threeHundredSixtyEMASeriesRef.current) {
        const threeHundredSixtyEMAData = calculateEMA(candleData, value);
        threeHundredSixtyEMASeriesRef.current.setData(threeHundredSixtyEMAData);
      }
    }
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
      return 1500; // 초봉 데이터 개수 증가 (330 -> 500) 1500
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
      const crossPoints = findCrossPoints(sixtyEMAData, oneTwentyEMAData, twoFortyEMAData, threeHundredSixtyEMAData, isFirstBuy);
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
  }, [symbol, chartType, maPeriods, tradeStrategy, isFirstBuy]);

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
  }, [loadAllData]);

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
  }, [loadAllData]);

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
  const calculateEMA = (data: ExtendedCandlestickData[], period: number): LineData<Time>[] => {
    if (!data || data.length === 0 || period <= 0) return [];
    
    const emaData: LineData<Time>[] = [];
    let multiplier = 2 / (period + 1);
    let initialSMA = 0;
    
    // 유효한 데이터만 필터링
    const validData = data.filter(item => item && item.close !== undefined);
    
    if (validData.length === 0) return [];
    
    // 초기 SMA 계산
    for (let i = 0; i < Math.min(period, validData.length); i++) {
      initialSMA += validData[i].close;
    }
    initialSMA /= Math.min(period, validData.length);
    
    // 첫 번째 EMA는 SMA와 동일
    if (validData.length > 0) {
      emaData.push({
        time: validData[0].time,
        value: initialSMA
      });
    }
    
    // 나머지 EMA 계산
    for (let i = 1; i < validData.length; i++) {
      const previousEMA = emaData[i - 1].value;
      const currentEMA = (validData[i].close - previousEMA) * multiplier + previousEMA;
      
      emaData.push({
        time: validData[i].time,
        value: currentEMA
      });
    }
    
    return emaData;
  };

  // 백테스트 결과 계산 함수 수정
  const calculateBacktestResult = (candleData: ExtendedCandlestickData[], crossPoints: CrossPoint[]): BacktestResult => {
    const trades: Trade[] = [];
    let buyPoint: CrossPoint | null = null;
    
    // 수수료율 변경 (0.1% -> 0.05%)
    const feeRate = 0.0005; // 0.05%
    
    for (let i = 0; i < crossPoints.length; i++) {
      const point = crossPoints[i];
      
      if (point.position === 'buy') {
        buyPoint = point;
      } else if (point.position === 'sell' && buyPoint) {
        // 360MA 위에 있으면 매도 신호 무시 (백테스트에서도 적용)
        if (point.isAbove360MA) {
          console.log(`Backtest: SELL signal ignored at ${new Date((point.time as number) * 1000).toLocaleTimeString()} - price is above 360MA`);
          continue; // 다음 포인트로 넘어감
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
            //entryMa40: buyPoint.slopes.ma40,
            entryMa360: buyPoint.slopes.ma360,
            //exitMa40: point.slopes.ma40,
            exitMa360: point.slopes.ma360,
            entryMa120: buyPoint.slopes.ma120,
            exitMa120: point.slopes.ma120
          }
        });
        
        buyPoint = null;
      }
    }

    // 나머지 코드는 동일...
    const totalTrades = trades.length;
    const successfulTrades = trades.filter(trade => trade.isSuccess).length;
    
    // 수수료 제외 총 수익률 (매수+매도 수수료 고려)
    const totalReturn = trades.reduce((sum, trade) => sum + trade.return, 0);
    
    // 수수료 포함 순수익률 계산 (각 거래마다 매수+매도 수수료 차감)
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
 
      const sixtyEMAData = calculateEMA(candleData, maPeriods.sixty);
      const oneTwentyEMAData = calculateEMA(candleData, maPeriods.oneTwenty);
      const twoFortyEMAData = calculateEMA(candleData, maPeriods.twoForty);
      const threeHundredSixtyEMAData = calculateEMA(candleData, maPeriods.threeHundredSixty);

      // 크로스 포인트 찾기
      const crossPoints = findCrossPoints(sixtyEMAData, oneTwentyEMAData, twoFortyEMAData, threeHundredSixtyEMAData, isFirstBuy);
      crossPointsRef.current = crossPoints;

      // 데이터 설정
      candleSeriesRef.current.setData(candleData);
      if (volumeSeriesRef.current) {
        volumeSeriesRef.current.setData(volumeData);
      }
 
      if (sixtyEMASeriesRef.current) {
        sixtyEMASeriesRef.current.setData(sixtyEMAData);
      }
      if (oneTwentyEMASeriesRef.current) {
        oneTwentyEMASeriesRef.current.setData(oneTwentyEMAData);
      }
      if (twoFortyEMASeriesRef.current) {
        twoFortyEMASeriesRef.current.setData(twoFortyEMAData);
      }
      if (threeHundredSixtyEMASeriesRef.current) {
        threeHundredSixtyEMASeriesRef.current.setData(threeHundredSixtyEMAData);
      }

      // 매수/매도 마커 업데이트
      const markers = createTradeMarkers(crossPoints, tradeStrategy);
      if (candleSeriesRef.current) {
        try {
          // 마커 설정
        createSeriesMarkers(candleSeriesRef.current, markers);
        } catch (error) {
          console.error('마커 업데이트 실패:', error);
        }
      }

      // 백테스트 결과 업데이트
      const result = calculateBacktestResult(candleData, crossPoints);
      setBacktestResult(result);

      // 마지막 가격 설정
      setChartPrice(candleData[candleData.length - 1].close);

    } catch (error) {
      console.error('Error loading chart data:', error);
    }
  }, [chartType, symbol, maPeriods, tradeStrategy, isFirstBuy]);

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

      // 날짜 변환 로직 수정 - 한국 시간(KST)으로 명시적 변환
      const startDate = new Date(csvDateRange.startDate);
      const endDate = new Date(csvDateRange.endDate);
      
      // 사용자가 선택한 정확한 시간 범위를 유지
      
      // 브라우저의 로컬 시간을 KST로 변환 (KST = UTC+9)
      // 브라우저 시간대와 KST 간의 차이를 계산 (분 단위)
      const browserTimezoneOffset = new Date().getTimezoneOffset(); // 브라우저의 시간대 오프셋 (분 단위, UTC 기준)
      const kstOffsetMinutes = -540; // KST는 UTC+9 (9시간 = 540분 앞섬)
      const offsetDiffMinutes = kstOffsetMinutes - browserTimezoneOffset; // 브라우저 시간대와 KST의 차이 (분 단위)
      
      // 브라우저 시간을 KST로 변환
      const startDateKST = new Date(startDate.getTime() + offsetDiffMinutes * 60 * 1000);
      const endDateKST = new Date(endDate.getTime() + offsetDiffMinutes * 60 * 1000);
      
      // KST 시간을 문자열로 변환 (YYYY-MM-DDThh:mm:ss 형식)
      const formatToKSTString = (date: Date) => {
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}T${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}:${String(date.getSeconds()).padStart(2, '0')}`;
      };
      
      const startDateKSTStr = formatToKSTString(startDateKST);
      const endDateKSTStr = formatToKSTString(endDateKST);
      
      // 시간 문자열 형식 (YYYY-MM-DDThh:mm:ss)
      const startDateStr = startDateKSTStr;
      const endDateStr = endDateKSTStr;
      
      // 디버깅을 위한 로깅
      console.log('시간대 변환 정보:', {
        브라우저시간대: browserTimezoneOffset,
        KST오프셋: kstOffsetMinutes,
        시간차이: offsetDiffMinutes,
        원본시간: {
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString()
        },
        KST변환시간: {
          startDateKST: startDateKST.toISOString(),
          endDateKST: endDateKST.toISOString(),
          startDateKSTStr,
          endDateKSTStr
        }
      });
      
      // KST 시간을 UTC로 변환 (API 요청용)
      const startDateUTC = new Date(startDateKST.getTime() - (9 * 60 * 60 * 1000));
      const endDateUTC = new Date(endDateKST.getTime() - (9 * 60 * 60 * 1000));
      
      console.log('CSV 다운로드 시작 - 날짜 범위:', {
        원본: {
          startDate: csvDateRange.startDate?.toISOString(),
          endDate: csvDateRange.endDate?.toISOString()
        },
        브라우저시간대: browserTimezoneOffset,
        KST오프셋: kstOffsetMinutes,
        시간차이: offsetDiffMinutes,
        KST변환: {
          startDateKST: startDateKST.toISOString(),
          endDateKST: endDateKST.toISOString(),
          startDateKSTStr,
          endDateKSTStr
        },
        필터링용: {
          startDateStr,
          endDateStr
        },
        UTC변환: {
          startDateUTC: startDateUTC.toISOString(),
          endDateUTC: endDateUTC.toISOString()
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
      let tempData: any[] = [];
      
      // 종료일부터 시작하여 과거로 거슬러 올라가는 방식
      let currentDate = new Date(endDateUTC); // UTC 시간 사용
      let retryCount = 0;
      const MAX_RETRIES = 3;
      const MAX_REQUESTS = 50; // 최대 API 요청 횟수 제한
      let requestCount = 0;
      
      while (currentDate >= startDateUTC && retryCount < MAX_RETRIES && requestCount < MAX_REQUESTS) {
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
      
      // 필터링 적용 (KST 기준)
      const finalData = sortedData.filter(candle => {
        // candle_date_time_kst는 'YYYY-MM-DDThh:mm:ss' 형식의 문자열
        // 업비트 API에서 반환하는 candle_date_time_kst는 이미 KST 시간이지만
        // 형식이 'YYYY-MM-DDThh:mm:ss'이므로 직접 비교하기 어려움
        
        // 업비트 API의 candle_date_time_kst 형식을 startDateStr, endDateStr과 동일한 형식으로 변환
        // 예: '2025-03-03T22:03:00+09:00' -> '2025-03-03T22:03:00'
        const kstDateStr = candle.candle_date_time_kst.split('+')[0];
        
        // 디버깅을 위한 로깅 (처음 몇 개 항목만)
        if (sortedData.indexOf(candle) < 5) {
          console.log(`필터링 비교: API=${kstDateStr}, 시작=${startDateStr}, 종료=${endDateStr}, 범위내=${kstDateStr >= startDateStr && kstDateStr <= endDateStr}`);
        }
        
        // 문자열 비교로 범위 확인
        const isInRange = kstDateStr >= startDateStr && kstDateStr <= endDateStr;
        
        return isInRange;
      });

      // 디버깅을 위한 로깅
      if (sortedData.length > 0) {
        const firstCandle = sortedData[0];
        const lastCandle = sortedData[sortedData.length - 1];
        const firstCandleTime = new Date(firstCandle.candle_date_time_kst);
        const lastCandleTime = new Date(lastCandle.candle_date_time_kst);
        
        console.log('데이터 시간 범위 확인:', {
          첫데이터시간: firstCandleTime.toISOString(),
          마지막데이터시간: lastCandleTime.toISOString(),
          필터시작시간: startDate.toISOString(),
          필터종료시간: endDate.toISOString(),
          필터링전데이터수: sortedData.length,
          필터링후데이터수: finalData.length
        });
      }

      console.log(`필터링 후 데이터: ${finalData.length}개, 필터링 전: ${sortedData.length}개`);
      
      if (finalData.length === 0) {
        console.error('필터링 후 데이터가 없음. 필터링 전 데이터:', {
          sortedDataLength: sortedData.length,
          firstItemKST: sortedData.length > 0 ? new Date(sortedData[0].candle_date_time_kst).toISOString() : null,
          lastItemKST: sortedData.length > 0 ? new Date(sortedData[sortedData.length - 1].candle_date_time_kst).toISOString() : null,
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

    } catch (error: any) {
      console.error('CSV 다운로드 중 오류:', error);
      console.error('오류 세부 정보:', {
        name: error?.name,
        message: error?.message,
        stack: error?.stack
      });
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
        const thirtyMinutesAgo = new Date(now.getTime() - 2*60 * 60 * 1000); //sky
        
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
        console.log(`주문 실행 조건 확인: currentPrice=${currentPrice}, ma3Price=${ma3Price}, isFirstBuy=${isFirstBuy}, lastTradeType=${lastTradeType}`);
        
        // 초기 매수 조건 확인 (crossPoints에서 매수 신호가 있는지)
        if (isFirstBuy && crossPointsRef.current.length > 0) {
          const lastCrossPoint = crossPointsRef.current[crossPointsRef.current.length - 1];
          if (lastCrossPoint.position === 'buy') {
            console.log('초기 매수 신호 감지 - handleOrder 실행:');
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
            
            // 초기 매수 완료 표시
            setIsFirstBuy(false);
            return; // 초기 매수 후 함수 종료
          }
        }
        
        // 기존 매수/매도 로직
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
          setMa3Price(ma3);
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
          if (candleHistory.length > Math.max(maPeriods.sixty, maPeriods.oneTwenty, maPeriods.twoForty, maPeriods.threeHundredSixty)) {
            candleHistory.shift();
          }

          const updateMA = () => {
            if (candleHistory.length > 0) {
 
              if (sixtyEMASeriesRef.current) {
                const ma60 = calculateEMA(candleHistory, maPeriods.sixty);
                sixtyEMASeriesRef.current.update(ma60[ma60.length - 1]);
              }
              if (oneTwentyEMASeriesRef.current) {
                const ma120 = calculateEMA(candleHistory, maPeriods.oneTwenty);
                oneTwentyEMASeriesRef.current.update(ma120[ma120.length - 1]);
              }
              if (twoFortyEMASeriesRef.current) {
                const ma240 = calculateEMA(candleHistory, maPeriods.twoForty);
                twoFortyEMASeriesRef.current.update(ma240[ma240.length - 1]);
              } 
              if (threeHundredSixtyEMASeriesRef.current) {
                const ma360 = calculateEMA(candleHistory, maPeriods.threeHundredSixty);
                threeHundredSixtyEMASeriesRef.current.update(ma360[ma360.length - 1]);
              }
            }
          };

          updateMA();
          lastCandleRef.current = tradeData;
          setCurrentPrice(data.trade_price);

 
          const sixtyEMAData = calculateEMA(candleHistory, maPeriods.sixty);
          const oneTwentyEMAData = calculateEMA(candleHistory, maPeriods.oneTwenty);
          const twoFortyEMAData = calculateEMA(candleHistory, maPeriods.twoForty);
          const threeHundredSixtyEMAData = calculateEMA(candleHistory, maPeriods.threeHundredSixty);
          const crossPoints = findCrossPoints(sixtyEMAData, oneTwentyEMAData, twoFortyEMAData, threeHundredSixtyEMAData, isFirstBuy);
          crossPointsRef.current = crossPoints;
          const markers = createTradeMarkers(crossPoints, tradeStrategy);
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
 
 
    const sixtyEMAData = calculateEMA(updatedData, maPeriods.sixty);
    const oneTwentyEMAData = calculateEMA(updatedData, maPeriods.oneTwenty);
    const twoFortyEMAData = calculateEMA(updatedData, maPeriods.twoForty);
    const threeHundredSixtyEMAData = calculateEMA(updatedData, maPeriods.threeHundredSixty);
 
    sixtyEMASeriesRef.current?.setData(sixtyEMAData);
    oneTwentyEMASeriesRef.current?.setData(oneTwentyEMAData);
    twoFortyEMASeriesRef.current?.setData(twoFortyEMAData);
    threeHundredSixtyEMASeriesRef.current?.setData(threeHundredSixtyEMAData);

    // 크로스 포인트(매수/매도 신호) 계산 및 마커 업데이트
    const crossPoints = findCrossPoints(sixtyEMAData, oneTwentyEMAData, twoFortyEMAData, threeHundredSixtyEMAData, isFirstBuy);
    crossPointsRef.current = crossPoints;
    const markers = createTradeMarkers(crossPoints, tradeStrategy);
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
      // 기존 마커들을 모두 대체
      (candleSeries as any).setMarkers(markers);
    } catch (error) {
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
              const crossPoints = findCrossPoints(sixtyEMAData, oneTwentyEMAData, twoFortyEMAData, threeHundredSixtyEMAData, isFirstBuy);
              crossPointsRef.current = crossPoints;
              const markers = createTradeMarkers(crossPoints, tradeStrategy);
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
        angles: slopes || {
          entryMa40: 0,
          entryMa360: 0,
          exitMa40: 0,
          exitMa360: 0,
          entryMa120: 0,
          exitMa120: 0
        }
      };
    }
    return trade;
  }, [calculateSlopes]);

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
    let interval: NodeJS.Timeout | null = null;
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

  // 마커 업데이트를 위한 함수 통합
  const updateChartMarkers = useCallback((crossPoints: CrossPoint[]) => {
    if (!candleSeriesRef.current) return;
    
    try {
      // 기존 마커 제거
      createSeriesMarkers(candleSeriesRef.current, []);
      
      // 새 마커 생성 및 설정
      const markers = createTradeMarkers(crossPoints, tradeStrategy);
    createSeriesMarkers(candleSeriesRef.current, markers);
    } catch (error) {
      console.error('마커 업데이트 실패:', error);
    }
  }, [tradeStrategy]);

   

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

  // 240EMA 기울기 평균 계산 함수 추가
  const calculateMA240SlopeAverage = (ma240Data: LineData<Time>[], currentIndex: number): number => {
    if (!ma240Data || currentIndex < 30) return 0;
    
    let slopeSum = 0;
    const sampleCount = 30; // 30초 동안의 데이터
    
    for (let i = currentIndex; i > currentIndex - sampleCount; i--) {
      if (i <= 0) break;
      const slope = ma240Data[i].value - ma240Data[i-1].value;
      slopeSum += slope;
    }
    
    return slopeSum / sampleCount;
  };

  useEffect(() => {
    if (crossPointsRef.current) {
      updateChartMarkers(crossPointsRef.current);
    }
  }, [crossPointsRef.current]);

  // 차트의 timeScale을 직접 조작하여 표시 범위를 1시간으로 설정
  useEffect(() => {
    if (chartRef.current && chartRef.current.timeScale) {
      try {
        // 현재 시간에서 1시간 전까지의 범위 설정
        const now = new Date();
        const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
        
        chartRef.current.timeScale().setVisibleRange({
          from: Math.floor(oneHourAgo.getTime() / 1000) as Time,
          to: Math.floor(now.getTime() / 1000) as Time
        });
      } catch (error) {
        console.error('차트 범위 설정 중 오류:', error);
      }
    }
  }, [chartRef.current]);

  // 차트 초기화 완료 후 실행
  useEffect(() => {
    // 차트가 초기화되고 데이터가 로드된 후에만 실행
    if (chartRef.current && candleSeriesRef.current && candleSeriesRef.current.data().length > 0) {
      try {
        const now = new Date();
        const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
        
        chartRef.current.timeScale().setVisibleRange({
          from: Math.floor(oneHourAgo.getTime() / 1000) as Time,
          to: Math.floor(now.getTime() / 1000) as Time
        });
      } catch (error) {
        console.error('차트 범위 설정 중 오류:', error);
      }
    }
  }, [chartRef.current, candleSeriesRef.current]);

  // 각도 계산 함수 추가 (새로운 함수)
  const calculateAngle = (currentValue: number, previousValue: number, timeDiff: number = 10): number => {
    if (timeDiff === 0 || currentValue === undefined || previousValue === undefined) return 0;
    
    // 기울기 계산 (라디안)
    const angleRad = Math.atan((currentValue - previousValue) / timeDiff);
    
    // 라디안을 도로 변환
    const angleDeg = angleRad * (180 / Math.PI);
    
    // 디버깅을 위한 로그
    console.log(`calculateAngle: current=${currentValue}, prev=${previousValue}, diff=${currentValue - previousValue}, angle=${angleDeg}`);
    
    return angleDeg;
  };

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
                      const csvHeader = 'timestamp(KST),open,high,low,close,volume\n';
                      const csvContent = allData
                        .map(candle => {
                          // candle_date_time_kst는 'YYYY-MM-DDThh:mm:ss' 형식의 문자열
                          // 이를 Date 객체로 변환하면 브라우저의 로컬 시간대로 해석됨
                          // 따라서 문자열 그대로 사용하는 것이 더 정확함
                          
                          // 업비트 API의 candle_date_time_kst 형식을 변환
                          // 예: '2025-03-03T22:03:00+09:00' -> '2025-03-03 22:03:00'
                          const kstDateStr = candle.candle_date_time_kst.split('+')[0];
                          const formattedKSTDate = kstDateStr.replace('T', ' ');
                          
                          // 디버깅을 위한 로깅 (처음 몇 개 항목만)
                          if (allData.indexOf(candle) < 5 || allData.indexOf(candle) > allData.length - 5) {
                            console.log(`캔들 시간 확인: ${candle.candle_date_time_kst} -> ${formattedKSTDate}`);
                          }
                          
                          return `${formattedKSTDate},${candle.opening_price},${candle.high_price},${candle.low_price},${candle.trade_price},${candle.candle_acc_trade_volume}`;
                        })
                        .join('\n');
                      
                      const fullContent = csvHeader + csvContent;
                      const blob = new Blob([fullContent], { type: 'text/csv;charset=utf-8;' });
                      const url = URL.createObjectURL(blob);
                      
                      // 파일명에 KST 시간을 명시적으로 표시
                      const formatDateForFileName = (date: Date | null) => {
                        if (!date) return '';
                        
                        // 브라우저 시간을 KST로 변환
                        const browserTimezoneOffset = new Date().getTimezoneOffset();
                        const kstOffsetMinutes = -540; // KST는 UTC+9
                        const offsetDiffMinutes = kstOffsetMinutes - browserTimezoneOffset;
                        
                        // 브라우저 시간을 KST로 변환
                        const dateKST = new Date(date.getTime() + offsetDiffMinutes * 60 * 1000);
                        
                        // 디버깅을 위한 로깅
                        console.log(`파일명 시간 변환: 원본=${date.toISOString()}, KST변환=${dateKST.toISOString()}`);
                        
                        // KST 시간을 YYYY-MM-DDThh_mm_ss 형식으로 변환
                        return `${dateKST.getFullYear()}-${String(dateKST.getMonth() + 1).padStart(2, '0')}-${String(dateKST.getDate()).padStart(2, '0')}T${String(dateKST.getHours()).padStart(2, '0')}_${String(dateKST.getMinutes()).padStart(2, '0')}_${String(dateKST.getSeconds()).padStart(2, '0')}`;
                      };
                      
                      // 파일명에 시간 범위를 명확하게 표시
                      const csvFileName = `${symbol}_${chartType}_${formatDateForFileName(csvDateRange.startDate)}_${formatDateForFileName(csvDateRange.endDate)}_KST.csv`;
                      
                      const link = document.createElement('a');
                      link.setAttribute('href', url);
                      link.setAttribute('download', csvFileName);
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