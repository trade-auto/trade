import { create } from 'zustand';
import { format } from 'date-fns';
import { DateRange } from '../types/candlestick';
import { CandlestickData, Time } from 'lightweight-charts';

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
    rsi?: number;
    macd?: number;
  };
};

// 매매 전략 인터페이스
export interface TradingStrategy {
  name: TradeStrategy;
  analyze: (data: CandlestickData<Time>[]) => TradeSignal[];
  description: string;
}

interface ExtendedMetadata {
  deviation?: number;
  slope?: number;
  ma60?: number;
  ma120?: number;
  ma240?: number;
  ma300?: number;
  ma360?: number;
  ma900?: number;
  rsi?: number;
  macd?: number;
  momentum?: number;
  ma300Slope?: number;
  ma900Slope?: number;
  upperBand?: number;
  lowerBand?: number;
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

// EMA 계산 유틸리티 함수
function calculateEMA(data: CandlestickData<Time>[], period: number): { time: Time; value: number }[] {
  const k = 2 / (period + 1);
  const emaData: { time: Time; value: number }[] = [];
  let ema = data[0].close;

  for (let i = 0; i < data.length; i++) {
    ema = data[i].close * k + ema * (1 - k);
    emaData.push({ time: data[i].time, value: ema });
  }

  return emaData;
}

// MACD 시그널 라인 계산을 위한 임시 데이터 생성 함수
function createTempCandleData(time: Time, close: number): CandlestickData<Time> {
  return {
    time,
    open: close,
    high: close,
    low: close,
    close
  };
}

// 이격도 MA 이탈
const maDeviationStrategy: TradingStrategy = {
  name: 'MA_CROSS_DEVIATION',
  analyze: (data) => {
    const signals: TradeSignal[] = [];
    const period = 60;
    const deviationThreshold = 0.02;
    const rsiPeriod = 14;
    const macdFast = 12;
    const macdSlow = 26;
    const macdSignal = 9;
    const momentumPeriod = 10;
    const surgeThreshold = 0.003;
    let currentPosition: 'long' | 'short' | null = null;

    // 최소 필요한 데이터 포인트 계산
    const minDataPoints = Math.max(period, rsiPeriod, macdSlow + macdSignal, 900);
    if (data.length < minDataPoints) return signals;

    for (let i = minDataPoints; i < data.length; i++) {
      const prices = data.slice(0, i + 1).map(d => d.close);
      
      // MA 계산
      const ma = prices.slice(-period).reduce((a, b) => a + b, 0) / period;
      const ma300 = prices.slice(-300).reduce((a, b) => a + b, 0) / 300;
      const ma900 = prices.slice(-900).reduce((a, b) => a + b, 0) / 900;
      
      // 이격도 계산
      const deviation = Math.abs(data[i].close - ma) / ma;
      
      // RSI 계산
      const rsiSlice = prices.slice(-rsiPeriod * 2);
      const gains = [];
      const losses = [];
      for (let j = 1; j < rsiSlice.length; j++) {
        const diff = rsiSlice[j] - rsiSlice[j - 1];
        if (diff >= 0) {
          gains.push(diff);
          losses.push(0);
        } else {
          gains.push(0);
          losses.push(Math.abs(diff));
        }
      }
      const avgGain = gains.slice(-rsiPeriod).reduce((a, b) => a + b, 0) / rsiPeriod;
      const avgLoss = losses.slice(-rsiPeriod).reduce((a, b) => a + b, 0) / rsiPeriod;
      const rs = avgGain / (avgLoss || 1);
      const rsi = 100 - (100 / (1 + rs));
      const prevRsi = i > 0 ? calculateRSI(prices.slice(0, i)) : rsi;

      // MACD 계산
      const emaFast = calculateEMA(data.slice(0, i + 1), macdFast).slice(-1)[0]?.value || 0;
      const emaSlow = calculateEMA(data.slice(0, i + 1), macdSlow).slice(-1)[0]?.value || 0;
      const macd = emaFast - emaSlow;
      const macdSignalLine = calculateEMA(
        data.slice(0, i + 1).map(d => createTempCandleData(d.time, 
          calculateEMA([createTempCandleData(d.time, d.close)], macdFast)[0]?.value - 
          calculateEMA([createTempCandleData(d.time, d.close)], macdSlow)[0]?.value || 0
        )),
        macdSignal
      ).slice(-1)[0]?.value || 0;
      const macdHistogram = macd - macdSignalLine;

      // 모멘텀 계산
      const momentum = prices[i] / prices[i - momentumPeriod] - 1;

      // MA 기울기 계산
      const ma300Slope = (ma300 - (prices.slice(-301, -1).reduce((a, b) => a + b, 0) / 300)) / ma300;
      const ma900Slope = (ma900 - (prices.slice(-901, -1).reduce((a, b) => a + b, 0) / 900)) / ma900;

      // 급등/급락 감지
      const recentPrices = prices.slice(-5);
      const priceChange = (recentPrices[recentPrices.length - 1] - recentPrices[0]) / recentPrices[0];
      const isSurge = Math.abs(priceChange) > surgeThreshold;

      if (deviation > deviationThreshold) {
        const isLongCondition = 
          data[i].close < ma && // 가격이 MA 아래
          rsi < 40 && rsi > prevRsi && // RSI 과매도 및 상승 반전
          macdHistogram > 0 && // MACD 상승
          momentum > 0 && // 모멘텀 양수
          ma300Slope > 0 && // MA300 상승추세
          ma900Slope > 0 && // MA900 상승추세
          !isSurge; // 급등/급락 상태가 아님

        const isShortCondition = 
          data[i].close > ma && // 가격이 MA 위
          rsi > 60 && // RSI 과매수
          macdHistogram < 0 && // MACD 하락
          momentum < 0 && // 모멘텀 음수
          ma300Slope < 0 && // MA300 하락추세
          ma900Slope < 0 && // MA900 하락추세
          !isSurge; // 급등/급락 상태가 아님

        if (isLongCondition && (currentPosition === null || currentPosition === 'short')) {
          signals.push({
            time: data[i].time as number,
            position: 'long',
            price: data[i].close,
            strategy: 'MA_CROSS_DEVIATION',
            metadata: { 
              deviation,
              rsi,
              macd: macdHistogram,
              momentum,
              ma300Slope,
              ma900Slope
            } as ExtendedMetadata
          });
          currentPosition = 'long';
        } else if (isShortCondition && currentPosition === 'long') {
          signals.push({
            time: data[i].time as number,
            position: 'short',
            price: data[i].close,
            strategy: 'MA_CROSS_DEVIATION',
            metadata: { 
              deviation,
              rsi,
              macd: macdHistogram,
              momentum,
              ma300Slope,
              ma900Slope
            } as ExtendedMetadata
          });
          currentPosition = 'short';
        }
      }
    }
    return signals;
  },
  description: '이동평균선 이격도 기반 전략 (RSI, MACD, 모멘텀, MA 추세 통합)'
};

// RSI 계산 헬퍼 함수
function calculateRSI(prices: number[]): number {
  const rsiPeriod = 14;
  const gains = [];
  const losses = [];
  
  for (let i = 1; i < prices.length; i++) {
    const diff = prices[i] - prices[i - 1];
    if (diff >= 0) {
      gains.push(diff);
      losses.push(0);
    } else {
      gains.push(0);
      losses.push(Math.abs(diff));
    }
  }
  
  const avgGain = gains.slice(-rsiPeriod).reduce((a, b) => a + b, 0) / rsiPeriod;
  const avgLoss = losses.slice(-rsiPeriod).reduce((a, b) => a + b, 0) / rsiPeriod;
  const rs = avgGain / (avgLoss || 1);
  return 100 - (100 / (1 + rs));
}

// 기울기 필터 전략
const slopeFilterStrategy: TradingStrategy = {
  name: 'SLOPE_FILTER',
  analyze: (data) => {
    const signals: TradeSignal[] = [];
    // 기본 파라미터 설정
    const ma60Period = 60;
    const ma120Period = 120;
    const ma240Period = 240;
    const ma300Period = 300;
    const ma360Period = 360;
    const ma900Period = 900;
    const rsiPeriod = 14;
    const macdFast = 12;
    const macdSlow = 26;
    const macdSignal = 9;
    const bbandsLength = 20;
    const bbandsStdDev = 2;
    let currentPosition: 'long' | 'short' | null = null;

    // 최소 필요 데이터 포인트 계산
    const minDataPoints = Math.max(ma900Period, rsiPeriod, macdSlow + macdSignal);
    if (data.length < minDataPoints) return signals;

    for (let i = minDataPoints; i < data.length; i++) {
      const prices = data.slice(0, i + 1).map(d => d.close);
      
      // 이동평균선 계산
      const ma60 = prices.slice(-ma60Period).reduce((a, b) => a + b, 0) / ma60Period;
      const ma120 = prices.slice(-ma120Period).reduce((a, b) => a + b, 0) / ma120Period;
      const ma240 = prices.slice(-ma240Period).reduce((a, b) => a + b, 0) / ma240Period;
      const ma300 = prices.slice(-ma300Period).reduce((a, b) => a + b, 0) / ma300Period;
      const ma360 = prices.slice(-ma360Period).reduce((a, b) => a + b, 0) / ma360Period;
      const ma900 = prices.slice(-ma900Period).reduce((a, b) => a + b, 0) / ma900Period;

      // 이전 이동평균선 계산 (교차 확인용)
      const prevMa60 = prices.slice(-ma60Period-1, -1).reduce((a, b) => a + b, 0) / ma60Period;
      const prevMa120 = prices.slice(-ma120Period-1, -1).reduce((a, b) => a + b, 0) / ma120Period;

      // MACD 계산
      const emaFast = calculateEMA(data.slice(0, i + 1), macdFast).slice(-1)[0]?.value || 0;
      const emaSlow = calculateEMA(data.slice(0, i + 1), macdSlow).slice(-1)[0]?.value || 0;
      const macd = emaFast - emaSlow;
      const macdSignalLine = calculateEMA(
        data.slice(0, i + 1).map(d => createTempCandleData(d.time, 
          calculateEMA([createTempCandleData(d.time, d.close)], macdFast)[0]?.value - 
          calculateEMA([createTempCandleData(d.time, d.close)], macdSlow)[0]?.value || 0
        )),
        macdSignal
      ).slice(-1)[0]?.value || 0;
      const macdHistogram = macd - macdSignalLine;
      const prevMacdHistogram = calculateEMA(
        data.slice(0, i).map(d => createTempCandleData(d.time,
          calculateEMA([createTempCandleData(d.time, d.close)], macdFast)[0]?.value -
          calculateEMA([createTempCandleData(d.time, d.close)], macdSlow)[0]?.value || 0
        )),
        macdSignal
      ).slice(-1)[0]?.value || 0;

      // RSI 계산
      const rsiSlice = prices.slice(-rsiPeriod * 2);
      const gains = [];
      const losses = [];
      for (let j = 1; j < rsiSlice.length; j++) {
        const diff = rsiSlice[j] - rsiSlice[j - 1];
        if (diff >= 0) {
          gains.push(diff);
          losses.push(0);
        } else {
          gains.push(0);
          losses.push(Math.abs(diff));
        }
      }
      const avgGain = gains.slice(-rsiPeriod).reduce((a, b) => a + b, 0) / rsiPeriod;
      const avgLoss = losses.slice(-rsiPeriod).reduce((a, b) => a + b, 0) / rsiPeriod;
      const rs = avgGain / (avgLoss || 1);
      const rsi = 100 - (100 / (1 + rs));
      const prevRsi = i > 0 ? calculateRSI(prices.slice(0, i)) : rsi;

      // 볼린저 밴드 계산
      const bbandsSlice = prices.slice(-bbandsLength);
      const bbandsMA = bbandsSlice.reduce((a, b) => a + b, 0) / bbandsLength;
      const bbandsStd = Math.sqrt(
        bbandsSlice.reduce((a, b) => a + Math.pow(b - bbandsMA, 2), 0) / bbandsLength
      );
      const upperBand = bbandsMA + (bbandsStdDev * bbandsStd);
      const lowerBand = bbandsMA - (bbandsStdDev * bbandsStd);

      // 매수 조건 확인
      const isLongCondition = 
        // 이동평균선 정렬 및 교차 조건
        ma60 > ma120 && ma120 > ma240 && ma240 > ma300 && ma300 > ma360 && ma360 > ma900 &&
        prevMa60 <= prevMa120 && ma60 > ma120 && // MA60이 MA120 상향 돌파
        // MACD 조건
        macdHistogram > 0 && prevMacdHistogram <= 0 && // MACD 상향 돌파
        // RSI 조건
        ((rsi < 30 && rsi > prevRsi) || (rsi >= 40 && rsi <= 60)) && // RSI 상승 반전 또는 중립대역
        // 볼린저 밴드 조건
        data[i].close <= lowerBand;

      // 매도 조건 확인
      const isShortCondition = 
        // 이동평균선 정렬 붕괴 또는 하향 돌파
        (ma60 < ma120 || ma120 < ma240 || prevMa60 >= prevMa120 && ma60 < ma120) &&
        // MACD 조건
        macdHistogram < 0 && prevMacdHistogram >= 0 && // MACD 하향 돌파
        // RSI 조건
        rsi > 70 &&
        // 볼린저 밴드 조건
        data[i].close >= upperBand;

      if (isLongCondition && (currentPosition === null || currentPosition === 'short')) {
        signals.push({
          time: data[i].time as number,
          position: 'long',
          price: data[i].close,
          strategy: 'SLOPE_FILTER',
          metadata: {
            deviation: Math.abs(data[i].close - ma60) / ma60,
            ma360,
            ma120,
            isAbove360MA: data[i].close > ma360,
            rsi,
            macd: macdHistogram
          }
        });
        currentPosition = 'long';
      } else if (isShortCondition && currentPosition === 'long') {
        signals.push({
          time: data[i].time as number,
          position: 'short',
          price: data[i].close,
          strategy: 'SLOPE_FILTER',
          metadata: {
            deviation: Math.abs(data[i].close - ma60) / ma60,
            ma360,
            ma120,
            isAbove360MA: data[i].close > ma360,
            rsi,
            macd: macdHistogram
          }
        });
        currentPosition = 'short';
      }
    }
    return signals;
  },
  description: '통합 기술적 분석 전략 (MA/MACD/RSI/BB)'
};

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
  analyzeStrategy: (data: CandlestickData<Time>[]) => TradeSignal[];
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
    // 차트 데이터를 초기화하거나 새로고침하는 로직 추가
    const data = get().analyzeStrategy([]); // 빈 데이터로 초기화
    // 차트 컴포넌트에 데이터 업데이트 로직 추가 필요
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