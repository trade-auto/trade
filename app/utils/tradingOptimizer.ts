import { CrossPoint } from './tradingStrategy';

// 거래 기록을 위한 인터페이스
export interface Trade {
  entryTime: Date;
  exitTime: Date;
  entryPrice: number;
  exitPrice: number;
  return: number;
  isSuccess: boolean;
  position: 'buy' | 'sell';
}

// 백테스트 결과를 위한 인터페이스
export interface BacktestResult {
  totalTrades: number;
  successfulTrades: number;
  totalReturn: number;
  totalNetReturn: number;
  successRate: number;
  averageReturn: number;
  averageNetReturn: number;
  trades: Trade[];
}

// Q-테이블 타입 정의
export type QTable = Record<string, number[]>;

/**
 * 파이썬 코드와 유사한 방식으로 최적화된 매매 전략을 구현하는 클래스
 */
export class TradingOptimizer {
  private initialCapital: number;
  private capital: number;
  private position: number;
  private feeRate: number;
  private tradeLog: Trade[];
  private minProfitPct: number;
  private consecutiveLosses: number;
  private maxConsecutiveLosses: number;
  private buyPrice: number;
  private qTable: QTable;
  private alpha: number;
  private gamma: number;
  private epsilon: number;
  private prevNetWorth: number;
  private prevMacdLine: number | null;
  private prevMacdSignal: number | null;

  /**
   * 생성자
   * @param initialCapital 초기 자본금
   * @param feeRate 수수료율
   * @param minProfitPct 최소 수익률
   * @param maxConsecutiveLosses 최대 연속 손실 허용 횟수
   */
  constructor(
    initialCapital: number = 10000,
    feeRate: number = 0.0005,
    minProfitPct: number = 0.0015,
    maxConsecutiveLosses: number = 3
  ) {
    this.initialCapital = initialCapital;
    this.capital = initialCapital;
    this.position = 0;
    this.feeRate = feeRate;
    this.tradeLog = [];
    this.minProfitPct = minProfitPct;
    this.consecutiveLosses = 0;
    this.maxConsecutiveLosses = maxConsecutiveLosses;
    this.buyPrice = 0;
    this.qTable = this.initQTable();
    this.alpha = 0.2;
    this.gamma = 0.95;
    this.epsilon = 0.05;
    this.prevNetWorth = initialCapital;
    this.prevMacdLine = null;
    this.prevMacdSignal = null;
  }

  /**
   * Q-테이블 초기화
   * @returns 초기화된 Q-테이블
   */
  private initQTable(): QTable {
    const qTable: QTable = {};
    for (let rsi = 0; rsi <= 2; rsi++) {
      for (let macd = 0; macd <= 1; macd++) {
        for (let up = 0; up <= 1; up++) {
          for (let mom = 0; mom <= 1; mom++) {
            const key = `${rsi},${macd},${up},${mom}`;
            qTable[key] = [0, 0, 0]; // HOLD, BUY, SELL
          }
        }
      }
    }
    return qTable;
  }

  /**
   * 상태 생성
   * @param rsi RSI 값
   * @param macdBullish MACD 상승 여부
   * @param uptrend6ea 6개 이동평균 상승 추세 여부
   * @param momentum 모멘텀 값
   * @returns 상태 배열
   */
  private getState(
    rsi: number,
    macdBullish: boolean,
    uptrend6ea: boolean,
    momentum: number
  ): [number, number, number, number] {
    // RSI 상태: 0 (과매도, <30), 1 (중간, 30~70), 2 (과매수, >70)
    let rsiState = 1;
    if (rsi < 30) rsiState = 0;
    else if (rsi > 70) rsiState = 2;

    // MACD 상태: 1이면 bullish (크로스 발생), 0이면 아니면
    const macdState = macdBullish ? 1 : 0;

    // 상승 추세 상태: 1이면 6ea 이동평균 uptrend, 0이면 아니면
    const uptrendState = uptrend6ea ? 1 : 0;

    // 모멘텀 상태: 0 (하락), 1 (상승)
    const momentumState = momentum > 0 ? 1 : 0;

    return [rsiState, macdState, uptrendState, momentumState];
  }

  /**
   * 행동 선택
   * @param state 현재 상태
   * @returns 선택된 행동 (0: HOLD, 1: BUY, 2: SELL)
   */
  private chooseAction(state: [number, number, number, number]): number {
    if (Math.random() < this.epsilon) {
      return Math.floor(Math.random() * 3); // 0, 1, 2 중 랜덤 선택
    } else {
      const stateKey = state.join(',');
      const qValues = this.qTable[stateKey] || [0, 0, 0];
      return qValues.indexOf(Math.max(...qValues));
    }
  }

