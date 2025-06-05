#!/usr/bin/env node

/**
 * MA_CROSS 전략 백테스트 실행 스크립트
 * Shrimp Task Manager와 연동하여 작업 실행
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

// 설정
const CONFIG = {
  API_BASE: 'http://localhost:3001/api',
  DATA_DIR: '/mnt/f/200.workspace/trade/shrimp-data',
  SYMBOL: 'KRW-BTC',
  INITIAL_CAPITAL: 10000000,
  FEE_RATE: 0.0005
};

// 로깅 함수
function log(message, level = 'INFO') {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] [${level}] ${message}`;
  console.log(logMessage);
  
  // 로그 파일에 저장
  const logFile = path.join(CONFIG.DATA_DIR, 'logs', 'backtest.log');
  fs.appendFileSync(logFile, logMessage + '\n');
}

// API 호출 함수
async function fetchData(url) {
  return new Promise((resolve, reject) => {
    const request = require('http').get(url, (response) => {
      let data = '';
      response.on('data', chunk => data += chunk);
      response.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (error) {
          reject(error);
        }
      });
    });
    
    request.on('error', reject);
    request.setTimeout(30000, () => reject(new Error('Request timeout')));
  });
}

// MACD 계산 함수
function calculateMACD(prices, fastPeriod = 12, slowPeriod = 26, signalPeriod = 9) {
  if (prices.length < slowPeriod) return { macd: 0, signal: 0, histogram: 0 };
  
  // EMA 계산
  const calculateEMA = (data, period) => {
    const multiplier = 2 / (period + 1);
    let ema = data[0];
    for (let i = 1; i < data.length; i++) {
      ema = (data[i] - ema) * multiplier + ema;
    }
    return ema;
  };
  
  const fastEMA = calculateEMA(prices.slice(-fastPeriod), fastPeriod);
  const slowEMA = calculateEMA(prices.slice(-slowPeriod), slowPeriod);
  const macd = fastEMA - slowEMA;
  
  // Signal 라인 계산을 위해 MACD 히스토리가 필요하지만 단순화
  const signal = macd * 0.9; // 간단한 근사치
  const histogram = macd - signal;
  
  return { macd, signal, histogram };
}

// RSI 계산 함수
function calculateRSI(prices, period = 14) {
  if (prices.length < period + 1) return 50;
  
  let gains = 0;
  let losses = 0;
  
  for (let i = prices.length - period; i < prices.length; i++) {
    const change = prices[i] - prices[i - 1];
    if (change > 0) gains += change;
    else losses -= change;
  }
  
  const avgGain = gains / period;
  const avgLoss = losses / period;
  const rs = avgGain / avgLoss;
  const rsi = 100 - (100 / (1 + rs));
  
  return rsi;
}

// 이동평균 계산 함수
function calculateMA(prices, period) {
  if (prices.length < period) return prices[prices.length - 1];
  return prices.slice(-period).reduce((sum, price) => sum + price, 0) / period;
}

// MA_CROSS 전략 분석 함수
function analyzeMAStrategy(data) {
  const signals = [];
  const trades = [];
  let position = null;
  let lastSignal = null;
  
  log(`분석 시작: ${data.length}개 캔들 데이터`);
  
  for (let i = 240; i < data.length; i++) { // 240개 캔들 이후부터 분석
    const currentCandle = data[i];
    const prices = data.slice(0, i + 1).map(d => d.trade_price);
    
    // 이동평균 계산
    const ma60 = calculateMA(prices, 60);
    const ma120 = calculateMA(prices, 120);
    const ma240 = calculateMA(prices, 240);
    
    // MACD 계산
    const { macd, signal } = calculateMACD(prices);
    
    // RSI 계산
    const rsi = calculateRSI(prices);
    
    // 매수 조건 검사
    const buyCondition = 
      ma60 > ma120 && 
      ma60 > ma240 && 
      macd > signal && 
      (rsi < 30 || (rsi > 30 && i > 0 && calculateRSI(data.slice(0, i).map(d => d.trade_price)) <= 30));
    
    // 매도 조건 검사
    const sellCondition = 
      (ma60 < ma120 || ma60 < ma240) && 
      macd < signal && 
      rsi > 70;
    
    let signalType = null;
    
    if (buyCondition && (!position || position.type === 'sell')) {
      signalType = 'buy';
      if (position && position.type === 'sell') {
        // 이전 매도 포지션 종료
        trades.push({
          ...position,
          exitTime: currentCandle.candle_date_time_kst,
          exitPrice: currentCandle.trade_price,
          profitPercentage: ((currentCandle.trade_price - position.entryPrice) / position.entryPrice) * 100
        });
      }
      position = {
        type: 'buy',
        entryTime: currentCandle.candle_date_time_kst,
        entryPrice: currentCandle.trade_price
      };
      lastSignal = 'buy';
    } else if (sellCondition && position && position.type === 'buy') {
      signalType = 'sell';
      // 매수 포지션 종료
      trades.push({
        ...position,
        exitTime: currentCandle.candle_date_time_kst,
        exitPrice: currentCandle.trade_price,
        profitPercentage: ((currentCandle.trade_price - position.entryPrice) / position.entryPrice) * 100
      });
      position = {
        type: 'sell',
        entryTime: currentCandle.candle_date_time_kst,
        entryPrice: currentCandle.trade_price
      };
      lastSignal = 'sell';
    }
    
    if (signalType) {
      signals.push({
        time: currentCandle.candle_date_time_kst,
        type: signalType,
        price: currentCandle.trade_price,
        ma60,
        ma120,
        ma240,
        macd,
        signal,
        rsi
      });
    }
  }
  
  log(`분석 완료: ${signals.length}개 신호, ${trades.length}개 거래`);
  
  return { signals, trades };
}

// 백테스트 결과 계산 함수
function calculateBacktestResults(trades, initialCapital) {
  let capital = initialCapital;
  let winningTrades = 0;
  let totalReturn = 0;
  
  trades.forEach(trade => {
    const returnRate = trade.profitPercentage / 100;
    const netReturn = returnRate - (CONFIG.FEE_RATE * 2); // 매수/매도 수수료
    
    capital *= (1 + netReturn);
    totalReturn += netReturn;
    
    if (netReturn > 0) winningTrades++;
  });
  
  const finalReturn = (capital - initialCapital) / initialCapital;
  const winRate = trades.length > 0 ? (winningTrades / trades.length) * 100 : 0;
  
  return {
    totalTrades: trades.length,
    winningTrades,
    winRate,
    totalReturn: finalReturn * 100,
    finalCapital: capital,
    profit: capital - initialCapital,
    averageReturn: trades.length > 0 ? totalReturn / trades.length * 100 : 0
  };
}

// 메인 백테스트 실행 함수
async function runBacktest() {
  try {
    log('MA_CROSS 전략 백테스트 시작');
    
    // 1. 캔들 데이터 가져오기
    log('캔들 데이터 요청 중...');
    const candleData = await fetchData(`${CONFIG.API_BASE}/candles?market=${CONFIG.SYMBOL}&minutes=30&count=500`);
    
    if (!candleData || candleData.length === 0) {
      throw new Error('캔들 데이터를 가져올 수 없습니다');
    }
    
    log(`${candleData.length}개 캔들 데이터 수신`);
    
    // 2. 전략 분석 실행
    log('MA_CROSS 전략 분석 실행 중...');
    const { signals, trades } = analyzeMAStrategy(candleData.reverse()); // 시간순 정렬
    
    // 3. 백테스트 결과 계산
    log('백테스트 결과 계산 중...');
    const results = calculateBacktestResults(trades, CONFIG.INITIAL_CAPITAL);
    
    // 4. 결과 저장
    const resultData = {
      strategy: 'MA_CROSS',
      symbol: CONFIG.SYMBOL,
      period: {
        start: candleData[0].candle_date_time_kst,
        end: candleData[candleData.length - 1].candle_date_time_kst
      },
      parameters: {
        initial_capital: CONFIG.INITIAL_CAPITAL,
        fee_rate: CONFIG.FEE_RATE
      },
      results,
      signals,
      trades,
      timestamp: new Date().toISOString()
    };
    
    const resultFile = path.join(CONFIG.DATA_DIR, 'results', `ma_cross_backtest_${Date.now()}.json`);
    fs.writeFileSync(resultFile, JSON.stringify(resultData, null, 2));
    
    log(`결과 저장됨: ${resultFile}`);
    
    // 5. 결과 요약 출력
    console.log('\n=== MA_CROSS 백테스트 결과 ===');
    console.log(`기간: ${resultData.period.start} ~ ${resultData.period.end}`);
    console.log(`총 거래 횟수: ${results.totalTrades}`);
    console.log(`승리 거래: ${results.winningTrades}`);
    console.log(`승률: ${results.winRate.toFixed(2)}%`);
    console.log(`총 수익률: ${results.totalReturn.toFixed(2)}%`);
    console.log(`최종 자본: ${results.finalCapital.toLocaleString()}원`);
    console.log(`순수익: ${results.profit.toLocaleString()}원`);
    console.log(`평균 거래 수익률: ${results.averageReturn.toFixed(2)}%`);
    
    log('백테스트 완료');
    
    return resultData;
    
  } catch (error) {
    log(`백테스트 실행 중 오류: ${error.message}`, 'ERROR');
    throw error;
  }
}

// 작업 상태 업데이트 함수
function updateTaskStatus(taskId, status, result = null) {
  const taskFile = path.join(CONFIG.DATA_DIR, 'tasks', `${taskId}.json`);
  
  if (fs.existsSync(taskFile)) {
    const task = JSON.parse(fs.readFileSync(taskFile, 'utf8'));
    task.status = status;
    task.updated_at = new Date().toISOString();
    
    if (result) {
      task.result = result;
    }
    
    fs.writeFileSync(taskFile, JSON.stringify(task, null, 2));
    log(`작업 상태 업데이트: ${taskId} -> ${status}`);
  }
}

// 메인 실행
if (require.main === module) {
  const taskId = process.argv[2] || 'ma_cross_backtest_20240603';
  
  log(`작업 시작: ${taskId}`);
  updateTaskStatus(taskId, 'running');
  
  runBacktest()
    .then(result => {
      updateTaskStatus(taskId, 'completed', result.results);
      log('백테스트 성공적으로 완료');
      process.exit(0);
    })
    .catch(error => {
      updateTaskStatus(taskId, 'failed', { error: error.message });
      log(`백테스트 실패: ${error.message}`, 'ERROR');
      process.exit(1);
    });
}

module.exports = { runBacktest, analyzeMAStrategy, calculateBacktestResults };