import { Time } from 'lightweight-charts';

export type TradeStrategy = 'BOLLINGER' | 'MA_CROSS' | 'MA_CROSS_DEVIATION' | 'SLOPE_FILTER';

export interface OrderParams {
  market: string;
  side: 'bid' | 'ask';
  volume: string;
  price: string;
  ord_type: 'limit' | 'price' | 'market';
  mode: 'test' | 'live' | 'live-auto';
}

export interface TradeCycle {
  cycle: string[];
  times: string[];
  time?: string;
  buyPrice: number | null;
  sellPrice: number | null;
  profit: string | null;
  profitAmount: string | null;
  slopes?: {
    ma60?: number;
    ma300?: number;
    ma360?: number;
    ma900?: number;
  };
}

export interface CreateOrderProps {
  market: string;
  mode: 'test' | 'live';
  onOrderCreated?: () => void;
  onPriceUpdate: (price: number) => void;
  onQuantityUpdate: (quantity: number) => void;
  onBacktestStart?: (startDate: Date, endDate: Date) => void;
  onBacktestEnd?: () => void;
}

export interface ExtendedMetadata {
  ma60: number;
  ma120: number;
  ma240: number;
  ma900: number;
  upperBand: number;
  lowerBand: number;
  deviation: number;
  isAbove900MA: boolean;
}

export interface AnalyzeOptions {
  realtime?: boolean;
  lastProcessedIndex?: number;
  currentPosition?: 'long' | null;
  lastTradeId?: string | null;
  entryPrice?: number;
}

export interface AnalysisResult {
  signals: TradeSignal[];
  lastProcessedIndex: number;
  currentPosition: 'long' | null;
  lastTradeId: string | null;
  entryPrice?: number;
}

export interface TradeSignal {
  id: string;
  time: number;
  position: 'long' | 'close';
  price: number;
  strategy: string;
  reason: string;
  metadata?: ExtendedMetadata;
  relatedTradeId?: string;
} 