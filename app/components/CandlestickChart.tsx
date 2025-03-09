import { useCallback, useEffect, useState, useRef, ChangeEvent } from 'react';
import {
  IChartApi,
  ISeriesApi,
  Time,
  SeriesMarker,
  SeriesMarkerPosition,
  SeriesMarkerShape,
  ISeriesMarkersPluginApi,
  createSeriesMarkers
} from 'lightweight-charts';
import {
  DateRange,
  ExtendedCandlestickData,
  UpbitCandle,
  BacktestResult,
  MASettings,
  OrderParams,
  CandlestickChartProps,
  TradeSignal
} from '../types/candlestick';
import ChartControls from './ChartControls';
import ChartPrice from './ChartPrice';
import ChartSettings from './ChartSettings';
import BacktestResults from './BacktestResults';
import CsvDownloader from './CsvDownloader';
import ChartContainer from './ChartContainer';
import {
  getInitialDateRange,
  createTradeMarkers,
  calculateEMA,
  getChartEndpoint,
  calculateBacktestResult,
  formatDate,
  formatDateForAPI,
  processCandle
} from '../utils/chartHelpers';
import useUpbitStore from '../store/useUpbitStore';
import TradingStrategyHover from './TradingStrategyHover';
import axios from 'axios';

// OrderParams 타입을 다시 내보냅니다
export type { OrderParams };

const CandlestickChart: React.FC<CandlestickChartProps> = (props) => {
  // ... existing code ...
  return (
          <div>
      {/* 컴포넌트 내용 */}
    </div>
  );
}

export default CandlestickChart;
