import { Time, LineData, SeriesMarker } from 'lightweight-charts';
import { CrossPoint, Trade, TradeStrategy } from './CandlestickChartTypes';

/**
 * 매수/매도 신호를 기반으로 마커를 생성하는 함수
 */
export const createTradeMarkers = (crossPoints: CrossPoint[], strategy: TradeStrategy): SeriesMarker<Time>[] => {
  return crossPoints.map((point) => {
    const position = point.position;
    const color = position === 'buy' ? '#2196F3' : '#FF5252';
    const shape = position === 'buy' ? 'arrowUp' : 'arrowDown';
    const text = position === 'buy' ? '매수' : '매도';
    
    return {
      time: point.time,
      position: position === 'buy' ? 'belowBar' : 'aboveBar',
      color,
      shape,
      text,
      size: 2,
    };
  });
};

/**
 * 백테스트 결과를 계산하는 함수
 */
export const calculateBacktestResult = (trades: Trade[]): {
  totalTrades: number;
  successfulTrades: number;
  totalReturn: number;
  totalNetReturn: number;
  successRate: number;
  averageReturn: number;
  averageNetReturn: number;
  trades: Trade[];
} => {
  if (!trades || trades.length === 0) {
    return {
      totalTrades: 0,
      successfulTrades: 0,
      totalReturn: 0,
      totalNetReturn: 0,
      successRate: 0,
      averageReturn: 0,
      averageNetReturn: 0,
      trades: [],
    };
  }

  const totalTrades = trades.length;
  const successfulTrades = trades.filter(trade => trade.isSuccess).length;
  const totalReturn = trades.reduce((sum, trade) => sum + trade.return, 0);
  
  // 수수료 계산 (0.05% 가정)
  const FEE_RATE = 0.0005;
  const totalNetReturn = trades.reduce((sum, trade) => {
    const netReturn = trade.return - (FEE_RATE * 2); // 매수, 매도 각각 수수료 적용
    return sum + netReturn;
  }, 0);
  
  const successRate = (successfulTrades / totalTrades) * 100;
  const averageReturn = totalReturn / totalTrades;
  const averageNetReturn = totalNetReturn / totalTrades;

  return {
    totalTrades,
    successfulTrades,
    totalReturn,
    totalNetReturn,
    successRate,
    averageReturn,
    averageNetReturn,
    trades,
  };
};

/**
 * 주문 수량을 계산하는 함수
 */
export const calculateOrderVolume = (price: number, balance: number = 100000): string => {
  // 기본 주문 금액 (10만원)
  const orderAmount = balance;
  
  // 최소 주문 단위 (0.0001 BTC)
  const minOrderUnit = 0.0001;
  
  // 주문 수량 계산
  let volume = orderAmount / price;
  
  // 최소 주문 단위로 반올림
  volume = Math.floor(volume / minOrderUnit) * minOrderUnit;
  
  // 최소 주문 금액 확인 (5000원)
  if (volume * price < 5000) {
    volume = 5000 / price;
    volume = Math.ceil(volume / minOrderUnit) * minOrderUnit;
  }
  
  return volume.toFixed(4);
}; 