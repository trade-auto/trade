import React, { useCallback, useState } from 'react';
import { IChartApi, ISeriesApi, Time, SeriesMarker } from 'lightweight-charts';
import ChartContainer from './ChartContainer';
import BacktestChartContainer from './BacktestChartContainer';

interface OrderParams {
  market: string;
  side: 'bid' | 'ask';
  volume: string;
  price: string;
  ord_type: string;
  mode: string;
}

interface CandlestickChartProps {
  symbol: string;
  chartType: string;
  initialAutoUpdate?: boolean;
  mode?: 'live' | 'test';
  handleOrder?: (params: OrderParams) => Promise<void>;
  onOrder?: (price: number, isMarketOrder: boolean) => void;
}

const CandlestickChart = React.memo<CandlestickChartProps>(({
  symbol,
  chartType,
  initialAutoUpdate = true,
  mode,
  handleOrder,
  onOrder,
}) => {
  const [chartHeight] = useState(500);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [markers, setMarkers] = useState<SeriesMarker<Time>[]>([]);
  const [backtestMarkers, setBacktestMarkers] = useState<SeriesMarker<Time>[]>([]);
  
  const toggleFullscreen = useCallback(() => {
    setIsFullscreen(prev => !prev);
  }, []);

  const handleChartReady = useCallback((
    chartApi: IChartApi,
    candleSeries: ISeriesApi<"Candlestick">,
    volumeSeries: ISeriesApi<"Histogram">,
    sixtyEMASeries: ISeriesApi<"Line">,
    oneTwentyEMASeries: ISeriesApi<"Line">,
    twoFortyEMASeries: ISeriesApi<"Line">,
    threeHundredSixtyEMASeries: ISeriesApi<"Line">,
    threeHundredEMASeries: ISeriesApi<"Line">,
    nineHundredEMASeries: ISeriesApi<"Line">,
    twelveHundredEMASeries: ISeriesApi<"Line">
  ) => {
    // 차트 초기화 로직
  }, []);

  const handleBacktestChartReady = useCallback((
    chartApi: IChartApi,
    candleSeries: ISeriesApi<"Candlestick">,
    volumeSeries: ISeriesApi<"Histogram">,
    sixtyEMASeries: ISeriesApi<"Line">,
    oneTwentyEMASeries: ISeriesApi<"Line">,
    twoFortyEMASeries: ISeriesApi<"Line">,
    threeHundredSixtyEMASeries: ISeriesApi<"Line">,
    threeHundredEMASeries: ISeriesApi<"Line">,
    nineHundredEMASeries: ISeriesApi<"Line">,
    twelveHundredEMASeries: ISeriesApi<"Line">
  ) => {
    // 백테스트 차트 초기화 로직
  }, []);

  return (
    <div className="candlestick-chart">
          <ChartContainer
        chartHeight={chartHeight}
            isFullscreen={isFullscreen}
            toggleFullscreen={toggleFullscreen}
            symbol={symbol}
        chartType={chartType}
            markers={markers}
            onChartReady={handleChartReady}
          />
      {mode === 'test' && (
        <BacktestChartContainer
                chartHeight={chartHeight}
                markers={backtestMarkers}
                onChartReady={handleBacktestChartReady}
              />
      )}
    </div>
  );
});

export default CandlestickChart;