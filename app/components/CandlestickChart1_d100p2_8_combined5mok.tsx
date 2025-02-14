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
  position: 'buy' | 'sell' | 'stop_loss';
  value: number;
  reason: string;
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
    reason: string;
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
  const secondSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  
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
      const crossPoints = findCrossPoints(candleData, secondData, shortEMAData, mediumEMAData, longEMAData);
      crossPointsRef.current = crossPoints;
      
      // 매수/매도 마커 업데이트
      const markers: SeriesMarker<Time>[] = crossPoints.map(point => ({
        time: point.time,
        position: point.position === 'buy' ? 'belowBar' : 'aboveBar',
        color: point.position === 'buy' ? '#26a69a' : 
               point.position === 'sell' ? '#ef5350' : '#ff9800',  // stop_loss는 주황색
        shape: point.position === 'buy' ? 'arrowUp' : 
               point.position === 'sell' ? 'arrowDown' : 'circle',  // stop_loss는 원형
        text: `${point.position === 'buy' ? '매수' : 
               point.position === 'sell' ? '매도' : '손절'} (${point.reason})`,
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

  // 상태 변수 선언을 컴포넌트 상단으로 이동
  const [displayedCandleCount, setDisplayedCandleCount] = useState<number>(100); // 기본값 100
  const [minuteData, setMinuteData] = useState<CandlestickData<Time>[]>([]);
  const [secondData, setSecondData] = useState<CandlestickData<Time>[]>([]);

  // 데이터 로드 함수를 useCallback으로 감싸서 재사용 가능하게 만듦
  const loadChartData = useCallback(async () => {
    try {
      if (chartType === "combined") {
        // 일봉, 분봉, 3초봉 데이터 모두 가져오기
        const minuteCount = displayedCandleCount;
        const dailyEndpoint = getChartEndpoint("240"); // 일봉
        const minuteEndpoint = getChartEndpoint("1"); // 1분봉
        const secondEndpoint = getChartEndpoint("seconds/3"); // 3초봉으로 변경

        const now = new Date().toISOString();
        const dailyResponse = await fetch(`https://api.upbit.com/v1/candles/${dailyEndpoint}?market=${symbol}&count=200&to=${now}`);
        const minuteResponse = await fetch(`https://api.upbit.com/v1/candles/${minuteEndpoint}?market=${symbol}&count=${minuteCount}&to=${now}`);
        const secondResponse = await fetch(`https://api.upbit.com/v1/candles/${secondEndpoint}?market=${symbol}&count=300&to=${now}`);

        const dailyData = await dailyResponse.json();
        const minuteData = await minuteResponse.json();
        const secondData = await secondResponse.json();

        // 데이터 변환 및 정렬
        const formattedDailyData = dailyData.map((item: UpbitCandle) => ({
          time: Math.floor(new Date(item.candle_date_time_kst).getTime() / 1000) as Time,
          open: item.opening_price,
          high: item.high_price,
          low: item.low_price,
          close: item.trade_price,
        }));

        const formattedMinuteData = minuteData.map((item: UpbitCandle) => ({
          time: Math.floor(new Date(item.candle_date_time_kst).getTime() / 1000) as Time,
          open: item.opening_price,
          high: item.high_price,
          low: item.low_price,
          close: item.trade_price,
        }));

        const formattedSecondData = secondData.map((item: UpbitCandle) => ({
          time: Math.floor(new Date(item.candle_date_time_kst).getTime() / 1000) as Time,
          open: item.opening_price,
          high: item.high_price,
          low: item.low_price,
          close: item.trade_price,
        }));

        // 데이터 정렬
        const sortedDailyData = [...formattedDailyData].sort((a, b) => (a.time as number) - (b.time as number));
        const sortedMinuteData = [...formattedMinuteData].sort((a, b) => (a.time as number) - (b.time as number));
        const sortedSecondData = [...formattedSecondData].sort((a, b) => (a.time as number) - (b.time as number));

        // 차트에 데이터 설정
        if (candleSeriesRef.current) {
          candleSeriesRef.current.setData(sortedMinuteData);
        }
        if (secondSeriesRef.current) {
          secondSeriesRef.current.setData(sortedSecondData);
        }

        // EMA 계산
        const dailyShortEMA = calculateEMA(sortedDailyData, shortPeriod);
        const dailyMediumEMA = calculateEMA(sortedDailyData, mediumPeriod);
        const minuteShortEMA = calculateEMA(sortedMinuteData, shortPeriod);
        const minuteMediumEMA = calculateEMA(sortedMinuteData, mediumPeriod);
        const secondShortEMA = calculateEMA(sortedSecondData, shortPeriod);
        const secondMediumEMA = calculateEMA(sortedSecondData, mediumPeriod);

        // 크로스 포인트 찾기
        const crossPoints: CrossPoint[] = [];

        // 일봉 매수 신호 찾기
        for (let i = 1; i < dailyShortEMA.length; i++) {
          if (dailyShortEMA[i - 1].value <= dailyMediumEMA[i - 1].value && 
              dailyShortEMA[i].value > dailyMediumEMA[i].value) {
            crossPoints.push({
              time: dailyShortEMA[i].time,
              position: 'buy',
              value: dailyShortEMA[i].value,
              reason: '일봉: 매수신호'
            });
          }
        }

        // 분봉 매수 신호 찾기
        for (let i = 1; i < minuteShortEMA.length; i++) {
          if (minuteShortEMA[i - 1].value <= minuteMediumEMA[i - 1].value && 
              minuteShortEMA[i].value > minuteMediumEMA[i].value) {
            crossPoints.push({
              time: minuteShortEMA[i].time,
              position: 'buy',
              value: minuteShortEMA[i].value,
              reason: '분봉: 매수신호'
            });
          }
        }

        // 초봉 매도 신호 찾기
        for (let i = 1; i < secondShortEMA.length; i++) {
          if (secondShortEMA[i - 1].value >= secondMediumEMA[i - 1].value && 
              secondShortEMA[i].value < secondMediumEMA[i].value) {
            crossPoints.push({
              time: secondShortEMA[i].time,
              position: 'sell',
              value: secondShortEMA[i].value,
              reason: '3초봉: 매도신호'
            });
          }
        }

        // 매수/매도 마커 생성
        const markers: SeriesMarker<Time>[] = crossPoints.map(point => ({
          time: point.time,
          position: point.position === 'buy' ? 'belowBar' : 'aboveBar',
          color: point.position === 'buy' ? '#26a69a' : '#ef5350',
          shape: point.position === 'buy' ? 'arrowUp' : 'arrowDown',
          text: point.reason,
        }));

        if (candleSeriesRef.current) {
          createSeriesMarkers(candleSeriesRef.current, markers);
        }

        // 백테스트 결과 계산
        const result = calculateBacktestResult(sortedMinuteData, crossPoints);
        setBacktestResult(result);

        // 차트 영역 맞추기
        if (chartRef.current) {
          chartRef.current.timeScale().fitContent();
        }
      } else {
        const endpoint = getChartEndpoint(chartType);
        const count = getChartCount(chartType);
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
        const crossPoints = findCrossPoints(candleData, secondData, shortEMAData, mediumEMAData, longEMAData);
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
          color: point.position === 'buy' ? '#26a69a' : 
                 point.position === 'sell' ? '#ef5350' : '#ff9800',  // stop_loss는 주황색
          shape: point.position === 'buy' ? 'arrowUp' : 
                 point.position === 'sell' ? 'arrowDown' : 'circle',  // stop_loss는 원형
          text: `${point.position === 'buy' ? '매수' : 
                 point.position === 'sell' ? '매도' : '손절'} (${point.reason})`,
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

        // 예시: 데이터 로드 직후 로그 출력
        console.log('Daily Data:', candleData);
        console.log('Minute Data:', volumeData);
        console.log('Second Data:', data);
        console.log('Combined Signals:', crossPoints);
        console.log('Backtest Result:', result);
        console.log('Loaded Minute Data:', minuteData);
        console.log('Loaded Second Data:', secondData);
        console.log('Cross Points:', crossPointsRef.current);
        console.log('Backtest Result:', backtestResult);
      }
    } catch (error) {
      console.error('차트 데이터 로드 중 오류:', error);
    }
  }, [symbol, chartType, displayedCandleCount, shortPeriod, mediumPeriod, longPeriod]);

  useEffect(() => {
    if (!container.current) return;

    const chart = createChart(container.current, {
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
    });
    chartRef.current = chart;

    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: '#26a69a',
      downColor: '#ef5350',
      borderVisible: false,
      wickUpColor: '#26a69a',
      wickDownColor: '#ef5350',
    });
    candleSeriesRef.current = candleSeries;

    // Combined 모드일 때 초봉 시리즈 추가
    if (chartType === "combined") {
      const secondSeries = chart.addSeries(CandlestickSeries, {
        upColor: '#26a69a',
        downColor: '#ef5350',
        borderVisible: false,
        wickUpColor: '#26a69a',
        wickDownColor: '#ef5350',
      });
      secondSeriesRef.current = secondSeries;
    }

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

    return () => {
      chart.remove();
    };
  }, [chartType]);

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
  }, [currentPrice, tickerData, chartType, displayedCandleCount, loadChartData]);

  useEffect(() => {
    if (candleSeriesRef.current) {
      const markers: SeriesMarker<Time>[] = crossPointsRef.current.map(point => ({
        time: point.time,
        position: point.position === 'buy' ? 'belowBar' : 'aboveBar',
        color: point.position === 'buy' ? '#26a69a' : '#ef5350',
        shape: point.position === 'buy' ? 'arrowUp' : 'arrowDown',
        text: point.reason,
      }));
      createSeriesMarkers(candleSeriesRef.current, markers);
    }
  }, [crossPointsRef.current]);

  useEffect(() => {
    if (candleSeriesRef.current) {
      const sortedMinuteData = [...minuteData].sort((a, b) => (a.time as number) - (b.time as number));
      candleSeriesRef.current.setData(sortedMinuteData);
    }
    if (secondSeriesRef.current) {
      const sortedSecondData = [...secondData].sort((a, b) => (a.time as number) - (b.time as number));
      secondSeriesRef.current.setData(sortedSecondData);
    }
  }, [minuteData, secondData]);

  // EMA 계산 함수
  const calculateEMA = (data: CandlestickData<Time>[], period: number): LineData<Time>[] => {
    const k = 2 / (period + 1);
    let ema = data[0].close;
    
    return data.map(candle => ({
      time: candle.time,
      value: (ema = candle.close * k + ema * (1 - k)),
    }));
  };

  // 거래량 평균 계산 함수 추가
  const calculateVolumeMA = (data: CandlestickData<Time>[], period: number): number => {
    const recentData = data.slice(-period);
    const volumeSum = recentData.reduce((sum, candle) => sum + (candle as any).volume, 0);
    return volumeSum / period;
  };

  // RSI 계산 함수
  const calculateRSI = (data: CandlestickData<Time>[], period: number): number[] => {
    const rsi: number[] = [];
    let gains = 0;
    let losses = 0;

    // 데이터 길이 확인
    if (data.length < period) {
      console.error('데이터 길이가 기간보다 짧습니다.');
      return rsi; // 빈 배열 반환
    }

    // 초기값 계산 (첫 period-1개의 변화량)
    for (let i = 1; i < period; i++) {
      if (data[i] && data[i - 1]) { // 데이터가 정의되어 있는지 확인
        const difference = data[i].close - data[i - 1].close;
        if (difference >= 0) {
          gains += difference;
        } else {
          losses += Math.abs(difference);
        }
      }
    }

    let avgGain = gains / period;
    let avgLoss = losses / period;
    let rs = avgGain / avgLoss;
    rsi.push(100 - (100 / (1 + rs)));

    for (let i = period; i < data.length; i++) {
      if (data[i] && data[i - 1]) { // 데이터가 정의되어 있는지 확인
        const difference = data[i].close - data[i - 1].close;
        if (difference >= 0) {
          avgGain = (avgGain * (period - 1) + difference) / period;
          avgLoss = (avgLoss * (period - 1)) / period;
        } else {
          avgGain = (avgGain * (period - 1)) / period;
          avgLoss = (avgLoss * (period - 1) - difference) / period;
        }
        rs = avgGain / avgLoss;
        rsi.push(100 - (100 / (1 + rs)));
      }
    }

    return rsi;
  };

  // 크로스 포인트 찾기 함수 수정
  const findCrossPoints = (
    minuteData: CandlestickData<Time>[],
    secondData: CandlestickData<Time>[],
    shortEMA: LineData<Time>[],
    mediumEMA: LineData<Time>[],
    longEMA: LineData<Time>[]
  ): CrossPoint[] => {
    const crossPoints: CrossPoint[] = [];
    // const rsiValuesCombined = calculateRSI(minuteData, 14);

    for (let i = 1; i < shortEMA.length; i++) {
      const prevShort = shortEMA[i - 1].value;
      const prevMedium = mediumEMA[i - 1].value;
      const currShort = shortEMA[i].value;
      const currMedium = mediumEMA[i].value;

      // 분봉 매수 신호
      if (prevShort <= prevMedium && currShort > currMedium) {
        crossPoints.push({
          time: shortEMA[i].time,
          position: 'buy',
          value: currShort,
          reason: '분봉 골든크로스'
        });
      }

      // 초봉 매수 신호
      const secondShortEMA = calculateEMA(secondData, 5);
      const secondMediumEMA = calculateEMA(secondData, 15);
      for (let j = 1; j < secondShortEMA.length; j++) {
        const prevSecondShort = secondShortEMA[j - 1].value;
        const currSecondShort = secondShortEMA[j].value;
        const currSecondMedium = secondMediumEMA[j].value;

        if (prevSecondShort <= currSecondMedium && currSecondShort > currSecondMedium) {
          crossPoints.push({
            time: secondShortEMA[j].time,
            position: 'buy',
            value: currSecondShort,
            reason: '초봉 골든크로스'
          });
        }
      }
    }

    return crossPoints;
  };

  // 백테스팅 결과 계산 함수
  const calculateBacktestResult = (data: CandlestickData<Time>[], crossPoints: CrossPoint[]): BacktestResult => {
    const FEE = 0.0005; // 0.05% 수수료
    const trades = [];
    let currentPosition: { 
      time: Time; 
      price: number; 
      reason: string;
    } | null = null;
    
    // 시간순으로 정렬
    const sortedCrossPoints = [...crossPoints].sort((a, b) => 
      (a.time as number) - (b.time as number)
    );
    
    for (let i = 0; i < sortedCrossPoints.length; i++) {
      const point = sortedCrossPoints[i];
      
      // 매수 신호 (일봉 또는 분봉)
      if (point.position === 'buy' && !currentPosition) {
        currentPosition = { 
          time: point.time, 
          price: point.value,
          reason: point.reason 
        };
      } 
      // 매도 신호 (초봉)
      else if (point.position === 'sell' && currentPosition) {
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
          isSuccess: netReturn > 0,
          reason: `${currentPosition.reason} → ${point.reason}`
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
      <div ref={container} id="chart" className="w-full" style={{ height: '600px' }} />

      {/* 백테스트 결과 표시 */}
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
            <div className="text-white text-lg font-bold">
              {(backtestResult.totalReturn * 100).toFixed(2)}%
            </div>
          </div>
          <div className="bg-gray-800 p-4 rounded-lg">
            <div className="text-gray-400 text-sm">평균 수익률</div>
            <div className="text-white text-lg font-bold">
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
                  <th className="px-4 py-2">매매 사유</th>
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
                    <td className="px-4 py-2">{trade.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {chartType === "combined" && (
        <div className="bg-gray-800 p-4 rounded-lg mt-4">
          <div className="text-gray-400 text-sm mb-2">분봉 봉 갯수</div>
          <div className="flex items-center space-x-4">
            <input
              type="range"
              min="10"
              max="200"
              value={displayedCandleCount}
              onChange={(e) => setDisplayedCandleCount(parseInt(e.target.value, 10))}
              className="flex-1"
            />
            <div className="text-white font-bold w-12 text-center">
              {displayedCandleCount}
            </div>
          </div>
          <button
            onClick={loadChartData}
            className="mt-2 px-4 py-2 bg-blue-600 text-white rounded"
          >
            적용
          </button>
        </div>
      )}
    </div>
  );
}; 