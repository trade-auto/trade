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
  
  // 첫 렌더링 시 차트 초기화 및 데이터 로딩
  useEffect(() => {
    // 새 차트를 초기화하기 전에 이전 차트가 있다면 제거
    if (chart.current) {
      try {
        chart.current.remove();
      } catch (error) {
        console.error('Error removing previous chart:', error);
      }
      chart.current = null;
      candleSeries.current = null;
      sixtySeries.current = null;
      oneTwentySeries.current = null;
      twoFortySeries.current = null;
      threeHundredSixtySeries.current = null;
      setIsChartDisposed(true);
    }

    setIsChartDisposed(false);
    
    console.log('차트 초기화 시작...', new Date().toISOString());
    
    // 차트 초기화 전에 컨테이너가 준비되었는지 확인
    if (!chartContainerRef.current) {
      console.log('차트 컨테이너가 아직 준비되지 않았습니다.');
    } else {
      console.log('차트 컨테이너 크기:', 
        chartContainerRef.current.clientWidth, 
        chartContainerRef.current.clientHeight
      );
    }
    
    // DOM이 준비되었는지 확인하고 차트 초기화
    setTimeout(() => {
      if (chartContainerRef.current) {
        console.log('타임아웃 후 차트 컨테이너 크기:', 
          chartContainerRef.current.clientWidth, 
          chartContainerRef.current.clientHeight
        );
        
        // 차트 초기화 (3번 시도)
        let initSuccess = false;
        let attempts = 0;
        
        const tryInitChart = () => {
          attempts++;
          try {
            console.log(`차트 초기화 시도 #${attempts}`);
            initializeChart();
            
            // 초기화가 성공했는지 확인
            if (chart.current && candleSeries.current) {
              console.log('차트 초기화 성공!');
              initSuccess = true;
              
              // 데이터 로드
              loadChartData();
            } else {
              console.log(`차트 초기화 실패 #${attempts} - 차트: ${!!chart.current}, 캔들시리즈: ${!!candleSeries.current}`);
              
              // 최대 3번까지 재시도
              if (attempts < 3) {
                console.log(`${500 * attempts}ms 후 다시 시도...`);
                setTimeout(() => {
                  tryInitChart();
                }, 500 * attempts); // 지연 시간 점진적 증가
              } else {
                console.error('최대 시도 횟수 초과, 차트 초기화 실패');
              }
            }
          } catch (error) {
            console.error(`차트 초기화 중 예외 발생 #${attempts}:`, error);
            
            // 최대 3번까지 재시도
            if (attempts < 3) {
              console.log(`${500 * attempts}ms 후 다시 시도...`);
              setTimeout(() => {
                tryInitChart();
              }, 500 * attempts); // 지연 시간 점진적 증가
            } else {
              console.error('최대 시도 횟수 초과, 차트 초기화 실패');
            }
          }
        };
        
        // 첫 번째 시도 시작
        tryInitChart();
      } else {
        console.log('타임아웃 후에도 차트 컨테이너가 준비되지 않았습니다.');
      }
    }, 500); // 더 긴 지연으로 DOM이 준비되도록 함
    
    return () => {
      setIsChartDisposed(true);
      // 클린업 시 모든 상태 리셋
      chartInitialized.current = false;
      setIsChartInitialized(false);
      if (resizeObserver.current) {
        resizeObserver.current.disconnect();
      }
      if (chart.current) {
        try {
          chart.current.remove();
          chart.current = null;
          candleSeries.current = null;
          sixtySeries.current = null;
          oneTwentySeries.current = null;
          twoFortySeries.current = null;
          threeHundredSixtySeries.current = null;
        } catch (error) {
          console.error('Error removing chart on unmount:', error);
        }
      }
    };
  }, [symbol, chartType, isAutoUpdate]);
  
  // 차트 초기화 함수
  const initializeChart = () => {
    console.log('initializeChart 함수 호출됨');
    
    // 초기화 시작 시 상태 리셋
    chartInitialized.current = false;
    setIsChartInitialized(false);
    
    if (!chartContainerRef.current || isChartDisposed) {
      console.log('차트 컨테이너가 없거나 차트가 이미 제거되었습니다.');
      return;
    }
    
    // 컨테이너에 고정된 크기 설정
    chartContainerRef.current.style.width = '100%';
    chartContainerRef.current.style.height = `${chartHeight}px`;
    chartContainerRef.current.style.position = 'relative';
    
    // 강제로 레이아웃 리플로우 발생시킴
    void chartContainerRef.current.offsetHeight;
    
    // 컨테이너 크기 확인
    const containerWidth = chartContainerRef.current.clientWidth || 800;
    const containerHeight = chartContainerRef.current.clientHeight || 600;
    
    console.log('차트 컨테이너 크기:', containerWidth, containerHeight);
    
    // 기존 차트 정리
    if (chart.current) {
      try {
        chart.current.remove();
      } catch (error) {
        console.error('기존 차트 제거 오류:', error);
      }
      chart.current = null;
      candleSeries.current = null;
      
      // 이동평균선 시리즈도 정리
      sixtySeries.current = null;
      oneTwentySeries.current = null;
      twoFortySeries.current = null;
      threeHundredSixtySeries.current = null;
    }
    
    try {
      console.log('차트 생성 시도 중...');
      
      // 차트 생성
      chart.current = createChart(chartContainerRef.current, {
        width: containerWidth,
        height: containerHeight,
        layout: {
          background: { color: '#222' },
          textColor: '#DDD',
        },
        timeScale: {
          timeVisible: true,
        },
      });
      
      // 캔들스틱 시리즈 추가
      candleSeries.current = chart.current.addSeries({
        type: 'Candlestick',
        upColor: '#26a69a',
        downColor: '#ef5350',
        borderVisible: false,
        wickUpColor: '#26a69a',
        wickDownColor: '#ef5350',
      } as any);
      
      // 이동평균선 시리즈 추가
      sixtySeries.current = chart.current.addSeries({
        type: 'Line',
        color: '#2196F3',
        lineWidth: 2,
        visible: showMA.sixty,
        priceLineVisible: false,
      } as any);
      
      oneTwentySeries.current = chart.current.addSeries({
        type: 'Line',
        color: '#FF9800',
        lineWidth: 2,
        visible: showMA.oneTwenty,
        priceLineVisible: false,
      } as any);
      
      twoFortySeries.current = chart.current.addSeries({
        type: 'Line',
        color: '#F44336',
        lineWidth: 2,
        visible: showMA.twoForty,
        priceLineVisible: false,
      } as any);
      
      threeHundredSixtySeries.current = chart.current.addSeries({
        type: 'Line',
        color: '#9C27B0',
        lineWidth: 2,
        visible: showMA.threeHundredSixty,
        priceLineVisible: false,
      } as any);
      
      console.log('차트 및 시리즈 생성 완료');
      
      // 리사이즈 처리 설정
      if (resizeObserver.current) {
        resizeObserver.current.disconnect();
      }
      
      if (chartContainerRef.current) {
        console.log('리사이즈 옵저버 설정');
        resizeObserver.current = new ResizeObserver(handleResize);
        resizeObserver.current.observe(chartContainerRef.current);
      }
      
      // 차트 초기화 완료 상태 설정
      chartInitialized.current = true;
      setIsChartInitialized(true);
      
      // 즉시 데이터 로드 (지연시간 없이)
      loadChartData();
    } catch (error) {
      console.error('차트 초기화 오류:', error);
      chart.current = null;
      candleSeries.current = null;
      chartInitialized.current = false;
      setIsChartInitialized(false);
    }
  };
  
  // 리사이즈 처리 함수
  const handleResize = () => {
    if (chart.current && chartContainerRef.current) {
      chart.current.applyOptions({
        width: chartContainerRef.current.clientWidth,
      });
    }
  };
  
  // 차트 데이터 로딩 함수
  const loadChartData = useCallback(async () => {
    if (!chartInitialized.current || isChartDisposed || !chart.current || !candleSeries.current) {
      console.log('차트가 준비되지 않았습니다. 데이터를 로드할 수 없습니다.', 
        '초기화 상태(ref):', chartInitialized.current,
        '초기화 상태(state):', isChartInitialized,
        '차트 객체:', !!chart.current, 
        '캔들시리즈:', !!candleSeries.current,
        '시간:', new Date().toISOString()
      );
      return;
    }

    try {
      const endpoint = getChartEndpoint(chartType);
      const count = getChartCount(chartType);
      
      // 현재 시간에서 2시간 후로 설정
      const now = new Date();
      now.setHours(now.getHours() + 2);
      const toTime = now.toISOString();
      
      console.log('데이터 요청 시작:', `https://api.upbit.com/v1/candles/${endpoint}?market=${symbol}&count=${count}&to=${toTime}`);
      const response = await fetch(`https://api.upbit.com/v1/candles/${endpoint}?market=${symbol}&count=${count}&to=${toTime}`);
      
      if (!response.ok) {
        throw new Error(`Network response error: ${response.status}`);
      }
      
      const data: UpbitCandle[] = await response.json();
      console.log('데이터 요청 완료:', new Date().toISOString());
      
      if (!data || !data.length) {
        console.error('데이터를 받지 못했습니다');
        return;
      }
      
      console.log(`${data.length}개의 캔들 데이터를 받았습니다`);
      
      // 차트가 여전히 유효한지 다시 확인
      if (!chartInitialized.current || isChartDisposed || !chart.current || !candleSeries.current) {
        console.log('데이터 수신 후 차트가 더 이상 유효하지 않습니다.');
        return;
      }
      
      let candleData: ExtendedCandlestickData[] = [];
      let volumeData: HistogramData<Time>[] = [];

      if (chartType.startsWith('seconds/')) {
        // 초봉 처리 로직
        candleData = data.map((item: UpbitCandle) => {
          const timestamp = Math.floor(new Date(item.candle_date_time_kst).getTime() / 1000);
          return {
            time: timestamp as Time,
            open: item.opening_price,
            high: item.high_price,
            low: item.low_price,
            close: item.trade_price,
            volume: item.candle_acc_trade_volume
          };
        }).reverse();
        
        volumeData = data.map((item: UpbitCandle) => {
          const timestamp = Math.floor(new Date(item.candle_date_time_kst).getTime() / 1000);
          return {
            time: timestamp as Time,
            value: item.candle_acc_trade_volume,
            color: item.trade_price >= item.opening_price ? '#26a69a80' : '#ef535080'
          };
        }).reverse();
      } else {
        // 분봉, 일봉, 월봉, 년봉 데이터 처리
        candleData = data.map((item: UpbitCandle) => {
          let timestamp: number;
          const date = new Date(item.candle_date_time_kst);
          
          if (chartType.indexOf("일봉") !== -1 || parseInt(chartType) === 240) { // 일봉
            date.setHours(9, 0, 0, 0); // 한국 시장 시작 시간으로 설정
            timestamp = Math.floor(date.getTime() / 1000);
          } else if (chartType.indexOf("월봉") !== -1 || parseInt(chartType) === 7200) { // 월봉
            date.setDate(1);
            date.setHours(9, 0, 0, 0);
            timestamp = Math.floor(date.getTime() / 1000);
          } else if (parseInt(chartType) === 86400) { // 년봉
            date.setMonth(0, 1);
            date.setHours(9, 0, 0, 0);
            timestamp = Math.floor(date.getTime() / 1000);
          } else { // 분봉
            timestamp = Math.floor(date.getTime() / 1000) + (2 * 60 * 60);
          }

          return {
            time: timestamp as Time,
            open: item.opening_price,
            high: item.high_price,
            low: item.low_price,
            close: item.trade_price,
            volume: item.candle_acc_trade_volume
          };
        }).reverse();

        // volumeData도 동일한 시간 처리 적용
        volumeData = data.map((item: UpbitCandle) => {
          let timestamp: number;
          const date = new Date(item.candle_date_time_kst);
          
          if (chartType.indexOf("일봉") !== -1 || parseInt(chartType) === 240) { // 일봉
            date.setHours(9, 0, 0, 0);
            timestamp = Math.floor(date.getTime() / 1000);
          } else if (chartType.indexOf("월봉") !== -1 || parseInt(chartType) === 7200) { // 월봉
            date.setDate(1);
            date.setHours(9, 0, 0, 0);
            timestamp = Math.floor(date.getTime() / 1000);
          } else if (parseInt(chartType) === 86400) { // 년봉
            date.setMonth(0, 1);
            date.setHours(9, 0, 0, 0);
            timestamp = Math.floor(date.getTime() / 1000);
          } else { // 분봉
            timestamp = Math.floor(date.getTime() / 1000) + (2 * 60 * 60);
          }

          return {
            time: timestamp as Time,
            value: item.candle_acc_trade_volume,
            color: item.trade_price >= item.opening_price ? '#26a69a80' : '#ef535080'
          };
        }).reverse();
      }

      // 데이터를 상태에 저장
      setCandles(candleData);
      
      // 캔들스틱 데이터 설정
      console.log('캔들스틱 데이터 설정 중... 총 데이터:', candleData.length);
      if (candleSeries.current) {
        candleSeries.current.setData(candleData);
        console.log('캔들스틱 데이터 설정 완료');
      }
      
      // 이동평균선 계산 및 설정
      console.log('이동평균선 계산 시작... 캔들 데이터 수:', candleData.length);
      const sixtyData = calculateEMA(candleData, 60);
      const oneTwentyData = calculateEMA(candleData, 120);
      const twoFortyData = calculateEMA(candleData, 240);
      const threeHundredSixtyData = calculateEMA(candleData, 360);
      
      // 상태 업데이트
      setSixtyEMA(sixtyData);
      setOneTwentyEMA(oneTwentyData);
      setTwoFortyEMA(twoFortyData);
      setThreeHundredSixtyEMA(threeHundredSixtyData);
      
      // 이동평균선 데이터 설정
      if (sixtySeries.current && sixtyData.length > 0) {
        sixtySeries.current.setData(sixtyData);
      }
      if (oneTwentySeries.current && oneTwentyData.length > 0) {
        oneTwentySeries.current.setData(oneTwentyData);
      }
      if (twoFortySeries.current && twoFortyData.length > 0) {
        twoFortySeries.current.setData(twoFortyData);
      }
      if (threeHundredSixtySeries.current && threeHundredSixtyData.length > 0) {
        threeHundredSixtySeries.current.setData(threeHundredSixtyData);
      }
      
      // 현재 가격 업데이트
      if (candleData.length > 0) {
        const latestCandle = candleData[candleData.length - 1];
        updateCurrentPrice(latestCandle.close);
        
        // 마지막 업데이트 시간 설정
        const dateTime = new Date();
        setLastUpdated(dateTime.toLocaleString());
        console.log('마지막 업데이트 시간 설정:', dateTime.toLocaleString());
      }
      
      console.log('데이터 로딩 및 설정 모두 완료:', new Date().toISOString());
    } catch (error) {
      console.error('차트 데이터 로딩 오류:', error);
    }
  }, [chartType, symbol, chartInitialized, isChartDisposed, chart, candleSeries]);
  
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
  
  

  // 차트 유형에 따라 데이터 개수 결정
  const getChartCount = (type: string) => {
    if (type.indexOf("일봉") !== -1) {
      return 200;
    } else if (type.indexOf("주봉") !== -1 || type.indexOf("월봉") !== -1) {
      return 100;
    } else if (type.indexOf("seconds") !== -1) {
      return 500; // 초단위 차트는 더 많은 데이터 포인트
    }
    return 300; // 분봉 등 기본값
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
    if (!chartInitialized.current || isChartDisposed || !chart.current || !candleSeries.current || !candles.length) {
      console.log('이동평균선 업데이트: 차트 또는 데이터가 유효하지 않습니다.');
      return;
    }
    
    try {
      console.log('이동평균선 계산 시작... 캔들 데이터 수:', candles.length);
      // 이동평균선 계산
      const sixtyData = calculateEMA(candles, 60);
      const oneTwentyData = calculateEMA(candles, 120);
      const twoFortyData = calculateEMA(candles, 240);
      const threeHundredSixtyData = calculateEMA(candles, 360);
      
      console.log('이동평균선 계산 완료:',
        'MA60:', sixtyData.length,
        'MA120:', oneTwentyData.length,
        'MA240:', twoFortyData.length,
        'MA360:', threeHundredSixtyData.length
      );
      
      if (!sixtyData.length) {
        console.error('계산된 이동평균 데이터가 비어 있습니다.');
        return;
      }
      
      // 상태 업데이트 - 이 부분에서 sixtyEMA 등 상태가 설정됨
      // 이 상태들은 useEffect에서 감지되어 교차점과 마커가 업데이트됨
      setSixtyEMA(sixtyData);
      setOneTwentyEMA(oneTwentyData);
      setTwoFortyEMA(twoFortyData);
      setThreeHundredSixtyEMA(threeHundredSixtyData);
      
      // 이동평균선 시리즈 생성 또는 업데이트
      const createOrUpdateMASeries = (
        seriesRef: React.MutableRefObject<ISeriesApi<"Line"> | null>,
        data: LineData<Time>[],
        color: string,
        visible: boolean,
        label: string
      ) => {
        if (!chart.current) return;
        
        try {
          // 시리즈가 없으면 생성
          if (!seriesRef.current) {
            console.log(`${label} 시리즈 생성 중...`);
            
            // 방법 1: addLineSeries 메소드 사용 시도
            if (typeof (chart.current as any).addLineSeries === 'function') {
              seriesRef.current = (chart.current as any).addLineSeries({
                color,
                lineWidth: 2,
                visible,
                priceLineVisible: false,
              });
            }
            // 방법 2: addSeries 메소드 사용 시도
            else if (typeof chart.current.addSeries === 'function') {
              seriesRef.current = chart.current.addSeries({
                type: 'Line',
                color,
                lineWidth: 2,
                visible,
                priceLineVisible: false,
              } as any);
            }
          }
          
          // 데이터 설정
          if (seriesRef.current && data.length) {
            console.log(`${label} 데이터 설정 중... 데이터 수:`, data.length);
            seriesRef.current.setData(data);
            console.log(`${label} 데이터 설정 완료`);
          }
        } catch (error) {
          console.error(`${label} 시리즈 생성 또는 업데이트 오류:`, error);
          seriesRef.current = null;
        }
      };
      
      // 각 이동평균선에 대해 시리즈 생성 또는 업데이트
      createOrUpdateMASeries(sixtySeries, sixtyData, '#2196F3', showMA.sixty, 'MA60');
      createOrUpdateMASeries(oneTwentySeries, oneTwentyData, '#FF9800', showMA.oneTwenty, 'MA120');
      createOrUpdateMASeries(twoFortySeries, twoFortyData, '#F44336', showMA.twoForty, 'MA240');
      createOrUpdateMASeries(threeHundredSixtySeries, threeHundredSixtyData, '#9C27B0', showMA.threeHundredSixty, 'MA360');
      
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