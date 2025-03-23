import { Time, SeriesMarker, SeriesMarkerPosition, SeriesMarkerShape } from 'lightweight-charts';
import { ExtendedCandlestickData } from '../types/candlestick';
import { TradeSignal } from '../strategies/types';
import { getInitialDateRange, formatDate, calculateEMA, getChartEndpoint, calculateBacktestResult } from '../utils/chartHelpers';

/**
 * 매매 신호를 기반으로 차트 마커를 생성합니다.
 */
export const createTradeMarkers = (signals: TradeSignal[]): SeriesMarker[] => {
  return signals.map(signal => ({
    time: signal.time,
    position: signal.position === 'buy' ? 'belowBar' : 'aboveBar',
    color: signal.position === 'buy' ? '#26a69a' : '#ef5350',
    shape: signal.position === 'buy' ? 'arrowUp' : 'arrowDown',
    text: signal.position === 'buy' ? '매수' : '매도'
  }));
};

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