import React, { useEffect, useRef, useState } from 'react';
import { createChart, IChartApi, ISeriesApi, Time } from 'lightweight-charts';
import { CandlestickData, BacktestResult, Trade } from '../types/candlestick';
import { MASettings } from '../components/CandlestickChartTypes';
import useUpbitStore from '../store/useUpbitStore';
import BacktestResults from './BacktestResults';

interface PolMACDChartProps {
  data: CandlestickData[];
  height?: number;
  showMA?: MASettings;
  onBacktestResultChange?: (result: BacktestResult | null) => void;
}

const PolMACDChart: React.FC<PolMACDChartProps> = ({ data, height = 400, showMA, onBacktestResultChange }) => {
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
  
  // 백테스트 결과 상태
  const [backtestResult, setBacktestResult] = useState<BacktestResult | null>(null);
  const [showBacktestResults, setShowBacktestResults] = useState(false);

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
  const calculateMACD = (data: CandlestickData[]) => {
    if (!data || data.length === 0) return { macdData: [], signalData: [], histogramData: [] };

    const closePrices = data.map(item => item.close);
    const ema5Values: number[] = [];
    const ema20Values: number[] = [];
    const ema12Values: number[] = [];
    const ema26Values: number[] = [];
    const macdValues: number[] = [];
    const signalValues: number[] = [];
    const histogramValues: number[] = [];

    // EMA 5 계산
    let multiplier5 = 2 / (5 + 1);
    let ema5 = closePrices[0];
    ema5Values.push(ema5);

    for (let i = 1; i < closePrices.length; i++) {
      ema5 = (closePrices[i] - ema5) * multiplier5 + ema5;
      ema5Values.push(ema5);
    }

    // EMA 20 계산
    let multiplier20 = 2 / (20 + 1);
    let ema20 = closePrices[0];
    ema20Values.push(ema20);

    for (let i = 1; i < closePrices.length; i++) {
      ema20 = (closePrices[i] - ema20) * multiplier20 + ema20;
      ema20Values.push(ema20);
    }

    // EMA 12 계산
    let multiplier12 = 2 / (12 + 1);
    let ema12 = closePrices[0];
    ema12Values.push(ema12);

    for (let i = 1; i < closePrices.length; i++) {
      ema12 = (closePrices[i] - ema12) * multiplier12 + ema12;
      ema12Values.push(ema12);
    }

    // EMA 26 계산
    let multiplier26 = 2 / (26 + 1);
    let ema26 = closePrices[0];
    ema26Values.push(ema26);

    for (let i = 1; i < closePrices.length; i++) {
      ema26 = (closePrices[i] - ema26) * multiplier26 + ema26;
      ema26Values.push(ema26);
    }

    // MACD 라인 계산: EMA12 - EMA26
    for (let i = 0; i < ema12Values.length; i++) {
      const macd = ema12Values[i] - ema26Values[i];
      macdValues.push(macd);
    }

    // Signal 라인 계산: MACD의 9일 EMA
    let multiplier9 = 2 / (9 + 1);
    let signal = macdValues[0];
    signalValues.push(signal);

    for (let i = 1; i < macdValues.length; i++) {
      signal = (macdValues[i] - signal) * multiplier9 + signal;
      signalValues.push(signal);
    }

    // Histogram 계산: MACD - Signal
    for (let i = 0; i < macdValues.length; i++) {
      const histogram = macdValues[i] - signalValues[i];
      histogramValues.push(histogram);
    }

    // 매수/매도 신호 생성
    const type: ('buy' | 'sell' | null)[] = [];
    let lastSignal: 'buy' | 'sell' | null = null;

    for (let i = 30; i < data.length; i++) {
      // 초기 데이터는 건너뜀 (EMA가 안정화되도록)
      if (i < 30) {
        type.push(null);
        continue;
      }

      // 5EMA가 20EMA 상향돌파 (매수 신호)
      if (ema5Values[i - 1] <= ema20Values[i - 1] && ema5Values[i] > ema20Values[i] && (lastSignal === null || lastSignal === 'sell')) {
        type.push('buy');
        lastSignal = 'buy';
      }
      // 5EMA가 20EMA 하향돌파 (매도 신호)
      else if (ema5Values[i - 1] >= ema20Values[i - 1] && ema5Values[i] < ema20Values[i] && lastSignal === 'buy') {
        type.push('sell');
        lastSignal = 'sell';
      } else {
        type.push(null);
      }
    }

    // 부족한 배열 길이 채우기
    while (type.length < data.length) {
      type.unshift(null);
    }

    // 매수/매도 신호에 대한 백테스트 계산
    calculateBacktestResult(data, type);

    const macdData = data.map((item, index) => ({
      time: item.time,
      value: macdValues[index] || 0,
    }));

    const signalData = data.map((item, index) => ({
      time: item.time,
      value: signalValues[index] || 0,
    }));

    const histogramData = data.map((item, index) => ({
      time: item.time,
      value: histogramValues[index] || 0,
      color: histogramValues[index] >= 0 ? 'rgba(0, 150, 136, 0.8)' : 'rgba(255, 82, 82, 0.8)',
    }));

    const ema5Data = data.map((item, index) => ({
      time: item.time,
      value: ema5Values[index] || 0,
    }));

    const ema20Data = data.map((item, index) => ({
      time: item.time,
      value: ema20Values[index] || 0,
    }));

    // 마커 생성
    const markers = data.map((candle, index) => {
      if (type[index] === 'buy') {
        return {
          time: candle.time,
          position: 'belowBar',
          color: '#0000FF',
          shape: 'arrowUp',
          text: '매수 신호',
          size: 3,
        };
      } else if (type[index] === 'sell') {
        return {
          time: candle.time,
          position: 'aboveBar',
          color: '#FF0000',
          shape: 'arrowDown',
          text: '매도 신호',
          size: 3,
        };
      }
      return null;
    }).filter(marker => marker !== null);

    console.log('Markers:', markers, markers ? markers.length : 0);

    return {
      macdData,
      signalData,
      histogramData,
      markers,
      ema5Data,
      ema20Data
    };
  };

  // 백테스트 결과 계산 함수
  const calculateBacktestResult = (data: CandlestickData[], signals: (string | null)[]) => {
    if (!data || data.length === 0) return;

    const trades: Trade[] = [];
    let totalValue = 10000000; // 초기 자금 1천만원
    let maxValue = totalValue;
    let minValue = totalValue;
    let inPosition = false;
    let entryPrice = 0;
    let entryTime: Time | null = null;
    let exitPrice = 0;
    let exitTime: Time | null = null;
    let buyQuantity = 0;

    // 각 캔들에 대해 거래 시뮬레이션 수행
    for (let i = 0; i < data.length; i++) {
      const candle = data[i];
      const signal = signals[i];

      if (signal === 'buy' && !inPosition) {
        // 매수 신호
        entryPrice = candle.close;
        entryTime = candle.time;
        buyQuantity = Math.floor(totalValue / entryPrice);
        inPosition = true;
      } else if (signal === 'sell' && inPosition && entryTime !== null) {
        // 매도 신호
        exitPrice = candle.close;
        exitTime = candle.time;
        
        // 거래 기록 저장
        const returnValue = (exitPrice / entryPrice) - 1;
        
        trades.push({
          entryTime,
          entryPrice,
          exitTime,
          exitPrice,
          return: returnValue,
          isSuccess: returnValue > 0,
          mode: 'test'
        });
        
        // 잔고 업데이트
        totalValue = totalValue * (1 + returnValue);
        if (totalValue > maxValue) maxValue = totalValue;
        if (totalValue < minValue) minValue = totalValue;
        
        // 포지션 리셋
        inPosition = false;
        entryPrice = 0;
        entryTime = null;
        exitPrice = 0;
        exitTime = null;
      }
    }
    
    // 마지막 포지션이 닫히지 않은 경우 처리
    if (inPosition && entryTime !== null) {
      const lastCandle = data[data.length - 1];
      exitPrice = lastCandle.close;
      exitTime = lastCandle.time;
      
      const returnValue = (exitPrice / entryPrice) - 1;
      
      trades.push({
        entryTime,
        entryPrice,
        exitTime,
        exitPrice,
        return: returnValue,
        isSuccess: returnValue > 0,
        mode: 'test'
      });
      
      totalValue = totalValue * (1 + returnValue);
    }
    
    // 시간 순으로 거래 정렬
    const sortedTrades = [...trades].sort((a, b) => {
      const timeA = typeof a.entryTime === 'number' ? a.entryTime : 
                    typeof a.entryTime === 'string' ? new Date(a.entryTime).getTime() / 1000 : 0;
      const timeB = typeof b.entryTime === 'number' ? b.entryTime : 
                    typeof b.entryTime === 'string' ? new Date(b.entryTime).getTime() / 1000 : 0;
      return timeA - timeB;
    });
    
    // 승률 계산
    const winningTrades = sortedTrades.filter(trade => trade.return > 0);
    const feeRate = 0.0005; // 0.05% 수수료
    const totalReturn = (totalValue / 10000000) - 1;
    const totalNetReturn = totalReturn - (sortedTrades.length * feeRate * 2); // 매수, 매도 수수료 고려
    
    const result: BacktestResult = {
      totalTrades: sortedTrades.length,
      successfulTrades: winningTrades.length,
      totalReturn: totalReturn,
      totalNetReturn: totalNetReturn,
      successRate: sortedTrades.length > 0 ? (winningTrades.length / sortedTrades.length) * 100 : 0,
      averageReturn: sortedTrades.length > 0 ? totalReturn / sortedTrades.length : 0,
      averageNetReturn: sortedTrades.length > 0 ? totalNetReturn / sortedTrades.length : 0,
      trades: sortedTrades
    };
    
    console.log('백테스트 계산 완료:', result.trades.length, '개 거래 발견');
    
    setBacktestResult(result);
    
    // 부모 컴포넌트에 백테스트 결과 전달
    if (onBacktestResultChange) {
      onBacktestResultChange(result);
    }
  };

  // EMA 계산 함수
  const calculateEMA = (data: CandlestickData[], period: number) => {
    // 데이터가 충분하지 않으면 빈 배열 반환
    if (data.length < period) {
      console.log(`${period}MA 업데이트 건너뜀: 데이터 부족 (필요: ${period}, 현재: ${data.length})`);
      return [];
    }
    
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
    if (data.length === 0 || !chartContainerRef.current) return;

    const { macdData, signalData, histogramData, markers, ema5Data, ema20Data } = calculateMACD(data);
    const stochasticData = calculateStochastic(data);

    // 새로운 차트 생성
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
      rightPriceScale: {
        borderColor: '#d1d4dc',
      },
      timeScale: {
        borderColor: '#d1d4dc',
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

    const candleSeries = chart.addCandlestickSeries({
      upColor: '#4CAF50',
      downColor: '#F44336',
      borderVisible: false,
      wickUpColor: '#4CAF50',
      wickDownColor: '#F44336',
    });

    candleSeries.setData(data);
    candleRef.current = candleSeries;

    // MACD 표시
    const macdSeries = chart.addLineSeries({
      color: '#2962FF',
      lineWidth: 2,
      priceScaleId: 'macd',
    });

    const signalSeries = chart.addLineSeries({
      color: '#FF6D00',
      lineWidth: 2,
      priceScaleId: 'macd',
    });

    const histogramSeries = chart.addHistogramSeries({
      priceScaleId: 'macd',
    });

    macdSeries.setData(macdData);
    signalSeries.setData(signalData);
    histogramSeries.setData(histogramData);

    macdRef.current = macdSeries;
    signalRef.current = signalSeries;
    histogramRef.current = histogramSeries;

    // EMA 5, 20 표시
    const ema5Series = chart.addLineSeries({
      color: '#1E88E5',
      lineWidth: 2,
    });

    const ema20Series = chart.addLineSeries({
      color: '#D81B60',
      lineWidth: 2,
    });

    if (ema5Data && ema20Data) {
      ema5Series.setData(ema5Data);
      ema20Series.setData(ema20Data);
    }

    ema5Ref.current = ema5Series;
    ema20Ref.current = ema20Series;

    // 마커 표시
    if (markers && markers.length > 0) {
      const validMarkers = markers.map(marker => ({
        time: marker.time,
        position: marker.position as 'aboveBar' | 'belowBar',
        color: marker.color,
        shape: marker.shape as 'arrowUp' | 'arrowDown',
        text: marker.text,
        size: marker.size
      }));
      candleSeries.setMarkers(validMarkers);
    }

    // 차트 설정
    chart.applyOptions({
      // 차트 전체 설정
    });

    // 가격 스케일 생성
    chart.priceScale('macd').applyOptions({
      autoScale: true,
      scaleMargins: {
        top: 0.8, 
        bottom: 0,
      },
    });

    // 차트 시간 축 맞춤
    chart.timeScale().fitContent();

    chartRef.current = chart;

    // 업비트 스토어에서 다른 차트와 시간 동기화
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
      
      // 360MA 이상은 데이터가 충분한 경우에만 표시
      if (ema360Ref.current) {
        ema360Ref.current.applyOptions({ 
          visible: data.length >= 360 ? showMA.threeHundredSixty : false 
        });
      }
      
      if (ema600Ref.current) {
        ema600Ref.current.applyOptions({ 
          visible: data.length >= 600 ? showMA.sixHundred : false 
        });
      }
      
      if (ema900Ref.current) {
        ema900Ref.current.applyOptions({ 
          visible: data.length >= 900 ? showMA.nineHundred : false 
        });
      }
    }
  }, [showMA, data.length]);

  return (
    <div className="chart-wrapper">
      <div ref={chartContainerRef} style={{ width: '100%' }} />
      <div className="chart-controls" style={{ marginTop: '20px' }}>
        <button
          className="btn btn-primary"
          onClick={() => {
            console.log('백테스트 결과 버튼 클릭, 이전 상태:', showBacktestResults);
            setShowBacktestResults(!showBacktestResults);
          }}
        >
          {showBacktestResults ? '백테스트 결과 숨기기' : '백테스트 결과 보기'}
        </button>
      </div>
      
      {/* 디버깅용 정보 */}
      <div style={{ margin: '10px 0', fontSize: '12px', color: '#666' }}>
        <p>백테스트 결과 표시: {showBacktestResults ? 'true' : 'false'}</p>
        <p>백테스트 결과 존재: {backtestResult ? 'true' : 'false'}</p>
        {backtestResult && (
          <p>거래 수: {backtestResult.trades.length}</p>
        )}
      </div>
    </div>
  );
};

export default PolMACDChart; 