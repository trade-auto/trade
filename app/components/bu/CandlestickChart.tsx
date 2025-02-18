import { useEffect, useRef, useState, useCallback } from 'react';
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
  HistogramData,
  HistogramSeries,
  HistogramSeriesPartialOptions,
} from 'lightweight-charts';

interface ChartProps {
  symbol: string;
  chartType: string;
}

interface UpbitCandle {
  candle_date_time_kst: string;
  opening_price: number;
  high_price: number;
  low_price: number;
  trade_price: number;
  candle_acc_trade_volume: number;
}

interface CrossPoint {
  time: Time;
  position: 'buy' | 'sell';
  value: number;
}

interface BacktestResult {
  totalTrades: number;
  successfulTrades: number;
  totalReturn: number;
  successRate: number;
  averageReturn: number;
  trades: {
    entryTime: Time;
    exitTime: Time;
    entryPrice: number;
    exitPrice: number;
    return: number;
    isSuccess: boolean;
  }[];
}

interface TickerData {
  trade_volume: number;
  trade_price: number;
  opening_price: number;
  high_price: number;
  low_price: number;
  prev_closing_price: number;
  change: string;
  change_price: number;
  change_rate: number;
  signed_change_price: number;
  signed_change_rate: number;
  trade_date: string;
  trade_time: string;
  trade_timestamp: number;
  timestamp: number;
  acc_trade_price: number;
  acc_trade_price_24h: number;
  acc_trade_volume: number;
  acc_trade_volume_24h: number;
  highest_52_week_price: number;
  highest_52_week_date: string;
  lowest_52_week_price: number;
  lowest_52_week_date: string;
  market_state: string;
}

