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

interface UpbitStore {
  prices: Record<string, PriceData>;
  tickers: Record<string, TickerData>;
  isConnected: boolean;
  addPrice: (symbol: string, price: number) => void;
  setIsConnected: (status: boolean) => void;
  updateLastUpdated: (symbol: string) => void;
  updateTickerData: (symbol: string, data: TickerData) => void;
}

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
  }))
})); 