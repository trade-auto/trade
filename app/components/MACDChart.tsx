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

    // 히스토그램의 스케일 마진 설정 - 중앙 정렬 및 적정 스케일 조정
    chart.priceScale('right').applyOptions({
      scaleMargins: {
        top: 0.4, // 0.8에서 0.4로 변경하여 중앙에 위치하도록 조정
        bottom: 0.4, // 0에서 0.4로 변경하여 중앙에 위치하도록 조정
      },
      autoScale: true,
      mode: 0, // 0: 자동 스케일, 1: 백분율, 2: 대수 스케일
      // alignLabels: true,
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
      const macdData = calculateMACD(data);
      const stochData = calculateStochastic(data);

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

      // 마커를 시간 순서대로 정렬 (오름차순)
      allMarkers.sort((a, b) => {
        // 비즈니스 데이 타입 확인 함수
        const isBusinessDay = (time: any): time is { day: number; month: number; year: number } => {
          return typeof time === 'object' && 'day' in time && 'month' in time && 'year' in time;
        };
        
        // 숫자로 변환하는 함수
        const convertToTimestamp = (time: Time): number => {
          if (typeof time === 'number') {
            return time;
          } else if (isBusinessDay(time)) {
            // BusinessDay 형식 처리
            const date = new Date(time.year, time.month - 1, time.day);
            return date.getTime() / 1000;
          } else if (typeof time === 'string') {
            // ISO 문자열 형식 처리
            return new Date(time).getTime() / 1000;
          }
          // 기본값
          return 0;
        };
        
        return convertToTimestamp(a.time) - convertToTimestamp(b.time);
      });

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

      // MACD 값의 최대값 및 최소값 찾기
      let maxMacd = Math.max(...macdData.macdData.map(d => Math.max(d.macd, d.signal)));
      let minMacd = Math.min(...macdData.macdData.map(d => Math.min(d.macd, d.signal)));
      let macdRange = Math.max(Math.abs(maxMacd), Math.abs(minMacd));
      
      // +/-10% 및 +/-30% 라인 데이터 생성
      const plusTenPercentValue = macdRange * 0.1;
      const minusTenPercentValue = -macdRange * 0.1;
      const plusThirtyPercentValue = macdRange * 0.3;
      const minusThirtyPercentValue = -macdRange * 0.3;
      const plusFortyPercentValue = macdRange * 0.4;
      const minusFortyPercentValue = -macdRange * 0.4;
      const plusFiftyPercentValue = macdRange * 0.5;
      const minusFiftyPercentValue = -macdRange * 0.5;
      
      const tenPercentLineRef = chart.addLineSeries({
        color: '#4CAF50',
        lineWidth: 2,
        lineStyle: 0,
        title: '+10% 수준',
        lastValueVisible: true,
        priceLineVisible: true,
        priceLineWidth: 2,
        priceLineColor: '#4CAF50',
        priceFormat: {
          type: 'price',
          precision: 2,
          minMove: 0.01,
        }
      });
      
      // +30% 라인 추가
      const thirtyPercentLineRef = chart.addLineSeries({
        color: '#008800',
        lineWidth: 2,
        lineStyle: 0,
        title: '+30% 수준',
        lastValueVisible: true,
        priceLineVisible: true,
        priceLineWidth: 2,
        priceLineColor: '#008800',
        priceFormat: {
          type: 'price',
          precision: 2,
          minMove: 0.01,
        }
      });
      
      // +40% 라인 추가
      const fortyPercentLineRef = chart.addLineSeries({
        color: '#006600',
        lineWidth: 2,
        lineStyle: 0,
        title: '+40% 수준',
        lastValueVisible: true,
        priceLineVisible: true,
        priceLineWidth: 2,
        priceLineColor: '#006600',
        priceFormat: {
          type: 'price',
          precision: 2,
          minMove: 0.01,
        }
      });
      
      // +50% 라인 추가
      const fiftyPercentLineRef = chart.addLineSeries({
        color: '#004400',
        lineWidth: 2,
        lineStyle: 0,
        title: '+50% 수준',
        lastValueVisible: true,
        priceLineVisible: true,
        priceLineWidth: 2,
        priceLineColor: '#004400',
        priceFormat: {
          type: 'price',
          precision: 2,
          minMove: 0.01,
        }
      });
      
      const minusTenPercentLineRef = chart.addLineSeries({
        color: '#FF5252',
        lineWidth: 2,
        lineStyle: 0,
        title: '-10% 수준',
        lastValueVisible: true,
        priceLineVisible: true,
        priceLineWidth: 2,
        priceLineColor: '#FF5252',
        priceFormat: {
          type: 'price',
          precision: 2,
          minMove: 0.01,
        }
      });
      
      // -30% 라인 추가
      const minusThirtyPercentLineRef = chart.addLineSeries({
        color: '#AA0000',
        lineWidth: 2,
        lineStyle: 0,
        title: '-30% 수준',
        lastValueVisible: true,
        priceLineVisible: true,
        priceLineWidth: 2,
        priceLineColor: '#AA0000',
        priceFormat: {
          type: 'price',
          precision: 2,
          minMove: 0.01,
        }
      });
      
      // -40% 라인 추가
      const minusFortyPercentLineRef = chart.addLineSeries({
        color: '#880000',
        lineWidth: 2,
        lineStyle: 0,
        title: '-40% 수준',
        lastValueVisible: true,
        priceLineVisible: true,
        priceLineWidth: 2,
        priceLineColor: '#880000',
        priceFormat: {
          type: 'price',
          precision: 2,
          minMove: 0.01,
        }
      });
      
      // -50% 라인 추가
      const minusFiftyPercentLineRef = chart.addLineSeries({
        color: '#660000',
        lineWidth: 2,
        lineStyle: 0,
        title: '-50% 수준',
        lastValueVisible: true,
        priceLineVisible: true,
        priceLineWidth: 2,
        priceLineColor: '#660000',
        priceFormat: {
          type: 'price',
          precision: 2,
          minMove: 0.01,
        }
      });
      
      const zeroLineRef = chart.addLineSeries({
        color: '#888888',
        lineWidth: 1,
        lineStyle: 2,
        title: '0 라인',
        lastValueVisible: true,
        priceLineVisible: true,
        priceLineWidth: 1,
        priceLineColor: '#888888',
        priceFormat: {
          type: 'price',
          precision: 2,
          minMove: 0.01,
        }
      });
      
      // +/-10%, +/-30% 및 0 라인 데이터 설정
      const plusTenPercentData = [
        { time: timeRange.from, value: plusTenPercentValue },
        { time: timeRange.to, value: plusTenPercentValue },
      ];
      
      const plusThirtyPercentData = [
        { time: timeRange.from, value: plusThirtyPercentValue },
        { time: timeRange.to, value: plusThirtyPercentValue },
      ];
      
      const plusFortyPercentData = [
        { time: timeRange.from, value: plusFortyPercentValue },
        { time: timeRange.to, value: plusFortyPercentValue },
      ];
      
      const plusFiftyPercentData = [
        { time: timeRange.from, value: plusFiftyPercentValue },
        { time: timeRange.to, value: plusFiftyPercentValue },
      ];
      
      const minusTenPercentData = [
        { time: timeRange.from, value: minusTenPercentValue },
        { time: timeRange.to, value: minusTenPercentValue },
      ];
      
      const minusThirtyPercentData = [
        { time: timeRange.from, value: minusThirtyPercentValue },
        { time: timeRange.to, value: minusThirtyPercentValue },
      ];
      
      const minusFortyPercentData = [
        { time: timeRange.from, value: minusFortyPercentValue },
        { time: timeRange.to, value: minusFortyPercentValue },
      ];
      
      const minusFiftyPercentData = [
        { time: timeRange.from, value: minusFiftyPercentValue },
        { time: timeRange.to, value: minusFiftyPercentValue },
      ];
      
      const zeroLineData = [
        { time: timeRange.from, value: 0 },
        { time: timeRange.to, value: 0 },
      ];
      
      tenPercentLineRef.setData(plusTenPercentData);
      thirtyPercentLineRef.setData(plusThirtyPercentData);
      fortyPercentLineRef.setData(plusFortyPercentData);
      fiftyPercentLineRef.setData(plusFiftyPercentData);
      minusTenPercentLineRef.setData(minusTenPercentData);
      minusThirtyPercentLineRef.setData(minusThirtyPercentData);
      minusFortyPercentLineRef.setData(minusFortyPercentData);
      minusFiftyPercentLineRef.setData(minusFiftyPercentData);
      zeroLineRef.setData(zeroLineData);

      // 라인에 레이블 추가
      const midTime = timeRange.from;
      const labelOptions = {
        shape: 'circle' as const,
        color: '#4CAF50',
        text: '+10%',
        size: 1
      };

      const labelOptions2 = {
        shape: 'circle' as const,
        color: '#FF5252',
        text: '-10%',
        size: 1
      };

      const labelOptions3 = {
        shape: 'circle' as const,
        color: '#888888',
        text: '0',
        size: 1
      };

      const labelOptions4 = {
        shape: 'circle' as const,
        color: '#008800',
        text: '+30%',
        size: 1
      };

      const labelOptions5 = {
        shape: 'circle' as const,
        color: '#AA0000',
        text: '-30%',
        size: 1
      };

      const labelOptions6 = {
        shape: 'circle' as const,
        color: '#006600',
        text: '+40%',
        size: 1
      };

      const labelOptions7 = {
        shape: 'circle' as const,
        color: '#004400',
        text: '+50%',
        size: 1
      };

      const labelOptions8 = {
        shape: 'circle' as const,
        color: '#880000',
        text: '-40%',
        size: 1
      };

      const labelOptions9 = {
        shape: 'circle' as const,
        color: '#660000',
        text: '-50%',
        size: 1
      };

      // MACD 라인에 레이블 마커 추가
      macdRef.current?.setMarkers([
        { time: midTime, position: 'aboveBar', ...labelOptions },
        { time: midTime, position: 'belowBar', ...labelOptions2 },
        { time: midTime, position: 'inBar', ...labelOptions3 },
        { time: midTime, position: 'aboveBar', ...labelOptions4 },
        { time: midTime, position: 'belowBar', ...labelOptions5 },
        { time: midTime, position: 'aboveBar', ...labelOptions6 },
        { time: midTime, position: 'aboveBar', ...labelOptions7 },
        { time: midTime, position: 'belowBar', ...labelOptions8 },
        { time: midTime, position: 'belowBar', ...labelOptions9 }
      ]);

      if (macdRef.current) macdRef.current.setData(macdLine);
      if (signalRef.current) signalRef.current.setData(signalLine);
      if (histogramRef.current) histogramRef.current.setData(histogram);
      if (markerSeriesRef.current) markerSeriesRef.current.setMarkers(allMarkers);
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

      // MACD 차트 고정 스케일 설정 (센터를 중심으로 +/-에 값을 표시)
      chart.priceScale('right').applyOptions({
        autoScale: false,
        scaleMargins: {
          top: 0.4,
          bottom: 0.4,
        }
      });
      
      // 최대/최소값 기준으로 차트 범위 조정 (좌우 대칭으로)
      const symmetricRange = Math.max(Math.abs(maxMacd), Math.abs(minMacd)) * 1.5;
      
      // 가시 영역 조정
      chart.applyOptions({
        rightPriceScale: {
          visible: true,
          autoScale: false
        }
      });
      
      // 수동으로 최대/최소값 사이에 가시 영역 설정
      macdRef.current?.applyOptions({
        autoscaleInfoProvider: () => ({
          priceRange: {
            minValue: -symmetricRange,
            maxValue: symmetricRange
          },
          margins: {
            above: 20,
            below: 20
          }
        })
      });
      
      signalRef.current?.applyOptions({
        autoscaleInfoProvider: () => ({
          priceRange: {
            minValue: -symmetricRange,
            maxValue: symmetricRange
          },
          margins: {
            above: 20,
            below: 20
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