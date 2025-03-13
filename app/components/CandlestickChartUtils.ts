import { Time, SeriesMarker, SeriesMarkerPosition, SeriesMarkerShape } from 'lightweight-charts';
import { ExtendedCandlestickData } from '../types/candlestick';
import { TradeSignal } from '../types/trading';
import { getInitialDateRange, formatDate, calculateEMA, getChartEndpoint, calculateBacktestResult } from '../utils/chartHelpers';

/**
 * 매매 신호를 기반으로 차트 마커를 생성합니다.
 */
export function createTradeMarkers(signals: TradeSignal[]): SeriesMarker<Time>[] {
  // 중복 신호 제거: 같은 시간에 같은 포지션을 가진 신호는 하나만 유지
  const signalMap = new Map<string, TradeSignal>();
  
  signals.forEach(signal => {
    const key = `${signal.time}_${signal.position}`;
    signalMap.set(key, signal);
  });
  
  const uniqueSignals = Array.from(signalMap.values());
  
  // 전략별 시그널 수 로깅
  const strategyCount: Record<string, { buy: number, sell: number }> = {};
  
  uniqueSignals.forEach(signal => {
    const strategy = signal.strategy;
    if (!strategyCount[strategy]) {
      strategyCount[strategy] = { buy: 0, sell: 0 };
    }
    
    if (signal.position === 'buy') {
      strategyCount[strategy].buy++;
    } else if (signal.position === 'sell') {
      strategyCount[strategy].sell++;
    }
  });
  
  // 전략별 카운트 로깅
  console.log('=== 전략별 시그널 카운트 ===');
  Object.entries(strategyCount).forEach(([strategy, counts]) => {
    console.log(`${strategy}: 매수=${counts.buy}, 매도=${counts.sell}`);
  });
  
  console.log(`마커 생성: 총 ${signals.length}개 신호 중 중복 제거 후 ${uniqueSignals.length}개 남음`);
  
  return uniqueSignals.map(signal => {
    // position 값에 따라 마커 설정
    let position: SeriesMarkerPosition;
    let shape: SeriesMarkerShape;
    let color: string;
    let offset: number = 0; // 오프셋 추가
    
    if (signal.position === 'buy') {
      position = 'belowBar';
      shape = 'arrowUp';
      color = '#26a69a'; // 매수 - 초록색
      offset = -0.5; // 매수 마커를 약간 아래로 이동
    } else if (signal.position === 'sell') {
      position = 'aboveBar';
      shape = 'arrowDown';
      color = '#ef5350'; // 매도 - 빨간색
      offset = 0.5; // 매도 마커를 약간 위로 이동
    } else {
      position = 'inBar';
      shape = 'circle';
      color = '#ffeb3b'; // 기타 - 노란색
    }
    
    return {
      time: signal.time,
      position,
      shape,
      color,
      text: `${signal.position.toUpperCase()} - ${signal.price.toFixed(0)}`,
      size: 2, // 크기 증가
      id: signal.id,
      offset // 오프셋 적용
    };
  });
}

/**
 * 차트 높이를 조정합니다.
 */
export function adjustChartHeight(height: number): number {
  return Math.max(300, Math.min(1000, height));
}

/**
 * 볼륨 데이터를 생성합니다.
 */
export function createVolumeData(candleData: ExtendedCandlestickData[]) {
  return candleData.map(d => ({
    time: d.time,
    value: d.volume,
    color: d.close >= d.open ? '#26a69a' : '#ef5350',
  }));
}

export { getInitialDateRange, formatDate, calculateEMA, getChartEndpoint, calculateBacktestResult }; 