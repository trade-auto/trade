import React, { useEffect, useRef } from 'react';
import { createChart, IChartApi, ISeriesApi, Time } from 'lightweight-charts';
import { CandlestickData } from '../types/candlestick';
import useUpbitStore from '../store/useUpbitStore';

interface MACDChartProps {
  data: CandlestickData[];
  height?: number;
}

// 스토캐스틱 계산 함수
const calculateStochastic = (data: CandlestickData[], kPeriod = 20, dPeriod = 5, smoothPeriod = 3) => {
  const results: { time: Time; k: number; d: number }[] = [];
  
  for (let i = kPeriod - 1; i < data.length; i++) {
    const periodData = data.slice(i - kPeriod + 1, i + 1);
    const high = Math.max(...periodData.map(d => d.high));
    const low = Math.min(...periodData.map(d => d.low));
    const close = data[i].close;
    
    // %K 계산
    const k = ((close - low) / (high - low)) * 100;
    
    // %D 계산 (K의 이동평균)
    const d = results.length >= dPeriod - 1
      ? results.slice(-dPeriod + 1).reduce((sum, r) => sum + r.k, k) / dPeriod
      : k;
    
    results.push({
      time: data[i].time as Time,
      k,
      d
    });
  }
  
  return results;
};

// RSI 계산 함수
const calculateRSI = (data: CandlestickData[], period = 14) => {
  const results: { time: Time; value: number }[] = [];
  
  // RSI 계산을 위해서는 최소 period+1개의 데이터가 필요합니다
  if (data.length <= period) {
    return results;
  }
  
  // 종가 배열 생성
  const closes = data.map(d => d.close);
  
  for (let i = period; i < closes.length; i++) {
    const currentPrices = closes.slice(i - period, i + 1);
    let gains = 0;
    let losses = 0;
    
    // 가격 변화 계산
    for (let j = 1; j <= period; j++) {
      const change = currentPrices[currentPrices.length - j] - currentPrices[currentPrices.length - j - 1];
      if (change >= 0) {
        gains += change;
      } else {
        losses -= change; // 손실은 양수로 변환
      }
    }
    
    // 평균 이득과 손실 계산
    const avgGain = gains / period;
    const avgLoss = losses / period;
    
    // 상대강도(RS) 계산
    let rs = 0;
    let rsi = 50; // 기본값
    
    if (avgLoss === 0) {
      rsi = 100; // 손실이 없으면 RSI는 100
    } else {
      rs = avgGain / avgLoss;
      rsi = 100 - (100 / (1 + rs));
    }
    
    results.push({
      time: data[i].time as Time,
      value: rsi
    });
  }
  
  return results;
};

const calculateMACD = (data: CandlestickData[], shortPeriod = 12, longPeriod = 26, signalPeriod = 9) => {
  const closes = data.map(d => d.close);
  
  // EMA 계산 함수
  const calculateEMA = (prices: number[], period: number) => {
    const k = 2 / (period + 1);
    let ema = prices[0];
    const emaResults = [ema];
    
    for (let i = 1; i < prices.length; i++) {
      ema = (prices[i] * k) + (ema * (1 - k));
      emaResults.push(ema);
    }
    return emaResults;
  };

  // 단기 및 장기 EMA 계산
  const shortEMA = calculateEMA(closes, shortPeriod);
  const longEMA = calculateEMA(closes, longPeriod);

  // MACD 라인 계산
  const macdLine = shortEMA.map((short, i) => short - longEMA[i]);
  
  // 시그널 라인 계산 (MACD의 9일 EMA)
  const signalLine = calculateEMA(macdLine, signalPeriod);

  // 히스토그램 계산
  const histogram = macdLine.map((macd, i) => macd - signalLine[i]);

  // 최대 MACD 값 구하기 (30% 수준 계산용)
  const maxAbsMacd = Math.max(...macdLine.map(value => Math.abs(value)));
  const plus30Level = maxAbsMacd * 0.3;
  const minus30Level = -maxAbsMacd * 0.3;
  
  // 매수/매도 신호 계산
  const signals = macdLine.map((macd, i) => {
    if (i === 0) return null;
    
    const prevHist = histogram[i - 1];
    const currHist = histogram[i];
    const currMacd = macdLine[i];
    const prevMacd = macdLine[i - 1];
    const currSignal = signalLine[i];
    const prevSignal = signalLine[i - 1];
    
    // 기존 매수/매도 신호 로직
    if (currHist > 0 && prevHist <= 0) {
      return 'buy';
    } else if (currHist < 0 && prevHist >= 0) {
      return 'sell';
    }
    
    return null;
  });
  
  // 추가 매수/매도 신호: MACD가 30% 이상일 때 MACD가 신호선 하향돌파 = 매도, 상향돌파 = 매수
  const newSignals = macdLine.map((macd, i) => {
    if (i === 0) return null;
    
    const prevMacd = macdLine[i - 1];
    const currMacd = macd;
    const prevSignal = signalLine[i - 1];
    const currSignal = signalLine[i];
    
    // MACD가 +30% 이상이고 하향 돌파 (매도 신호)
    if (prevMacd > plus30Level && prevMacd > prevSignal && currMacd <= currSignal) {
      return {
        type: 'cross_sell', 
        time: data[i].time, 
        price: macd,
        level: '+30%'
      };
    }
    // MACD가 -30% 이하이고 상향 돌파 (매수 신호)
    else if (prevMacd < minus30Level && prevMacd < prevSignal && currMacd >= currSignal) {
      return {
        type: 'cross_buy', 
        time: data[i].time, 
        price: macd,
        level: '-30%'
      };
    }
    
    return null;
  }).filter(signal => signal !== null);

  return {
    macdData: data.map((candle, i) => ({
      time: candle.time,
      macd: macdLine[i],
      signal: signalLine[i],
      histogram: histogram[i],
      tradeSignal: signals[i]
    })),
    maxAbsMacd,
    crossSignals: newSignals
  };
};

