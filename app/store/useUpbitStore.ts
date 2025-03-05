import { create } from 'zustand';
import { format } from 'date-fns';
import { DateRange } from '../types/candlestick';
import { CandlestickData } from 'lightweight-charts';

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
  threeHundred: number;
  nineHundred: number;
}

// 매매 신호 타입 정의
export type TradeSignal = {
  time: number;
  position: 'long' | 'short' | 'close';
  price: number;
  strategy: TradeStrategy;
  metadata?: {
    deviation?: number;
    slope?: number;
    ma360?: number;
    ma120?: number;
    isAbove360MA?: boolean;
  };
};

// 매매 전략 인터페이스
export interface TradingStrategy {
  name: TradeStrategy;
  analyze: (data: CandlestickData[]) => TradeSignal[];
  description: string;
}

// 볼린저 밴드 전략
const bollingerStrategy: TradingStrategy = {
  name: 'BOLLINGER',
  analyze: (data) => {
    const signals: TradeSignal[] = [];
    const period = 20;
    const stdDev = 2;
    let currentPosition: 'long' | 'short' | null = null;

    for (let i = period; i < data.length; i++) {
      const slice = data.slice(i - period, i);
      const prices = slice.map(d => d.close);
      const sma = prices.reduce((a, b) => a + b) / period;
      const variance = prices.reduce((a, b) => a + Math.pow(b - sma, 2), 0) / period;
      const std = Math.sqrt(variance);
      const upper = sma + (stdDev * std);
      const lower = sma - (stdDev * std);

      if (data[i].close > upper && currentPosition === 'long') {
        signals.push({
          time: data[i].time as number,
          position: 'short',
          price: data[i].close,
          strategy: 'BOLLINGER'
        });
        currentPosition = 'short';
      } else if (data[i].close < lower && (currentPosition === null || currentPosition === 'short')) {
        signals.push({
          time: data[i].time as number,
          position: 'long',
          price: data[i].close,
          strategy: 'BOLLINGER'
        });
        currentPosition = 'long';
      }
    }
    return signals;
  },
  description: '볼린저 밴드 상/하단 돌파 전략'
};

// MA 크로스 전략
const maCrossStrategy: TradingStrategy = {
  name: 'MA_CROSS',
  analyze: (data) => {
    const signals: TradeSignal[] = [];
    const shortPeriod = 30;
    const longPeriod = 60;
    let currentPosition: 'long' | 'short' | null = null;

    for (let i = longPeriod; i < data.length; i++) {
      const shortMA = data.slice(i - shortPeriod, i).reduce((a, b) => a + b.close, 0) / shortPeriod;
      const longMA = data.slice(i - longPeriod, i).reduce((a, b) => a + b.close, 0) / longPeriod;
      const prevShortMA = data.slice(i - shortPeriod - 1, i - 1).reduce((a, b) => a + b.close, 0) / shortPeriod;
      const prevLongMA = data.slice(i - longPeriod - 1, i - 1).reduce((a, b) => a + b.close, 0) / longPeriod;

      if (prevShortMA <= prevLongMA && shortMA > longMA && (currentPosition === null || currentPosition === 'short')) {
        signals.push({
          time: data[i].time as number,
          position: 'long',
          price: data[i].close,
          strategy: 'MA_CROSS'
        });
        currentPosition = 'long';
      } else if (prevShortMA >= prevLongMA && shortMA < longMA && currentPosition === 'long') {
        signals.push({
          time: data[i].time as number,
          position: 'short',
          price: data[i].close,
          strategy: 'MA_CROSS'
        });
        currentPosition = 'short';
      }
    }
    return signals;
  },
  description: '단기/장기 이동평균선 교차 전략'
};

// 이격도 MA 이탈
const maDeviationStrategy: TradingStrategy = {
  name: 'MA_CROSS_DEVIATION',
  analyze: (data) => {
    const signals: TradeSignal[] = [];
    const period = 60;
    const deviationThreshold = 0.02;
    let currentPosition: 'long' | 'short' | null = null;

    for (let i = period; i < data.length; i++) {
      const ma = data.slice(i - period, i).reduce((a, b) => a + b.close, 0) / period;
      const deviation = Math.abs(data[i].close - ma) / ma;

      if (deviation > deviationThreshold) {
        if (data[i].close > ma && currentPosition === 'long') {
          signals.push({
            time: data[i].time as number,
            position: 'short',
            price: data[i].close,
            strategy: 'MA_CROSS_DEVIATION',
            metadata: { deviation }
          });
          currentPosition = 'short';
        } else if (data[i].close < ma && (currentPosition === null || currentPosition === 'short')) {
          signals.push({
            time: data[i].time as number,
            position: 'long',
            price: data[i].close,
            strategy: 'MA_CROSS_DEVIATION',
            metadata: { deviation }
          });
          currentPosition = 'long';
        }
      }
    }
    return signals;
  },
  description: '이동평균선 이격도 기반 전략'
};

