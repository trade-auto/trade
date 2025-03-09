/**
 * 이동평균선의 상대적 기울기를 계산합니다.
 */
export const calculateRelativeSlope = (ma: number[]): number => {
  if (ma.length < 2) return 0;
  const current = ma[ma.length - 1];
  const previous = ma[ma.length - 2];
  return ((current - previous) / previous) * 100;
};

/**
 * 단순 이동평균(SMA)을 계산합니다.
 */
export const calculateMA = (priceData: number[], period: number): number[] => {
  if (priceData.length < period) return [];
  const result: number[] = [];
  for (let i = 0; i <= priceData.length - period; i++) {
    const sum = priceData.slice(i, i + period).reduce((a, b) => a + b, 0);
    result.push(sum / period);
  }
  return result;
};

/**
 * 지수 이동평균(EMA)을 계산합니다.
 */
export const calculateEMA = (data: number[], period: number): number[] => {
  if (data.length < period) return [];
  
  const k = 2 / (period + 1);
  const emaData: number[] = [];
  let ema = data[0];
  
  for (let i = 0; i < data.length; i++) {
    ema = data[i] * k + ema * (1 - k);
    emaData.push(ema);
  }
  
  return emaData;
};

/**
 * 상대강도지수(RSI)를 계산합니다.
 */
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

/**
 * MACD(Moving Average Convergence Divergence)를 계산합니다.
 */
export const calculateMACD = (
  prices: number[], 
  fastPeriod: number = 12, 
  slowPeriod: number = 26, 
  signalPeriod: number = 9
): { macd: number, signal: number, histogram: number } => {
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

/**
 * 볼린저 밴드를 계산합니다.
 */
export const calculateBollingerBands = (
  prices: number[], 
  period: number = 20, 
  multiplier: number = 2
): { upper: number, middle: number, lower: number } | null => {
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

/**
 * 가격 급등을 감지합니다.
 */
export const detectPriceSurge = (
  prices: number[], 
  window: number = 5, 
  threshold: number = 0.003
): boolean => {
  if (prices.length < window + 1) return false;

  const recentPrices = prices.slice(-window - 1);
  const priceChange = (recentPrices[recentPrices.length - 1] - recentPrices[0]) / recentPrices[0];
  
  return priceChange > threshold;
};

/**
 * 이동평균선의 상승 추세를 확인합니다.
 */
export const isMATrendUp = (
  maSeries: number[], 
  window: number = 20, 
  minSlope: number = 0.0001
): boolean => {
  if (maSeries.length < window) return false;
  
  const recentMA = maSeries.slice(-window);
  const slope = (recentMA[recentMA.length - 1] - recentMA[0]) / recentMA[0];
  
  return slope > minSlope;
}; 