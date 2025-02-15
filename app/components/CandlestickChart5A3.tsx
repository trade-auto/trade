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

// 기존 CandlestickData 인터페이스 확장
interface ExtendedCandlestickData extends CandlestickData<Time> {
  volume?: number;
}

// Define a Trade interface
interface Trade {
  entryTime: Time;
  exitTime: Time;
  entryPrice: number;
  exitPrice: number;
  return: number;
  isSuccess: boolean;
}

// 날짜 선택을 위한 인터페이스 추가
interface DateRange {
  startDate: Date;
  endDate: Date;
}

export const CandlestickChart: React.FC<ChartProps> = ({ symbol, chartType }) => {
  const container = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const threeEMASeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const sixEMASeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const twentyEMASeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const lastCandleRef = useRef<CandlestickData<Time> | null>(null);
  const buyMarkerSeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const sellMarkerSeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const crossPointsRef = useRef<CrossPoint[]>([]);
  const volumeSeriesRef = useRef<ISeriesApi<"Histogram"> | null>(null);
  const prevVolumeRef = useRef<number>(0); // 이전 거래량을 저장하기 위한 ref 추가
  const prevTradeTimeRef = useRef<number>(0); // 이전 거래 시간을 저장하기 위한 ref 추가
  const accVolumeRef = useRef<number>(0); // 현재 캔들의 누적 거래량을 저장하기 위한 ref 추가
  const isLoadingRef = useRef<boolean>(false); // 데이터 로딩 상태를 추적하기 위한 ref
  const oldestTimestampRef = useRef<number | null>(null); // 가장 오래된 데이터의 timestamp를 저장하기 위한 ref
  
  const { prices, tickers } = useUpbitStore();
  const [chartPrice, setChartPrice] = useState<number>(0);
  const [backtestResult, setBacktestResult] = useState<BacktestResult | null>(null);
  
  const currentPrice = prices[symbol]?.currentPrice ?? 0;
  const lastUpdated = prices[symbol]?.lastUpdated ?? '-';
  const tickerData = tickers[symbol];

  // MA 기간 설정을 위한 상태 추가
  const [thirtyPeriod, setThirtyPeriod] = useState<number>(30);
  const [fortyPeriod, setFortyPeriod] = useState<number>(40);
  const [sixtyPeriod, setSixtyPeriod] = useState<number>(60);
  
  // 날짜 선택을 위한 인터페이스 추가
  const [dateRange, setDateRange] = useState<DateRange>({
    startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 기본값: 7일 전
    endDate: new Date() // 항상 현재 시간
  });
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [progress, setProgress] = useState<number>(0);
  
  // MA 기간 변경 핸들러
  const handleMAChange = (type: 'thirty' | 'forty' | 'sixty', value: number) => {
    if (type === 'thirty') {
      setThirtyPeriod(value);
    } else if (type === 'forty') {
      setFortyPeriod(value);
    } else if (type === 'sixty') {
      setSixtyPeriod(value);
    }
    
    // 차트 데이터 업데이트
    if (candleSeriesRef.current && threeEMASeriesRef.current && sixEMASeriesRef.current && twentyEMASeriesRef.current) {
      const candleData = candleSeriesRef.current.data() as ExtendedCandlestickData[];
      const threeEMAData = calculateEMA(candleData, type === 'thirty' ? value : thirtyPeriod);
      const sixEMAData = calculateEMA(candleData, type === 'forty' ? value : fortyPeriod);
      const twentyEMAData = calculateEMA(candleData, type === 'sixty' ? value : sixtyPeriod);
      
      threeEMASeriesRef.current.setData(threeEMAData);
      sixEMASeriesRef.current.setData(sixEMAData);
      twentyEMASeriesRef.current.setData(twentyEMAData);
      
      // 크로스 포인트 업데이트
      const crossPoints = findCrossPoints(threeEMAData, sixEMAData, twentyEMAData);
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
      return 'seconds'; // 초봉 API 엔드포인트
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
      return 200; // 초봉은 최대 200개까지 요청 가능
    }
    const minutes = parseInt(type);
    if (minutes <= 3) return 430;     // 분봉 (기존 200개에서 30개 추가)
    if (minutes <= 240) return 430;   // 일봉 (기존 200개에서 30개 추가)
    if (minutes === 7200) return 60;  // 월봉 (기존 30개에서 30개 추가)
    return 40;                        // 년봉 (기존 10개에서 30개 추가)
  };

  // 날짜 범위 변경 핸들러
  const handleDateRangeChange = (start: Date) => {
    // 입력받은 시간을 한국 시간으로 변환
    const koreanTime = new Date(start.getTime() + (9 * 60 * 60 * 1000));
    
    setDateRange({ 
      startDate: koreanTime,
      endDate: new Date() // 항상 현재 시간으로 설정
    });
    loadAllData(koreanTime, new Date());
  };

  // 전체 데이터 로드 함수
  const loadAllData = useCallback(async (startDate: Date, endDate: Date) => {
    if (!candleSeriesRef.current) return;
    
    try {
      setIsLoading(true);
      setProgress(0);
      
      const endpoint = getChartEndpoint(chartType);
      const count = 200; // API 한 번 호출당 최대 개수
      
      let currentDate = new Date(endDate);
      const existingData = candleSeriesRef.current.data() as ExtendedCandlestickData[];
      let allCandleData: ExtendedCandlestickData[] = [...existingData];
      
      // 데이터 업데이트 함수
      const updateChart = (newData: ExtendedCandlestickData[]) => {
        if (!candleSeriesRef.current || !volumeSeriesRef.current || !chartRef.current) return;

        // 현재 차트의 visible range와 logical range 저장
        const timeScale = chartRef.current.timeScale();
        const visibleRange = timeScale.getVisibleRange();
        const logicalRange = timeScale.getVisibleLogicalRange();
        const scrollPosition = timeScale.scrollPosition();

        // 중복 제거를 위해 Map 사용
        const uniqueDataMap = new Map<number, ExtendedCandlestickData>();
        
        // 기존 데이터와 새 데이터를 모두 Map에 추가
        [...allCandleData, ...newData].forEach(item => {
          uniqueDataMap.set(item.time as number, item);
        });
        
        // Map의 값들을 배열로 변환하고 시간순으로 정렬
        const uniqueData = Array.from(uniqueDataMap.values())
          .sort((a, b) => (a.time as number) - (b.time as number));

        // 데이터 업데이트 전에 차트 업데이트 일시 중지
        chartRef.current.timeScale().applyOptions({
          lockVisibleTimeRangeOnResize: true,
        });
        
        // 캔들스틱 데이터 업데이트
        candleSeriesRef.current.setData(uniqueData);
        
        // 거래량 데이터 업데이트
        const volumeData = uniqueData.map(item => ({
          time: item.time,
          value: item.volume || 0,
          color: item.close >= item.open ? '#26a69a80' : '#ef535080',
        }));
        volumeSeriesRef.current.setData(volumeData);

        // 이동평균선 업데이트
        if (threeEMASeriesRef.current && sixEMASeriesRef.current && twentyEMASeriesRef.current) {
          const threeEMAData = calculateEMA(uniqueData, thirtyPeriod);
          const sixEMAData = calculateEMA(uniqueData, fortyPeriod);
          const twentyEMAData = calculateEMA(uniqueData, sixtyPeriod);
          
        threeEMASeriesRef.current.setData(threeEMAData);
        sixEMASeriesRef.current.setData(sixEMAData);
        twentyEMASeriesRef.current.setData(twentyEMAData);
          
          // 크로스 포인트 업데이트
          const crossPoints = findCrossPoints(threeEMAData, sixEMAData, twentyEMAData);
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

        // 백테스팅 결과 업데이트
        const result = calculateBacktestResult(uniqueData, crossPointsRef.current);
        setBacktestResult(result);
        
        // 이전 뷰 상태 복원
        requestAnimationFrame(() => {
          if (!chartRef.current) return;
          
          // 스크롤 위치 복원
          if (scrollPosition !== undefined) {
            timeScale.scrollToPosition(scrollPosition, false);
          }

          // 뷰 범위 복원
          if (logicalRange) {
            timeScale.setVisibleLogicalRange(logicalRange);
          } else if (visibleRange) {
            timeScale.setVisibleRange(visibleRange);
          }

          // 차트 업데이트 잠금 해제
          chartRef.current.timeScale().applyOptions({
            lockVisibleTimeRangeOnResize: false,
          });
        });
        
        // 전체 데이터 업데이트
        allCandleData = uniqueData;
      };

      // 비동기적으로 데이터 로드
      const loadChunk = async () => {
        while (currentDate >= startDate) {
          try {
            const toTime = currentDate.toISOString();
            const response = await fetch(`https://api.upbit.com/v1/candles/${endpoint}?market=${symbol}&count=${count}&to=${toTime}`);
            
            if (!response.ok) {
              throw new Error(`API 요청 실패: ${response.status}`);
            }
            
            const data = await response.json();
            
            if (!Array.isArray(data) || data.length === 0) break;
            
            const newCandleData: ExtendedCandlestickData[] = data
              .filter(item => new Date(item.candle_date_time_kst) >= startDate)
              .map((item: UpbitCandle) => {
                const timestamp = Math.floor(new Date(item.candle_date_time_kst).getTime() / 1000);
                return {
                  time: timestamp as Time,
                  open: item.opening_price,
                  high: item.high_price,
                  low: item.low_price,
                  close: item.trade_price,
                  volume: item.candle_acc_trade_volume
                };
              });
            
            // 새로운 데이터로 차트 즉시 업데이트
            updateChart(newCandleData);
            
            // 마지막 데이터의 시간으로 다음 요청 시간 설정
            const lastDataTime = new Date(data[data.length - 1].candle_date_time_kst);
            currentDate = new Date(lastDataTime.getTime() - 1000); // 1초 빼서 중복 방지
            
            // 진행률 계산
            const totalTime = endDate.getTime() - startDate.getTime();
            const processedTime = endDate.getTime() - currentDate.getTime();
            const newProgress = Math.min((processedTime / totalTime) * 100, 100);
            setProgress(newProgress);
            
            // API 호출 간격 조절 (초당 10회 제한)
            await new Promise(resolve => setTimeout(resolve, 100));
    } catch (error) {
            console.error('데이터 로드 중 오류:', error);
            // 에러 발생 시 3초 대기 후 재시도
            await new Promise(resolve => setTimeout(resolve, 3000));
          }
        }
      };

      // 데이터 로드 시작
      await loadChunk();
      
    } catch (error) {
      console.error('데이터 로드 중 오류:', error);
    } finally {
      setIsLoading(false);
      setProgress(100);
    }
  }, [symbol, chartType, thirtyPeriod, fortyPeriod, sixtyPeriod]);

  // 차트 초기화
  useEffect(() => {
    // Chart initialization
    if (container.current) {
      // Cleanup previous chart instance if it exists
      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
      }

      const chart = createChart(container.current, {
        layout: {
          background: { color: '#1E1E1E' },
          textColor: '#DDD',
        },
        grid: {
          vertLines: { color: '#2B2B2B' },
          horzLines: { color: '#2B2B2B' },
        },
        width: container.current.clientWidth,
        height: 400,
        timeScale: {
          timeVisible: true,
          secondsVisible: chartType.startsWith('seconds/') || parseInt(chartType) <= 240,
        },
      });
      
      chartRef.current = chart;

      // Create series
      const candleSeries = chart.addCandlestickSeries({
        upColor: '#26a69a',
        downColor: '#ef5350',
        borderVisible: false,
        wickUpColor: '#26a69a',
        wickDownColor: '#ef5350',
      });
      candleSeriesRef.current = candleSeries;

      const volumeSeries = chart.addSeries(HistogramSeries, {
        color: '#26a69a',
        priceFormat: {
          type: 'volume',
        },
        priceScaleId: 'volume',
        priceScale: {
        scaleMargins: {
            top: 0.8,
          bottom: 0,
        },
        },
      });
      volumeSeriesRef.current = volumeSeries;

      // 이동평균선 시리즈 생성
      const threeEMASeries = chart.addSeries(LineSeries, {
        color: '#FF5252',
        lineWidth: 2,
        priceLineVisible: false,
      });
      threeEMASeriesRef.current = threeEMASeries;

      const sixEMASeries = chart.addSeries(LineSeries, {
        color: '#FFA726',
        lineWidth: 2,
        priceLineVisible: false,
      });
      sixEMASeriesRef.current = sixEMASeries;

      const twentyEMASeries = chart.addSeries(LineSeries, {
        color: '#2196F3',
        lineWidth: 2,
        priceLineVisible: false,
      });
      twentyEMASeriesRef.current = twentyEMASeries;

      // 윈도우 리사이즈 핸들러
      const handleResize = () => {
        if (container.current && chartRef.current) {
          chartRef.current.applyOptions({
            width: container.current.clientWidth,
          });
        }
      };

      window.addEventListener('resize', handleResize);

      // 초기 데이터 로드
      loadAllData(dateRange.startDate, dateRange.endDate);

      // Cleanup function
      return () => {
        window.removeEventListener('resize', handleResize);
        if (chartRef.current) {
          chartRef.current.remove();
          chartRef.current = null;
        }
      };
    }
  }, [container.current]); // Only re-run if container changes

  // 차트 생성 시 스크롤 이벤트 구독
  useEffect(() => {
    if (!chartRef.current) return;

    const handleVisibleTimeRangeChange = () => {
      const visibleRange = chartRef.current?.timeScale().getVisibleRange();
      if (!visibleRange) return;

      // 왼쪽 끝(과거)으로 스크롤이 충분히 이동했을 때 추가 데이터 로드
      const candleData = candleSeriesRef.current?.data() as ExtendedCandlestickData[];
      if (!candleData || candleData.length === 0) return;

      const oldestVisible = visibleRange.from as number;
      const oldestData = candleData[0].time as number;
      
      // 보이는 영역의 시작이 현재 데이터의 시작 부분에 가까워지면 추가 데이터 로드
      if (oldestVisible - oldestData < 10 && !isLoadingRef.current) {
        isLoadingRef.current = true;
        const newStartDate = new Date(oldestData * 1000);
        loadAllData(newStartDate, dateRange.endDate).finally(() => {
          isLoadingRef.current = false;
        });
      }
    };

    chartRef.current.timeScale().subscribeVisibleTimeRangeChange(handleVisibleTimeRangeChange);

    return () => {
      chartRef.current?.timeScale().unsubscribeVisibleTimeRangeChange(handleVisibleTimeRangeChange);
    };
  }, [loadAllData]);

  // 실시간 가격 업데이트 처리
  useEffect(() => {
    if (!currentPrice || !candleSeriesRef.current || !lastCandleRef.current || !tickerData) return;

    // WebSocket timestamp 검증
    const timestamp = Math.floor(tickerData.timestamp / 1000);
    if (!timestamp || isNaN(timestamp)) return;  // 유효하지 않은 timestamp 처리

    const lastCandle = lastCandleRef.current;
    const candleSeries = candleSeriesRef.current;
    const volumeSeries = volumeSeriesRef.current;
    
    // 거래량 계산 함수 수정
    const calculateVolume = (currentAccVolume: number, tradeTimestamp: number) => {
      if (!currentAccVolume || isNaN(currentAccVolume)) return 0;
      
      // 이전 거래 시간과 현재 거래 시간이 다르면 새로운 거래로 간주
      if (tradeTimestamp !== prevTradeTimeRef.current) {
        const volume = currentAccVolume - prevVolumeRef.current;
        prevVolumeRef.current = currentAccVolume;
        prevTradeTimeRef.current = tradeTimestamp;
        accVolumeRef.current += volume;
        return accVolumeRef.current;
      }
      
      return accVolumeRef.current;
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
        // 새로운 캔들 생성시 거래량 초기화
        prevVolumeRef.current = tickerData.acc_trade_volume;
        prevTradeTimeRef.current = timestamp;
        accVolumeRef.current = 0;
        
        // 새로운 캔들 생성
        const newCandle: ExtendedCandlestickData = {
          time: timestamp as Time,
          open: lastCandle.close,
          high: currentPrice,
          low: currentPrice,
          close: currentPrice,
          volume: 0 // 새 캔들의 초기 거래량은 0
        };
        
        if (candleSeries) {
          candleSeries.update(newCandle);
          lastCandleRef.current = newCandle;
        }

        // 거래량 업데이트
        if (volumeSeries) {
          const newVolume: HistogramData<Time> = {
            time: timestamp as Time,
            value: 0,
            color: currentPrice >= lastCandle.close ? '#26a69a80' : '#ef535080'
          };
          volumeSeries.update(newVolume);
        }
      } else {
        // 현재 캔들 업데이트
        const volume = calculateVolume(tickerData.acc_trade_volume, timestamp);
        const updatedCandle: ExtendedCandlestickData = {
          ...lastCandle,
          high: Math.max(lastCandle.high, currentPrice),
          low: Math.min(lastCandle.low, currentPrice),
          close: currentPrice,
          volume: volume
        };

        if (candleSeries) {
          candleSeries.update(updatedCandle);
          lastCandleRef.current = updatedCandle;
        }

        // 거래량 업데이트
        if (volumeSeries) {
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
        // 새로운 캔들 생성시 거래량 초기화
        prevVolumeRef.current = tickerData.acc_trade_volume;
        prevTradeTimeRef.current = timestamp;
        accVolumeRef.current = 0;
        loadAllData(dateRange.startDate, dateRange.endDate);
      } else {
        // 현재 캔들 업데이트
        const volume = calculateVolume(tickerData.acc_trade_volume, timestamp);
        const updatedCandle: ExtendedCandlestickData = {
          ...lastCandle,
          high: Math.max(lastCandle.high, currentPrice),
          low: Math.min(lastCandle.low, currentPrice),
          close: currentPrice,
          volume: volume
        };

        if (candleSeries) {
          candleSeries.update(updatedCandle);
          lastCandleRef.current = updatedCandle;
        }

        // 거래량 업데이트
        if (volumeSeries) {
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
  }, [currentPrice, tickerData, chartType, loadAllData]);

  // EMA 계산 함수
  const calculateEMA = (data: ExtendedCandlestickData[], period: number): LineData<Time>[] => {
    const k = 2 / (period + 1);
    let ema = data[0].close;
    
    return data.map(candle => ({
      time: candle.time,
      value: (ema = candle.close * k + ema * (1 - k)),
    }));
  };

  // 매수/매도 신호 생성 및 거래 내역 기록 로직
  const findCrossPoints = (thirtyEMA: LineData<Time>[], fortyEMA: LineData<Time>[], sixtyEMA: LineData<Time>[]): CrossPoint[] => {
    const crossPoints: CrossPoint[] = [];
    let lastAction: 'buy' | 'sell' | null = null; // 마지막 액션을 추적
    
    for (let i = 1; i < thirtyEMA.length; i++) {
      const prevThirty = thirtyEMA[i - 1].value;
      const prevForty = fortyEMA[i - 1].value;
      const prevSixty = sixtyEMA[i - 1].value;
      const currThirty = thirtyEMA[i].value;
      const currForty = fortyEMA[i].value;
      const currSixty = sixtyEMA[i].value;
      
      // 30MA와 40MA가 60MA 이상일 때만 매수
      if (currThirty > currSixty && currForty > currSixty) {
        // 골든크로스 (30MA가 40MA를 상향돌파)
        if (prevThirty <= prevForty && currThirty > currForty && lastAction !== 'buy') {
          crossPoints.push({
            time: thirtyEMA[i].time,
            position: 'buy',
            value: currThirty,
          });
          lastAction = 'buy'; // 마지막 액션을 매수로 설정
        }
      }
      // 30MA와 40MA가 60MA를 명확히 하방 돌파한 경우에만 매도
      else if (currThirty < currSixty && currForty < currSixty && lastAction !== 'sell') {
        if (prevThirty >= prevSixty && currThirty < currSixty) {
        crossPoints.push({
          time: thirtyEMA[i].time,
          position: 'sell',
          value: currThirty,
        });
        lastAction = 'sell'; // 마지막 액션을 매도로 설정
        }
      }
    }
    
    return crossPoints;
  };

  // 백테스팅 결과 계산 함수
  const calculateBacktestResult = (data: ExtendedCandlestickData[], crossPoints: CrossPoint[]): BacktestResult => {
    const trades: Trade[] = []; // Explicitly type the trades array
    let currentPosition: { entryTime: Time; entryPrice: number; } | null = null;

    crossPoints.forEach(point => {
      if (point.position === 'buy' && !currentPosition) {
        currentPosition = { entryTime: point.time, entryPrice: point.value };
      } else if (point.position === 'sell' && currentPosition) {
        const exitPrice = point.value;
        const entryPrice = currentPosition.entryPrice;
        const tradeReturn = (exitPrice - entryPrice) / entryPrice;
        trades.push({
          entryTime: currentPosition.entryTime,
          exitTime: point.time,
          entryPrice,
          exitPrice,
          return: tradeReturn,
          isSuccess: tradeReturn > 0,
        });
        currentPosition = null;
      }
    });

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

  // 거래량 기반 신호 판단 함수
  const evaluateVolumeSignals = (candleData: ExtendedCandlestickData[], currentVolume: number, currentPrice: number): string => {
    const VMA10 = calculateVMA(candleData, 10); // 10봉 평균 거래량
    const lastCandle = candleData[candleData.length - 1];
    const volumeRatio = (currentVolume / VMA10) * 100;

    if (currentVolume >= VMA10 * 2) {
      if (currentPrice > lastCandle.close) {
        return '강한 매수 신호'; // 거래량 급증 + 상승
      } else {
        return '강한 매도 신호'; // 거래량 급증 + 하락
      }
    }

    if (volumeRatio > 150) {
      return '강한 상승 신호'; // VR > 150%
    } else if (volumeRatio < 50) {
      return '약한 매매세력'; // VR < 50%
    }

    return '';
  };

  // VMA 계산 함수
  const calculateVMA = (data: ExtendedCandlestickData[], period: number): number => {
    const volumes = data.slice(-period).map(candle => candle.volume || 0);
    const totalVolume = volumes.reduce((sum, volume) => sum + volume, 0);
    return totalVolume / period;
  };

  // OBV 계산 함수
  const calculateOBV = (data: ExtendedCandlestickData[]): number => {
    let obv = 0;
    for (let i = 1; i < data.length; i++) {
      const currentCandle = data[i];
      const previousCandle = data[i - 1];
      if (currentCandle.close > previousCandle.close) {
        obv += currentCandle.volume || 0;
      } else if (currentCandle.close < previousCandle.close) {
        obv -= currentCandle.volume || 0;
      }
    }
    return obv;
  };

  // 차트 데이터 업데이트 시 거래량 신호 평가
  useEffect(() => {
    if (!candleSeriesRef.current || !volumeSeriesRef.current) return;

    const candleData = candleSeriesRef.current.data() as ExtendedCandlestickData[];
    if (candleData.length === 0) return; // candleData가 비어 있는 경우 처리

    const lastCandle = candleData[candleData.length - 1];
    if (!lastCandle) return; // lastCandle이 undefined인 경우 처리

    const currentVolume = lastCandle.volume || 0;
    const currentPrice = lastCandle.close;

    const volumeSignal = evaluateVolumeSignals(candleData, currentVolume, currentPrice);
    const obv = calculateOBV(candleData);

    console.log('Volume Signal:', volumeSignal);
    console.log('OBV:', obv);

    // 추가적인 로직을 통해 신호를 차트에 표시하거나 백테스팅에 활용할 수 있습니다.
  }, [candleSeriesRef.current, volumeSeriesRef.current]);

  return (
    <div className="w-full min-h-screen p-4 bg-[#1e1e1e] rounded-lg">
      {/* 날짜 선택 패널 */}
      <div className="mb-4">
        <div className="bg-gray-800 p-4 rounded-lg">
          <div className="text-gray-400 text-sm mb-2">시작 날짜</div>
          <input
            type="datetime-local"
            value={new Date(dateRange.startDate.getTime() - (9 * 60 * 60 * 1000)).toISOString().slice(0, 16)}
            onChange={(e) => {
              const selectedDate = new Date(e.target.value);
              handleDateRangeChange(selectedDate);
            }}
            max={new Date().toISOString().slice(0, 16)}
            className="bg-gray-700 text-white p-2 rounded w-full"
          />
        </div>
      </div>

      {/* 로딩 프로그레스 바 */}
      {isLoading && (
        <div className="mb-4">
          <div className="text-gray-400 text-sm mb-2">데이터 로딩 중... {progress.toFixed(1)}%</div>
          <div className="w-full bg-gray-700 rounded-full h-2.5">
            <div
              className="bg-blue-600 h-2.5 rounded-full"
              style={{ width: `${progress}%` }}
            ></div>
          </div>
        </div>
      )}

      {/* MA 설정 패널 */}
      <div className="grid grid-cols-3 gap-4 mb-4">
        <div className="bg-gray-800 p-4 rounded-lg">
          <div className="text-gray-400 text-sm mb-2">MA 30 기간</div>
          <div className="flex items-center space-x-4">
            <input
              type="range"
              min="10"
              max="100"
              value={thirtyPeriod}
              onChange={(e) => handleMAChange('thirty', parseInt(e.target.value))}
              className="flex-1"
            />
            <div className="text-white font-bold w-12 text-center">{thirtyPeriod}</div>
          </div>
        </div>
        <div className="bg-gray-800 p-4 rounded-lg">
          <div className="text-gray-400 text-sm mb-2">MA 40 기간</div>
          <div className="flex items-center space-x-4">
            <input
              type="range"
              min="10"
              max="100"
              value={fortyPeriod}
              onChange={(e) => handleMAChange('forty', parseInt(e.target.value))}
              className="flex-1"
            />
            <div className="text-white font-bold w-12 text-center">{fortyPeriod}</div>
          </div>
        </div>
        <div className="bg-gray-800 p-4 rounded-lg">
          <div className="text-gray-400 text-sm mb-2">MA 60 기간</div>
          <div className="flex items-center space-x-4">
            <input
              type="range"
              min="10"
              max="100"
              value={sixtyPeriod}
              onChange={(e) => handleMAChange('sixty', parseInt(e.target.value))}
              className="flex-1"
            />
            <div className="text-white font-bold w-12 text-center">{sixtyPeriod}</div>
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