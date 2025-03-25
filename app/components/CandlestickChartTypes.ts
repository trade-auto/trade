import { Time } from 'lightweight-charts';
import { ExtendedCandlestickData, DateRange, BacktestResult } from '../types/candlestick';
import { UpbitCandle } from '../types/candlestick';

export interface OrderParams {
  market: string;
  side: 'bid' | 'ask';
  volume: string;
  price: string;
  ord_type: string;
  mode: string;
}

export interface CandlestickChartProps {
  symbol: string;
  chartType: string;
  initialAutoUpdate?: boolean;
  mode?: 'live' | 'test';
  initialDataCount?: number;
  handleOrder?: (params: OrderParams) => Promise<void>;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  onOrder?: (price: number, isMarketOrder: boolean) => void;
  onChartTypeChange?: (type: string) => void;
}

export interface RealtimeUpdateStatus {
  isUpdating: boolean;
  lastUpdateTime: string | null;
  updateCount: number;
}

export interface AnalysisResult {
  lastProcessedIndex: number;
  currentPosition: 'long' | null;
  lastTradeId: string | null;
  entryPrice?: number;
}

export interface ChartRefs {
  chartRef: React.MutableRefObject<any>;
  candleSeriesRef: React.MutableRefObject<any>;
  volumeSeriesRef: React.MutableRefObject<any>;
  sixtyEMASeriesRef: React.MutableRefObject<any>;
  oneTwentyEMASeriesRef: React.MutableRefObject<any>;
  twoFortyEMASeriesRef: React.MutableRefObject<any>;
  threeHundredSixtyEMASeriesRef: React.MutableRefObject<any>;
  threeHundredEMASeriesRef: React.MutableRefObject<any>;
  nineHundredEMASeriesRef: React.MutableRefObject<any>;
}

export interface BacktestChartRefs {
  backtestChartApiRef: React.MutableRefObject<any>;
  backtestCandleSeriesRef: React.MutableRefObject<any>;
  backtestVolumeSeriesRef: React.MutableRefObject<any>;
  backtestSixtyEMASeriesRef: React.MutableRefObject<any>;
  backtestOneTwentyEMASeriesRef: React.MutableRefObject<any>;
  backtestTwoFortyEMASeriesRef: React.MutableRefObject<any>;
  backtestThreeHundredSixtyEMASeriesRef: React.MutableRefObject<any>;
  backtestThreeHundredEMASeriesRef: React.MutableRefObject<any>;
  backtestNineHundredEMASeriesRef: React.MutableRefObject<any>;
}

export interface MASettings {
  five: boolean;       // 5 EMA
  ten: boolean;        // 10 EMA
  twenty: boolean;     // 20 EMA
  thirty: boolean;     // 30 EMA
  ninety: boolean;     // 90 EMA
  sixty: boolean;
  oneTwenty: boolean;
  twoForty: boolean;
  threeHundredSixty: boolean;
  sixHundred: boolean;
  nineHundred: boolean;
}

export type { ExtendedCandlestickData, DateRange, BacktestResult, UpbitCandle, Time }; 