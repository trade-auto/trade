import { 
  calculateRSI, 
  calculateMACD, 
  calculateBollingerBands, 
  detectPriceSurge, 
  isMATrendUp, 
  calculateMA 
} from './TradingUtils';

// 상수 정의
export const MA900_UPTREND_WINDOW = 20;
export const MA900_UPTREND_MIN_SLOPE = 0.0001;

/**
 * 볼린저 밴드 신호를 확인합니다.
 */
export const isBollingerBandSignal = (
  prices: number[], 
  period: number = 20, 
  stdDev: number = 2
): 'buy' | 'sell' | 'hold' => {
  if (prices.length < period) return 'hold';
  
  const bands = calculateBollingerBands(prices, period, stdDev);
  const currentPrice = prices[prices.length - 1];
  
  if (bands === null) return 'hold';
  if (currentPrice < bands.lower) return 'buy'; // 하단 밴드 돌파 시 매수
  if (currentPrice > bands.upper) return 'sell'; // 상단 밴드 돌파 시 매도
  return 'hold';
};

/**
 * 현재 시장 상태를 분석합니다.
 */
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

/**
 * 시장 상태에 따른 매매 행동을 결정합니다.
 */
export const chooseAction = (state: string): 'buy' | 'sell' | 'hold' => {
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

/**
 * 가격 데이터를 분석하여 매매 신호를 생성합니다.
 */
export const getTradeSignal = (priceData: number[], currentPrice: number): "buy" | "sell" | "hold" => {
  if (priceData.length < 900) return 'hold'; // 충분한 데이터가 없으면 홀드
  
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

/**
 * 주문 수량을 계산합니다.
 */
export const calculateOrderVolume = (currentPrice: number, investmentAmount: number = 1000000): string => {
  return (investmentAmount / currentPrice).toFixed(4);
}; 