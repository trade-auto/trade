// 주문 생성 컴포넌트 Props
export interface CreateOrderProps {
  market: string;
  mode: 'live' | 'test';
  onOrderCreated: () => void;
  onPriceUpdate: (price: number) => void;
  onQuantityUpdate: (quantity: number) => void;
  onBacktestStart?: (startDate: Date, endDate: Date) => void;
  onBacktestEnd?: () => void;
}

// 주문 파라미터 타입 정의
export interface OrderParams {
  market: string;
  side: 'bid' | 'ask';
  volume: string;
  price: string;
  ord_type: string;
  mode: string;
}

// 거래 사이클 타입 정의
export interface TradeCycle {
  cycle: string[];
  times: string[];
  time: string;
  buyPrice: number | null;
  sellPrice: number | null;
  profit: string | null;
  profitAmount: string | null;
  slopes?: {
    ma60: number;
    ma300: number;
    ma360: number;
    ma900: number;
  };
}

// 매매 전략 타입 정의
export type TradeStrategy = 'BOLLINGER' | 'MA_CROSS' | 'MA_CROSS_DEVIATION' | 'SLOPE_FILTER';

// 기술적 지표 결과 타입
export interface TechnicalIndicators {
  rsi: number;
  macd: {
    macd: number;
    signal: number;
    histogram: number;
  };
  bollingerBands: {
    upper: number;
    middle: number;
    lower: number;
  } | null;
}

// 자동 거래 상태 타입
export interface AutoTradingState {
  isActive: boolean;
  lastAction: 'buy' | 'sell' | 'hold';
  lastActionTime: Date | null;
  currentState: string;
  currentCycle: TradeCycle | null;
}

// 백테스트 결과 타입
export interface BacktestResult {
  trades: TradeCycle[];
  totalProfit: number;
  winRate: number;
  averageProfit: number;
}

// 컴포넌트 참조 타입
export interface CreateOrderRef {
  handleOrder: (params: OrderParams) => Promise<void>;
} 