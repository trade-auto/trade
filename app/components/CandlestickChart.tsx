import { useEffect, useRef, useState } from 'react';
import { useUpbitStore } from '../store/useUpbitStore';
import {
  createChart,
  ColorType,
  DeepPartial,
  ChartOptions,
  CandlestickData,
  LineData,
  Time,
  CandlestickSeries,
  LineSeries,
  IChartApi,
  ISeriesApi,
  SeriesMarker,
  createSeriesMarkers,
} from 'lightweight-charts';

interface ChartProps {
  symbol: string;
}

interface UpbitCandle {
  candle_date_time_kst: string;
  opening_price: number;
  high_price: number;
  low_price: number;
  trade_price: number;
}

interface CrossPoint {
  time: Time;
  position: 'buy' | 'sell';
  value: number;
}

export const CandlestickChart: React.FC<ChartProps> = ({ symbol }) => {
  const container = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const shortEMASeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const longEMASeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const lastCandleRef = useRef<CandlestickData<Time> | null>(null);
  const buyMarkerSeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const sellMarkerSeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const crossPointsRef = useRef<CrossPoint[]>([]);
  
  const { prices, tickers } = useUpbitStore();
  const [chartPrice, setChartPrice] = useState<number>(0);
  
  const currentPrice = prices[symbol]?.currentPrice ?? 0;
  const lastUpdated = prices[symbol]?.lastUpdated ?? '-';
  const tickerData = tickers[symbol];

  useEffect(() => {
    if (!container.current) return;

    // 차트 생성
    const chartOptions: DeepPartial<ChartOptions> = {
      layout: {
        textColor: '#DDD',
        background: { type: ColorType.Solid, color: '#1E1E1E' }
      },
      grid: {
        vertLines: { color: '#2B2B2B' },
        horzLines: { color: '#2B2B2B' }
      },
      width: container.current.clientWidth,
      height: 600,
      timeScale: {
        timeVisible: true,
        secondsVisible: true,
      },
    };

    const chart = createChart(container.current, chartOptions);
    chartRef.current = chart;

    // 캔들스틱 시리즈 생성
    const candlestickSeries = chart.addSeries(CandlestickSeries, {
      upColor: '#26a69a',
      downColor: '#ef5350',
      borderVisible: false,
      wickUpColor: '#26a69a',
      wickDownColor: '#ef5350',
    });
    candleSeriesRef.current = candlestickSeries;

    // 이동평균선 시리즈 생성
    const shortEMASeries = chart.addSeries(LineSeries, {
      color: '#FF5252',
      lineWidth: 2,
      title: '5분 EMA',
      priceLineVisible: false,
    });
    shortEMASeriesRef.current = shortEMASeries;

    const longEMASeries = chart.addSeries(LineSeries, {
      color: '#2196F3',
      lineWidth: 2,
      title: '10분 EMA',
      priceLineVisible: false,
    });
    longEMASeriesRef.current = longEMASeries;

    // 데이터 로드 및 설정
    const loadChartData = async () => {
      try {
        const response = await fetch(`https://api.upbit.com/v1/candles/minutes/3?market=${symbol}&count=200`);
        const data = await response.json();
        
        const candleData = data.map((item: UpbitCandle): CandlestickData<Time> => {
          const timestamp = Math.floor(new Date(item.candle_date_time_kst).getTime() / 1000);
          return {
            time: timestamp as Time,
            open: item.opening_price,
            high: item.high_price,
            low: item.low_price,
            close: item.trade_price,
          };
        }).reverse();

        // 마지막 캔들 저장
        lastCandleRef.current = candleData[candleData.length - 1];

        // 이동평균 계산
        const shortEMAData = calculateEMA(candleData, 5);
        const longEMAData = calculateEMA(candleData, 10);

        // 크로스 포인트 찾기
        const crossPoints = findCrossPoints(shortEMAData, longEMAData);
        crossPointsRef.current = crossPoints;

        // 데이터 설정
        candlestickSeries.setData(candleData);
        shortEMASeries.setData(shortEMAData);
        longEMASeries.setData(longEMAData);

        // 매수/매도 마커 생성
        const markers: SeriesMarker<Time>[] = crossPoints.map(point => ({
          time: point.time,
          position: point.position === 'buy' ? 'belowBar' : 'aboveBar',
          color: point.position === 'buy' ? '#26a69a' : '#ef5350',
          shape: point.position === 'buy' ? 'arrowUp' : 'arrowDown',
          text: point.position === 'buy' ? '매수' : '매도',
        }));
        
        if (candleSeriesRef.current) {
          createSeriesMarkers(candleSeriesRef.current, markers);
        }

        // 마지막 가격 표시
        const lastPrice = candleData[candleData.length - 1].close;
        setChartPrice(lastPrice);

        // 차트 영역 맞추기
        chart.timeScale().fitContent();
      } catch (error) {
        console.error('차트 데이터 로드 중 오류:', error);
      }
    };

    loadChartData();

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
      }
    };
  }, [symbol]); // currentPrice 의존성 제거

  // 실시간 가격 업데이트 처리
  useEffect(() => {
    if (!currentPrice || !candleSeriesRef.current || !lastCandleRef.current || !tickerData) return;

    const now = Math.floor(Date.now() / 1000);
    const lastCandle = lastCandleRef.current;
    const threeMinutes = 3 * 60;

    // 현재 시간이 마지막 캔들의 시간 + 3분을 넘었다면 새로운 캔들 생성
    if (now >= (lastCandle.time as number) + threeMinutes) {
      const newCandle: CandlestickData<Time> = {
        time: now as Time,
        open: tickerData.openPrice,
        high: tickerData.highPrice,
        low: tickerData.lowPrice,
        close: tickerData.currentPrice,
      };
      candleSeriesRef.current.update(newCandle);
      lastCandleRef.current = newCandle;

      // 새 캔들이 생성될 때 EMA와 크로스 포인트 업데이트
      const candleData = candleSeriesRef.current.data() as CandlestickData<Time>[];
      if (shortEMASeriesRef.current && longEMASeriesRef.current && 
          buyMarkerSeriesRef.current && sellMarkerSeriesRef.current) {
        const shortEMAData = calculateEMA(candleData, 5);
        const longEMAData = calculateEMA(candleData, 10);
        
        shortEMASeriesRef.current.setData(shortEMAData);
        longEMASeriesRef.current.setData(longEMAData);

        // 크로스 포인트 업데이트
        const crossPoints = findCrossPoints(shortEMAData, longEMAData);
        crossPointsRef.current = crossPoints;
        
        // 매수/매도 마커 업데이트
        const markers: SeriesMarker<Time>[] = crossPoints.map(point => ({
          time: point.time,
          position: point.position === 'buy' ? 'belowBar' : 'aboveBar',
          color: point.position === 'buy' ? '#26a69a' : '#ef5350',
          shape: point.position === 'buy' ? 'arrowUp' : 'arrowDown',
          text: point.position === 'buy' ? '매수' : '매도',
        }));
        
        if (candleSeriesRef.current) {
          createSeriesMarkers(candleSeriesRef.current, markers);
        }
      }
    } else {
      // 현재 캔들 업데이트
      const updatedCandle: CandlestickData<Time> = {
        ...lastCandle,
        high: Math.max(lastCandle.high, tickerData.highPrice),
        low: Math.min(lastCandle.low, tickerData.lowPrice),
        close: tickerData.currentPrice,
      };
      candleSeriesRef.current.update(updatedCandle);
      lastCandleRef.current = updatedCandle;
    }

    setChartPrice(currentPrice);
  }, [currentPrice, tickerData]);

  // EMA 계산 함수
  const calculateEMA = (data: CandlestickData<Time>[], period: number): LineData<Time>[] => {
    const k = 2 / (period + 1);
    let ema = data[0].close;
    
    return data.map(candle => ({
      time: candle.time,
      value: (ema = candle.close * k + ema * (1 - k)),
    }));
  };

  // 크로스 포인트 찾기 함수
  const findCrossPoints = (shortEMA: LineData<Time>[], longEMA: LineData<Time>[]): CrossPoint[] => {
    const crossPoints: CrossPoint[] = [];
    
    for (let i = 1; i < shortEMA.length; i++) {
      const prevShort = shortEMA[i - 1].value;
      const prevLong = longEMA[i - 1].value;
      const currShort = shortEMA[i].value;
      const currLong = longEMA[i].value;
      
      // 골든크로스 (5분선이 10분선을 상향돌파)
      if (prevShort <= prevLong && currShort > currLong) {
        crossPoints.push({
          time: shortEMA[i].time,
          position: 'buy',
          value: currShort,
        });
      }
      // 데드크로스 (5분선이 10분선을 하향돌파)
      else if (prevShort >= prevLong && currShort < currLong) {
        crossPoints.push({
          time: shortEMA[i].time,
          position: 'sell',
          value: currShort,
        });
      }
    }
    
    return crossPoints;
  };

  // 시세 차이 계산
  const priceDiff = currentPrice > 0 && chartPrice > 0 
    ? currentPrice - chartPrice 
    : 0;
  const priceDiffPercentage = currentPrice > 0 && chartPrice > 0
    ? (priceDiff / chartPrice) * 100
    : 0;

  return (
    <div className="w-full min-h-screen p-4 bg-[#1e1e1e] rounded-lg">
      {/* 시세 비교 정보 */}
      <div className="grid grid-cols-4 gap-4 mb-4">
        <div className="bg-gray-800 p-4 rounded-lg">
          <div className="text-gray-400 text-sm">Upbit WebSocket 시세</div>
          <div className="text-white text-lg font-bold">
            {currentPrice.toLocaleString()} KRW
          </div>
          <div className="text-gray-400 text-xs">
            마지막 업데이트: {lastUpdated}
          </div>
        </div>
        <div className="bg-gray-800 p-4 rounded-lg">
          <div className="text-gray-400 text-sm">차트 시세</div>
          <div className="text-white text-lg font-bold">
            {chartPrice.toLocaleString()} KRW
          </div>
        </div>
        <div className="bg-gray-800 p-4 rounded-lg">
          <div className="text-gray-400 text-sm">시세 차이</div>
          <div className={`text-lg font-bold ${priceDiff >= 0 ? 'text-green-500' : 'text-red-500'}`}>
            {priceDiff.toLocaleString()} KRW
          </div>
        </div>
        <div className="bg-gray-800 p-4 rounded-lg">
          <div className="text-gray-400 text-sm">시세 차이 (%)</div>
          <div className={`text-lg font-bold ${priceDiff >= 0 ? 'text-green-500' : 'text-red-500'}`}>
            {priceDiffPercentage.toFixed(4)}%
          </div>
        </div>
      </div>

      <div className="text-white text-lg font-bold mb-4">
        {symbol} 3분봉 차트
      </div>
      <div ref={container} id="chart" className="w-full" />
    </div>
  );
}; 