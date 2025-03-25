import React, { useEffect, useRef } from 'react';
import { createChart, IChartApi, ISeriesApi, Time } from 'lightweight-charts';
import { PolMACD } from '../indicators/PolMACD';
import { CandlestickData } from '../types/candlestick';

interface PolMACDChartProps {
  data: CandlestickData[];
  height?: number;
}

const PolMACDChart: React.FC<PolMACDChartProps> = ({ data, height = 300 }) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const macdRef = useRef<ISeriesApi<'Line'> | null>(null);
  const signalRef = useRef<ISeriesApi<'Line'> | null>(null);
  const waveARef = useRef<ISeriesApi<'Histogram'> | null>(null);
  const waveBRef = useRef<ISeriesApi<'Histogram'> | null>(null);
  const waveCRef = useRef<ISeriesApi<'Histogram'> | null>(null);

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
      color: 'blue',
      lineWidth: 2,
      title: '폴MACD',
    });

    // Signal 라인
    signalRef.current = chart.addLineSeries({
      color: 'red',
      lineWidth: 2,
      title: '시그널',
    });

    // Wave A
    waveARef.current = chart.addHistogramSeries({
      color: '#000000',
      priceFormat: { type: 'volume' },
      priceScaleId: 'wave',
      title: 'Wave A',
    });

    // Wave B
    waveBRef.current = chart.addHistogramSeries({
      color: '#000000',
      priceFormat: { type: 'volume' },
      priceScaleId: 'wave',
      title: 'Wave B',
    });

    // Wave C
    waveCRef.current = chart.addHistogramSeries({
      color: '#00bcd4',
      priceFormat: { type: 'volume' },
      priceScaleId: 'wave',
      title: 'Wave C',
    });

    // 데이터 업데이트
    if (data.length > 0) {
      const polMACD = new PolMACD();
      const results = polMACD.calculate(data);

      const chartData = results.map((result, index) => ({
        time: data[index].time as Time,
        value: result.macd,
      }));

      const signalData = results.map((result, index) => ({
        time: data[index].time as Time,
        value: result.signal,
      }));

      const waveAData = results.map((result, index) => ({
        time: data[index].time as Time,
        value: result.waveA,
        color: result.waveA > 0 ? '#000000' : '#000000',
      }));

      const waveBData = results.map((result, index) => ({
        time: data[index].time as Time,
        value: result.waveB,
        color: result.waveB > 0 ? '#000000' : '#000000',
      }));

      const waveCData = results.map((result, index) => ({
        time: data[index].time as Time,
        value: result.waveC,
        color: result.waveC > 0 ? '#00bcd4' : '#f44336',
      }));

      if (macdRef.current) macdRef.current.setData(chartData);
      if (signalRef.current) signalRef.current.setData(signalData);
      if (waveARef.current) waveARef.current.setData(waveAData);
      if (waveBRef.current) waveBRef.current.setData(waveBData);
      if (waveCRef.current) waveCRef.current.setData(waveCData);

      chart.timeScale().fitContent();
    }

    return () => {
      chart.remove();
    };
  }, [data, height]);

  return <div ref={chartContainerRef} />;
};

export default PolMACDChart; 