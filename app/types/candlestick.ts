import { Time } from 'lightweight-charts';
import { TradeStrategy } from '../strategies/types';
import { TradeSignal } from './trading';

export interface CandlestickData {
  time: Time;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

// Define a Trade interface
export interface Trade {
  entryTime: Time;
  exitTime?: Time;
  entryPrice: number;
  exitPrice?: number;
  return?: number;
  isSuccess?: boolean;
  mode: 'test' | 'real';
  status: 'open' | 'closed';  // 거래 상태 추가
  isAutomatic?: boolean;
  metadata?: {
    entryMa360?: number;
    exitMa360?: number;
    entryMa120?: number;
    exitMa120?: number;
  };
}

// 날짜 선택을 위한 인터페이스 추가
export interface DateRange {
  startDate: Date;
  endDate: Date | null;
}

// BusinessDay 타입 정의 (일봉, 월봉, 년봉 데이터가 이 형식으로 올 경우)
export interface BusinessDay {
  year: number;
  month: number;
  day: number;
}

// 인터페이스 대신 타입 별칭 사용
export type ExtendedCandlestickData = CandlestickData;

export interface ChartProps {
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

export interface UpbitCandle {
  market: string;
  candle_date_time_utc: string;
  candle_date_time_kst: string;
  opening_price: number;
  high_price: number;
  low_price: number;
  trade_price: number;
  timestamp: number;
  candle_acc_trade_price: number;
  candle_acc_trade_volume: number;
  unit?: number;
}

export interface CrossPoint {
  time: Time;
  position: 'buy' | 'sell';
  price: number;
  isAbove360MA: boolean;  // 추가
  slopes: {              // 추가
   // ma40: number;
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

export interface SeriesMarker<T> {
  time: T;
  position: 'aboveBar' | 'belowBar' | 'inBar';
  color: string;
  shape: 'circle' | 'square' | 'arrowUp' | 'arrowDown';
  text?: string;
  size?: number;
  id?: string;
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

export interface MASettings {
  five: boolean;
  ten: boolean;
  twenty: boolean;
  thirty: boolean;
  sixty: boolean;
  oneTwenty: boolean;
  twoForty: boolean;
  threeHundredSixty: boolean;
  sixHundred: boolean;
  nineHundred: boolean;
}