import { OrderParams, TradeCycle } from './OrderTypes';
import { calculateMA, calculateRelativeSlope } from './TradingUtils';

/**
 * 경과 시간을 포맷팅합니다.
 */
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

/**
 * 자동 거래 조건을 확인합니다.
 */
export const checkTradingConditions = (
  params: OrderParams,
  currentPrice: number | null,
  priceHistory: number[],
  maPeriods: { sixty: number, threeHundredSixty: number },
  currentCycle: string
): {
  shouldProceed: boolean;
  slopes: { ma60: number; ma300: number; ma360: number; ma900: number };
  reason?: string;
} => {
  if (!currentPrice) {
    return { 
      shouldProceed: false, 
      slopes: { ma60: 0, ma300: 0, ma360: 0, ma900: 0 },
      reason: '현재 가격 정보 없음'
    };
  }

  // 이동평균 계산
  const ma60 = calculateMA(priceHistory, maPeriods.sixty);
  const ma360 = calculateMA(priceHistory, maPeriods.threeHundredSixty);

  if (ma60.length === 0 || ma360.length === 0) {
    return { 
      shouldProceed: false, 
      slopes: { ma60: 0, ma300: 0, ma360: 0, ma900: 0 },
      reason: '이동평균 데이터 부족'
    };
  }

  // 기울기 계산
  const slope60 = calculateRelativeSlope(ma60);
  const slope360 = calculateRelativeSlope(ma360);

  // 360MA 기준 위치 확인
  const isAbove360MA = currentPrice > ma360[ma360.length - 1];

  // 기울기 임계값 설정
  const buyThreshold = 0.01;   // 1%
  const sellThreshold = -0.01; // -1%

  const slopes = {
    ma60: slope60,
    ma300: slope60, // 임시로 ma60과 동일하게 설정
    ma360: slope360,
    ma900: slope360 // 임시로 ma360과 동일하게 설정
  };

  if (params.side === 'bid' && currentCycle === 'waiting_buy') {
    // 매수 조건: 360MA 위에 있지 않고, 360MA 기울기가 임계값보다 커야함
    if (!isAbove360MA && slope360 > buyThreshold) {
      return { shouldProceed: true, slopes };
    } else {
      return { 
        shouldProceed: false, 
        slopes,
        reason: `360MA 조건 불충족 (기울기: ${slope360.toFixed(4)}%, 위치: ${isAbove360MA ? '상단' : '하단'})`
      };
    }
  } else if (params.side === 'ask' && currentCycle === 'waiting_sell') {
    // 매도 조건: 360MA 위에 있고, 360MA 기울기가 임계값보다 작아야함
    if (isAbove360MA && slope360 < sellThreshold) {
      return { shouldProceed: true, slopes };
    } else {
      return { 
        shouldProceed: false, 
        slopes,
        reason: `매도 조건 불충족 (기울기: ${slope360.toFixed(4)}%, 위치: ${isAbove360MA ? '상단' : '하단'})`
      };
    }
  }

  return { 
    shouldProceed: false, 
    slopes,
    reason: `현재 상태(${currentCycle})에서 실행할 수 없는 주문: ${params.side}`
  };
};

/**
 * 거래 사이클을 업데이트합니다.
 */
export const updateTradeCycle = (
  tradeCycles: TradeCycle[],
  params: OrderParams,
  currentCycle: string,
  slopes: { ma60: number; ma300: number; ma360: number; ma900: number }
): TradeCycle[] => {
  const now = new Date().toLocaleTimeString('ko-KR', { 
    hour: '2-digit', 
    minute: '2-digit', 
    second: '2-digit' 
  });

  if (params.side === 'bid' && currentCycle === 'waiting_buy') {
    // 매수 사이클 추가
    const newCycle: TradeCycle = {
      cycle: ['매수'],
      times: [now],
      time: now,
      buyPrice: parseFloat(params.price),
      sellPrice: null,
      profit: null,
      profitAmount: null,
      slopes
    };
    return [...tradeCycles, newCycle];
  } else if (params.side === 'ask' && currentCycle === 'waiting_sell') {
    // 마지막 사이클 업데이트
    if (tradeCycles.length === 0) {
      return tradeCycles;
    }

    const lastCycle = tradeCycles[tradeCycles.length - 1];
    if (lastCycle && lastCycle.buyPrice !== null) {
      const sellPrice = parseFloat(params.price);
      const buyPrice = lastCycle.buyPrice;
      
      // 수익률 계산
      const profitPercent = ((sellPrice - buyPrice) / buyPrice * 100).toFixed(2);
      const profitAmount = (sellPrice - buyPrice).toFixed(0);

      const updatedCycle: TradeCycle = {
        ...lastCycle,
        cycle: [...lastCycle.cycle, '매도'],
        times: [...lastCycle.times, now],
        time: now,
        sellPrice: sellPrice,
        profit: `${profitPercent}%`,
        profitAmount: profitAmount,
        slopes
      };

      return [...tradeCycles.slice(0, -1), updatedCycle];
    }
  }

  return tradeCycles;
};

/**
 * 거래 상태 텍스트를 생성합니다.
 */
export const getTradeStatusText = (
  isTrading: boolean,
  currentCycle: string,
  lastTradeType: string | null,
  statusChangeTime: string | null
): string => {
  if (!isTrading) return '자동 거래 비활성화';
  
  switch (currentCycle) {
    case 'waiting_buy':
      return '매수 신호 대기 중...';
    case 'waiting_sell':
      return '매도 신호 대기 중...';
    default:
      return lastTradeType 
        ? `마지막 거래: ${lastTradeType} (${statusChangeTime || '시간 정보 없음'})` 
        : '거래 준비 중...';
  }
};

/**
 * 총 수익을 계산합니다.
 */
export const calculateTotalProfit = (cycles: TradeCycle[] = []): {
  totalProfit: string;
  totalProfitAmount: string;
  successCount: number;
  failCount: number;
} => {
  let totalProfitPercent = 0;
  let totalProfitAmount = 0;
  let successCount = 0;
  let failCount = 0;

  cycles.forEach(cycle => {
    if (cycle.profit !== null && cycle.profitAmount !== null) {
      const profitPercent = parseFloat(cycle.profit);
      const profitAmount = parseFloat(cycle.profitAmount);
      
      totalProfitPercent += profitPercent;
      totalProfitAmount += profitAmount;
      
      if (profitPercent > 0) {
        successCount++;
      } else {
        failCount++;
      }
    }
  });

  return {
    totalProfit: `${totalProfitPercent.toFixed(2)}%`,
    totalProfitAmount: totalProfitAmount.toFixed(0),
    successCount,
    failCount
  };
}; 