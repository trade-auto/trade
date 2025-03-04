import { CrossPoint } from './tradingStrategy';

// 주문 실행을 위한 인터페이스 정의
export interface OrderDetails {
  market: string;
  side: 'bid' | 'ask';
  volume: string;
  price: string;
  ord_type: string;
  mode: string;
}

// 거래 상태 업데이트를 위한 인터페이스
export interface TradeStateUpdate {
  lastTradeType?: 'bid' | 'ask' | null;
  statusChangeTime?: string;
  currentPrice?: number;
  actionStartTime?: Date;
  isTrading?: boolean;
  theoreticalPosition?: 'bid' | 'ask' | 'wait';
  missedFirstCycle?: boolean;
}

/**
 * 주문 실행 여부를 결정하는 함수
 * @param crossPoints 매수매도 신호 배열
 * @param currentPrice 현재 가격
 * @param ma3Price 3초 이동평균 가격
 * @param isFirstBuy 초기 매수 여부
 * @param lastTradeType 마지막 거래 유형
 * @returns 주문 실행 정보 (실행 여부, 주문 유형, 가격)
 */
export const checkAndExecuteOrder = (
  crossPoints: CrossPoint[],
  currentPrice: number,
  ma3Price: number,
  isFirstBuy: boolean,
  lastTradeType: 'bid' | 'ask' | null
): { shouldExecute: boolean; side: 'bid' | 'ask'; price: number } | null => {
  console.log(`주문 실행 조건 확인: currentPrice=${currentPrice}, ma3Price=${ma3Price}, isFirstBuy=${isFirstBuy}, lastTradeType=${lastTradeType}`);
  
  // 초기 매수 조건 확인 (crossPoints에서 매수 신호가 있는지)
  if (isFirstBuy && crossPoints.length > 0) {
    const lastCrossPoint = crossPoints[crossPoints.length - 1];
    if (lastCrossPoint.position === 'buy') {
      console.log('초기 매수 신호 감지');
      return {
        shouldExecute: true,
        side: 'bid',
        price: currentPrice
      };
    }
  }
  
  // 기존 매수/매도 로직
  if (currentPrice < ma3Price * 0.999) {
    // 매수 조건
    if (lastTradeType === 'ask' || lastTradeType === null) {
      console.log('매수 조건 충족');
      return {
        shouldExecute: true,
        side: 'bid',
        price: currentPrice
      };
    }
  } else if (currentPrice > ma3Price * 1.001 && lastTradeType === 'bid') {
    // 매도 조건
    console.log('매도 조건 충족');
    return {
      shouldExecute: true,
      side: 'ask',
      price: currentPrice
    };
  }
  
  return null;
};

/**
 * 주문량을 계산하는 함수
 * @param currentPrice 현재 가격
 * @param availableFunds 사용 가능한 자금
 * @param riskPercentage 위험 비율 (기본값: 1.0 = 100%)
 * @returns 주문량 문자열
 */
export const calculateOrderVolume = (
  currentPrice: number,
  availableFunds: number = 10000, // 기본값 10,000원
  riskPercentage: number = 1.0
): string => {
  // 사용 가능한 자금의 riskPercentage%를 사용
  const fundsToUse = availableFunds * riskPercentage;
  
  // 주문량 계산 (소수점 8자리까지)
  const volume = fundsToUse / currentPrice;
  
  // 소수점 8자리로 반올림하여 문자열로 반환
  return volume.toFixed(8);
};

/**
 * 주문을 실행하는 함수
 * @param orderDetails 주문 상세 정보
 */
export const executeOrder = async (
  orderDetails: OrderDetails
): Promise<void> => {
  try {
    console.log('주문 실행:', orderDetails);
    
    // 주문 실행 로직은 여기에 구현
    
  } catch (error) {
    console.error('주문 실행 실패:', error);
    throw error; // 오류를 다시 던져서 호출자가 처리할 수 있도록 함
  }
};

/**
 * 파이썬 코드와 유사한 방식으로 매수매도 신호를 생성하는 함수
 * @param prices 가격 데이터 배열
 * @param currentPrice 현재 가격
 * @param rsi RSI 값
 * @param macdBullish MACD 상승 여부
 * @param uptrend6ea 6개 이동평균 상승 추세 여부
 * @param lowerBand 볼린저 밴드 하단
 * @param upperBand 볼린저 밴드 상단
 * @param momentum 모멘텀 값
 * @returns 매수매도 신호 ('buy', 'sell', 또는 null)
 */
export const getOptimizedTradeSignal = (
  prices: number[],
  currentPrice: number,
  rsi: number,
  macdBullish: boolean,
  uptrend6ea: boolean,
  lowerBand: number,
  upperBand: number,
  momentum: number
): 'buy' | 'sell' | null => {
  // 매수 조건
  if ((rsi < 30) || 
      (macdBullish && uptrend6ea) || 
      (currentPrice < lowerBand * 1.01 && momentum > 0)) {
    return 'buy';
  }
  
  // 매도 조건
  if ((rsi > 70) || 
      (currentPrice > upperBand * 0.99)) {
    return 'sell';
  }
  
  return null;
};

/**
 * 강화학습 기반 매수매도 신호 생성 함수
 * @param state 현재 상태 (RSI, MACD, 상승추세, 모멘텀)
 * @param qTable Q-테이블
 * @param epsilon 탐색 확률
 * @returns 행동 (0: HOLD, 1: BUY, 2: SELL)
 */
export const getReinforcementLearningSignal = (
  state: [number, number, number, number],
  qTable: Record<string, number[]>,
  epsilon: number = 0.05
): number => {
  // 상태를 문자열로 변환하여 Q-테이블에서 조회
  const stateKey = state.join(',');
  
  // 탐색 (랜덤 행동)
  if (Math.random() < epsilon) {
    return Math.floor(Math.random() * 3); // 0, 1, 2 중 랜덤 선택
  }
  
  // 활용 (최적 행동)
  const qValues = qTable[stateKey] || [0, 0, 0];
  return qValues.indexOf(Math.max(...qValues));
};

/**
 * 거래 결과를 평가하는 함수
 * @param entryPrice 진입 가격
 * @param exitPrice 청산 가격
 * @param side 매수/매도 방향
 * @param feeRate 수수료율
 * @returns 수익률
 */
export const evaluateTrade = (
  entryPrice: number,
  exitPrice: number,
  side: 'bid' | 'ask',
  feeRate: number = 0.0005
): number => {
  // 매수 후 매도
  if (side === 'bid') {
    // (매도가 * (1-수수료)) / (매수가 * (1+수수료)) - 1
    return (exitPrice * (1 - feeRate)) / (entryPrice * (1 + feeRate)) - 1;
  }
  // 매도 후 매수 (숏 포지션)
  else {
    // (매도가 * (1-수수료)) / (매수가 * (1+수수료)) - 1
    return (entryPrice * (1 - feeRate)) / (exitPrice * (1 + feeRate)) - 1;
  }
}; 