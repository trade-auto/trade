import React, { useEffect, useRef } from 'react';
import { createChart, IChartApi, ISeriesApi, Time } from 'lightweight-charts';
import { CandlestickData } from '../types/candlestick';
import { MASettings } from '../components/CandlestickChartTypes';

interface PolMACDChartProps {
  data: CandlestickData[];
  height?: number;
  showMA?: MASettings;
}

const PolMACDChart: React.FC<PolMACDChartProps> = ({ data, height = 400, showMA }) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const macdRef = useRef<ISeriesApi<'Line'> | null>(null);
  const signalRef = useRef<ISeriesApi<'Line'> | null>(null);
  const histogramRef = useRef<ISeriesApi<'Histogram'> | null>(null);
  const markerSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const kLineRef = useRef<ISeriesApi<'Line'> | null>(null);
  const dLineRef = useRef<ISeriesApi<'Line'> | null>(null);
  const ema5Ref = useRef<ISeriesApi<'Line'> | null>(null);
  const ema10Ref = useRef<ISeriesApi<'Line'> | null>(null);
  const ema20Ref = useRef<ISeriesApi<'Line'> | null>(null);
  const ema30Ref = useRef<ISeriesApi<'Line'> | null>(null);
  const ema48Ref = useRef<ISeriesApi<'Line'> | null>(null);
  const ema60Ref = useRef<ISeriesApi<'Line'> | null>(null);
  const ema90Ref = useRef<ISeriesApi<'Line'> | null>(null);
  const ema120Ref = useRef<ISeriesApi<'Line'> | null>(null);
  const ema240Ref = useRef<ISeriesApi<'Line'> | null>(null);
  const ema360Ref = useRef<ISeriesApi<'Line'> | null>(null);
  const ema600Ref = useRef<ISeriesApi<'Line'> | null>(null);
  const ema900Ref = useRef<ISeriesApi<'Line'> | null>(null);

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

    // 5EMA와 20EMA 계산
    const ema5 = calculateEMA(closes, 5);
    const ema20 = calculateEMA(closes, 20);

    // 매수/매도 신호를 위한 상태 변수
    let lastSignal: 'buy' | 'sell' | null = null; // 마지막 신호 추적 (매수 후에만 매도 가능)

    const signals: (string | null)[] = [];
    for (let i = 1; i < data.length; i++) {
      // 이전 및 현재 5EMA와 20EMA 값
      const prev5EMA = ema5[i - 1];
      const prev20EMA = ema20[i - 1];
      const curr5EMA = ema5[i];
      const curr20EMA = ema20[i];
      
      let signal = null;
      
      // 5EMA가 20EMA를 상향 돌파 (매수 신호)
      if (prev5EMA < prev20EMA && curr5EMA > curr20EMA) {
        signal = 'buy';
        lastSignal = 'buy';
      } 
      // 5EMA가 20EMA를 하향 돌파 (매도 신호) - 이전에 매수 신호가 있었을 경우에만
      else if (prev5EMA > prev20EMA && curr5EMA < curr20EMA && lastSignal === 'buy') {
        signal = 'sell';
        lastSignal = 'sell';
      }
      
      signals.push(signal);
    }

    // 신호가 있는 부분만 필터링하여 필요한 데이터 형식으로 변환
    return data.map((candle, i) => ({
      time: candle.time,
      macd: i < macdLine.length ? macdLine[i] : 0,
      signal: i < signalLine.length ? signalLine[i] : 0,
      histogram: i < histogram.length ? histogram[i] : 0,
      tradeSignal: i < signals.length ? signals[i] : null,
      ema5: i < ema5.length ? ema5[i] : 0,
      ema20: i < ema20.length ? ema20[i] : 0
    }));
  };

  // EMA 계산 함수
  const calculateEMA = (data: CandlestickData[], period: number) => {
    const closes = data.map(d => d.close);
    const k = 2 / (period + 1);
    let ema = closes[0];
    const emaResults = [{ time: data[0].time, value: ema }];
    
    for (let i = 1; i < closes.length; i++) {
      ema = (closes[i] * k) + (ema * (1 - k));
      emaResults.push({ time: data[i].time, value: ema });
    }
    return emaResults;
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

    // 5EMA 추가
    ema5Ref.current = chart.addLineSeries({
      color: '#FF00FF', // 마젠타
      lineWidth: 1,
      title: '5 EMA',
      priceScaleId: 'candle',
      visible: showMA?.five || false,
    });

    // 10EMA 추가
    ema10Ref.current = chart.addLineSeries({
      color: '#00FFFF', // 시안
      lineWidth: 1,
      title: '10 EMA',
      priceScaleId: 'candle',
      visible: showMA?.ten || false,
    });

    // 20EMA 추가
    ema20Ref.current = chart.addLineSeries({
      color: '#00FF00', // 녹색
      lineWidth: 1,
      title: '20 EMA',
      priceScaleId: 'candle',
      visible: showMA?.twenty || false,
    });

    // 30EMA 추가
    ema30Ref.current = chart.addLineSeries({
      color: '#FF0000', // 빨간색
      lineWidth: 2,     // 두껍게 표시
      lineStyle: 0,     // 실선
      title: '30 EMA',
      priceScaleId: 'candle',
      visible: showMA?.thirty !== undefined ? showMA.thirty : true, // 기본적으로 표시
    });

    // 48EMA 추가
    ema48Ref.current = chart.addLineSeries({
      color: '#9370DB',  // 중간 보라색 (ChartContainer와 동일)
      lineWidth: 1,
      title: '48 EMA',
      priceScaleId: 'candle',
      visible: showMA?.fortyEight || false,
    });

    // 60EMA 추가
    ema60Ref.current = chart.addLineSeries({
      color: '#0000FF', // 파란색
      lineWidth: 1,
      title: '60 EMA',
      priceScaleId: 'candle',
      visible: showMA?.sixty || false,
    });

    // 90EMA 추가
    ema90Ref.current = chart.addLineSeries({
      color: '#FFD700', // 금색
      lineWidth: 1,
      title: '90 EMA',
      priceScaleId: 'candle',
      visible: showMA?.ninety || false,
    });

    // 120EMA 추가
    ema120Ref.current = chart.addLineSeries({
      color: '#FF00FF', // 마젠타
      lineWidth: 1,
      title: '120 EMA',
      priceScaleId: 'candle',
      visible: showMA?.oneTwenty || false,
    });

    // 240EMA 추가
    ema240Ref.current = chart.addLineSeries({
      color: '#00FF00', // 녹색
      lineWidth: 1,
      title: '240 EMA',
      priceScaleId: 'candle',
      visible: showMA?.twoForty || false,
    });

    // 360EMA 추가
    ema360Ref.current = chart.addLineSeries({
      color: '#FF0000', // 빨간색
      lineWidth: 1,
      title: '360 EMA',
      priceScaleId: 'candle',
      visible: showMA?.threeHundredSixty || false,
    });

    // 600EMA 추가
    ema600Ref.current = chart.addLineSeries({
      color: '#0000FF', // 파란색
      lineWidth: 1,
      title: '600 EMA',
      priceScaleId: 'candle',
      visible: showMA?.sixHundred || false,
    });

    // 900EMA 추가
    ema900Ref.current = chart.addLineSeries({
      color: '#FFD700', // 금색
      lineWidth: 1,
      title: '900 EMA',
      priceScaleId: 'candle',
      visible: showMA?.nineHundred || false,
    });

    // MACD 라인 추가
    macdRef.current = chart.addLineSeries({
      color: '#4CAF50', // 녹색으로 변경
      lineWidth: 2,
      title: 'MACD',
      priceScaleId: 'macd',
    });

    // MACD 시그널 라인 추가
    signalRef.current = chart.addLineSeries({
      color: '#9C27B0', // 보라색으로 변경
      lineWidth: 2,
      title: 'Signal',
      priceScaleId: 'macd',
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
      priceScaleId: 'candle',
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

      // EMA 데이터 계산 및 설정
      const ema5Data = calculateEMA(data, 5);
      const ema10Data = calculateEMA(data, 10);
      const ema20Data = calculateEMA(data, 20);
      const ema30Data = calculateEMA(data, 30);
      const ema48Data = calculateEMA(data, 48);
      const ema60Data = calculateEMA(data, 60);
      const ema90Data = calculateEMA(data, 90);
      const ema120Data = calculateEMA(data, 120);
      const ema240Data = calculateEMA(data, 240);
      const ema360Data = calculateEMA(data, 360);
      const ema600Data = calculateEMA(data, 600);
      const ema900Data = calculateEMA(data, 900);
      
      if (ema5Ref.current) {
        ema5Ref.current.setData(ema5Data);
      }
      
      if (ema10Ref.current) {
        ema10Ref.current.setData(ema10Data);
      }
      
      if (ema20Ref.current) {
        ema20Ref.current.setData(ema20Data);
      }
      
      if (ema30Ref.current) {
        ema30Ref.current.setData(ema30Data);
      }
      
      if (ema48Ref.current) {
        ema48Ref.current.setData(ema48Data);
      }
      
      if (ema60Ref.current) {
        ema60Ref.current.setData(ema60Data);
      }
      
      if (ema90Ref.current) {
        ema90Ref.current.setData(ema90Data);
      }
      
      if (ema120Ref.current) {
        ema120Ref.current.setData(ema120Data);
      }
      
      if (ema240Ref.current) {
        ema240Ref.current.setData(ema240Data);
      }
      
      if (ema360Ref.current) {
        ema360Ref.current.setData(ema360Data);
      }
      
      if (ema600Ref.current) {
        ema600Ref.current.setData(ema600Data);
      }
      
      if (ema900Ref.current) {
        ema900Ref.current.setData(ema900Data);
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
          time: d.time,
          position: d.tradeSignal === 'buy' ? 'belowBar' as const : 'aboveBar' as const,
          color: d.tradeSignal === 'buy' ? '#0000FF' : '#FF0000',
          shape: d.tradeSignal === 'buy' ? 'arrowUp' as const : 'arrowDown' as const,
          text: d.tradeSignal === 'buy' ? 
            '5EMA가 20EMA 상향돌파 매수' : 
            '5EMA가 20EMA 하향돌파 매도',
          size: 3
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
      if (candleRef.current) candleRef.current.setMarkers(markers);
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
  }, [data, height, showMA]);

  // 이동평균선 표시 설정이 변경되면 가시성 업데이트
  useEffect(() => {
    if (showMA) {
      if (ema5Ref.current) 
        ema5Ref.current.applyOptions({ visible: showMA.five });
      
      if (ema10Ref.current) 
        ema10Ref.current.applyOptions({ visible: showMA.ten });
      
      if (ema20Ref.current) 
        ema20Ref.current.applyOptions({ visible: showMA.twenty });
      
      if (ema30Ref.current) 
        ema30Ref.current.applyOptions({ visible: showMA.thirty });
      
      if (ema48Ref.current) 
        ema48Ref.current.applyOptions({ visible: showMA.fortyEight });
      
      if (ema60Ref.current) 
        ema60Ref.current.applyOptions({ visible: showMA.sixty });
      
      if (ema90Ref.current) 
        ema90Ref.current.applyOptions({ visible: showMA.ninety });
      
      if (ema120Ref.current) 
        ema120Ref.current.applyOptions({ visible: showMA.oneTwenty });
      
      if (ema240Ref.current) 
        ema240Ref.current.applyOptions({ visible: showMA.twoForty });
      
      if (ema360Ref.current) 
        ema360Ref.current.applyOptions({ visible: showMA.threeHundredSixty });
      
      if (ema600Ref.current) 
        ema600Ref.current.applyOptions({ visible: showMA.sixHundred });
      
      if (ema900Ref.current) 
        ema900Ref.current.applyOptions({ visible: showMA.nineHundred });
    }
  }, [showMA]);

  return (
    <div ref={chartContainerRef} style={{ width: '100%', height: '100%' }} />
  );
};

export default PolMACDChart; 