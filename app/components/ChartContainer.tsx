import React, { useRef, useEffect, useCallback, memo } from 'react';
import {
  createChart,
  IChartApi,
  ISeriesApi,
  Time,
  CandlestickSeries,
  LineSeries,
  HistogramSeries,
  createSeriesMarkers,
  LineWidth,
} from 'lightweight-charts';
import { SeriesMarker } from 'lightweight-charts';
import { CrossPoint } from '../types/candlestick';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
interface CandlestickSeriesWithMarkers extends ISeriesApi<"Candlestick"> {
  setMarkers(markers: SeriesMarker<Time>[]): void;
}

interface ChartContainerProps {
  isFullscreen: boolean;
  chartHeight: number;
  toggleFullscreen: () => void;
  symbol: string;
  chartType: string;
  crossPoints: CrossPoint[];
  onChartReady: (
    chartApi: IChartApi,
    candleSeries: ISeriesApi<"Candlestick">,
    volumeSeries: ISeriesApi<"Histogram">,
    sixtyEMASeries: ISeriesApi<"Line">,
    oneTwentyEMASeries: ISeriesApi<"Line">,
    twoFortyEMASeries: ISeriesApi<"Line">,
    threeHundredSixtyEMASeries: ISeriesApi<"Line">,
    threeHundredEMASeries: ISeriesApi<"Line">,
    nineHundredEMASeries: ISeriesApi<"Line">
  ) => void;
  createTradeMarkers: (crossPoints: CrossPoint[]) => SeriesMarker<Time>[];
}

// 차트 기본 설정 상수화
const CHART_COLORS = {
  background: '#1e1e1e',
  text: '#d1d4dc',
  grid: '#2B2B2B',
  upColor: '#26a69a',
  downColor: '#ef5350',
} as const;

const MA_COLORS = {
  sixty: '#0000FF',
  oneTwenty: '#800080',
  twoForty: '#FFA500',
  threeHundredSixty: '#008000',
  threeHundred: '#00FFFF',
  nineHundred: '#FF00FF',
} as const;

// 차트 기본 옵션 설정
const getChartOptions = (width: number, height: number, chartType: string) => ({
  layout: {
    background: { color: CHART_COLORS.background },
    textColor: CHART_COLORS.text,
  },
  grid: {
    vertLines: { color: CHART_COLORS.grid },
    horzLines: { color: CHART_COLORS.grid },
  },
  width,
  height,
  timeScale: {
    timeVisible: true,
    secondsVisible: true,
    borderColor: CHART_COLORS.grid,
    tickMarkFormatter: (time: number) => {
      const date = new Date(time * 1000);
      return chartType.startsWith('seconds/') 
        ? date.toLocaleTimeString('ko-KR', { 
            hour: '2-digit', 
            minute: '2-digit', 
            second: '2-digit' 
          })
        : date.toLocaleString('ko-KR', { 
            year: 'numeric', 
            month: '2-digit', 
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
          });
    }
  },
  rightPriceScale: {
    scaleMargins: {
      top: 0.1,
      bottom: 0.2,
    },
    borderVisible: false,
  },
  crosshair: {
    mode: 1,
    vertLine: {
      width: 2 as LineWidth,
      color: '#555',
      style: 0,
    },
    horzLine: {
      width: 2 as LineWidth,
      color: '#555',
      style: 0,
    },
  },
});

type EMAKey = 'sixtyEMA' | 'oneTwentyEMA' | 'twoFortyEMA' | 'threeHundredSixtyEMA' | 'threeHundredEMA' | 'nineHundredEMA';

type SeriesRefs = {
  candle: ISeriesApi<"Candlestick"> | null;
  volume: ISeriesApi<"Histogram"> | null;
  sixtyEMA: ISeriesApi<"Line"> | null;
  oneTwentyEMA: ISeriesApi<"Line"> | null;
  twoFortyEMA: ISeriesApi<"Line"> | null;
  threeHundredSixtyEMA: ISeriesApi<"Line"> | null;
  threeHundredEMA: ISeriesApi<"Line"> | null;
  nineHundredEMA: ISeriesApi<"Line"> | null;
};