  /**
   * 순자산 계산
   * @param price 현재 가격
   * @returns 순자산
   */
  private netWorth(price: number): number {
    return this.position === 0 ? this.capital : this.position * price;
  }

  /**
   * 거래 시뮬레이션
   * @param timestamp 타임스탬프
   * @param price 현재 가격
   * @param rsi RSI 값
   * @param macdLine MACD 라인
   * @param macdSignal MACD 시그널
   * @param lowerBand 볼린저 밴드 하단
   * @param upperBand 볼린저 밴드 상단
   * @param momentum 모멘텀 값
   * @param ma60 60초 이동평균
   * @param ma120 120초 이동평균
   * @param ma240 240초 이동평균
   * @param ma300 300초 이동평균
   * @param ma360 360초 이동평균
   * @param ma900 900초 이동평균
   * @returns 거래 결과
   */
  public processTrade(
    timestamp: Date,
    price: number,
    rsi: number,
    macdLine: number,
    macdSignal: number,
    lowerBand: number,
    upperBand: number,
    momentum: number,
    ma60: number,
    ma120: number,
    ma240: number,
    ma300: number,
    ma360: number,
    ma900: number
  ): { action: number; state: [number, number, number, number] } {
    // MACD 크로스 확인
    const macdBullish = this.prevMacdLine !== null && this.prevMacdSignal !== null
      ? (this.prevMacdLine < this.prevMacdSignal) && (macdLine > macdSignal)
      : false;

    // 상승 추세 확인
    const uptrend6ea = ma60 > ma120 && ma120 > ma240 && ma240 > ma300 && ma300 > ma360 && ma360 > ma900;

    // 상태 생성
    const state = this.getState(rsi, macdBullish, uptrend6ea, momentum);

    // 행동 선택
    const action = this.chooseAction(state);

    // 행동 실행
    if (action === 1 && this.position === 0) { // BUY
      // 매수 조건 확인
      if ((state[0] === 0) || // 과매도 상태(RSI<30)
          (state[1] === 1 && state[2] === 1) || // MACD 크로스와 상승추세
          (price < lowerBand * 1.01 && state[3] === 1)) { // 볼린저 밴드 하단 근접 & 모멘텀 상승
        
        // 연속 손실이 너무 많으면 매수 제한
        if (this.consecutiveLosses < this.maxConsecutiveLosses) {
          const effectiveCapital = this.capital * (1 - this.feeRate);
          this.position = effectiveCapital / price;
          this.buyPrice = price;
          
          console.log(`${timestamp.toLocaleTimeString()} - BUY at ${price.toFixed(2)}, RSI: ${rsi.toFixed(2)}, Position: ${this.position.toFixed(6)}`);
          
          this.tradeLog.push({
            entryTime: new Date(timestamp),
            exitTime: new Date(0), // 임시값
            entryPrice: price,
            exitPrice: 0, // 임시값
            return: 0, // 임시값
            isSuccess: false, // 임시값
            position: 'buy'
          });
        }
      }
    } else if (action === 2 && this.position > 0) { // SELL
      // 매도 조건 확인
      const profitPct = (price / this.buyPrice - 1);
      
      if ((state[0] === 2) || // 과매수 상태(RSI>70)
          (profitPct >= this.minProfitPct) || // 최소 수익률 이상
          (price > upperBand * 0.99)) { // 볼린저 밴드 상단 근접
        
        const effectiveCapital = this.position * price * (1 - this.feeRate);
        this.capital = effectiveCapital;
        
        // 마지막 거래 업데이트
        if (this.tradeLog.length > 0) {
          const lastTrade = this.tradeLog[this.tradeLog.length - 1];
          lastTrade.exitTime = new Date(timestamp);
          lastTrade.exitPrice = price;
          lastTrade.return = profitPct;
          lastTrade.isSuccess = profitPct > 0;
        }
        
        // 손익 추적
        if (profitPct < 0) {
          this.consecutiveLosses++;
          console.log(`${timestamp.toLocaleTimeString()} - SELL at ${price.toFixed(2)}, RSI: ${rsi.toFixed(2)}, Profit: ${(profitPct * 100).toFixed(2)}%, Position: ${this.position.toFixed(6)}, 연속 손실: ${this.consecutiveLosses}`);
        } else {
          this.consecutiveLosses = 0; // 수익이 나면 연속 손실 카운트 리셋
          console.log(`${timestamp.toLocaleTimeString()} - SELL at ${price.toFixed(2)}, RSI: ${rsi.toFixed(2)}, Profit: ${(profitPct * 100).toFixed(2)}%, Position: ${this.position.toFixed(6)}`);
        }
        
        this.position = 0;
      }
    }
    // HOLD이면 아무런 거래도 실행하지 않음

    // 보상: 현재 net worth 변화량
    const currentNet = this.netWorth(price);
    const reward = currentNet - this.prevNetWorth;
    this.prevNetWorth = currentNet;

    // Q-learning 업데이트
    const stateKey = state.join(',');
    const nextState = state; // 간단화를 위해 다음 상태를 현재 상태와 동일하게 사용
    const nextStateKey = nextState.join(',');
    const bestNext = Math.max(...(this.qTable[nextStateKey] || [0, 0, 0]));
    
    if (this.qTable[stateKey]) {
      this.qTable[stateKey][action] = this.qTable[stateKey][action] + 
        this.alpha * (reward + this.gamma * bestNext - this.qTable[stateKey][action]);
    }

    // 이전 MACD 값 업데이트
    this.prevMacdLine = macdLine;
    this.prevMacdSignal = macdSignal;

    return { action, state };
  }

