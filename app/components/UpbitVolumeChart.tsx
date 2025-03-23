'use client';

import { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { createChart } from 'lightweight-charts';

interface ChartProps {
  market: string;
  interval: string;
  count: number;
  height?: number;
}

interface ChartSettings {
  market: string;
  interval: string;
  count: number;
}

// 기본 설정값
const DEFAULT_SETTINGS: ChartSettings = {
  market: 'KRW-BTC',
  interval: 'minutes/3',
  count: 200
};

interface CandleData {
  time: any; // 타입 호환성을 위해 any 사용
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

// MACD 계산 함수
function calculateEMA(data: number[], period: number): number[] {
  const k = 2 / (period + 1);
  let emaArray: number[] = [];
  let ema = data.slice(0, period).reduce((a, b) => a + b) / period;

  emaArray[period - 1] = ema;

  for (let i = period; i < data.length; i++) {
    ema = data[i] * k + ema * (1 - k);
    emaArray[i] = ema;
  }

  return emaArray;
}

// 단순 이동평균(SMA) 계산 함수 추가
function calculateSMA(data: number[], period: number): number[] {
  const result: number[] = [];
  
  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) {
      result.push(NaN); // 기간이 차기 전까지는 값 없음
      continue;
    }
    
    let sum = 0;
    for (let j = 0; j < period; j++) {
      sum += data[i - j];
    }
    result.push(sum / period);
  }
  
  return result;
}

function calculateMACD(closePrices: number[]) {
  const ema12 = calculateEMA(closePrices, 12);
  const ema26 = calculateEMA(closePrices, 26);

  const macdLine = ema12.map((val, i) => 
    val !== undefined && ema26[i] !== undefined ? val - ema26[i] : undefined
  );
  
  const signalLine = calculateEMA(
    macdLine.filter((x): x is number => x !== undefined), 
    9
  );

  const histogram = macdLine.map((val, i) => {
    if (val !== undefined && signalLine[i - (macdLine.length - signalLine.length)] !== undefined) {
      return val - signalLine[i - (macdLine.length - signalLine.length)];
    }
    return undefined;
  });

  return { macdLine, signalLine, histogram };
}

