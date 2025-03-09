// 주문 생성 컴포넌트 Props
export interface CreateOrderProps {
  market: string;
  mode: 'live' | 'test';
  onOrderCreated: () => void;
  onPriceUpdate: (price: number) => void;
  onQuantityUpdate: (quantity: number) => void;
  onBacktestStart?: (startDate: Date, endDate: Date) => void;  // 백테스트 시작 시 호출될 콜백 추가
  onBacktestEnd?: () => void;                                  // 백테스트 종료 시 호출될 콜백 추가
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
  slopes?: {  // 기울기 정보 추가
    ma60: number;
    ma300: number;
    ma360: number;
    ma900: number;
  };
}

// 매매 전략 타입 정의
export type TradeStrategy = 'BOLLINGER' | 'MA_CROSS' | 'MA_CROSS_DEVIATION' | 'SLOPE_FILTER';

// 거래 사이클 상태 타입
export type TradeCycleStatus = 'waiting_buy' | 'waiting_sell' | 'trading' | 'complete';

// MACD 계산 결과 타입
export interface MacdResult {
  macd: number;
  signal: number;
  histogram: number;
}

// 볼린저 밴드 계산 결과 타입
export interface BollingerBands {
  upper: number;
  middle: number;
  lower: number;
}

// 거래 신호 타입
export type TradeSignal = 'buy' | 'sell' | 'hold'; 