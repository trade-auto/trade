import { create } from 'zustand';
import { format } from 'date-fns';
import { DateRange } from '../types/candlestick';
import { CandlestickData, Time } from 'lightweight-charts';
import { useCallback } from 'react';
import strategies from '../strategies';
import { 
  TradeStrategy, 
  TradeSignal, 
  Trade, 
  TradingStrategy, 
  MAType, 
  PositionType,
  ExtendedMetadata
} from '../strategies/types';

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
  buyLimitMark?: {
    time: string;
    reason: string;
  };
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
  updateMAPeriod: (type: 'thirty' | 'forty' | 'sixty' | 'oneTwenty' | 'twoForty' | 'threeHundredSixty' | 'threeHundred' | 'nineHundred', value: number) => void;
  showMA: {
    thirty: boolean;
    forty: boolean;
    sixty: boolean;
    oneTwenty: boolean;
    twoForty: boolean;
    threeHundredSixty: boolean;
    threeHundred: boolean;
    nineHundred: boolean;
  };
  updateShowMA: (type: 'thirty' | 'forty' | 'sixty' | 'oneTwenty' | 'twoForty' | 'threeHundredSixty' | 'threeHundred' | 'nineHundred') => void;
  tradeStrategy: TradeStrategy;
  updateTradeStrategy: (strategy: TradeStrategy) => void;
  dateRange: DateRange;
  updateDateRange: (startDate: Date, endDate: Date | null) => void;
  strategies: Record<TradeStrategy, TradingStrategy>;
  getStrategy: (name: TradeStrategy) => TradingStrategy;
  analyzeStrategy: (data: CandlestickData<Time>[]) => TradeSignal[];
  trades: Trade[];
  addTrade: (trade: Trade) => void;
  updateTrade: (tradeId: string, updates: Partial<Trade>) => void;
  getOpenTrades: () => Trade[];
  getClosedTrades: () => Trade[];
  initializeTrades: () => void;
  resetTradeState: () => void;
}

// 로컬 스토리지에서 MA 설정 불러오기
const loadMASettings = () => {
  if (typeof window !== 'undefined') {
    try {
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
          threeHundred: true,
          nineHundred: true,
        },
        maPeriods: savedMAPeriods ? JSON.parse(savedMAPeriods) : {
          thirty: 30,
          forty: 40,
          sixty: 60,
          oneTwenty: 120,
          twoForty: 240,
          threeHundredSixty: 360,
          threeHundred: 300,
          nineHundred: 900,
        }
      };
    } catch (error) {
      console.error('MA 설정 로드 중 오류 발생:', error);
      return {
        showMA: {
          thirty: true,
          forty: true,
          sixty: true,
          oneTwenty: true,
          twoForty: true,
          threeHundredSixty: true,
          threeHundred: true,
          nineHundred: true,
        },
        maPeriods: {
          thirty: 30,
          forty: 40,
          sixty: 60,
          oneTwenty: 120,
          twoForty: 240,
          threeHundredSixty: 360,
          threeHundred: 300,
          nineHundred: 900,
        }
      };
    }
  }
  
  return {
    showMA: {
      thirty: true,
      forty: true,
      sixty: true,
      oneTwenty: true,
      twoForty: true,
      threeHundredSixty: true,
      threeHundred: true,
      nineHundred: true,
    },
    maPeriods: {
      thirty: 30,
      forty: 40,
      sixty: 60,
      oneTwenty: 120,
      twoForty: 240,
      threeHundredSixty: 360,
      threeHundred: 300,
      nineHundred: 900,
    }
  };
};

// 로컬 스토리지에서 거래 내역 불러오기
const loadTrades = (): Trade[] => {
  if (typeof window !== 'undefined') {
    try {
      const savedTrades = localStorage.getItem('trades');
      return savedTrades ? JSON.parse(savedTrades) : [];
    } catch (error) {
      console.error('거래 내역 로드 중 오류 발생:', error);
      return [];
    }
  }
  return [];
};

// 로컬 스토리지에서 전략 설정 불러오기
const loadTradeStrategy = (): TradeStrategy => {
  if (typeof window !== 'undefined') {
    try {
      const savedStrategy = localStorage.getItem('tradeStrategy');
      return savedStrategy ? JSON.parse(savedStrategy) : 'BOLLINGER';
    } catch (error) {
      console.error('전략 설정 로드 중 오류 발생:', error);
      return 'BOLLINGER';
    }
  }
  return 'BOLLINGER';
};

// 로컬 스토리지에서 날짜 범위 불러오기
const loadDateRange = (): DateRange => {
  if (typeof window !== 'undefined') {
    try {
      const savedDateRange = localStorage.getItem('dateRange');
      if (savedDateRange) {
        const parsed = JSON.parse(savedDateRange);
        return {
          startDate: parsed.startDate ? new Date(parsed.startDate) : new Date(),
          endDate: parsed.endDate ? new Date(parsed.endDate) : null
        };
      }
    } catch (error) {
      console.error('날짜 범위 로드 중 오류 발생:', error);
    }
  }
  
  // 기본값: 현재 날짜로부터 7일 전
  const defaultStartDate = new Date();
  defaultStartDate.setDate(defaultStartDate.getDate() - 7);
  
  return {
    startDate: defaultStartDate,
    endDate: null
  };
};

