// 거래 전략 관련 유틸리티 함수
import { 
  calculateRSI, 
  calculateMACD, 
  isMATrendUp, 
  detectPriceSurge, 
  isBollingerBandSignal,
  calculateMA
} from './indicators';

// 매매 상태 및 행동 결정 함수
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

// 거래 신호 계산
export const getTradeSignal = (priceData: number[], currentPrice: number): "buy" | "sell" | "hold" => {
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

// 주문 수량 계산
export const calculateOrderVolume = (currentPrice: number): string => {
  const investmentAmount = 1000000; // 예시 투자금 (1,000,000 단위)
  return (investmentAmount / currentPrice).toFixed(4);
}; 