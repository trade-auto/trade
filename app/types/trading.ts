// 거래 관련 타입 정의

export interface CreateOrderProps {
  market: string;
  mode: 'live' | 'test';
  onOrderCreated: () => void;
  onPriceUpdate: (price: number) => void;
  onQuantityUpdate: (quantity: number) => void;
  onBacktestStart?: (startDate: Date, endDate: Date) => void;
  onBacktestEnd?: () => void;
}

export interface OrderParams {
  market: string;
  side: 'bid' | 'ask';
  volume: string;
  price: string;
  ord_type: string;
  mode: string;
}

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

export type TradeStrategy = 'BOLLINGER' | 'MA_CROSS' | 'MA_CROSS_DEVIATION' | 'SLOPE_FILTER'; 