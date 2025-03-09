import { CandlestickData, Time } from 'lightweight-charts';
import { BollingerStrategy, TradeSignal, ExtendedMetadata, AnalyzeOptions, AnalysisResult } from './types';
import { calculateStandardDeviation } from './utils';

// 볼린저 밴드 전략
const bollingerStrategy: BollingerStrategy = {
  name: 'BOLLINGER',
  timeframe: '1m',
  description: '볼린저 밴드와 이동평균선 기반 전략',
  author: 'System',
  version: '2.0.0',
  tags: ['trend', 'moving-average', 'bollinger'],
  
  indicators: {
    maPeriods: { short: 60, long: 240 }
  },
  
  riskManagement: {
    stopLossPercent: 1.0,
    takeProfitPercent: 2.0,
    positionSizePercent: 50
  },
  
  // 진입 조건 분석
  analyzeEntry(data, index) {
    if (index < 360) {
      console.log('데이터 인덱스가 부족합니다. 최소 360개 이상의 캔들이 필요합니다.');
      return null;
    }

    console.log(`\n[볼린저 매수 분석] 인덱스: ${index}, 시간: ${new Date().toLocaleString()}`);
    
    // MA 계산
    const ma60 = data.slice(index - 60, index).reduce((a, b) => a + b.close, 0) / 60;
    const ma120 = data.slice(index - 120, index).reduce((a, b) => a + b.close, 0) / 120;
    const ma240 = data.slice(index - 240, index).reduce((a, b) => a + b.close, 0) / 240;
    const ma900 = data.slice(index - 900, index).reduce((a, b) => a + b.close, 0) / 900;
    
    // 이전 MA 계산
    const prevMa60 = data.slice(index - 61, index - 1).reduce((a, b) => a + b.close, 0) / 60;
    const prevMa120 = data.slice(index - 121, index - 1).reduce((a, b) => a + b.close, 0) / 120;
    const prevMa240 = data.slice(index - 241, index - 1).reduce((a, b) => a + b.close, 0) / 240;
    const prevMa900 = data.slice(index - 901, index - 1).reduce((a, b) => a + b.close, 0) / 900;

    // MA 기울기 계산
    const ma60Slope = ((ma60 - prevMa60) / prevMa60) * 100;
    const ma120Slope = ((ma120 - prevMa120) / prevMa120) * 100;
    const ma240Slope = ((ma240 - prevMa240) / prevMa240) * 100;
    const ma900Slope = ((ma900 - prevMa900) / prevMa900) * 100;

    console.log(`MA 값 정보:
    - MA60: ${ma60.toFixed(2)} (기울기: ${ma60Slope.toFixed(4)}%)
    - MA120: ${ma120.toFixed(2)} (기울기: ${ma120Slope.toFixed(4)}%)
    - MA240: ${ma240.toFixed(2)} (기울기: ${ma240Slope.toFixed(4)}%)
    - MA900: ${ma900.toFixed(2)} (기울기: ${ma900Slope.toFixed(4)}%)`);

    // MA 기울기 비교
    const ma60Above120 = ma60 > ma120;
    const ma60Above240 = ma60 > ma240;
    const ma60Below900 = ma60 < ma900;
    console.log(`상대적 위치:
    - MA60 > MA120: ${ma60Above120 ? '✅' : '❌'}
    - MA60 > MA240: ${ma60Above240 ? '✅' : '❌'}
    - MA60 < MA900: ${ma60Below900 ? '✅' : '❌'}`);

    // MA240 상향 지속 기간 체크 (5봉 기준)
    let ma240UpCount = 0;
    for (let i = 0; i < 5; i++) {
      if (index - i < 241) continue;
      const currentMA240 = data.slice(index - 240 - i, index - i).reduce((a, b) => a + b.close, 0) / 240;
      const prevMA240 = data.slice(index - 241 - i, index - 1 - i).reduce((a, b) => a + b.close, 0) / 240;
      if (currentMA240 > prevMA240) {
        ma240UpCount++;
      }
    }
    console.log(`MA240 상향 봉 수: ${ma240UpCount}/5`);

    // MA900 상향 확인 (10봉 기준)
    let ma900UpCount = 0;
    for (let i = 0; i < 10; i++) {
      if (index - i < 901) continue;
      const currentMA900 = data.slice(index - 900 - i, index - i).reduce((a, b) => a + b.close, 0) / 900;
      const prevMA900 = data.slice(index - 901 - i, index - 1 - i).reduce((a, b) => a + b.close, 0) / 900;
      if (currentMA900 > prevMA900) {
        ma900UpCount++;
      }
    }
    const isMA900Upward = ma900UpCount >= 10;
    console.log(`MA900 상향 봉 수: ${ma900UpCount}/10, 상향 여부: ${isMA900Upward ? '✅' : '❌'}`);

    // MA60 > MA120 유지 기간 확인
    let ma60Above120Count = 0;
    for (let i = 0; i < 5; i++) {
      if (index - i < 120) continue;
      const ma60Hist = data.slice(index - 60 - i, index - i).reduce((a, b) => a + b.close, 0) / 60;
      const ma120Hist = data.slice(index - 120 - i, index - i).reduce((a, b) => a + b.close, 0) / 120;
      if (ma60Hist > ma120Hist) {
        ma60Above120Count++;
      }
    }
    console.log(`MA60 > MA120 유지 봉 수: ${ma60Above120Count}/5`);

    // 조건 검사 결과 로그
    console.log('\n매수 조건 충족 여부:');
    console.log({
      '조건 1 (MA240 상향 5봉 이상)': ma240UpCount >= 5 ? '✅' : '❌',
      '조건 2 (MA60 > MA120)': ma60Above120 ? '✅' : '❌',
      '조건 3 (MA60 > MA240)': ma60Above240 ? '✅' : '❌',
      '조건 4 (MA900 상향 10봉)': isMA900Upward ? '✅' : '❌',
      '조건 5 (MA60 < MA900)': ma60Below900 ? '✅' : '❌',
      '최종 판정': (ma240UpCount >= 5 && ma60Above120 && ma60Above240 && isMA900Upward) ? '✅ 매수 신호 발생!' : '❌ 매수 조건 불충족'
    });

    // 매수 시그널 생성 - 기본 조건
    if (ma240UpCount >= 5 && ma60Above120 && ma60Above240 && isMA900Upward) {
      console.log('\n=== ✅ 매수 조건 충족! ===');
      return 'long';
    }

    console.log('\n=== ❌ 매수 조건 불충족 ===');
    return null;
  },
  
  // 청산 조건 분석
  analyzeExit(data: CandlestickData<Time>[], index: number, position: 'long', entryPrice: number): boolean {
    // position이 'long'이 아니면 매도 신호를 발생시키지 않음
    if (index < 360 || position !== 'long') {
      console.log('매도 분석: 데이터 부족 또는 롱 포지션이 아님');
      return false;
    }

    console.log(`\n[볼린저 매도 분석] 인덱스: ${index}, 진입가: ${entryPrice.toLocaleString()}`);
    
    // 현재 가격
    const currentPrice = data[index].close;
    const priceChangePercent = ((currentPrice / entryPrice) - 1) * 100;
    
    console.log(`현재 가격: ${currentPrice.toLocaleString()}, 변동률: ${priceChangePercent.toFixed(2)}%`);

    // MA 계산
    const ma60 = data.slice(index - 60, index).reduce((a, b) => a + b.close, 0) / 60;
    const ma120 = data.slice(index - 120, index).reduce((a, b) => a + b.close, 0) / 120;
    const ma240 = data.slice(index - 240, index).reduce((a, b) => a + b.close, 0) / 240;
    
    console.log(`주요 이동평균: 
    - MA60: ${ma60.toFixed(2)}
    - MA120: ${ma120.toFixed(2)}
    - MA240: ${ma240.toFixed(2)}`);

    // 이전 MA 계산
    const prevMa60 = data.slice(index - 61, index - 1).reduce((a, b) => a + b.close, 0) / 60;
    const prevMa120 = data.slice(index - 121, index - 1).reduce((a, b) => a + b.close, 0) / 120;
    
    // MA 기울기 계산
    const ma60Slope = ((ma60 - prevMa60) / prevMa60) * 100;
    const ma120Slope = ((ma120 - prevMa120) / prevMa120) * 100;
    
    console.log(`이동평균 기울기:
    - MA60 기울기: ${ma60Slope.toFixed(4)}%
    - MA120 기울기: ${ma120Slope.toFixed(4)}%`);

    // 손절 조건 (1% 이상 손실)
    const stopLossTriggered = priceChangePercent <= -1.0;
    
    // 이익실현 조건 (2% 이상 수익)
    const takeProfitTriggered = priceChangePercent >= 2.0;
    
    // MA60이 MA120 아래로 내려간 경우
    const ma60BelowMA120 = ma60 < ma120;
    
    // MA60 하락 추세
    const ma60Downtrend = ma60Slope < 0;
    
    console.log(`매도 조건 검사:
    - 손절(-1% 이하): ${stopLossTriggered ? '✅' : '❌'} (${priceChangePercent.toFixed(2)}%)
    - 이익실현(+2% 이상): ${takeProfitTriggered ? '✅' : '❌'} (${priceChangePercent.toFixed(2)}%)
    - MA60 < MA120: ${ma60BelowMA120 ? '✅' : '❌'}
    - MA60 하락 추세: ${ma60Downtrend ? '✅' : '❌'}`);

    // 매도 시그널 생성
    if (stopLossTriggered || takeProfitTriggered || (ma60BelowMA120 && ma60Downtrend)) {
      let reason = '';
      if (stopLossTriggered) reason = '손절 조건 충족';
      else if (takeProfitTriggered) reason = '이익실현 조건 충족';
      else reason = 'MA60이 MA120 아래로 내려가고 하락 추세';
      
      console.log(`\n=== ✅ 매도 조건 충족! (${reason}) ===`);
      return true;
    }
    
    console.log('\n=== ❌ 매도 조건 불충족 ===');
    return false;
  },
  
  // 지표 계산 함수
  calculateIndicators(data, index) {
    if (index < 360) {
      return {} as ExtendedMetadata;
    }
    
    // MA 계산
    const ma60 = data.slice(index - 60, index).reduce((a, b) => a + b.close, 0) / 60;
    const ma120 = data.slice(index - 120, index).reduce((a, b) => a + b.close, 0) / 120;
    const ma240 = data.slice(index - 240, index).reduce((a, b) => a + b.close, 0) / 240;
    const ma900 = data.slice(index - 900, index).reduce((a, b) => a + b.close, 0) / 900;
    
    // 볼린저 밴드 계산
    const period = 20;
    const stdDev = 2;
    const prices = data.slice(index - period, index).map(d => d.close);
    const sma = prices.reduce((a, b) => a + b, 0) / period;
    const sd = calculateStandardDeviation(prices);
    const upperBand = sma + (stdDev * sd);
    const lowerBand = sma - (stdDev * sd);
    
    // 이격도 계산
    const deviation = Math.abs(data[index].close - ma60) / ma60;
    
    const metadata: ExtendedMetadata = {
      ma60,
      ma120,
      ma240,
      ma900,
      upperBand,
      lowerBand,
      deviation,
      isAbove900MA: data[index].close > ma900
    };
    
    return metadata;
  },
  
  // 기존 분석 함수는 새로운 함수들을 활용
  analyze(data, options?: AnalyzeOptions): AnalysisResult {
    const signals: TradeSignal[] = [];
    let currentPosition: 'long' | null = null;
    let lastTradeId: string | null = null;
    
    if (data.length < 900) {
      console.log('데이터가 충분하지 않습니다. 최소 900개의 캔들이 필요합니다.');
      return {
        signals,
        lastProcessedIndex: data.length - 1,
        currentPosition,
        lastTradeId
      };
    }
    
    const self = this;
    
    console.log('\n=== 볼린저 전략 분석 시작 ===');
    console.log('데이터 길이:', data.length);
    console.log('분석 시작 시간:', new Date().toLocaleString('ko-KR'));
    console.log('실시간 모드:', options?.realtime ? '✅' : '❌');
    
    // 실시간 모드인 경우 마지막 캔들만 분석
    let startIndex = 900;
    let endIndex = data.length;
    
    if (options?.realtime && options.lastProcessedIndex >= 900) {
      // 마지막으로 처리된 인덱스 이후의 데이터만 분석
      startIndex = options.lastProcessedIndex + 1;
      console.log(`실시간 모드: 인덱스 ${startIndex}부터 ${endIndex - 1}까지 분석합니다.`);
      
      // 현재 포지션 상태 가져오기 (실제 구현에서는 store에서 가져와야 함)
      // 여기서는 예시로 마지막 신호의 포지션을 사용
      if (options.currentPosition) {
        currentPosition = options.currentPosition;
        console.log(`현재 포지션: ${currentPosition}`);
      }
      
      if (options.lastTradeId) {
        lastTradeId = options.lastTradeId;
        console.log(`마지막 거래 ID: ${lastTradeId}`);
      }
    } else {
      console.log(`전체 데이터 분석: 인덱스 ${startIndex}부터 ${endIndex - 1}까지 분석합니다.`);
    }

    for (let i = startIndex; i < endIndex; i++) {
      // 현재 캔들 정보 로깅
      if (i % 100 === 0 || options?.realtime) {
        console.log(`캔들 ${i}/${data.length - 1} 분석 중...`);
      }
      
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
            strategy: 'BOLLINGER',
            reason: '매수 조건 충족',
            metadata: self.calculateIndicators?.(data, i)
          });
          
          lastTradeId = tradeId;
          currentPosition = 'long';
          
          console.log('\n=== ✅ 매수 마커 생성 완료 ===');
          console.log({
            '체크 시간': new Date().toLocaleString('ko-KR'),
            '캔들 인덱스': i,
            '캔들 시간': new Date(data[i].time as number).toLocaleString('ko-KR'),
            '매수 가격': data[i].close.toLocaleString('ko-KR') + '원',
            '거래 ID': tradeId
          });
          continue; // 매수 신호가 발생하면 매도 조건을 확인하지 않고 다음 캔들로 이동
        }
      } 
      // 현재 롱 포지션인 경우에만 매도 신호 확인
      else if (currentPosition === 'long' && lastTradeId) {
        const entrySignalIndex = signals.findIndex(signal => signal.id === lastTradeId);
        let entryPrice;
        
        if (entrySignalIndex >= 0) {
          entryPrice = signals[entrySignalIndex].price;
        } else if (options?.entryPrice) {
          // 실시간 모드에서 이전 매수 신호가 signals 배열에 없는 경우 옵션에서 가져옴
          entryPrice = options.entryPrice;
        } else {
          console.log('매수 가격을 찾을 수 없습니다. 매도 신호를 생성할 수 없습니다.');
          continue;
        }
        
        const shouldExit = self.analyzeExit?.(data, i, 'long', entryPrice);
        
        if (shouldExit) {
          const exitTradeId = `trade-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
          signals.push({
            id: exitTradeId,
            time: data[i].time as number,
            position: 'close',
            price: data[i].close,
            strategy: 'BOLLINGER',
            reason: '매도 조건 충족',
            metadata: self.calculateIndicators?.(data, i),
            relatedTradeId: lastTradeId
          });
          
          console.log('\n=== ✅ 매도 신호 생성 ===');
          console.log({
            '체크 시간': new Date().toLocaleString('ko-KR'),
            '캔들 인덱스': i,
            '캔들 시간': new Date(data[i].time as number).toLocaleString('ko-KR'),
            '매도 가격': data[i].close.toLocaleString('ko-KR') + '원',
            '매수 가격': entryPrice.toLocaleString('ko-KR') + '원',
            '수익률': ((data[i].close / entryPrice - 1) * 100).toFixed(2) + '%',
            '거래 ID': exitTradeId,
            '관련 매수 ID': lastTradeId
          });
          
          // 매도 신호 생성 후 즉시 포지션과 거래 ID 초기화
          currentPosition = null;
          lastTradeId = null;
          
          console.log('✅ 매도 후 상태 초기화 완료:', {
            '현재 포지션': currentPosition,
            '다음 매수 준비': '완료'
          });
          continue; // 현재 캔들에서 매도 신호를 생성한 후 다음 캔들로 이동
        }
      }
    }
    
    console.log('\n=== 볼린저 전략 분석 완료 ===');
    console.log('생성된 신호 수:', signals.length);
    console.log('분석 완료 시간:', new Date().toLocaleString('ko-KR'));
    console.log('마지막 처리된 인덱스:', endIndex - 1);
    
    // 분석 완료 후 이벤트 발생 - 매수 분석이 자동으로 실행되도록 알림
    if (typeof window !== 'undefined') {
      console.log('볼린저 분석 완료 이벤트 발생');
      window.dispatchEvent(new CustomEvent('bollingerAnalysisComplete', {
        detail: { 
          type: 'bollingerAnalysisComplete',
          signals: signals.length,
          lastProcessedIndex: endIndex - 1
        }
      }));
    }
    
    // 현재 상태 정보 반환 (실시간 모드에서 다음 호출 시 사용)
    return {
      signals,
      lastProcessedIndex: endIndex - 1,
      currentPosition,
      lastTradeId,
      entryPrice: currentPosition === 'long' && signals.length > 0 ? 
        signals.find(s => s.id === lastTradeId)?.price : undefined
    };
  }
};

export default bollingerStrategy; 