// 간단한 차트 컴포넌트
const UpbitVolumeChart: React.FC<ChartProps> = ({ market, interval, count, height = 3600 }) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [candleData, setCandleData] = useState<CandleData[]>([]);
  const [retryCount, setRetryCount] = useState(0);
  const [settings, setSettings] = useState<ChartSettings>(() => {
    // localStorage에서 설정값 불러오기
    if (typeof window !== 'undefined') {
      const savedSettings = localStorage.getItem('chartSettings');
      return savedSettings ? JSON.parse(savedSettings) : DEFAULT_SETTINGS;
    }
    return DEFAULT_SETTINGS;
  });
  const maxRetries = 5;
  
  // 차트 객체 레퍼런스
  const chartRef = useRef<any>(null);

  // 설정값 저장 함수
  const saveSettings = (newSettings: ChartSettings) => {
    setSettings(newSettings);
    localStorage.setItem('chartSettings', JSON.stringify(newSettings));
  };

  // 설정 변경 핸들러
  const handleSettingChange = (key: keyof ChartSettings, value: string | number) => {
    const newSettings = {
      ...settings,
      [key]: value
    };
    saveSettings(newSettings);
  };

  // 캔들 데이터 가져오기
  const fetchData = async () => {
    try {
      setIsLoading(true);
      console.log(`캔들 데이터 요청: ${market}, ${interval}, ${count}`);
      
      const response = await axios.get(`https://api.upbit.com/v1/candles/${interval}?market=${market}&count=${count}`, {
        timeout: 10000, // 10초 타임아웃 설정
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.data) {
        console.error('API 응답 없음');
        throw new Error('업비트 API에서 응답을 받지 못했습니다.');
      }
      
      if (!Array.isArray(response.data)) {
        console.error('API 응답이 배열이 아님', response.data);
        throw new Error('API 응답 형식이 예상과 다릅니다.');
      }
      
      if (response.data.length === 0) {
        console.error('데이터가 비어있음');
        throw new Error(`${market} 마켓의 캔들 데이터가 없습니다. 다른 마켓을 선택해주세요.`);
      }
      
      console.log(`캔들 데이터 응답: ${response.data.length}개 데이터 수신`);
      
      // 데이터 형식 변환 및 역순 정렬 (최신 데이터가 마지막)
      try {
        const formattedData = response.data
          .map((candle: any) => {
            // 필요한 필드가 존재하는지 검증
            if (!candle.candle_date_time_kst || 
                candle.opening_price === undefined || 
                candle.high_price === undefined || 
                candle.low_price === undefined || 
                candle.trade_price === undefined || 
                candle.candle_acc_trade_volume === undefined) {
              console.error('캔들 데이터 형식 오류', candle);
              throw new Error('캔들 데이터 형식이 올바르지 않습니다.');
            }
            
            return {
              time: Math.floor(new Date(candle.candle_date_time_kst).getTime() / 1000),
              open: candle.opening_price,
              high: candle.high_price,
              low: candle.low_price,
              close: candle.trade_price,
              volume: candle.candle_acc_trade_volume
            };
          })
          .reverse();
        
        console.log(`데이터 처리 완료: ${formattedData.length}개 데이터 가공됨`);
        
        if (formattedData.length === 0) {
          throw new Error('데이터 변환 후 결과가 없습니다.');
        }
        
        setCandleData(formattedData);
        setIsLoading(false);
        setError(null);
        setRetryCount(0);
      } catch (formatErr) {
        console.error('데이터 형식 변환 오류:', formatErr);
        throw new Error('데이터 형식을 변환하는 중 오류가 발생했습니다.');
      }
    } catch (err) {
      console.error('데이터 로드 실패:', err);
      
      let errorMessage = '데이터를 로드하는 중 오류가 발생했습니다.';
      
      if (axios.isAxiosError(err)) {
        if (err.code === 'ECONNABORTED') {
          errorMessage = '업비트 API 요청 시간이 초과되었습니다.';
        } else if (err.response) {
          // API 응답이 있지만 오류 상태코드인 경우
          errorMessage = `업비트 API 오류 (${err.response.status}): ${err.response.statusText}`;
        } else if (err.request) {
          // 요청은 보냈지만 응답이 없는 경우
          errorMessage = '업비트 서버에 연결할 수 없습니다. 네트워크 연결을 확인해주세요.';
        }
      } else if (err instanceof Error) {
        errorMessage = err.message;
      }
      
      setError(errorMessage);
      setIsLoading(false);
      
      if (retryCount < maxRetries) {
        const nextRetryDelay = 5000 * Math.pow(1.5, retryCount); // 지수적 백오프
        console.log(`재시도 ${retryCount + 1}/${maxRetries} 예정 (${nextRetryDelay / 1000}초 후)...`);
        setRetryCount(prev => prev + 1);
        setTimeout(fetchData, nextRetryDelay);
      }
    }
  };

  // 차트 생성 및 데이터 설정
  useEffect(() => {
    if (!chartContainerRef.current || !candleData.length) return;

    // 기존 차트가 있다면 제거
    if (chartRef.current) {
      try {
        chartRef.current.remove();
      } catch (e) {
        console.error('차트 제거 중 오류:', e);
      }
      chartRef.current = null;
    }

    try {
      // 차트 컨테이너 스타일 설정
      chartContainerRef.current.style.position = 'relative';
      chartContainerRef.current.style.height = `${height}px`;
      chartContainerRef.current.style.overflow = 'auto';

      // 차트 3개 생성을 위한 컨테이너 추가
      chartContainerRef.current.innerHTML = `
        <div id="candle-chart" style="width:100%; height:${height * 0.6}px; margin-bottom:12px;"></div>
        <div id="macd-chart" style="width:100%; height:${height * 0.2}px; margin-bottom:12px;"></div>
        <div id="volume-chart" style="width:100%; height:${height * 0.2 - 24}px;"></div>
      `;

      // 1. 캔들 차트 생성
      const candleChartElement = document.getElementById('candle-chart');
      const candleChart = createChart(candleChartElement!, {
        width: chartContainerRef.current.clientWidth,
        height: height * 0.6,
        layout: {
          background: { color: '#2B2B43' },
          textColor: '#D9D9D9',
          fontSize: 18,
          fontFamily: 'Gulim, sans-serif',
        },
        grid: {
          vertLines: { color: '#3C3C5A' },
          horzLines: { color: '#3C3C5A' },
        },
        rightPriceScale: {
          visible: true,
          borderColor: '#3C3C5A',
          borderVisible: true,
          ticksVisible: true,
          autoScale: true,
        },
        timeScale: {
          borderColor: '#3C3C5A',
          timeVisible: true,
          borderVisible: true,
          tickMarkFormatter: (time: number) => {
            const date = new Date(time * 1000);
            return date.toLocaleTimeString('ko-KR', { 
              hour: '2-digit', 
              minute: '2-digit' 
            });
          },
        },
      });

      // 2. MACD 차트 생성
      const macdChartElement = document.getElementById('macd-chart');
      const macdChart = createChart(macdChartElement!, {
        width: chartContainerRef.current.clientWidth,
        height: height * 0.2,
        layout: {
          background: { color: '#2B2B43' },
          textColor: '#D9D9D9',
          fontSize: 18,
          fontFamily: 'Gulim, sans-serif',
        },
        grid: {
          vertLines: { color: '#3C3C5A' },
          horzLines: { color: '#3C3C5A' },
        },
        rightPriceScale: {
          visible: true,
          borderColor: '#3C3C5A',
          borderVisible: true,
          ticksVisible: true,
          autoScale: true,
        },
        timeScale: {
          borderColor: '#3C3C5A',
          timeVisible: true,
          borderVisible: true,
          tickMarkFormatter: (time: number) => {
            const date = new Date(time * 1000);
            return date.toLocaleTimeString('ko-KR', { 
              hour: '2-digit', 
              minute: '2-digit' 
            });
          },
        },
      });

      // 3. 볼륨 차트 생성
      const volumeChartElement = document.getElementById('volume-chart');
      const volumeChart = createChart(volumeChartElement!, {
        width: chartContainerRef.current.clientWidth,
        height: height * 0.2 - 24,
        layout: {
          background: { color: '#2B2B43' },
          textColor: '#D9D9D9',
          fontSize: 18,
          fontFamily: 'Gulim, sans-serif',
        },
        grid: {
          vertLines: { color: '#3C3C5A' },
          horzLines: { color: '#3C3C5A' },
        },
        rightPriceScale: {
          visible: true,
          borderColor: '#3C3C5A',
          borderVisible: true,
          ticksVisible: true,
          autoScale: true,
        },
        timeScale: {
          borderColor: '#3C3C5A',
          timeVisible: true,
          borderVisible: true,
          tickMarkFormatter: (time: number) => {
            const date = new Date(time * 1000);
            return date.toLocaleTimeString('ko-KR', { 
              hour: '2-digit', 
              minute: '2-digit' 
            });
          },
        },
      });

      // 캔들스틱 시리즈 생성
      const candleSeries = candleChart.addCandlestickSeries({
        upColor: '#26a69a',
        downColor: '#ef5350',
        borderUpColor: '#26a69a',
        borderDownColor: '#ef5350',
        wickUpColor: '#26a69a',
        wickDownColor: '#ef5350',
        priceFormat: {
          type: 'price',
          precision: 0,
          minMove: 1,
        },
      });

      // MACD 시리즈 생성
      const macdLineSeries = macdChart.addLineSeries({
        color: '#2196F3',
        lineWidth: 2,
        priceFormat: {
          type: 'price',
          precision: 2,
          minMove: 0.01,
        },
      });

      const signalLineSeries = macdChart.addLineSeries({
        color: '#FF9800',
        lineWidth: 1,
        priceFormat: {
          type: 'price',
          precision: 2,
          minMove: 0.01,
        },
      });

      const histogramSeries = macdChart.addHistogramSeries({
        color: '#26a69a',
        priceFormat: {
          type: 'price',
          precision: 2,
          minMove: 0.01,
        },
      });

      // 볼륨 시리즈 생성
      const volumeSeries = volumeChart.addHistogramSeries({
        color: '#26a69a',
        priceFormat: {
          type: 'volume',
          precision: 0,
        },
      });

      // 이동평균선 색상 설정
      const maColors = {
        ma5: '#FF5733',     // 빨간색
        ma10: '#0000FF',    // 파란색
        ma20: '#800080',    // 보라색
        ma30: '#FFA500',    // 주황색
        ma60: '#008000',    // 녹색
      };

      // 이동평균선 시리즈 생성
      const closePrices = candleData.map(d => d.close);

      // 5일 이동평균선
      const ma5Data = calculateSMA(closePrices, 5);
      const ma5Series = candleChart.addLineSeries({
        color: maColors.ma5,
        lineWidth: 2,
        title: '5 이평선',
      });

      // 10일 이동평균선
      const ma10Data = calculateSMA(closePrices, 10);
      const ma10Series = candleChart.addLineSeries({
        color: maColors.ma10,
        lineWidth: 2,
        title: '10 이평선',
      });

      // 20일 이동평균선
      const ma20Data = calculateSMA(closePrices, 20);
      const ma20Series = candleChart.addLineSeries({
        color: maColors.ma20,
        lineWidth: 2,
        title: '20 이평선',
      });

      // 30일 이동평균선
      const ma30Data = calculateSMA(closePrices, 30);
      const ma30Series = candleChart.addLineSeries({
        color: maColors.ma30,
        lineWidth: 2,
        title: '30 이평선',
      });

      // 60일 이동평균선
      const ma60Data = calculateSMA(closePrices, 60);
      const ma60Series = candleChart.addLineSeries({
        color: maColors.ma60,
        lineWidth: 2,
        title: '60 이평선',
      });

      // 캔들 데이터 설정
      candleSeries.setData(candleData.map(d => ({
        time: d.time,
        open: d.open,
        high: d.high,
        low: d.low,
        close: d.close
      })));

      // 이동평균선 데이터 설정
      ma5Series.setData(
        candleData.map((d, i) => ({
          time: d.time,
          value: ma5Data[i]
        })).filter(item => !isNaN(item.value))
      );

      ma10Series.setData(
        candleData.map((d, i) => ({
          time: d.time,
          value: ma10Data[i]
        })).filter(item => !isNaN(item.value))
      );

      ma20Series.setData(
        candleData.map((d, i) => ({
          time: d.time,
          value: ma20Data[i]
        })).filter(item => !isNaN(item.value))
      );

      ma30Series.setData(
        candleData.map((d, i) => ({
          time: d.time,
          value: ma30Data[i]
        })).filter(item => !isNaN(item.value))
      );

      ma60Series.setData(
        candleData.map((d, i) => ({
          time: d.time,
          value: ma60Data[i]
        })).filter(item => !isNaN(item.value))
      );

      // 볼륨 데이터 설정
      volumeSeries.setData(candleData.map(d => ({
        time: d.time,
        value: d.volume,
        color: d.close >= d.open ? '#26a69a' : '#ef5350'
      })));

      // MACD 계산 및 데이터 설정
      const { macdLine, signalLine, histogram } = calculateMACD(closePrices);

      macdLineSeries.setData(candleData.map((d, i) => ({
        time: d.time,
        value: macdLine[i] || 0
      })));

      signalLineSeries.setData(candleData.map((d, i) => ({
        time: d.time,
        value: signalLine[i - (macdLine.length - signalLine.length)] || 0
      })));

      histogramSeries.setData(candleData.map((d, i) => ({
        time: d.time,
        value: histogram[i] || 0,
        color: (histogram[i] || 0) >= 0 ? '#26a69a' : '#ef5350'
      })));

      // 차트들을 동기화하기 위한 시간 범위 설정
      const syncTimeRange = () => {
        const timeScale = candleChart.timeScale();
        const visibleRange = timeScale.getVisibleLogicalRange();
        if (visibleRange !== null) {
          macdChart.timeScale().setVisibleLogicalRange(visibleRange);
          volumeChart.timeScale().setVisibleLogicalRange(visibleRange);
        }
      };

      // 초기 범위 맞추기
      candleChart.timeScale().fitContent();
      setTimeout(syncTimeRange, 100);

      // 캔들 차트의 시간축 변경 이벤트 구독
      candleChart.timeScale().subscribeVisibleTimeRangeChange(syncTimeRange);

      // 차트 레퍼런스 저장 (메모리 누수 방지를 위해)
      chartRef.current = {
        candleChart,
        macdChart,
        volumeChart,
        remove: () => {
          candleChart.remove();
          macdChart.remove();
          volumeChart.remove();
        }
      };

      // 윈도우 리사이즈 이벤트
      const handleResize = () => {
        if (!chartContainerRef.current) return;
        const width = chartContainerRef.current.clientWidth;
        
        candleChart.applyOptions({ width });
        macdChart.applyOptions({ width });
        volumeChart.applyOptions({ width });
        
        setTimeout(syncTimeRange, 100);
      };

      window.addEventListener('resize', handleResize);

      return () => {
        window.removeEventListener('resize', handleResize);
        candleChart.timeScale().unsubscribeVisibleTimeRangeChange(syncTimeRange);
        if (chartRef.current) {
          try {
            chartRef.current.remove();
          } catch (e) {
            console.error('차트 cleanup 중 오류:', e);
          }
          chartRef.current = null;
        }
      };
    } catch (err) {
      console.error('차트 생성 오류:', err);
      setError(err instanceof Error ? err.message : '차트를 생성하는 중 오류가 발생했습니다.');
    }
  }, [candleData, height]);

  // 마운트 시 데이터 가져오기
  useEffect(() => {
    fetchData();
    
    // 1분마다 데이터 업데이트
    const updateInterval = setInterval(fetchData, 60000);
    
    return () => {
      clearInterval(updateInterval);
    };
  }, [market, interval, count]);
  
  return (
    <div className="w-full">
      {/* 설정 패널 추가 */}
      <div className="mb-4 p-4 bg-gray-800 rounded-lg">
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">마켓</label>
            <select
              value={settings.market}
              onChange={(e) => handleSettingChange('market', e.target.value)}
              className="w-full bg-gray-700 text-white rounded px-3 py-2"
            >
              <option value="KRW-BTC">비트코인</option>
              <option value="KRW-ETH">이더리움</option>
              <option value="KRW-XRP">리플</option>
              {/* 추가 마켓 옵션 */}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">기간</label>
            <select
              value={settings.interval}
              onChange={(e) => handleSettingChange('interval', e.target.value)}
              className="w-full bg-gray-700 text-white rounded px-3 py-2"
            >
              <option value="minutes/1">1분</option>
              <option value="minutes/3">3분</option>
              <option value="minutes/5">5분</option>
              <option value="minutes/15">15분</option>
              <option value="minutes/30">30분</option>
              <option value="minutes/60">1시간</option>
              <option value="days">1일</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">캔들 개수</label>
            <input
              type="number"
              value={settings.count}
              onChange={(e) => handleSettingChange('count', parseInt(e.target.value))}
              min="1"
              max="200"
              className="w-full bg-gray-700 text-white rounded px-3 py-2"
            />
          </div>
        </div>
      </div>

      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center text-white z-20">
          <div className="bg-gray-800 bg-opacity-80 p-4 rounded-lg">
            데이터 로딩 중... {retryCount > 0 && `(재시도 ${retryCount}/${maxRetries})`}
          </div>
        </div>
      )}
      
      {error && (
        <div className="absolute inset-0 flex items-center justify-center text-red-500 z-20">
          <div className="bg-gray-800 bg-opacity-80 p-4 rounded-lg">
            <div>{error}</div>
            {retryCount < maxRetries && <div className="mt-2 text-white">
              {retryCount === 0 ? '5초 후 재시도합니다...' : 
                `${Math.round(5 * Math.pow(1.5, retryCount - 1))}초 후 재시도합니다...`}
            </div>}
            {retryCount >= maxRetries && (
              <div className="mt-2 text-white">
                최대 재시도 횟수에 도달했습니다. 페이지를 새로고침하거나 다른 설정을 시도해보세요.
              </div>
            )}
          </div>
        </div>
      )}
      
      <div className="mb-4 text-white">
        <h3 className="text-lg font-bold">{market} 차트</h3>
        <p className="text-sm text-gray-400">총 {candleData.length}개 데이터 표시 중</p>
      </div>
      
      <div 
        ref={chartContainerRef} 
        className="w-full bg-gray-800 p-4 rounded relative z-10 overflow-auto"
        style={{ height: `${height}px`, maxHeight: '80vh' }}
      />
    </div>
  );
};

export default UpbitVolumeChart; 