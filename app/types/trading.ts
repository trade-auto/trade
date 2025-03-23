import { Time, CandlestickData } from 'lightweight-charts';

export type TradeStrategy = 'BOLLINGER' | 'MACD' | 'MA_CROSS' | 'MA_CROSS_DEVIATION' | 'SLOPE_FILTER';

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
  ma360?: number;
  ma900: number;
  upperBand: number;
  lowerBand: number;
  deviation: number;
  isAbove360MA?: boolean;
  isAbove900MA: boolean;
}

export interface AnalyzeOptions {
  realtime?: boolean;
  lastProcessedIndex?: number;
  currentPosition?: 'buy' | null;
  lastTradeId?: string | null;
  entryPrice?: number;
}

export interface AnalysisResult {
  signals: TradeSignal[];
  lastProcessedIndex: number;
  currentPosition: 'buy' | null;
  lastTradeId: string | null;
  entryPrice?: number;
}

export interface TradeSignal {
  id: string;
  time: Time;
  position: 'buy' | 'sell';
  price: number;
  amount?: number;
  strategy: TradeStrategy;
  reason?: string;
  metadata?: ExtendedMetadata;
  relatedTradeId?: string;
}

interface IndicatorSettings {
  maPeriods?: {
    short?: number;
    long?: number;
  };
  // 기타 인디케이터 설정 추가 가능
}

interface RiskManagement {
  stopLossPercent?: number;
  takeProfitPercent?: number;
  positionSizePercent?: number;
  // 기타 리스크 관리 설정 추가 가능
}

export interface TradingStrategy {
  name: TradeStrategy;
  timeframe?: string;
  description: string;
  author?: string;
  version?: string;
  tags?: string[];
  
  indicators?: IndicatorSettings;
  riskManagement?: RiskManagement;
  
  analyzeEntry?: (data: CandlestickData<Time>[], index: number) => 'buy' | null;
  analyzeExit?: (data: CandlestickData<Time>[], index: number, position: 'buy', entryPrice: number) => boolean;
  
  analyze: (data: CandlestickData<Time>[], options?: AnalyzeOptions) => AnalysisResult;
} 