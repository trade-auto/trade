import React, { useEffect, useRef } from 'react';
import { createChart, IChartApi, ISeriesApi, Time } from 'lightweight-charts';
import { CandlestickData } from '../types/candlestick';

interface MonMACDChartProps {
  data: CandlestickData[];
  height?: number;
}

const calculateMonMACD = (data: CandlestickData[], length = 34, signalLength = 9) => {
  // SMMA 계산 함수
  const calculateSMMA = (values: number[], length: number) => {
    const result: number[] = [];
    let sum = 0;
    
    // 첫 번째 값은 SMA로 계산
    for (let i = 0; i < length; i++) {
      sum += values[i];
    }
    result.push(sum / length);
    
    // 나머지 값은 SMMA 공식 사용
    for (let i = length; i < values.length; i++) {
      result.push((result[result.length - 1] * (length - 1) + values[i]) / length);
    }
    
    return result;
  };

  // ZLEMA 계산 함수
  const calculateZLEMA = (values: number[], length: number) => {
    const lag = Math.floor((length - 1) / 2);
    const ema1 = values.map((_, i) => {
      if (i < lag) return values[i];
      return values[i] * 2 - values[i - lag];
    });
    
    const alpha = 2 / (length + 1);
    const result: number[] = [ema1[0]];
    
    for (let i = 1; i < ema1.length; i++) {
      result.push(alpha * ema1[i] + (1 - alpha) * result[i - 1]);
    }
    
    return result;
  };

  // HLC3 계산
  const hlc3 = data.map(d => (d.high + d.low + d.close) / 3);
  const highs = data.map(d => d.high);
  const lows = data.map(d => d.low);

  // SMMA 계산
  const smmaHigh = calculateSMMA(highs, length);
  const smmaLow = calculateSMMA(lows, length);

  // ZLEMA 계산
  const zlema = calculateZLEMA(hlc3, length);

  // MonMACD 계산
  const monMACD = zlema.map((val, i) => {
    if (val > smmaHigh[i]) return val - smmaHigh[i];
    if (val < smmaLow[i]) return val - smmaLow[i];
    return 0;
  });

  // 신호선 계산 (SMA)
  const signal: number[] = [];
  for (let i = 0; i < monMACD.length; i++) {
    if (i < signalLength - 1) {
      signal.push(monMACD[i]);
    } else {
      const slice = monMACD.slice(i - signalLength + 1, i + 1);
      const sum = slice.reduce((a, b) => a + b, 0);
      signal.push(sum / signalLength);
    }
  }

  // 매수/매도 신호 계산
  const signals = monMACD.map((macd, i) => {
    if (i === 0) return null;
    const prevMacd = monMACD[i - 1];
    const prevSignal = signal[i - 1];
    const currSignal = signal[i];
    
    if (prevMacd <= prevSignal && macd > currSignal) return 'buy';
    if (prevMacd >= prevSignal && macd < currSignal) return 'sell';
    return null;
  });

  // 히스토그램 계산
  const histogram = monMACD.map((macd, i) => macd - signal[i]);

  return data.map((candle, i) => ({
    time: candle.time,
    macd: monMACD[i],
    signal: signal[i],
    histogram: histogram[i],
    tradeSignal: signals[i]
  }));
};

const MonMACDChart: React.FC<MonMACDChartProps> = ({ data, height = 300 }) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const macdRef = useRef<ISeriesApi<'Line'> | null>(null);
  const signalRef = useRef<ISeriesApi<'Line'> | null>(null);
  const histogramRef = useRef<ISeriesApi<'Histogram'> | null>(null);
  const markerSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);

  useEffect(() => {
    if (!chartContainerRef.current) return;

    // 차트 생성
    const chart = createChart(chartContainerRef.current, {
      height: height,
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

    // MACD 라인
    macdRef.current = chart.addLineSeries({
      color: '#2962FF',
      lineWidth: 2,
      title: 'MonMACD',
    });

    // Signal 라인
    signalRef.current = chart.addLineSeries({
      color: '#FF6D00',
      lineWidth: 2,
      title: 'Signal',
    });

    // 히스토그램 시리즈
    histogramRef.current = chart.addHistogramSeries({
      color: '#26a69a',
      priceFormat: {
        type: 'price',
        precision: 8,
        minMove: 0.00000001,
      },
      title: 'Histogram',
      priceScaleId: 'left',
      base: 0,
    });

    // 마커용 시리즈
    markerSeriesRef.current = chart.addLineSeries({
      color: 'rgba(0, 0, 0, 0)',
      lineWidth: 0,
    });

    // 데이터 업데이트
    if (data.length > 0) {
      const monMacdData = calculateMonMACD(data);

      const macdLine = monMacdData.map(d => ({
        time: d.time as Time,
        value: d.macd,
      }));

      const signalLine = monMacdData.map(d => ({
        time: d.time as Time,
        value: d.signal,
      }));

      // 히스토그램 데이터
      const histogramData = monMacdData.map(d => ({
        time: d.time as Time,
        value: d.histogram,
        color: d.histogram >= 0 ? '#26a69a' : '#ef5350',
      }));

      // 매수/매도 신호 마커
      const markers = monMacdData
        .filter(d => d.tradeSignal)
        .map(d => ({
          time: d.time as Time,
          position: d.tradeSignal === 'buy' ? 'belowBar' : 'aboveBar',
          color: d.tradeSignal === 'buy' ? '#4CAF50' : '#FF5252',
          shape: d.tradeSignal === 'buy' ? 'arrowUp' : 'arrowDown',
          text: d.tradeSignal === 'buy' ? '매수' : '매도',
        }));

      if (macdRef.current) macdRef.current.setData(macdLine);
      if (signalRef.current) signalRef.current.setData(signalLine);
      if (histogramRef.current) histogramRef.current.setData(histogramData);
      if (markerSeriesRef.current) markerSeriesRef.current.setMarkers(markers);

      chart.timeScale().fitContent();
    }

    return () => {
      chart.remove();
    };
  }, [data, height]);

  return <div ref={chartContainerRef} />;
};

export default MonMACDChart; 