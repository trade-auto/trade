import { BollingerBands, MacdResult, TradeSignal } from './types';

// 상수 정의
export const MA900_UPTREND_WINDOW = 20;
export const MA900_UPTREND_MIN_SLOPE = 0.0001;

// 기울기 계산 함수
export const calculateRelativeSlope = (ma: number[]): number => {
  if (ma.length < 2) return 0;
  const current = ma[ma.length - 1];
  const previous = ma[ma.length - 2];
  return ((current - previous) / previous) * 100;
};

// 이동평균 계산 함수
export const calculateMA = (priceData: number[], period: number): number[] => {
  if (priceData.length < period) return [];
  const result: number[] = [];
  for (let i = 0; i <= priceData.length - period; i++) {
    const sum = priceData.slice(i, i + period).reduce((a, b) => a + b, 0);
    result.push(sum / period);
  }
  return result;
};

// RSI 계산 함수
export const calculateRSI = (prices: number[], period: number = 14): number => {
  if (prices.length < period + 1) return 50; // 충분한 데이터가 없으면 중립값 반환
  
  let gains = 0;
  let losses = 0;
  
  // 가격 변화 계산
  for (let i = 1; i <= period; i++) {
    const change = prices[prices.length - i] - prices[prices.length - i - 1];
    if (change >= 0) {
      gains += change;
    } else {
      losses -= change; // 손실은 양수로 변환
    }
  }
  
  // 평균 이득과 손실 계산
  const avgGain = gains / period;
  const avgLoss = losses / period;
  
  // 상대강도(RS) 계산
  if (avgLoss === 0) return 100; // 손실이 없으면 RSI는 100
  const rs = avgGain / avgLoss;
  
  // RSI 계산
  return 100 - (100 / (1 + rs));
};

// EMA 계산 헬퍼 함수
export const calculateEMA = (data: number[], period: number): number[] => {
  const k = 2 / (period + 1);
  const emaData: number[] = [];
  let ema = data[0];
  
  for (let i = 0; i < data.length; i++) {
    ema = data[i] * k + ema * (1 - k);
    emaData.push(ema);
  }
  
  return emaData;
};

// MACD 계산 함수
export const calculateMACD = (prices: number[], fastPeriod: number = 12, slowPeriod: number = 26, signalPeriod: number = 9): MacdResult => {
  if (prices.length < slowPeriod + signalPeriod) {
    return { macd: 0, signal: 0, histogram: 0 }; // 충분한 데이터가 없으면 기본값 반환
  }
  
  // 빠른 EMA와 느린 EMA 계산
  const fastEMA = calculateEMA(prices, fastPeriod);
  const slowEMA = calculateEMA(prices, slowPeriod);
  
  // MACD 라인 계산 (빠른 EMA - 느린 EMA)
  const macdLine: number[] = [];
  for (let i = 0; i < slowEMA.length; i++) {
    if (i >= slowEMA.length - fastEMA.length) {
      const fastIndex = i - (slowEMA.length - fastEMA.length);
      macdLine.push(fastEMA[fastIndex] - slowEMA[i]);
    }
  }
  
  // 시그널 라인 계산 (MACD의 EMA)
  const signalLine = calculateEMA(macdLine, signalPeriod);
  
  // 히스토그램 계산 (MACD - 시그널)
  const histogram = macdLine[macdLine.length - 1] - signalLine[signalLine.length - 1];
  
  return {
    macd: macdLine[macdLine.length - 1],
    signal: signalLine[signalLine.length - 1],
    histogram: histogram
  };
};

// 볼린저 밴드 계산 함수
export const calculateBollingerBands = (prices: number[], period: number = 20, multiplier: number = 2): BollingerBands | null => {
  if (prices.length < period) return null;

  const sma = prices.slice(-period).reduce((a, b) => a + b) / period;
  const squaredDiffs = prices.slice(-period).map(p => Math.pow(p - sma, 2));
  const standardDeviation = Math.sqrt(squaredDiffs.reduce((a, b) => a + b) / period);
  
  return {
    upper: sma + (standardDeviation * multiplier),
    lower: sma - (standardDeviation * multiplier),
    middle: sma
  };
};

