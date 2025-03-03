import { useEffect, useRef, useState, useCallback } from 'react';
import React from 'react';
import debug from 'debug';

// NodeJS 타입 정의
declare global {
  namespace NodeJS {
    interface Timeout {}
  }
}

const log = debug('trade:orders');
import { useUpbitStore } from '../../store/useUpbitStore';
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
  HistogramStyleOptions,
  SeriesOptionsCommon,
  SeriesOptions,
} from 'lightweight-charts';
import DatePicker from 'react-datepicker';
import "react-datepicker/dist/react-datepicker.css";
import { getCurrentPrice, get3SecMA } from '../../api/upbitOrder';
import { useUpbitWebSocket } from '../../hooks/useUpbitWebSocket';
import { ExtendedCandlestickData } from '../../types/candlestick';

// 분리된 컴포넌트들 임포트
import { 
  TradeStrategy, 
  UpbitCandle, 
  CrossPoint, 
  BacktestResult, 
  TickerData, 
  Trade,
  DateRange, 
  BusinessDay, 
  Order, 
  ChartProps 
} from './CandlestickChartTypes';
import { 
  getInitialDateRange, 
  getTickMarkFormatter, 
  calculateEMA, 
  formatTime, 
  calculateSlope, 
  calculateAngle 
} from './CandlestickChartHelpers';
import { findCrossPoints } from './CandlestickChartCrossPoints';
import { 
  createTradeMarkers, 
  calculateBacktestResult, 
  calculateOrderVolume 
} from './CandlestickChartTrading';
import { 
  ChartControls, 
  DateRangePicker, 
  MAControls, 
  PriceInfo, 
  BacktestResults 
} from './CandlestickChartUI';

// OrderDetails 인터페이스 정의 (이것은 내부적으로만 사용되므로 여기에 정의)
interface OrderDetails {
  market: string;
  side: 'bid' | 'ask';
  volume: string;
  price: string;
  ord_type: string;
  mode: string;
}

