import React, { useEffect, useRef, useState } from 'react';
import { createChart, IChartApi, ISeriesApi, Time } from 'lightweight-charts';
import { CandlestickData, BacktestResult, Trade } from '../types/candlestick';
import BacktestResults from './BacktestResults';

interface SeparatedStrategyChartsProps {
  data: CandlestickData[];
  height?: number;
}

const SeparatedStrategyCharts: React.FC<SeparatedStrategyChartsProps> = ({ data, height = 400 }) => {
  const emaChartRef = useRef<HTMLDivElement>(null);
  const macdChartRef = useRef<HTMLDivElement>(null);
  const rsiChartRef = useRef<HTMLDivElement>(null);
  
  const [emaChartApi, setEmaChartApi] = useState<IChartApi | null>(null);
  const [macdChartApi, setMacdChartApi] = useState<IChartApi | null>(null);
  const [rsiChartApi, setRsiChartApi] = useState<IChartApi | null>(null);
  
  // 백테스트 관련 상태
  const [backtestResult, setBacktestResult] = useState<BacktestResult | null>(null);
  const [showBacktestResults, setShowBacktestResults] = useState(true);

  // EMA 계산 함수
  const calculateEMA = (data: CandlestickData[], period: number) => {
    if (data.length < period) return [];
    
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

  // MACD 계산 함수
  const calculateMACD = (data: CandlestickData[]) => {
    const closePrices = data.map(item => item.close);
    const ema12Values: number[] = [];
    const ema26Values: number[] = [];
    const macdValues: number[] = [];
    const signalValues: number[] = [];
    const histogramValues: number[] = [];

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

    // MACD 계산
    for (let i = 0; i < ema12Values.length; i++) {
      const macd = ema12Values[i] - ema26Values[i];
      macdValues.push(macd);
    }

    // Signal 라인 계산
    let multiplier9 = 2 / (9 + 1);
    let signal = macdValues[0];
    signalValues.push(signal);

    for (let i = 1; i < macdValues.length; i++) {
      signal = (macdValues[i] - signal) * multiplier9 + signal;
      signalValues.push(signal);
    }

    // Histogram 계산
    for (let i = 0; i < macdValues.length; i++) {
      const histogram = macdValues[i] - signalValues[i];
      histogramValues.push(histogram);
    }

    return { macdValues, signalValues, histogramValues };
  };

  // RSI 계산 함수
  const calculateRSI = (data: CandlestickData[], period = 20) => {
    const results: { time: Time; value: number }[] = [];
    
    if (data.length <= period) return results;
    
    const closes = data.map(d => d.close);
    
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
    
    let rsi = avgLoss === 0 ? 100 : 100 - (100 / (1 + (avgGain / avgLoss)));
    results.push({
      time: data[period].time as Time,
      value: rsi
    });
    
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
    
    return results;
  };

  // ATR 계산 함수
  const calculateATR = (data: CandlestickData[], period = 14) => {
    const results: { time: Time; value: number }[] = [];
    
    if (data.length < period + 1) return results;
    
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
    
    let atr = trueRanges.slice(0, period).reduce((sum, tr) => sum + tr, 0) / period;
    results.push({
      time: data[period].time as Time,
      value: atr
    });
    
    for (let i = period; i < trueRanges.length; i++) {
      atr = ((atr * (period - 1)) + trueRanges[i]) / period;
      results.push({
        time: data[i + 1].time as Time,
        value: atr
      });
    }
    
    return results;
  };

  // 백테스트 계산 함수
  const calculateBacktest = (data: CandlestickData[], finalSignals: any[]) => {
    const trades: Trade[] = [];
    let totalValue = 10000000; // 초기 자금 1천만원
    let inPosition = false;
    let entryPrice = 0;
    let entryTime: Time | null = null;
    let currentTrade: Partial<Trade> | null = null;

    // 신호를 시간 순으로 정렬
    const sortedSignals = finalSignals.sort((a, b) => Number(a.time) - Number(b.time));

    for (const signal of sortedSignals) {
      const signalTime = Number(signal.time);
      const candle = data.find(d => Number(d.time) === signalTime);
      if (!candle) continue;

      if (signal.text === '진짜매수' && !inPosition) {
        // 매수 신호
        entryPrice = candle.close;
        entryTime = candle.time;
        inPosition = true;
        
        currentTrade = {
          entryTime,
          entryPrice,
          mode: 'test',
          status: 'open'
        };
        trades.push(currentTrade as Trade);
      } else if (signal.text === '진짜매도' && inPosition && currentTrade) {
        // 매도 신호
        const exitPrice = candle.close;
        const exitTime = candle.time;
        
        const feeRate = 0.0005; // 0.05% 수수료
        const grossReturn = (exitPrice / entryPrice) - 1;
        const netReturn = grossReturn - (feeRate * 2); // 매수, 매도 수수료
        
        currentTrade.exitTime = exitTime;
        currentTrade.exitPrice = exitPrice;
        currentTrade.return = netReturn;
        currentTrade.isSuccess = netReturn > 0;
        currentTrade.status = 'closed';
        
        totalValue = totalValue * (1 + netReturn);
        
        inPosition = false;
        entryPrice = 0;
        entryTime = null;
        currentTrade = null;
      }
    }

    // 통계 계산
    const closedTrades = trades.filter(trade => trade.status === 'closed');
    const winningTrades = closedTrades.filter(trade => (trade.return ?? 0) > 0);
    const totalReturn = (totalValue / 10000000) - 1;
    
    const result: BacktestResult = {
      totalTrades: trades.length,
      successfulTrades: winningTrades.length,
      totalReturn: totalReturn,
      totalNetReturn: totalReturn,
      successRate: closedTrades.length > 0 ? (winningTrades.length / closedTrades.length) * 100 : 0,
      averageReturn: closedTrades.length > 0 ? totalReturn / closedTrades.length : 0,
      averageNetReturn: closedTrades.length > 0 ? totalReturn / closedTrades.length : 0,
      trades: trades
    };

    console.log('백테스트 결과:', {
      총거래: result.totalTrades,
      성공거래: result.successfulTrades,
      승률: result.successRate.toFixed(2) + '%',
      총수익률: (result.totalReturn * 100).toFixed(2) + '%'
    });

    return result;
  };

  // 매매 신호 분석
  const analyzeSignals = () => {
    console.log('🔍 analyzeSignals 시작, 데이터 길이:', data.length);
    
    const ema5Data = calculateEMA(data, 5);
    const ema20Data = calculateEMA(data, 20);
    const ema60Data = calculateEMA(data, 60);
    const ema200Data = calculateEMA(data, 200);
    const { macdValues, signalValues, histogramValues } = calculateMACD(data);
    const rsiData = calculateRSI(data, 20);
    const atrData = calculateATR(data, 14);

    console.log('📊 계산된 지표 길이들:', {
      ema5: ema5Data.length,
      ema20: ema20Data.length,
      ema60: ema60Data.length,
      ema200: ema200Data.length,
      macd: macdValues.length,
      rsi: rsiData.length,
      atr: atrData.length
    });

    // 각 조건별 신호 저장
    const emaSignals: any[] = [];
    const macdSignals: any[] = [];
    const rsiSignals: any[] = [];
    const finalSignals: any[] = [];
    
    // 진짜 매수/매도 신호를 위한 상태 추적
    let rsiConditionMet = false;
    let macdConditionMet = false;
    let rsiSellConditionMet = false;
    let macdSellConditionMet = false;
    let lastSignalType: 'buy' | 'sell' | null = null; // 마지막 신호 타입
    let rsiConditionIndex = -1;
    let macdConditionIndex = -1;

    // 신호 분석 (50번째 캔들부터)
    for (let i = 50; i < data.length; i++) {
      const currentClose = data[i].close;
      const prevClose = data[i - 1].close;
      
      // EMA 조건 체크
      const currentEMA5 = ema5Data[i]?.value;
      const currentEMA20 = ema20Data[i]?.value;
      const currentEMA60 = ema60Data[i]?.value;
      const currentEMA200 = ema200Data[i]?.value;
      const prevEMA200 = ema200Data[i - 5]?.value;
      
      // MACD 조건 체크
      const currentMACD = macdValues[i];
      const currentSignal = signalValues[i];
      const prevMACD = macdValues[i - 1];
      const prevSignal = signalValues[i - 1];
      
      // RSI 조건 체크 (RSI는 period+1번째부터 계산되므로 인덱스 조정)
      const rsiIndex = i - 20; // RSI period(20) + 1 offset
      const currentRSI = rsiIndex >= 0 && rsiIndex < rsiData.length ? rsiData[rsiIndex]?.value : 50;
      const prevRSI = rsiIndex - 1 >= 0 && rsiIndex - 1 < rsiData.length ? rsiData[rsiIndex - 1]?.value : 50;
      const prev2RSI = rsiIndex - 2 >= 0 && rsiIndex - 2 < rsiData.length ? rsiData[rsiIndex - 2]?.value : 50;
      
      // ATR 기반 되돌림 계산
      const atrIndex = i - 15;
      const atrValue = atrIndex >= 0 && atrIndex < atrData.length ? atrData[atrIndex]?.value : 0;
      const ema20Distance = Math.abs(currentClose - currentEMA20);
      
      // EMA 차트 신호 (보라색) - 20 EMA가 60 EMA를 교차
      const prevEMA20 = ema20Data[i - 1]?.value || 0;
      const prevEMA60 = ema60Data[i - 1]?.value || 0;
      const emaGoldenCross = prevEMA20 <= prevEMA60 && currentEMA20 > currentEMA60; // 20 EMA가 60 EMA를 상향 돌파
      const emaDeadCross = prevEMA20 >= prevEMA60 && currentEMA20 < currentEMA60; // 20 EMA가 60 EMA를 하향 돌파
      
      if (emaGoldenCross) {
        console.log(`📈 EMA 골든크로스 발견 at ${i}, time: ${data[i].time}`);
        emaSignals.push({
          time: data[i].time,
          position: 'belowBar' as const,
          color: '#9C27B0',
          shape: 'circle' as const,
          text: 'EMA매수',
          size: 1
        });
      }
      
      if (emaDeadCross) {
        console.log(`📉 EMA 데드크로스 발견 at ${i}, time: ${data[i].time}`);
        emaSignals.push({
          time: data[i].time,
          position: 'aboveBar' as const,
          color: '#9C27B0',
          shape: 'circle' as const,
          text: 'EMA매도',
          size: 1
        });
      }
      
      // MACD 차트 신호 (보라색) - MACD가 Signal을 교차할 때만
      const macdGoldenCross = prevMACD <= prevSignal && currentMACD > currentSignal; // MACD가 Signal을 상향 돌파
      const macdDeadCross = prevMACD >= prevSignal && currentMACD < currentSignal; // MACD가 Signal을 하향 돌파
      
      if (macdGoldenCross) {
        console.log(`🔵 MACD 골든크로스 발견 at ${i}, time: ${data[i].time}, MACD: ${currentMACD.toFixed(4)}, Signal: ${currentSignal.toFixed(4)}`);
        macdSignals.push({
          time: data[i].time,
          value: currentMACD,
          color: '#9C27B0',
          shape: 'arrowUp' as const,
          text: 'MACD매수',
          size: 1
        });
      }
      
      if (macdDeadCross) {
        console.log(`🔴 MACD 데드크로스 발견 at ${i}, time: ${data[i].time}, MACD: ${currentMACD.toFixed(4)}, Signal: ${currentSignal.toFixed(4)}`);
        macdSignals.push({
          time: data[i].time,
          value: currentMACD,
          color: '#9C27B0',
          shape: 'arrowDown' as const,
          text: 'MACD매도',
          size: 1
        });
      }
      
      // RSI 차트 신호 (보라색) - 50% 기준 교차
      const rsiAbove50 = prevRSI <= 50 && currentRSI > 50; // RSI가 50을 상향 돌파
      const rsiBelow50 = prevRSI >= 50 && currentRSI < 50; // RSI가 50을 하향 돌파
      
      if (rsiAbove50) {
        console.log(`🟢 RSI 50 상향돌파 발견 at ${i}, time: ${data[i].time}, RSI: ${currentRSI.toFixed(2)}`);
        rsiSignals.push({
          time: data[i].time,
          value: currentRSI,
          color: '#9C27B0',
          shape: 'arrowUp' as const,
          text: 'RSI매수',
          size: 1
        });
      }
      
      if (rsiBelow50) {
        console.log(`🟠 RSI 50 하향돌파 발견 at ${i}, time: ${data[i].time}, RSI: ${currentRSI.toFixed(2)}`);
        rsiSignals.push({
          time: data[i].time,
          value: currentRSI,
          color: '#9C27B0',
          shape: 'arrowDown' as const,
          text: 'RSI매도',
          size: 1
        });
      }
      
      // 진짜 매수/매도 신호 로직
      // RSI 조건 추적
      if (rsiAbove50) {
        rsiConditionMet = true;
        rsiConditionIndex = i;
      }
      
      // MACD 조건 추적
      if (macdGoldenCross) {
        macdConditionMet = true;
        macdConditionIndex = i;
      }
      
      // 매도용 RSI 조건 추적
      if (rsiBelow50) {
        rsiSellConditionMet = true;
      }
      
      // 매도용 MACD 조건 추적
      if (macdDeadCross) {
        macdSellConditionMet = true;
      }
      
      // 200 EMA 기울기 확인 (5개 캔들 비교)
      const ema200Rising = currentEMA200 > ema200Data[i - 5]?.value;
      const ema200Falling = currentEMA200 < ema200Data[i - 5]?.value;
      
      // 진짜 매수 조건:
      // 1. RSI 매수 신호가 발생했고
      // 2. MACD 매수 신호가 발생했고
      // 3. 그 이후에 20 EMA가 60 EMA를 상향 돌파
      // 4. 마지막 신호가 매도가 아님
      // 5. 200 EMA가 상승 중
      if (rsiConditionMet && macdConditionMet && emaGoldenCross && 
          lastSignalType !== 'sell' && ema200Rising) {
        console.log(`🎯 진짜매수 신호 생성! at ${i}, time: ${data[i].time}`, {
          rsiConditionMet,
          macdConditionMet,
          emaGoldenCross,
          lastSignalType,
          ema200Rising,
          rsiConditionIndex,
          macdConditionIndex
        });
        finalSignals.push({
          time: data[i].time,
          position: 'belowBar' as const,
          color: '#0000FF',
          shape: 'arrowUp' as const,
          text: '진짜매수',
          size: 3
        });
        lastSignalType = 'buy';
        // 매수 조건 리셋
        rsiConditionMet = false;
        macdConditionMet = false;
      }
      
      // MACD 신호선 기울기 확인 (10봉 동안 음의 기울기)
      let macdSignalDowntrend = false;
      if (i >= 59) { // 50 + 9 (10봉을 확인하기 위해)
        let negativeCount = 0;
        for (let j = i - 9; j <= i; j++) {
          if (j > 50 && signalValues[j] < signalValues[j - 1]) {
            negativeCount++;
          }
        }
        // 10봉 중 7봉 이상이 음의 기울기면 하락 추세로 판단
        macdSignalDowntrend = negativeCount >= 7;
      }
      
      // 진짜 매도 조건:
      // 1. 이전에 매수 신호가 있었음
      // 2. MACD 신호선이 10봉 동안 음의 기울기
      if (lastSignalType === 'buy' && macdSignalDowntrend) {
        console.log(`🎯 진짜매도 신호 생성! at ${i}, time: ${data[i].time}`, {
          lastSignalType,
          macdSignalDowntrend
        });
        finalSignals.push({
          time: data[i].time,
          position: 'aboveBar' as const,
          color: '#FF0000',
          shape: 'arrowDown' as const,
          text: '진짜매도',
          size: 3
        });
        lastSignalType = 'sell';
        // 매도 조건 리셋
        rsiSellConditionMet = false;
        macdSellConditionMet = false;
      }
    }

    console.log('📊 신호 분석 완료:', {
      'EMA 신호': emaSignals.length,
      'MACD 신호': macdSignals.length,
      'RSI 신호': rsiSignals.length,
      '최종 매수/매도 신호': finalSignals.length
    });

    // 백테스트 계산
    const backtestResult = calculateBacktest(data, finalSignals);
    setBacktestResult(backtestResult);

    return { ema5Data, ema20Data, ema60Data, ema200Data, macdValues, signalValues, histogramValues, rsiData, emaSignals, macdSignals, rsiSignals, finalSignals };
  };

  useEffect(() => {
    if (!data || data.length === 0) return;
    if (!emaChartRef.current || !macdChartRef.current || !rsiChartRef.current) return;

    const { ema5Data, ema20Data, ema60Data, ema200Data, macdValues, signalValues, histogramValues, rsiData, emaSignals, macdSignals, rsiSignals, finalSignals } = analyzeSignals();

    // EMA 차트 생성
    const emaChart = createChart(emaChartRef.current, {
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
      },
    });

    const emaCandleSeries = emaChart.addCandlestickSeries({
      upColor: '#26A69A',
      downColor: '#EF5350',
      borderVisible: false,
      wickUpColor: '#26A69A',
      wickDownColor: '#EF5350',
    });
    emaCandleSeries.setData(data);

    // EMA 라인 추가
    const ema5Series = emaChart.addLineSeries({
      color: '#00BCD4',
      lineWidth: 2,
      title: '5 EMA',
    });
    ema5Series.setData(ema5Data);

    const ema20Series = emaChart.addLineSeries({
      color: '#FFC107',
      lineWidth: 2,
      title: '20 EMA',
    });
    ema20Series.setData(ema20Data);

    const ema60Series = emaChart.addLineSeries({
      color: '#FF5722',
      lineWidth: 2,
      title: '60 EMA',
    });
    ema60Series.setData(ema60Data);

    const ema200Series = emaChart.addLineSeries({
      color: '#673AB7',
      lineWidth: 3,
      title: '200 EMA',
    });
    ema200Series.setData(ema200Data);

    // EMA 차트에는 EMA 신호 + 진짜 매수/매도 신호 표시
    const allEmaMarkers = [...emaSignals, ...finalSignals].sort((a, b) => {
      const timeA = Number(a.time);
      const timeB = Number(b.time);
      return timeA - timeB;
    });
    
    console.log('🎨 EMA 차트 마커 설정:', {
      'EMA 신호 마커': emaSignals.length,
      '최종 신호 마커': finalSignals.length,
      '전체 마커': allEmaMarkers.length
    });
    
    // EMA 차트에 마커 설정
    if (allEmaMarkers.length > 0) {
      console.log('✅ EMA 차트에 마커 설정 중...', allEmaMarkers.slice(0, 2));
      emaCandleSeries.setMarkers(allEmaMarkers);
    } else {
      console.log('❌ EMA 차트에 설정할 마커가 없음');
    }

    // MACD 차트 생성
    const macdChart = createChart(macdChartRef.current, {
      height: height * 0.4,
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

    const macdSeries = macdChart.addLineSeries({
      color: '#2962FF',
      lineWidth: 2,
      title: 'MACD',
    });
    macdSeries.setData(macdData);

    const signalSeries = macdChart.addLineSeries({
      color: '#FF6D00',
      lineWidth: 2,
      title: 'Signal',
    });
    signalSeries.setData(signalData);

    const histogramSeries = macdChart.addHistogramSeries({
      color: 'rgba(0, 150, 136, 0.3)',
    });
    histogramSeries.setData(histogramData);

    // MACD 0선
    const zeroLine = macdChart.addLineSeries({
      color: '#666666',
      lineWidth: 1,
    });
    zeroLine.setData([
      { time: data[0].time, value: 0 },
      { time: data[data.length - 1].time, value: 0 },
    ]);
    
    // MACD 차트에 MACD 신호 표시
    console.log('🎨 MACD 차트 마커 설정:', {
      'MACD 신호 마커': macdSignals.length
    });
    
    if (macdSignals.length > 0) {
      const macdMarkers = macdSignals.map(signal => ({
        time: signal.time,
        position: 'aboveBar' as const,
        color: signal.color,
        shape: signal.shape,
        text: signal.text,
        size: signal.size
      })).sort((a, b) => {
        const timeA = Number(a.time);
        const timeB = Number(b.time);
        return timeA - timeB;
      });
      
      console.log('✅ MACD 차트에 마커 설정 중...', macdMarkers.slice(0, 2));
      macdSeries.setMarkers(macdMarkers);
    } else {
      console.log('❌ MACD 차트에 설정할 마커가 없음');
    }

    // RSI 차트 생성
    const rsiChart = createChart(rsiChartRef.current, {
      height: height * 0.3,
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

    const rsiSeries = rsiChart.addLineSeries({
      color: '#FF1744',
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
    
    // RSI 차트에 RSI 신호 표시
    console.log('🎨 RSI 차트 마커 설정:', {
      'RSI 신호 마커': rsiSignals.length
    });
    
    if (rsiSignals.length > 0) {
      const rsiMarkers = rsiSignals.map(signal => ({
        time: signal.time,
        position: 'aboveBar' as const,
        color: signal.color,
        shape: signal.shape,
        text: signal.text,
        size: signal.size
      })).sort((a, b) => {
        const timeA = Number(a.time);
        const timeB = Number(b.time);
        return timeA - timeB;
      });
      
      console.log('✅ RSI 차트에 마커 설정 중...', rsiMarkers.slice(0, 2));
      rsiSeries.setMarkers(rsiMarkers);
    } else {
      console.log('❌ RSI 차트에 설정할 마커가 없음');
    }

    // 시간축 동기화
    const syncTimeScale = () => {
      const visibleRange = emaChart.timeScale().getVisibleRange();
      if (visibleRange) {
        macdChart.timeScale().setVisibleRange(visibleRange);
        rsiChart.timeScale().setVisibleRange(visibleRange);
      }
    };

    emaChart.timeScale().subscribeVisibleTimeRangeChange(syncTimeScale);
    macdChart.timeScale().subscribeVisibleTimeRangeChange(() => {
      const visibleRange = macdChart.timeScale().getVisibleRange();
      if (visibleRange) {
        emaChart.timeScale().setVisibleRange(visibleRange);
        rsiChart.timeScale().setVisibleRange(visibleRange);
      }
    });
    rsiChart.timeScale().subscribeVisibleTimeRangeChange(() => {
      const visibleRange = rsiChart.timeScale().getVisibleRange();
      if (visibleRange) {
        emaChart.timeScale().setVisibleRange(visibleRange);
        macdChart.timeScale().setVisibleRange(visibleRange);
      }
    });

    // 차트 맞춤
    emaChart.timeScale().fitContent();
    macdChart.timeScale().fitContent();
    rsiChart.timeScale().fitContent();

    setEmaChartApi(emaChart);
    setMacdChartApi(macdChart);
    setRsiChartApi(rsiChart);

    // 창 크기 조절 대응
    const handleResize = () => {
      if (emaChartRef.current && macdChartRef.current && rsiChartRef.current) {
        emaChart.applyOptions({ width: emaChartRef.current.clientWidth });
        macdChart.applyOptions({ width: macdChartRef.current.clientWidth });
        rsiChart.applyOptions({ width: rsiChartRef.current.clientWidth });
      }
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      emaChart.remove();
      macdChart.remove();
      rsiChart.remove();
    };
  }, [data, height]);

  return (
    <div className="separated-charts-container">
      <h2 className="text-white text-xl mb-2">분리된 전략 차트</h2>
      
      <div className="chart-section mb-4">
        <h3 className="text-white text-lg mb-1">EMA 차트 (캔들 + 최종 매수/매도 신호)</h3>
        <div className="text-gray-300 text-sm mb-2">
          보라색: EMA 조건 충족 | 청색: 매수 신호 | 적색: 매도 신호
        </div>
        <div ref={emaChartRef} style={{ width: '100%', height: `${height}px` }} />
      </div>
      
      <div className="chart-section mb-4">
        <h3 className="text-white text-lg mb-1">MACD 차트</h3>
        <div className="text-gray-300 text-sm mb-2">
          보라색: MACD 조건 충족 (골든크로스/약세)
        </div>
        <div ref={macdChartRef} style={{ width: '100%', height: `${height * 0.4}px` }} />
      </div>
      
      <div className="chart-section mb-4">
        <h3 className="text-white text-lg mb-1">RSI 차트</h3>
        <div className="text-gray-300 text-sm mb-2">
          보라색: RSI 조건 충족 (55 돌파/과매수)
        </div>
        <div ref={rsiChartRef} style={{ width: '100%', height: `${height * 0.3}px` }} />
      </div>
      
      {/* 백테스트 결과 섹션 */}
      <div className="chart-section mb-4">
        <div className="flex justify-between items-center mb-2">
          <h3 className="text-white text-lg mb-1">백테스트 결과</h3>
          <button
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
            onClick={() => setShowBacktestResults(!showBacktestResults)}
          >
            {showBacktestResults ? '결과 숨기기' : '결과 보기'}
          </button>
        </div>
        
        {showBacktestResults && backtestResult && (
          <BacktestResults backtestResult={backtestResult} />
        )}
      </div>
    </div>
  );
};

export default SeparatedStrategyCharts;