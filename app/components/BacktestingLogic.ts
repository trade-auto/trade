import { TradeCycle } from './OrderTypes';
import { getTradeSignal } from './TradingStrategies';
import { calculateMA, calculateRelativeSlope } from './TradingUtils';

/**
 * 백테스트 결과 인터페이스
 */
export interface BacktestResult {
  trades: TradeCycle[];
  totalProfit: number;
  winRate: number;
  averageProfit: number;
  maxDrawdown: number;
  profitFactor: number;
}

/**
 * 백테스트 설정 인터페이스
 */
export interface BacktestSettings {
  startDate: Date;
  endDate: Date;
  initialCapital: number;
  feeRate: number;
  slippage: number;
}

/**
 * 백테스트 데이터 포인트 인터페이스
 */
export interface BacktestDataPoint {
  timestamp: number;
  price: number;
  volume?: number;
}

/**
 * 백테스트를 실행합니다.
 */
export const runBacktest = (
  priceData: number[],
  timestamps: number[],
  settings: BacktestSettings
): BacktestResult => {
  if (priceData.length === 0 || timestamps.length === 0) {
    return {
      trades: [],
      totalProfit: 0,
      winRate: 0,
      averageProfit: 0,
      maxDrawdown: 0,
      profitFactor: 0
    };
  }

  const trades: TradeCycle[] = [];
  let currentPosition: 'none' | 'long' = 'none';
  let entryPrice = 0;
  let entryTime = '';
  let entryTimestamp = 0;
  let totalProfit = 0;
  let winCount = 0;
  let lossCount = 0;
  let maxDrawdown = 0;
  let peakValue = settings.initialCapital;
  let currentValue = settings.initialCapital;
  let totalGain = 0;
  let totalLoss = 0;

  // 이동평균 계산
  const ma60 = calculateMA(priceData, 60);
  const ma360 = calculateMA(priceData, 360);

  // 백테스트 시작 인덱스 (충분한 데이터가 있는 시점부터)
  const startIndex = Math.max(360, 0);

  for (let i = startIndex; i < priceData.length; i++) {
    const currentPrice = priceData[i];
    const timestamp = timestamps[i];
    const date = new Date(timestamp);
    
    // 날짜 범위 확인
    if (date < settings.startDate || date > settings.endDate) {
      continue;
    }

    // 현재 시간 포맷팅
    const timeString = date.toLocaleTimeString('ko-KR', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });

    // 이전 데이터로 신호 생성 (룩어헤드 바이어스 방지)
    const lookbackData = priceData.slice(0, i);
    const signal = getTradeSignal(lookbackData, currentPrice);

    // 기울기 계산
    const slope60 = i >= 60 ? calculateRelativeSlope(ma60.slice(0, i - startIndex + 1)) : 0;
    const slope360 = i >= 360 ? calculateRelativeSlope(ma360.slice(0, i - startIndex + 1)) : 0;

    const slopes = {
      ma60: slope60,
      ma300: slope60, // 임시로 ma60과 동일하게 설정
      ma360: slope360,
      ma900: slope360 // 임시로 ma360과 동일하게 설정
    };

    // 매매 로직
    if (currentPosition === 'none' && signal === 'buy') {
      // 매수 진입
      currentPosition = 'long';
      entryPrice = currentPrice;
      entryTime = timeString;
      entryTimestamp = timestamp;
      
      // 슬리피지 적용
      const adjustedEntryPrice = entryPrice * (1 + settings.slippage);
      
      // 새 거래 사이클 시작
      trades.push({
        cycle: ['매수'],
        times: [timeString],
        time: timeString,
        buyPrice: adjustedEntryPrice,
        sellPrice: null,
        profit: null,
        profitAmount: null,
        slopes
      });
    } 
    else if (currentPosition === 'long' && signal === 'sell') {
      // 매도 청산
      currentPosition = 'none';
      const exitPrice = currentPrice;
      
      // 슬리피지 적용
      const adjustedExitPrice = exitPrice * (1 - settings.slippage);
      
      // 수수료 적용
      const entryWithFee = entryPrice * (1 + settings.feeRate);
      const exitWithFee = adjustedExitPrice * (1 - settings.feeRate);
      
      // 수익률 계산
      const profitPercent = ((exitWithFee - entryWithFee) / entryWithFee) * 100;
      const profitAmount = exitWithFee - entryWithFee;
      
      // 거래 기록 업데이트
      if (trades.length > 0) {
        const lastIndex = trades.length - 1;
        trades[lastIndex] = {
          ...trades[lastIndex],
          cycle: [...trades[lastIndex].cycle, '매도'],
          times: [...trades[lastIndex].times, timeString],
          time: timeString,
          sellPrice: adjustedExitPrice,
          profit: `${profitPercent.toFixed(2)}%`,
          profitAmount: profitAmount.toFixed(0),
          slopes
        };
        
        // 통계 업데이트
        totalProfit += profitPercent;
        if (profitPercent > 0) {
          winCount++;
          totalGain += profitPercent;
        } else {
          lossCount++;
          totalLoss += Math.abs(profitPercent);
        }
        
        // 자본금 업데이트
        currentValue = currentValue * (1 + (profitPercent / 100));
        
        // 최대 낙폭 계산
        if (currentValue > peakValue) {
          peakValue = currentValue;
        } else {
          const drawdown = (peakValue - currentValue) / peakValue * 100;
          if (drawdown > maxDrawdown) {
            maxDrawdown = drawdown;
          }
        }
      }
    }
  }

  // 결과 계산
  const totalTrades = winCount + lossCount;
  const winRate = totalTrades > 0 ? (winCount / totalTrades) * 100 : 0;
  const averageProfit = totalTrades > 0 ? totalProfit / totalTrades : 0;
  const profitFactor = totalLoss > 0 ? totalGain / totalLoss : totalGain > 0 ? Infinity : 0;

  return {
    trades,
    totalProfit,
    winRate,
    averageProfit,
    maxDrawdown,
    profitFactor
  };
};

/**
 * 백테스트 결과를 요약합니다.
 */
export const summarizeBacktestResult = (result: BacktestResult): string => {
  return `백테스트 결과:
- 총 거래 수: ${result.trades.length}
- 총 수익률: ${result.totalProfit.toFixed(2)}%
- 승률: ${result.winRate.toFixed(2)}%
- 평균 수익률: ${result.averageProfit.toFixed(2)}%
- 최대 낙폭: ${result.maxDrawdown.toFixed(2)}%
- 수익 요소: ${result.profitFactor.toFixed(2)}`;
}; 