  /**
   * 최종 결과 정리
   * @returns 백테스트 결과
   */
  public getFinalResult(): BacktestResult {
    // 포지션이 남아있으면 정리
    if (this.position > 0 && this.tradeLog.length > 0) {
      const lastTrade = this.tradeLog[this.tradeLog.length - 1];
      if (lastTrade.exitTime.getTime() === 0) {
        // 마지막 거래가 청산되지 않은 경우, 가상의 청산 가격 사용
        const finalPrice = lastTrade.entryPrice; // 간단히 진입 가격으로 청산 가정
        const profitPct = (finalPrice / this.buyPrice - 1);
        
        lastTrade.exitTime = new Date();
        lastTrade.exitPrice = finalPrice;
        lastTrade.return = profitPct;
        lastTrade.isSuccess = profitPct > 0;
        
        const effectiveCapital = this.position * finalPrice * (1 - this.feeRate);
        this.capital = effectiveCapital;
        this.position = 0;
      }
    }

    // 결과 계산
    const successfulTrades = this.tradeLog.filter(trade => trade.isSuccess).length;
    const totalReturn = (this.capital / this.initialCapital - 1) * 100;
    
    // 수수료 제외 총 수익률 계산
    const totalNetReturn = this.tradeLog.reduce((sum, trade) => sum + trade.return * 100, 0);
    
    return {
      totalTrades: this.tradeLog.length,
      successfulTrades,
      totalReturn,
      totalNetReturn,
      successRate: this.tradeLog.length > 0 ? (successfulTrades / this.tradeLog.length) * 100 : 0,
      averageReturn: this.tradeLog.length > 0 ? totalReturn / this.tradeLog.length : 0,
      averageNetReturn: this.tradeLog.length > 0 ? totalNetReturn / this.tradeLog.length : 0,
      trades: this.tradeLog
    };
  }

  /**
   * 거래 로그 가져오기
   * @returns 거래 로그
   */
  public getTradeLog(): Trade[] {
    return this.tradeLog;
  }

  /**
   * Q-테이블 가져오기
   * @returns Q-테이블
   */
  public getQTable(): QTable {
    return this.qTable;
  }

  /**
   * 현재 자본금 가져오기
   * @returns 현재 자본금
   */
  public getCapital(): number {
    return this.capital;
  }
}

/**
 * CSV 데이터를 파싱하여 최적화 시뮬레이션을 실행하는 함수
 * @param csvData CSV 데이터
 * @returns 백테스트 결과
 */