// Zustand 스토어 생성
const useUpbitStore = create<UpbitStore>((set, get) => {
  // 초기 설정 로드
  const { showMA, maPeriods } = loadMASettings();
  const trades = loadTrades();
  const tradeStrategy = loadTradeStrategy();
  const dateRange = loadDateRange();
  
  return {
    // 가격 데이터 관련 상태 및 메서드
    prices: {},
    tickers: {},
    isConnected: false,
    addPrice: (symbol, price) => {
      set((state) => ({
        prices: {
          ...state.prices,
          [symbol]: {
            currentPrice: price,
            lastUpdated: new Date().toISOString()
          }
        }
      }));
    },
    setIsConnected: (status) => set({ isConnected: status }),
    updateLastUpdated: (symbol) => {
      set((state) => ({
        prices: {
          ...state.prices,
          [symbol]: {
            ...state.prices[symbol],
            lastUpdated: new Date().toISOString()
          }
        }
      }));
    },
    updateTickerData: (symbol, data) => {
      set((state) => ({
        tickers: {
          ...state.tickers,
          [symbol]: data
        }
      }));
    },
    
    // 거래 상태 관련
    tradeState: {
      lastTradeType: null,
      statusChangeTime: new Date().toISOString(),
      currentPrice: 0,
      actionStartTime: null,
      isTrading: false,
      theoreticalPosition: 'wait',
      missedFirstCycle: false
    },
    updateTradeState: (update) => {
      set((state) => ({
        tradeState: {
          ...state.tradeState,
          ...update
        }
      }));
    },
    
    // 주문 관련
    createOrder: async (params) => {
      // 실제 주문 로직 구현 (API 호출 등)
      console.log('주문 생성:', params);
      // 주문 성공 시 상태 업데이트
      set((state) => ({
        tradeState: {
          ...state.tradeState,
          isTrading: false,
          lastTradeType: params.side,
          statusChangeTime: new Date().toISOString()
        }
      }));
    },
    orderLimits: {
      minOrderPrice: 5000,
      maxOrderPrice: 1000000000
    },
    
    // MA 설정 관련
    maPeriods,
    updateMAPeriod: (type, value) => {
      set((state) => {
        const newMAPeriods = {
          ...state.maPeriods,
          [type]: value
        };
        
        // 로컬 스토리지에 저장
        if (typeof window !== 'undefined') {
          localStorage.setItem('maPeriods', JSON.stringify(newMAPeriods));
        }
        
        return { maPeriods: newMAPeriods };
      });
    },
    showMA,
    updateShowMA: (type) => {
      set((state) => {
        const newShowMA = {
          ...state.showMA,
          [type]: !state.showMA[type]
        };
        
        // 로컬 스토리지에 저장
        if (typeof window !== 'undefined') {
          localStorage.setItem('showMA', JSON.stringify(newShowMA));
        }
        
        return { showMA: newShowMA };
      });
    },
    
    // 전략 관련
    tradeStrategy,
    updateTradeStrategy: (strategy) => {
      set({ tradeStrategy: strategy });
      
      // 로컬 스토리지에 저장
      if (typeof window !== 'undefined') {
        localStorage.setItem('tradeStrategy', JSON.stringify(strategy));
      }
    },
    dateRange,
    updateDateRange: (startDate, endDate) => {
      const newDateRange = { startDate, endDate };
      set({ dateRange: newDateRange });
      
      // 로컬 스토리지에 저장
      if (typeof window !== 'undefined') {
        localStorage.setItem('dateRange', JSON.stringify({
          startDate: startDate.toISOString(),
          endDate: endDate ? endDate.toISOString() : null
        }));
      }
    },
    
    // 전략 객체 및 분석 메서드
    strategies,
    getStrategy: (name) => strategies[name],
    analyzeStrategy: (data) => {
      const { tradeStrategy } = get();
      const strategy = strategies[tradeStrategy];
      return strategy.analyze(data);
    },
    
    // 거래 내역 관련
    trades,
    addTrade: (trade) => {
      set((state) => {
        const newTrades = [...state.trades, trade];
        
        // 로컬 스토리지에 저장
        if (typeof window !== 'undefined') {
          localStorage.setItem('trades', JSON.stringify(newTrades));
        }
        
        return { trades: newTrades };
      });
    },
    updateTrade: (tradeId, updates) => {
      set((state) => {
        const tradeIndex = state.trades.findIndex(t => t.id === tradeId);
        
        if (tradeIndex === -1) return state;
        
        const newTrades = [...state.trades];
        newTrades[tradeIndex] = {
          ...newTrades[tradeIndex],
          ...updates
        };
        
        // 로컬 스토리지에 저장
        if (typeof window !== 'undefined') {
          localStorage.setItem('trades', JSON.stringify(newTrades));
        }
        
        return { trades: newTrades };
      });
    },
    getOpenTrades: () => {
      return get().trades.filter(trade => trade.status === 'open');
    },
    getClosedTrades: () => {
      return get().trades.filter(trade => trade.status === 'closed');
    },
    initializeTrades: () => {
      set({ trades: [] });
      
      // 로컬 스토리지에서 삭제
      if (typeof window !== 'undefined') {
        localStorage.removeItem('trades');
      }
    },
    resetTradeState: () => {
      set({
        tradeState: {
          lastTradeType: null,
          statusChangeTime: new Date().toISOString(),
          currentPrice: 0,
          actionStartTime: null,
          isTrading: false,
          theoreticalPosition: 'wait',
          missedFirstCycle: false
        }
      });
    }
  };
});

export default useUpbitStore; 