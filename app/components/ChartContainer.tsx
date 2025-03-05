import React, { useRef, useEffect } from 'react';
import {
  createChart,
  IChartApi,
  ISeriesApi,
  Time,
  CandlestickSeries,
  LineSeries,
  HistogramSeries,
  createSeriesMarkers,
} from 'lightweight-charts';
import { SeriesMarker } from 'lightweight-charts';
import { CrossPoint } from '../types/candlestick';

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
    threeHundredSixtyEMASeries: ISeriesApi<"Line">
  ) => void;
  createTradeMarkers: (crossPoints: CrossPoint[]) => SeriesMarker<Time>[];
}

const ChartContainer: React.FC<ChartContainerProps> = ({
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
  const candleSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<"Histogram"> | null>(null);
  const sixtyEMASeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const oneTwentyEMASeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const twoFortyEMASeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const threeHundredSixtyEMASeriesRef = useRef<ISeriesApi<"Line"> | null>(null);

  // 차트 초기화
  useEffect(() => {
    if (!container.current) return;

    // Create chart
    const chart = createChart(container.current, {
      layout: {
        background: { color: '#1e1e1e' },
        textColor: '#d1d4dc',
      },
      grid: {
        vertLines: { color: '#2B2B2B' },
        horzLines: { color: '#2B2B2B' },
      },
      width: container.current.clientWidth,
      height: chartHeight,
      timeScale: {
        timeVisible: true,
        secondsVisible: true,
        borderColor: '#2B2B2B',
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
          width: 2,
          color: '#555',
          style: 0,
        },
        horzLine: {
          width: 2,
          color: '#555',
          style: 0,
        },
      },
    });

    chartRef.current = chart;

    // Create series using addSeries method
    const candlestickSeries = chart.addSeries(CandlestickSeries, {
      upColor: '#26a69a',
      downColor: '#ef5350',
      borderVisible: false,
      wickUpColor: '#26a69a',
      wickDownColor: '#ef5350',
    });
    candleSeriesRef.current = candlestickSeries;

    // Create volume series
    const volumeSeries = chart.addSeries(HistogramSeries, {
      color: '#26a69a',
      priceFormat: {
        type: 'volume',
      },
      priceScaleId: 'volume',
    });
    volumeSeriesRef.current = volumeSeries;

    // MA 시리즈 생성
    const createMASeries = (color: string) => {
      return chart.addSeries(LineSeries, {
        color: color,
        lineWidth: 2,
        visible: true,
      });
    };

    // MA 시리즈 초기화
    sixtyEMASeriesRef.current = createMASeries('#0000FF'); // 60MA
    oneTwentyEMASeriesRef.current = createMASeries('#800080'); // 120MA
    twoFortyEMASeriesRef.current = createMASeries('#FFA500'); // 240MA
    threeHundredSixtyEMASeriesRef.current = createMASeries('#000000'); // 360MA

    // 컴포넌트 상위로 차트와 시리즈 객체 전달
    if (
      chartRef.current && 
      candleSeriesRef.current && 
      volumeSeriesRef.current && 
      sixtyEMASeriesRef.current && 
      oneTwentyEMASeriesRef.current && 
      twoFortyEMASeriesRef.current && 
      threeHundredSixtyEMASeriesRef.current
    ) {
      onChartReady(
        chartRef.current,
        candleSeriesRef.current,
        volumeSeriesRef.current,
        sixtyEMASeriesRef.current,
        oneTwentyEMASeriesRef.current,
        twoFortyEMASeriesRef.current,
        threeHundredSixtyEMASeriesRef.current
      );
    }

    // 윈도우 리사이즈 핸들러
    const handleResize = () => {
      if (container.current && chartRef.current) {
        chartRef.current.applyOptions({
          width: container.current.clientWidth,
        });
      }
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
      }
    };
  }, [chartHeight, chartType, onChartReady]);

  // 차트 높이 업데이트
  useEffect(() => {
    if (chartRef.current) {
      chartRef.current.applyOptions({
        height: chartHeight
      });
    }
  }, [chartHeight]);

  // 매수/매도 마커 업데이트
  useEffect(() => {
    if (candleSeriesRef.current && crossPoints.length > 0) {
      const markers = createTradeMarkers(crossPoints);
      
      try {
        if (candleSeriesRef.current) {
          createSeriesMarkers(candleSeriesRef.current, markers);
        }
      } catch (error) {
        console.error('마커 업데이트 실패:', error);
      }
    }
  }, [crossPoints, createTradeMarkers]);

  // 전체화면 이벤트 감지
  useEffect(() => {
    const handleFullscreenChange = () => {
      // 전체화면 상태 확인은 상위 컴포넌트에서 이미 관리
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  return (
    <div>
      {/* 차트 제목과 전체화면 버튼 */}
      <div className="flex justify-between items-center mb-4">
        <div className="text-white text-lg font-bold">
          {symbol} {chartType} 차트
        </div>
        <button
          onClick={toggleFullscreen}
          className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded flex items-center"
        >
          {isFullscreen ? (
            <span>⊖ 축소</span>
          ) : (
            <span>⊕ 전체화면</span>
          )}
        </button>
      </div>

      {/* 차트 컨테이너 */}
      <div 
        ref={chartContainerRef}
        className={`relative ${isFullscreen ? 'bg-[#1e1e1e] p-4' : ''}`}
      >
        <div 
          ref={container} 
          id="chart" 
          className="w-full"
          style={{ height: isFullscreen ? '90vh' : `${chartHeight}px` }}
        />
      </div>
    </div>
  );
};

export default ChartContainer; 