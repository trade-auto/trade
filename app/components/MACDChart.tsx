import React, { useEffect, useRef } from 'react';
import { createChart, IChartApi, ISeriesApi, Time } from 'lightweight-charts';
import { CandlestickData } from '../types/candlestick';

interface MACDChartProps {
  data: CandlestickData[];
  height?: number;
}

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

  return data.map((candle, i) => ({
    time: candle.time,
    macd: macdLine[i],
    signal: signalLine[i],
    histogram: histogram[i]
  }));
};

const MACDChart: React.FC<MACDChartProps> = ({ data, height = 300 }) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const macdRef = useRef<ISeriesApi<'Line'> | null>(null);
  const signalRef = useRef<ISeriesApi<'Line'> | null>(null);
  const histogramRef = useRef<ISeriesApi<'Histogram'> | null>(null);

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
      title: 'MACD',
    });

    // Signal 라인
    signalRef.current = chart.addLineSeries({
      color: '#FF6D00',
      lineWidth: 2,
      title: 'Signal',
    });

    // Histogram
    histogramRef.current = chart.addHistogramSeries({
      color: '#26a69a',
      priceFormat: { type: 'volume' },
      title: 'Histogram',
    });

    // 데이터 업데이트
    if (data.length > 0) {
      const macdData = calculateMACD(data);

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

      if (macdRef.current) macdRef.current.setData(macdLine);
      if (signalRef.current) signalRef.current.setData(signalLine);
      if (histogramRef.current) histogramRef.current.setData(histogram);

      chart.timeScale().fitContent();
    }

    return () => {
      chart.remove();
    };
  }, [data, height]);

  return <div ref={chartContainerRef} />;
};

export default MACDChart; 