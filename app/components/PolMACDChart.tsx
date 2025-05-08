import React, { useEffect, useRef, useState, useCallback } from 'react';
import { createChart, IChartApi, ISeriesApi, Time, CandlestickData as LightweightCandlestickData, LineData, HistogramData, UTCTimestamp } from 'lightweight-charts';
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

// EMA 계산 함수
const calculateEMA = (closes: number[], period: number): (number | null)[] => {
  const k = 2 / (period + 1);
  const ema: (number | null)[] = Array(closes.length).fill(null);
  
  let sum = 0;
  for (let i = 0; i < period; i++) {
    sum += closes[i];
  }
  ema[period - 1] = sum / period;
  
  for (let i = period; i < closes.length; i++) {
    ema[i] = closes[i] * k + (ema[i - 1] || 0) * (1 - k);
  }
  
  return ema;
};

// RSI 계산 함수
const calculateRSI = (closes: number[], period: number): (number | null)[] => {
  const rsi: (number | null)[] = Array(closes.length).fill(null);
  const gains: number[] = Array(closes.length).fill(0);
  const losses: number[] = Array(closes.length).fill(0);
  
  // 가격 변화 계산
  for (let i = 1; i < closes.length; i++) {
    const change = closes[i] - closes[i - 1];
    gains[i] = change > 0 ? change : 0;
    losses[i] = change < 0 ? Math.abs(change) : 0;
  }
  
  // 초기 평균 이득/손실 계산
  let avgGain = 0;
  let avgLoss = 0;
  
  for (let i = 1; i <= period; i++) {
    avgGain += gains[i];
    avgLoss += losses[i];
  }
  
  avgGain /= period;
  avgLoss /= period;
  
  // 첫 RSI 계산
  if (avgLoss === 0) {
    rsi[period] = 100;
  } else {
    const rs = avgGain / avgLoss;
    rsi[period] = 100 - (100 / (1 + rs));
  }
  
  // 나머지 기간의 RSI 계산
  for (let i = period + 1; i < closes.length; i++) {
    avgGain = ((avgGain * (period - 1)) + gains[i]) / period;
    avgLoss = ((avgLoss * (period - 1)) + losses[i]) / period;
    
    if (avgLoss === 0) {
      rsi[i] = 100;
    } else {
      const rs = avgGain / avgLoss;
      rsi[i] = 100 - (100 / (1 + rs));
    }
  }
  
  return rsi;
};

// 스토캐스틱 계산 함수
const calculateStochastic = (data: CandlestickData[], kPeriod: number, dPeriod: number): { k: (number | null)[]; d: (number | null)[] } => {
  const stochK: (number | null)[] = Array(data.length).fill(null);
  const stochD: (number | null)[] = Array(data.length).fill(null);
  
  // %K 계산
  for (let i = kPeriod - 1; i < data.length; i++) {
    let highestHigh = -Infinity;
    let lowestLow = Infinity;
    
    for (let j = i - (kPeriod - 1); j <= i; j++) {
      highestHigh = Math.max(highestHigh, data[j].high);
      lowestLow = Math.min(lowestLow, data[j].low);
    }
    
    const range = highestHigh - lowestLow;
    if (range === 0) {
      stochK[i] = 100;
    } else {
      stochK[i] = ((data[i].close - lowestLow) / range) * 100;
    }
  }
  
  // %D 계산 (단순 이동 평균)
  for (let i = kPeriod + dPeriod - 2; i < data.length; i++) {
    let sum = 0;
    for (let j = i - (dPeriod - 1); j <= i; j++) {
      sum += stochK[j] || 0;
    }
    stochD[i] = sum / dPeriod;
  }
  
  return { k: stochK, d: stochD };
};

