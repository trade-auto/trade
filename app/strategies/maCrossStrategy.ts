import { CandlestickData, Time } from 'lightweight-charts';
import { TradingStrategy, TradeSignal, ExtendedMetadata } from './types';

// MA 크로스 전략
const maCrossStrategy: TradingStrategy = {
  name: 'MA_CROSS',
  timeframe: '1m',
  description: '단기/장기 이동평균선 교차 전략',
  author: 'System',
  version: '1.0.0',
  tags: ['trend', 'moving-average'],
  
  indicators: {
    maPeriods: { short: 30, long: 60 }
  },
  
  riskManagement: {
    stopLossPercent: 1.0,
    takeProfitPercent: 2.0,
    positionSizePercent: 50
  },
  
  // 진입 조건 분석
  analyzeEntry(data, index) {
    if (index < 60) return null; // 충분한 데이터 확보
    
    const shortPeriod = 30;
    const longPeriod = 60;
    
    const shortMA = data.slice(index - shortPeriod, index).reduce((a, b) => a + b.close, 0) / shortPeriod;
    const longMA = data.slice(index - longPeriod, index).reduce((a, b) => a + b.close, 0) / longPeriod;
    const prevShortMA = data.slice(index - shortPeriod - 1, index - 1).reduce((a, b) => a + b.close, 0) / shortPeriod;
    const prevLongMA = data.slice(index - longPeriod - 1, index - 1).reduce((a, b) => a + b.close, 0) / longPeriod;
    
    if (prevShortMA <= prevLongMA && shortMA > longMA) {
      return 'long';
    }
    
    return null;
  },
  
  // 청산 조건 분석
  analyzeExit(data, index, position, entryPrice) {
    if (index < 60 || position !== 'long') return false; // 충분한 데이터 확보 및 롱 포지션 확인
    
    const shortPeriod = 30;
    const longPeriod = 60;
    
    const shortMA = data.slice(index - shortPeriod, index).reduce((a, b) => a + b.close, 0) / shortPeriod;
    const longMA = data.slice(index - longPeriod, index).reduce((a, b) => a + b.close, 0) / longPeriod;
    const prevShortMA = data.slice(index - shortPeriod - 1, index - 1).reduce((a, b) => a + b.close, 0) / shortPeriod;
    const prevLongMA = data.slice(index - longPeriod - 1, index - 1).reduce((a, b) => a + b.close, 0) / longPeriod;
    
    // 단기 이동평균이 장기 이동평균을 하향 돌파하면 청산
    return (prevShortMA >= prevLongMA && shortMA < longMA);
  },
  
  // 지표 계산 함수
  calculateIndicators(data, index) {
    if (index < 60) {
      return {} as ExtendedMetadata;
    }
    
    const shortPeriod = 30;
    const longPeriod = 60;
    
    const shortMA = data.slice(index - shortPeriod, index).reduce((a, b) => a + b.close, 0) / shortPeriod;
    const longMA = data.slice(index - longPeriod, index).reduce((a, b) => a + b.close, 0) / longPeriod;
    
    const metadata: ExtendedMetadata = {
      ma30: shortMA,
      ma60: longMA
    };
    
    return metadata;
  },
  
  // 기존 analyze 함수는 새로운 함수들을 활용
  analyze(data) {
    const signals: TradeSignal[] = [];
    const shortPeriod = 30;
    const longPeriod = 60;
    let currentPosition: 'long' | null = null;
    let lastTradeId: string | null = null;
    
    if (data.length < longPeriod) {
      return signals;
    }
    
    const self = this; // this 컨텍스트 저장

    for (let i = longPeriod; i < data.length; i++) {
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
            strategy: 'MA_CROSS',
            reason: '단기 이동평균선이 장기 이동평균선을 상향 돌파',
            metadata: self.calculateIndicators?.(data, i)
          });
          currentPosition = 'long';
          lastTradeId = tradeId;
          console.log('✅ 매수 신호 생성:', {
            시간: new Date(data[i].time as number).toLocaleString('ko-KR'),
            가격: data[i].close.toLocaleString('ko-KR') + '원',
            '현재 포지션': currentPosition,
            '거래 ID': tradeId
          });
        }
      } else if (currentPosition === 'long') {
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
              strategy: 'MA_CROSS',
              reason: '단기 이동평균선이 장기 이동평균선을 하향 돌파',
              relatedTradeId: lastTradeId || undefined,
              metadata: self.calculateIndicators?.(data, i)
            });
            currentPosition = null;
            lastTradeId = null;
            console.log('✅ 매도 신호 생성:', {
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

export default maCrossStrategy; 