import React, { useRef, useEffect, useCallback, memo } from 'react';
import {
  createChart,
  IChartApi,
  ISeriesApi,
  Time,
  SeriesMarker,
  LineWidth,
  createSeriesMarkers,
} from 'lightweight-charts';
import { useUpbitStore } from '../store/useUpbitStore';
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
  twelveHundred: '#FF0000'  // 빨간색으로 변경
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

type EMAKey = 'sixtyEMA' | 'oneTwentyEMA' | 'twoFortyEMA' | 'threeHundredSixtyEMA' | 'threeHundredEMA' | 'nineHundredEMA' | 'twelveHundredEMA';

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

// 로컬 스토리지 키 상수 정의
const STORAGE_KEYS = {
  MA_SETTINGS: 'chart_ma_settings',
  SCALE_SETTINGS: 'chart_scale_settings'
} as const;

// 기본 스케일 설정
const DEFAULT_SCALE_SETTINGS = {
  rightPriceScale: {
    scaleMargins: {
      top: 0.1,
      bottom: 0.2,
    },
    borderVisible: false,
    mode: 1,
    alignLabels: true,
  }
};

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

  // 저장된 설정 불러오기
  const loadSavedSettings = useCallback(() => {
    try {
      const savedMASettings = localStorage.getItem(STORAGE_KEYS.MA_SETTINGS);
      const savedScaleSettings = localStorage.getItem(STORAGE_KEYS.SCALE_SETTINGS);

      return {
        maSettings: savedMASettings ? JSON.parse(savedMASettings) : null,
        scaleSettings: savedScaleSettings ? JSON.parse(savedScaleSettings) : DEFAULT_SCALE_SETTINGS
      };
    } catch (error) {
      console.error('설정 로드 오류:', error);
      return {
        maSettings: null,
        scaleSettings: DEFAULT_SCALE_SETTINGS
      };
    }
  }, []);

  // 설정 저장 함수
  const saveSettings = useCallback((maSettings: any, scaleSettings: any) => {
    try {
      localStorage.setItem(STORAGE_KEYS.MA_SETTINGS, JSON.stringify(maSettings));
      localStorage.setItem(STORAGE_KEYS.SCALE_SETTINGS, JSON.stringify(scaleSettings));
    } catch (error) {
      console.error('설정 저장 오류:', error);
    }
  }, []);

  const initializeChart = useCallback(() => {
    if (!container.current || chartRef.current) return;
    
    const clientWidth = container.current.clientWidth;
    const { scaleSettings } = loadSavedSettings();
    
    // 차트 생성
    const chart = createChart(container.current, {
      ...getChartOptions(clientWidth, chartHeight, chartType),
      rightPriceScale: scaleSettings.rightPriceScale,
      overlayPriceScales: {
        borderVisible: false,
      },
    });
    chartRef.current = chart;

    // 실시간 차트 설정
    if (chartType.startsWith('seconds/')) {
      chart.applyOptions({
        timeScale: {
          timeVisible: true,
          secondsVisible: true,
          tickMarkFormatter: (time: number) => {
            const date = new Date(time * 1000);
            const hours = date.getHours().toString().padStart(2, '0');
            const minutes = date.getMinutes().toString().padStart(2, '0');
            const seconds = date.getSeconds().toString().padStart(2, '0');
            return `${hours}:${minutes}:${seconds}`;
          }
        }
      });
    }

    // 캔들스틱 시리즈 생성
    const candleSeries = (chart as any).addCandlestickSeries({
      upColor: CHART_COLORS.upColor,
      downColor: CHART_COLORS.downColor,
      borderVisible: false,
      wickUpColor: CHART_COLORS.upColor,
      wickDownColor: CHART_COLORS.downColor,
      priceFormat: {
        type: 'price',
        precision: 2,
        minMove: 0.01,
      },
    });
    seriesRefs.current.candle = candleSeries;

    // 마커 설정
    if (markers.length > 0 && candleSeries.setMarkers) {
      candleSeries.setMarkers(markers);
    } else if (typeof createSeriesMarkers === 'function') {
      try {
        markerPluginRef.current = createSeriesMarkers(candleSeries);
      } catch (error) {
        console.error('마커 플러그인 초기화 실패:', error);
      }
    }

    // 볼륨 시리즈 생성
    const volumeSeries = (chart as any).addHistogramSeries({
      color: CHART_COLORS.upColor,
      priceFormat: {
        type: 'volume',
      },
      priceScaleId: 'volume',
    });
    seriesRefs.current.volume = volumeSeries;

    // 볼륨 스케일 설정
    chart.priceScale('volume').applyOptions({
      scaleMargins: {
        top: 0.8,
        bottom: 0,
      },
      borderVisible: false,
    });

    // MA 시리즈 생성
    Object.entries(MA_COLORS).forEach(([key, color]) => {
      const seriesKey = `${key}EMA` as EMAKey;
      try {
        const lineSeries = (chart as any).addLineSeries({
          color,
          lineWidth: 2,
          visible: false,
          lastValueVisible: true,
          priceLineVisible: false,
          crosshairMarkerVisible: true,
          priceFormat: {
            type: 'price',
            precision: 2,
            minMove: 0.01,
          }
        });
        (seriesRefs.current as Record<EMAKey, ISeriesApi<"Line"> | null>)[seriesKey] = lineSeries;
      } catch (error) {
        console.error(`${key} EMA 시리즈 생성 실패:`, error);
      }
    });

    // 저장된 MA 설정 적용
    const { maSettings } = loadSavedSettings();
    if (maSettings) {
      Object.entries(maSettings).forEach(([key, visible]) => {
        const seriesKey = `${key}EMA` as EMAKey;
        if (seriesRefs.current[seriesKey]) {
          seriesRefs.current[seriesKey]?.applyOptions({ visible: visible as boolean });
        }
      });
    }

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
      seriesRefs.current.nineHundredEMA!,
      seriesRefs.current.twelveHundredEMA!
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

  // 마커 업데이트 - 최적화
  useEffect(() => {
    if (!seriesRefs.current.candle) return;
    console.log('tradeStrategy 마커 업데이트', tradeStrategy);
    try {
      if (seriesRefs.current.candle.setMarkers) {
        seriesRefs.current.candle.setMarkers(markers);
      } else if (markerPluginRef.current) {
        markerPluginRef.current.setMarkers(markers);
      }
    } catch (error) {
      console.error('마커 업데이트 실패:', error);
    }
  }, [markers, tradeStrategy]);

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

  // 차트 스케일 변경 시 저장
  const handleScaleChange = useCallback(() => {
    if (!chartRef.current) return;
    
    const currentScaleSettings = {
      rightPriceScale: chartRef.current.priceScale('right').options()
    };
    
    saveSettings(null, currentScaleSettings);
  }, [saveSettings]);

  // MA 가시성 변경 시 저장
  const handleMAVisibilityChange = useCallback((maSettings: Record<string, boolean>) => {
    saveSettings(maSettings, null);
  }, [saveSettings]);

  useEffect(() => {
    if (chartRef.current) {
      chartRef.current.timeScale().subscribeVisibleLogicalRangeChange(handleScaleChange);
    }
    return () => {
      if (chartRef.current) {
        chartRef.current.timeScale().unsubscribeVisibleLogicalRangeChange(handleScaleChange);
      }
    };
  }, [handleScaleChange]);

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