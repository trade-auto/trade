import { Time, SeriesMarker, SeriesMarkerPosition, SeriesMarkerShape } from 'lightweight-charts';
import { ExtendedCandlestickData } from '../types/candlestick';
import { TradeSignal } from '../strategies/types';
import { formatDate, calculateEMA, getChartEndpoint, calculateBacktestResult } from '../utils/chartHelpers';

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

export const getInitialDateRange = (type: string): DateRange => {
  const now = new Date();
  let startDate: Date;
  
  if (type.startsWith('seconds/')) {
    // 초봉: 최근 2시간 데이터 (기존 설정 유지)
    startDate = new Date(now.getTime() - 2 * 60 * 60 * 1000);
  } else if (type.startsWith('minutes/')) {
    // 분봉: 캔들 갯수에 맞게 시간 설정
    const minutesInterval = parseInt(type.split('/')[1]);
    if (minutesInterval === 5) {
      // 5분봉: 5분 × 576개 = 2880분 = 48시간
      startDate = new Date(now.getTime() - (5 * 576) * 60 * 1000);
      console.log(`5분봉 576개를 위한 시작 시간 설정: ${startDate.toLocaleString('ko-KR')}`);
    } else if (minutesInterval === 15) {
      // 15분봉: 15분 × 672개 = 10080분 = 168시간 = 7일
      startDate = new Date(now.getTime() - (15 * 672) * 60 * 1000);
      console.log(`15분봉 672개를 위한 시작 시간 설정: ${startDate.toLocaleString('ko-KR')}`);
    } else {
      // 기타 분봉: 기본 2시간 데이터
      startDate = new Date(now.getTime() - 2 * 60 * 60 * 1000);
    }
  } else {
    // 일봉: 최근 1일 데이터
    startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  }
  
  return {
    startDate,
    endDate: null
  };
};

export { formatDate, calculateEMA, getChartEndpoint, calculateBacktestResult }; 