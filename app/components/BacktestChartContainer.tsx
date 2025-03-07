import React, { useRef, useEffect, useCallback, memo } from 'react';
import {
  createChart,
  IChartApi,
  ISeriesApi,
  Time,
  SeriesMarker,
  LineWidth,
} from 'lightweight-charts';
import { useUpbitStore } from '../store/useUpbitStore';

interface CandlestickSeriesWithMarkers extends ISeriesApi<"Candlestick"> {
  setMarkers?: (markers: SeriesMarker<Time>[]) => void;
}

interface BacktestChartContainerProps {
  chartHeight: number;
  markers: SeriesMarker<Time>[];
  onChartReady: (
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
  ) => void;
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
  twelveHundred: '#FF0000'
} as const;

// 차트 기본 옵션 설정
const getChartOptions = (width: number, height: number) => ({
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

interface SeriesRefs {
  candle: CandlestickSeriesWithMarkers | null;
  volume: ISeriesApi<"Histogram"> | null;
  sixtyEMA: ISeriesApi<"Line"> | null;
  oneTwentyEMA: ISeriesApi<"Line"> | null;
  twoFortyEMA: ISeriesApi<"Line"> | null;
  threeHundredSixtyEMA: ISeriesApi<"Line"> | null;
  threeHundredEMA: ISeriesApi<"Line"> | null;
  nineHundredEMA: ISeriesApi<"Line"> | null;
  twelveHundredEMA: ISeriesApi<"Line"> | null;
}

const BacktestChartContainer: React.FC<BacktestChartContainerProps> = memo(({
  chartHeight,
  markers,
  onChartReady,
}) => {
  const container = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const markerPluginRef = useRef<any | null>(null);
  const seriesRefs = useRef<SeriesRefs>({
    candle: null,
    volume: null,
    sixtyEMA: null,
    oneTwentyEMA: null,
    twoFortyEMA: null,
    threeHundredSixtyEMA: null,
    threeHundredEMA: null,
    nineHundredEMA: null,
    twelveHundredEMA: null,
  });

  const handleResize = useCallback(() => {
    if (container.current && chartRef.current) {
      const { clientWidth } = container.current;
      chartRef.current.applyOptions({
        width: clientWidth,
        height: chartHeight,
      });
    }
  }, [chartHeight]);

  const initializeChart = useCallback(() => {
    if (!container.current || chartRef.current) return;
    
    const clientWidth = container.current.clientWidth;
    
    try {
      // 차트 생성
      const chart = createChart(container.current, getChartOptions(clientWidth, chartHeight));
      chartRef.current = chart;

      // 캔들스틱 시리즈 생성
      const candleSeries = (chart as any).createCandlestickSeries({
        upColor: CHART_COLORS.upColor,
        downColor: CHART_COLORS.downColor,
        borderVisible: false,
        wickUpColor: CHART_COLORS.upColor,
        wickDownColor: CHART_COLORS.downColor,
      });
      seriesRefs.current.candle = candleSeries;

      // 볼륨 시리즈 생성
      const volumeSeries = (chart as any).createHistogramSeries({
        color: '#26a69a',
        priceFormat: {
          type: 'volume',
        },
        priceScaleId: 'volume',
      });
      seriesRefs.current.volume = volumeSeries;

      // EMA 시리즈 생성
      const sixtyEMA = (chart as any).createLineSeries({
        color: MA_COLORS.sixty,
        lineWidth: 1,
        title: '60 EMA',
      });
      seriesRefs.current.sixtyEMA = sixtyEMA;

      const oneTwentyEMA = (chart as any).createLineSeries({
        color: MA_COLORS.oneTwenty,
        lineWidth: 1,
        title: '120 EMA',
      });
      seriesRefs.current.oneTwentyEMA = oneTwentyEMA;

      const twoFortyEMA = (chart as any).createLineSeries({
        color: MA_COLORS.twoForty,
        lineWidth: 1,
        title: '240 EMA',
      });
      seriesRefs.current.twoFortyEMA = twoFortyEMA;

      const threeHundredSixtyEMA = (chart as any).createLineSeries({
        color: MA_COLORS.threeHundredSixty,
        lineWidth: 1,
        title: '360 EMA',
      });
      seriesRefs.current.threeHundredSixtyEMA = threeHundredSixtyEMA;

      const threeHundredEMA = (chart as any).createLineSeries({
        color: MA_COLORS.threeHundred,
        lineWidth: 1,
        title: '300 EMA',
      });
      seriesRefs.current.threeHundredEMA = threeHundredEMA;

      const nineHundredEMA = (chart as any).createLineSeries({
        color: MA_COLORS.nineHundred,
        lineWidth: 1,
        title: '900 EMA',
      });
      seriesRefs.current.nineHundredEMA = nineHundredEMA;

      const twelveHundredEMA = (chart as any).createLineSeries({
        color: MA_COLORS.twelveHundred,
        lineWidth: 1,
        title: '1200 EMA',
      });
      seriesRefs.current.twelveHundredEMA = twelveHundredEMA;

      // 마커 설정
      if (markers.length > 0 && candleSeries.setMarkers) {
        candleSeries.setMarkers(markers);
      }

      // 차트 준비 완료 콜백
      onChartReady(
        chart,
        candleSeries,
        volumeSeries,
        sixtyEMA,
        oneTwentyEMA,
        twoFortyEMA,
        threeHundredSixtyEMA,
        threeHundredEMA,
        nineHundredEMA,
        twelveHundredEMA
      );
    } catch (error) {
      console.error('차트 초기화 오류:', error);
      // 오류 발생 시 차트 정리
      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
      }
    }
  }, [chartHeight, markers, onChartReady]);

  // 차트 초기화
  useEffect(() => {
    initializeChart();
    window.addEventListener('resize', handleResize);
    
    return () => {
      window.removeEventListener('resize', handleResize);
      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
      }
    };
  }, [initializeChart, handleResize]);

  // 마커 업데이트
  useEffect(() => {
    if (seriesRefs.current.candle && markers.length > 0 && seriesRefs.current.candle.setMarkers) {
      seriesRefs.current.candle.setMarkers(markers);
    }
  }, [markers]);

  return (
    <div 
      ref={container} 
      style={{ 
        width: '100%', 
        height: chartHeight,
        backgroundColor: CHART_COLORS.background 
      }}
    />
  );
});

export default BacktestChartContainer; 