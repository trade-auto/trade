import React, { useEffect, useRef } from 'react';
import { createChart, IChartApi, ISeriesApi, Time } from 'lightweight-charts';
import { CandlestickData } from '../types/candlestick';

interface PolMACDChartProps {
  data: CandlestickData[];
  height?: number;
}

const PolMACDChart: React.FC<PolMACDChartProps> = ({ data, height = 400 }) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const macdRef = useRef<ISeriesApi<'Line'> | null>(null);
  const signalRef = useRef<ISeriesApi<'Line'> | null>(null);
  const histogramRef = useRef<ISeriesApi<'Histogram'> | null>(null);
  const markerSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const kLineRef = useRef<ISeriesApi<'Line'> | null>(null);
  const dLineRef = useRef<ISeriesApi<'Line'> | null>(null);

  // 스토캐스틱 계산 함수
  const calculateStochastic = (data: CandlestickData[], kPeriod = 20, dPeriod = 5, smoothPeriod = 3) => {
    const results: { time: Time; k: number; d: number }[] = [];
    
    for (let i = kPeriod - 1; i < data.length; i++) {
      const periodData = data.slice(i - kPeriod + 1, i + 1);
      const high = Math.max(...periodData.map(d => d.high));
      const low = Math.min(...periodData.map(d => d.low));
      const close = data[i].close;
      
      const k = ((close - low) / (high - low)) * 100;
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

  // MACD 계산 함수
  const calculateMACD = (data: CandlestickData[], shortPeriod = 12, longPeriod = 26, signalPeriod = 9) => {
    const closes = data.map(d => d.close);
    
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

    const shortEMA = calculateEMA(closes, shortPeriod);
    const longEMA = calculateEMA(closes, longPeriod);

    const macdLine = shortEMA.map((short, i) => short - longEMA[i]);
    const signalLine = calculateEMA(macdLine, signalPeriod);
    const histogram = macdLine.map((macd, i) => macd - signalLine[i]);

    const signals = histogram.map((hist, i) => {
      if (i === 0) return null;
      
      const prevHist = histogram[i - 1];
      const currMacd = macdLine[i];
      const currSignal = signalLine[i];
      
      if (hist > 0 && currMacd > currSignal) {
        if (!(prevHist > 0 && macdLine[i - 1] > signalLine[i - 1])) {
          return 'buy';
        }
      }
      else if (hist < 0 && currMacd < currSignal) {
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

  useEffect(() => {
    if (!chartContainerRef.current) return;

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
        fixLeftEdge: true,
        fixRightEdge: true,
      },
      rightPriceScale: {
        scaleMargins: {
          top: 0.1,
          bottom: 0.1,
        },
      },
    });
    chartRef.current = chart;

    // 캔들차트 추가
    candleRef.current = chart.addCandlestickSeries({
      upColor: '#26a69a',
      downColor: '#ef5350',
      borderVisible: false,
      wickUpColor: '#26a69a',
      wickDownColor: '#ef5350',
      priceScaleId: 'candle',
    });

    // MACD 라인 (녹색)
    macdRef.current = chart.addLineSeries({
      color: '#4CAF50',
      lineWidth: 2,
      title: 'MACD',
      priceScaleId: 'left',
      priceFormat: {
        type: 'price',
        precision: 2,
      },
    });

    // 시그널 라인 (보라색)
    signalRef.current = chart.addLineSeries({
      color: '#9C27B0',
      lineWidth: 2,
      title: 'Signal',
      priceScaleId: 'left',
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
      priceScaleId: 'histogram',
    });

    // MACD 스케일 마진 설정
    chart.priceScale('left').applyOptions({
      scaleMargins: {
        top: 0.1,
        bottom: 0.1,
      },
    });

    // 히스토그램의 스케일 마진 설정
    chart.priceScale('histogram').applyOptions({
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

    // 스토캐스틱 %K 라인 (파란색)
    kLineRef.current = chart.addLineSeries({
      color: '#2196F3',
      lineWidth: 2,
      title: '%K',
      priceScaleId: 'stoch',
    });

    // 스토캐스틱 %D 라인 (주황색)
    dLineRef.current = chart.addLineSeries({
      color: '#FF9800',
      lineWidth: 2,
      title: '%D',
      priceScaleId: 'stoch',
    });

    // 스토캐스틱 스케일 설정
    chart.priceScale('stoch').applyOptions({
      scaleMargins: {
        top: 0.1,
        bottom: 0.1,
      }
    });

    // 과매수 라인 (빨간색)
    const overboughtLine = chart.addLineSeries({
      color: '#FF5252',
      lineWidth: 1,
      lineStyle: 2,
      title: '과매수 (80%)',
      priceScaleId: 'stoch',
    });

    // 과매도 라인 (파란색)
    const oversoldLine = chart.addLineSeries({
      color: '#2196F3',
      lineWidth: 1,
      lineStyle: 2,
      title: '과매도 (20%)',
      priceScaleId: 'stoch',
    });

    // 데이터 업데이트
    if (data.length > 0) {
      // 캔들차트 데이터 설정
      if (candleRef.current) {
        candleRef.current.setData(data);
      }

      const macdData = calculateMACD(data);
      const stochData = calculateStochastic(data);

      // 시작 시간 찾기 (가장 늦은 시작 시간)
      const startTime = Math.max(
        macdData[0].time as number,
        stochData[0].time as number
      );

      // 데이터 필터링 (시작 시간 이후의 데이터만 사용)
      const filteredMacdData = macdData.filter(d => (d.time as number) >= startTime);
      const filteredStochData = stochData.filter(d => (d.time as number) >= startTime);

      const macdLine = filteredMacdData.map(d => ({
        time: d.time as Time,
        value: d.macd,
      }));

      const signalLine = filteredMacdData.map(d => ({
        time: d.time as Time,
        value: d.signal,
      }));

      const histogram = filteredMacdData.map(d => ({
        time: d.time as Time,
        value: d.histogram,
        color: d.histogram >= 0 ? '#4CAF50' : '#FF5252',
      }));

      // 매수/매도 신호 마커
      const markers = filteredMacdData
        .filter(d => d.tradeSignal)
        .map(d => ({
          time: d.time as Time,
          position: d.tradeSignal === 'buy' ? 'belowBar' as const : 'aboveBar' as const,
          color: d.tradeSignal === 'buy' ? '#4CAF50' : '#FF5252',
          shape: d.tradeSignal === 'buy' ? 'arrowUp' as const : 'arrowDown' as const,
          text: d.tradeSignal === 'buy' ? '매수' : '매도',
        }));

      // 스토캐스틱 데이터
      const kLine = filteredStochData.map(d => ({
        time: d.time as Time,
        value: Math.min(100, Math.max(0, d.k)),
      }));

      const dLine = filteredStochData.map(d => ({
        time: d.time as Time,
        value: Math.min(100, Math.max(0, d.d)),
      }));

      // 과매수/과매도 라인 데이터
      const timeRange = {
        from: filteredStochData[0].time as Time,
        to: filteredStochData[filteredStochData.length - 1].time as Time,
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

      // 시간축 설정 - 캔들차트와 동일한 시간 범위 사용
      const timeScale = chart.timeScale();
      timeScale.setVisibleRange({
        from: data[0].time as Time,
        to: data[data.length - 1].time as Time,
      });
      timeScale.fitContent();
    }

    return () => {
      chart.remove();
    };
  }, [data, height]);

  return (
    <div ref={chartContainerRef} style={{ width: '100%', height: '100%' }} />
  );
};

export default PolMACDChart; 