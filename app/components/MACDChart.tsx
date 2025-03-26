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

  // 매수/매도 신호 계산
  const signals = histogram.map((hist, i) => {
    if (i === 0) return null;
    
    const prevHist = histogram[i - 1];
    const currMacd = macdLine[i];
    const currSignal = signalLine[i];
    
    // 양의 히스토그램이고 MACD가 시그널선 위에 있을 때 매수
    if (hist > 0 && currMacd > currSignal) {
      // 이전에는 조건을 만족하지 않았다면 신호 발생
      if (!(prevHist > 0 && macdLine[i - 1] > signalLine[i - 1])) {
        return 'buy';
      }
    }
    // 음의 히스토그램이고 시그널선이 MACD 위에 있을 때 매도
    else if (hist < 0 && currMacd < currSignal) {
      // 이전에는 조건을 만족하지 않았다면 신호 발생
      if (!(prevHist < 0 && macdLine[i - 1] < signalLine[i - 1])) {
        return 'sell';
      }
    }
    
    return null;
  });

  return data.map((candle, i) => ({
    time: candle.time,
    macd: macdLine[i],
    signal: signalLine[i],
    histogram: histogram[i],
    tradeSignal: signals[i]
  }));
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

    // MACD 라인
    macdRef.current = chart.addLineSeries({
      color: '#2196F3',
      lineWidth: 2,
      title: 'MACD',
    });

    // 시그널 라인
    signalRef.current = chart.addLineSeries({
      color: '#FF9800',
      lineWidth: 2,
      title: 'Signal',
      lastValueVisible: false,
      priceLineVisible: false,
      crosshairMarkerVisible: true,
      crosshairMarkerRadius: 4,
    });

    // 히스토그램
    histogramRef.current = chart.addHistogramSeries({
      color: '#4CAF50',
      priceFormat: {
        type: 'price',
        precision: 2,
      },
      priceScaleId: 'right',
    });

    // 히스토그램의 스케일 마진 설정
    chart.priceScale('right').applyOptions({
      scaleMargins: {
        top: 0.8,
        bottom: 0,
      },
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
      const macdData = calculateMACD(data);
      const stochData = calculateStochastic(data);

      const macdLine = macdData.map(d => ({
        time: d.time as Time,
        value: d.macd,
      }));

      const signalLine = macdData.map(d => ({
        time: d.time as Time,
        value: d.signal,
      }));

      const histogram = macdData.map(d => ({
        time: d.time as Time,
        value: d.histogram,
        color: d.histogram >= 0 ? '#26a69a' : '#ef5350',
      }));

      // 매수/매도 신호 마커
      const markers = macdData
        .filter(d => d.tradeSignal)
        .map(d => ({
          time: d.time as Time,
          position: d.tradeSignal === 'buy' ? 'belowBar' as const : 'aboveBar' as const,
          color: d.tradeSignal === 'buy' ? '#4CAF50' : '#FF5252',
          shape: d.tradeSignal === 'buy' ? 'arrowUp' as const : 'arrowDown' as const,
          text: d.tradeSignal === 'buy' ? '매수' : '매도',
        }));

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
        from: stochData[0].time as Time,
        to: stochData[stochData.length - 1].time as Time,
      };

      const overboughtData = [
        { time: timeRange.from, value: 80 },
        { time: timeRange.to, value: 80 },
      ];

      const oversoldData = [
        { time: timeRange.from, value: 20 },
        { time: timeRange.to, value: 20 },
      ];

      if (macdRef.current) macdRef.current.setData(macdLine);
      if (signalRef.current) signalRef.current.setData(signalLine);
      if (histogramRef.current) histogramRef.current.setData(histogram);
      if (markerSeriesRef.current) markerSeriesRef.current.setMarkers(markers);
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