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

const PolMACDChartFixed: React.FC<PolMACDChartProps> = ({ data, height = 800, showMA, onBacktestResultChange }) => {
  if (!data || data.length === 0) {
    return <div>데이터가 없습니다.</div>;
  }
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
  const ema20Ref = useRef<ISeriesApi<'Line'> | null>(null);
  const ema48Ref = useRef<ISeriesApi<'Line'> | null>(null);
  const ema60Ref = useRef<ISeriesApi<'Line'> | null>(null);
  const ema120Ref = useRef<ISeriesApi<'Line'> | null>(null);
  const ema200Ref = useRef<ISeriesApi<'Line'> | null>(null);
  const ema240Ref = useRef<ISeriesApi<'Line'> | null>(null);
  const rsiRef = useRef<ISeriesApi<'Line'> | null>(null);
  const atrRef = useRef<ISeriesApi<'Line'> | null>(null);
  
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
    
    // 매수/매도 신호 생성 (EMA-MACD-RSI 전략)
    const type: ('buy' | 'sell' | null)[] = [];
    let inPosition = false;

    // 각 조건별 신호 추적을 위한 배열들
    const trendConditions: ('trend' | null)[] = [];
    const emaConditions: ('pullback' | null)[] = [];
    const macdConditions: ('golden' | 'dead' | null)[] = [];
    const rsiConditions: ('breakout' | 'overbought' | null)[] = [];

    // 초기 50개는 null로 초기화 (조건 완화)
    for (let i = 0; i < Math.min(50, data.length); i++) {
      type.push(null);
      trendConditions.push(null);
      emaConditions.push(null);
      macdConditions.push(null);
      rsiConditions.push(null);
    }

    // EMA-MACD-RSI 전략 기반 신호 생성
    let buyConditionsMetCount = 0;
    let sellConditionsMetCount = 0;
    
    for (let i = 50; i < data.length; i++) {
      const currentClose = data[i].close;
      const prevClose = data[i - 1].close;
      
      // 현재 지표 값들
      const currentEMA5 = ema5Values[i];
      const currentEMA20 = ema20Values[i];
      const currentEMA200 = ema200Values[i];
      const currentMACD = macdValues[i];
      const currentSignal = signalValues[i];
      const prevMACD = macdValues[i - 1];
      const prevSignal = signalValues[i - 1];
      // RSI 인덱스 계산 수정 - RSI 배열은 period(20) 이후부터 시작
      const rsiIndex = i - 20; // RSI는 20번째 캔들부터 시작
      const currentRSI = rsiIndex >= 0 && rsiIndex < rsiValues.length ? rsiValues[rsiIndex]?.value : 50;
      const prevRSI = rsiIndex - 1 >= 0 && rsiIndex - 1 < rsiValues.length ? rsiValues[rsiIndex - 1]?.value : 50;
      const prev2RSI = rsiIndex - 2 >= 0 && rsiIndex - 2 < rsiValues.length ? rsiValues[rsiIndex - 2]?.value : 50;
      
      // ATR 기반 되돌림 계산 - ATR 배열은 period(14) + 1 이후부터 시작
      const atrIndex = i - 15; // ATR는 15번째 캔들부터 시작
      const atrValue = atrIndex >= 0 && atrIndex < atrData.length ? atrData[atrIndex]?.value : 0;
      const ema20Distance = Math.abs(currentClose - currentEMA20);
      const isNearEMA20 = ema20Distance <= (atrValue * 0.25);
      
      // 매수 조건 (약간 완화)
      const trendFilter = currentEMA200 > ema200Values[i - 5] && currentClose > currentEMA200; // 200 EMA 상승 추세 AND 가격 > 200 EMA
      const ema20Pullback = ema20Distance <= (atrValue * 0.5); // 20 EMA 근처 되돌림 (±0.5 ATR로 완화)
      const macdGoldenCross = prevMACD <= prevSignal && currentMACD > currentSignal; // MACD 골든크로스
      const rsiBreakout = (prev2RSI <= 55 && currentRSI > 55) || (prevRSI <= 55 && currentRSI > 55); // RSI 55 상향 돌파 (2봉 내)
      
      // 매도 조건
      const emaDeadCross = ema5Values[i - 1] >= ema20Values[i - 1] && currentEMA5 < currentEMA20; // 5/20 EMA 데드크로스
      const macdHistogramDown = histogramValues[i] < 0 && histogramValues[i - 1] < 0; // MACD 히스토그램 2봉 연속 음수
      const rsiOverbought = currentRSI >= 70 && currentClose < prevClose; // RSI ≥70 후 첫 음봉
      
      // 각 조건별 신호 기록
      trendConditions.push(trendFilter ? 'trend' : null);
      emaConditions.push(ema20Pullback ? 'pullback' : null);
      macdConditions.push(macdGoldenCross ? 'golden' : (macdHistogramDown ? 'dead' : null));
      rsiConditions.push(rsiBreakout ? 'breakout' : (rsiOverbought ? 'overbought' : null));
      
      // 조건 확인을 위한 디버깅 (첫 몇 개만)
      if (i === 200 || i === 201 || i === 202) {
        console.log(`Candle ${i} conditions:`, {
          trendFilter,
          ema20Pullback,
          macdGoldenCross,
          rsiBreakout,
          emaDeadCross,
          macdHistogramDown,
          rsiOverbought,
          inPosition,
          atrValue,
          ema20Distance,
          currentRSI,
          prevRSI
        });
      }
      
      if (!inPosition && trendFilter && ema20Pullback && macdGoldenCross && rsiBreakout) {
        type.push('buy');
        inPosition = true;
        buyConditionsMetCount++;
      } else if (inPosition && (emaDeadCross || macdHistogramDown || rsiOverbought)) {
        type.push('sell');
        inPosition = false;
        sellConditionsMetCount++;
      } else {
        type.push(null);
      }
    }
    
    // 조건 충족 통계
    let trendCount = 0, emaCount = 0, macdCount = 0, rsiCount = 0;
    for (let i = 50; i < data.length; i++) {
      if (trendConditions[i] === 'trend') trendCount++;
      if (emaConditions[i] === 'pullback') emaCount++;
      if (macdConditions[i] === 'golden') macdCount++;
      if (rsiConditions[i] === 'breakout') rsiCount++;
    }
    
    console.log('Signal generation summary:', {
      totalCandles: data.length,
      processedCandles: data.length - 50,
      buyConditionsMet: buyConditionsMetCount,
      sellConditionsMet: sellConditionsMetCount,
      individualConditions: {
        trend: trendCount,
        emaPullback: emaCount,
        macdGolden: macdCount,
        rsiBreakout: rsiCount
      }
    });

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
    const trendMarkers = data.map((candle, index) => {
      if (trendConditions[index] === 'trend' && signalIndices.has(index)) {
        return {
          time: candle.time,
          position: 'belowBar' as 'belowBar',
          color: '#9C27B0', // 보라색
          shape: 'circle' as 'circle',
          text: 'TREND',
          size: 1
        };
      }
      return null;
    }).filter(marker => marker !== null);

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
    
    // 테스트용 신호 추가 - 실제 신호 확인을 위해 비활성화
    /*
    if (buyConditionsMetCount === 0 && sellConditionsMetCount === 0) {
      console.log('No signals generated, adding test signals...');
      for (let i = 250; i < Math.min(data.length, 450); i += 50) {
        if (i < type.length) {
          type[i] = i % 100 === 0 ? 'buy' : 'sell';
          console.log(`Test signal at index ${i}: ${type[i]}`);
        }
      }
    }
    */

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

    // 매수/매도 마커 생성 (더 눈에 띄는 색상과 크기)
    const buyMarkers = data.map((candle, index) => {
      if (type[index] === 'buy') {
        return {
          time: candle.time,
          position: 'belowBar' as 'belowBar',
          color: '#0000FF',  // 파란색
          shape: 'arrowUp' as 'arrowUp',
          text: 'BUY',
          size: 2  // 크기 증가
        };
      }
      return null;
    }).filter(marker => marker !== null);

    const sellMarkers = data.map((candle, index) => {
      if (type[index] === 'sell') {
        return {
          time: candle.time,
          position: 'aboveBar' as 'aboveBar',
          color: '#FF0000',  // 밝은 빨간색
          shape: 'arrowDown' as 'arrowDown',
          text: 'SELL',
          size: 2  // 크기 증가
        };
      }
      return null;
    }).filter(marker => marker !== null);

    // 테스트 마커 제거 (실제 신호만 표시)
    const testMarkers: any[] = [];

    // 모든 마커 합치기 (조건별 + 매수/매도 + 테스트)
    const allMarkers = [
      ...testMarkers,
      ...trendMarkers,
      ...emaMarkers,
      ...macdMarkers,
      ...rsiMarkers,
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
    console.log('PolMACDChartFixed useEffect triggered:', {
      dataLength: data?.length || 0,
      hasContainer: !!chartContainerRef.current,
      height: height,
      timestamp: new Date().toISOString()
    });
    
    // 데이터 또는 컨테이너가 없으면 early return
    if (!data || data.length === 0) {
      console.log('PolMACDChartFixed useEffect - No data available, skipping chart creation');
      return;
    }
    
    if (!chartContainerRef.current) {
      console.log('PolMACDChartFixed useEffect - No container element, skipping chart creation');
      return;
    }

    console.log('PolMACDChartFixed proceeding with chart creation, data length:', data.length);
    const { macdData, signalData, histogramData, markers, ema5Data, ema20Data, ema30Data, ema48Data, ema60Data, ema90Data, ema120Data, ema240Data } = calculateMACD(data);
    const stochasticData = calculateStochastic(data);
    const rsiData = calculateRSI(data);
    console.log('RSI Data calculated:', rsiData.length, 'points', rsiData[0], rsiData[rsiData.length - 1]);
    
    // 마커 상태 업데이트 (calculateMACD에서 반환된 마커 사용)
    console.log('=== INITIAL MARKER UPDATE ===');
    console.log('Markers from calculateMACD:', markers?.length || 0);
    setChartMarkers(markers || []);

    // 새로운 차트 생성
    console.log('Creating chart with height:', height);
    const chartOptions = {
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
          top: 0.02,
          bottom: 0.48,  // 캔들차트가 전체의 50% 차지
        },
      },
      leftPriceScale: {
        visible: true,
        borderColor: '#d1d4dc',
        scaleMargins: {
          top: 0.55,  // MACD를 위한 상단 공간 (캔들차트 50% + 간격 5%)
          bottom: 0.25,  // RSI를 위한 하단 공간
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
    };
    console.log('Chart creation options:', chartOptions);
    const chart = createChart(chartContainerRef.current, chartOptions);
    console.log('Created chart:', chart);
    console.log('Chart height after creation:', chart.options().height);
    
    // RSI 스케일은 나중에 RSI 시리즈를 추가할 때 자동으로 생성됨
    console.log('Chart created, RSI scale will be created with RSI series');

    const candleSeries = chart.addCandlestickSeries({
      upColor: '#26A69A',
      downColor: '#EF5350',
      borderVisible: false,
      wickUpColor: '#26A69A',
      wickDownColor: '#EF5350',
      priceScaleId: 'right',  // 명시적으로 right 스케일 지정
    });

    candleSeries.setData(data);
    candleRef.current = candleSeries;
    chartRef.current = chart;

    // 즉시 간단한 마커 테스트
    console.log('=== 즉시 마커 테스트 ===');
    const immediateMarker = [{
      time: data[Math.floor(data.length / 2)].time,
      position: 'belowBar' as const,
      color: '#FF0000',
      shape: 'circle' as const,
      text: 'IMMEDIATE',
      size: 10
    }];
    
    try {
      candleSeries.setMarkers(immediateMarker);
      console.log('✅ 즉시 마커 설정 성공');
    } catch (error) {
      console.error('❌ 즉시 마커 설정 실패:', error);
    }
    
    // 마커 직접 설정 (타이밍 문제 해결)
    console.log('=== INITIAL MARKER SETUP ===');
    console.log('Markers available:', markers?.length || 0);
    console.log('CandleSeries created:', !!candleRef.current);
    console.log('Chart created:', !!chartRef.current);
    
    if (markers && markers.length > 0) {
      // 차트 렌더링 완료 후 마커 설정
      console.log('Setting timeout for initial marker setup...');
      setTimeout(() => {
        console.log('=== TIMEOUT MARKER SETUP EXECUTION ===');
        // null 체크 추가
        if (!candleRef.current || !chartRef.current) {
          console.warn('Chart or candle series became null during timeout');
          return;
        }
        
        const validMarkers = markers.map(marker => {
          // 시간 형식 변환 확인
          let timeValue = marker.time;
          if (typeof timeValue === 'string') {
            timeValue = Math.floor(new Date(timeValue).getTime() / 1000) as Time;
          }
          
          return {
            time: timeValue,
            position: marker.position as 'aboveBar' | 'belowBar',
            color: marker.color,
            shape: marker.shape as 'arrowUp' | 'arrowDown',
            text: marker.text,
            size: marker.size || 1
          };
        }).sort((a, b) => {
          const timeA = Number(a.time);
          const timeB = Number(b.time);
          return timeA - timeB;
        }); // 시간 순으로 정렬
        
        // 데이터 시간 범위 확인
        const dataStartTime = Number(data[0].time);
        const dataEndTime = Number(data[data.length - 1].time);
        
        // 시간 범위 내의 마커만 필터링
        const timeFilteredMarkers = validMarkers.filter(marker => {
          const markerTime = Number(marker.time);
          return markerTime >= dataStartTime && markerTime <= dataEndTime;
        });
        
        // 정렬 후 검증
        console.log('=== 초기 마커 정렬 검증 ===');
        for (let i = 1; i < timeFilteredMarkers.length; i++) {
          const currentTime = Number(timeFilteredMarkers[i].time);
          const prevTime = Number(timeFilteredMarkers[i-1].time);
          if (currentTime < prevTime) {
            console.error(`❌ 초기 마커 정렬 오류! index=${i}, current=${currentTime}, prev=${prevTime}`);
            console.error('문제가 있는 마커들:', timeFilteredMarkers.slice(Math.max(0, i-2), i+2));
            return; // 오류 시 마커 설정 중단
          }
        }
        
        console.log('Setting markers directly after data:', timeFilteredMarkers.length);
        console.log('First few markers:', timeFilteredMarkers.slice(0, 5));
        
        try {
          candleRef.current.setMarkers(timeFilteredMarkers);
          console.log('✅ setMarkers() call successful with', timeFilteredMarkers.length, 'markers');
          console.log('First marker:', timeFilteredMarkers[0]);
          console.log('Last marker:', timeFilteredMarkers[timeFilteredMarkers.length - 1]);
          setMarkersSetCount(prev => prev + 1);
        } catch (error) {
          console.error('❌ setMarkers() failed:', error);
        }
        
        // 마커 설정 후 차트 영역 재조정
        chartRef.current.timeScale().fitContent();
        console.log('마커 설정 완료 - fitContent() 호출됨');
      }, 500);
    } else {
      console.log('No markers to set initially');
    }

    // 차트 준비 완료 상태 설정 (마커 설정 후)
    setIsChartReady(true);
    console.log('Chart is ready, setting isChartReady to true');

    // MACD 표시
    const macdSeries = chart.addLineSeries({
      color: '#2962FF',
      lineWidth: 2,
      priceScaleId: 'left',  // 왼쪽 스케일 사용
      priceFormat: {
        type: 'price',
        precision: 6,
        minMove: 0.000001,
      },
    });

    const signalSeries = chart.addLineSeries({
      color: '#FF6D00',
      lineWidth: 4,
      priceScaleId: 'left',  // 왼쪽 스케일 사용
      priceFormat: {
        type: 'price',
        precision: 6,
        minMove: 0.000001,
      },
    });

    const histogramSeries = chart.addHistogramSeries({
      priceScaleId: 'left',  // 왼쪽 스케일 사용
      priceFormat: {
        type: 'price',
        precision: 6,
        minMove: 0.000001,
      },
      color: 'rgba(0, 150, 136, 0.3)',
    });

    macdSeries.setData(macdData);
    signalSeries.setData(signalData);
    histogramSeries.setData(histogramData);

    macdRef.current = macdSeries;
    signalRef.current = signalSeries;
    histogramRef.current = histogramSeries;

    // EMA 5, 20 표시
    const ema5Series = chart.addLineSeries({
      color: '#00BCD4',  // 밝은 청록색
      lineWidth: 3,
      title: '5 EMA',
      visible: true,
      priceScaleId: 'right',  // 캔들차트와 같은 스케일
    });

    const ema20Series = chart.addLineSeries({
      color: '#FFC107',  // 황금색
      lineWidth: 3,
      title: '20 EMA',
      visible: true,
      priceScaleId: 'right',  // 캔들차트와 같은 스케일
    });

    const ema48Series = chart.addLineSeries({
      color: '#00C853',
      lineWidth: 2,
      title: '48 EMA',
      visible: false,  // 기본값 false로 변경
      priceScaleId: 'right',
    });
    
    const ema60Series = chart.addLineSeries({
      color: '#FF5722',  // 진한 주황색
      lineWidth: 3,
      title: '60 EMA',
      visible: true,
      priceScaleId: 'right',
    });

    const ema120Series = chart.addLineSeries({
      color: '#1E90FF',  // Dodger Blue
      lineWidth: 2,
      title: '120 EMA',
      visible: false,  // 기본값 false로 변경
      priceScaleId: 'right',
    });
    
    const ema200Series = chart.addLineSeries({
      color: '#673AB7',  // 진한 보라색
      lineWidth: 4,
      title: '200 EMA',
      visible: true,
      priceScaleId: 'right',
    });
    
    const ema240Series = chart.addLineSeries({
      color: '#00FF00',  // Lime Green   
      lineWidth: 3,
      title: '240 EMA',
      visible: false,  // 기본값 false로 변경
      priceScaleId: 'right',
    });


    // EMA 데이터 설정
    if (ema5Data && ema20Data) {
      ema5Series.setData(ema5Data);
      ema20Series.setData(ema20Data);
      
      // 48, 60, 120, 200, 240 EMA 데이터 계산 및 설정
      const ema48Data = calculateEMA(data, 48);
      const ema60Data = calculateEMA(data, 60);
      const ema120Data = calculateEMA(data, 120);
      const ema200Data = calculateEMA(data, 200);
      const ema240Data = calculateEMA(data, 240);
      
      if (ema48Data && ema48Data.length > 0) {
        ema48Series.setData(ema48Data);
      }
      
      if (ema60Data && ema60Data.length > 0) {
        ema60Series.setData(ema60Data);
      }
      
      if (ema120Data && ema120Data.length > 0) {
        ema120Series.setData(ema120Data);
      }
      
      if (ema200Data && ema200Data.length > 0) {
        ema200Series.setData(ema200Data);
      }
      
      if (ema240Data && ema240Data.length > 0) {
        ema240Series.setData(ema240Data);
      }
    }
    

    ema5Ref.current = ema5Series;
    ema20Ref.current = ema20Series;
    ema48Ref.current = ema48Series;
    ema60Ref.current = ema60Series;
    ema120Ref.current = ema120Series;
    ema200Ref.current = ema200Series;
    ema240Ref.current = ema240Series;
    
    // RSI 시리즈 추가 (왼쪽 스케일 사용)
    const rsiSeries = chart.addLineSeries({
      color: '#FF1744', // 더 밝은 빨간색
      lineWidth: 2, // 더 굵게
      title: 'RSI(20)',
      priceScaleId: 'left',  // 왼쪽 스케일 사용
      priceFormat: {
        type: 'price',
        precision: 0,
        minMove: 1,
      },
      visible: true,
      lastValueVisible: true,
      priceLineVisible: true,
      priceLineWidth: 3,
      priceLineStyle: 0,
      priceLineColor: '#FF1744',
      crosshairMarkerVisible: true,
      crosshairMarkerRadius: 7,
    });
    rsiRef.current = rsiSeries;
    console.log('RSI series created:', !!rsiRef.current);

    // RSI 과매수/과매도 라인 추가
    const rsiOverboughtLine = chart.addLineSeries({
      color: '#FF5252',
      lineWidth: 4,
      lineStyle: 2, // dashed
      title: 'RSI 70',
      priceScaleId: 'left',  // 왼쪽 스케일 사용
      visible: true,
      lastValueVisible: true,
      priceLineVisible: false,
    });

    const rsiOversoldLine = chart.addLineSeries({
      color: '#4CAF50',
      lineWidth: 4,
      lineStyle: 2, // dashed
      title: 'RSI 30',
      priceScaleId: 'left',  // 왼쪽 스케일 사용
      visible: true,
      lastValueVisible: true,
      priceLineVisible: false,
    });

    // RSI 중간선 추가
    const rsiMidLine = chart.addLineSeries({
      color: '#FFA726',
      lineWidth: 3,
      lineStyle: 2, // dashed
      title: 'RSI 50',
      priceScaleId: 'left',  // 왼쪽 스케일 사용
      visible: true,
      lastValueVisible: true,
      priceLineVisible: false,
    });

    // MACD 값의 최대값 및 최소값 찾기
    let maxMacd = Math.max(...macdData.map(d => d.value));
    let minMacd = Math.min(...macdData.map(d => d.value));
    let macdRange = Math.max(Math.abs(maxMacd), Math.abs(minMacd));
    
    // +20%/-10% 레벨 계산 (더 넓은 범위로 조정)
    const plusTwentyPercent = macdRange * 0.3;
    const minusTenPercent = -macdRange * 0.3;

    // 시간 범위 설정
    const timeRange = {
      from: data[0].time as Time,
      to: data[data.length - 1].time as Time,
    };
    
    // MACD 기준선 추가
    const macdZeroLine = chart.addLineSeries({
      color: '#666666',
      lineWidth: 1,
      lineStyle: 0,
      title: 'MACD 0',
      lastValueVisible: false,
      priceLineVisible: false,
      priceScaleId: 'left',
    });
    
    // +20% 라인 추가
    const twentyPercentLineRef = chart.addLineSeries({
      color: '#008800',
      lineWidth: 2,
      lineStyle: 2,
      title: '+20% 수준',
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
      title: '-10% 수준',
      lastValueVisible: true,
      priceLineVisible: true,
      priceLineWidth: 2,
      priceLineColor: '#AA0000',
      priceScaleId: 'left',
    });

    // 데이터 설정
    macdZeroLine.setData([
      { time: timeRange.from, value: 0 },
      { time: timeRange.to, value: 0 },
    ]);
    twentyPercentLineRef.setData([
      { time: timeRange.from, value: plusTwentyPercent },
      { time: timeRange.to, value: plusTwentyPercent },
    ]);
    minusTenPercentLineRef.setData([
      { time: timeRange.from, value: minusTenPercent },
      { time: timeRange.to, value: minusTenPercent },
    ]);

    // RSI 데이터는 원본 값 그대로 사용 (0-100 범위)
    const rsiLineData = rsiData;
    
    // RSI는 왼쪽 스케일을 사용하므로 별도 설정 불필요

    // RSI 과매수/과매도 라인 데이터 (원본 값 사용)
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

    // RSI 데이터 설정
    console.log('Setting RSI data:', {
      rsiDataLength: rsiData.length,
      rsiLineDataLength: rsiLineData.length,
      rsiRef: !!rsiRef.current,
      macdRange: macdRange,
      firstRsi: rsiLineData[0],
      lastRsi: rsiLineData[rsiLineData.length - 1]
    });
    
    if (rsiRef.current && rsiLineData.length > 0) {
      rsiRef.current.setData(rsiLineData);
      console.log('RSI data set successfully');
    }
    
    rsiOverboughtLine.setData(rsiOverboughtData);
    rsiOversoldLine.setData(rsiOversoldData);
    rsiMidLine.setData(rsiMidData);
    
    // RSI는 이제 왼쪽 스케일을 공유하므로 별도 설정 불필요

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
      lineWidth: 2,
      lastValueVisible: true,
      priceLineVisible: true,
      priceLineWidth: 2,
      priceLineStyle: 0,
      priceLineColor: '#2962FF',
      crosshairMarkerVisible: true,
      crosshairMarkerRadius: 6,
      title: 'MACD'
    });
    
    signalSeries.applyOptions({
      lineWidth: 4,
      lastValueVisible: true,
      priceLineVisible: true,
      priceLineWidth: 2,
      priceLineStyle: 0,
      priceLineColor: '#FF6D00',
      crosshairMarkerVisible: true,
      crosshairMarkerRadius: 5,
      title: 'Signal'
    });
    
    // 차트 시간 축 맞춤
    chart.timeScale().fitContent();

    chartRef.current = chart;
    
    // 차트 준비 완료 상태 설정
    setIsChartReady(true);
    console.log('Chart is ready, setting isChartReady to true');
    
    // 차트 준비 완료 후 강제로 마커 재설정
    setTimeout(() => {
      if (chartMarkers.length > 0 && candleRef.current) {
        console.log('=== FORCED MARKER RESET AFTER CHART READY ===');
        const forceMarkers = chartMarkers.map(marker => {
          let timeValue = marker.time;
          if (typeof timeValue === 'string') {
            timeValue = Math.floor(new Date(timeValue).getTime() / 1000) as Time;
          }
          
          return {
            time: timeValue,
            position: marker.position as 'aboveBar' | 'belowBar',
            color: marker.color,
            shape: marker.shape as 'arrowUp' | 'arrowDown',
            text: marker.text,
            size: marker.size || 1
          };
        });
        
        try {
          candleRef.current.setMarkers(forceMarkers);
          console.log('✅ Forced marker reset successful with', forceMarkers.length, 'markers');
          setMarkersSetCount(prev => prev + 1);
        } catch (error) {
          console.error('❌ Forced marker reset failed:', error);
        }
      }
    }, 1000);
    
    // 왼쪽 스케일 자동 조정 설정 (MACD 전용)
    chart.priceScale('left').applyOptions({
      autoScale: true,
      scaleMargins: {
        top: 0.55,  // 상단 55% 비워두기 (캔들차트 50% + 간격 5%)
        bottom: 0.25,  // 하단 25% 비워두기 (RSI 20% + 간격 5%)
      },
    });
    
    // 차트 영역 구분선 추가
    // 캔들-MACD 구분선
    const candleMacdSeparator = chart.addLineSeries({
      color: '#303030',
      lineWidth: 2,
      lineStyle: 0,
      priceScaleId: 'left',
      lastValueVisible: false,
      priceLineVisible: false,
      crosshairMarkerVisible: false,
    });
    
    // MACD-RSI 구분선
    const macdRsiSeparator = chart.addLineSeries({
      color: '#303030',
      lineWidth: 2,
      lineStyle: 0,
      priceScaleId: 'left',  // 왼쪽 스케일 사용
      lastValueVisible: false,
      priceLineVisible: false,
      crosshairMarkerVisible: false,
    });
    
    // 구분선 위치 설정
    const candleMacdSeparatorData = [
      { time: timeRange.from, value: 0 },
      { time: timeRange.to, value: 0 },
    ];
    candleMacdSeparator.setData(candleMacdSeparatorData);
    
    const macdRsiSeparatorData = [
      { time: timeRange.from, value: 105 },
      { time: timeRange.to, value: 105 },
    ];
    macdRsiSeparator.setData(macdRsiSeparatorData);
    
    // RSI가 보이도록 강제로 시리즈 업데이트
    setTimeout(() => {
      if (rsiRef.current) {
        rsiRef.current.applyOptions({ visible: true });
        console.log('RSI visibility forced to true');
      }
    }, 100);

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
      setIsChartReady(false);
    };
  }, [data, height, showMA]);

  // height prop 변경 시 차트 리사이즈
  useEffect(() => {
    if (chartRef.current && chartContainerRef.current) {
      console.log('Resizing chart to height:', height);
      chartRef.current.applyOptions({ height: height });
      chartRef.current.resize(chartContainerRef.current.clientWidth, height);
    }
  }, [height]);

  // 마커 업데이트 전용 useEffect (개선됨)
  useEffect(() => {
    console.log('=== MARKER UPDATE USEEFFECT ===');
    console.log('Marker update useEffect triggered:', {
      hasChart: !!chartRef.current,
      hasCandleSeries: !!candleRef.current,
      markerCount: chartMarkers.length,
      firstMarker: chartMarkers[0],
      lastMarker: chartMarkers[chartMarkers.length - 1],
      isChartReady: isChartReady,
      markersSetCount: markersSetCount
    });
    
    if (chartRef.current && candleRef.current) {
      // 차트가 준비된 후 마커 설정
      setTimeout(() => {
        // null 체크 추가
        if (!candleRef.current || !chartRef.current) {
          console.warn('Chart or candle series became null during timeout');
          return;
        }
        
        if (chartMarkers.length > 0) {
          const validMarkers = chartMarkers.map(marker => {
            // 시간 형식 변환 확인
            let timeValue = marker.time;
            if (typeof timeValue === 'string') {
              timeValue = Math.floor(new Date(timeValue).getTime() / 1000) as Time;
            }
            
            return {
              time: timeValue,
              position: marker.position as 'aboveBar' | 'belowBar',
              color: marker.color,
              shape: marker.shape as 'arrowUp' | 'arrowDown',
              text: marker.text,
              size: marker.size || 1
            };
          }).sort((a, b) => {
            const timeA = Number(a.time);
            const timeB = Number(b.time);
            return timeA - timeB;
          }); // 시간 순으로 정렬
          
          // 정렬 후 검증
          console.log('=== useEffect 마커 정렬 검증 ===');
          for (let i = 1; i < validMarkers.length; i++) {
            const currentTime = Number(validMarkers[i].time);
            const prevTime = Number(validMarkers[i-1].time);
            if (currentTime < prevTime) {
              console.error(`❌ useEffect 마커 정렬 오류! index=${i}, current=${currentTime}, prev=${prevTime}`);
              console.error('문제가 있는 마커들:', validMarkers.slice(Math.max(0, i-2), i+2));
              // 오류가 있는 경우 빈 배열 설정
              candleRef.current.setMarkers([]);
              return;
            }
          }
          
          console.log('Setting markers in useEffect:', validMarkers.length);
          console.log('Sample markers:', validMarkers.slice(0, 3));
          
          try {
            candleRef.current.setMarkers(validMarkers);
            console.log('✅ setMarkers() in useEffect successful');
            setMarkersSetCount(prev => prev + 1);
            
            // 마커가 실제로 설정되었는지 확인
            setTimeout(() => {
              if (candleRef.current) {
                console.log('Verifying markers are visible...');
                // @ts-ignore - markers() 메서드가 있는지 확인
                if (typeof candleRef.current.markers === 'function') {
                  const currentMarkers = candleRef.current.markers();
                  console.log('Current markers on series:', currentMarkers?.length || 'markers() not available');
                }
              }
            }, 100);
          } catch (error) {
            console.error('❌ setMarkers() in useEffect failed:', error);
          }
          
          // 마커 설정 후 차트 영역 재조정
          chartRef.current.timeScale().fitContent();
          console.log('마커 업데이트 완료 - fitContent() 호출됨');
        } else {
          // 마커가 없을 때 빈 배열로 초기화
          console.log('Clearing markers (no markers to display)');
          candleRef.current.setMarkers([]);
        }
      }, 500);
    } else {
      console.warn('Chart or candle series not ready:', {
        chart: !!chartRef.current,
        candle: !!candleRef.current
      });
    }
  }, [chartMarkers]);

  // 이동평균선 표시 설정이 변경되면 가시성 업데이트
  useEffect(() => {
    if (showMA) {
      if (ema5Ref.current) 
        ema5Ref.current.applyOptions({ visible: true });
      
      if (ema20Ref.current) 
        ema20Ref.current.applyOptions({ visible: true });
      
      if (ema48Ref.current) 
        ema48Ref.current.applyOptions({ visible: true });
      
      if (ema120Ref.current) 
        ema120Ref.current.applyOptions({ visible: true });
      
      if (ema240Ref.current) 
        ema240Ref.current.applyOptions({ visible: true });
      
      if (rsiRef.current)
        rsiRef.current.applyOptions({ visible: true });
    }
  }, [showMA, data.length]);

  // 데이터 변경 감지 전용 useEffect - 차트가 이미 생성된 경우 데이터만 업데이트
  useEffect(() => {
    console.log('Data change detected in PolMACDChartFixed:', {
      dataLength: data?.length || 0,
      hasChart: !!chartRef.current,
      hasCandleSeries: !!candleRef.current,
      isChartReady: isChartReady
    });
    
    if (!data || data.length === 0) return;
    if (!isChartReady) {
      console.log('Chart not ready yet, skipping data update');
      return;
    }
    if (!chartRef.current || !candleRef.current) return;
    
    // 기존 차트에 새 데이터 업데이트
    console.log('Updating existing chart with new data');
    const { macdData, signalData, histogramData, markers, ema5Data, ema20Data } = calculateMACD(data);
    
    // 캔들 데이터 업데이트
    candleRef.current.setData(data);
    
    // MACD 데이터 업데이트
    if (macdRef.current) macdRef.current.setData(macdData);
    if (signalRef.current) signalRef.current.setData(signalData);
    if (histogramRef.current) histogramRef.current.setData(histogramData);
    
    // 마커 업데이트
    if (markers && markers.length > 0) {
      console.log('Updating markers on data change:', markers.length);
      setChartMarkers(markers);
    }
  }, [data, isChartReady]);

  return (
    <div className="chart-wrapper">
      <div ref={chartContainerRef} style={{ width: '100%', height: `${height}px` }} />
      <div className="chart-controls" style={{ marginTop: '20px' }}>
        <button
          className="btn btn-primary"
          onClick={() => setShowBacktestResults(!showBacktestResults)}
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

export default PolMACDChartFixed;