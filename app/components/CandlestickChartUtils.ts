import { Time, SeriesMarker, SeriesMarkerPosition, SeriesMarkerShape } from 'lightweight-charts';
import { ExtendedCandlestickData, TradeSignal } from '../types/candlestick';
import { getInitialDateRange, formatDate, calculateEMA, getChartEndpoint, calculateBacktestResult } from '../utils/chartHelpers';

/**
 * 매매 신호를 기반으로 차트 마커를 생성합니다.
 */
export function createTradeMarkers(signals: TradeSignal[]): SeriesMarker<Time>[] {
  return signals.map(signal => {
    // position 값에 따라 마커 설정
    let position: SeriesMarkerPosition;
    let shape: SeriesMarkerShape;
    let color: string;
    
    if (signal.position === 'long') {
      position = 'belowBar';
      shape = 'arrowUp';
      color = '#26a69a'; // 매수(롱) - 초록색
    } else if (signal.position === 'short') {
      position = 'aboveBar';
      shape = 'arrowDown';
      color = '#ef5350'; // 매도(숏) - 빨간색
    } else { // 'close'
      position = 'inBar';
      shape = 'circle';
      color = '#ef5350'; // 포지션 종료 - 빨간색으로 변경
    }
    
    return {
      time: signal.time as Time,
      position,
      shape,
      color,
      text: `${signal.position.toUpperCase()} - ${signal.price.toFixed(0)}`,
      size: 1,
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