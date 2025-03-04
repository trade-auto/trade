import { create } from 'zustand';
import { format } from 'date-fns';
import { persist, createJSONStorage } from 'zustand/middleware';

interface PriceData {
  currentPrice: number;
  lastUpdated: string;
}

interface TickerData {
  type: string;
  code: string;
  trade_price: number;
  trade_volume: number;
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

interface TradeState {
  lastTradeType: 'bid' | 'ask' | null;
  statusChangeTime: string;
  currentPrice: number;
  actionStartTime: Date | null;
  isTrading: boolean;
  theoreticalPosition: 'bid' | 'ask' | 'wait';
  missedFirstCycle: boolean;
}

// TradeStrategy 타입을 export
export type TradeStrategy = 'BOLLINGER' | 'MA_CROSS' | 'MA_CROSS_DEVIATION' | 'SLOPE_FILTER';

// maPeriods의 타입 정의
interface MAType {
  thirty: number;
  forty: number;
  sixty: number;
  oneTwenty: number;
  threeHundredSixty: number;
  twoForty: number;
}

interface UpbitStore {
  prices: Record<string, PriceData>;
  tickers: Record<string, TickerData>;
  isConnected: boolean;
  addPrice: (symbol: string, price: number) => void;
  setIsConnected: (status: boolean) => void;
  updateLastUpdated: (symbol: string) => void;
  updateTickerData: (symbol: string, data: TickerData) => void;
  tradeState: TradeState;
  updateTradeState: (update: Partial<TradeState>) => void;
  createOrder: (params: {
    market: string;
    side: 'bid' | 'ask';
    volume: string;
    price: string;
    ord_type: string;
    mode: string;
  }) => Promise<void>;
  orderLimits: {
    minOrderPrice: number;
    maxOrderPrice: number;
  };
  maPeriods: MAType;
  updateMAPeriod: (type: 'thirty' | 'forty' | 'sixty' | 'oneTwenty' | 'twoForty' | 'threeHundredSixty', value: number) => void;
  showMA: {
    thirty: boolean;
    forty: boolean;
    sixty: boolean;
    oneTwenty: boolean;
    twoForty: boolean;
    threeHundredSixty: boolean;
  };
  updateShowMA: (type: 'thirty' | 'forty' | 'sixty' | 'oneTwenty' | 'twoForty' | 'threeHundredSixty') => void;
  tradeStrategy: TradeStrategy;
  updateTradeStrategy: (strategy: TradeStrategy) => void;
}

// 기본값 상수 정의
const DEFAULT_SHOW_MA = {
  thirty: true,
  forty: true,
  sixty: true,
  oneTwenty: true,
  twoForty: true,
  threeHundredSixty: true,
};

const DEFAULT_MA_PERIODS = {
  thirty: 30,
  forty: 40,
  sixty: 60,
  oneTwenty: 120,
  twoForty: 240,
  threeHundredSixty: 360,
};

const DEFAULT_TRADE_STRATEGY = 'BOLLINGER';

export const useUpbitStore = create<UpbitStore>()(
  persist(
    (set) => ({
      prices: {},
      tickers: {},
      isConnected: false,
      
      addPrice: (symbol: string, price: number) => set((state) => ({
        prices: {
          ...state.prices,
          [symbol]: {
            currentPrice: price,
            lastUpdated: format(new Date(), 'yyyy-MM-dd HH:mm:ss')
          }
        }
      })),
      
      setIsConnected: (status: boolean) => set({ isConnected: status }),
      
      updateLastUpdated: (symbol: string) => set((state) => ({
        prices: {
          ...state.prices,
          [symbol]: {
            ...state.prices[symbol],
            lastUpdated: format(new Date(), 'yyyy-MM-dd HH:mm:ss')
          }
        }
      })),

      updateTickerData: (symbol: string, data: TickerData) => set((state) => ({
        tickers: {
          ...state.tickers,
          [symbol]: data
        }
      })),

      tradeState: {
        lastTradeType: null,
        statusChangeTime: '',
        currentPrice: 0,
        actionStartTime: null,
        isTrading: false,
        theoreticalPosition: 'wait',
        missedFirstCycle: false
      },

      updateTradeState: (update) => 
        set((state) => ({
          tradeState: { ...state.tradeState, ...update }
        })),

      createOrder: async (params) => {
        try {
          const response = await fetch('/api/order', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(params)
          });
          if (!response.ok) throw new Error('주문 실패');
        } catch (error) {
          console.error('주문 오류:', error);
          throw error;
        }
      },

      orderLimits: {
        minOrderPrice: 5000,
        maxOrderPrice: 1000000000
      },

      maPeriods: DEFAULT_MA_PERIODS,
      showMA: DEFAULT_SHOW_MA,
      tradeStrategy: DEFAULT_TRADE_STRATEGY as TradeStrategy,

      updateMAPeriod: (type, value) => set((state) => ({
        maPeriods: {
          ...state.maPeriods,
          [type]: value,
        }
      })),

      updateShowMA: (type) => set((state) => ({
        showMA: {
          ...state.showMA,
          [type]: !state.showMA[type],
        }
      })),

      updateTradeStrategy: (strategy) => set({ 
        tradeStrategy: strategy 
      }),
    }),
    {
      name: 'upbit-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        maPeriods: state.maPeriods,
        showMA: state.showMA,
        tradeStrategy: state.tradeStrategy,
      }),
    }
  )
); 