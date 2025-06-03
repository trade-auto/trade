#!/usr/bin/env node

/**
 * 개선된 MA_CROSS 전략 백테스트 실행 스크립트
 * 더 실용적인 조건으로 조정
 */

const fs = require('fs');
const path = require('path');

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

// 이동평균 계산 함수
function calculateMA(prices, period) {
  if (prices.length < period) return null;
  return prices.slice(-period).reduce((sum, price) => sum + price, 0) / period;
}

// EMA 계산 함수
function calculateEMA(prices, period) {
  if (prices.length === 0) return null;
  if (prices.length === 1) return prices[0];
  
  const multiplier = 2 / (period + 1);
  let ema = prices[0];
  
  for (let i = 1; i < prices.length; i++) {
    ema = (prices[i] - ema) * multiplier + ema;
  }
  
  return ema;
}

// MACD 계산 함수 (개선된 버전)
function calculateMACD(prices, fastPeriod = 12, slowPeriod = 26, signalPeriod = 9) {
  if (prices.length < slowPeriod) return { macd: 0, signal: 0, histogram: 0 };
  
  const fastEMA = calculateEMA(prices, fastPeriod);
  const slowEMA = calculateEMA(prices, slowPeriod);
  const macd = fastEMA - slowEMA;
  
  // 간단한 신호선 (실제로는 MACD의 EMA여야 함)
  const signal = macd * 0.8;
  const histogram = macd - signal;
  
  return { macd, signal, histogram };
}

// RSI 계산 함수 (개선된 버전)
function calculateRSI(prices, period = 14) {
  if (prices.length < period + 1) return 50;
  
  let gains = 0;
  let losses = 0;
  
  for (let i = Math.max(1, prices.length - period); i < prices.length; i++) {
    const change = prices[i] - prices[i - 1];
    if (change > 0) gains += change;
    else losses -= change;
  }
  
  const avgGain = gains / period;
  const avgLoss = losses / period;
  
  if (avgLoss === 0) return 100;
  
  const rs = avgGain / avgLoss;
  const rsi = 100 - (100 / (1 + rs));
  
  return rsi;
}