// 기울기 필터 전략
const slopeFilterStrategy: TradingStrategy = {
  name: 'SLOPE_FILTER',
  analyze: (data) => {
    const signals: TradeSignal[] = [];
    const period = 14;
    const slopeThreshold = 0.001;
    let currentPosition: 'long' | 'short' | null = null;

    for (let i = period; i < data.length; i++) {
      const prices = data.slice(i - period, i).map(d => d.close);
      const x = Array.from({length: period}, (_, i) => i);
      const slope = calculateSlope(x, prices);

      if (Math.abs(slope) > slopeThreshold) {
        if (slope > 0 && (currentPosition === null || currentPosition === 'short')) {
          signals.push({
            time: data[i].time as number,
            position: 'long',
            price: data[i].close,
            strategy: 'SLOPE_FILTER',
            metadata: { slope }
          });
          currentPosition = 'long';
        } else if (slope < 0 && currentPosition === 'long') {
          signals.push({
            time: data[i].time as number,
            position: 'short',
            price: data[i].close,
            strategy: 'SLOPE_FILTER',
            metadata: { slope }
          });
          currentPosition = 'short';
        }
      }
    }
    return signals;
  },
  description: '가격 기울기 기반 필터링 전략'
};

// 기울기 계산 헬퍼 함수
function calculateSlope(x: number[], y: number[]): number {
  const n = x.length;
  const sumX = x.reduce((a, b) => a + b, 0);
  const sumY = y.reduce((a, b) => a + b, 0);
  const sumXY = x.reduce((a, b, i) => a + b * y[i], 0);
  const sumXX = x.reduce((a, b) => a + b * b, 0);
  return (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
}

// 전략 맵 정의
const strategies: Record<TradeStrategy, TradingStrategy> = {
  BOLLINGER: bollingerStrategy,
  MA_CROSS: maCrossStrategy,
  MA_CROSS_DEVIATION: maDeviationStrategy,
  SLOPE_FILTER: slopeFilterStrategy
};

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
  analyzeStrategy: (data: CandlestickData[]) => TradeSignal[];
}

// 로컬 스토리지에서 MA 설정 불러오기
const loadMASettings = () => {
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
    console.error('MA 설정 로드 오류:', error);
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
};

const savedSettings = loadMASettings();

export const useUpbitStore = create<UpbitStore>()((set, get) => ({
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
    
    // 로컬 스토리지에 저장
    localStorage.setItem('maPeriods', JSON.stringify(newMAPeriods));
    
    return { maPeriods: newMAPeriods };
  }),

  showMA: savedSettings.showMA,

  updateShowMA: (type) => set((state) => {
    const newShowMA = {
      ...state.showMA,
      [type]: !state.showMA[type],
    };
    
    // 로컬 스토리지에 저장
    localStorage.setItem('showMA', JSON.stringify(newShowMA));
    
    return { showMA: newShowMA };
  }),

  // 로컬 스토리지에서 마지막 전략 불러오기 또는 기본값 설정
  tradeStrategy: (localStorage.getItem('lastTradeStrategy') as TradeStrategy) || 'BOLLINGER',
  
  updateTradeStrategy: (strategy) => {
    localStorage.setItem('lastTradeStrategy', strategy);
    set({ tradeStrategy: strategy });
  },

  // 초기 dateRange 설정
  dateRange: {
    startDate: new Date(),
    endDate: null
  },

  // dateRange 업데이트 함수
  updateDateRange: (startDate: Date, endDate: Date | null) => 
    set((state) => ({
      dateRange: {
        ...state.dateRange,
        startDate,
        endDate
      }
    })),

  // 전략 관련 상태 및 함수 추가
  strategies,
  
  getStrategy: (name) => strategies[name],
  
  analyzeStrategy: (data) => {
    const currentStrategy = get().tradeStrategy;
    return strategies[currentStrategy].analyze(data);
  }
})); 