// ATR 계산 함수
const calculateATR = (data: CandlestickData[], period: number): (number | null)[] => {
  const tr: number[] = Array(data.length).fill(0);
  const atr: (number | null)[] = Array(data.length).fill(null);
  
  // True Range 계산
  tr[0] = data[0].high - data[0].low; // 첫 TR은 고가-저가
  
  for (let i = 1; i < data.length; i++) {
    const high = data[i].high;
    const low = data[i].low;
    const prevClose = data[i - 1].close;
    
    const tr1 = high - low;
    const tr2 = Math.abs(high - prevClose);
    const tr3 = Math.abs(low - prevClose);
    
    tr[i] = Math.max(tr1, tr2, tr3);
  }
  
  // 초기 ATR 계산 (단순 평균)
  let sum = 0;
  for (let i = 0; i < period; i++) {
    sum += tr[i];
  }
  atr[period - 1] = sum / period;
  
  // 이후 기간의 ATR 계산 (와일더 스무딩)
  for (let i = period; i < data.length; i++) {
    atr[i] = ((atr[i - 1] || 0) * (period - 1) + tr[i]) / period;
  }
  
  return atr;
};

// 평균 거래량 계산 함수
const calculateAverageVolume = (data: CandlestickData[], period: number): (number | null)[] => {
  const avgVolume: (number | null)[] = Array(data.length).fill(null);
  
  for (let i = period - 1; i < data.length; i++) {
    let sum = 0;
    let validCount = 0;
    
    for (let j = i - (period - 1); j <= i; j++) {
      const volume = data[j].volume;
      if (volume !== undefined && volume !== null) {
        sum += volume;
        validCount++;
      }
    }
    
    avgVolume[i] = validCount > 0 ? sum / validCount : null;
  }
  
  return avgVolume;
};

