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
  showIchimoku?: boolean; // 일목균형표 표시 여부
}

const PolMACDChart: React.FC<PolMACDChartProps> = ({ data, height = 400, showMA, onBacktestResultChange, showIchimoku = false }) => {
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
  // 일목균형표 라인 레퍼런스 추가
  const tenkanRef = useRef<ISeriesApi<'Line'> | null>(null);
  const kijunRef = useRef<ISeriesApi<'Line'> | null>(null);
  const chikouRef = useRef<ISeriesApi<'Line'> | null>(null);
  const senkouSpanARef = useRef<ISeriesApi<'Line'> | null>(null);
  const senkouSpanBRef = useRef<ISeriesApi<'Line'> | null>(null);
  
  // 백테스트 결과 상태
  const [backtestResult, setBacktestResult] = useState<BacktestResult | null>(null);
  const [showBacktestResults, setShowBacktestResults] = useState(false);

  // 일목균형표 계산 함수
  const calculateIchimoku = (data: CandlestickData[]) => {
    if (data.length < 52) {
      console.log('Data insufficient for Ichimoku calculation (required: 52, current:', data.length, ')');
      return {
        tenkanSen: [],
        kijunSen: [],
        chikouSpan: [],
        senkouSpanA: [],
        senkouSpanB: []
      };
    }

    const tenkanSen: { time: Time, value: number }[] = [];
    const kijunSen: { time: Time, value: number }[] = [];
    const chikouSpan: { time: Time, value: number }[] = [];
    const senkouSpanA: { time: Time, value: number }[] = [];
    const senkouSpanB: { time: Time, value: number }[] = [];

    // Tenkan-sen: (highest high + lowest low) / 2 for 9 periods
    for (let i = 8; i < data.length; i++) {
      const period = data.slice(i - 8, i + 1);
      const highest = Math.max(...period.map(d => d.high));
      const lowest = Math.min(...period.map(d => d.low));
      tenkanSen.push({
        time: data[i].time,
        value: (highest + lowest) / 2
      });
    }

    // Kijun-sen: (highest high + lowest low) / 2 for 26 periods
    for (let i = 25; i < data.length; i++) {
      const period = data.slice(i - 25, i + 1);
      const highest = Math.max(...period.map(d => d.high));
      const lowest = Math.min(...period.map(d => d.low));
      kijunSen.push({
        time: data[i].time,
        value: (highest + lowest) / 2
      });
    }

    // Chikou Span: Current closing price plotted 26 periods behind
    for (let i = 0; i < data.length - 26; i++) {
      chikouSpan.push({
        time: data[i].time,
        value: data[i + 26].close
      });
    }

    // Senkou Span A: (Tenkan-sen + Kijun-sen) / 2 plotted 26 periods ahead
    const offset = Math.max(25, 8); // Starting from the index where both lines are available
    
    for (let i = 0; i < data.length - offset - 26; i++) {
      const currentIndex = i + offset;
      const tenkanValue = (data.slice(currentIndex - 8, currentIndex + 1).reduce((max, candle) => Math.max(max, candle.high), -Infinity) + 
                           data.slice(currentIndex - 8, currentIndex + 1).reduce((min, candle) => Math.min(min, candle.low), Infinity)) / 2;
      
      const kijunValue = (data.slice(currentIndex - 25, currentIndex + 1).reduce((max, candle) => Math.max(max, candle.high), -Infinity) + 
                          data.slice(currentIndex - 25, currentIndex + 1).reduce((min, candle) => Math.min(min, candle.low), Infinity)) / 2;
      
      if (i + offset + 26 < data.length) {
        senkouSpanA.push({
          time: data[i + offset + 26].time,
          value: (tenkanValue + kijunValue) / 2
        });
      }
    }

    // Senkou Span B: (highest high + lowest low) / 2 for 52 periods plotted 26 periods ahead
    for (let i = 51; i < data.length - 26; i++) {
      const period = data.slice(i - 51, i + 1);
      const highest = Math.max(...period.map(d => d.high));
      const lowest = Math.min(...period.map(d => d.low));
      
      if (i + 26 < data.length) {
        senkouSpanB.push({
          time: data[i + 26].time,
          value: (highest + lowest) / 2
        });
      }
    }

    return {
      tenkanSen,
      kijunSen,
      chikouSpan,
      senkouSpanA,
      senkouSpanB
    };
  };

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

  // RSI 계산 함수
  const calculateRSI = (data: CandlestickData[], period = 14) => {
    if (!data || data.length === 0 || data.length <= period) {
      return [];
    }

    const closePrices = data.map(item => item.close);
    const gains: number[] = [];
    const losses: number[] = [];
    
    // 첫 번째 변화량은 계산할 수 없으므로 0으로 설정
    gains.push(0);
    losses.push(0);
    
    // 각 기간의 가격 변화에 따른 상승/하락 값 계산
    for (let i = 1; i < closePrices.length; i++) {
      const change = closePrices[i] - closePrices[i - 1];
      gains.push(change > 0 ? change : 0);
      losses.push(change < 0 ? Math.abs(change) : 0);
    }
    
    // 첫 번째 평균 계산
    let avgGain = gains.slice(1, period + 1).reduce((sum, gain) => sum + gain, 0) / period;
    let avgLoss = losses.slice(1, period + 1).reduce((sum, loss) => sum + loss, 0) / period;
    
    const rsiValues: { time: Time, value: number }[] = [];
    
    // 첫 번째 RSI 값 계산
    let rs = avgGain / (avgLoss === 0 ? 0.001 : avgLoss); // 0으로 나누기 방지
    let rsi = 100 - (100 / (1 + rs));
    
    rsiValues.push({ 
      time: data[period].time, 
      value: rsi 
    });
    
    // 나머지 RSI 값 계산 (평활화된 방식)
    for (let i = period + 1; i < data.length; i++) {
      avgGain = ((avgGain * (period - 1)) + gains[i]) / period;
      avgLoss = ((avgLoss * (period - 1)) + losses[i]) / period;
      
      rs = avgGain / (avgLoss === 0 ? 0.001 : avgLoss);
      rsi = 100 - (100 / (1 + rs));
      
      rsiValues.push({ 
        time: data[i].time, 
        value: rsi 
      });
    }
    
    return rsiValues;
  };

  // MACD 계산 함수
  const calculateMACD = (data: CandlestickData[]) => {
    if (!data || data.length === 0) return { macdData: [], signalData: [], histogramData: [] };

    const closePrices = data.map(item => item.close);
    const ema5Values: number[] = [];
    const ema20Values: number[] = [];
    const ema12Values: number[] = [];
    const ema23Values: number[] = [];
    const ema25Values: number[] = [];
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
    let multiplier23 = 2 / (23 + 1);
    let ema23 = closePrices[0];
    ema23Values.push(ema23);

    for (let i = 1; i < closePrices.length; i++) {
      ema23 = (closePrices[i] - ema23) * multiplier23 + ema23;
      ema23Values.push(ema23);
    }

    // EMA 25 계산
    let multiplier25 = 2 / (25 + 1);
    let ema25 = closePrices[0];
    ema25Values.push(ema25);

    for (let i = 1; i < closePrices.length; i++) {
      ema25 = (closePrices[i] - ema25) * multiplier25 + ema25;
      ema25Values.push(ema25);
    }

    // MACD 라인 계산: EMA23 - EMA25
    for (let i = 0; i < ema23Values.length; i++) {
      const macd = ema23Values[i] - ema25Values[i];
      macdValues.push(macd);
    }

    // Signal 라인 계산: MACD의 12일 EMA
    let multiplier12 = 2 / (11 + 1);
    let signal = macdValues[0];
    signalValues.push(signal);

    for (let i = 1; i < macdValues.length; i++) {
      signal = (macdValues[i] - signal) * multiplier12 + signal;
      signalValues.push(signal);
    }

    // Histogram 계산: MACD - Signal
    for (let i = 0; i < macdValues.length; i++) {
      const histogram = macdValues[i] - signalValues[i];
      histogramValues.push(histogram);
    }

    // MACD 값의 최대값 및 최소값 찾기
    let maxMacd = Math.max(...macdValues);
    let minMacd = Math.min(...macdValues);
    let macdRange = Math.max(Math.abs(maxMacd), Math.abs(minMacd));
    
    // +20%/-10% 레벨 계산
    const plusTwentyPercent = macdRange * 0.15;
    const minusTenPercent = -macdRange * 0.08;

    // 매수/매도 신호 생성
    const type: ('buy' | 'sell' | null)[] = [];
    let lastSignal: 'buy' | 'sell' | null = null;

    for (let i = 30; i < data.length; i++) {
      // 초기 데이터는 건너뜀 (EMA가 안정화되도록)
      if (i < 30) {
        type.push(null);
        continue;
      }

      const currentMacd = macdValues[i];
      const prevMacd = macdValues[i - 1];
      const currentSignal = signalValues[i];
      const prevSignal = signalValues[i - 1];

      // MACD가 +/-10% 범위 이내인지 확인
      const isWithinTenPercent = Math.abs(currentMacd) <= minusTenPercent;

      // MACD가 10% 범위 이내면 신호 생성하지 않음
      if (isWithinTenPercent) {
        type.push(null);
        continue;
      }

      // RSI 계산 - 14 기간으로 계산
      const rsiValues = calculateRSI(data.slice(0, i+1));
      const currentRSI = rsiValues.length > 0 ? rsiValues[rsiValues.length - 1].value : 0;
      
      // 20EMA와 30EMA 상승 여부 확인
      const ema20Rising = ema20Values[i] > ema20Values[i - 1];
      const ema30Data = calculateEMA(data.slice(0, i+1), 30);
      const ema30Rising = ema30Data.length >= 2 && 
                          ema30Data[ema30Data.length - 1].value > ema30Data[ema30Data.length - 2].value;

      // RSI 과매수 조건 (80% 이상)과 EMA 상승 조건
      const isRsiOverboughtWithRisingEMAs = currentRSI >= 80 ;//&& ema20Rising && ema30Rising;

      // 기존 MACD 기반 매수 신호 조건
      const isMacdBuySignal = currentMacd <= minusTenPercent && 
                            (
                              (prevMacd <= prevSignal && currentMacd > currentSignal) || // MACD가 신호선 상향돌파
                              (ema5Values[i - 1] <= ema20Values[i - 1] && ema5Values[i] > ema20Values[i]) // EMA 크로스
                            ) && 
                            ema20Values[i] > ema20Values[i - 1] && // 20EMA 상승 확인
                           ema20Values[i] > calculateEMA(data.slice(0, i+1), 30)[calculateEMA(data.slice(0, i+1), 30).length-1].value && // 20EMA > 30EMA (정배열 확인)
                            (lastSignal === null || lastSignal === 'sell')  ;

      // 기존 조건 또는 RSI 조건으로 매수 신호 생성
      if (isMacdBuySignal || isRsiOverboughtWithRisingEMAs) {
        type.push('buy');
        lastSignal = 'buy';
      }
      // 매도 신호 조건:
      // 1. MACD가 신호선을 하향돌파할 때
      // 2. 이전에 매수 신호가 있었을 때
      // 3. 20EMA가 30EMA보다 작을 때(역배열 상태)만 매도 - 정배열일 경우 매도하지 않음
      else if (currentMacd >= plusTwentyPercent && 
        prevMacd > prevSignal && currentMacd <= currentSignal 
        && ema20Values[i] < ema20Values[i - 1] && //20EMA 하락중
              // 20EMA와 30EMA의 배열 확인 - 역배열 상태일 때만 매도
              ema20Values[i] < calculateEMA(data.slice(0, i+1), 30)[calculateEMA(data.slice(0, i+1), 30).length-1].value &&
              lastSignal === 'buy') {
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
    let currentTrade: Partial<Trade> | null = null;

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
        
        // 새로운 거래 시작
        currentTrade = {
          entryTime,
          entryPrice,
          mode: 'test',
          status: 'open'  // 거래 상태 추가
        };
        trades.push(currentTrade as Trade);
      } else if (signal === 'sell' && inPosition && entryTime !== null && currentTrade) {
        // 매도 신호로만 청산
        exitPrice = candle.close;
        exitTime = candle.time;
        
        // 거래 기록 업데이트
        const returnValue = (exitPrice / entryPrice) - 1;
        
        currentTrade.exitTime = exitTime;
        currentTrade.exitPrice = exitPrice;
        currentTrade.return = returnValue;
        currentTrade.isSuccess = returnValue > 0;
        currentTrade.status = 'closed';  // 거래 상태 업데이트
        
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
        currentTrade = null;
      }
    }
    
    // 마지막 포지션이 있다면 유지 (강제 청산하지 않음)
    
    // 시간 순으로 거래 정렬
    const sortedTrades = [...trades].sort((a, b) => {
      const timeA = typeof a.entryTime === 'number' ? a.entryTime : 
                    typeof a.entryTime === 'string' ? new Date(a.entryTime).getTime() / 1000 : 0;
      const timeB = typeof b.entryTime === 'number' ? b.entryTime : 
                    typeof b.entryTime === 'string' ? new Date(b.entryTime).getTime() / 1000 : 0;
      return timeA - timeB;
    });
    
    // 승률 계산 (종료된 거래만 계산)
    const closedTrades = sortedTrades.filter(trade => trade.status === 'closed');
    const winningTrades = closedTrades.filter(trade => (trade.return ?? 0) > 0);
    const feeRate = 0.0005; // 0.05% 수수료
    const totalReturn = (totalValue / 10000000) - 1;
    const totalNetReturn = totalReturn - (closedTrades.length * feeRate * 2); // 매수, 매도 수수료 고려
    
    const result: BacktestResult = {
      totalTrades: sortedTrades.length,
      successfulTrades: winningTrades.length,
      totalReturn: totalReturn,
      totalNetReturn: totalNetReturn,
      successRate: closedTrades.length > 0 ? (winningTrades.length / closedTrades.length) * 100 : 0,
      averageReturn: closedTrades.length > 0 ? totalReturn / closedTrades.length : 0,
      averageNetReturn: closedTrades.length > 0 ? totalNetReturn / closedTrades.length : 0,
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
    const ichimokuData = calculateIchimoku(data);
    const rsiData = calculateRSI(data);

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
        scaleMargins: {
          top: 0.1,
          bottom: 0.2,
        },
      },
      leftPriceScale: {
        visible: true,
        borderColor: '#d1d4dc',
        scaleMargins: {
          top: 0.1,
          bottom: 0.2,
        },
        borderVisible: true,
        ticksVisible: true,
        autoScale: true,
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
      handleScroll: true,
      handleScale: {
        axisPressedMouseMove: {
          time: true,
          price: true,
        },
        axisDoubleClickReset: true,
        mouseWheel: true,
        pinch: true,
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
      priceScaleId: 'left',  // 왼쪽 스케일 사용
      priceFormat: {
        type: 'price',
        precision: 2,
        minMove: 0.01,
      },
    });

    const signalSeries = chart.addLineSeries({
      color: '#FF6D00',
      lineWidth: 2,
      priceScaleId: 'left',  // 왼쪽 스케일 사용
      priceFormat: {
        type: 'price',
        precision: 2,
        minMove: 0.01,
      },
    });

    const histogramSeries = chart.addHistogramSeries({
      priceScaleId: 'left',  // 왼쪽 스케일 사용
      priceFormat: {
        type: 'price',
        precision: 2,
        minMove: 0.01,
      },
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
      title: '5 EMA'
    });

    const ema20Series = chart.addLineSeries({
      color: '#D81B60',
      lineWidth: 2,
      title: '20 EMA'
    });

    const ema30Series = chart.addLineSeries({
      color: '#FFB300',
      lineWidth: 2,
      title: '30 EMA'
    });

    const ema48Series = chart.addLineSeries({
      color: '#00C853',
      lineWidth: 2,
      title: '48 EMA'
    });

    // EMA 데이터 설정
    if (ema5Data && ema20Data) {
      ema5Series.setData(ema5Data);
      ema20Series.setData(ema20Data);
      
      // 30, 48 EMA 데이터 계산 및 설정
      const ema30Data = calculateEMA(data, 30);
      const ema48Data = calculateEMA(data, 48);
      
      if (ema30Data && ema48Data) {
        ema30Series.setData(ema30Data);
        ema48Series.setData(ema48Data);
      }
    }

    ema5Ref.current = ema5Series;
    ema20Ref.current = ema20Series;
    ema30Ref.current = ema30Series;
    ema48Ref.current = ema48Series;

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

    // 일목균형표 표시
    if (ichimokuData.tenkanSen.length > 0) {
      const tenkanSeries = chart.addLineSeries({
        color: '#FF0000', // 빨간색
        lineWidth: 2,
        title: '전환선',
        visible: showIchimoku, // 초기 가시성 설정
      });
      
      const kijunSeries = chart.addLineSeries({
        color: '#0000FF', // 파란색
        lineWidth: 2,
        title: '기준선',
        visible: showIchimoku, // 초기 가시성 설정
      });
      
      const chikouSeries = chart.addLineSeries({
        color: '#00FF00', // 초록색
        lineWidth: 2,
        title: '후행스팬',
        lineStyle: 3, // 점선으로 표시
        visible: showIchimoku, // 초기 가시성 설정
      });
      
      const senkouSpanASeries = chart.addLineSeries({
        color: '#FF6666', // 연한 빨강
        lineWidth: 2,
        title: '선행스팬A',
        visible: showIchimoku, // 초기 가시성 설정
      });
      
      const senkouSpanBSeries = chart.addLineSeries({
        color: '#6666FF', // 연한 파랑
        lineWidth: 2,
        title: '선행스팬B',
        visible: showIchimoku, // 초기 가시성 설정
      });
      
      // 구름대 영역 (클라우드) 추가
      // 주문구름(쿠모): 선행스팬A와 선행스팬B 사이의 영역
      // lightweight-charts는 영역 채우기를 직접 지원하지 않기 때문에 구름대 효과를 위해 면적 차트 사용
      
      // 양의 구름 (선행스팬A > 선행스팬B, 강세구간)
      const bullishCloudSeries = chart.addAreaSeries({
        topColor: 'rgba(76, 175, 80, 0.3)',    // 연한 초록색
        bottomColor: 'rgba(76, 175, 80, 0.05)',
        lineColor: 'rgba(76, 175, 80, 0.3)',
        lineWidth: 1,
        title: '강세구름',
        priceLineVisible: false,
        lastValueVisible: false,
        visible: showIchimoku, // 초기 가시성 설정
      });
      
      // 음의 구름 (선행스팬A < 선행스팬B, 약세구간)
      const bearishCloudSeries = chart.addAreaSeries({
        topColor: 'rgba(255, 82, 82, 0.3)',    // 연한 빨강색
        bottomColor: 'rgba(255, 82, 82, 0.05)',
        lineColor: 'rgba(255, 82, 82, 0.3)',
        lineWidth: 1,
        title: '약세구름',
        priceLineVisible: false,
        lastValueVisible: false,
        visible: showIchimoku, // 초기 가시성 설정
      });
      
      // Cloud area data creation
      const bullishCloud: { time: Time, value: number }[] = [];
      const bearishCloud: { time: Time, value: number }[] = [];
      
      // Check if Senkou Span A and Senkou Span B exist at the same time points
      const commonTimes = new Set();
      ichimokuData.senkouSpanA.forEach(item => commonTimes.add(item.time));
      
      const filteredSpanB = ichimokuData.senkouSpanB.filter(item => 
        commonTimes.has(item.time)
      );
      
      // 시간 값을 숫자로 변환하는 함수
      const getTimeAsNumber = (time: Time): number => {
        if (typeof time === 'number') return time;
        if (typeof time === 'string') return new Date(time).getTime();
        return 0;
      };
      
      // 타임스탬프를 'yyyy-mm-dd' 형식으로 변환하는 함수
      const formatTimeToYYYYMMDD = (time: Time): string | null => {
        let date: Date;
        
        try {
          if (typeof time === 'number') {
            // 초 단위인지 밀리초 단위인지 확인
            if (time < 10000000000) {
              date = new Date(time * 1000);
            } else {
              date = new Date(time);
            }
          } else if (typeof time === 'string') {
            date = new Date(time);
          } else {
            console.warn('유효하지 않은 시간 형식:', time);
            return null;
          }
          
          // 유효한 날짜인지 확인
          if (isNaN(date.getTime())) {
            console.warn('유효하지 않은 날짜가 생성됨:', time);
            return null;
          }
          
          const year = date.getFullYear();
          const month = String(date.getMonth() + 1).padStart(2, '0');
          const day = String(date.getDate()).padStart(2, '0');
          
          return `${year}-${month}-${day}`;
        } catch (error) {
          console.error('날짜 변환 오류:', error);
          return null;
        }
      };
      
      // 스팬 데이터 정렬
      const sortedSpanA = [...ichimokuData.senkouSpanA].sort((a, b) => {
        return getTimeAsNumber(a.time) - getTimeAsNumber(b.time);
      });
      
      const sortedSpanB = [...filteredSpanB].sort((a, b) => {
        return getTimeAsNumber(a.time) - getTimeAsNumber(b.time);
      });
      
      // Iterate based on the length of the shorter array
      const minLength = Math.min(sortedSpanA.length, sortedSpanB.length);
      
      for (let i = 0; i < minLength; i++) {
        const spanA = sortedSpanA[i];
        const spanB = sortedSpanB[i];
        
        // Check if times match
        if (getTimeAsNumber(spanA.time) !== getTimeAsNumber(spanB.time)) {
          console.log('Times do not match:', getTimeAsNumber(spanA.time), getTimeAsNumber(spanB.time));
          continue;
        }
        
        if (spanA.value >= spanB.value) {
          // Bullish zone (Senkou Span A >= Senkou Span B)
          const timeA = formatTimeToYYYYMMDD(spanA.time);
          const timeB = formatTimeToYYYYMMDD(spanB.time);
          
          if (timeA && timeB) { // 유효한 날짜 문자열인 경우에만 추가
            bullishCloud.push({
              time: timeA,
              value: spanA.value
            });
            
            bearishCloud.push({
              time: timeB,
              value: spanB.value
            });
          }
        } else {
          // Bearish zone (Senkou Span A < Senkou Span B)
          const timeA = formatTimeToYYYYMMDD(spanA.time);
          const timeB = formatTimeToYYYYMMDD(spanB.time);
          
          if (timeA && timeB) { // 유효한 날짜 문자열인 경우에만 추가
            bullishCloud.push({
              time: timeB,
              value: spanB.value
            });
            
            bearishCloud.push({
              time: timeA,
              value: spanA.value
            });
          }
        }
      }
      
      bullishCloudSeries.setData(bullishCloud);
      bearishCloudSeries.setData(bearishCloud);
      
      tenkanSeries.setData(ichimokuData.tenkanSen);
      kijunSeries.setData(ichimokuData.kijunSen);
      chikouSeries.setData(ichimokuData.chikouSpan);
      senkouSpanASeries.setData(ichimokuData.senkouSpanA);
      senkouSpanBSeries.setData(ichimokuData.senkouSpanB);
      
      tenkanRef.current = tenkanSeries;
      kijunRef.current = kijunSeries;
      chikouRef.current = chikouSeries;
      senkouSpanARef.current = senkouSpanASeries;
      senkouSpanBRef.current = senkouSpanBSeries;
    }

    // MACD 값의 최대값 및 최소값 찾기
    let maxMacd = Math.max(...macdData.map(d => d.value));
    let minMacd = Math.min(...macdData.map(d => d.value));
    let macdRange = Math.max(Math.abs(maxMacd), Math.abs(minMacd));
    
    // +20%/-10% 레벨 계산
    const plusTwentyPercent = macdRange * 0.1;
    const minusTenPercent = -macdRange * 0.2;

    // 시간 범위 설정
    const timeRange = {
      from: data[0].time as Time,
      to: data[data.length - 1].time as Time,
    };
    
    // +20% 라인 추가
    const twentyPercentLineRef = chart.addLineSeries({
      color: '#008800',
      lineWidth: 2,
      lineStyle: 2,
      title: '+20% level',
      lastValueVisible: true,
      priceLineVisible: true,
      priceLineWidth: 2,
      priceLineColor: '#008800',
      priceScaleId: 'left',
    });
    
    // -10% 라인 추가
    const minusTenPercentLineRef = chart.addLineSeries({
      color: '#AA0000',
      lineWidth: 2,
      lineStyle: 2,
      title: '-10% level',
      lastValueVisible: true,
      priceLineVisible: true,
      priceLineWidth: 2,
      priceLineColor: '#AA0000',
      priceScaleId: 'left',
    });

    // 데이터 설정
    twentyPercentLineRef.setData([
      { time: timeRange.from, value: plusTwentyPercent },
      { time: timeRange.to, value: plusTwentyPercent },
    ]);
    minusTenPercentLineRef.setData([
      { time: timeRange.from, value: minusTenPercent },
      { time: timeRange.to, value: minusTenPercent },
    ]);

    // 라인 설정 강화
    twentyPercentLineRef.applyOptions({
      lastValueVisible: true,
      priceLineVisible: true,
      priceLineWidth: 2,
      lineWidth: 2,
      crosshairMarkerVisible: true,
      crosshairMarkerRadius: 4,
      title: '+20%'
    });
    
    minusTenPercentLineRef.applyOptions({
      lastValueVisible: true,
      priceLineVisible: true,
      priceLineWidth: 2,
      lineWidth: 2,
      crosshairMarkerVisible: true,
      crosshairMarkerRadius: 4,
      title: '-10%'
    });

    // MACD 선과 신호선 설정 강화
    macdSeries.applyOptions({
      lineWidth: 3,
      lastValueVisible: true,
      priceLineVisible: false,
      crosshairMarkerVisible: true,
      crosshairMarkerRadius: 5,
      title: 'MACD'
    });
    
    signalSeries.applyOptions({
      lineWidth: 2,
      lastValueVisible: true,
      priceLineVisible: false,
      crosshairMarkerVisible: true,
      crosshairMarkerRadius: 4,
      title: 'Signal'
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
    
    // 일목균형표 라인 가시성 설정
    if (tenkanRef.current) 
      tenkanRef.current.applyOptions({ visible: showIchimoku });
    
    if (kijunRef.current) 
      kijunRef.current.applyOptions({ visible: showIchimoku });
    
    if (chikouRef.current) 
      chikouRef.current.applyOptions({ visible: showIchimoku });
    
    if (senkouSpanARef.current) 
      senkouSpanARef.current.applyOptions({ visible: showIchimoku });
    
    if (senkouSpanBRef.current) 
      senkouSpanBRef.current.applyOptions({ visible: showIchimoku });
    
  }, [showMA, showIchimoku, data.length]);

  return (
    <div className="chart-wrapper">
      <div ref={chartContainerRef} style={{ width: '100%' }} />
      <div className="chart-controls" style={{ marginTop: '20px', display: 'flex', gap: '10px' }}>
        <button
          className="btn btn-primary"
          onClick={() => {
            console.log('백테스트 결과 버튼 클릭, 이전 상태:', showBacktestResults);
            setShowBacktestResults(!showBacktestResults);
          }}
        >
          {showBacktestResults ? '백테스트 결과 숨기기' : '백테스트 결과 보기'}
        </button>
        
        {/* 일목균형표 상태에 대한 표시 */}
        {showIchimoku && (
          <div className="ichimoku-status" style={{
            padding: '6px 12px',
            background: '#f0f0f0',
            borderRadius: '4px',
            display: 'flex',
            alignItems: 'center',
            fontSize: '14px'
          }}>
            <span style={{ marginRight: '10px', fontWeight: 'bold', color: '#333' }}>
              일목균형표 활성화됨
            </span>
          </div>
        )}
      </div>
      
      {/* 디버깅용 정보 */}
      <div style={{ margin: '10px 0', fontSize: '12px', color: '#666' }}>
        <p>백테스트 결과 표시: {showBacktestResults ? 'true' : 'false'}</p>
        <p>백테스트 결과 존재: {backtestResult ? 'true' : 'false'}</p>
        {backtestResult && (
          <p>거래 수: {backtestResult.trades.length}</p>
        )}
      </div>
      
      {/* 일목균형표 정보 표시 */}
      {showIchimoku && (
        <div className="ichimoku-legend" style={{ margin: '10px 0', fontSize: '12px' }}>
          <h4 style={{ fontSize: '14px', marginBottom: '5px' }}>일목균형표 정보</h4>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <div style={{ width: '12px', height: '2px', backgroundColor: '#FF0000', marginRight: '5px' }}></div>
              <span>전환선 (9)</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <div style={{ width: '12px', height: '2px', backgroundColor: '#0000FF', marginRight: '5px' }}></div>
              <span>기준선 (26)</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <div style={{ width: '12px', height: '2px', backgroundColor: '#00FF00', marginRight: '5px', borderTop: '1px dotted #00FF00' }}></div>
              <span>후행스팬</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <div style={{ width: '12px', height: '2px', backgroundColor: '#FF6666', marginRight: '5px' }}></div>
              <span>선행스팬A</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <div style={{ width: '12px', height: '2px', backgroundColor: '#6666FF', marginRight: '5px' }}></div>
              <span>선행스팬B</span>
            </div>
          </div>
        </div>
      )}
      
      {/* 백테스트 결과 표시 */}
      {showBacktestResults && backtestResult && (
        <div className="backtest-result-summary" style={{ margin: '15px 0', padding: '10px', backgroundColor: '#f9f9f9', borderRadius: '5px' }}>
          <h4 style={{ marginBottom: '10px', fontSize: '16px' }}>백테스트 요약</h4>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '10px' }}>
            <div>총 거래: {backtestResult.totalTrades}회</div>
            <div>성공 거래: {backtestResult.successfulTrades}회</div>
            <div>승률: {backtestResult.successRate.toFixed(2)}%</div>
            <div>총 수익률: {(backtestResult.totalReturn * 100).toFixed(2)}%</div>
            <div>평균 수익률: {(backtestResult.averageReturn * 100).toFixed(2)}%</div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PolMACDChart; 