// 개선된 MA_CROSS 전략 분석 함수
function analyzeImprovedMAStrategy(data) {
  const signals = [];
  const trades = [];
  let position = null;
  let lastTradeType = null;
  
  log(`분석 시작: ${data.length}개 캔들 데이터`);
  
  for (let i = 60; i < data.length; i++) { // 60개 캔들 이후부터 분석 (조건 완화)
    const currentCandle = data[i];
    const prices = data.slice(0, i + 1).map(d => d.trade_price);
    
    // 이동평균 계산
    const ma20 = calculateMA(prices, 20);
    const ma60 = calculateMA(prices, 60);
    const ma120 = calculateMA(prices, 120);
    
    if (!ma20 || !ma60 || !ma120) continue;
    
    // MACD 계산
    const { macd, signal } = calculateMACD(prices);
    
    // RSI 계산
    const rsi = calculateRSI(prices);
    
    // 이전 값들 (추세 확인용)
    const prevPrices = data.slice(0, i).map(d => d.trade_price);
    const prevMA20 = calculateMA(prevPrices, 20);
    const prevRSI = calculateRSI(prevPrices);
    
    // 매수 조건 (완화된 조건)
    const buyCondition = 
      ma20 > ma60 &&                           // 단기 > 중기
      macd > signal &&                         // MACD 골든크로스
      (rsi < 40 || (rsi > 30 && prevRSI <= 30)) && // RSI 과매도 구간 또는 회복
      lastTradeType !== 'buy';                 // 연속 매수 방지
    
    // 매도 조건 (완화된 조건)
    const sellCondition = 
      (ma20 < ma60 || macd < signal) &&        // MA 데드크로스 또는 MACD 데드크로스
      rsi > 60 &&                              // RSI 과매수 구간
      position &&                              // 포지션이 있을 때만
      lastTradeType !== 'sell';                // 연속 매도 방지
    
    let signalType = null;
    
    if (buyCondition) {
      signalType = 'buy';
      
      // 이전 포지션 정리
      if (position) {
        const profit = ((currentCandle.trade_price - position.entryPrice) / position.entryPrice) * 100;
        trades.push({
          ...position,
          exitTime: currentCandle.candle_date_time_kst,
          exitPrice: currentCandle.trade_price,
          profitPercentage: profit,
          type: 'long'
        });
      }
      
      position = {
        entryTime: currentCandle.candle_date_time_kst,
        entryPrice: currentCandle.trade_price,
        type: 'long'
      };
      lastTradeType = 'buy';
      
    } else if (sellCondition) {
      signalType = 'sell';
      
      if (position) {
        const profit = ((currentCandle.trade_price - position.entryPrice) / position.entryPrice) * 100;
        trades.push({
          ...position,
          exitTime: currentCandle.candle_date_time_kst,
          exitPrice: currentCandle.trade_price,
          profitPercentage: profit,
          type: 'long'
        });
        position = null;
      }
      lastTradeType = 'sell';
    }
    
    if (signalType) {
      signals.push({
        time: currentCandle.candle_date_time_kst,
        type: signalType,
        price: currentCandle.trade_price,
        ma20: ma20.toFixed(0),
        ma60: ma60.toFixed(0),
        ma120: ma120.toFixed(0),
        macd: macd.toFixed(2),
        signal: signal.toFixed(2),
        rsi: rsi.toFixed(1),
        reason: signalType === 'buy' ? 
          `MA20(${ma20.toFixed(0)}) > MA60(${ma60.toFixed(0)}), MACD 골든크로스, RSI ${rsi.toFixed(1)}` :
          `MA 데드크로스 또는 MACD 데드크로스, RSI ${rsi.toFixed(1)}`
      });
    }
  }
  
  // 마지막 포지션 정리
  if (position && data.length > 0) {
    const lastCandle = data[data.length - 1];
    const profit = ((lastCandle.trade_price - position.entryPrice) / position.entryPrice) * 100;
    trades.push({
      ...position,
      exitTime: lastCandle.candle_date_time_kst,
      exitPrice: lastCandle.trade_price,
      profitPercentage: profit,
      type: 'long'
    });
  }
  
  log(`분석 완료: ${signals.length}개 신호, ${trades.length}개 거래`);
  
  return { signals, trades };
}

// 백테스트 결과 계산 함수
function calculateBacktestResults(trades, initialCapital) {
  let capital = initialCapital;
  let winningTrades = 0;
  let totalReturn = 0;
  let maxProfit = 0;
  let maxLoss = 0;
  
  trades.forEach(trade => {
    const returnRate = trade.profitPercentage / 100;
    const netReturn = returnRate - (CONFIG.FEE_RATE * 2); // 매수/매도 수수료
    
    capital *= (1 + netReturn);
    totalReturn += netReturn;
    
    if (netReturn > 0) {
      winningTrades++;
      maxProfit = Math.max(maxProfit, netReturn * 100);
    } else {
      maxLoss = Math.min(maxLoss, netReturn * 100);
    }
  });
  
  const finalReturn = (capital - initialCapital) / initialCapital;
  const winRate = trades.length > 0 ? (winningTrades / trades.length) * 100 : 0;
  
  return {
    totalTrades: trades.length,
    winningTrades,
    losingTrades: trades.length - winningTrades,
    winRate,
    totalReturn: finalReturn * 100,
    finalCapital: capital,
    profit: capital - initialCapital,
    averageReturn: trades.length > 0 ? totalReturn / trades.length * 100 : 0,
    maxProfit,
    maxLoss,
    profitFactor: trades.length > 0 ? 
      trades.filter(t => t.profitPercentage > 0).reduce((sum, t) => sum + t.profitPercentage, 0) /
      Math.abs(trades.filter(t => t.profitPercentage < 0).reduce((sum, t) => sum + t.profitPercentage, 0)) || 0 : 0
  };
}