export const CandlestickChartMain: React.FC<ChartProps> = ({ 
  symbol, 
  chartType,
  initialAutoUpdate = false,
  mode,
  handleOrder
}) => {
  // 상태 변수들
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const resizeObserver = useRef<ResizeObserver | null>(null);
  const chart = useRef<IChartApi | null>(null);
  const candleSeries = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const [candles, setCandles] = useState<ExtendedCandlestickData[]>([]);
  const [currentPrice, setCurrentPrice] = useState<number>(0);
  const [chartHeight, setChartHeight] = useState<number>(600);
  const [lastUpdated, setLastUpdated] = useState<string>('');
  const [chartPrice, setChartPrice] = useState<number>(0);
  const [priceDiff, setPriceDiff] = useState<number>(0);
  const [priceDiffPercentage, setPriceDiffPercentage] = useState<number>(0);
  
  // 차트 상태 추적
  const [isChartDisposed, setIsChartDisposed] = useState<boolean>(false);
  // 차트 초기화 완료 상태 추가
  const [isChartInitialized, setIsChartInitialized] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [progress, setProgress] = useState<number>(0);
  
  // MA 시리즈 관련 상태
  const sixtySeries = useRef<ISeriesApi<"Line"> | null>(null);
  const oneTwentySeries = useRef<ISeriesApi<"Line"> | null>(null);
  const twoFortySeries = useRef<ISeriesApi<"Line"> | null>(null);
  const threeHundredSixtySeries = useRef<ISeriesApi<"Line"> | null>(null);
  const [sixtyEMA, setSixtyEMA] = useState<LineData<Time>[]>([]);
  const [oneTwentyEMA, setOneTwentyEMA] = useState<LineData<Time>[]>([]);
  const [twoFortyEMA, setTwoFortyEMA] = useState<LineData<Time>[]>([]);
  const [threeHundredSixtyEMA, setThreeHundredSixtyEMA] = useState<LineData<Time>[]>([]);
  const [showMA, setShowMA] = useState<{ sixty: boolean; oneTwenty: boolean; twoForty: boolean; threeHundredSixty: boolean; }>({
    sixty: true,
    oneTwenty: true,
    twoForty: true,
    threeHundredSixty: true
  });
  
  // 자동 업데이트 및 웹소켓 관련 상태
  const [isAutoUpdate, setIsAutoUpdate] = useState<boolean>(initialAutoUpdate);
  const [isRealtimeAPIEnabled, setIsRealtimeAPIEnabled] = useState<boolean>(false);
  const [isWebSocketEnabled, setIsWebSocketEnabled] = useState<boolean>(false);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  
  // 주문 관련 상태
  const [tradesHistory, setTradesHistory] = useState<Trade[]>([]);
  const [orderHistory, setOrderHistory] = useState<Order[]>([]);
  const [tradeStrategy, setTradeStrategy] = useState<TradeStrategy>('MA_CROSS');
  
  // 날짜 범위 관련 상태
  const [dateRange, setDateRange] = useState<DateRange>(getInitialDateRange(chartType));

  // 로컬 상태(영업 제한 등)
  const [tradeCycle, setTradeCycle] = useState<'auto' | 'buy-only' | 'sell-only' | 'off'>('off');
  
  // 백테스트 결과 상태
  const [backtestResult, setBacktestResult] = useState<BacktestResult | null>(null);
  
  // 교차점 상태
  const [crossPoints, setCrossPoints] = useState<CrossPoint[]>([]);
  
  // 웹소켓 연결
  // 타입 문제로 일시적으로 웹소켓 기능 비활성화
  const [lastTradeData, setLastTradeData] = useState<any>(null);
  const [tickerData, setTickerData] = useState<any>(null);
  
  // 차트 초기화 완료 여부를 추적하는 레퍼런스 추가
  const chartInitialized = useRef<boolean>(false);
  
  // 자동 업데이트 타이머 ref 추가
  const autoUpdateTimer = useRef<NodeJS.Timeout | null>(null);
  
  // API 실시간 업데이트를 위한 인터벌 ref 추가
  const apiIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
  // useUpbitWebSocket 훅 사용
  const { connectWebSocket, disconnectWebSocket } = useUpbitWebSocket(symbol);
  
  // 웹소켓 데이터 처리
  useEffect(() => {
    if (isWebSocketEnabled && tickerData) {
      updateCurrentPrice(tickerData.trade_price);
    }
  }, [tickerData, isWebSocketEnabled]);
  
  // 차트 초기화
  useEffect(() => {
    if (!chartContainerRef.current) return;

    console.log('차트 DOM 초기화 시작');
    
    // 컨테이너 스타일 설정
    chartContainerRef.current.style.position = 'relative';
    
    // Create chart
    const chartInstance = createChart(chartContainerRef.current, {
      layout: {
        background: { color: '#1e1e1e' },
        textColor: '#d1d4dc',
      },
      grid: {
        vertLines: { color: '#2B2B2B' },
        horzLines: { color: '#2B2B2B' },
      },
      width: chartContainerRef.current.clientWidth,
      height: 400,
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

    chart.current = chartInstance;
    
    try {
      console.log('캔들스틱 시리즈 추가 시작');
      // 타입 단언을 사용하여 TypeScript 오류 해결
      const candlestickSeries = (chart.current as any).addCandlestickSeries({
        upColor: '#26a69a',
        downColor: '#ef5350',
        borderVisible: false,
        wickUpColor: '#26a69a',
        wickDownColor: '#ef5350',
      });
      
      candleSeries.current = candlestickSeries;
      console.log('캔들스틱 시리즈 추가 성공');
      
      // 이동평균선 시리즈 추가 (v5 API 사용)
      console.log('이동평균선 시리즈 추가 시작');
      sixtySeries.current = (chart.current as any).addLineSeries({
        color: '#0000FF', // 파란색
        lineWidth: 2,
        visible: showMA.sixty,
      });
      
      oneTwentySeries.current = (chart.current as any).addLineSeries({
        color: '#800080', // 보라색
        lineWidth: 2,
        visible: showMA.oneTwenty,
      });
      
      twoFortySeries.current = (chart.current as any).addLineSeries({
        color: '#FFA500', // 주황색
        lineWidth: 2,
        visible: showMA.twoForty,
      });
      
      threeHundredSixtySeries.current = (chart.current as any).addLineSeries({
        color: '#000000', // 검은색
        lineWidth: 2,
        visible: showMA.threeHundredSixty,
      });
      
      console.log('이동평균선 시리즈 추가 완료');
      
      // 차트 초기화 완료
      chartInitialized.current = true;
      setIsChartInitialized(true);
      
      // 데이터 로드
      console.log('차트 데이터 로드 시작');
      loadChartData();
    } catch (error) {
      console.error('차트 시리즈 추가 중 오류 발생:', error);
    }

    // 윈도우 리사이즈 핸들러
    const handleResizeEvent = () => {
      if (chartContainerRef.current && chart.current) {
        chart.current.resize(chartContainerRef.current.clientWidth, chartHeight);
      }
    };

    window.addEventListener('resize', handleResizeEvent);

    return () => {
      window.removeEventListener('resize', handleResizeEvent);
      if (chart.current) {
        console.log('차트 정리 시작');
        chart.current.remove();
        chart.current = null;
      }
      chartInitialized.current = false;
      setIsChartInitialized(false);
      candleSeries.current = null;
      sixtySeries.current = null;
      oneTwentySeries.current = null;
      twoFortySeries.current = null;
      threeHundredSixtySeries.current = null;
      console.log('차트 정리 완료');
    };
  }, [chartType, showMA, chartHeight]);
  
  // 차트 데이터 로딩 함수
  const loadChartData = useCallback(async () => {
    if (!chartInitialized.current || isChartDisposed || !chart.current || !candleSeries.current) {
      console.log('loadChartData: 차트가 초기화되지 않았거나 제거됨');
      return;
    }

    console.log('차트 데이터 로딩 시작:', symbol, chartType);
    setIsLoading(true);
    
    try {
      // API 엔드포인트와 데이터 개수 결정
      const endpoint = getChartEndpoint(chartType);
      const count = getChartCount(chartType);
      
      console.log(`데이터 로드: ${endpoint}, 개수: ${count}`);
      
      // API 호출
      const response = await fetch(
        `https://api.upbit.com/v1/candles/${endpoint}?market=${symbol}&count=${count}`
      );
      
      if (!response.ok) {
        throw new Error(`API 응답 오류: ${response.status}`);
      }
      
      const data = await response.json() as UpbitCandle[];
      
      if (!data || data.length === 0) {
        console.log('받은 데이터가 없습니다');
        setIsLoading(false);
        return;
      }
      
      console.log(`데이터 수신 완료: ${data.length}개`);
      
      // 데이터 형식 변환
      const formattedData = data
        .sort((a, b) => new Date(a.candle_date_time_kst).getTime() - new Date(b.candle_date_time_kst).getTime())
        .map(candle => ({
          time: Math.floor(new Date(candle.candle_date_time_kst).getTime() / 1000) as Time,
          open: candle.opening_price,
          high: candle.high_price,
          low: candle.low_price,
          close: candle.trade_price,
          volume: candle.candle_acc_trade_volume
        })) as ExtendedCandlestickData[];
      
      console.log(`포맷 변환 완료: ${formattedData.length}개 캔들`);
      
      // 차트 데이터 설정
      if (candleSeries.current) {
        candleSeries.current.setData(formattedData);
        
        // 최근 데이터로 현재가 업데이트
        if (formattedData.length > 0) {
          updateCurrentPrice(formattedData[formattedData.length - 1].close);
        }
      }
      
      // 캔들 데이터 상태 업데이트
      setCandles(formattedData);
      
      console.log('차트 데이터 로딩 완료');
    } catch (error) {
      console.error('차트 데이터 로딩 오류:', error);
    } finally {
      setIsLoading(false);
    }
  }, [symbol, chartType]);
  
  // 자동 업데이트 상태가 변경될 때 타이머 관리
  useEffect(() => {
    console.log('자동 업데이트 상태 변경:', isAutoUpdate, new Date().toISOString());
    
    if (isAutoUpdate) {
      console.log('자동 업데이트 활성화됨');
      // 차트가 초기화된 상태인 경우에만 자동 업데이트 시작
      if (chartInitialized.current && !isChartDisposed && chart.current && candleSeries.current) {
        console.log('차트가 준비되어 있음, 자동 업데이트 시작');
        startAutoUpdate();
      } else {
        console.log('차트가 아직 준비되지 않았지만 자동 업데이트가 활성화됨, 초기화 완료 후 시작됨');
      }
    } else {
      console.log('자동 업데이트 비활성화됨, 타이머 중지');
      stopAutoUpdate();
    }
    
    // 클린업 함수
    return () => {
      stopAutoUpdate();
    };
  }, [isAutoUpdate, isChartDisposed]);
  
  // 자동 업데이트 토글 핸들러 수정
  const handleAutoUpdateToggle = () => {
    if (!isAutoUpdate) {
      // 자동 업데이트 활성화 시 웹소켓 비활성화
      if (isWebSocketEnabled) {
        disconnectWebSocket();
        setIsWebSocketEnabled(false);
      }
      
      // 자동 업데이트 시작
      startAutoUpdate();
    } else {
      // 자동 업데이트 중지
      stopAutoUpdate();
    }
    
    setIsAutoUpdate(prev => !prev);
  };
  
  // 실시간 API 토글
  const handleRealtimeAPIToggle = () => {
    setIsRealtimeAPIEnabled(prev => !prev);
  };
  
  // 웹소켓 토글
  const handleWebSocketToggle = () => {
    // 웹소켓 상태 토글
    const newWebSocketState = !isWebSocketEnabled;
    
    if (newWebSocketState) {
      // 웹소켓 활성화
      if (isAutoUpdate) {
        // 자동 업데이트가 활성화되어 있으면 비활성화
        stopAutoUpdate();
        setIsAutoUpdate(false);
      }
      
      // 웹소켓 연결 설정
      try {
        console.log('웹소켓 연결 시도:', symbol);
        
        // 타입스크립트 타입 정의가 명확하지 않으므로 any 타입을 사용
        connectWebSocket([symbol], (data: any) => {
          try {
            console.log('웹소켓 데이터 수신:', data.type);
            
            if (data.type === 'trade') {
              console.log('거래 데이터 수신:', data.trade_price);
              setLastTradeData(data);
              updateCurrentPrice(data.trade_price);
            } else if (data.type === 'ticker') {
              console.log('티커 데이터 수신:', data);
              setTickerData(data);
            }
          } catch (error) {
            console.error('웹소켓 데이터 처리 오류:', error);
          }
        });
        
        console.log('웹소켓 연결 요청 완료');
      } catch (error) {
        console.error('웹소켓 연결 오류:', error);
        // 연결에 실패한 경우 상태를 원래대로 되돌림
        setIsWebSocketEnabled(false);
        return;
      }
    } else {
      // 웹소켓 비활성화
      try {
        console.log('웹소켓 연결 종료');
        disconnectWebSocket();
      } catch (error) {
        console.error('웹소켓 연결 종료 오류:', error);
      }
    }
    
    setIsWebSocketEnabled(newWebSocketState);
  };
  
  // 날짜 범위 변경 처리
  const handleDateRangeChange = (start: Date) => {
    setDateRange(prev => ({
      ...prev,
      startDate: start
    }));
  };
  
  // 종료 날짜 변경 처리
  const handleEndDateChange = (end: Date) => {
    setDateRange(prev => ({
      ...prev,
      endDate: end
    }));
  };
  
  // 차트 높이 변경 처리
  const handleHeightChange = (height: number) => {
    setChartHeight(height);
    if (chart.current) {
      chart.current.applyOptions({ height });
    }
  };
  
  // 마커 업데이트
  const updateTradeMarkers = (candleSeries: ISeriesApi<"Candlestick">, markers: SeriesMarker<Time>[]) => {
    if (isChartDisposed || !candleSeries) return;
    
    try {
      (candleSeries as any).setMarkers(markers);
    } catch (error) {
      console.error('Error setting markers:', error);
    }
  };
  
  // 트레이드 사이클 업데이트
  const updateTradeCycle = (status: string) => {
    setTradeCycle(status as 'auto' | 'buy-only' | 'sell-only' | 'off');
  };
  
  // 차트 타입에 따른 데이터 개수 결정
  const getChartCount = (type: string) => {
    if (type.startsWith('seconds/')) {
      return 1500; // 초봉 데이터 개수 증가 (330 -> 500) 1500
    }
    const minutes = parseInt(type);
    if (minutes <= 3) return 430;     // 분봉
    if (minutes === 240) return 200;  // 일봉 (200일)
    if (minutes === 7200) return 200; // 월봉 (200개월)
    return 30;                        // 년봉 (30년)
  };
  
  // 자동 업데이트 시작 함수
  const startAutoUpdate = () => {
    // 이미 타이머가 설정되어 있으면 제거
    if (autoUpdateTimer.current) {
      clearInterval(autoUpdateTimer.current);
      autoUpdateTimer.current = null;
    }
    
    // 새 타이머 설정
    if (isAutoUpdate) {
      console.log('자동 업데이트 타이머 설정 - 10초 간격');
      autoUpdateTimer.current = setInterval(() => {
        console.log('자동 업데이트: 데이터 로드 시도', symbol, chartType, new Date().toISOString());
        
        // 차트 초기화 상태 확인
        if (chartInitialized.current && !isChartDisposed && chart.current && candleSeries.current) {
          console.log('차트 초기화 완료됨, 데이터 로드 시작');
          loadChartData();
        } else {
          console.log('자동 업데이트: 차트가 준비되지 않았습니다.',
            '초기화 상태(ref):', chartInitialized.current,
            '초기화 상태(state):', isChartInitialized,
            '차트 객체:', !!chart.current, 
            '캔들시리즈:', !!candleSeries.current
          );
        }
      }, 10000);
    }
  };
  
  // 자동 업데이트 중지 함수
  const stopAutoUpdate = () => {
    if (autoUpdateTimer.current) {
      console.log('자동 업데이트 타이머 중지');
      clearInterval(autoUpdateTimer.current);
      autoUpdateTimer.current = null;
    }
  };
  
  // candles 상태가 변경될 때 이동평균선 업데이트
  useEffect(() => {
    console.log('캔들 데이터 변경 감지, 이동평균선 업데이트');
    if (candles.length > 0 && !isChartDisposed && chart.current && candleSeries.current) {
      // 약간 지연을 두어 차트가 준비되었는지 확인
      setTimeout(() => {
        if (!isChartDisposed && chart.current && candleSeries.current) {
          updateMA();
        }
      }, 100);
    }
  }, [candles, isChartDisposed, chart, candleSeries]);
  
  // MA 표시 상태 업데이트
  const updateShowMA = (key: string) => {
    setShowMA(prev => {
      const newState = { ...prev, [key]: !prev[key as keyof typeof prev] };
      
      // MA 시리즈 표시/숨김 처리
      if (key === 'sixty' && sixtySeries.current) {
        sixtySeries.current.applyOptions({ visible: newState.sixty });
      } else if (key === 'oneTwenty' && oneTwentySeries.current) {
        oneTwentySeries.current.applyOptions({ visible: newState.oneTwenty });
      } else if (key === 'twoForty' && twoFortySeries.current) {
        twoFortySeries.current.applyOptions({ visible: newState.twoForty });
      } else if (key === 'threeHundredSixty' && threeHundredSixtySeries.current) {
        threeHundredSixtySeries.current.applyOptions({ visible: newState.threeHundredSixty });
      }
      
      return newState;
    });
  };
  
  // 이동평균선 업데이트
  const updateMA = () => {
    if (!chartInitialized.current || isChartDisposed || !chart.current || !candles.length) {
      console.log('이동평균선 업데이트: 차트 또는 데이터가 유효하지 않습니다.');
      return;
    }
    
    // 이동평균선 계산
    try {
      console.log('이동평균선 업데이트 시작...');

      // 각 이동평균선 데이터 생성
      const sixtyData = calculateEMA(candles, 60);
      const oneTwentyData = calculateEMA(candles, 120);
      const twoFortyData = calculateEMA(candles, 240);
      const threeHundredSixtyData = calculateEMA(candles, 360);
      
      // 데이터 확인 로깅
      console.log(`MA 데이터 계산 완료: 60(${sixtyData.length}), 120(${oneTwentyData.length}), 240(${twoFortyData.length}), 360(${threeHundredSixtyData.length})`);
      
      // 각 시리즈 업데이트
      if (sixtySeries.current) {
        console.log('60 이동평균선 업데이트...');
        sixtySeries.current.setData(sixtyData);
        sixtySeries.current.applyOptions({
          visible: showMA.sixty,
        });
      }
      
      if (oneTwentySeries.current) {
        console.log('120 이동평균선 업데이트...');
        oneTwentySeries.current.setData(oneTwentyData);
        oneTwentySeries.current.applyOptions({
          visible: showMA.oneTwenty,
        });
      }
      
      if (twoFortySeries.current) {
        console.log('240 이동평균선 업데이트...');
        twoFortySeries.current.setData(twoFortyData);
        twoFortySeries.current.applyOptions({
          visible: showMA.twoForty,
        });
      }
      
      if (threeHundredSixtySeries.current) {
        console.log('360 이동평균선 업데이트...');
        threeHundredSixtySeries.current.setData(threeHundredSixtyData);
        threeHundredSixtySeries.current.applyOptions({
          visible: showMA.threeHundredSixty,
        });
      }
      
      // 교차점 계산
      const crossPoints = findCrossPoints(
        sixtyData, 
        oneTwentyData, 
        twoFortyData,
        threeHundredSixtyData
      );
      
      // 교차점을 기반으로 마커 업데이트
      if (candleSeries.current && crossPoints.length > 0) {
        console.log(`교차점 발견: ${crossPoints.length}개`);
        const markers = createTradeMarkers(crossPoints, tradeStrategy);
        updateTradeMarkers(candleSeries.current, markers);
      }
      
      console.log('이동평균선 업데이트 완료');
    } catch (error) {
      console.error('이동평균선 업데이트 오류:', error);
    }
  };
  
  // 현재 가격 업데이트
  const updateCurrentPrice = (price: number) => {
    setCurrentPrice(price);
    setLastUpdated(new Date().toLocaleTimeString());
    
    if (chartPrice === 0) {
      setChartPrice(price);
    }
    
    const diff = price - chartPrice;
    setPriceDiff(diff);
    setPriceDiffPercentage((diff / chartPrice) * 100);
  };
  
  // 주문 생성 및 실행
  const executeOrder = (orderDetails: OrderDetails) => {
    // 주문 기록 추가
    const newOrder: Order = {
      time: new Date(),
      side: orderDetails.side === 'bid' ? 'buy' : 'sell',
      price: orderDetails.price,
      volume: orderDetails.volume,
    };
    
    setOrderHistory(prev => [...prev, newOrder]);
    
    // 주문 실행
    handleOrder(orderDetails);
  };
  
  // sixtyEMA 등 MA 상태가 변경될 때 교차점과 마커 업데이트
  useEffect(() => {
    if (sixtyEMA.length > 0 && oneTwentyEMA.length > 0 && twoFortyEMA.length > 0 && threeHundredSixtyEMA.length > 0) {
      console.log('MA 상태 변경 감지, 교차점 업데이트');
      
      // 교차점 찾기
      const newCrossPoints = findCrossPoints(sixtyEMA, oneTwentyEMA, twoFortyEMA, threeHundredSixtyEMA);
      setCrossPoints(newCrossPoints);
      
      // 교차점 마커 생성
      if (!isChartDisposed && candleSeries.current) {
        const markers = createTradeMarkers(newCrossPoints, tradeStrategy);
        updateTradeMarkers(candleSeries.current, markers);
      }
    }
  }, [sixtyEMA, oneTwentyEMA, twoFortyEMA, threeHundredSixtyEMA, isChartDisposed, tradeStrategy]);
  
  // 교차점이 변경될 때 백테스트 결과 계산
  useEffect(() => {
    if (crossPoints.length > 0) {
      // 백테스트 결과 계산
      const result = calculateBacktestResult(tradesHistory);
      setBacktestResult(result);
    }
  }, [crossPoints, tradesHistory]);
  
  // 차트 타입에 따른 API 엔드포인트 결정
  const getChartEndpoint = (type: string) => {
    console.log('차트 타입:', type);
    
    // 초 단위 처리
    if (type.startsWith('seconds/')) {
      console.log('초 단위 차트 감지');
      return 'seconds'; // 초봉 API 엔드포인트
    }
    
    // 한글 키워드로 된 차트 타입 처리
    if (type.indexOf("일봉") !== -1) {
      return "days";
    } else if (type.indexOf("주봉") !== -1) {
      return "weeks";
    } else if (type.indexOf("월봉") !== -1) {
      return "months";
    } else if (type.indexOf("분봉") !== -1) {
      const minutes = type.split("/")[1] || "1";
      return `minutes/${minutes}`;
    }
    
    // minutes/X 형식 처리
    if (type.indexOf("minutes/") !== -1) {
      return type; // 그대로 사용
    }
    
    // 숫자만 있는 경우 (분 단위로 간주)
    if (/^\d+$/.test(type)) {
      const minutes = parseInt(type);
      if (minutes <= 240) { // 1분봉, 3분봉, 일봉(240분)
        return `minutes/${type}`;
      } else if (minutes === 7200) { // 월봉
        return 'months';
      } else if (minutes > 7200) { // 년봉
        return 'years';
      }
    }
    
    // 기본값
    console.log('알 수 없는 차트 타입, 기본값 사용:', type);
    return "days";
  };
  
  return (
    <div className="bg-gray-900 text-white p-4 rounded-lg">
      <h2 className="text-2xl font-bold mb-4">{symbol} {chartType} 차트</h2>
      
      {/* 차트 컨트롤 */}
      <ChartControls 
        isAutoUpdate={isAutoUpdate}
        isRealtimeAPIEnabled={isRealtimeAPIEnabled}
        isWebSocketEnabled={isWebSocketEnabled}
        handleAutoUpdateToggle={handleAutoUpdateToggle}
        handleRealtimeAPIToggle={handleRealtimeAPIToggle}
        handleWebSocketToggle={handleWebSocketToggle}
      />
      
      {/* 날짜 선택 */}
      <DateRangePicker 
        startDate={dateRange.startDate}
        endDate={dateRange.endDate}
        handleDateChange={handleDateRangeChange}
        handleEndDateChange={handleEndDateChange}
      />
      
      {/* 가격 정보 */}
      <PriceInfo 
        currentPrice={currentPrice}
        chartPrice={chartPrice}
        lastUpdated={lastUpdated}
        priceDiff={priceDiff}
        priceDiffPercentage={priceDiffPercentage}
      />
      
      {/* MA 컨트롤 */}
      <MAControls 
        showMA={showMA}
        updateShowMA={updateShowMA}
      />
      
      {/* 차트 컨테이너 - 높이와 최소 높이 명시 */}
      <div className="relative mb-4">
        <div 
          ref={chartContainerRef} 
          id="chart-container"
          className="w-full border border-gray-700 bg-gray-800" 
          style={{ 
            height: `${chartHeight}px`,
            minHeight: "400px",
            minWidth: "300px",
            display: "block",
            position: "relative",
            overflow: "hidden",
            boxSizing: "border-box"
          }}
        ></div>
        
        {/* 높이 조절 버튼 */}
        <div className="absolute top-2 right-2 flex flex-col space-y-2 z-10">
          <button 
            onClick={() => handleHeightChange(chartHeight + 100)} 
            className="bg-blue-600 p-2 rounded-lg text-white"
          >
            +
          </button>
          <button 
            onClick={() => handleHeightChange(Math.max(400, chartHeight - 100))} 
            className="bg-blue-600 p-2 rounded-lg text-white"
          >
            -
          </button>
        </div>
      </div>
      
      {/* 백테스트 결과 */}
      <BacktestResults backtestResult={backtestResult} />
      
      {/* 주문 내역 */}
      <div className="mb-4">
        <h3 className="text-xl font-bold mb-2">주문 내역</h3>
        <div className="bg-gray-800 p-4 rounded-lg">
          {orderHistory.length === 0 ? (
            <p className="text-gray-400">주문 내역이 없습니다.</p>
          ) : (
            <ul>
              {orderHistory.map((order, index) => (
                <li key={index} className="flex justify-between py-1 border-b border-gray-700">
                  <span>{new Date(order.time).toLocaleString()}</span>
                  <span className={order.side === 'buy' ? 'text-green-500' : 'text-red-500'}>
                    {order.side === 'buy' ? '매수' : '매도'} {order.volume} @ {order.price}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}; 