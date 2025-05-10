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
  const chartRef = useRef<IChartApi | null>(null);
  const macdRef = useRef<ISeriesApi<'Line'> | null>(null);
  const signalRef = useRef<ISeriesApi<'Line'> | null>(null);
  const histogramRef = useRef<ISeriesApi<'Histogram'> | null>(null);
  const markerSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const kLineRef = useRef<ISeriesApi<'Line'> | null>(null);
  const dLineRef = useRef<ISeriesApi<'Line'> | null>(null);
  const rsiLineRef = useRef<ISeriesApi<'Line'> | null>(null);
  const candlestickRef = useRef<ISeriesApi<'Candlestick'> | null>(null);

  useEffect(() => {
    if (!chartContainerRef.current) return;

    // 통합 차트 생성
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
      rightPriceScale: { // 오른쪽 스케일 (캔들스틱용)
        scaleMargins: {
          top: 0.1,
          bottom: 0.4, // 하단에 공간 확보
        },
        borderVisible: true,
      },
      leftPriceScale: { // 왼쪽 스케일 (지표용)
        visible: true,
        scaleMargins: {
          top: 0.6, // 상단에 지표를 위한 공간
          bottom: 0.1,
        },
        borderVisible: true,
      },
    });
    chartRef.current = chart;

    // 캔들스틱 시리즈 추가
    const candlestickSeries = chart.addCandlestickSeries({
      upColor: '#4CAF50',
      downColor: '#F44336',
      borderVisible: false,
      wickUpColor: '#4CAF50',
      wickDownColor: '#F44336',
      priceScaleId: 'right',
    });
    candlestickRef.current = candlestickSeries;
    
    // 일부 이동평균선 추가
    const ema5Series = chart.addLineSeries({
      color: '#2196F3', // 파란색
      lineWidth: 1,
      priceScaleId: 'right',
      title: '5 EMA',
    });
    
    const ema20Series = chart.addLineSeries({
      color: '#F44336', // 빨간색
      lineWidth: 1,
      priceScaleId: 'right',
      title: '20 EMA',
    });
    
    const ema30Series = chart.addLineSeries({
      color: '#FFA000', // 주황색
      lineWidth: 1,
      priceScaleId: 'right',
      title: '30 EMA',
    });

    // MACD 라인
    macdRef.current = chart.addLineSeries({
      color: '#2196F3', // 파란색
      lineWidth: 2,
      title: 'MACD',
      priceScaleId: 'left',
    });

    // 시그널 라인
    signalRef.current = chart.addLineSeries({
      color: '#FF9800', // 주황색
      lineWidth: 2,
      title: 'Signal',
      priceScaleId: 'left',
    });

    // 히스토그램
    histogramRef.current = chart.addHistogramSeries({
      color: '#4CAF50',
      priceFormat: {
        type: 'price',
        precision: 2,
      },
      priceScaleId: 'left',
    });

    // RSI 라인 추가
    rsiLineRef.current = chart.addLineSeries({
      color: '#9C27B0', // 보라색
      lineWidth: 2,
      title: 'RSI(14)',
      priceScaleId: 'left',
    });

    // RSI 과매수/과매도 라인
    const rsiOverboughtLine = chart.addLineSeries({
      color: '#FF5252',
      lineWidth: 1,
      lineStyle: 2,
      title: 'RSI 70',
      priceScaleId: 'left',
    });

    const rsiOversoldLine = chart.addLineSeries({
      color: '#4CAF50',
      lineWidth: 1,
      lineStyle: 2,
      title: 'RSI 30',
      priceScaleId: 'left',
    });

    // RSI 중간선
    const rsiMidLine = chart.addLineSeries({
      color: '#888888',
      lineWidth: 1,
      lineStyle: 2,
      title: 'RSI 50',
      priceScaleId: 'left',
    });

    // 스토캐스틱 라인 추가
    kLineRef.current = chart.addLineSeries({
      color: '#1E88E5', // 파란색
      lineWidth: 2,
      title: 'Stoch %K',
      priceScaleId: 'left',
    });

    dLineRef.current = chart.addLineSeries({
      color: '#FF9800', // 주황색
      lineWidth: 2,
      title: 'Stoch %D',
      priceScaleId: 'left',
    });

    // 스토캐스틱 과매수/과매도 라인
    const stochOverboughtLine = chart.addLineSeries({
      color: '#FF5252',
      lineWidth: 1,
      lineStyle: 2,
      title: 'Stoch 80',
      priceScaleId: 'left',
    });

    const stochOversoldLine = chart.addLineSeries({
      color: '#4CAF50',
      lineWidth: 1,
      lineStyle: 2,
      title: 'Stoch 20',
      priceScaleId: 'left',
    });

    // MACD 0선
    const macdZeroLine = chart.addLineSeries({
      color: '#888888',
      lineWidth: 1,
      lineStyle: 2,
      title: 'MACD 0',
      priceScaleId: 'left',
    });

    // 매수/매도 신호 마커 시리즈
    markerSeriesRef.current = chart.addLineSeries({
      color: '#000000',
      lineWidth: 1,
      lastValueVisible: false,
      priceLineVisible: false,
      crosshairMarkerVisible: false,
      priceScaleId: 'right',
    });

    // 데이터 업데이트
    if (data.length > 0) {
      // 캔들스틱 데이터 설정
      candlestickSeries.setData(data);
      
      // EMA 데이터 계산 및 설정
      const calculateEMA = (prices: number[], period: number) => {
        const k = 2 / (period + 1);
        let ema = prices[0];
        const result = [{ time: data[0].time, value: ema }];
        
        for (let i = 1; i < prices.length; i++) {
          ema = (prices[i] * k) + (ema * (1 - k));
          result.push({ time: data[i].time, value: ema });
        }
        return result;
      };
      
      const closes = data.map(d => d.close);
      const ema5 = calculateEMA(closes, 5);
      const ema20 = calculateEMA(closes, 20);
      const ema30 = calculateEMA(closes, 30);
      
      ema5Series.setData(ema5);
      ema20Series.setData(ema20);
      ema30Series.setData(ema30);

      const macdData = calculateMACD(data);
      const stochData = calculateStochastic(data);
      const rsiData = calculateRSI(data);

      const macdLine = macdData.macdData.map(d => ({
        time: d.time as Time,
        value: d.macd,
      }));

      const signalLine = macdData.macdData.map(d => ({
        time: d.time as Time,
        value: d.signal,
      }));

      const histogram = macdData.macdData.map(d => ({
        time: d.time as Time,
        value: d.histogram,
        color: d.histogram >= 0 ? '#26a69a' : '#ef5350',
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
        from: data[0].time as Time,
        to: data[data.length - 1].time as Time,
      };

      // 스토캐스틱 과매수/과매도 라인 설정
      const stochOverboughtData = [
        { time: timeRange.from, value: 80 },
        { time: timeRange.to, value: 80 },
      ];

      const stochOversoldData = [
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

      const rsiMidData = [
        { time: timeRange.from, value: 50 },
        { time: timeRange.to, value: 50 },
      ];

      const macdZeroData = [
        { time: timeRange.from, value: 0 },
        { time: timeRange.to, value: 0 },
      ];

      // MACD 값의 최대값 및 최소값 찾기
      let maxMacd = Math.max(...macdData.macdData.map(d => Math.max(d.macd, d.signal)));
      let minMacd = Math.min(...macdData.macdData.map(d => Math.min(d.macd, d.signal)));
      let macdRange = Math.max(Math.abs(maxMacd), Math.abs(minMacd));

      // 스토캐스틱 값의 범위 조정 (MACD와 동일 공간에 표시)
      const scaledKLine = kLine.map(d => ({
        time: d.time,
        value: (d.value - 50) * (macdRange / 50)  // 스토캐스틱을 MACD 스케일로 조정
      }));

      const scaledDLine = dLine.map(d => ({
        time: d.time,
        value: (d.value - 50) * (macdRange / 50)  // 스토캐스틱을 MACD 스케일로 조정
      }));

      // 스토캐스틱 과매수/과매도 라인 스케일 조정
      const scaledStochOverboughtData = [
        { time: timeRange.from, value: (80 - 50) * (macdRange / 50) },
        { time: timeRange.to, value: (80 - 50) * (macdRange / 50) },
      ];

      const scaledStochOversoldData = [
        { time: timeRange.from, value: (20 - 50) * (macdRange / 50) },
        { time: timeRange.to, value: (20 - 50) * (macdRange / 50) },
      ];

      // RSI 값의 범위 조정 (MACD와 동일 공간에 표시)
      const scaledRsiData = rsiData.map(d => ({
        time: d.time,
        value: (d.value - 50) * (macdRange / 50)  // RSI를 MACD 스케일로 조정
      }));
      
      // RSI 과매수/과매도 라인도 같은 스케일로 조정
      const scaledRsiOverboughtData = [
        { time: timeRange.from, value: (70 - 50) * (macdRange / 50) },
        { time: timeRange.to, value: (70 - 50) * (macdRange / 50) },
      ];
      
      const scaledRsiOversoldData = [
        { time: timeRange.from, value: (30 - 50) * (macdRange / 50) },
        { time: timeRange.to, value: (30 - 50) * (macdRange / 50) },
      ];
      
      const scaledRsiMidData = [
        { time: timeRange.from, value: 0 }, // 50에서 50을 빼면 0
        { time: timeRange.to, value: 0 },
      ];

      // 매수/매도 신호 마커
      const markers = macdData.macdData
        .filter(d => d.tradeSignal)
        .map(d => ({
          time: d.time as Time,
          position: d.tradeSignal === 'buy' ? 'belowBar' as const : 'aboveBar' as const,
          color: d.tradeSignal === 'buy' ? '#4CAF50' : '#FF5252',
          shape: d.tradeSignal === 'buy' ? 'arrowUp' as const : 'arrowDown' as const,
          text: d.tradeSignal === 'buy' ? '매수' : '매도',
        }));

      // 교차 신호 마커 추가
      const crossMarkers = macdData.crossSignals.map(signal => ({
        time: signal.time as Time,
        position: signal.type === 'cross_buy' ? 'belowBar' as const : 'aboveBar' as const,
        color: signal.type === 'cross_buy' ? '#00FFAA' : '#FF00AA',
        shape: signal.type === 'cross_buy' ? 'arrowUp' as const : 'arrowDown' as const,
        text: signal.type === 'cross_buy' ? `MACD 매수(${signal.level})` : `MACD 매도(${signal.level})`,
        size: 2
      }));

      // 모든 마커 합치기
      const allMarkers = [...markers, ...crossMarkers];
      
      // 시간 순서로 마커 정렬
      allMarkers.sort((a, b) => {
        const timeA = typeof a.time === 'number' ? a.time : Number(a.time);
        const timeB = typeof b.time === 'number' ? b.time : Number(b.time);
        return timeA - timeB;
      });

      // 데이터 설정
      if (macdRef.current) macdRef.current.setData(macdLine);
      if (signalRef.current) signalRef.current.setData(signalLine);
      if (histogramRef.current) histogramRef.current.setData(histogram);
      if (rsiLineRef.current) rsiLineRef.current.setData(scaledRsiData);
      if (kLineRef.current) kLineRef.current.setData(scaledKLine);
      if (dLineRef.current) dLineRef.current.setData(scaledDLine);
      if (markerSeriesRef.current) markerSeriesRef.current.setMarkers(allMarkers);
      
      rsiOverboughtLine.setData(scaledRsiOverboughtData);
      rsiOversoldLine.setData(scaledRsiOversoldData);
      rsiMidLine.setData(scaledRsiMidData);
      macdZeroLine.setData(macdZeroData);
      stochOverboughtLine.setData(scaledStochOverboughtData);
      stochOversoldLine.setData(scaledStochOversoldData);

      chart.timeScale().fitContent();

      // 업비트 스토어에서 시간 범위 불러오기
      const upbitStore = useUpbitStore.getState();
      if (upbitStore.chartTimeRange) {
        chart.timeScale().setVisibleRange(upbitStore.chartTimeRange);
      }

      // 차트 시간 범위 변경 시 이벤트
      chart.timeScale().subscribeVisibleTimeRangeChange((range) => {
        if (range) {
          // 시간 범위를 스토어에 저장하여 다른 차트와 동기화
          useUpbitStore.setState({ chartTimeRange: range });
        }
      });

      // 왼쪽 스케일(MACD, RSI, 스토캐스틱)의 가시 범위 설정
      chart.priceScale('left').applyOptions({
        autoScale: false,
        scaleMargins: {
          top: 0.1,
          bottom: 0.4,
        }
      });
    }

    // 창 크기 조절 시 차트 크기 조정
    const handleResize = () => {
      if (chartRef.current && chartContainerRef.current) {
        chartRef.current.applyOptions({
          width: chartContainerRef.current.clientWidth,
        });
      }
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (chartRef.current) {
        chartRef.current.remove();
      }
    };
  }, [data, height]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', width: '100%', height: '100%' }}>
      <div ref={chartContainerRef} style={{ width: '100%', height: `${height}px` }} />
    </div>
  );
};

export default MACDChart; 