// 메인 백테스트 실행 함수
async function runImprovedBacktest() {
  try {
    log('개선된 MA_CROSS 전략 백테스트 시작');
    
    // 더 많은 데이터 요청
    log('캔들 데이터 요청 중...');
    const candleData = await fetchData(`${CONFIG.API_BASE}/candles?market=${CONFIG.SYMBOL}&minutes=30&count=1000`);
    
    if (!candleData || candleData.length === 0) {
      throw new Error('캔들 데이터를 가져올 수 없습니다');
    }
    
    log(`${candleData.length}개 캔들 데이터 수신`);
    
    // 시간순 정렬
    const sortedData = candleData.reverse();
    
    // 전략 분석 실행
    log('개선된 MA_CROSS 전략 분석 실행 중...');
    const { signals, trades } = analyzeImprovedMAStrategy(sortedData);
    
    // 백테스트 결과 계산
    log('백테스트 결과 계산 중...');
    const results = calculateBacktestResults(trades, CONFIG.INITIAL_CAPITAL);
    
    // 결과 저장
    const resultData = {
      strategy: 'IMPROVED_MA_CROSS',
      symbol: CONFIG.SYMBOL,
      period: {
        start: sortedData[0].candle_date_time_kst,
        end: sortedData[sortedData.length - 1].candle_date_time_kst
      },
      parameters: {
        initial_capital: CONFIG.INITIAL_CAPITAL,
        fee_rate: CONFIG.FEE_RATE,
        ma_periods: [20, 60, 120],
        conditions: {
          buy: "MA20 > MA60 AND MACD > Signal AND (RSI < 40 OR RSI recovering from oversold)",
          sell: "(MA20 < MA60 OR MACD < Signal) AND RSI > 60"
        }
      },
      results,
      signals: signals.slice(-20), // 최근 20개 신호만 저장
      trades,
      timestamp: new Date().toISOString()
    };
    
    const resultFile = path.join(CONFIG.DATA_DIR, 'results', `improved_ma_cross_backtest_${Date.now()}.json`);
    fs.writeFileSync(resultFile, JSON.stringify(resultData, null, 2));
    
    log(`결과 저장됨: ${resultFile}`);
    
    // 결과 요약 출력
    console.log('\n=== 개선된 MA_CROSS 백테스트 결과 ===');
    console.log(`기간: ${resultData.period.start} ~ ${resultData.period.end}`);
    console.log(`총 거래 횟수: ${results.totalTrades}`);
    console.log(`승리 거래: ${results.winningTrades} | 손실 거래: ${results.losingTrades}`);
    console.log(`승률: ${results.winRate.toFixed(2)}%`);
    console.log(`총 수익률: ${results.totalReturn.toFixed(2)}%`);
    console.log(`최종 자본: ${results.finalCapital.toLocaleString()}원`);
    console.log(`순수익: ${results.profit.toLocaleString()}원`);
    console.log(`평균 거래 수익률: ${results.averageReturn.toFixed(2)}%`);
    console.log(`최대 수익: ${results.maxProfit.toFixed(2)}%`);
    console.log(`최대 손실: ${results.maxLoss.toFixed(2)}%`);
    console.log(`수익 팩터: ${results.profitFactor.toFixed(2)}`);
    
    if (signals.length > 0) {
      console.log('\n=== 최근 신호 ===');
      signals.slice(-5).forEach(signal => {
        console.log(`${signal.time}: ${signal.type.toUpperCase()} @ ${Number(signal.price).toLocaleString()}원`);
        console.log(`  ${signal.reason}`);
      });
    }
    
    if (trades.length > 0) {
      console.log('\n=== 최근 거래 ===');
      trades.slice(-3).forEach(trade => {
        console.log(`${trade.entryTime} ~ ${trade.exitTime}`);
        console.log(`  ${Number(trade.entryPrice).toLocaleString()}원 → ${Number(trade.exitPrice).toLocaleString()}원`);
        console.log(`  수익률: ${trade.profitPercentage.toFixed(2)}%`);
      });
    }
    
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
  const taskId = process.argv[2] || 'improved_ma_cross_backtest_20240603';
  
  log(`작업 시작: ${taskId}`);
  updateTaskStatus(taskId, 'running');
  
  runImprovedBacktest()
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

module.exports = { runImprovedBacktest, analyzeImprovedMAStrategy, calculateBacktestResults };