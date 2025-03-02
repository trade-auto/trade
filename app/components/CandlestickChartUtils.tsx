import { Time, LineData, CandlestickData } from 'lightweight-charts';
import { ExtendedCandlestickData } from '../types/candlestick';

// 타입 정의
export type TradeStrategy = 'BOLLINGER' | 'MA_CROSS' | 'MA_CROSS_DEVIATION' | 'SLOPE_FILTER';

// 인터페이스 정의
export interface ChartProps {
  symbol: string;
  chartType: string;
  initialAutoUpdate?: boolean;
  mode: 'live' | 'test';
  handleOrder: (params: {
    market: string;
    side: 'bid' | 'ask';
    volume: string;
    price: string;
    ord_type: string;
    mode: string;
  }) => Promise<void>;
}

export interface UpbitCandle {
  candle_date_time_kst: string;
  opening_price: number;
  high_price: number;
  low_price: number;
  trade_price: number;
  candle_acc_trade_volume: number;
}

export interface CrossPoint {
  time: Time;
  position: 'buy' | 'sell';
  price: number;
  isAbove360MA: boolean;
  isAbove240MA?: boolean;
  isAbove120MA?: boolean;
  isAbove60MA?: boolean;
  slopes: {
    ma60: number;
    ma360: number;
    ma120: number;
    ma240: number;
  };
  deviations?: {
    ma120: number;
    ma240: number;
  };
}

export interface BacktestResult {
  totalTrades: number;
  successfulTrades: number;
  totalReturn: number;
  totalNetReturn: number;
  successRate: number;
  averageReturn: number;
  averageNetReturn: number;
  trades: Trade[];
}

export interface TickerData {
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

export interface Trade {
  entryTime: Time;
  exitTime: Time;
  entryPrice: number;
  exitPrice: number;
  return: number;
  isSuccess: boolean;
  isAutomatic?: boolean;
  mode: 'test' | 'test-auto' | 'live-auto';
  angles?: {
    entryMa40?: number;
    exitMa40?: number;
    entryMa360?: number;
    exitMa360?: number;
    entryMa120?: number;
    exitMa120?: number;
  };
}

export interface DateRange {
  startDate: Date;
  endDate: Date | null;
}

export interface BusinessDay {
  year: number;
  month: number;
  day: number;
}

export interface Order {
  time: Date;
  side: 'buy' | 'sell';
  price: string;
  volume: string;
}

// 유틸리티 함수
export const getInitialDateRange = (type: string): DateRange => {
  const now = new Date();
  let startDate: Date;
  
  if (type.startsWith('seconds/')) {
    startDate = new Date(now.getTime() - 60 * 60 * 1000);
  } else if (type === 'minutes/1') {
    startDate = new Date(now.getTime() - 2 * 60 * 60 * 1000);
  } else {
    startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  }
  
  return {
    startDate,
    endDate: null
  };
};

export const getTickMarkFormatter = (chartType: string): ((time: number | BusinessDay, tickMarkType?: any) => string) => {
  return (time: number | BusinessDay): string => {
    let date: Date;
    if (typeof time === "number") {
      date = new Date(time * 1000);
    } else {
      date = new Date(time.year, time.month - 1, time.day);
    }
    
    if (chartType.indexOf("일봉") !== -1) {
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
      return `${date.getFullYear()}년 ${date.getMonth() + 1}월`;
    } else if (chartType.indexOf("년봉") !== -1) {
      return `${date.getFullYear()}년`;
    } else if (chartType.indexOf("seconds") !== -1) {
      return date.toLocaleTimeString("ko-KR", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });
    } else {
      return date.toLocaleTimeString("ko-KR", {
        hour: "2-digit",
        minute: "2-digit",
      });
    }
  };
};

export const calculateEMA = (data: ExtendedCandlestickData[], period: number): LineData<Time>[] => {
  if (!data || data.length === 0 || period <= 0) return [];
  
  const emaData: LineData<Time>[] = [];
  let multiplier = 2 / (period + 1);
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
};

export const formatTime = (time: Time): string => {
  if (typeof time === 'number') {
    return new Date(time * 1000).toLocaleString();
  } else if (typeof time === 'object' && time !== null) {
    const businessDay = time as BusinessDay;
    return new Date(businessDay.year, businessDay.month - 1, businessDay.day).toLocaleDateString();
  }
  return String(time);
};

export const calculateSlope = (data: ExtendedCandlestickData[], period: number): number => {
  if (data.length < 2) return 0;
  
  const maData = calculateEMA(data, period);
  if (maData.length < 2) return 0;
  
  const last = maData[maData.length - 1].value;
  const prev = maData[maData.length - 2].value;
  
  return ((last - prev) / prev) * 100;
};

export const calculateAngle = (currentValue: number, previousValue: number, timeDiff: number = 10): number => {
  if (timeDiff === 0 || currentValue === undefined || previousValue === undefined) return 0;
  
  const angleRad = Math.atan((currentValue - previousValue) / timeDiff);
  const angleDeg = angleRad * (180 / Math.PI);
  
  return angleDeg;
};

// 차트 관련 상수
export const MIN_SLOPE_THRESHOLD = 2;
export const MAX_SLOPE_THRESHOLD = 5;
export const THRESHOLD_ANGLE_360 = MAX_SLOPE_THRESHOLD;
export const THRESHOLD_ANGLE_360_MINUS = -MIN_SLOPE_THRESHOLD;
export const THRESHOLD_ANGLE_40 = MAX_SLOPE_THRESHOLD;
export const THRESHOLD_ANGLE_40_MINUS = -MIN_SLOPE_THRESHOLD;
export const THRESHOLD_ANGLE_60 = MAX_SLOPE_THRESHOLD;
export const THRESHOLD_ANGLE_60_MINUS = -MIN_SLOPE_THRESHOLD;
export const THRESHOLD_ANGLE_120 = MAX_SLOPE_THRESHOLD;
export const THRESHOLD_ANGLE_120_MINUS = -MIN_SLOPE_THRESHOLD;
export const THRESHOLD_ANGLE_60_PLUS = THRESHOLD_ANGLE_60;
export const THRESHOLD_ANGLE_120_PLUS = THRESHOLD_ANGLE_120; 