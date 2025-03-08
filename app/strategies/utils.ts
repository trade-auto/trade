import { CandlestickData, Time } from 'lightweight-charts';

// EMA 계산 유틸리티 함수
export function calculateEMA(data: CandlestickData<Time>[], period: number): { time: Time; value: number }[] {
  const k = 2 / (period + 1);
  const emaData: { time: Time; value: number }[] = [];
  let ema = data[0].close;

  for (let i = 0; i < data.length; i++) {
    ema = data[i].close * k + ema * (1 - k);
    emaData.push({ time: data[i].time, value: ema });
  }

  return emaData;
}

// 임시 캔들 데이터 생성 함수
export function createTempCandleData(time: Time, close: number): CandlestickData<Time> {
  return {
    time,
    open: close,
    high: close,
    low: close,
    close
  };
}

// RSI 계산 함수
export function calculateRSI(prices: number[]): number {
  if (prices.length < 14) {
    return 50; // 기본값
  }

  let gains = 0;
  let losses = 0;

  for (let i = 1; i < 14; i++) {
    const change = prices[i] - prices[i - 1];
    if (change >= 0) {
      gains += change;
    } else {
      losses -= change;
    }
  }

  if (losses === 0) {
    return 100;
  }

  let rs = gains / losses;
  return 100 - (100 / (1 + rs));
}

// 이동평균 계산 함수
export function calculateMA(prices: number[], period: number): number[] {
  const result = [];
  for (let i = period - 1; i < prices.length; i++) {
    const slice = prices.slice(i - period + 1, i + 1);
    const avg = slice.reduce((sum, price) => sum + price, 0) / period;
    result.push(avg);
  }
  return result;
}

// 각도 계산 함수
export function getAngle(ma: number[]): number {
  if (ma.length < 2) return 0;
  const last = ma[ma.length - 1];
  const prev = ma[ma.length - 2];
  return Math.atan2(last - prev, 1) * (180 / Math.PI);
}

// MACD 계산 함수
export function calculateMACD(prices: number[]): { macd: number; signal: number; histogram: number } {
  // 간단한 구현을 위해 기본값 반환
  return { macd: 0, signal: 0, histogram: 0 };
}

// 볼린저 밴드 신호 계산 함수
export function isBollingerBandSignal(prices: number[]): 'buy' | 'sell' | 'hold' {
  // 간단한 구현을 위해 기본값 반환
  return 'hold';
}

// 상단 볼린저 밴드 계산 함수
export function calculateUpperBand(prices: number[], period: number = 20, stdDevMultiplier: number = 2): number {
  const ma = prices.slice(-period).reduce((sum, price) => sum + price, 0) / period;
  const stdDev = calculateStandardDeviation(prices.slice(-period));
  return ma + (stdDev * stdDevMultiplier);
}

// 하단 볼린저 밴드 계산 함수
export function calculateLowerBand(prices: number[], period: number = 20, stdDevMultiplier: number = 2): number {
  const ma = prices.slice(-period).reduce((sum, price) => sum + price, 0) / period;
  const stdDev = calculateStandardDeviation(prices.slice(-period));
  return ma - (stdDev * stdDevMultiplier);
}

// 표준편차 계산 함수
export function calculateStandardDeviation(prices: number[]): number {
  const mean = prices.reduce((sum, price) => sum + price, 0) / prices.length;
  const squaredDiffs = prices.map(price => Math.pow(price - mean, 2));
  const variance = squaredDiffs.reduce((sum, diff) => sum + diff, 0) / prices.length;
  return Math.sqrt(variance);
}

// 이동평균 기울기 계산 함수
export function calculateMASlope(data: CandlestickData<Time>[], period: number): number {
  if (data.length < period + 10) return 0;
  
  const prices = data.map(d => d.close);
  const ma = calculateMA(prices, period);
  
  // 최근 10개 포인트의 기울기 계산
  const recentMA = ma.slice(-10);
  const firstMA = recentMA[0];
  const lastMA = recentMA[recentMA.length - 1];
  
  return ((lastMA - firstMA) / firstMA) * 100;
}

// 시간 값 변환 함수
export function getTimeValue(time: Time): number {
  if (typeof time === 'number') {
    return time;
  } else if (typeof time === 'string') {
    return new Date(time).getTime() / 1000;
  } else {
    // BusinessDay 타입 처리
    if ('year' in time && 'month' in time && 'day' in time) {
      const { year, month, day } = time;
      return new Date(year, month - 1, day).getTime() / 1000;
    }
    return 0;
  }
}

// 차트 데이터 전처리 함수
export function preprocessChartData(data: CandlestickData<Time>[]): CandlestickData<Time>[] {
  return data.map(candle => {
    const newTime = typeof candle.time === 'string' 
      ? new Date(candle.time).getTime() / 1000 as Time
      : candle.time;
    
    return {
      ...candle,
      time: newTime
    };
  });
} 