import { CandlestickData, Time } from 'lightweight-charts';
import { TradingStrategy, TradeSignal, ExtendedMetadata } from './types';
import { calculateEMA, createTempCandleData, calculateRSI } from './utils';

// 기울기 필터 전략
const slopeFilterStrategy: TradingStrategy = {
  name: 'SLOPE_FILTER',
  timeframe: '1m',
  description: '통합 기술적 분석 전략 (MA/MACD/RSI/BB)',
  author: 'System',
  version: '1.0.0',
  tags: ['trend', 'momentum', 'oscillator'],
  
  indicators: {
    maPeriods: { short: 60, long: 120 },
    bollinger: { period: 20, stdDev: 2 },
    rsi: { period: 14, overbought: 70, oversold: 30 },
    macd: { fast: 12, slow: 26, signal: 9 }
  },
  
  // 진입 조건 분석
  analyzeEntry(data, index) {
    // 기본 파라미터 설정
    const ma60Period = 60;
    const ma120Period = 120;
    const ma240Period = 240;
    const ma300Period = 300;
    const ma360Period = 360;
    const ma900Period = 900;
    const rsiPeriod = 14;
    const macdFast = 12;
    const macdSlow = 26;
    const macdSignal = 9;
    const bbandsLength = 20;
    const bbandsStdDev = 2;
    
    // 최소 필요 데이터 포인트 확인
    const minDataPoints = Math.max(ma900Period, rsiPeriod, macdSlow + macdSignal);
    if (index < minDataPoints) return null;
    
    const prices = data.slice(0, index + 1).map(d => d.close);
    
    // 이동평균선 계산
    const ma60 = prices.slice(-ma60Period).reduce((a, b) => a + b, 0) / ma60Period;
    const ma120 = prices.slice(-ma120Period).reduce((a, b) => a + b, 0) / ma120Period;
    const ma240 = prices.slice(-ma240Period).reduce((a, b) => a + b, 0) / ma240Period;
    const ma300 = prices.slice(-ma300Period).reduce((a, b) => a + b, 0) / ma300Period;
    const ma360 = prices.slice(-ma360Period).reduce((a, b) => a + b, 0) / ma360Period;
    const ma900 = prices.slice(-ma900Period).reduce((a, b) => a + b, 0) / ma900Period;
    
    // 이전 이동평균선 계산 (교차 확인용)
    const prevMa60 = prices.slice(-ma60Period-1, -1).reduce((a, b) => a + b, 0) / ma60Period;
    const prevMa120 = prices.slice(-ma120Period-1, -1).reduce((a, b) => a + b, 0) / ma120Period;
    
    // MACD 계산
    const emaFast = calculateEMA(data.slice(0, index + 1), macdFast).slice(-1)[0]?.value || 0;
    const emaSlow = calculateEMA(data.slice(0, index + 1), macdSlow).slice(-1)[0]?.value || 0;
    const macd = emaFast - emaSlow;
    const macdSignalLine = calculateEMA(
      data.slice(0, index + 1).map(d => createTempCandleData(d.time, 
        calculateEMA([createTempCandleData(d.time, d.close)], macdFast)[0]?.value - 
        calculateEMA([createTempCandleData(d.time, d.close)], macdSlow)[0]?.value || 0
      )),
      macdSignal
    ).slice(-1)[0]?.value || 0;
    const macdHistogram = macd - macdSignalLine;
    const prevMacdHistogram = calculateEMA(
      data.slice(0, index).map(d => createTempCandleData(d.time,
        calculateEMA([createTempCandleData(d.time, d.close)], macdFast)[0]?.value -
        calculateEMA([createTempCandleData(d.time, d.close)], macdSlow)[0]?.value || 0
      )),
      macdSignal
    ).slice(-1)[0]?.value || 0;
    
    // RSI 계산
    const rsi = calculateRSI(prices);
    const prevRsi = index > 0 ? calculateRSI(prices.slice(0, -1)) : rsi;
    
    // 볼린저 밴드 계산
    const bbandsSlice = prices.slice(-bbandsLength);
    const bbandsMA = bbandsSlice.reduce((a, b) => a + b, 0) / bbandsLength;
    const bbandsStd = Math.sqrt(
      bbandsSlice.reduce((a, b) => a + Math.pow(b - bbandsMA, 2), 0) / bbandsLength
    );
    const lowerBand = bbandsMA - (bbandsStdDev * bbandsStd);
    
    // 매수 조건 확인
    const isLongCondition = 
      // 이동평균선 정렬 및 교차 조건
      ma60 > ma120 && ma120 > ma240 && ma240 > ma300 && ma300 > ma360 && ma360 > ma900 &&
      prevMa60 <= prevMa120 && ma60 > ma120 && // MA60이 MA120 상향 돌파
      
      // 기술적 지표 조건
      rsi < 70 && rsi > 30 && // RSI가 과매수/과매도 영역이 아님
      rsi > prevRsi && // RSI 상승 중
      macdHistogram > 0 && prevMacdHistogram < 0 && // MACD 히스토그램 상향 돌파
      data[index].close < lowerBand; // 현재 가격이 볼린저 밴드 하단 아래
    
    if (isLongCondition) {
      return 'long';
    }
    
    return null;
  },
  
  // 청산 조건 분석
  analyzeExit(data, index, position, entryPrice) {
    if (index < 900 || position !== 'long') return false;
    
    const ma60Period = 60;
    const ma120Period = 120;
    const ma240Period = 240;
    const ma360Period = 360;
    const ma900Period = 900;
    const rsiPeriod = 14;
    
    const prices = data.slice(0, index + 1).map(d => d.close);
    
    // 이동평균선 계산
    const ma60 = prices.slice(-ma60Period).reduce((a, b) => a + b, 0) / ma60Period;
    const ma120 = prices.slice(-ma120Period).reduce((a, b) => a + b, 0) / ma120Period;
    const ma240 = prices.slice(-ma240Period).reduce((a, b) => a + b, 0) / ma240Period;
    const ma360 = prices.slice(-ma360Period).reduce((a, b) => a + b, 0) / ma360Period;
    
    // 이전 이동평균선 계산
    const prevMa60 = prices.slice(-ma60Period-1, -1).reduce((a, b) => a + b, 0) / ma60Period;
    const prevMa120 = prices.slice(-ma120Period-1, -1).reduce((a, b) => a + b, 0) / ma120Period;
    
    // RSI 계산
    const rsi = calculateRSI(prices);
    const prevRsi = index > 0 ? calculateRSI(prices.slice(0, -1)) : rsi;
    
    // 매도 조건 확인
    const isExitCondition = 
      // 이동평균선 조건
      (ma60 < ma120 || ma120 < ma240) || // MA 정렬 붕괴
      (prevMa60 >= prevMa120 && ma60 < ma120) || // MA60이 MA120 하향 돌파
      
      // 기술적 지표 조건
      rsi > 80 || // RSI 과매수
      rsi < prevRsi || // RSI 하락 중
      
      // 수익률 기반 조건
      (data[index].close / entryPrice - 1) * 100 >= 3.0 || // 3% 이상 수익
      (data[index].close / entryPrice - 1) * 100 <= -1.0; // 1% 이상 손실
    
    return isExitCondition;
  },
  
  // 지표 계산 함수
  calculateIndicators(data, index) {
    if (index < 900) {
      return {} as ExtendedMetadata;
    }
    
    const prices = data.slice(0, index + 1).map(d => d.close);
    
    // 이동평균선 계산
    const ma60 = prices.slice(-60).reduce((a, b) => a + b, 0) / 60;
    const ma120 = prices.slice(-120).reduce((a, b) => a + b, 0) / 120;
    const ma240 = prices.slice(-240).reduce((a, b) => a + b, 0) / 240;
    const ma360 = prices.slice(-360).reduce((a, b) => a + b, 0) / 360;
    
    // MACD 계산
    const macdFast = 12;
    const macdSlow = 26;
    const emaFast = calculateEMA(data.slice(0, index + 1), macdFast).slice(-1)[0]?.value || 0;
    const emaSlow = calculateEMA(data.slice(0, index + 1), macdSlow).slice(-1)[0]?.value || 0;
    const macdValue = emaFast - emaSlow;
    
    // RSI 계산
    const rsiValue = calculateRSI(prices);
    
    const metadata: ExtendedMetadata = {
      ma60,
      ma120,
      ma240,
      ma360,
      deviation: Math.abs(data[index].close - ma60) / ma60,
      isAbove360MA: data[index].close > ma360,
      rsi: rsiValue,
      macd: macdValue
    };
    
    return metadata;
  },
  
  // 기존 분석 함수
  analyze(data) {
    const signals: TradeSignal[] = [];
    let currentPosition: 'long' | null = null;
    let lastTradeId: string | null = null;
    
    // 충분한 데이터가 있는지 확인
    const minDataPoints = 900;
    if (data.length < minDataPoints) {
      return signals;
    }
    
    const self = this; // this 컨텍스트 저장
    
    // 각 봉마다 분석
    for (let i = minDataPoints; i < data.length; i++) {
      // 현재 포지션이 없는 경우에만 매수 신호 확인
      if (currentPosition === null) {
        const entrySignal = self.analyzeEntry?.(data, i);
        
        if (entrySignal === 'long') {
          const tradeId = `trade-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
          signals.push({
            id: tradeId,
            time: data[i].time as number,
            position: 'long',
            price: data[i].close,
            strategy: 'SLOPE_FILTER',
            reason: '이동평균선 정렬 및 지표 조건 충족',
            metadata: self.calculateIndicators?.(data, i)
          });
          currentPosition = 'long';
          lastTradeId = tradeId;
          console.log('✅ 매수 신호 생성 (SLOPE_FILTER):', {
            시간: new Date(data[i].time as number).toLocaleString('ko-KR'),
            가격: data[i].close.toLocaleString('ko-KR') + '원',
            '현재 포지션': currentPosition,
            '거래 ID': tradeId
          });
        }
      } 
      // 현재 롱 포지션인 경우, 청산 조건 확인
      else if (currentPosition === 'long') {
        // 마지막 롱 진입 신호의 인덱스 찾기
        const entrySignalIndex = signals.findIndex(signal => 
          signal.id === lastTradeId && signal.position === 'long');
        
        if (entrySignalIndex >= 0) {
          const entryPrice = signals[entrySignalIndex].price;
          const shouldExit = self.analyzeExit?.(data, i, 'long', entryPrice);
          
          if (shouldExit) {
            const exitTradeId = `trade-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
            signals.push({
              id: exitTradeId,
              time: data[i].time as number,
              position: 'close',
              price: data[i].close,
              strategy: 'SLOPE_FILTER',
              reason: '기술적 조건 붕괴 또는 한계 도달',
              relatedTradeId: lastTradeId || undefined,
              metadata: self.calculateIndicators?.(data, i)
            });
            currentPosition = null;
            lastTradeId = null;
            console.log('✅ 매도 신호 생성 (SLOPE_FILTER):', {
              시간: new Date(data[i].time as number).toLocaleString('ko-KR'),
              가격: data[i].close.toLocaleString('ko-KR') + '원',
              '이전 포지션': 'long',
              '매수가': entryPrice.toLocaleString('ko-KR') + '원',
              '수익률': ((data[i].close / entryPrice - 1) * 100).toFixed(2) + '%',
              '거래 ID': exitTradeId,
              '관련 매수 ID': lastTradeId,
              '다음 매수 준비': '완료'
            });
          }
        }
      }
    }
    
    return signals;
  }
};

export default slopeFilterStrategy; 