const ChartContainer: React.FC<ChartContainerProps> = memo(({
  isFullscreen,
  chartHeight,
  toggleFullscreen,
  symbol,
  chartType,
  crossPoints,
  onChartReady,
  createTradeMarkers
}) => {
  const container = useRef<HTMLDivElement>(null);
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRefs = useRef<SeriesRefs>({
    candle: null,
    volume: null,
    sixtyEMA: null,
    oneTwentyEMA: null,
    twoFortyEMA: null,
    threeHundredSixtyEMA: null,
    threeHundredEMA: null,
    nineHundredEMA: null,
  });
  const prevMarkersRef = useRef<SeriesMarker<Time>[]>([]);
  const markersInitializedRef = useRef<boolean>(false);

  // 차트 크기 조정 핸들러
  const handleResize = useCallback(() => {
    if (container.current && chartRef.current) {
      const { clientWidth } = container.current;
      chartRef.current.applyOptions({
        width: clientWidth,
        height: isFullscreen ? window.innerHeight * 0.9 : chartHeight,
      });
    }
  }, [chartHeight, isFullscreen]);

  // 차트 초기화 - 한 번만 실행되도록 수정
  const initializeChart = useCallback(() => {
    if (!container.current || chartRef.current) return;

    const { clientWidth } = container.current;
    const chart = createChart(container.current, getChartOptions(clientWidth, chartHeight, chartType));
    chartRef.current = chart;

    // 시리즈 생성
    seriesRefs.current.candle = chart.addSeries(CandlestickSeries, {
      upColor: CHART_COLORS.upColor,
      downColor: CHART_COLORS.downColor,
      borderVisible: false,
      wickUpColor: CHART_COLORS.upColor,
      wickDownColor: CHART_COLORS.downColor,
    });

    seriesRefs.current.volume = chart.addSeries(HistogramSeries, {
      color: CHART_COLORS.upColor,
      priceFormat: { type: 'volume' },
      priceScaleId: 'volume',
    });

    // MA 시리즈 생성
    Object.entries(MA_COLORS).forEach(([key, color]) => {
      const seriesKey = `${key}EMA` as EMAKey;
      (seriesRefs.current as Record<EMAKey, ISeriesApi<"Line"> | null>)[seriesKey] = chart.addSeries(LineSeries, {
        color,
        lineWidth: 2,
        visible: true,
      });
    });

    // 차트 준비 완료 콜백
    onChartReady(
      chart,
      seriesRefs.current.candle!,
      seriesRefs.current.volume!,
      seriesRefs.current.sixtyEMA!,
      seriesRefs.current.oneTwentyEMA!,
      seriesRefs.current.twoFortyEMA!,
      seriesRefs.current.threeHundredSixtyEMA!,
      seriesRefs.current.threeHundredEMA!,
      seriesRefs.current.nineHundredEMA!
    );

    // 초기 리사이즈 이벤트 리스너 설정
    window.addEventListener('resize', handleResize);

  }, [chartHeight, chartType, onChartReady, handleResize]);

  // 차트 초기화 - 컴포넌트 마운트 시 한 번만
  useEffect(() => {
    initializeChart();
    return () => {
      window.removeEventListener('resize', handleResize);
      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
      }
    };
  }, [handleResize, initializeChart]);

  // 마커 업데이트 - 최적화
  useEffect(() => {
    if (!seriesRefs.current.candle) return;

    try {
      const newMarkers = crossPoints.length > 0 ? createTradeMarkers(crossPoints) : [];
      
      // 초기 마커 설정 또는 마커 변경이 있을 때만 업데이트
      if (!markersInitializedRef.current || JSON.stringify(prevMarkersRef.current) !== JSON.stringify(newMarkers)) {
        // 기존 마커와 새 마커 비교
        const existingMarkers = prevMarkersRef.current;
        const markersToAdd = newMarkers.filter(newMarker => 
          !existingMarkers.some(existing => 
            existing.time === newMarker.time && 
            existing.position === newMarker.position
          )
        );

        // 새로운 마커만 추가
        if (markersToAdd.length > 0) {
          const allMarkers = [...existingMarkers, ...markersToAdd];
          createSeriesMarkers(seriesRefs.current.candle, allMarkers);
          prevMarkersRef.current = allMarkers;
        }

        markersInitializedRef.current = true;
      }
    } catch (error) {
      console.error('마커 업데이트 실패:', error);
    }
  }, [crossPoints, createTradeMarkers]);

  // 전체화면 변경 시 차트 크기 조정
  useEffect(() => {
    handleResize();
  }, [isFullscreen, handleResize]);

  // 차트 옵션 업데이트
  useEffect(() => {
    if (!chartRef.current) return;
    
    chartRef.current.applyOptions(getChartOptions(
      container.current?.clientWidth || 800,
      isFullscreen ? window.innerHeight * 0.9 : chartHeight,
      chartType
    ));
  }, [chartType, chartHeight, isFullscreen]);

  return (
    <div className="chart-container">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-white text-lg font-bold">
          {symbol} {chartType} 차트
        </h2>
        <button
          onClick={toggleFullscreen}
          className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded flex items-center"
        >
          {isFullscreen ? "⊖ 축소" : "⊕ 전체화면"}
        </button>
      </div>

      <div 
        ref={chartContainerRef}
        className={`relative ${isFullscreen ? 'bg-[#1e1e1e] p-4' : ''}`}
      >
        <div 
          ref={container} 
          className="w-full chart-wrapper"
          style={{ height: isFullscreen ? '90vh' : `${chartHeight}px` }}
        />
      </div>
    </div>
  );
});

ChartContainer.displayName = 'ChartContainer';

export default ChartContainer; 