export const CandlestickChart: React.FC<ChartProps> = ({ symbol, chartType }) => {
  const container = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const shortEMASeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const longEMASeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const mediumEMASeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const lastCandleRef = useRef<CandlestickData<Time> | null>(null);
  const buyMarkerSeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const sellMarkerSeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const crossPointsRef = useRef<CrossPoint[]>([]);
  const volumeSeriesRef = useRef<ISeriesApi<"Histogram"> | null>(null);
  
  const { prices, tickers } = useUpbitStore();
  const [chartPrice, setChartPrice] = useState<number>(0);
  const [backtestResult, setBacktestResult] = useState<BacktestResult | null>(null);
  
  const currentPrice = prices[symbol]?.currentPrice ?? 0;
  const lastUpdated = prices[symbol]?.lastUpdated ?? '-';
  const tickerData = tickers[symbol];

  // MA 기간 설정을 위한 상태 추가
  const [shortPeriod, setShortPeriod] = useState<number>(5);
  const [mediumPeriod, setMediumPeriod] = useState<number>(20);
  const [longPeriod, setLongPeriod] = useState<number>(10);
  
  // MA 기간 변경 핸들러
  const handleMAChange = (type: 'short' | 'long' | 'medium', value: number) => {
    if (type === 'short') {
      setShortPeriod(value);
    } else if (type === 'medium') {
      setMediumPeriod(value);
    } else {
      setLongPeriod(value);
    }
    
    // 차트 데이터 업데이트
    if (candleSeriesRef.current && shortEMASeriesRef.current && mediumEMASeriesRef.current && longEMASeriesRef.current) {
      const candleData = candleSeriesRef.current.data() as CandlestickData<Time>[];
      const shortEMAData = calculateEMA(candleData, type === 'short' ? value : shortPeriod);
      const mediumEMAData = calculateEMA(candleData, type === 'medium' ? value : mediumPeriod);
      const longEMAData = calculateEMA(candleData, type === 'long' ? value : longPeriod);
      
      shortEMASeriesRef.current.setData(shortEMAData);
      mediumEMASeriesRef.current.setData(mediumEMAData);
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
      
      // 백테스팅 결과 업데이트
      const result = calculateBacktestResult(candleData, crossPoints);
      setBacktestResult(result);
    }
  };

  // 차트 타입에 따른 API 엔드포인트 결정
  const getChartEndpoint = (type: string) => {
    if (type.startsWith('seconds/')) {
      const seconds = type.split('/')[1];
      return `minutes/1`; // 초 단위는 1분봉으로 요청
    }
    const minutes = parseInt(type);
    if (minutes <= 240) { // 1분봉, 3분봉, 일봉(240분)
      return `minutes/${type}`;
    } else if (minutes === 7200) { // 월봉
      return 'months';
    } else { // 년봉
      return 'years';
    }
  };

  // 차트 타입에 따른 데이터 개수 결정
  const getChartCount = (type: string) => {
    if (type.startsWith('seconds/')) {
      return 300; // 초 단위는 300개 데이터
    }
    const minutes = parseInt(type);
    if (minutes <= 3) return 200;     // 분봉
    if (minutes <= 240) return 200;   // 일봉
    if (minutes === 7200) return 30;  // 월봉
    return 10;                        // 년봉
  };

  // 데이터 로드 함수를 useCallback으로 감싸서 재사용 가능하게 만듦
  const loadChartData = useCallback(async () => {
    try {
      const endpoint = getChartEndpoint(chartType);
      const count = getChartCount(chartType);
      // 현재 시간을 ISO 문자열로 변환
      const now = new Date().toISOString();
      const response = await fetch(`https://api.upbit.com/v1/candles/${endpoint}?market=${symbol}&count=${count}&to=${now}`);
      const data = await response.json();
      
      let candleData: CandlestickData<Time>[] = [];
      let volumeData: HistogramData<Time>[] = [];

      if (chartType.startsWith('seconds/')) {
        // 초 단위 캔들 생성
        const secondsInterval = parseInt(chartType.split('/')[1]);
        const baseData = data.map((item: UpbitCandle) => {
          const timestamp = new Date(item.candle_date_time_kst);
          const trades = [];
          // 1분을 초 단위로 나누기
          for (let i = 0; i < 60; i += secondsInterval) {
            const candleTime = new Date(timestamp);
            candleTime.setSeconds(candleTime.getSeconds() + i);
            
            // 각 초 단위 캔들의 가격 계산
            const ratio = i / 60; // 0 ~ 1 사이의 값
            const currentPrice = item.opening_price + (item.trade_price - item.opening_price) * ratio;
            const prevPrice: number = i === 0 ? item.opening_price : trades[trades.length - 1]?.close || item.opening_price;
            
            trades.push({
              time: Math.floor(candleTime.getTime() / 1000) as Time,
              open: prevPrice,
              high: Math.max(prevPrice, currentPrice),
              low: Math.min(prevPrice, currentPrice),
              close: currentPrice,
              volume: item.candle_acc_trade_volume / (60 / secondsInterval)
            });
          }
          return trades;
        }).flat();

        // 최근 데이터부터 표시하기 위해 역순으로 정렬
        candleData = baseData.map((item: any) => ({
          time: item.time,
          open: item.open,
          high: item.high,
          low: item.low,
          close: item.close
        }));

        volumeData = baseData.map((item: any) => ({
          time: item.time,
          value: item.volume,
          color: item.close > item.open ? '#26a69a80' : '#ef535080'
        }));

        // 최신 데이터가 오른쪽에 오도록 정렬
        candleData = candleData.sort((a, b) => (a.time as number) - (b.time as number));
        volumeData = volumeData.sort((a, b) => (a.time as number) - (b.time as number));
      } else {
        candleData = data.map((item: UpbitCandle) => {
          const timestamp = Math.floor(new Date(item.candle_date_time_kst).getTime() / 1000);
          return {
            time: timestamp as Time,
            open: item.opening_price,
            high: item.high_price,
            low: item.low_price,
            close: item.trade_price,
          };
        }).reverse();

        volumeData = data.map((item: UpbitCandle) => {
          const timestamp = Math.floor(new Date(item.candle_date_time_kst).getTime() / 1000);
          return {
            time: timestamp as Time,
            value: item.candle_acc_trade_volume,
            color: item.trade_price >= item.opening_price ? '#26a69a80' : '#ef535080',
          };
        }).reverse();
      }

      // 마지막 캔들 저장
      lastCandleRef.current = candleData[candleData.length - 1];

      // 이동평균 계산
      const shortEMAData = calculateEMA(candleData, shortPeriod);
      const mediumEMAData = calculateEMA(candleData, mediumPeriod);
      const longEMAData = calculateEMA(candleData, longPeriod);

      // 크로스 포인트 찾기
      const crossPoints = findCrossPoints(shortEMAData, longEMAData);
      crossPointsRef.current = crossPoints;

      // 백테스팅 결과 계산
      const result = calculateBacktestResult(candleData, crossPoints);
      setBacktestResult(result);

      // 데이터 설정
      if (candleSeriesRef.current) {
        candleSeriesRef.current.setData(candleData);
      }
      if (volumeSeriesRef.current) {
        volumeSeriesRef.current.setData(volumeData);
      }
      if (shortEMASeriesRef.current) {
        shortEMASeriesRef.current.setData(shortEMAData);
      }
      if (mediumEMASeriesRef.current) {
        mediumEMASeriesRef.current.setData(mediumEMAData);
      }
      if (longEMASeriesRef.current) {
        longEMASeriesRef.current.setData(longEMAData);
      }

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
      if (chartRef.current) {
        chartRef.current.timeScale().fitContent();
      }
    } catch (error) {
      console.error('차트 데이터 로드 중 오류:', error);
    }
  }, [symbol, chartType]);

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
      height: 400,
      timeScale: {
        timeVisible: true,
        secondsVisible: chartType.startsWith('seconds/') || parseInt(chartType) <= 240,
        tickMarkFormatter: (time: number) => {
          const date = new Date(time * 1000);
          // 한국 시간으로 변환
          const koreanTime = new Date(date.getTime() + (9 * 60 * 60 * 1000));
          const hours = koreanTime.getUTCHours().toString().padStart(2, '0');
          const minutes = koreanTime.getUTCMinutes().toString().padStart(2, '0');
          const seconds = koreanTime.getUTCSeconds().toString().padStart(2, '0');
          const month = (koreanTime.getUTCMonth() + 1).toString().padStart(2, '0');
          const day = koreanTime.getUTCDate().toString().padStart(2, '0');
          
          if (chartType.startsWith('seconds/') || parseInt(chartType) <= 240) {
            return `${hours}:${minutes}:${seconds}`;
          } else if (parseInt(chartType) === 7200) { // 월봉
            return `${month}/${day}`;
          } else if (parseInt(chartType) === 86400) { // 년봉
            return `${koreanTime.getUTCFullYear()}/${month}`;
          } else {
            return `${month}/${day} ${hours}:${minutes}`;
          }
        },
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

    // 거래량 시리즈 생성
    const volumeSeries = chart.addSeries(HistogramSeries, {
      color: '#26a69a',
      priceFormat: {
        type: 'volume',
      },
      priceScaleId: 'volume',
      scaleMargins: {
        top: 0.7,
        bottom: 0,
      },
    } as HistogramSeriesPartialOptions);
    volumeSeriesRef.current = volumeSeries;

    // 이동평균선 시리즈 생성
    const shortEMASeries = chart.addSeries(LineSeries, {
      color: '#FF5252',
      lineWidth: 2,
      title: '5분 EMA',
      priceLineVisible: false,
    });
    shortEMASeriesRef.current = shortEMASeries;

    const mediumEMASeries = chart.addSeries(LineSeries, {
      color: '#FFA726',
      lineWidth: 2,
      title: '20분 EMA',
      priceLineVisible: false,
    });
    mediumEMASeriesRef.current = mediumEMASeries;

    const longEMASeries = chart.addSeries(LineSeries, {
      color: '#2196F3',
      lineWidth: 2,
      title: '10분 EMA',
      priceLineVisible: false,
    });
    longEMASeriesRef.current = longEMASeries;

    // 데이터 로드 및 설정
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
  }, [symbol, chartType, loadChartData]);

  // 실시간 가격 업데이트 처리
  useEffect(() => {
    if (!currentPrice || !candleSeriesRef.current || !lastCandleRef.current || !tickerData) return;

    // WebSocket timestamp 검증
    const timestamp = Math.floor(tickerData.timestamp / 1000);
    if (!timestamp || isNaN(timestamp)) return;  // 유효하지 않은 timestamp 처리

    const lastCandle = lastCandleRef.current;
    const candleSeries = candleSeriesRef.current;
    const volumeSeries = volumeSeriesRef.current;
    
    // 거래량 계산 함수
    const calculateVolume = (volume: number) => {
      if (!volume || isNaN(volume)) return 0;
      return Math.min(Math.max(volume, 0), 90071992547409);  // 거래량 범위 제한
    };
    
    // 차트 타입에 따른 캔들 간격 계산
    let interval: number;
    if (chartType.startsWith('seconds/')) {
      interval = parseInt(chartType.split('/')[1]);
      // 초봉 차트의 경우 실시간으로 새 캔들 생성
      const currentSecond = timestamp % 60;
      const lastCandleSecond = (lastCandle.time as number) % 60;
      
      // 시간 순서 검증
      if ((lastCandle.time as number) > timestamp) {
        return; // 이전 시간의 데이터는 무시
      }

      if (currentSecond !== lastCandleSecond) {
        // 새로운 캔들 생성
        const newCandle: CandlestickData<Time> = {
          time: timestamp as Time,
          open: lastCandle.close,
          high: currentPrice,
          low: currentPrice,
          close: currentPrice
        };
        
        if (candleSeries) {
          candleSeries.update(newCandle);
          lastCandleRef.current = newCandle;
        }

        // 거래량 업데이트
        if (volumeSeries) {
          const volume = calculateVolume(tickerData.acc_trade_volume);
          const newVolume: HistogramData<Time> = {
            time: timestamp as Time,
            value: volume,
            color: currentPrice >= lastCandle.close ? '#26a69a80' : '#ef535080'
          };
          volumeSeries.update(newVolume);
        }
      } else {
        // 현재 캔들 업데이트
        const updatedCandle: CandlestickData<Time> = {
          ...lastCandle,
          high: Math.max(lastCandle.high, currentPrice),
          low: Math.min(lastCandle.low, currentPrice),
          close: currentPrice
        };

        if (candleSeries) {
          candleSeries.update(updatedCandle);
          lastCandleRef.current = updatedCandle;
        }

        // 거래량 업데이트
        if (volumeSeries) {
          const volume = calculateVolume(tickerData.acc_trade_volume);
          const updatedVolume: HistogramData<Time> = {
            time: lastCandle.time,
            value: volume,
            color: currentPrice >= lastCandle.open ? '#26a69a80' : '#ef535080'
          };
          volumeSeries.update(updatedVolume);
        }
      }
    } else {
      interval = parseInt(chartType) * 60; // minutes to seconds
      
      // 현재 시간이 마지막 캔들의 시간 + 간격을 넘었다면 새로운 캔들 생성
      if (timestamp >= (lastCandle.time as number) + interval) {
        loadChartData();
      } else {
        // 현재 캔들 업데이트
        const updatedCandle: CandlestickData<Time> = {
          ...lastCandle,
          high: Math.max(lastCandle.high, currentPrice),
          low: Math.min(lastCandle.low, currentPrice),
          close: currentPrice
        };

        if (candleSeries) {
          candleSeries.update(updatedCandle);
          lastCandleRef.current = updatedCandle;
        }

        // 거래량 업데이트
        if (volumeSeries) {
          const volume = calculateVolume(tickerData.acc_trade_volume);
          const updatedVolume: HistogramData<Time> = {
            time: lastCandle.time,
            value: volume,
            color: currentPrice >= lastCandle.open ? '#26a69a80' : '#ef535080'
          };
          volumeSeries.update(updatedVolume);
        }
      }
    }

    setChartPrice(currentPrice);
  }, [currentPrice, tickerData, chartType, loadChartData]);

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

  // 백테스팅 결과 계산 함수
  const calculateBacktestResult = (data: CandlestickData<Time>[], crossPoints: CrossPoint[]): BacktestResult => {
    const FEE = 0.0005; // 0.05% 수수료
    const trades = [];
    let currentPosition: { time: Time; price: number; } | null = null;
    
    for (let i = 0; i < crossPoints.length; i++) {
      const point = crossPoints[i];
      
      if (point.position === 'buy' && !currentPosition) {
        // 매수 신호
        currentPosition = { time: point.time, price: point.value };
      } else if (point.position === 'sell' && currentPosition) {
        // 매도 신호 - 수익률 계산
        const entryPrice = currentPosition.price;
        const exitPrice = point.value;
        const grossReturn = (exitPrice - entryPrice) / entryPrice;
        const netReturn = grossReturn - (FEE * 2); // 매수, 매도 각각 수수료 적용
        
        trades.push({
          entryTime: currentPosition.time,
          exitTime: point.time,
          entryPrice,
          exitPrice,
          return: netReturn,
          isSuccess: netReturn > 0
        });
        
        currentPosition = null;
      }
    }
    
    const successfulTrades = trades.filter(t => t.isSuccess).length;
    const totalReturn = trades.reduce((sum, t) => sum + t.return, 0);
    
    return {
      totalTrades: trades.length,
      successfulTrades,
      totalReturn,
      successRate: trades.length > 0 ? (successfulTrades / trades.length) * 100 : 0,
      averageReturn: trades.length > 0 ? totalReturn / trades.length : 0,
      trades
    };
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
      {/* MA 설정 패널 */}
      <div className="grid grid-cols-3 gap-4 mb-4">
        <div className="bg-gray-800 p-4 rounded-lg">
          <div className="text-gray-400 text-sm mb-2">단기 이동평균선 기간</div>
          <div className="flex items-center space-x-4">
            <input
              type="range"
              min="2"
              max="30"
              value={shortPeriod}
              onChange={(e) => handleMAChange('short', parseInt(e.target.value))}
              className="flex-1"
            />
            <div className="text-white font-bold w-12 text-center">{shortPeriod}</div>
          </div>
        </div>
        <div className="bg-gray-800 p-4 rounded-lg">
          <div className="text-gray-400 text-sm mb-2">중기 이동평균선 기간</div>
          <div className="flex items-center space-x-4">
            <input
              type="range"
              min="5"
              max="50"
              value={mediumPeriod}
              onChange={(e) => handleMAChange('medium', parseInt(e.target.value))}
              className="flex-1"
            />
            <div className="text-white font-bold w-12 text-center">{mediumPeriod}</div>
          </div>
        </div>
        <div className="bg-gray-800 p-4 rounded-lg">
          <div className="text-gray-400 text-sm mb-2">장기 이동평균선 기간</div>
          <div className="flex items-center space-x-4">
            <input
              type="range"
              min="10"
              max="100"
              value={longPeriod}
              onChange={(e) => handleMAChange('long', parseInt(e.target.value))}
              className="flex-1"
            />
            <div className="text-white font-bold w-12 text-center">{longPeriod}</div>
          </div>
        </div>
      </div>

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
        {symbol} {chartType} 차트
      </div>
      <div ref={container} id="chart" className="w-full" />

      {/* 백테스팅 결과 표시 */}
      {backtestResult && (
        <div className="grid grid-cols-5 gap-4 mt-4">
          <div className="bg-gray-800 p-4 rounded-lg">
            <div className="text-gray-400 text-sm">총 거래 횟수</div>
            <div className="text-white text-lg font-bold">
              {backtestResult.totalTrades}회
            </div>
          </div>
          <div className="bg-gray-800 p-4 rounded-lg">
            <div className="text-gray-400 text-sm">성공 거래</div>
            <div className="text-white text-lg font-bold">
              {backtestResult.successfulTrades}회
            </div>
          </div>
          <div className="bg-gray-800 p-4 rounded-lg">
            <div className="text-gray-400 text-sm">성공률</div>
            <div className="text-white text-lg font-bold">
              {backtestResult.successRate.toFixed(2)}%
            </div>
          </div>
          <div className="bg-gray-800 p-4 rounded-lg">
            <div className="text-gray-400 text-sm">총 수익률</div>
            <div className={`text-lg font-bold ${
              backtestResult.totalReturn >= 0 ? 'text-green-500' : 'text-red-500'
            }`}>
              {(backtestResult.totalReturn * 100).toFixed(2)}%
            </div>
          </div>
          <div className="bg-gray-800 p-4 rounded-lg">
            <div className="text-gray-400 text-sm">평균 수익률</div>
            <div className={`text-lg font-bold ${
              backtestResult.averageReturn >= 0 ? 'text-green-500' : 'text-red-500'
            }`}>
              {(backtestResult.averageReturn * 100).toFixed(2)}%
            </div>
          </div>
        </div>
      )}
      
      {/* 개별 거래 내역 */}
      {backtestResult && backtestResult.trades.length > 0 && (
        <div className="mt-4 bg-gray-800 p-4 rounded-lg">
          <div className="text-white text-lg font-bold mb-4">거래 내역</div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-white">
              <thead>
                <tr className="text-gray-400">
                  <th className="px-4 py-2">진입 시간</th>
                  <th className="px-4 py-2">청산 시간</th>
                  <th className="px-4 py-2">진입 가격</th>
                  <th className="px-4 py-2">청산 가격</th>
                  <th className="px-4 py-2">수익률</th>
                </tr>
              </thead>
              <tbody>
                {backtestResult.trades.map((trade, index) => (
                  <tr key={index} className="border-t border-gray-700">
                    <td className="px-4 py-2">{new Date((trade.entryTime as number) * 1000).toLocaleString()}</td>
                    <td className="px-4 py-2">{new Date((trade.exitTime as number) * 1000).toLocaleString()}</td>
                    <td className="px-4 py-2">{trade.entryPrice.toLocaleString()}</td>
                    <td className="px-4 py-2">{trade.exitPrice.toLocaleString()}</td>
                    <td className={`px-4 py-2 ${trade.return >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                      {(trade.return * 100).toFixed(2)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}; 