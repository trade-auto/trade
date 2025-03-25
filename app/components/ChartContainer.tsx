import React, { useRef, useEffect, useCallback, memo } from 'react';
import {
  createChart,
  IChartApi,
  ISeriesApi,
  Time,
  SeriesMarker,
  CandlestickData,
  LineWidth,
} from 'lightweight-charts';
import useUpbitStore from '../store/useUpbitStore';

// 이동평균선 계산 함수
const calculateEMA = (data: ExtendedCandlestickData[], period: number) => {
  if (data.length < period) return [];
  
  const result: { time: Time; value: number }[] = [];
  let sum = 0;
  
  // 첫 번째 SMA 계산
  for (let i = 0; i < period; i++) {
    sum += data[i].close;
  }
  
  // 첫 번째 EMA는 SMA와 동일
  const firstEMA = sum / period;
  result.push({
    time: data[period - 1].time,
    value: firstEMA
  });
  
  // 나머지 데이터에 대한 EMA 계산
  const multiplier = 2 / (period + 1);
  let previousEMA = firstEMA;
  
  for (let i = period; i < data.length; i++) {
    const currentEMA = (data[i].close - previousEMA) * multiplier + previousEMA;
    result.push({
      time: data[i].time,
      value: currentEMA
    });
    previousEMA = currentEMA;
  }
  
  return result;
};

