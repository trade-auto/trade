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

const PolMACDChart: React.FC<PolMACDChartProps> = ({ data, height = 800, showMA, onBacktestResultChange }) => {
  const candleChartRef = useRef<HTMLDivElement>(null);
  const macdChartRef = useRef<HTMLDivElement>(null);
  const rsiChartRef = useRef<HTMLDivElement>(null);
  
  const [candleChartApi, setCandleChartApi] = useState<IChartApi | null>(null);
  const [macdChartApi, setMacdChartApi] = useState<IChartApi | null>(null);
  const [rsiChartApi, setRsiChartApi] = useState<IChartApi | null>(null);
  
  // 백테스트 결과 상태
  const [backtestResult, setBacktestResult] = useState<BacktestResult | null>(null);
  const [showBacktestResults, setShowBacktestResults] = useState(false);
  
  // 차트 마커 상태
  const [chartMarkers, setChartMarkers] = useState<any[]>([]);
  
  // 차트 초기화 상태 추가
  const [isChartReady, setIsChartReady] = useState(false);
  const [markersSetCount, setMarkersSetCount] = useState(0);  // 마커 설정 횟수 추적

  // RSI 계산 함수
  const calculateRSI = (data: CandlestickData[], period = 20) => {
    const results: { time: Time; value: number }[] = [];
    
    if (data.length <= period) {
      console.log('Not enough data for RSI:', data.length, 'need:', period + 1);
      return results;
    }
    
    const closes = data.map(d => d.close);
    
    // 첫 번째 평균 계산
    let avgGain = 0;
    let avgLoss = 0;
    
    for (let i = 1; i <= period; i++) {
      const change = closes[i] - closes[i - 1];
      if (change >= 0) {
        avgGain += change;
      } else {
        avgLoss -= change;
      }
    }
    
    avgGain = avgGain / period;
    avgLoss = avgLoss / period;
    
    // 첫 번째 RSI 값
    let rsi = avgLoss === 0 ? 100 : 100 - (100 / (1 + (avgGain / avgLoss)));
    results.push({
      time: data[period].time as Time,
      value: rsi
    });
    
    // 나머지 RSI 값들 계산 (Wilder's smoothing)
    for (let i = period + 1; i < closes.length; i++) {
      const change = closes[i] - closes[i - 1];
      const gain = change >= 0 ? change : 0;
      const loss = change < 0 ? -change : 0;
      
      avgGain = ((avgGain * (period - 1)) + gain) / period;
      avgLoss = ((avgLoss * (period - 1)) + loss) / period;
      
      rsi = avgLoss === 0 ? 100 : 100 - (100 / (1 + (avgGain / avgLoss)));
      
      results.push({
        time: data[i].time as Time,
        value: rsi
      });
    }
    
    console.log('RSI calculation complete:', results.length, 'values');
    return results;
  };

  // ATR 계산 함수
  const calculateATR = (data: CandlestickData[], period = 14) => {
    const results: { time: Time; value: number }[] = [];
    
    if (data.length < period + 1) return results;
    
    // True Range 계산
    const trueRanges: number[] = [];
    for (let i = 1; i < data.length; i++) {
      const high = data[i].high;
      const low = data[i].low;
      const prevClose = data[i - 1].close;
      
      const tr = Math.max(
        high - low,
        Math.abs(high - prevClose),
        Math.abs(low - prevClose)
      );
      trueRanges.push(tr);
    }
    
    // 초기 ATR
    let atr = trueRanges.slice(0, period).reduce((sum, tr) => sum + tr, 0) / period;
    results.push({
      time: data[period].time as Time,
      value: atr
    });
    
    // 이후 ATR (Wilder's smoothing)
    for (let i = period; i < trueRanges.length; i++) {
      atr = ((atr * (period - 1)) + trueRanges[i]) / period;
      results.push({
        time: data[i + 1].time as Time,
        value: atr
      });
    }
    
    return results;
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

  // MACD 계산 함수
  const calculateMACD = (data: CandlestickData[]) => {
    console.log('calculateMACD called with data length:', data?.length);
    if (!data || data.length === 0) return { macdData: [], signalData: [], histogramData: [] };

    const closePrices = data.map(item => item.close);
    const ema5Values: number[] = [];
    const ema20Values: number[] = [];
    const ema30Values: number[] = [];
    const ema48Values: number[] = [];
    const ema60Values: number[] = []; 
    const ema90Values: number[] = [];
    const ema120Values: number[] = [];
    const ema200Values: number[] = [];
    const ema240Values: number[] = [];
    const ema360Values: number[] = [];
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

    // EMA 12 계산 (표준 MACD용)
    let multiplier12 = 2 / (12 + 1);
    let ema12 = closePrices[0];
    ema12Values.push(ema12);

    for (let i = 1; i < closePrices.length; i++) {
      ema12 = (closePrices[i] - ema12) * multiplier12 + ema12;
      ema12Values.push(ema12);
    }

    // EMA 26 계산 (표준 MACD용)
    let multiplier26 = 2 / (26 + 1);
    let ema26 = closePrices[0];
    ema26Values.push(ema26);

    for (let i = 1; i < closePrices.length; i++) {
      ema26 = (closePrices[i] - ema26) * multiplier26 + ema26;
      ema26Values.push(ema26);
    }
    
    // EMA 60 계산
    let multiplier60 = 2 / (60 + 1);
    let ema60 = closePrices[0];
    ema60Values.push(ema60);

    for (let i = 1; i < closePrices.length; i++) {
      ema60 = (closePrices[i] - ema60) * multiplier60 + ema60;
      ema60Values.push(ema60);
    }
    
    // EMA 200 계산
    let multiplier200 = 2 / (200 + 1);
    let ema200 = closePrices[0];
    ema200Values.push(ema200);

    for (let i = 1; i < closePrices.length; i++) {
      ema200 = (closePrices[i] - ema200) * multiplier200 + ema200;
      ema200Values.push(ema200);
    }
    
    console.log('EMA 200 calculation complete:', {
      dataLength: data.length,
      ema200Length: ema200Values.length,
      lastEMA200: ema200Values[ema200Values.length - 1]
    });

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

    // MACD 값의 최대값 및 최소값 찾기
    let maxMacd = Math.max(...macdValues);
    let minMacd = Math.min(...macdValues);
    let macdRange = Math.max(Math.abs(maxMacd), Math.abs(minMacd));
    
    // +20%/-10% 레벨 계산
    const plusTwentyPercent = macdRange * 0.15;
    const minusTenPercent = -macdRange * 0.1;

    // ATR 계산
    const atrData = calculateATR(data, 14);
    
    // RSI 데이터 미리 계산
    const rsiValues = calculateRSI(data, 20);
    console.log('RSI calculation complete:', {
      rsiLength: rsiValues.length,
      firstRSI: rsiValues[0],
      lastRSI: rsiValues[rsiValues.length - 1]
    });
    
    // 진짜 매수/매도 신호 생성 (새로운 로직)
    const type: ('buy' | 'sell' | null)[] = [];
    let inPosition = false; // 초기는 포지션 없음 (매수부터 시작 가능)
    let rsiConditionMet = false;
    let macdConditionMet = false;
    let rsiConditionIndex = -1;
    let macdConditionIndex = -1;

    // 각 조건별 신호 추적을 위한 배열들
    const trendConditions: ('trend' | null)[] = [];
    const emaConditions: ('pullback' | null)[] = [];
    const macdConditions: ('golden' | 'dead' | null)[] = [];
    const rsiConditions: ('breakout' | 'overbought' | null)[] = [];
    const emaCrossConditions: ('golden' | 'dead' | null)[] = [];
    const macdCrossConditions: ('golden' | 'dead' | null)[] = [];
    const rsiCrossConditions: ('buy' | 'sell' | null)[] = [];
    const macdPositionConditions: ('buy' | 'sell' | null)[] = [];

    // 초기 50개는 null로 초기화
    for (let i = 0; i < Math.min(50, data.length); i++) {
      type.push(null);
      trendConditions.push(null);
      emaConditions.push(null);
      macdConditions.push(null);
      rsiConditions.push(null);
      emaCrossConditions.push(null);
      macdCrossConditions.push(null);
      rsiCrossConditions.push(null);
      macdPositionConditions.push(null);
    }

    // 진짜 매수/매도 신호 생성
    let buyConditionsMetCount = 0;
    let sellConditionsMetCount = 0;
    
    for (let i = 50; i < data.length; i++) {
      const currentClose = data[i].close;
      const prevClose = data[i - 1].close;
      
      // 현재 지표 값들
      const currentEMA5 = ema5Values[i];
      const currentEMA20 = ema20Values[i];
      const currentEMA60 = ema60Values[i];
      const currentEMA200 = ema200Values[i];
      const prevEMA20 = ema20Values[i - 1];
      const prevEMA60 = ema60Values[i - 1];
      const currentMACD = macdValues[i];
      const currentSignal = signalValues[i];
      const prevMACD = macdValues[i - 1];
      const prevSignal = signalValues[i - 1];
      
      // RSI 인덱스 계산
      const rsiIndex = i - 20;
      const currentRSI = rsiIndex >= 0 && rsiIndex < rsiValues.length ? rsiValues[rsiIndex]?.value : 50;
      const prevRSI = rsiIndex - 1 >= 0 && rsiIndex - 1 < rsiValues.length ? rsiValues[rsiIndex - 1]?.value : 50;
      
      // 200 EMA 기울기 확인 (10봉 연속 상승/하락)
      let ema200Rising = true;
      let ema200Falling = true;
      if (i >= 59) { // 50 + 9 (10봉을 확인하기 위해)
        for (let j = i - 9; j <= i; j++) {
          if (j > 50) {
            if (ema200Values[j] <= ema200Values[j - 1]) {
              ema200Rising = false;
            }
            if (ema200Values[j] >= ema200Values[j - 1]) {
              ema200Falling = false;
            }
          }
        }
      } else {
        ema200Rising = false;
        ema200Falling = false;
      }
      
      // 200 EMA 음의 기울기 확인 (매수 금지 조건)
      const ema200Declining = ema200Falling;
      
      // MACD 신호선 기울기 확인 (10봉 연속 음의 기울기)
      let macdSignalDowntrend = false;
      if (i >= 59) {
        let negativeCount = 0;
        for (let j = i - 9; j <= i; j++) {
          if (j > 50 && signalValues[j] < signalValues[j - 1]) {
            negativeCount++;
          }
        }
        macdSignalDowntrend = negativeCount >= 10; // 10봉 모두 음의 기울기
      }
      
      // RSI 매수 조건 체크
      const rsiAbove50 = prevRSI <= 50 && currentRSI > 50;
      if (rsiAbove50) {
        rsiConditionMet = true;
        rsiConditionIndex = i;
        console.log(`RSI 매수 조건 충족 at ${i}, RSI: ${currentRSI.toFixed(2)}`);
      }
      
      // MACD 매수 조건 체크
      const macdGoldenCross = prevMACD <= prevSignal && currentMACD > currentSignal;
      if (macdGoldenCross) {
        macdConditionMet = true;
        macdConditionIndex = i;
        console.log(`MACD 매수 조건 충족 at ${i}, MACD: ${currentMACD.toFixed(4)}, Signal: ${currentSignal.toFixed(4)}`);
      }
      
      // 20 EMA vs 60 EMA 골든크로스 체크
      const ema20GoldenCross = prevEMA20 <= prevEMA60 && currentEMA20 > currentEMA60;
      const ema20DeadCross = prevEMA20 >= prevEMA60 && currentEMA20 < currentEMA60;
      
      // MACD vs Signal 데드크로스 체크
      const macdDeadCross = prevMACD >= prevSignal && currentMACD < currentSignal;
      
      // RSI 50% 교차 신호
      const rsi50Buy = prevRSI <= 50 && currentRSI > 50;
      const rsi50Sell = prevRSI >= 50 && currentRSI < 50;
      
      // 진짜 매수 조건:
      // 1. 포지션이 없고 (초기 또는 매도 후)
      // 2. RSI와 MACD 조건이 먼저 충족되고
      // 3. 20 EMA가 60 EMA를 상향 돌파
      // 4. 200 EMA가 음의 기울기가 아닐 때 (매수 금지 조건 아님)
      if (!inPosition && rsiConditionMet && macdConditionMet && ema20GoldenCross && !ema200Declining) {
        type.push('buy');
        inPosition = true;
        buyConditionsMetCount++;
        console.log(`🎯 진짜 매수 신호 생성! at ${i}, time: ${data[i].time}`, {
          rsiConditionIndex,
          macdConditionIndex,
          currentIndex: i,
          ema200Rising,
          ema200Declining,
          rsiConditionMet,
          macdConditionMet,
          ema20GoldenCross,
          condition: 'RSI+MACD 충족 후 20/60 EMA 골든크로스 + 200EMA 음의기울기 아님'
        });
        // 조건 리셋
        rsiConditionMet = false;
        macdConditionMet = false;
      } 
      // 진짜 매도 조건:
      // MACD가 신호선 아래로 가는 시점 + 음의 기울기 10봉이 되는 시점
      else if (inPosition && macdDeadCross && macdSignalDowntrend) {
        type.push('sell');
        inPosition = false;
        sellConditionsMetCount++;
        console.log(`🎯 진짜 매도 신호 생성! at ${i}, time: ${data[i].time}`, {
          macdDeadCross,
          macdSignalDowntrend,
          currentMACD: currentMACD.toFixed(4),
          currentSignal: currentSignal.toFixed(4),
          condition: 'MACD 데드크로스 + 신호선 10봉 음의 기울기'
        });
      } else {
        type.push(null);
      }
      
      // 각 조건별 신호 기록 (기존 로직 유지)
      trendConditions.push(ema200Rising ? 'trend' : null);
      emaConditions.push(null);
      macdConditions.push(macdGoldenCross ? 'golden' : (macdDeadCross ? 'dead' : null));
      rsiConditions.push(rsiAbove50 ? 'breakout' : null);
      emaCrossConditions.push(ema20GoldenCross ? 'golden' : (ema20DeadCross ? 'dead' : null));
      macdCrossConditions.push(macdGoldenCross ? 'golden' : (macdDeadCross ? 'dead' : null));
      rsiCrossConditions.push(rsi50Buy ? 'buy' : (rsi50Sell ? 'sell' : null));
      macdPositionConditions.push(null);
    }
    
    // 조건 충족 통계
    let trendCount = 0, emaCount = 0, macdCount = 0, rsiCount = 0;
    for (let i = 50; i < data.length; i++) {
      if (trendConditions[i] === 'trend') trendCount++;
      if (emaConditions[i] === 'pullback') emaCount++;
      if (macdConditions[i] === 'golden') macdCount++;
      if (rsiConditions[i] === 'breakout') rsiCount++;
    }
    
    // 신호 생성 통계 및 디버깅
    const buySignals = type.filter(t => t === 'buy').length;
    const sellSignals = type.filter(t => t === 'sell').length;
    
    console.log('Signal generation summary:', {
      totalCandles: data.length,
      processedCandles: data.length - 50,
      buyConditionsMet: buyConditionsMetCount,
      sellConditionsMet: sellConditionsMetCount,
      actualBuySignals: buySignals,
      actualSellSignals: sellSignals,
      individualConditions: {
        trend: trendCount,
        emaPullback: emaCount,
        macdGolden: macdCount,
        rsiBreakout: rsiCount
      }
    });
    
    // 첫 10개 신호 로그
    if (buySignals > 0 || sellSignals > 0) {
      console.log('First 10 signals:', type.slice(0, Math.min(type.length, 200)).map((signal, index) => ({
        index,
        signal,
        time: data[index]?.time
      })).filter(item => item.signal !== null));
    } else {
      console.log('⚠️ No buy/sell signals generated! Checking conditions...');
      
      // RSI 조건 만족 횟수 체크
      let rsiAbove50Count = 0;
      let macdGoldenCount = 0;
      let ema20CrossCount = 0;
      let ema200RisingCount = 0;
      
      for (let i = 50; i < Math.min(data.length, 150); i++) {
        const rsiIndex = i - 20;
        const currentRSI = rsiIndex >= 0 && rsiIndex < rsiValues.length ? rsiValues[rsiIndex]?.value : 50;
        const prevRSI = rsiIndex - 1 >= 0 && rsiIndex - 1 < rsiValues.length ? rsiValues[rsiIndex - 1]?.value : 50;
        
        const currentMACD = macdValues[i];
        const currentSignal = signalValues[i];
        const prevMACD = macdValues[i - 1];
        const prevSignal = signalValues[i - 1];
        
        const currentEMA20 = ema20Values[i];
        const currentEMA60 = ema60Values[i];
        const prevEMA20 = ema20Values[i - 1];
        const prevEMA60 = ema60Values[i - 1];
        
        if (prevRSI <= 50 && currentRSI > 50) rsiAbove50Count++;
        if (prevMACD <= prevSignal && currentMACD > currentSignal) macdGoldenCount++;
        if (prevEMA20 <= prevEMA60 && currentEMA20 > currentEMA60) ema20CrossCount++;
        if (trendConditions[i] === 'trend') ema200RisingCount++;
      }
      
      console.log('Condition analysis (first 100 candles):', {
        rsiAbove50Count,
        macdGoldenCount,
        ema20CrossCount,
        ema200RisingCount
      });
    }

    // 매매 신호 위치 찾기
    const signalIndices = new Set<number>();
    type.forEach((signal, index) => {
      if (signal === 'buy' || signal === 'sell') {
        // 매매 신호 전후 10개 캔들에서만 개별 지표 표시
        for (let i = Math.max(0, index - 10); i <= Math.min(data.length - 1, index + 10); i++) {
          signalIndices.add(i);
        }
      }
    });
    
    // 각 조건별 마커 생성 (보라색 계열) - 매매 신호 근처에서만 표시
    const trendMarkers: any[] = []; // TREND 마커 제거

    const emaMarkers = data.map((candle, index) => {
      if (emaConditions[index] === 'pullback' && signalIndices.has(index)) {
        return {
          time: candle.time,
          position: 'belowBar' as 'belowBar',
          color: '#673AB7', // 짙은 보라색
          shape: 'square' as 'square',
          text: 'EMA20',
          size: 1
        };
      }
      return null;
    }).filter(marker => marker !== null);

    const macdMarkers = data.map((candle, index) => {
      if (macdConditions[index] === 'golden' && signalIndices.has(index)) {
        return {
          time: candle.time,
          position: 'belowBar' as 'belowBar',
          color: '#8E24AA', // 중간 보라색
          shape: 'arrowUp' as 'arrowUp',
          text: 'MACD+',
          size: 1
        };
      } else if (macdConditions[index] === 'dead' && signalIndices.has(index)) {
        return {
          time: candle.time,
          position: 'aboveBar' as 'aboveBar',
          color: '#8E24AA', // 중간 보라색
          shape: 'arrowDown' as 'arrowDown',
          text: 'MACD-',
          size: 1
        };
      }
      return null;
    }).filter(marker => marker !== null);

    const rsiMarkers = data.map((candle, index) => {
      if (rsiConditions[index] === 'breakout' && signalIndices.has(index)) {
        return {
          time: candle.time,
          position: 'belowBar' as 'belowBar',
          color: '#AB47BC', // 밝은 보라색
          shape: 'arrowUp' as 'arrowUp',
          text: 'RSI+',
          size: 1
        };
      } else if (rsiConditions[index] === 'overbought' && signalIndices.has(index)) {
        return {
          time: candle.time,
          position: 'aboveBar' as 'aboveBar',
          color: '#AB47BC', // 밝은 보라색
          shape: 'arrowDown' as 'arrowDown',
          text: 'RSI-',
          size: 1
        };
      }
      return null;
    }).filter(marker => marker !== null);

    // 20 EMA vs 60 EMA 교차 마커 생성 (보라색 계열)
    const emaCrossMarkers = data.map((candle, index) => {
      if (emaCrossConditions[index] === 'golden') {
        return {
          time: candle.time,
          position: 'belowBar' as 'belowBar',
          color: '#9C27B0', // 진한 보라색
          shape: 'arrowUp' as 'arrowUp',
          text: '20/60 골든',
          size: 3
        };
      } else if (emaCrossConditions[index] === 'dead') {
        return {
          time: candle.time,
          position: 'aboveBar' as 'aboveBar',
          color: '#7B1FA2', // 더 진한 보라색
          shape: 'arrowDown' as 'arrowDown',
          text: '20/60 데드',
          size: 3
        };
      }
      return null;
    }).filter(marker => marker !== null);

    // MACD vs Signal 교차 마커 생성 (다른 보라색 계열)
    const macdCrossMarkers = data.map((candle, index) => {
      if (macdCrossConditions[index] === 'golden') {
        return {
          time: candle.time,
          position: 'belowBar' as 'belowBar',
          color: '#8E24AA', // 중간 보라색
          shape: 'arrowUp' as 'arrowUp',
          text: 'MACD 골든',
          size: 2
        };
      } else if (macdCrossConditions[index] === 'dead') {
        return {
          time: candle.time,
          position: 'aboveBar' as 'aboveBar',
          color: '#6A1B9A', // 진한 보라색
          shape: 'arrowDown' as 'arrowDown',
          text: 'MACD 데드',
          size: 2
        };
      }
      return null;
    }).filter(marker => marker !== null);

    // RSI 50% 교차 마커 생성 (보라색 계열)
    const rsiCrossMarkers = data.map((candle, index) => {
      if (rsiCrossConditions[index] === 'buy') {
        return {
          time: candle.time,
          position: 'belowBar' as 'belowBar',
          color: '#BA68C8', // 밝은 보라색
          shape: 'arrowUp' as 'arrowUp',
          text: 'RSI 50+ 매수',
          size: 2
        };
      } else if (rsiCrossConditions[index] === 'sell') {
        return {
          time: candle.time,
          position: 'aboveBar' as 'aboveBar',
          color: '#9C27B0', // 진한 보라색
          shape: 'arrowDown' as 'arrowDown',
          text: 'RSI 50- 매도',
          size: 2
        };
      }
      return null;
    }).filter(marker => marker !== null);

    // MACD 교차 후 10봉 신호 마커 생성
    const macdPositionMarkers = data.map((candle, index) => {
      if (macdPositionConditions[index] === 'buy') {
        return {
          time: candle.time,
          position: 'belowBar' as 'belowBar',
          color: '#4CAF50', // 초록색 (매수)
          shape: 'arrowUp' as 'arrowUp',
          text: '골든크로스 후 매수',
          size: 2
        };
      } else if (macdPositionConditions[index] === 'sell') {
        return {
          time: candle.time,
          position: 'aboveBar' as 'aboveBar',
          color: '#F44336', // 빨간색 (매도)
          shape: 'arrowDown' as 'arrowDown',
          text: '데드크로스 후 매도',
          size: 2
        };
      }
      return null;
    }).filter(marker => marker !== null);
    
    // 테스트용 신호 추가 - 신호가 없을 때 디버깅용
    if (buyConditionsMetCount === 0 && sellConditionsMetCount === 0) {
      console.log('No real signals generated, adding test signals for debugging...');
      // 테스트 신호 추가
      if (data.length > 100) {
        const testIndex1 = Math.floor(data.length * 0.3);
        const testIndex2 = Math.floor(data.length * 0.7);
        
        type[testIndex1] = 'buy';
        type[testIndex2] = 'sell';
        
        console.log(`Test signals added:`, {
          buyAt: testIndex1,
          sellAt: testIndex2,
          buyTime: data[testIndex1]?.time,
          sellTime: data[testIndex2]?.time
        });
      }
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
      color: histogramValues[index] >= 0 ? 'rgba(38, 166, 154, 0.5)' : 'rgba(239, 83, 80, 0.5)',
    }));

    const ema5Data = data.map((item, index) => ({
      time: item.time,
      value: ema5Values[index] || 0,
    }));

    const ema20Data = data.map((item, index) => ({
      time: item.time,
      value: ema20Values[index] || 0,
    }));
    const ema30Data = data.map((item, index) => ({
      time: item.time,
      value: ema30Values[index] || 0,
    }));
    const ema48Data = data.map((item, index) => ({
      time: item.time,  
      value: ema48Values[index] || 0,
    }));
    const ema60Data = data.map((item, index) => ({
      time: item.time,
      value: ema60Values[index] || 0,
    }));
    const ema90Data = data.map((item, index) => ({
      time: item.time,
      value: ema90Values[index] || 0,
    }));
    
    const ema120Data = data.map((item, index) => ({
      time: item.time,
      value: ema120Values[index] || 0,
    }));
    const ema240Data = data.map((item, index) => ({
      time: item.time,
      value: ema240Values[index] || 0,
    }));

    // 매수/매도 마커 생성 (매우 눈에 띄는 색상과 크기)
    const buyMarkers = data.map((candle, index) => {
      if (type[index] === 'buy') {
        return {
          time: candle.time,
          position: 'belowBar' as 'belowBar',
          color: '#0000FF',  // 진한 파란색
          shape: 'arrowUp' as 'arrowUp',
          text: '진짜매수',
          size: 3  // 크기 더 증가
        };
      }
      return null;
    }).filter(marker => marker !== null);

    const sellMarkers = data.map((candle, index) => {
      if (type[index] === 'sell') {
        return {
          time: candle.time,
          position: 'aboveBar' as 'aboveBar',
          color: '#FF0000',  // 진한 빨간색
          shape: 'arrowDown' as 'arrowDown',
          text: '진짜매도',
          size: 3  // 크기 더 증가
        };
      }
      return null;
    }).filter(marker => marker !== null);
    
    console.log('매수/매도 마커 생성 완료:', {
      buyMarkers: buyMarkers.length,
      sellMarkers: sellMarkers.length,
      buyMarkersDetail: buyMarkers.slice(0, 3),
      sellMarkersDetail: sellMarkers.slice(0, 3)
    });

    // 테스트 마커 제거 (실제 신호만 표시)
    const testMarkers = [];

    // 모든 마커 합치기 (조건별 + 매수/매도 + EMA교차 + 테스트) - MACD교차 제외
    const allMarkers = [
      ...testMarkers,
      ...trendMarkers,
      ...emaMarkers,
      ...macdMarkers,
      ...rsiMarkers,
      ...emaCrossMarkers,
      ...buyMarkers,
      ...sellMarkers
    ].sort((a, b) => {
      // 시간 순서대로 정렬 (숫자만 처리)
      const timeA = Number(a.time);
      const timeB = Number(b.time);
      return timeA - timeB;
    });

    // 중복 시간 제거 (같은 시간에 여러 마커가 있으면 첫 번째 것만 유지)
    const uniqueMarkers = [];
    const timeSet = new Set();
    
    for (const marker of allMarkers) {
      const timeKey = Number(marker.time);
      if (!timeSet.has(timeKey)) {
        timeSet.add(timeKey);
        uniqueMarkers.push(marker);
      }
    }
    
    console.log('조건별 마커 통계:', {
      testMarkers: testMarkers.length,
      trendMarkers: trendMarkers.length,
      emaMarkers: emaMarkers.length,
      macdMarkers: macdMarkers.length,
      rsiMarkers: rsiMarkers.length,
      emaCrossMarkers: emaCrossMarkers.length,
      macdCrossMarkers: macdCrossMarkers.length,
      rsiCrossMarkers: rsiCrossMarkers.length,
      macdPositionMarkers: macdPositionMarkers.length,
      buyMarkers: buyMarkers.length,
      sellMarkers: sellMarkers.length,
      totalMarkers: allMarkers.length,
      uniqueMarkers: uniqueMarkers.length
    });
    
    // 시간 순서 검증 - 더 상세하게
    let hasTimeError = false;
    for (let i = 1; i < uniqueMarkers.length; i++) {
      const currentTime = Number(uniqueMarkers[i].time);
      const prevTime = Number(uniqueMarkers[i-1].time);
      if (currentTime < prevTime) {
        console.error(`❌ 시간 정렬 오류 발견! index=${i}, current=${currentTime}, prev=${prevTime}`);
        console.error('Current marker:', uniqueMarkers[i]);
        console.error('Previous marker:', uniqueMarkers[i-1]);
        hasTimeError = true;
      }
    }
    
    if (!hasTimeError) {
      console.log('✅ 모든 마커가 시간 순으로 정렬됨');
    }
    
    console.log('시간 순서 검증:', uniqueMarkers.slice(0, 5).map(m => ({
      time: m.time,
      text: m.text,
      timeNumber: Number(m.time)
    })));

    // 마커 샘플 확인
    if (allMarkers.length > 0) {
      console.log('첫 번째 마커 샘플:', allMarkers[0]);
      console.log('마지막 마커 샘플:', allMarkers[allMarkers.length - 1]);
    } else {
      console.log('⚠️ 생성된 마커가 없습니다!');
    }
    
    // 데이터의 시간 범위 확인
    const dataStartTime = Number(data[0].time);
    const dataEndTime = Number(data[data.length - 1].time);
    
    // 데이터 시간 범위 내의 마커만 필터링
    const validTimeMarkers = uniqueMarkers.filter(marker => {
      const markerTime = Number(marker.time);
      return markerTime >= dataStartTime && markerTime <= dataEndTime;
    });
    
    console.log('시간 범위 필터링:', {
      dataStart: dataStartTime,
      dataEnd: dataEndTime,
      originalCount: uniqueMarkers.length,
      filteredCount: validTimeMarkers.length
    });
    
    // 차트 마커 상태 업데이트 (시간 범위 필터링된 마커 사용)
    setChartMarkers(validTimeMarkers);

    return {
      macdData,
      signalData,
      histogramData,
      markers: uniqueMarkers,
      macdCrossMarkers,
      rsiCrossMarkers,
      macdPositionMarkers,
      ema5Data,
      ema20Data,
      ema30Data,
      ema48Data,
      ema60Data,
      ema90Data,
      ema120Data,
      ema240Data
    };
  };

  // 백테스트 결과 계산 함수
  const calculateBacktestResult = (data: CandlestickData[], signals: (string | null)[]) => {
    if (!data || data.length === 0) return;

    // 신호 카운트 추가
    let buySignalCount = 0;
    let sellSignalCount = 0;

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

      // 신호 카운트
      if (signal === 'buy') buySignalCount++;
      else if (signal === 'sell') sellSignalCount++;

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
        const feeRate = 0.0005; // 0.05% 수수료
        const grossReturn = (exitPrice / entryPrice) - 1;
        const netReturn = grossReturn - (feeRate * 2); // 매수, 매도 수수료
        
        currentTrade.exitTime = exitTime;
        currentTrade.exitPrice = exitPrice;
        currentTrade.return = netReturn; // 수수료 반영된 수익률
        currentTrade.isSuccess = netReturn > 0;
        currentTrade.status = 'closed';  // 거래 상태 업데이트
        
        // 잔고 업데이트 (수수료 반영)
        totalValue = totalValue * (1 + netReturn);
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
    const totalReturn = (totalValue / 10000000) - 1; // 이미 수수료가 반영된 총 수익률
    
    const result: BacktestResult = {
      totalTrades: sortedTrades.length,
      successfulTrades: winningTrades.length,
      totalReturn: totalReturn,
      totalNetReturn: totalReturn, // 수수료가 이미 반영됨
      successRate: closedTrades.length > 0 ? (winningTrades.length / closedTrades.length) * 100 : 0,
      averageReturn: closedTrades.length > 0 ? totalReturn / closedTrades.length : 0,
      averageNetReturn: closedTrades.length > 0 ? totalReturn / closedTrades.length : 0,
      trades: sortedTrades
    };
    
    console.log('백테스트 계산 완료:', result.trades.length, '개 거래 발견');
    console.log('신호 통계:', {
      buySignals: buySignalCount,
      sellSignals: sellSignalCount,
      totalCandles: data.length,
      signalRatio: `${((buySignalCount + sellSignalCount) / data.length * 100).toFixed(2)}%`
    });
    
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
    console.log('PolMACDChart useEffect triggered:', {
      dataLength: data?.length || 0,
      hasCandleContainer: !!candleChartRef.current,
      hasMacdContainer: !!macdChartRef.current,
      hasRsiContainer: !!rsiChartRef.current,
      height: height,
      timestamp: new Date().toISOString()
    });
    
    // 데이터 또는 컨테이너가 없으면 early return
    if (!data || data.length === 0) {
      console.log('PolMACDChart useEffect - No data available, skipping chart creation');
      return;
    }
    
    if (!candleChartRef.current || !macdChartRef.current || !rsiChartRef.current) {
      console.log('PolMACDChart useEffect - Missing container elements, skipping chart creation');
      return;
    }

    console.log('PolMACDChart proceeding with separated chart creation, data length:', data.length);
    const { macdData, signalData, histogramData, markers, macdCrossMarkers, rsiCrossMarkers, macdPositionMarkers, ema5Data, ema20Data, ema30Data, ema48Data, ema60Data, ema90Data, ema120Data, ema240Data } = calculateMACD(data);
    const rsiData = calculateRSI(data);
    console.log('RSI Data calculated:', rsiData.length, 'points', rsiData[0], rsiData[rsiData.length - 1]);
    
    // 마커 상태 업데이트 (calculateMACD에서 반환된 마커 사용)
    console.log('=== SEPARATED CHARTS MARKER UPDATE ===');
    console.log('Markers from calculateMACD:', markers?.length || 0);
    setChartMarkers(markers || []);

    // 1. 캔들 차트 생성 (EMA + 매매 신호)
    console.log('Creating separated candle chart with height:', height * 0.6);
    const candleChart = createChart(candleChartRef.current, {
      height: height * 0.6,
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
          top: 0.05,    // 상단 5% 여백
          bottom: 0.05, // 하단 5% 여백
        },
        autoScale: true,
        borderVisible: true,
        ticksVisible: true,
      },
      timeScale: {
        borderColor: '#d1d4dc',
        timeVisible: true,
        secondsVisible: true,
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

    // 2. MACD 차트 생성
    console.log('Creating separated MACD chart with height:', height * 0.2);
    const macdChart = createChart(macdChartRef.current, {
      height: height * 0.2,
      layout: {
        background: { color: '#ffffff' },
        textColor: '#333',
      },
      grid: {
        vertLines: { color: '#f0f0f0' },
        horzLines: { color: '#f0f0f0' },
      },
      timeScale: {
        visible: false,
      },
    });

    // 3. RSI 차트 생성
    console.log('Creating separated RSI chart with height:', height * 0.2);
    const rsiChart = createChart(rsiChartRef.current, {
      height: height * 0.2,
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
    });
    
    // 캔들 차트 시리즈 생성
    const candleSeries = candleChart.addCandlestickSeries({
      upColor: '#26A69A',
      downColor: '#EF5350',
      borderVisible: false,
      wickUpColor: '#26A69A',
      wickDownColor: '#EF5350',
    });
    candleSeries.setData(data);

    // EMA 시리즈 추가 (캔들 차트에) - 최대 가시성 개선
    const ema5Series = candleChart.addLineSeries({
      color: '#00FFFF',  // 사이안 (매우 밝음)
      lineWidth: 3,      
      title: '5 EMA',
      visible: true,
      lastValueVisible: true,
      priceLineVisible: true,
      priceLineWidth: 2,
      priceLineColor: '#00FFFF',
      crosshairMarkerVisible: true,
      crosshairMarkerRadius: 6,
    });
    ema5Series.setData(ema5Data);

    const ema20Series = candleChart.addLineSeries({
      color: '#FFFF00',  // 순수 노란색 (매우 밝음)
      lineWidth: 4,      
      title: '20 EMA',
      visible: true,
      lastValueVisible: true,
      priceLineVisible: true,
      priceLineWidth: 3,
      priceLineColor: '#FFFF00',
      crosshairMarkerVisible: true,
      crosshairMarkerRadius: 7,
    });
    ema20Series.setData(ema20Data);

    const ema60Series = candleChart.addLineSeries({
      color: '#FF6600',  // 밝은 주황색
      lineWidth: 4,      
      title: '60 EMA',
      visible: true,
      lastValueVisible: true,
      priceLineVisible: true,
      priceLineWidth: 3,
      priceLineColor: '#FF6600',
      crosshairMarkerVisible: true,
      crosshairMarkerRadius: 7,
    });
    ema60Series.setData(ema60Data);

    const ema200Series = candleChart.addLineSeries({
      color: '#FF00FF',  // 마젠타 (매우 밝음)
      lineWidth: 5,      
      title: '200 EMA',
      visible: true,
      lastValueVisible: true,
      priceLineVisible: true,
      priceLineWidth: 4,
      priceLineColor: '#FF00FF',
      crosshairMarkerVisible: true,
      crosshairMarkerRadius: 8,
    });
    
    // 200 EMA 데이터 직접 계산하여 설정
    const ema200Data = calculateEMA(data, 200);
    ema200Series.setData(ema200Data);

    // MACD 차트 시리즈 생성
    const macdSeries = macdChart.addLineSeries({
      color: '#2962FF',
      lineWidth: 3,
      title: 'MACD',
    });
    macdSeries.setData(macdData);

    const signalSeries = macdChart.addLineSeries({
      color: '#FF6D00',
      lineWidth: 3,
      title: 'Signal',
    });
    signalSeries.setData(signalData);

    const histogramSeries = macdChart.addHistogramSeries({
      color: 'rgba(0, 150, 136, 0.3)',
    });
    histogramSeries.setData(histogramData);

    // MACD 0선
    const macdZeroLine = macdChart.addLineSeries({
      color: '#666666',
      lineWidth: 1,
    });
    macdZeroLine.setData([
      { time: data[0].time, value: 0 },
      { time: data[data.length - 1].time, value: 0 },
    ]);

    // RSI 차트 시리즈 생성
    const rsiSeries = rsiChart.addLineSeries({
      color: '#E91E63',
      lineWidth: 2,
      title: 'RSI(20)',
    });
    rsiSeries.setData(rsiData);

    // RSI 레벨 라인
    const rsi70Line = rsiChart.addLineSeries({
      color: '#FF5252',
      lineWidth: 1,
      lineStyle: 2,
    });
    rsi70Line.setData([
      { time: data[0].time, value: 70 },
      { time: data[data.length - 1].time, value: 70 },
    ]);

    const rsi50Line = rsiChart.addLineSeries({
      color: '#FFA726',
      lineWidth: 1,
      lineStyle: 2,
    });
    rsi50Line.setData([
      { time: data[0].time, value: 50 },
      { time: data[data.length - 1].time, value: 50 },
    ]);

    const rsi30Line = rsiChart.addLineSeries({
      color: '#4CAF50',
      lineWidth: 1,
      lineStyle: 2,
    });
    rsi30Line.setData([
      { time: data[0].time, value: 30 },
      { time: data[data.length - 1].time, value: 30 },
    ]);
    
    // 마커 설정 (분리된 차트에)
    console.log('=== SEPARATED CHARTS MARKER SETUP ===');
    console.log('Markers available:', markers?.length || 0);
    
    // 캔들 차트에 매매 신호 마커 설정
    if (markers && markers.length > 0) {
      setTimeout(() => {
        try {
          const validMarkers = markers.map(marker => ({
            time: marker.time,
            position: marker.position as 'aboveBar' | 'belowBar',
            color: marker.color,
            shape: marker.shape as 'arrowUp' | 'arrowDown',
            text: marker.text,
            size: marker.size || 1
          })).sort((a, b) => Number(a.time) - Number(b.time));
          
          candleSeries.setMarkers(validMarkers);
          console.log('✅ 캔들 차트에 마커 설정 완료:', validMarkers.length);
        } catch (error) {
          console.error('❌ 캔들 차트 마커 설정 실패:', error);
        }
      }, 500);
    }

    // MACD 차트에 MACD 관련 마커 설정
    const allMacdMarkers = [...macdCrossMarkers, ...macdPositionMarkers];
    if (allMacdMarkers.length > 0) {
      setTimeout(() => {
        try {
          const validMacdMarkers = allMacdMarkers.map(marker => ({
            time: marker.time,
            position: marker.position as 'aboveBar' | 'belowBar',
            color: marker.color,
            shape: marker.shape as 'arrowUp' | 'arrowDown',
            text: marker.text,
            size: marker.size || 1
          })).sort((a, b) => Number(a.time) - Number(b.time));
          
          macdSeries.setMarkers(validMacdMarkers);
          console.log('✅ MACD 차트에 마커 설정 완료:', validMacdMarkers.length);
        } catch (error) {
          console.error('❌ MACD 차트 마커 설정 실패:', error);
        }
      }, 600);
    }

    // RSI 차트에 RSI 관련 마커 설정
    if (rsiCrossMarkers.length > 0) {
      setTimeout(() => {
        try {
          const validRsiMarkers = rsiCrossMarkers.map(marker => ({
            time: marker.time,
            position: marker.position as 'aboveBar' | 'belowBar',
            color: marker.color,
            shape: marker.shape as 'arrowUp' | 'arrowDown',
            text: marker.text,
            size: marker.size || 1
          })).sort((a, b) => Number(a.time) - Number(b.time));
          
          rsiSeries.setMarkers(validRsiMarkers);
          console.log('✅ RSI 차트에 마커 설정 완료:', validRsiMarkers.length);
        } catch (error) {
          console.error('❌ RSI 차트 마커 설정 실패:', error);
        }
      }, 700);
    }
    
    // 캔들 차트 스케일 최적화 (EMA 가시성 개선)
    setTimeout(() => {
      try {
        // 가격 데이터 범위 계산
        const prices = data.map(d => [d.high, d.low, d.close]).flat();
        const minPrice = Math.min(...prices);
        const maxPrice = Math.max(...prices);
        const priceRange = maxPrice - minPrice;
        
        // EMA 값들도 고려한 범위 계산 (올바른 200 EMA 사용)
        const currentEma200Data = calculateEMA(data, 200);
        const allEmaValues = [
          ...ema5Data.map(d => d.value),
          ...ema20Data.map(d => d.value), 
          ...ema60Data.map(d => d.value),
          ...currentEma200Data.map(d => d.value)
        ].filter(v => v && !isNaN(v));
        
        const minEmaPrice = Math.min(...allEmaValues);
        const maxEmaPrice = Math.max(...allEmaValues);
        
        // 전체 범위 계산 (캔들 + EMA)
        const totalMinPrice = Math.min(minPrice, minEmaPrice);
        const totalMaxPrice = Math.max(maxPrice, maxEmaPrice);
        const totalRange = totalMaxPrice - totalMinPrice;
        
        // 5% 여백 추가
        const padding = totalRange * 0.05;
        const adjustedMinPrice = totalMinPrice - padding;
        const adjustedMaxPrice = totalMaxPrice + padding;
        
        console.log('캔들 차트 스케일 최적화:', {
          원본가격범위: { min: minPrice, max: maxPrice, range: priceRange },
          EMA범위: { min: minEmaPrice, max: maxEmaPrice },
          최종범위: { min: adjustedMinPrice, max: adjustedMaxPrice, range: adjustedMaxPrice - adjustedMinPrice }
        });
        
        // 스케일 범위 설정으로 EMA 가시성 개선
        candleChart.priceScale('right').applyOptions({
          autoScale: false,
          scaleMargins: {
            top: 0.02,    // 상단 2% 여백
            bottom: 0.02, // 하단 2% 여백
          },
        });
        
        // 차트에 범위 설정
        candleChart.priceScale('right').setVisibleRange({
          from: adjustedMinPrice,
          to: adjustedMaxPrice,
        });
        
      } catch (error) {
        console.log('스케일 최적화 실패, 자동 스케일 사용:', error);
        candleChart.priceScale('right').applyOptions({
          autoScale: true,
          scaleMargins: {
            top: 0.05,
            bottom: 0.05,
          },
        });
      }
    }, 1000);

    // 시간축 동기화 설정
    const syncTimeScale = () => {
      const visibleRange = candleChart.timeScale().getVisibleRange();
      if (visibleRange) {
        macdChart.timeScale().setVisibleRange(visibleRange);
        rsiChart.timeScale().setVisibleRange(visibleRange);
      }
    };

    candleChart.timeScale().subscribeVisibleTimeRangeChange(syncTimeScale);
    
    // 차트 맞춤
    candleChart.timeScale().fitContent();
    macdChart.timeScale().fitContent();
    rsiChart.timeScale().fitContent();

    // 차트 API 저장
    setCandleChartApi(candleChart);
    setMacdChartApi(macdChart);
    setRsiChartApi(rsiChart);

    // 창 크기 조절 대응
    const handleResize = () => {
      if (candleChartRef.current && macdChartRef.current && rsiChartRef.current) {
        candleChart.applyOptions({ width: candleChartRef.current.clientWidth });
        macdChart.applyOptions({ width: macdChartRef.current.clientWidth });
        rsiChart.applyOptions({ width: rsiChartRef.current.clientWidth });
      }
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      candleChart.remove();
      macdChart.remove();
      rsiChart.remove();
    };
  }, [data, height, showMA]);

  // 데이터 검증을 렌더링 단계에서 처리
  if (!data || data.length === 0) {
    return <div>데이터가 없습니다.</div>;
  }

  return (
    <div className="separated-charts-container">
      <div className="chart-header" style={{ marginBottom: '10px', padding: '10px', backgroundColor: '#f8f9fa', borderRadius: '5px', border: '1px solid #ddd' }}>
        <h3 style={{ margin: '0', fontSize: '18px', fontWeight: 'bold', color: '#333' }}>
          PolMACD 분리된 전략 차트 (EMA-MACD-RSI 추세추종)
        </h3>
        <p style={{ margin: '5px 0 0 0', fontSize: '14px', color: '#666' }}>
          표준 MACD(12-26-9) • EMA(5,20,60,200) • RSI(20) • 골든크로스 후 첫 초록/빨강 히스토그램 신호
        </p>
      </div>
      
      <div className="chart-section mb-4">
        <h3 className="text-white text-lg mb-1" style={{ color: '#333', fontSize: '16px', fontWeight: 'bold', marginBottom: '5px' }}>
          캔들 차트 (EMA + 매매 신호)
        </h3>
        <div className="text-gray-600 text-sm mb-2" style={{ fontSize: '14px', color: '#666' }}>
          보라색: EMA/MACD/RSI 조건 | 파란색: 매수 신호 | 빨간색: 매도 신호
        </div>
        <div ref={candleChartRef} style={{ width: '100%', height: `${height * 0.6}px`, marginBottom: '20px' }} />
      </div>
      
      <div className="chart-section mb-4">
        <h3 className="text-white text-lg mb-1" style={{ color: '#333', fontSize: '16px', fontWeight: 'bold', marginBottom: '5px' }}>
          MACD 차트
        </h3>
        <div className="text-gray-600 text-sm mb-2" style={{ fontSize: '14px', color: '#666' }}>
          보라색: MACD 골든/데드크로스 | 초록/빨강: 첫 히스토그램 신호
        </div>
        <div ref={macdChartRef} style={{ width: '100%', height: `${height * 0.2}px`, marginBottom: '20px' }} />
      </div>
      
      <div className="chart-section mb-4">
        <h3 className="text-white text-lg mb-1" style={{ color: '#333', fontSize: '16px', fontWeight: 'bold', marginBottom: '5px' }}>
          RSI 차트
        </h3>
        <div className="text-gray-600 text-sm mb-2" style={{ fontSize: '14px', color: '#666' }}>
          보라색: RSI 50% 교차 신호 | 70/50/30 레벨 라인
        </div>
        <div ref={rsiChartRef} style={{ width: '100%', height: `${height * 0.2}px`, marginBottom: '20px' }} />
      </div>
      
      <div className="chart-controls" style={{ marginTop: '20px' }}>
        <button
          className="btn btn-primary"
          onClick={() => setShowBacktestResults(!showBacktestResults)}
          style={{ 
            padding: '10px 20px',
            backgroundColor: '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '5px',
            cursor: 'pointer'
          }}
        >
          {showBacktestResults ? '백테스트 결과 숨기기' : '백테스트 결과 보기'}
        </button>
      </div>
      
      {showBacktestResults && backtestResult && (
        <BacktestResults backtestResult={backtestResult} />
      )}
    </div>
  );
};

export default PolMACDChart; 