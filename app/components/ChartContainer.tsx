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
  ISeriesMarkersPluginApi,
  LineWidth,
} from 'lightweight-charts';
import { SeriesMarker } from 'lightweight-charts';
import useUpbitStore from '../store/useUpbitStore';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
interface CandlestickSeriesWithMarkers extends ISeriesApi<"Candlestick"> {
  setMarkers?: (markers: SeriesMarker<Time>[]) => void;
}

interface ChartContainerProps {
  isFullscreen: boolean;
  chartHeight: number;
  toggleFullscreen: () => void;
  symbol: string;
  chartType: string;
  markers: SeriesMarker<Time>[];
  isAutoUpdate?: boolean;
  isRealtimeAPIEnabled?: boolean;
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

interface SeriesRefs {
  candle: CandlestickSeriesWithMarkers | null;
  volume: ISeriesApi<"Histogram"> | null;
  sixtyEMA: ISeriesApi<"Line"> | null;
  oneTwentyEMA: ISeriesApi<"Line"> | null;
  twoFortyEMA: ISeriesApi<"Line"> | null;
  threeHundredSixtyEMA: ISeriesApi<"Line"> | null;
  threeHundredEMA: ISeriesApi<"Line"> | null;
  nineHundredEMA: ISeriesApi<"Line"> | null;
}

const ChartContainer: React.FC<ChartContainerProps> = memo(({
  isFullscreen,
  chartHeight,
  toggleFullscreen,
  symbol,
  chartType,
  markers,
  isAutoUpdate,
  isRealtimeAPIEnabled,
  onChartReady,
}) => {
  const container = useRef<HTMLDivElement>(null);
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const markerPluginRef = useRef<ISeriesMarkersPluginApi<Time> | null>(null);
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
  const { tradeStrategy } = useUpbitStore();

  const handleResize = useCallback(() => {
    if (container.current && chartRef.current) {
      const { clientWidth } = container.current;
      chartRef.current.applyOptions({
        width: clientWidth,
        height: isFullscreen ? window.innerHeight * 0.9 : chartHeight,
      });
    }
  }, [chartHeight, isFullscreen]);

  const initializeChart = useCallback(() => {
    if (!container.current || chartRef.current) return;
    
    const clientWidth = container.current.clientWidth;
    
    // 차트 생성
    const chart = createChart(container.current, getChartOptions(clientWidth, chartHeight, chartType));
    chartRef.current = chart;
    
    // 실시간 차트 설정
    if (chartType.startsWith('seconds/')) {
      chart.applyOptions({
        timeScale: {
          timeVisible: true,
          secondsVisible: true,
          tickMarkFormatter: (time: number) => {
            const date = new Date(time * 1000);
            // 초 단위 차트는 시/분/초 표시
            const hours = date.getHours().toString().padStart(2, '0');
            const minutes = date.getMinutes().toString().padStart(2, '0');
            const seconds = date.getSeconds().toString().padStart(2, '0');
            return `${hours}:${minutes}:${seconds}`;
          }
        }
      });
    }

    // 시리즈 생성
    seriesRefs.current.candle = chart.addSeries(CandlestickSeries, {
      upColor: CHART_COLORS.upColor,
      downColor: CHART_COLORS.downColor,
      borderVisible: false,
      wickUpColor: CHART_COLORS.upColor,
      wickDownColor: CHART_COLORS.downColor,
    });

    // 마커 플러그인 초기화
    markerPluginRef.current = createSeriesMarkers(seriesRefs.current.candle);

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // 의도적으로 의존성 배열을 비워서 한 번만 실행되도록 함

  useEffect(() => {
    initializeChart();
    return () => {
      window.removeEventListener('resize', handleResize);
      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // 의도적으로 의존성 배열을 비워서 한 번만 실행되도록 함

  // 마커 플러그인 생성 및 설정 함수 
  const setupMarkerPlugin = useCallback(() => {
    if (!seriesRefs.current.candle) {
      console.warn('캔들 시리즈가 준비되지 않아 마커 플러그인을 생성할 수 없습니다.');
      return;
    }
    
    try {
      console.log('마커 플러그인 설정 시작');
      
      // 이전 플러그인 정리
      markerPluginRef.current = null;
      
      // 새 플러그인 생성
      markerPluginRef.current = createSeriesMarkers(seriesRefs.current.candle);
      
      // 마커가 있으면 적용
      if (markers.length > 0 && markerPluginRef.current) {
        console.log('초기 마커 설정:', markers.length, '개');
        markerPluginRef.current.setMarkers(markers);
        
        // 안전장치: 지연 마커 적용
        setTimeout(() => {
          if (markerPluginRef.current) {
            console.log('지연 마커 재확인:', markers.length, '개');
            markerPluginRef.current.setMarkers(markers);
          }
        }, 300);
      }
      
      console.log('마커 플러그인 설정 완료');
    } catch (error) {
      console.error('마커 플러그인 설정 오류:', error);
    }
  }, [markers]);

  // 초기화 후 마커 플러그인 설정
  useEffect(() => {
    if (seriesRefs.current.candle) {
      setupMarkerPlugin();
    }
  }, [setupMarkerPlugin]);
  
  // 마커 업데이트
  useEffect(() => {
    if (!markerPluginRef.current && seriesRefs.current.candle) {
      setupMarkerPlugin();
      return;
    }
    
    if (markerPluginRef.current && markers.length > 0) {
      console.log('마커 업데이트:', markers.length, '개');
      try {
        markerPluginRef.current.setMarkers(markers);
        
        // 안전장치: 지연 마커 확인
        setTimeout(() => {
          if (markerPluginRef.current) {
            console.log('지연 마커 확인:', markers.length, '개');
            markerPluginRef.current.setMarkers(markers);
          }
        }, 300);
      } catch (error) {
        console.error('마커 업데이트 실패:', error);
        
        // 오류 발생 시 플러그인 재설정 시도
        setupMarkerPlugin();
      }
    }
  }, [markers, tradeStrategy, setupMarkerPlugin]);

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
    <div
      ref={chartContainerRef}
      className="relative bg-gray-900 rounded-lg overflow-hidden"
    >
      {/* 차트 정보 및 토글 버튼 */}
      <div className="absolute top-2 left-2 right-2 z-10 flex justify-between items-center">
        <div className="bg-gray-800 bg-opacity-75 px-3 py-1 rounded-lg flex items-center">
          <span className="text-white font-bold mr-2">{symbol}</span>
          <span className="text-gray-300 text-sm">{chartType}</span>
          {isRealtimeAPIEnabled && (
            <span className="ml-2 px-2 py-0.5 bg-blue-600 text-white text-xs rounded-full animate-pulse">
              실시간
            </span>
          )}
          {isAutoUpdate && !isRealtimeAPIEnabled && (
            <span className="ml-2 px-2 py-0.5 bg-green-600 text-white text-xs rounded-full">
              자동
            </span>
          )}
        </div>
        <button
          onClick={toggleFullscreen}
          className="bg-gray-700 hover:bg-gray-600 text-white p-1 rounded"
          aria-label="Toggle fullscreen"
        >
          {isFullscreen ? (
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3" />
            </svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
            </svg>
          )}
        </button>
      </div>
      
      {/* 차트 컨테이너 */}
      <div
        ref={container}
        className="w-full"
        style={{ height: `${chartHeight}px` }}
      />
    </div>
  );
});

ChartContainer.displayName = 'ChartContainer';

export default ChartContainer; 