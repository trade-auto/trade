import { CandlestickData, Time } from 'lightweight-charts';
import { TradingStrategy, TradeSignal, ExtendedMetadata, AnalysisResult, AnalyzeOptions } from './types';

// 이격도 MA 이탈 전략
const maCrossDeviationStrategy: TradingStrategy = {
  name: 'MA_CROSS_DEVIATION',
  timeframe: '1m',
  description: '단순화된 이격도 및 60/120/240 이동평균선 교차 전략',
  author: 'System',
  version: '2.0.0',
  tags: ['trend', 'moving-average', 'deviation'],
  
  indicators: {
    maPeriods: { short: 60, long: 240 }
  },
  
  riskManagement: {
    stopLossPercent: 1.0,
    takeProfitPercent: 3.0,
    positionSizePercent: 40
  },
  
  // 진입 조건 분석 - 단순화
  analyzeEntry(data, index) {
    if (index < 900) {
        console.log('데이터 수집 중...');
        return null;
    }
    
    // 현재 및 이전 MAs 계산
    const ma60 = data.slice(index - 60, index).reduce((sum, d) => sum + d.close, 0) / 60;
    const prevMa60 = data.slice(index - 61, index - 1).reduce((sum, d) => sum + d.close, 0) / 60;

    const ma120 = data.slice(index - 120, index).reduce((sum, d) => sum + d.close, 0) / 120;
    const prevMa120 = data.slice(index - 121, index - 1).reduce((sum, d) => sum + d.close, 0) / 120;

    const ma240 = data.slice(index - 240, index).reduce((sum, d) => sum + d.close, 0) / 240;
    const prevMa240 = data.slice(index - 241, index - 1).reduce((sum, d) => sum + d.close, 0) / 240;

    const ma900 = data.slice(index - 900, index).reduce((sum, d) => sum + d.close, 0) / 900;

    // 60MA가 120MA와 240MA를 상향 돌파하는지 확인
    const crossAbove120 = prevMa60 <= prevMa120 && ma60 > ma120;
    const crossAbove240 = prevMa60 <= prevMa240 && ma60 > ma240;
    
    // 60MA가 900MA 아래에 있는지 확인
    const isBelow900MA = ma60 < ma900;
    
    console.log('\n=== 매수 신호 분석 ===');
    console.log('매수 조건 상태:', {
      '체크 시간': new Date().toLocaleString('ko-KR', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      }),
      '60MA/120MA 상향돌파': crossAbove120 ? '✅' : '❌',
      '60MA/240MA 상향돌파': crossAbove240 ? '✅' : '❌',
      '60MA가 900MA 아래': isBelow900MA ? '✅' : '❌',
      '매수 신호 발생': (crossAbove120 && crossAbove240 && isBelow900MA) ? '✅ 신호 발생!' : '❌ 신호 없음'
    });
    
    if (crossAbove120 && crossAbove240 && isBelow900MA) {
      console.log('✅ 매수 시그널 발생: 60MA가 900MA 아래에서 120MA와 240MA를 동시에 상향돌파');
      return 'buy';
    }
    
    return null;
  },
  
  // 청산 조건 분석 - 단순화
  analyzeExit(data, index, position, entryPrice) {
    if (index < 900 || position !== 'buy') return false;
    
    // 현재 및 이전 MAs 계산
    const ma60 = data.slice(index - 60, index).reduce((sum, d) => sum + d.close, 0) / 60;
    const prevMa60 = data.slice(index - 61, index - 1).reduce((sum, d) => sum + d.close, 0) / 60;
    const ma300 = data.slice(index - 300, index).reduce((sum, d) => sum + d.close, 0) / 300;
    const prevMa300 = data.slice(index - 301, index - 1).reduce((sum, d) => sum + d.close, 0) / 300;
    const ma360 = data.slice(index - 360, index).reduce((sum, d) => sum + d.close, 0) / 360;
    const prevMa360 = data.slice(index - 361, index - 1).reduce((sum, d) => sum + d.close, 0) / 360;
    const ma900 = data.slice(index - 900, index).reduce((sum, d) => sum + d.close, 0) / 900;
    
    // 900MA 돌파 여부 확인
    const isAbove900MA = data[index].close > ma900;
    
    // 첫 번째 매도 조건: 60MA가 300MA 하향돌파
    const downward60_300 = (prevMa60 >= prevMa300 && ma60 < ma300);
    
    // 두 번째 매도부터의 조건: 60MA가 360MA 하향돌파
    const downward60_360 = (prevMa60 >= prevMa360 && ma60 < ma360);
    
    // 900MA 위에 있을 때는 매도하지 않음
    if (isAbove900MA) {
        return false;
    }
    
    // 첫 번째 매도인 경우 (실제 구현에서는 상태를 저장해야 함)
    const isFirstTrade = true; // 이 부분은 실제 구현에서 상태를 관리해야 함
    
    if (isFirstTrade) {
        if (downward60_300) {
            // isFirstTrade = false; // 실제 구현에서는 상태 업데이트 필요
            return true;
        }
        return false;
    }
    
    // 두 번째 매도부터는 360MA 하향돌파 조건 적용
    return downward60_360;
  },
  
  // 지표 계산 함수 - 단순화
  calculateIndicators(data, index) {
    if (index < 900) { // 900MA를 위해 900으로 변경
      return {} as ExtendedMetadata;
    }
    
    const ma60 = data.slice(index - 60, index).reduce((sum, d) => sum + d.close, 0) / 60;
    const ma120 = data.slice(index - 120, index).reduce((sum, d) => sum + d.close, 0) / 120;
    const ma240 = data.slice(index - 240, index).reduce((sum, d) => sum + d.close, 0) / 240;
    const ma900 = data.slice(index - 900, index).reduce((sum, d) => sum + d.close, 0) / 900;
    
    // 이격도 계산
    const deviation120_240 = Math.abs(ma120 - ma240) / ma240;
    
    const metadata: ExtendedMetadata = {
      ma60,
      ma120,
      ma240,
      ma900,
      deviation: deviation120_240,
      isAbove900MA: data[index].close > ma900
    };
    
    return metadata;
  },
  
  // 기존 분석 함수
  analyze(data: CandlestickData<Time>[], options?: AnalyzeOptions): AnalysisResult {
    const signals: TradeSignal[] = [];
    let currentPosition: 'buy' | null = null;
    let lastTradeId: string | null = null;
    let isFirstTrade = true; // 첫 번째 거래 여부 추적
    
    // 충분한 데이터가 있는지 확인
    if (data.length < 900) {
      return {
        signals,
        lastProcessedIndex: data.length - 1,
        currentPosition,
        lastTradeId
      };
    }
    
    const self = this; // this 컨텍스트 저장
    
    // 각 봉마다 분석
    for (let i = 900; i < data.length; i++) {
      // 현재 포지션이 없는 경우에만 매수 신호 확인
      if (currentPosition === null) {
        const entrySignal = self.analyzeEntry?.(data, i);
        
        if (entrySignal === 'buy') {
          const tradeId = `trade-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
          signals.push({
            id: tradeId,
            time: data[i].time as number,
            position: 'buy',
            price: data[i].close,
            strategy: 'MA_CROSS_DEVIATION',
            reason: '60MA가 120MA와 240MA를 상향돌파',
            metadata: self.calculateIndicators?.(data, i)
          });
          currentPosition = 'buy';
          lastTradeId = tradeId;
          console.log('✅ 매수 신호 생성 (MA_CROSS_DEVIATION):', {
            시간: new Date(data[i].time as number).toLocaleString('ko-KR'),
            가격: data[i].close.toLocaleString('ko-KR') + '원',
            '현재 포지션': currentPosition,
            '거래 ID': tradeId
          });
        }
      } 
      // 현재 롱 포지션인 경우, 청산 조건 확인
      else if (currentPosition === 'buy') {
        // 마지막 롱 진입 신호의 인덱스 찾기
        const entrySignalIndex = signals.findIndex(signal => 
          signal.id === lastTradeId && signal.position === 'buy');
        
        if (entrySignalIndex >= 0) {
          const entryPrice = signals[entrySignalIndex].price;
          
          // 첫 번째 거래 여부를 analyzeExit에 전달하기 위한 임시 방법
          // 실제 구현에서는 더 나은 상태 관리 방법이 필요
          const shouldExit = isFirstTrade ? 
            (prevMa60: number, ma60: number, prevMa300: number, ma300: number) => (prevMa60 >= prevMa300 && ma60 < ma300) :
            (prevMa60: number, ma60: number, prevMa360: number, ma360: number) => (prevMa60 >= prevMa360 && ma60 < ma360);
          
          // 현재 및 이전 MAs 계산
          const ma60 = data.slice(i - 60, i).reduce((sum, d) => sum + d.close, 0) / 60;
          const prevMa60 = data.slice(i - 61, i - 1).reduce((sum, d) => sum + d.close, 0) / 60;
          const ma300 = data.slice(i - 300, i).reduce((sum, d) => sum + d.close, 0) / 300;
          const prevMa300 = data.slice(i - 301, i - 1).reduce((sum, d) => sum + d.close, 0) / 300;
          const ma360 = data.slice(i - 360, i).reduce((sum, d) => sum + d.close, 0) / 360;
          const prevMa360 = data.slice(i - 361, i - 1).reduce((sum, d) => sum + d.close, 0) / 360;
          const ma900 = data.slice(i - 900, i).reduce((sum, d) => sum + d.close, 0) / 900;
          
          // 900MA 돌파 여부 확인
          const isAbove900MA = data[i].close > ma900;
          
          // 매도 조건 확인
          let exitCondition = false;
          
          if (!isAbove900MA) {
            if (isFirstTrade) {
              exitCondition = prevMa60 >= prevMa300 && ma60 < ma300;
            } else {
              exitCondition = prevMa60 >= prevMa360 && ma60 < ma360;
            }
          }
          
          if (exitCondition) {
            const exitTradeId = `trade-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
            signals.push({
              id: exitTradeId,
              time: data[i].time as number,
              position: 'sell',
              price: data[i].close,
              strategy: 'MA_CROSS_DEVIATION',
              reason: isFirstTrade ? '60MA가 300MA를 하향돌파' : '60MA가 360MA를 하향돌파',
              relatedTradeId: lastTradeId || undefined,
              metadata: self.calculateIndicators?.(data, i)
            });
            currentPosition = null;
            lastTradeId = null;
            
            // 첫 번째 거래 완료 후 상태 업데이트
            if (isFirstTrade) {
              isFirstTrade = false;
            }
            
            console.log('✅ 매도 신호 생성 (MA_CROSS_DEVIATION):', {
              시간: new Date(data[i].time as number).toLocaleString('ko-KR'),
              가격: data[i].close.toLocaleString('ko-KR') + '원',
              '이전 포지션': 'buy',
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
    
    return {
      signals,
      lastProcessedIndex: data.length - 1,
      currentPosition,
      lastTradeId
    };
  }
};

export default maCrossDeviationStrategy; 