'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useUpbitStore } from '../store/useUpbitStore';
import {
  createChart,
  ColorType,
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
} from 'lightweight-charts';

// 간소화된 차트 컴포넌트 타입 정의
interface ChartProps {
  symbol: string;
  chartType: string;
  initialAutoUpdate?: boolean;
  mode: 'live' | 'test';
  handleOrder: (params: {
    market: string;
    side: 'bid' | 'ask';
    volume: string;
    price: string;
    ord_type: string;
    mode: string;
  }) => Promise<void>;
}

// 간소화된 캔들 데이터 타입
interface ExtendedCandlestickData extends CandlestickData<Time> {
  volume?: number;
}

// 현재 가격 가져오기 함수
const getCurrentPrice = async (symbol: string): Promise<number | null> => {
  try {
    const response = await fetch(`https://api.upbit.com/v1/ticker?markets=${symbol}`);
    const data = await response.json();
    if (data && data[0]) {
      return data[0].trade_price;
    }
    return null;
  } catch (error) {
    console.error('현재 가격 가져오기 오류:', error);
    return null;
  }
};

export const SimpleChart = ({
  symbol,
  chartType,
  initialAutoUpdate = false,
  mode,
  handleOrder
}: ChartProps): JSX.Element => {
  // 차트 관련 ref
  const container = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<"Histogram"> | null>(null);
  const ma60SeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const ma120SeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const ma240SeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const ma360SeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  
  // 상태 관리
  const [currentPrice, setCurrentPrice] = useState<number>(0);
  const [chartPrice, setChartPrice] = useState<number>(0);
  const [isAutoUpdate, setIsAutoUpdate] = useState<boolean>(initialAutoUpdate);
  const [isRealtimeAPIEnabled, setIsRealtimeAPIEnabled] = useState<boolean>(false);
  const [chartHeight, setChartHeight] = useState<number>(400);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  
  // MA 표시 상태
  const [showMA, setShowMA] = useState({
    ma60: true,
    ma120: true,
    ma240: true,
    ma360: true
  });
  
  // 실시간 API 업데이트를 위한 interval ref
  const apiIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
  // 업비트 스토어에서 필요한 데이터 가져오기
  const { orderLimits } = useUpbitStore();
  
  // 차트 초기화
  useEffect(() => {
    if (!container.current) return;
    
    console.log('차트 초기화 시작');
    
    // 차트 생성
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
      },
      rightPriceScale: {
        scaleMargins: {
          top: 0.1,
          bottom: 0.2,
        },
        borderVisible: false,
      },
    });
    
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
    });
    volumeSeriesRef.current = volumeSeries;
    
    // MA 시리즈 생성
    const ma60Series = chart.addSeries(LineSeries, {
      color: '#2196F3', // 파란색
      lineWidth: 2,
    });
    ma60SeriesRef.current = ma60Series;
    
    const ma120Series = chart.addSeries(LineSeries, {
      color: '#9C27B0', // 보라색
      lineWidth: 2,
    });
    ma120SeriesRef.current = ma120Series;
    
    const ma240Series = chart.addSeries(LineSeries, {
      color: '#FF9800', // 주황색
      lineWidth: 2,
    });
    ma240SeriesRef.current = ma240Series;
    
    const ma360Series = chart.addSeries(LineSeries, {
      color: '#F44336', // 빨간색
      lineWidth: 2,
    });
    ma360SeriesRef.current = ma360Series;
    
    // 윈도우 리사이즈 핸들러
    const handleResize = () => {
      if (container.current && chartRef.current) {
        chartRef.current.applyOptions({
          width: container.current.clientWidth,
        });
      }
    };
    
    window.addEventListener('resize', handleResize);
    
    console.log('차트 초기화 완료');
    
    return () => {
      window.removeEventListener('resize', handleResize);
      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
      }
      
      // 인터벌 정리
      if (apiIntervalRef.current) {
        clearInterval(apiIntervalRef.current);
        apiIntervalRef.current = null;
      }
    };
  }, [chartHeight]);
  
  // 차트 높이 변경 시 업데이트
  useEffect(() => {
    if (chartRef.current) {
      chartRef.current.applyOptions({
        height: chartHeight,
      });
    }
  }, [chartHeight]);
  
  // 차트 데이터 로드 함수
  const loadChartData = useCallback(async () => {
    if (!candleSeriesRef.current || !volumeSeriesRef.current || !ma60SeriesRef.current || !ma120SeriesRef.current || !ma240SeriesRef.current || !ma360SeriesRef.current) {
      console.error('차트 시리즈가 초기화되지 않았습니다.');
      return;
    }
    
    try {
      console.log('차트 데이터 로드 시작');
      setIsLoading(true);
      
      // API 엔드포인트 결정
      let endpoint = 'minutes/1';
      if (chartType.startsWith('seconds/')) {
        endpoint = 'seconds';
      }
      
      // 현재 시간 기준으로 데이터 가져오기
      const now = new Date();
      const toTime = now.toISOString();
      
      const apiUrl = `https://api.upbit.com/v1/candles/${endpoint}?market=${symbol}&count=200&to=${toTime}`;
      console.log('API 요청 URL:', apiUrl);
      
      const response = await fetch(apiUrl);
      
      if (!response.ok) {
        throw new Error(`API 요청 실패: ${response.status}`);
      }
      
      const data = await response.json();
      console.log(`${data.length}개의 캔들 데이터를 받았습니다.`);
      
      // 캔들 데이터 변환
      const candleData: ExtendedCandlestickData[] = data.map((item: any) => {
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
      
      // 거래량 데이터 변환
      const volumeData: HistogramData<Time>[] = data.map((item: any) => {
        const timestamp = Math.floor(new Date(item.candle_date_time_kst).getTime() / 1000);
        return {
          time: timestamp as Time,
          value: item.candle_acc_trade_volume,
          color: item.trade_price >= item.opening_price ? '#26a69a80' : '#ef535080'
        };
      }).reverse();
      
      // MA 계산 (20개 이동평균)
      const ma60Data: LineData<Time>[] = [];
      const ma60Period = 60;
      
      const ma120Data: LineData<Time>[] = [];
      const ma120Period = 120;
      
      const ma240Data: LineData<Time>[] = [];
      const ma240Period = 240;
      
      const ma360Data: LineData<Time>[] = [];
      const ma360Period = 360;
      
      for (let i = 0; i < candleData.length; i++) {
        if (i >= ma60Period - 1) {
          let sum = 0;
          for (let j = 0; j < ma60Period; j++) {
            sum += candleData[i - j].close;
          }
          ma60Data.push({
            time: candleData[i].time,
            value: sum / ma60Period
          });
        }
        
        if (i >= ma120Period - 1) {
          let sum = 0;
          for (let j = 0; j < ma120Period; j++) {
            sum += candleData[i - j].close;
          }
          ma120Data.push({
            time: candleData[i].time,
            value: sum / ma120Period
          });
        }
        
        if (i >= ma240Period - 1) {
          let sum = 0;
          for (let j = 0; j < ma240Period; j++) {
            sum += candleData[i - j].close;
          }
          ma240Data.push({
            time: candleData[i].time,
            value: sum / ma240Period
          });
        }
        
        if (i >= ma360Period - 1) {
          let sum = 0;
          for (let j = 0; j < ma360Period; j++) {
            sum += candleData[i - j].close;
          }
          ma360Data.push({
            time: candleData[i].time,
            value: sum / ma360Period
          });
        }
      }
      
      console.log('MA 데이터 계산 완료');
      
      // 데이터 설정
      candleSeriesRef.current.setData(candleData);
      volumeSeriesRef.current.setData(volumeData);
      
      // MA 데이터 설정
      ma60SeriesRef.current.setData(ma60Data);
      ma120SeriesRef.current.setData(ma120Data);
      ma240SeriesRef.current.setData(ma240Data);
      ma360SeriesRef.current.setData(ma360Data);
      
      // MA 가시성 설정
      ma60SeriesRef.current.applyOptions({ visible: showMA.ma60 });
      ma120SeriesRef.current.applyOptions({ visible: showMA.ma120 });
      ma240SeriesRef.current.applyOptions({ visible: showMA.ma240 });
      ma360SeriesRef.current.applyOptions({ visible: showMA.ma360 });
      
      // 마지막 가격 설정
      if (candleData.length > 0) {
        setChartPrice(candleData[candleData.length - 1].close);
      }
      
      // 현재 가격 가져오기
      const price = await getCurrentPrice(symbol);
      if (price) {
        setCurrentPrice(price);
      }
      
      console.log('차트 데이터 로드 완료');
      
    } catch (error) {
      console.error('차트 데이터 로드 오류:', error);
    } finally {
      setIsLoading(false);
    }
  }, [symbol, chartType, showMA]);
  
  // 자동 업데이트 설정
  useEffect(() => {
    if (!isAutoUpdate) {
      // 자동 업데이트가 꺼지면 interval 정리
      return;
    }
    
    // 실시간 API 업데이트가 켜져 있으면 자동 업데이트 사용 안함
    if (isRealtimeAPIEnabled) {
      return;
    }
    
    console.log('자동 업데이트 인터벌 설정 (10초)');
    
    // 즉시 한 번 업데이트
    loadChartData();
    
    const interval = setInterval(() => {
      console.log('자동 업데이트 실행:', new Date().toLocaleTimeString());
      loadChartData();
    }, 10000); // 10초마다 업데이트
    
    return () => {
      console.log('자동 업데이트 인터벌 정리');
      clearInterval(interval);
    };
  }, [isAutoUpdate, isRealtimeAPIEnabled, loadChartData]);
  
  // 컴포넌트 마운트 시 초기 데이터 로드
  useEffect(() => {
    // 차트와 시리즈가 모두 초기화된 후에만 데이터 로드
    if (chartRef.current && candleSeriesRef.current && 
        volumeSeriesRef.current && ma60SeriesRef.current && 
        ma120SeriesRef.current && ma240SeriesRef.current && 
        ma360SeriesRef.current) {
      console.log('컴포넌트 마운트 시 초기 데이터 로드');
      loadChartData();
    }
  }, [loadChartData]);
  
  // MA 데이터 업데이트 함수
  const updateMAData = useCallback((candleData: ExtendedCandlestickData[]) => {
    if (!ma60SeriesRef.current || !ma120SeriesRef.current || !ma240SeriesRef.current || !ma360SeriesRef.current) return;
    
    // MA 계산
    const ma60Data: LineData<Time>[] = [];
    const ma60Period = 60;
    
    const ma120Data: LineData<Time>[] = [];
    const ma120Period = 120;
    
    const ma240Data: LineData<Time>[] = [];
    const ma240Period = 240;
    
    const ma360Data: LineData<Time>[] = [];
    const ma360Period = 360;
    
    for (let i = 0; i < candleData.length; i++) {
      if (i >= ma60Period - 1) {
        let sum = 0;
        for (let j = 0; j < ma60Period; j++) {
          sum += candleData[i - j].close;
        }
        ma60Data.push({
          time: candleData[i].time,
          value: sum / ma60Period
        });
      }
      
      if (i >= ma120Period - 1) {
        let sum = 0;
        for (let j = 0; j < ma120Period; j++) {
          sum += candleData[i - j].close;
        }
        ma120Data.push({
          time: candleData[i].time,
          value: sum / ma120Period
        });
      }
      
      if (i >= ma240Period - 1) {
        let sum = 0;
        for (let j = 0; j < ma240Period; j++) {
          sum += candleData[i - j].close;
        }
        ma240Data.push({
          time: candleData[i].time,
          value: sum / ma240Period
        });
      }
      
      if (i >= ma360Period - 1) {
        let sum = 0;
        for (let j = 0; j < ma360Period; j++) {
          sum += candleData[i - j].close;
        }
        ma360Data.push({
          time: candleData[i].time,
          value: sum / ma360Period
        });
      }
    }
    
    // MA 데이터 설정
    ma60SeriesRef.current.setData(ma60Data);
    ma120SeriesRef.current.setData(ma120Data);
    ma240SeriesRef.current.setData(ma240Data);
    ma360SeriesRef.current.setData(ma360Data);
  }, []);
  
  // 주문 수량 계산 함수
  const calculateOrderVolume = (price: number) => {
    if (price <= 0) return '0';
    const amount = orderLimits.maxOrderPrice * 0.25; // 최대 주문 금액의 25%
    return (amount / price).toFixed(4);
  };
  
  // 자동 업데이트 토글 핸들러
  const handleAutoUpdateToggle = () => {
    // 실시간 API 업데이트가 켜져 있으면 끄기
    if (isRealtimeAPIEnabled) {
      if (apiIntervalRef.current) {
        clearInterval(apiIntervalRef.current);
        apiIntervalRef.current = null;
      }
      setIsRealtimeAPIEnabled(false);
    }
    
    const newAutoUpdateState = !isAutoUpdate;
    setIsAutoUpdate(newAutoUpdateState);
    
    // 자동 업데이트를 켤 때 즉시 데이터 로드
    if (newAutoUpdateState) {
      console.log('자동 업데이트 활성화, 데이터 로드 시작');
      loadChartData();
    } else {
      console.log('자동 업데이트 비활성화');
    }
  };
  
  // 차트 높이 조절 핸들러
  const handleHeightChange = (height: number) => {
    setChartHeight(height);
  };
  
  // 실시간 API 업데이트 토글 핸들러
  const handleRealtimeAPIToggle = () => {
    if (!isRealtimeAPIEnabled) {
      // 자동 업데이트 비활성화
      setIsAutoUpdate(false);
      
      console.log('실시간 API 업데이트 시작');
      
      // 실시간 API 업데이트 시작
      apiIntervalRef.current = setInterval(async () => {
        try {
          // 초봉 데이터 한 개만 가져오기
          const response = await fetch(
            `https://api.upbit.com/v1/candles/minutes/1?market=${symbol}&count=1`
          );
          
          if (!response.ok) {
            throw new Error(`API 요청 실패: ${response.status}`);
          }
          
          const data = await response.json();
          
          if (data && data.length > 0) {
            const existingData = Array.from(candleSeriesRef.current?.data() ?? []) as ExtendedCandlestickData[];
            const lastDataTime = existingData.length > 0 ? new Date((existingData[existingData.length - 1].time as number) * 1000).getTime() : 0;
            const newDataTime = new Date(data[0].candle_date_time_kst).getTime();

            // 새로운 데이터인 경우에만 추가
            if (newDataTime > lastDataTime) {
              const newCandle = {
                time: Math.floor(new Date(data[0].candle_date_time_kst).getTime() / 1000) as Time,
                open: data[0].opening_price,
                high: data[0].high_price,
                low: data[0].low_price,
                close: data[0].trade_price,
                volume: data[0].candle_acc_trade_volume
              };

              const updatedData = existingData.filter(candle => 
                (candle.time as number) !== Math.floor(newDataTime / 1000)
              ).concat(newCandle)
                .sort((a, b) => (a.time as number) - (b.time as number));

              candleSeriesRef.current?.setData(updatedData);
              
              // 현재 가격 업데이트
              setCurrentPrice(data[0].trade_price);
              setChartPrice(data[0].trade_price);
              
              // 거래량 데이터 업데이트
              if (volumeSeriesRef.current) {
                const volumeData = updatedData.map(candle => ({
                  time: candle.time,
                  value: candle.volume || 0,
                  color: candle.close >= candle.open ? '#26a69a80' : '#ef535080'
                }));
                volumeSeriesRef.current.setData(volumeData);
              }
              
              // MA 데이터 업데이트
              updateMAData(updatedData);
              
              console.log('실시간 데이터 업데이트 완료:', new Date().toLocaleTimeString());
            }
          }
        } catch (error) {
          console.error('실시간 API 업데이트 중 오류:', error);
        }
      }, 1000);  // 1초마다 업데이트
    } else {
      // interval 정리
      if (apiIntervalRef.current) {
        clearInterval(apiIntervalRef.current);
        apiIntervalRef.current = null;
      }
      console.log('실시간 API 업데이트 중지');
    }
    setIsRealtimeAPIEnabled(!isRealtimeAPIEnabled);
  };
  
  // MA 표시 토글 핸들러
  const handleMAToggle = (maType: 'ma60' | 'ma120' | 'ma240' | 'ma360') => {
    setShowMA(prev => {
      const newState = { ...prev, [maType]: !prev[maType] };
      
      // MA 시리즈 가시성 업데이트
      if (maType === 'ma60' && ma60SeriesRef.current) {
        ma60SeriesRef.current.applyOptions({ visible: !prev.ma60 });
      } else if (maType === 'ma120' && ma120SeriesRef.current) {
        ma120SeriesRef.current.applyOptions({ visible: !prev.ma120 });
      } else if (maType === 'ma240' && ma240SeriesRef.current) {
        ma240SeriesRef.current.applyOptions({ visible: !prev.ma240 });
      } else if (maType === 'ma360' && ma360SeriesRef.current) {
        ma360SeriesRef.current.applyOptions({ visible: !prev.ma360 });
      }
      
      return newState;
    });
  };
  
  // 매수 버튼 핸들러
  const handleBuy = async () => {
    if (currentPrice <= 0) return;
    
    try {
      await handleOrder({
        market: symbol,
        side: 'bid',
        volume: calculateOrderVolume(currentPrice),
        price: currentPrice.toString(),
        ord_type: 'limit',
        mode: mode
      });
    } catch (error) {
      console.error('매수 주문 실패:', error);
    }
  };
  
  // 매도 버튼 핸들러
  const handleSell = async () => {
    if (currentPrice <= 0) return;
    
    try {
      await handleOrder({
        market: symbol,
        side: 'ask',
        volume: calculateOrderVolume(currentPrice),
        price: currentPrice.toString(),
        ord_type: 'limit',
        mode: mode
      });
    } catch (error) {
      console.error('매도 주문 실패:', error);
    }
  };
  
  // 시세 차이 계산
  const priceDiff = currentPrice > 0 && chartPrice > 0 
    ? currentPrice - chartPrice 
    : 0;
  const priceDiffPercentage = currentPrice > 0 && chartPrice > 0
    ? (priceDiff / chartPrice) * 100
    : 0;
  
  return (
    <div className="w-full bg-[#1e1e1e] rounded-lg">
      {/* 컨트롤 패널 */}
      <div className="mb-4 bg-gray-800 p-4 rounded-lg">
        <div className="flex justify-between items-center">
          <div className="flex items-center space-x-4">
            <button
              onClick={handleAutoUpdateToggle}
              className={`px-4 py-2 rounded-lg font-bold ${
                isAutoUpdate 
                  ? 'bg-green-600 hover:bg-green-700' 
                  : 'bg-gray-600 hover:bg-gray-700'
              } text-white`}
            >
              {isAutoUpdate ? '✓ 자동 업데이트' : '자동 업데이트'}
            </button>
            
            <button
              onClick={handleRealtimeAPIToggle}
              className={`px-4 py-2 rounded-lg font-bold ${
                isRealtimeAPIEnabled 
                  ? 'bg-blue-600 hover:bg-blue-700' 
                  : 'bg-gray-600 hover:bg-gray-700'
              } text-white`}
            >
              {isRealtimeAPIEnabled ? '✓ 실시간API업데이트' : '실시간API업데이트'}
            </button>
            
            <div className="flex items-center space-x-2">
              <span className="text-gray-400">높이:</span>
              <input
                type="range"
                min="200"
                max="800"
                value={chartHeight}
                onChange={(e) => handleHeightChange(parseInt(e.target.value))}
                className="w-32"
              />
              <span className="text-white">{chartHeight}px</span>
            </div>
          </div>
          
          <div className="flex space-x-2">
            <button
              onClick={handleBuy}
              className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg"
            >
              매수
            </button>
            <button
              onClick={handleSell}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg"
            >
              매도
            </button>
          </div>
        </div>
      </div>
      
      {/* MA 토글 버튼 */}
      <div className="mb-4 bg-gray-800 p-4 rounded-lg">
        <div className="flex items-center justify-between">
          <div className="text-gray-400 text-sm">이동평균선 표시</div>
          <div className="flex space-x-2">
            <button
              onClick={() => handleMAToggle('ma60')}
              className={`px-3 py-1 rounded ${showMA.ma60 ? 'bg-blue-600' : 'bg-gray-600'}`}
            >
              {showMA.ma60 ? '✓ 60MA' : '60MA'}
            </button>
            <button
              onClick={() => handleMAToggle('ma120')}
              className={`px-3 py-1 rounded ${showMA.ma120 ? 'bg-purple-600' : 'bg-gray-600'}`}
            >
              {showMA.ma120 ? '✓ 120MA' : '120MA'}
            </button>
            <button
              onClick={() => handleMAToggle('ma240')}
              className={`px-3 py-1 rounded ${showMA.ma240 ? 'bg-orange-600' : 'bg-gray-600'}`}
            >
              {showMA.ma240 ? '✓ 240MA' : '240MA'}
            </button>
            <button
              onClick={() => handleMAToggle('ma360')}
              className={`px-3 py-1 rounded ${showMA.ma360 ? 'bg-red-600' : 'bg-gray-600'}`}
            >
              {showMA.ma360 ? '✓ 360MA' : '360MA'}
            </button>
          </div>
        </div>
      </div>
      
      {/* 시세 정보 */}
      <div className="grid grid-cols-3 gap-4 mb-4">
        <div className="bg-gray-800 p-4 rounded-lg">
          <div className="text-gray-400 text-sm">현재 시세</div>
          <div className="text-white text-lg font-bold">
            {currentPrice.toLocaleString()} KRW
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
            {priceDiff.toLocaleString()} KRW ({priceDiffPercentage.toFixed(2)}%)
          </div>
        </div>
      </div>
      
      {/* 차트 컨테이너 */}
      <div className="relative">
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50 z-10">
            <div className="text-white">데이터 로딩 중...</div>
          </div>
        )}
        <div 
          ref={container} 
          className="w-full rounded-lg overflow-hidden"
        />
      </div>
    </div>
  );
}; 