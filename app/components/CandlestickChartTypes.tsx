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
  ma60SlopeChange?: {
    changeTime: number | null;
    crossTime: number;
    timeDiff: number | null;
  } | null;
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