export const runOptimizationFromCSV = (csvData: string): BacktestResult => {
  // CSV 파싱
  const lines = csvData.trim().split('\n');
  const headers = lines[0].split(',');
  
  // 타임스탬프와 가격 컬럼 인덱스 찾기
  const timestampIndex = headers.findIndex(h => h.includes('timestamp'));
  const priceIndex = headers.findIndex(h => h === 'close' || h === 'trade_price');
  
  if (timestampIndex === -1 || priceIndex === -1) {
    throw new Error('CSV 형식이 올바르지 않습니다. timestamp와 price(close) 컬럼이 필요합니다.');
  }
  
  // 데이터 추출
  const data = lines.slice(1).map(line => {
    const values = line.split(',');
    return {
      timestamp: new Date(values[timestampIndex]),
      price: parseFloat(values[priceIndex])
    };
  });
  
  // 최적화 인스턴스 생성
  const optimizer = new TradingOptimizer();
  
  // 기술적 지표 계산
  const prices = data.map(d => d.price);
  
  // 각 데이터 포인트에 대해 거래 시뮬레이션 실행
  for (let i = 20; i < data.length; i++) { // 20개 이상의 데이터가 있어야 지표 계산 가능
    const priceWindow = prices.slice(0, i + 1);
    
    // RSI 계산 (14일)
    const rsi = calculateRSI(priceWindow, 14);
    
    // MACD 계산 (12, 26, 9)
    const [macdLine, macdSignal] = calculateMACD(priceWindow, 12, 26, 9);
    
    // 볼린저 밴드 계산 (20일, 2 표준편차)
    const [sma, upperBand, lowerBand] = calculateBollingerBands(priceWindow, 20, 2);
    
    // 모멘텀 계산 (10일)
    const momentum = calculateMomentum(priceWindow, 10);
    
    // 이동평균 계산
    const ma60 = calculateMA(priceWindow, 60);
    const ma120 = calculateMA(priceWindow, 120);
    const ma240 = calculateMA(priceWindow, 240);
    const ma300 = calculateMA(priceWindow, 300);
    const ma360 = calculateMA(priceWindow, 360);
    const ma900 = calculateMA(priceWindow, 900);
    
    // 거래 처리
    optimizer.processTrade(
      data[i].timestamp,
      data[i].price,
      rsi[rsi.length - 1],
      macdLine[macdLine.length - 1],
      macdSignal[macdSignal.length - 1],
      lowerBand[lowerBand.length - 1],
      upperBand[upperBand.length - 1],
      momentum[momentum.length - 1],
      ma60[ma60.length - 1],
      ma120[ma120.length - 1],
      ma240[ma240.length - 1],
      ma300[ma300.length - 1],
      ma360[ma360.length - 1],
      ma900[ma900.length - 1]
    );
  }
  
  // 최종 결과 반환
  return optimizer.getFinalResult();
};

// 기술적 지표 계산 함수들
function calculateRSI(prices: number[], period: number = 14): number[] {
  const result: number[] = [];
  const deltas = prices.slice(1).map((price, i) => price - prices[i]);
  
  const gains = deltas.map(delta => Math.max(delta, 0));
  const losses = deltas.map(delta => Math.abs(Math.min(delta, 0)));
  
  let avgGain = gains.slice(0, period).reduce((sum, gain) => sum + gain, 0) / period;
  let avgLoss = losses.slice(0, period).reduce((sum, loss) => sum + loss, 0) / period;
  
  result.push(100 - (100 / (1 + avgGain / (avgLoss || 1))));
  
  for (let i = period; i < deltas.length; i++) {
    avgGain = (avgGain * (period - 1) + gains[i]) / period;
    avgLoss = (avgLoss * (period - 1) + losses[i]) / period;
    result.push(100 - (100 / (1 + avgGain / (avgLoss || 1))));
  }
  
  return result;
}

function calculateMACD(prices: number[], fast: number = 12, slow: number = 26, signal: number = 9): [number[], number[]] {
  const emaFast = calculateEMA(prices, fast);
  const emaSlow = calculateEMA(prices, slow);
  
  const macdLine = emaFast.map((value, i) => value - emaSlow[i]);
  const macdSignal = calculateEMA(macdLine, signal);
  
  return [macdLine, macdSignal];
}

function calculateEMA(prices: number[], period: number): number[] {
  const result: number[] = [];
  const k = 2 / (period + 1);
  
  // 첫 번째 값은 SMA로 초기화
  let ema = prices.slice(0, period).reduce((sum, price) => sum + price, 0) / period;
  result.push(ema);
  
  for (let i = period; i < prices.length; i++) {
    ema = prices[i] * k + ema * (1 - k);
    result.push(ema);
  }
  
  return result;
}

function calculateBollingerBands(prices: number[], period: number = 20, multiplier: number = 2): [number[], number[], number[]] {
  const sma: number[] = [];
  const upperBand: number[] = [];
  const lowerBand: number[] = [];
  
  for (let i = period - 1; i < prices.length; i++) {
    const slice = prices.slice(i - period + 1, i + 1);
    const avg = slice.reduce((sum, price) => sum + price, 0) / period;
    const std = Math.sqrt(slice.reduce((sum, price) => sum + Math.pow(price - avg, 2), 0) / period);
    
    sma.push(avg);
    upperBand.push(avg + multiplier * std);
    lowerBand.push(avg - multiplier * std);
  }
  
  return [sma, upperBand, lowerBand];
}

function calculateMomentum(prices: number[], period: number = 10): number[] {
  const result: number[] = [];
  
  for (let i = period; i < prices.length; i++) {
    result.push((prices[i] / prices[i - period]) - 1);
  }
  
  return result;
}

function calculateMA(prices: number[], period: number): number[] {
  const result: number[] = [];
  
  for (let i = period - 1; i < prices.length; i++) {
    const slice = prices.slice(i - period + 1, i + 1);
    const avg = slice.reduce((sum, price) => sum + price, 0) / period;
    result.push(avg);
  }
  
  return result;
} 