// 볼린저 밴드 검사 함수
export const isBollingerBandSignal = (prices: number[], period: number = 20, stdDev: number = 2): TradeSignal => {
  if (prices.length < period) return 'hold';
  
  const bands = calculateBollingerBands(prices, period, stdDev);
  const currentPrice = prices[prices.length - 1];
  
  if (bands === null) return 'hold';
  if (currentPrice < bands.lower) return 'buy'; // 하단 밴드 돌파 시 매수
  if (currentPrice > bands.upper) return 'sell'; // 상단 밴드 돌파 시 매도
  return 'hold';
};

// 가격 급등 감지 함수
export const detectPriceSurge = (prices: number[], window: number = 5, threshold: number = 0.003): boolean => {
  if (prices.length < window + 1) return false;

  const recentPrices = prices.slice(-window - 1);
  const priceChange = (recentPrices[recentPrices.length - 1] - recentPrices[0]) / recentPrices[0];

  return Math.abs(priceChange) >= threshold;
};

// 이동평균선 추세 확인 함수
export const isMATrendUp = (maSeries: number[], window: number = MA900_UPTREND_WINDOW, minSlope: number = MA900_UPTREND_MIN_SLOPE): boolean => {
  if (maSeries.length < window + 1) return false;

  const recentMA = maSeries.slice(-window - 1);
  const slope = (recentMA[recentMA.length - 1] - recentMA[0]) / recentMA[0];

  return slope >= minSlope;
};

// 매매 상태 결정 함수
export const getState = (
  currentRSI: number,
  macdBullish: boolean,
  uptrend6EA: boolean,
  momentum: number,
  surge: boolean
): string => {
  if (currentRSI < 30 && macdBullish && uptrend6EA) return 'STRONG_BUY';
  if (currentRSI < 40 && macdBullish) return 'BUY';
  if (currentRSI > 70 && !macdBullish && !uptrend6EA) return 'STRONG_SELL';
  if (currentRSI > 60 && !macdBullish) return 'SELL';
  if (surge && momentum > 0) return 'MOMENTUM_BUY';
  if (surge && momentum < 0) return 'MOMENTUM_SELL';
  return 'HOLD';
};

// 행동 결정 함수
export const chooseAction = (state: string): TradeSignal => {
  switch (state) {
    case 'STRONG_BUY':
    case 'BUY':
    case 'MOMENTUM_BUY':
      return 'buy';
    case 'STRONG_SELL':
    case 'SELL':
    case 'MOMENTUM_SELL':
      return 'sell';
    default:
      return 'hold';
  }
};

// 거래 신호 결정 함수
export const getTradeSignal = (priceData: number[], currentPrice: number): TradeSignal => {
  const rsi = calculateRSI(priceData);
  const macd = calculateMACD(priceData);
  const surge = detectPriceSurge(priceData);
  const ma900 = calculateMA(priceData, 900);
  const isUptrend = isMATrendUp(ma900);
  const bollingerSignal = isBollingerBandSignal(priceData);

  const state = getState(
    rsi,
    macd.histogram > 0 && bollingerSignal === 'buy',
    isUptrend,
    currentPrice - priceData[priceData.length - 2],
    surge
  );

  return chooseAction(state);
};

// 주문 수량 계산 함수
export const calculateOrderVolume = (currentPrice: number): string => {
  const investmentAmount = 1000000; // 예시 투자금 (1,000,000 단위)
  return (investmentAmount / currentPrice).toFixed(4);
};

// 경과 시간 포맷팅 함수
export const formatElapsedTime = (seconds: number): string => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = seconds % 60;

  if (hours > 0) {
    return `${hours}시간 ${minutes}분 ${remainingSeconds}초`;
  } else if (minutes > 0) {
    return `${minutes}분 ${remainingSeconds}초`;
  } else {
    return `${remainingSeconds}초`;
  }
}; 