// 확장된 캔들스틱 데이터 타입 정의
interface ExtendedCandlestickData extends CandlestickData<Time> {
  volume?: number;
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
  data?: ExtendedCandlestickData[];
  showMA?: {
    sixty: boolean;
    oneTwenty: boolean;
    twoForty: boolean;
    threeHundredSixty: boolean;
    sixHundred: boolean;
    nineHundred: boolean;
  };
  onChartReady: (
    chartApi: IChartApi,
    candleSeries: ISeriesApi<"Candlestick">,
    volumeSeries: ISeriesApi<"Histogram">,
    fiveEMA: ISeriesApi<"Line">,
    tenEMA: ISeriesApi<"Line">,
    twentyEMA: ISeriesApi<"Line">,
    thirtyEMA: ISeriesApi<"Line">,
    sixtyEMASeries: ISeriesApi<"Line">,
    oneTwentyEMASeries: ISeriesApi<"Line">,
    twoFortyEMASeries: ISeriesApi<"Line">,
    threeHundredSixtyEMASeries: ISeriesApi<"Line">,
    sixHundredEMASeries: ISeriesApi<"Line">,
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
  sixHundred: '#00FFFF',
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
      const hours = date.getHours().toString().padStart(2, '0');
      const minutes = date.getMinutes().toString().padStart(2, '0');
      const seconds = date.getSeconds().toString().padStart(2, '0');
      return `${hours}:${minutes}:${seconds}`;
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

type EMAKey = 'sixtyEMA' | 'oneTwentyEMA' | 'twoFortyEMA' | 'threeHundredSixtyEMA' | 'sixHundredEMA' | 'nineHundredEMA';

interface SeriesRefs {
  candle: ISeriesApi<"Candlestick"> | null;
  volume: ISeriesApi<"Histogram"> | null;
  fiveEMA: ISeriesApi<"Line"> | null;
  tenEMA: ISeriesApi<"Line"> | null;
  twentyEMA: ISeriesApi<"Line"> | null;
  thirtyEMA: ISeriesApi<"Line"> | null;
  sixtyEMA: ISeriesApi<"Line"> | null;
  oneTwentyEMA: ISeriesApi<"Line"> | null;
  twoFortyEMA: ISeriesApi<"Line"> | null;
  threeHundredSixtyEMA: ISeriesApi<"Line"> | null;
  sixHundredEMA: ISeriesApi<"Line"> | null;
  nineHundredEMA: ISeriesApi<"Line"> | null;
}

// 마커 생성 함수
const createTradeMarkers = (signals: any[]): SeriesMarker<Time>[] => {
  return signals.map(signal => ({
    time: signal.time as Time,
    position: signal.position === 'buy' ? 'belowBar' : 'aboveBar',
    color: signal.position === 'buy' ? '#26a69a' : '#ef5350',
    shape: signal.position === 'buy' ? 'arrowUp' : 'arrowDown',
    text: signal.position === 'buy' ? '매수' : '매도'
  }));
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
  data,
  showMA,
  onChartReady,
}) => {
  const container = useRef<HTMLDivElement>(null);
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRefs = useRef<SeriesRefs>({
    candle: null,
    volume: null,
    fiveEMA: null,
    tenEMA: null,
    twentyEMA: null,
    thirtyEMA: null,
    sixtyEMA: null,
    oneTwentyEMA: null,
    twoFortyEMA: null,
    threeHundredSixtyEMA: null,
    sixHundredEMA: null,
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
            const hours = date.getHours().toString().padStart(2, '0');
            const minutes = date.getMinutes().toString().padStart(2, '0');
            const seconds = date.getSeconds().toString().padStart(2, '0');
            return `${hours}:${minutes}:${seconds}`;
          }
        }
      });
    }

    // 시리즈 생성
    seriesRefs.current.candle = chart.addCandlestickSeries({
      upColor: CHART_COLORS.upColor,
      downColor: CHART_COLORS.downColor,
      borderVisible: false,
      wickUpColor: CHART_COLORS.upColor,
      wickDownColor: CHART_COLORS.downColor,
    });

    seriesRefs.current.volume = chart.addHistogramSeries({
      color: CHART_COLORS.upColor,
      priceFormat: { type: 'volume' },
      priceScaleId: 'volume',
    });

    // Create the EMA series - 새로운 이평선 추가
    seriesRefs.current.fiveEMA = chart.addLineSeries({
      color: '#FF00FF',  // 마젠타색
      lineWidth: 1,
      priceLineVisible: false,
      title: '5 EMA'
    });
    
    seriesRefs.current.tenEMA = chart.addLineSeries({
      color: '#00FFFF',  // 시안색
      lineWidth: 1,
      priceLineVisible: false,
      title: '10 EMA'
    });
    
    seriesRefs.current.twentyEMA = chart.addLineSeries({
      color: '#FFA500',  // 오렌지색
      lineWidth: 1,
      priceLineVisible: false,
      title: '20 EMA'
    });
    
    seriesRefs.current.thirtyEMA = chart.addLineSeries({
      color: '#32CD32',  // 라임그린
      lineWidth: 1,
      priceLineVisible: false,
      title: '30 EMA'
    });
    
    // 기존 이평선
    seriesRefs.current.sixtyEMA = chart.addLineSeries({
      color: '#8A2BE2',  // Blue Violet
      lineWidth: 1,
      priceLineVisible: false,
      title: '60 EMA'
    });
    
    seriesRefs.current.oneTwentyEMA = chart.addLineSeries({
      color: '#1E90FF',  // Dodger Blue
      lineWidth: 1,
      priceLineVisible: false,
      title: '120 EMA'
    });
    
    seriesRefs.current.twoFortyEMA = chart.addLineSeries({
      color: '#FFFF00',  // Yellow
      lineWidth: 2,
      priceLineVisible: false,
      title: '240 EMA'
    });
    
    seriesRefs.current.threeHundredSixtyEMA = chart.addLineSeries({
      color: '#FF4500',  // Orange Red
      lineWidth: 1,
      priceLineVisible: false,
      title: '360 EMA'
    });
    
    seriesRefs.current.sixHundredEMA = chart.addLineSeries({
      color: '#FF0000',  // Red
      lineWidth: 1,
      priceLineVisible: false,
      title: '600 EMA'
    });
    
    seriesRefs.current.nineHundredEMA = chart.addLineSeries({
      color: '#FF00FF',  // Magenta
      lineWidth: 1,
      priceLineVisible: false,
      title: '900 EMA'
    });

    // 데이터가 제공된 경우 사용
    if (data) {
      seriesRefs.current.candle!.setData(data);
    }

    // 차트 준비 완료 콜백
    onChartReady(
      chart,
      seriesRefs.current.candle!,
      seriesRefs.current.volume!,
      seriesRefs.current.fiveEMA!,
      seriesRefs.current.tenEMA!,
      seriesRefs.current.twentyEMA!,
      seriesRefs.current.thirtyEMA!,
      seriesRefs.current.sixtyEMA!,
      seriesRefs.current.oneTwentyEMA!,
      seriesRefs.current.twoFortyEMA!,
      seriesRefs.current.threeHundredSixtyEMA!,
      seriesRefs.current.sixHundredEMA!,
      seriesRefs.current.nineHundredEMA!
    );

    // 초기 리사이즈 이벤트 리스너 설정
    window.addEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    initializeChart();
    return () => {
      window.removeEventListener('resize', handleResize);
      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
      }
    };
  }, []);

  // 차트 데이터가 변경되면 차트 업데이트
  useEffect(() => {
    if (seriesRefs.current.candle && data && data.length > 0) {
      console.log(`차트 데이터 업데이트: ${data.length}개의 데이터 설정 (${chartType} 타입)`);
      
      // 데이터 전처리: 시간 기준으로 정렬하고 중복 제거
      const processedData = [...data]
        // 시간을 숫자로 변환하여 정렬
        .map(item => {
          const timeValue = typeof item.time === 'number' 
            ? item.time 
            : typeof item.time === 'string' 
              ? new Date(item.time).getTime() / 1000 
              : (item.time as any).timestamp || 0;
          
          return { 
            ...item, 
            _timeValue: timeValue 
          };
        })
        // 시간 값으로 정렬
        .sort((a, b) => a._timeValue - b._timeValue)
        // 중복된 시간 제거 (마지막 항목 유지)
        .filter((item, index, self) => 
          index === self.findIndex(t => t._timeValue === item._timeValue)
        )
        // 임시 속성 제거
        .map(({ _timeValue, ...rest }) => rest);
      
      if (processedData.length !== data.length) {
        console.log(`중복 시간 데이터 제거: ${data.length}개 → ${processedData.length}개`);
      }
      
      seriesRefs.current.candle.setData(processedData);
      
      // 볼륨 데이터 설정
      if (seriesRefs.current.volume) {
        const volumeData = processedData.map(d => ({
          time: d.time,
          value: d.volume || 0,
          color: (d.close >= d.open) ? CHART_COLORS.upColor : CHART_COLORS.downColor
        }));
        seriesRefs.current.volume.setData(volumeData);
        console.log(`볼륨 데이터 설정 완료: ${volumeData.length}개 캔들`);
      }
      
      // 이동평균선 데이터 계산 및 설정
      setTimeout(() => {
        try {
          console.log(`이평선 데이터 계산 및 설정 시작: 데이터 ${processedData.length}개`);
          
          if (processedData.length >= 60 && seriesRefs.current.sixtyEMA) {
            const ema60Data = calculateEMA(processedData, 60);
            seriesRefs.current.sixtyEMA.setData(ema60Data);
            seriesRefs.current.sixtyEMA.applyOptions({ visible: showMA?.sixty || false });
            console.log(`60MA 데이터 설정 완료: ${ema60Data.length}개, 표시 상태: ${showMA?.sixty ? '표시' : '숨김'}`);
          }
          
          if (processedData.length >= 120 && seriesRefs.current.oneTwentyEMA) {
            const ema120Data = calculateEMA(processedData, 120);
            seriesRefs.current.oneTwentyEMA.setData(ema120Data);
            seriesRefs.current.oneTwentyEMA.applyOptions({ visible: showMA?.oneTwenty || false });
            console.log(`120MA 데이터 설정 완료: ${ema120Data.length}개, 표시 상태: ${showMA?.oneTwenty ? '표시' : '숨김'}`);
          }
          
          if (processedData.length >= 240 && seriesRefs.current.twoFortyEMA) {
            const ema240Data = calculateEMA(processedData, 240);
            seriesRefs.current.twoFortyEMA.setData(ema240Data);
            seriesRefs.current.twoFortyEMA.applyOptions({ visible: showMA?.twoForty || false });
            console.log(`240MA 데이터 설정 완료: ${ema240Data.length}개, 표시 상태: ${showMA?.twoForty ? '표시' : '숨김'}`);
          }
          
          if (processedData.length >= 360 && seriesRefs.current.threeHundredSixtyEMA) {
            const ema360Data = calculateEMA(processedData, 360);
            seriesRefs.current.threeHundredSixtyEMA.setData(ema360Data);
            seriesRefs.current.threeHundredSixtyEMA.applyOptions({ visible: showMA?.threeHundredSixty || false });
            console.log(`360MA 데이터 설정 완료: ${ema360Data.length}개, 표시 상태: ${showMA?.threeHundredSixty ? '표시' : '숨김'}`);
          }
          
          if (processedData.length >= 600 && seriesRefs.current.sixHundredEMA) {
            const ema600Data = calculateEMA(processedData, 600);
            seriesRefs.current.sixHundredEMA.setData(ema600Data);
            seriesRefs.current.sixHundredEMA.applyOptions({ visible: showMA?.sixHundred || false });
            console.log(`600MA 데이터 설정 완료: ${ema600Data.length}개, 표시 상태: ${showMA?.sixHundred ? '표시' : '숨김'}`);
          }
          
          if (processedData.length >= 900 && seriesRefs.current.nineHundredEMA) {
            const ema900Data = calculateEMA(processedData, 900);
            seriesRefs.current.nineHundredEMA.setData(ema900Data);
            seriesRefs.current.nineHundredEMA.applyOptions({ visible: showMA?.nineHundred || false });
            console.log(`900MA 데이터 설정 완료: ${ema900Data.length}개, 표시 상태: ${showMA?.nineHundred ? '표시' : '숨김'}`);
          }
          
          console.log('모든 이평선 데이터 설정 완료');
        } catch (error) {
          console.error('이평선 데이터 설정 중 오류 발생:', error);
        }
      }, 100); // 약간의 지연을 추가하여 렌더링 타이밍 문제 해결
    }
  }, [data, chartType, showMA]);
  
  // 차트 타입이 변경되면 차트 업데이트
  useEffect(() => {
    if (chartRef.current && seriesRefs.current.candle && data && data.length > 0) {
      console.log(`차트 타입 변경됨: ${chartType} - 차트 데이터 리셋 및 업데이트`);
      
      // 차트 타입 변경 시 모든 시리즈 데이터 리셋
      seriesRefs.current.candle.setData([]);
      if (seriesRefs.current.volume) seriesRefs.current.volume.setData([]);
      if (seriesRefs.current.sixtyEMA) seriesRefs.current.sixtyEMA.setData([]);
      if (seriesRefs.current.oneTwentyEMA) seriesRefs.current.oneTwentyEMA.setData([]);
      if (seriesRefs.current.twoFortyEMA) seriesRefs.current.twoFortyEMA.setData([]);
      if (seriesRefs.current.threeHundredSixtyEMA) seriesRefs.current.threeHundredSixtyEMA.setData([]);
      if (seriesRefs.current.sixHundredEMA) seriesRefs.current.sixHundredEMA.setData([]);
      if (seriesRefs.current.nineHundredEMA) seriesRefs.current.nineHundredEMA.setData([]);
      
      // 데이터 전처리: 시간 기준으로 정렬하고 중복 제거
      const processedData = [...data]
        // 시간을 숫자로 변환하여 정렬
        .map(item => {
          const timeValue = typeof item.time === 'number' 
            ? item.time 
            : typeof item.time === 'string' 
              ? new Date(item.time).getTime() / 1000 
              : (item.time as any).timestamp || 0;
          
          return { 
            ...item, 
            _timeValue: timeValue 
          };
        })
        // 시간 값으로 정렬
        .sort((a, b) => a._timeValue - b._timeValue)
        // 중복된 시간 제거 (마지막 항목 유지)
        .filter((item, index, self) => 
          index === self.findIndex(t => t._timeValue === item._timeValue)
        )
        // 임시 속성 제거
        .map(({ _timeValue, ...rest }) => rest);
      
      if (processedData.length !== data.length) {
        console.log(`중복 시간 데이터 제거: ${data.length}개 → ${processedData.length}개`);
      }
      
      // 새 데이터 설정
      seriesRefs.current.candle.setData(processedData);
      
      // 볼륨 데이터 설정
      if (seriesRefs.current.volume) {
        const volumeData = processedData.map(d => ({
          time: d.time,
          value: d.volume || 0,
          color: (d.close >= d.open) ? CHART_COLORS.upColor : CHART_COLORS.downColor
        }));
        seriesRefs.current.volume.setData(volumeData);
        console.log(`볼륨 데이터 설정 완료: ${volumeData.length}개`);
      }
      
      // 이동평균선 데이터 계산 및 설정
      if (processedData.length >= 60 && seriesRefs.current.sixtyEMA) {
        const ema60Data = calculateEMA(processedData, 60);
        seriesRefs.current.sixtyEMA.setData(ema60Data);
        seriesRefs.current.sixtyEMA.applyOptions({ visible: showMA?.sixty || false });
        console.log(`60MA 설정 완료: ${ema60Data.length}개, 표시: ${showMA?.sixty ? '표시' : '숨김'}`);
      }
      
      if (processedData.length >= 120 && seriesRefs.current.oneTwentyEMA) {
        const ema120Data = calculateEMA(processedData, 120);
        seriesRefs.current.oneTwentyEMA.setData(ema120Data);
        seriesRefs.current.oneTwentyEMA.applyOptions({ visible: showMA?.oneTwenty || false });
        console.log(`120MA 설정 완료: ${ema120Data.length}개, 표시: ${showMA?.oneTwenty ? '표시' : '숨김'}`);
      }
      
      if (processedData.length >= 240 && seriesRefs.current.twoFortyEMA) {
        const ema240Data = calculateEMA(processedData, 240);
        seriesRefs.current.twoFortyEMA.setData(ema240Data);
        seriesRefs.current.twoFortyEMA.applyOptions({ visible: showMA?.twoForty || false });
        console.log(`240MA 설정 완료: ${ema240Data.length}개, 표시: ${showMA?.twoForty ? '표시' : '숨김'}`);
      }
      
      if (processedData.length >= 360 && seriesRefs.current.threeHundredSixtyEMA) {
        const ema360Data = calculateEMA(processedData, 360);
        seriesRefs.current.threeHundredSixtyEMA.setData(ema360Data);
        seriesRefs.current.threeHundredSixtyEMA.applyOptions({ visible: showMA?.threeHundredSixty || false });
        console.log(`360MA 설정 완료: ${ema360Data.length}개, 표시: ${showMA?.threeHundredSixty ? '표시' : '숨김'}`);
      }
      
      if (processedData.length >= 600 && seriesRefs.current.sixHundredEMA) {
        const ema600Data = calculateEMA(processedData, 600);
        seriesRefs.current.sixHundredEMA.setData(ema600Data);
        seriesRefs.current.sixHundredEMA.applyOptions({ visible: showMA?.sixHundred || false });
        console.log(`600MA 설정 완료: ${ema600Data.length}개, 표시: ${showMA?.sixHundred ? '표시' : '숨김'}`);
      }
      
      if (processedData.length >= 900 && seriesRefs.current.nineHundredEMA) {
        const ema900Data = calculateEMA(processedData, 900);
        seriesRefs.current.nineHundredEMA.setData(ema900Data);
        seriesRefs.current.nineHundredEMA.applyOptions({ visible: showMA?.nineHundred || false });
        console.log(`900MA 설정 완료: ${ema900Data.length}개, 표시: ${showMA?.nineHundred ? '표시' : '숨김'}`);
      }
      
      // 차트 영역 조정
      chartRef.current.timeScale().fitContent();
    }
  }, [chartType, data, showMA]);

  // 이동평균선 표시 설정이 변경되면 가시성 업데이트
  useEffect(() => {
    if (showMA) {
      if (seriesRefs.current.sixtyEMA) 
        seriesRefs.current.sixtyEMA.applyOptions({ visible: showMA.sixty });
      
      if (seriesRefs.current.oneTwentyEMA) 
        seriesRefs.current.oneTwentyEMA.applyOptions({ visible: showMA.oneTwenty });
      
      if (seriesRefs.current.twoFortyEMA) 
        seriesRefs.current.twoFortyEMA.applyOptions({ visible: showMA.twoForty });
      
      if (seriesRefs.current.threeHundredSixtyEMA) 
        seriesRefs.current.threeHundredSixtyEMA.applyOptions({ visible: showMA.threeHundredSixty });
      
      if (seriesRefs.current.sixHundredEMA) 
        seriesRefs.current.sixHundredEMA.applyOptions({ visible: showMA.sixHundred });
      
      if (seriesRefs.current.nineHundredEMA) 
        seriesRefs.current.nineHundredEMA.applyOptions({ visible: showMA.nineHundred });
      
      console.log('이동평균선 표시 설정 업데이트:', showMA);
    }
  }, [showMA]);

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