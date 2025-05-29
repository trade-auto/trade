import { CandlestickData } from 'lightweight-charts';

interface PolMACDResult {
  macd: number;
  signal: number;
  waveA: number;
  waveB: number;
  waveC: number;
}

export class PolMACD {
  private lengthMA_MACD: number = 34;
  private lengthSignal: number = 9;
  private alength: number = 5;
  private blength: number = 25;
  private clength: number = 50;
  private lengthMA_Trend: number = 4;
  private cutoff: number = 10;

  // SMMA (Smoothed Moving Average) 계산
  private calcSMMA(data: number[], length: number): number[] {
    const result: number[] = new Array(data.length).fill(0);
    let sum = 0;
    
    // 초기 SMA 계산
    for (let i = 0; i < length; i++) {
      sum += data[i];
    }
    result[length - 1] = sum / length;
    
    // SMMA 계산
    for (let i = length; i < data.length; i++) {
      result[i] = (result[i - 1] * (length - 1) + data[i]) / length;
    }
    
    return result;
  }

  // ZLEMA (Zero-Lag Exponential Moving Average) 계산
  private calcZLEMA(data: number[], length: number): number[] {
    const result: number[] = new Array(data.length).fill(0);
    const alpha = 2 / (length + 1);
    
    // EMA 계산
    const ema1: number[] = new Array(data.length).fill(0);
    const ema2: number[] = new Array(data.length).fill(0);
    
    // 첫 번째 EMA
    ema1[0] = data[0];
    for (let i = 1; i < data.length; i++) {
      ema1[i] = data[i] * alpha + ema1[i - 1] * (1 - alpha);
    }
    
    // 두 번째 EMA
    ema2[0] = ema1[0];
    for (let i = 1; i < data.length; i++) {
      ema2[i] = ema1[i] * alpha + ema2[i - 1] * (1 - alpha);
    }
    
    // ZLEMA 계산
    for (let i = 0; i < data.length; i++) {
      const d = ema1[i] - ema2[i];
      result[i] = ema1[i] + d;
    }
    
    return result;
  }

  // EMA 계산
  private calcEMA(data: number[], length: number): number[] {
    const result: number[] = new Array(data.length).fill(0);
    const alpha = 2 / (length + 1);
    
    result[0] = data[0];
    for (let i = 1; i < data.length; i++) {
      result[i] = data[i] * alpha + result[i - 1] * (1 - alpha);
    }
    
    return result;
  }

  // SMA 계산
  private calcSMA(data: number[], length: number): number[] {
    const result: number[] = new Array(data.length).fill(0);
    
    for (let i = length - 1; i < data.length; i++) {
      let sum = 0;
      for (let j = 0; j < length; j++) {
        sum += data[i - j];
      }
      result[i] = sum / length;
    }
    
    return result;
  }

  // 폴MACD 계산
  calculate(candles: CandlestickData[]): PolMACDResult[] {
    const results: PolMACDResult[] = [];
    
    // HLC3 계산
    const hlc3: number[] = candles.map(candle => 
      (candle.high + candle.low + candle.close) / 3
    );
    
    // 고가, 저가 배열
    const highs: number[] = candles.map(candle => candle.high);
    const lows: number[] = candles.map(candle => candle.low);
    
    // SMMA 계산
    const hi = this.calcSMMA(highs, this.lengthMA_MACD);
    const lo = this.calcSMMA(lows, this.lengthMA_MACD);
    const mi = this.calcZLEMA(hlc3, this.lengthMA_MACD);
    
    // Wave 계산
    const emaA = this.calcEMA(hlc3, this.alength);
    const emaB = this.calcEMA(hlc3, this.blength);
    const emaC = this.calcEMA(hlc3, this.clength);
    
    const waveAData = hlc3.map((value, i) => value - emaA[i]);
    const waveBData = hlc3.map((value, i) => value - emaB[i]);
    const waveCData = hlc3.map((value, i) => value - emaC[i]);
    
    const waveA = this.calcSMA(waveAData, this.lengthMA_Trend);
    const waveB = this.calcSMA(waveBData, this.lengthMA_Trend);
    const waveC = this.calcSMA(waveCData, this.lengthMA_Trend);
    
    // MACD 계산
    const macd: number[] = new Array(candles.length).fill(0);
    for (let i = 0; i < candles.length; i++) {
      if (mi[i] > hi[i]) {
        macd[i] = mi[i] - hi[i];
      } else if (mi[i] < lo[i]) {
        macd[i] = mi[i] - lo[i];
      } else {
        macd[i] = 0;
      }
    }
    
    // Signal 계산
    const signal = this.calcSMA(macd, this.lengthSignal);
    
    // 결과 생성
    for (let i = 0; i < candles.length; i++) {
      results.push({
        macd: macd[i],
        signal: signal[i],
        waveA: waveA[i],
        waveB: waveB[i],
        waveC: waveC[i]
      });
    }
    
    return results;
  }
} 