const MACDChart: React.FC<MACDChartProps> = ({ data, height = 400 }) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const stochContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const stochChartRef = useRef<IChartApi | null>(null);
  const macdRef = useRef<ISeriesApi<'Line'> | null>(null);
  const signalRef = useRef<ISeriesApi<'Line'> | null>(null);
  const histogramRef = useRef<ISeriesApi<'Histogram'> | null>(null);
  const markerSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const kLineRef = useRef<ISeriesApi<'Line'> | null>(null);
  const dLineRef = useRef<ISeriesApi<'Line'> | null>(null);
  const rsiLineRef = useRef<ISeriesApi<'Line'> | null>(null); // RSI 라인 참조 추가

  useEffect(() => {
    if (!chartContainerRef.current || !stochContainerRef.current) return;

    // MACD 차트 생성
    const chart = createChart(chartContainerRef.current, {
      height: 300,
      layout: {
        background: { color: '#ffffff' },
        textColor: '#333',
      },
      grid: {
        vertLines: { color: '#f0f0f0' },
        horzLines: { color: '#f0f0f0' },
      },
      timeScale: {
        timeVisible: true,
        secondsVisible: true,
        tickMarkFormatter: (time: any) => {
          const date = new Date(time * 1000);
          const hours = date.getHours().toString().padStart(2, '0');
          const minutes = date.getMinutes().toString().padStart(2, '0');
          const seconds = date.getSeconds().toString().padStart(2, '0');
          return `${hours}:${minutes}:${seconds}`;
        },
      },
    });
    chartRef.current = chart;

    // 스토캐스틱 차트 생성
    const stochChart = createChart(stochContainerRef.current, {
      height: 200,
      layout: {
        background: { color: '#ffffff' },
        textColor: '#333',
      },
      grid: {
        vertLines: { color: '#f0f0f0' },
        horzLines: { color: '#f0f0f0' },
      },
      rightPriceScale: {
        scaleMargins: {
          top: 0.1,
          bottom: 0.1,
        },
      },
      timeScale: {
        timeVisible: true,
        secondsVisible: true,
        tickMarkFormatter: (time: any) => {
          const date = new Date(time * 1000);
          const hours = date.getHours().toString().padStart(2, '0');
          const minutes = date.getMinutes().toString().padStart(2, '0');
          const seconds = date.getSeconds().toString().padStart(2, '0');
          return `${hours}:${minutes}:${seconds}`;
        },
      },
    });
    stochChartRef.current = stochChart;

    // RSI 라인 추가 (가운데 차트에 추가)
    rsiLineRef.current = chart.addLineSeries({
      color: '#7E57C2', // 보라색
      lineWidth: 2,
      title: 'RSI(14)',
      priceFormat: {
        type: 'price',
        precision: 1,
        minMove: 0.1,
      },
    });

    // RSI 30, 70 라인 추가 (과매도/과매수 레벨)
    const rsiOverboughtLine = chart.addLineSeries({
      color: '#FF5252',
      lineWidth: 1,
      lineStyle: 2,
      title: '과매수 (70)',
    });

    const rsiOversoldLine = chart.addLineSeries({
      color: '#4CAF50',
      lineWidth: 1,
      lineStyle: 2,
      title: '과매도 (30)',
    });

    // 스케일 설정
    chart.priceScale('right').applyOptions({
      scaleMargins: {
        top: 0.1, 
        bottom: 0.1,
      },
      autoScale: true,
      mode: 0,
      borderVisible: true
    });

    // 매수/매도 신호 마커 시리즈
    markerSeriesRef.current = chart.addLineSeries({
      color: '#000000',
      lineWidth: 1,
      lastValueVisible: false,
      priceLineVisible: false,
      crosshairMarkerVisible: false,
    });

    // 스토캐스틱 %K 라인
    kLineRef.current = stochChart.addLineSeries({
      color: '#2196F3',
      lineWidth: 2,
      title: '%K',
    });

    // 스토캐스틱 %D 라인
    dLineRef.current = stochChart.addLineSeries({
      color: '#FF9800',
      lineWidth: 2,
      title: '%D',
    });

    // 과매수 라인 (80%)
    const overboughtLine = stochChart.addLineSeries({
      color: '#FF5252',
      lineWidth: 1,
      lineStyle: 2,
      title: '과매수 (80%)',
    });

    // 과매도 라인 (20%)
    const oversoldLine = stochChart.addLineSeries({
      color: '#4CAF50',
      lineWidth: 1,
      lineStyle: 2,
      title: '과매도 (20%)',
    });

    // 데이터 업데이트
    if (data.length > 0) {
      const stochData = calculateStochastic(data);
      const rsiData = calculateRSI(data); // RSI 데이터 계산

      // 스토캐스틱 데이터
      const kLine = stochData.map(d => ({
        time: d.time as Time,
        value: d.k,
      }));

      const dLine = stochData.map(d => ({
        time: d.time as Time,
        value: d.d,
      }));

      // 과매수/과매도 라인 데이터
      const timeRange = {
        from: data[0].time as Time,
        to: data[data.length - 1].time as Time,
      };

      const overboughtData = [
        { time: timeRange.from, value: 80 },
        { time: timeRange.to, value: 80 },
      ];

      const oversoldData = [
        { time: timeRange.from, value: 20 },
        { time: timeRange.to, value: 20 },
      ];

      // RSI 과매수/과매도 라인 설정
      const rsiOverboughtData = [
        { time: timeRange.from, value: 70 },
        { time: timeRange.to, value: 70 },
      ];

      const rsiOversoldData = [
        { time: timeRange.from, value: 30 },
        { time: timeRange.to, value: 30 },
      ];

      // 중앙값 50 라인 추가
      const rsiMidLine = chart.addLineSeries({
        color: '#888888',
        lineWidth: 1,
        lineStyle: 2,
        title: '중앙선 (50)',
      });

      const rsiMidData = [
        { time: timeRange.from, value: 50 },
        { time: timeRange.to, value: 50 },
      ];

      // RSI 데이터 설정
      if (rsiLineRef.current) rsiLineRef.current.setData(rsiData);
      rsiOverboughtLine.setData(rsiOverboughtData);
      rsiOversoldLine.setData(rsiOversoldData);
      rsiMidLine.setData(rsiMidData);

      // 스토캐스틱 데이터 설정
      if (kLineRef.current) kLineRef.current.setData(kLine);
      if (dLineRef.current) dLineRef.current.setData(dLine);
      overboughtLine.setData(overboughtData);
      oversoldLine.setData(oversoldData);

      chart.timeScale().fitContent();
      stochChart.timeScale().fitContent();

      // 차트 동기화
      chart.timeScale().subscribeVisibleTimeRangeChange(() => {
        const range = chart.timeScale().getVisibleRange();
        if (range) {
          stochChart.timeScale().setVisibleRange(range);
          
          // 범위를 스토어에 저장하여 다른 차트와 동기화
          useUpbitStore.setState({ chartTimeRange: range });
        }
      });

      stochChart.timeScale().subscribeVisibleTimeRangeChange(() => {
        const range = stochChart.timeScale().getVisibleRange();
        if (range) {
          chart.timeScale().setVisibleRange(range);
          
          // 범위를 스토어에 저장하여 다른 차트와 동기화
          useUpbitStore.setState({ chartTimeRange: range });
        }
      });
      
      // 업비트 스토어에서 시간 범위 불러오기
      const upbitStore = useUpbitStore.getState();
      if (upbitStore.chartTimeRange) {
        chart.timeScale().setVisibleRange(upbitStore.chartTimeRange);
        stochChart.timeScale().setVisibleRange(upbitStore.chartTimeRange);
      }

      // RSI 차트의 시각적 범위 설정
      chart.applyOptions({
        rightPriceScale: {
          visible: true,
          autoScale: true,
          scaleMargins: {
            top: 0.1,  // RSI 값이 최대 100이므로 여유 공간 확보
            bottom: 0.1, // RSI 값이 최소 0이므로 여유 공간 확보
          },
        }
      });
      
      // RSI 값의 범위를 0-100으로 고정
      rsiLineRef.current?.applyOptions({
        autoscaleInfoProvider: () => ({
          priceRange: {
            minValue: 0,
            maxValue: 100
          },
          margins: {
            above: 10,
            below: 10
          }
        })
      });
    }

    return () => {
      chart.remove();
      stochChart.remove();
    };
  }, [data, height]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', width: '100%', height: '100%' }}>
      <div ref={chartContainerRef} style={{ width: '100%', height: '300px' }} />
      <div ref={stochContainerRef} style={{ width: '100%', height: '200px' }} />
    </div>
  );
};

export default MACDChart;