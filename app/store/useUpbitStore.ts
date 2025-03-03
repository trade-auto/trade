import { create } from 'zustand';
import { format } from 'date-fns';

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

// 로컬 스토리지에서 MA 설정 불러오기
const loadMASettings = () => {
  try {
    // 서버 사이드 렌더링 환경에서는 localStorage가 없으므로 확인
    if (typeof window === 'undefined') {
      return {
        showMA: {
          thirty: true,
          forty: true,
          sixty: true,
          oneTwenty: true,
          twoForty: true,
          threeHundredSixty: true,
        },
        maPeriods: {
          thirty: 30,
          forty: 40,
          sixty: 60,
          oneTwenty: 120,
          twoForty: 240,
          threeHundredSixty: 360,
        }
      };
    }
    
    const savedShowMA = localStorage.getItem('showMA');
    const savedMAPeriods = localStorage.getItem('maPeriods');
    
    return {
      showMA: savedShowMA ? JSON.parse(savedShowMA) : {
        thirty: true,
        forty: true,
        sixty: true,
        oneTwenty: true,
        twoForty: true,
        threeHundredSixty: true,
      },
      maPeriods: savedMAPeriods ? JSON.parse(savedMAPeriods) : {
        thirty: 30,
        forty: 40,
        sixty: 60,
        oneTwenty: 120,
        twoForty: 240,
        threeHundredSixty: 360,
      }
    };
  } catch (error) {
    console.error('MA 설정 로드 오류:', error);
    return {
      showMA: {
        thirty: true,
        forty: true,
        sixty: true,
        oneTwenty: true,
        twoForty: true,
        threeHundredSixty: true,
      },
      maPeriods: {
        thirty: 30,
        forty: 40,
        sixty: 60,
        oneTwenty: 120,
        twoForty: 240,
        threeHundredSixty: 360,
      }
    };
  }
};

const savedSettings = loadMASettings();

export const useUpbitStore = create<UpbitStore>()((set) => ({
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
      // 실제 주문 로직 구현
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

  maPeriods: savedSettings.maPeriods,

  updateMAPeriod: (type, value) => set((state) => {
    const newMAPeriods = {
      ...state.maPeriods,
      [type]: value,
    };
    
    // 로컬 스토리지에 저장 (클라이언트 사이드에서만)
    if (typeof window !== 'undefined') {
      localStorage.setItem('maPeriods', JSON.stringify(newMAPeriods));
    }
    
    return { maPeriods: newMAPeriods };
  }),

  showMA: savedSettings.showMA,

  updateShowMA: (type) => set((state) => {
    const newShowMA = {
      ...state.showMA,
      [type]: !state.showMA[type],
    };
    
    // 로컬 스토리지에 저장 (클라이언트 사이드에서만)
    if (typeof window !== 'undefined') {
      localStorage.setItem('showMA', JSON.stringify(newShowMA));
    }
    
    return { showMA: newShowMA };
  }),

  // 로컬 스토리지에서 마지막 전략 불러오기 또는 기본값 설정
  tradeStrategy: typeof window !== 'undefined' ? 
    (localStorage.getItem('lastTradeStrategy') as TradeStrategy) || 'BOLLINGER' : 
    'BOLLINGER',
  
  updateTradeStrategy: (strategy) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('lastTradeStrategy', strategy);
    }
    set({ tradeStrategy: strategy });
  },
})); 