const PolMACDChart: React.FC<PolMACDChartProps> = ({ data: initialData, height = 400, showMA, onBacktestResultChange }) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const ema50Ref = useRef<ISeriesApi<'Line'> | null>(null);
  const ema200Ref = useRef<ISeriesApi<'Line'> | null>(null);

  const [backtestResult, setBacktestResult] = useState<BacktestResult | null>(null);
  const [showBacktestResults, setShowBacktestResults] = useState(false);

  const runStrategyAndBacktest = useCallback((data: CandlestickData[]) => {
    if (!data || data.length < 200) {
      console.warn("Not enough data for strategy calculation.");
      return { strategyData: null, backtestResult: null };
    }

    const closes = data.map(d => d.close);
    const ema50 = calculateEMA(closes, 50);
    const ema200 = calculateEMA(closes, 200);
    const rsi14 = calculateRSI(closes, 14);
    const stochastic = calculateStochastic(data, 14, 3);
    const atr14 = calculateATR(data, 14);
    const avgVolume20 = calculateAverageVolume(data, 20);

    const signals: ('buy' | 'sell' | null)[] = Array(data.length).fill(null);
    const trades: Trade[] = [];
    let inPosition = false;
    let entryPrice = 0;
    let entryTime: Time | null = null;
    let currentTrade: Trade | null = null;
    let stopLossPrice = 0;
    let takeProfitPrice = 0;
    let initialCapital = 10000000;
    let currentCapital = initialCapital;
    const riskPerTrade = 0.01;

    for (let i = 200; i < data.length; i++) {
      const currentEma50 = ema50[i];
      const currentEma200 = ema200[i];
      const currentRsi = rsi14[i];
      const prevRsi = rsi14[i-1];
      const currentStochK = stochastic.k[i];
      const currentStochD = stochastic.d[i];
      const prevStochK = stochastic.k[i-1];
      const prevStochD = stochastic.d[i-1];
      const currentAtr = atr14[i];
      const currentVolume = data[i].volume ?? 0;
      const currentAvgVol = avgVolume20[i];
      const currentClose = data[i].close;
      const currentLow = data[i].low;
      const currentHigh = data[i].high;
      const currentTime = data[i].time;
      const nextOpen = data[i+1]?.open;

      if (inPosition && currentTrade && currentAtr) {
        let exitReason = '';
        let exitPrice = 0;
        let exitTime = currentTime;

        if (currentLow <= stopLossPrice) {
          exitPrice = stopLossPrice;
          exitReason = 'Stop Loss';
          inPosition = false;
        } else if (currentHigh >= takeProfitPrice) {
          exitPrice = takeProfitPrice;
          exitReason = 'Take Profit';
          inPosition = false;
        } else if (currentClose < (currentEma50 ?? Infinity)) {
          exitPrice = currentClose;
          exitReason = 'Trend Reversal (EMA50 Cross)';
          inPosition = false;
        }

        if (!inPosition && currentTrade) {
          signals[i] = 'sell';
          const entryP = currentTrade.entryPrice!;
          const ret = (exitPrice / entryP) - 1;
          currentTrade.exitTime = exitTime;
          currentTrade.exitPrice = exitPrice;
          currentTrade.return = ret;
          currentTrade.isSuccess = ret > 0;
          currentTrade.status = 'closed';
          (currentTrade as any).exitReason = exitReason;

          const positionSize = currentTrade.positionSize ?? 0;
          currentCapital += positionSize * entryP * ret;

          console.log(`Trade Closed: ${exitReason} at ${exitPrice}, Return: ${ret.toFixed(4)}, Capital: ${currentCapital.toFixed(0)}`);

          trades.push(currentTrade as Trade);
          currentTrade = null;
          entryPrice = 0;
          stopLossPrice = 0;
          takeProfitPrice = 0;
        }
      }

      if (!inPosition && currentEma50 && currentEma200 && currentRsi && prevRsi && 
          currentStochK && currentStochD && prevStochK && prevStochD && 
          currentAvgVol && currentAtr && nextOpen) {
        
        const isUptrend = currentEma50 > currentEma200;

        const pulledBack = currentLow <= currentEma50 || data[i-1]?.low <= (ema50[i-1] ?? Infinity);

        const rsiBounced = prevRsi <= 40 && currentRsi > 40;

        const stochCrossed = (prevStochK <= prevStochD) && (currentStochK > currentStochD);

        const volumeConfirmed = currentVolume >= (currentAvgVol * 1.2);

        if (isUptrend && pulledBack && rsiBounced && stochCrossed && volumeConfirmed) {
          signals[i+1] = 'buy';
          entryPrice = nextOpen;
          entryTime = data[i+1].time;
          stopLossPrice = entryPrice - (currentAtr * 1.2);
          takeProfitPrice = entryPrice + (currentAtr * 1.8);

          const riskAmount = currentCapital * riskPerTrade;
          const riskPerShare = entryPrice - stopLossPrice;
          const positionSize = riskPerShare > 0 ? Math.floor(riskAmount / riskPerShare) : 0;

          if (positionSize > 0 && currentCapital >= positionSize * entryPrice) {
            inPosition = true;
            currentTrade = {
              entryTime,
              entryPrice,
              stopLoss: stopLossPrice,
              takeProfit: takeProfitPrice,
              positionSize: positionSize,
              mode: 'test',
              status: 'open'
            } as Trade;
            console.log(`Trade Opened: Entry at ${entryPrice}, SL: ${stopLossPrice}, TP: ${takeProfitPrice}, Size: ${positionSize}, Capital: ${currentCapital.toFixed(0)}`);
          } else {
            console.log(`Entry Skipped: Insufficient capital or zero position size.`);
            signals[i+1] = null;
            entryPrice = 0;
            entryTime = null;
            stopLossPrice = 0;
            takeProfitPrice = 0;
          }
        }
      }
    }

    const closedTrades = trades.filter(t => t.status === 'closed');
    const winningTrades = closedTrades.filter(trade => (trade.return ?? 0) > 0);
    const feeRate = 0.0005;
    const totalReturn = (currentCapital / initialCapital) - 1;
    const totalFees = closedTrades.length * feeRate * 2 * initialCapital;
    const totalNetReturn = ((currentCapital - totalFees) / initialCapital) - 1;

    const finalResult: BacktestResult = {
      totalTrades: trades.length,
      successfulTrades: winningTrades.length,
      totalReturn: totalReturn * 100,
      totalNetReturn: totalNetReturn * 100,
      successRate: closedTrades.length > 0 ? (winningTrades.length / closedTrades.length) * 100 : 0,
      averageReturn: closedTrades.length > 0 ? (totalReturn / closedTrades.length) * 100 : 0,
      averageNetReturn: closedTrades.length > 0 ? (totalNetReturn / closedTrades.length) * 100 : 0,
      trades: trades
    };

    console.log('백테스트 계산 완료:', finalResult);

    const ema50Data = ema50.map((value, index) => ({ time: data[index].time as UTCTimestamp, value: value ?? undefined })).filter(d => d.value !== undefined) as LineData[];
    const ema200Data = ema200.map((value, index) => ({ time: data[index].time as UTCTimestamp, value: value ?? undefined })).filter(d => d.value !== undefined) as LineData[];

    const markers = signals.map((signal, index) => {
      if (signal === 'buy') {
        return {
          time: data[index].time as UTCTimestamp,
          position: 'belowBar',
          color: '#0000FF',
          shape: 'arrowUp',
          text: `매수 @ ${data[index].open.toFixed(2)}`,
          size: 2,
        };
      } else if (signal === 'sell') {
        const closingTrade = trades.find(t => t.exitTime === data[index].time && t.status === 'closed');
        return {
          time: data[index].time as UTCTimestamp,
          position: 'aboveBar',
          color: '#FF0000',
          shape: 'arrowDown',
          text: `청산 @ ${closingTrade?.exitPrice?.toFixed(2) ?? data[index].close.toFixed(2)} (${(closingTrade as any)?.exitReason || 'Close'})`,
          size: 2,
        };
      }
      return null;
    }).filter(marker => marker !== null);

    return {
      strategyData: { ema50Data, ema200Data, markers },
      backtestResult: finalResult
    };
  }, []);

  useEffect(() => {
    if (initialData.length === 0 || !chartContainerRef.current) return;

    const { strategyData, backtestResult: result } = runStrategyAndBacktest(initialData);

    setBacktestResult(result);
    if (onBacktestResultChange) {
      onBacktestResultChange(result);
    }

    const chart = createChart(chartContainerRef.current, {
      height: height,
      layout: { background: { color: '#ffffff' }, textColor: '#333' },
      grid: { vertLines: { color: '#f0f0f0' }, horzLines: { color: '#f0f0f0' } },
      rightPriceScale: { borderColor: '#d1d4dc' },
      timeScale: { borderColor: '#d1d4dc', timeVisible: true, secondsVisible: false },
      handleScroll: true,
      handleScale: true,
    });
    chartRef.current = chart;

    const candleSeries = chart.addCandlestickSeries({
      upColor: '#4CAF50', downColor: '#F44336', borderVisible: false, wickUpColor: '#4CAF50', wickDownColor: '#F44336',
    });
    const formattedCandleData = initialData.map(d => ({
      time: d.time as UTCTimestamp,
      open: d.open,
      high: d.high,
      low: d.low,
      close: d.close
    }));
    candleSeries.setData(formattedCandleData);
    candleRef.current = candleSeries;

    if (strategyData) {
      const ema50Series = chart.addLineSeries({ color: '#FFB300', lineWidth: 2, title: 'EMA 50' });
      ema50Series.setData(strategyData.ema50Data);
      ema50Ref.current = ema50Series;

      const ema200Series = chart.addLineSeries({ color: '#005B9A', lineWidth: 2, title: 'EMA 200' });
      ema200Series.setData(strategyData.ema200Data);
      ema200Ref.current = ema200Series;

      if (strategyData.markers && strategyData.markers.length > 0) {
        const validMarkers = strategyData.markers.filter(m => m !== null).map(marker => ({
          time: marker!.time,
          position: marker!.position,
          color: marker!.color,
          shape: marker!.shape,
          text: marker!.text,
          size: marker!.size,
        }));
        candleSeries.setMarkers(validMarkers as any);
      }
    }

    chart.timeScale().fitContent();

    const upbitStore = useUpbitStore.getState();
    if (upbitStore.chartTimeRange) {
      chart.timeScale().setVisibleRange(upbitStore.chartTimeRange);
    }
    chart.timeScale().subscribeVisibleTimeRangeChange((range) => {
      if (range) {
        useUpbitStore.setState({ chartTimeRange: range });
      }
    });

    const handleResize = () => {
      if (chartRef.current && chartContainerRef.current) {
        chartRef.current.applyOptions({ width: chartContainerRef.current.clientWidth });
      }
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
      }
    };
  }, [initialData, height, runStrategyAndBacktest, onBacktestResultChange]);

  return (
    <div className="chart-wrapper">
      <div ref={chartContainerRef} style={{ width: '100%' }} />
      <div className="chart-controls" style={{ marginTop: '20px' }}>
        <button
          className="btn btn-primary"
          onClick={() => setShowBacktestResults(!showBacktestResults)}
          disabled={!backtestResult}
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