import {
  CandlestickData,
  LineData,
  Time
} from 'lightweight-charts';

interface ExtendedCandlestickData extends CandlestickData<Time> {
  volume?: number;
}

interface CrossPoint {
  time: Time;
  position: 'buy' | 'sell';
  value: number;
  reason: string;
}

interface BacktestResult {
  totalTrades: number;
  successfulTrades: number;
  totalReturn: number;
  successRate: number;
  averageReturn: number;
  trades: {
    entryTime: string;
    exitTime: string;
    entryPrice: number;
    exitPrice: number;
    return: number;
    reason: string;
  }[];
}

const findCrossPoints = (
  minuteData: ExtendedCandlestickData[],
  secondData: ExtendedCandlestickData[],
  shortEMA: LineData<Time>[],
  mediumEMA: LineData<Time>[],
  longEMA: LineData<Time>[]
): CrossPoint[] => {
  const crossPoints: CrossPoint[] = [];
  let inPosition = false;
  let lastTradeTime = 0;
  const TRADE_COOLDOWN = 600; // 10분 쿨다운

  // RSI 계산
  const rsiValues = calculateRSI(minuteData, 14);

  for (let i = 1; i < shortEMA.length; i++) {
    const currentTime = minuteData[i].time as number;
    
    // 1. 매수 신호
    if (!inPosition && (currentTime - lastTradeTime) > TRADE_COOLDOWN) {
      // 3MA가 6MA를 상향돌파 (골든크로스)
      const isGoldenCross = shortEMA[i-1].value <= mediumEMA[i-1].value && 
                           shortEMA[i].value > mediumEMA[i].value;
      
      // 3MA와 6MA 사이 거리가 좁아짐 (수렴)
      const prevGap = Math.abs(shortEMA[i-1].value - mediumEMA[i-1].value);
      const currGap = Math.abs(shortEMA[i].value - mediumEMA[i].value);
      const isConverging = currGap < prevGap;
      
      // 양봉 확인
      const isBullish = minuteData[i].close > minuteData[i].open &&
                       minuteData[i].close > minuteData[i-1].close;
      
      // 거래량 증가
      const volumeIncrease = (minuteData[i]?.volume ?? 0) > 
                            (minuteData[i-1]?.volume ?? 0) * 1.5;

      if (isGoldenCross && isConverging && isBullish && volumeIncrease) {
            crossPoints.push({
          time: shortEMA[i].time,
              position: 'buy',
          value: minuteData[i].close,
          reason: '골든크로스+수렴+상승'
        });
        inPosition = true;
        lastTradeTime = currentTime;
      }
    }
    
    // 2. 매도 신호
    else if (inPosition) {
      const lastBuy = crossPoints.findLast(p => p.position === 'buy');
      if (!lastBuy) continue;

      const profit = (minuteData[i].close - lastBuy.value) / lastBuy.value;
      
      // 3MA가 6MA를 하향돌파 (데드크로스)
      const isDeadCross = shortEMA[i-1].value >= mediumEMA[i-1].value && 
                         shortEMA[i].value < mediumEMA[i].value;
      
      // 3MA와 6MA 사이 거리가 벌어짐 (발산)
      const prevGap = Math.abs(shortEMA[i-1].value - mediumEMA[i-1].value);
      const currGap = Math.abs(shortEMA[i].value - mediumEMA[i].value);
      const isDiverging = currGap > prevGap * 1.2; // 20% 이상 벌어질 때
      
      // 이익실현 (2% 이상)
      if (profit >= 0.02) {
        crossPoints.push({
          time: shortEMA[i].time,
          position: 'sell',
          value: minuteData[i].close,
          reason: '이익실현 (2%)'
        });
        inPosition = false;
        lastTradeTime = currentTime;
      }
      // 데드크로스 + 발산
      else if (isDeadCross && isDiverging) {
        crossPoints.push({
          time: shortEMA[i].time,
          position: 'sell',
          value: minuteData[i].close,
          reason: '데드크로스+발산'
        });
        inPosition = false;
        lastTradeTime = currentTime;
      }
      // 손절 (-1% 이하)
      else if (profit <= -0.01) {
        crossPoints.push({
          time: shortEMA[i].time,
          position: 'sell',
          value: minuteData[i].close,
          reason: '손절 (-1%)'
        });
        inPosition = false;
        lastTradeTime = currentTime;
      }
    }
  }

  return crossPoints;
};

  const calculateRSI = (data: CandlestickData<Time>[], period: number): number[] => {
    const rsi: number[] = [];
    let gains = 0;
    let losses = 0;

  for (let i = 1; i < data.length; i++) {
    const diff = data[i].close - data[i-1].close;
    gains = (diff > 0 ? diff : 0 + gains * (period - 1)) / period;
    losses = (diff < 0 ? -diff : 0 + losses * (period - 1)) / period;
    
    if (i >= period) {
      const rs = gains / (losses || 1);
      rsi[i] = 100 - (100 / (1 + rs));
    }
  }
    return rsi;
  };

const getTimestamp = (time: Time): number => {
  if (typeof time === 'number') return time * 1000;
  if (typeof time === 'string') return new Date(time).getTime();
  return new Date(time.year, time.month - 1, time.day).getTime();
};

// 백테스팅 결과 계산 함수 수정
  const calculateBacktestResult = (data: CandlestickData<Time>[], crossPoints: CrossPoint[]): BacktestResult => {
    const FEE = 0.0005; // 0.05% 수수료
    const trades = [];
    
    // 시간순으로 정렬
    const sortedCrossPoints = [...crossPoints].sort((a, b) => 
    getTimestamp(a.time) - getTimestamp(b.time)
  );
  
  let currentPosition = null;
  
  for (const point of sortedCrossPoints) {
    const timestamp = getTimestamp(point.time);
    
      if (point.position === 'buy' && !currentPosition) {
        currentPosition = { 
        time: new Date(timestamp).toLocaleString(),
          price: point.value,
          reason: point.reason 
        };
    } else if (point.position === 'sell' && currentPosition) {
        trades.push({
          entryTime: currentPosition.time,
        exitTime: new Date(timestamp).toLocaleString(),
        entryPrice: currentPosition.price,
        exitPrice: point.value,
        return: ((point.value - currentPosition.price) / currentPosition.price) - (FEE * 2),
          reason: `${currentPosition.reason} → ${point.reason}`
        });
        currentPosition = null;
      }
    }
    
  const successfulTrades = trades.filter(t => t.return > 0).length;
    const totalReturn = trades.reduce((sum, t) => sum + t.return, 0);
    
    return {
      totalTrades: trades.length,
      successfulTrades,
      totalReturn,
      successRate: trades.length > 0 ? (successfulTrades / trades.length) * 100 : 0,
      averageReturn: trades.length > 0 ? totalReturn / trades.length : 0,
      trades
    };
}; 