import { CandlestickData, Time } from 'lightweight-charts';
import { TradingStrategy, TradeSignal, ExtendedMetadata, AnalyzeOptions, AnalysisResult, TradeStrategy } from './types';
import { calculateStandardDeviation } from './utils';
import useUpbitStore from '../store/useUpbitStore';
import { useEffect } from 'react';

type TradeState = 'waiting_buy' | 'buying' | 'bought' | 'waiting_sell' | 'selling' | 'sold';

// MA 크로스 & 이격도 전략
const maCrossStrategy: TradingStrategy = {
  name: 'MA_CROSS',
  timeframe: '1m',
  description: '이격도 및 다중 이동평균선 교차 전략',
  author: 'System',
  version: '2.0.0',
  tags: ['trend', 'moving-average', 'deviation'],
  
  indicators: {
    maPeriods: { short: 60, medium: 120, long: 240 }
  },
  
  riskManagement: {
    stopLossPercent: 1.0,
    takeProfitPercent: 3.0,
    positionSizePercent: 40
  },
  
  // 진입 조건 분석
  analyzeEntry(data: CandlestickData<Time>[], index: number): 'buy' | null {
    const entryDateTime = new Date(data[index].time as number * 1000);
    console.log('\n=== 📊 analyzeEntry 함수 진입 ===');
    console.log('분석 시작 시간:', entryDateTime.toLocaleString('ko-KR'));
    console.log('캔들 인덱스:', index);

    // 필요한 최소 데이터 검사
    const requiredData = 900; // MA900 계산에 필요
    const isCollecting = index < requiredData;
    if (isCollecting) {
      console.log(`초기 데이터 수집 중... (필요: ${requiredData}초)`);
      console.log(`현재: ${index}초 / ${requiredData}초 (${((index/requiredData)*100).toFixed(1)}%)`);
      return null;
    }

    // 충분한 데이터가 있는지 검사
    if (data.length < requiredData || index < requiredData) {
      console.log('충분한 데이터가 없습니다.');
      console.log(`필요한 데이터: ${requiredData}초`);
      console.log(`현재 데이터 길이: ${data.length}초`);
      console.log(`현재 인덱스: ${index}`);
      return null;
    }

    // 이전 데이터 무결성 검사
    const dataSlice = data.slice(index - requiredData, index);
    if (dataSlice.some(d => d === undefined || d.close === undefined)) {
      console.log('이전 데이터에 누락된 값이 있습니다.');
      return null;
    }

    // 현재 거래 상태 체크
    const store = useUpbitStore.getState();
    
    console.log('\n=== 현재 거래 상태 체크 ===');
    console.log('현재 상태:', store.tradeState);
    
    // 매수 가능 상태 체크 - 'wait' 상태일 때만 매수 가능하도록 수정
    const canBuy = store.tradeState.theoreticalPosition === 'wait';
    
    // MA 계산 - 매수 가능 상태와 관계없이 계산
    const ma60 = data.slice(index - 60, index).reduce((a, b) => a + b.close, 0) / 60;
    const prevMa60 = data.slice(index - 61, index - 1).reduce((a, b) => a + b.close, 0) / 60;

    const ma120 = data.slice(index - 120, index).reduce((a, b) => a + b.close, 0) / 120;
    const prevMa120 = data.slice(index - 121, index - 1).reduce((a, b) => a + b.close, 0) / 120;

    const ma240 = data.slice(index - 240, index).reduce((a, b) => a + b.close, 0) / 240;
    const prevMa240 = data.slice(index - 241, index - 1).reduce((a, b) => a + b.close, 0) / 240;

    const ma900 = data.slice(index - 900, index).reduce((a, b) => a + b.close, 0) / 900;

    // 60MA가 120MA와 240MA를 상향 돌파하는지 확인
    const crossAbove120 = prevMa60 <= prevMa120 && ma60 > ma120;
    const crossAbove240 = prevMa60 <= prevMa240 && ma60 > ma240;
    
    // 60MA가 900MA 아래에 있는지 확인
    const isBelow900MA = ma60 < ma900;

    // 로그 출력
    console.log('\n=== 매수 조건 검사 ===');
    console.log({
      '조건 1 (60MA가 120MA 상향돌파)': crossAbove120 ? '✅' : '❌',
      '조건 2 (60MA가 240MA 상향돌파)': crossAbove240 ? '✅' : '❌',
      '조건 3 (60MA가 900MA 아래)': isBelow900MA ? '✅' : '❌',
      '최종 판정': (crossAbove120 && crossAbove240 && isBelow900MA) ? '✅ 매수 신호 발생!' : '❌ 매수 조건 불충족'
    });
    
    // 매수 가능 상태가 아닌 경우
    if (!canBuy) {
      console.log('\n=== ❌ 매수 불가 상태 ===');
      console.log('매수 가능 상태가 아닙니다. (waiting_buy 상태여야 함)');
      return null;
    }

    console.log('✅ 매수 가능 상태 확인');

    // 매수 시그널 생성
    if (crossAbove120 && crossAbove240 && isBelow900MA) {
      console.log('\n=== ✅ 매수 조건 충족! ===');
      console.log('상태 변경: waiting_buy → buy (매수 주문 실행)');
      return 'buy';  // 매수 신호 발생 → 매수 주문 실행 (buy)
    }

    return null;  // 매수 조건 불충족
  },
  
  // 청산 조건 분석
  analyzeExit(data: CandlestickData<Time>[], index: number, position: 'buy', entryPrice: number): boolean {
    // position이 'buy'가 아니면 매도 신호를 발생시키지 않음
    if (index < 900 || position !== 'buy') return false;
    
    // MA 계산
    const ma60 = data.slice(index - 60, index).reduce((a, b) => a + b.close, 0) / 60;
    const ma120 = data.slice(index - 120, index).reduce((a, b) => a + b.close, 0) / 120;
    const ma240 = data.slice(index - 240, index).reduce((a, b) => a + b.close, 0) / 240;
    const ma300 = data.slice(index - 300, index).reduce((a, b) => a + b.close, 0) / 300;
    const ma360 = data.slice(index - 360, index).reduce((a, b) => a + b.close, 0) / 360;
    const ma900 = data.slice(index - 900, index).reduce((a, b) => a + b.close, 0) / 900;
    
    // 이전 MA 계산
    const prevMa60 = data.slice(index - 61, index - 1).reduce((a, b) => a + b.close, 0) / 60;
    const prevMa300 = data.slice(index - 301, index - 1).reduce((a, b) => a + b.close, 0) / 300;
    const prevMa360 = data.slice(index - 361, index - 1).reduce((a, b) => a + b.close, 0) / 360;
    const prevMa900 = data.slice(index - 601, index - 1).reduce((a, b) => a + b.close, 0) / 600;

    // 900MA 돌파 여부 확인
    const isAbove900MA = data[index].close > ma900;
    
    // 첫 번째 매도 조건: 60MA가 300MA 하향돌파
    const downward60_300 = (prevMa60 >= prevMa300 && ma60 < ma300);
    
    // 두 번째 매도부터의 조건: 60MA가 360MA 하향돌파
    const downward60_360 = (prevMa60 >= prevMa360 && ma60 < ma360);

    // 현재 가격과 매수 가격의 차이 계산 (수익률)
    const currentPrice = data[index].close;
    const profitPercent = ((currentPrice / entryPrice) - 1) * 100;

    console.log('\n=== 매도 신호 분석 ===');
    console.log('현재 거래 상태:', {
      '매도 가능 여부': position === 'buy',
      '마지막 매수 시간': new Date().toLocaleString('ko-KR', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      })
    });

    // 매도 조건 확인 및 로그 출력
    console.log('매도 조건:', {
      '체크 시간': new Date().toLocaleString('ko-KR', {
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      }),
      '60MA/300MA 하향돌파': downward60_300 ? '✅' : '❌',
      '60MA/360MA 하향돌파': downward60_360 ? '✅' : '❌',
      '900MA 위 여부': isAbove900MA ? '✅ (매도 불가)' : '❌ (매도 가능)',
      '현재 수익률': profitPercent.toFixed(2) + '%'
    });

    // 900MA 위에 있을 때는 매도하지 않음
    if (isAbove900MA) {
        console.log('900MA 위에 있어 매도 신호 발생하지 않음');
        return false;
    }

    // 첫 번째 매도인 경우 (실제 구현에서는 상태를 저장해야 함)
    const isFirstTrade = true; // 이 부분은 실제 구현에서 상태를 관리해야 함

    // 매도 시그널 생성
    if (isFirstTrade && downward60_300) {
      console.log('\n=== 매도 조건 충족 여부 ===');
      console.log('상태 변경: waiting_sell → sell (매도 주문 실행)');
      console.log('✅ 매도 시그널 발생: 60MA가 300MA를 하향돌파 (첫 번째 매도)');
      return true;  // 매도 신호 발생 → 매도 주문 실행 (sell)
    }
    
    // 두 번째 매도부터는 360MA 하향돌파 조건 적용
    if (!isFirstTrade && downward60_360) {
      console.log('\n=== 매도 조건 충족 여부 ===');
      console.log('상태 변경: waiting_sell → sell (매도 주문 실행)');
      console.log('✅ 매도 시그널 발생: 60MA가 360MA를 하향돌파 (두 번째 이후 매도)');
      return true;  // 매도 신호 발생 → 매도 주문 실행 (sell)
    }

    // 손절 조건 - 수익률이 -1.5% 이하인 경우
    if (profitPercent <= -1.5) {
      console.log('\n=== 손절 조건 충족 여부 ===');
      console.log('상태 변경: waiting_sell → sell (손절 매도 실행)');
      console.log({
        '체크 시간': new Date().toLocaleString('ko-KR'),
        '현재 수익률': profitPercent.toFixed(2) + '%',
        '손절 기준': '-1.5%',
        '최종 판정': '✅ 손절 신호 발생!'
      });
      return true;  // 매도 신호 발생 → 매도 주문 실행 (sell)
    }

    console.log('\n=== 매도 조건 충족 여부 ===');
    console.log('상태 유지: waiting_sell (매도 대기)');
    return false;  // 매도 대기 상태 유지 (waiting_sell)
  },
  
  // 지표 계산 함수
  calculateIndicators(data, index) {
    if (index < 900) {
      return {} as ExtendedMetadata;
    }
    
    // MA 계산
    const ma60 = data.slice(index - 60, index).reduce((a, b) => a + b.close, 0) / 60;
    const ma120 = data.slice(index - 120, index).reduce((a, b) => a + b.close, 0) / 120;
    const ma240 = data.slice(index - 240, index).reduce((a, b) => a + b.close, 0) / 240;
    const ma300 = data.slice(index - 300, index).reduce((a, b) => a + b.close, 0) / 300;
    const ma360 = data.slice(index - 360, index).reduce((a, b) => a + b.close, 0) / 360;
    const ma900 = data.slice(index - 900, index).reduce((a, b) => a + b.close, 0) / 900;
    
    // 이전 MA 계산
    const prevMa60 = data.slice(index - 61, index - 1).reduce((a, b) => a + b.close, 0) / 60;
    const prevMa120 = data.slice(index - 121, index - 1).reduce((a, b) => a + b.close, 0) / 120;
    const prevMa240 = data.slice(index - 241, index - 1).reduce((a, b) => a + b.close, 0) / 240;
    const prevMa900 = data.slice(index - 901, index - 1).reduce((a, b) => a + b.close, 0) / 900;
    
    // 상향 돌파 체크
    const crossAbove120 = prevMa60 <= prevMa120 && ma60 > ma120;
    const crossAbove240 = prevMa60 <= prevMa240 && ma60 > ma240;
    
    // 60MA가 900MA 아래에 있는지 확인
    const isBelow900MA = ma60 < ma900;
    
    // 이격도 계산
    const deviation = Math.abs(data[index].close - ma60) / ma60;
    
    const metadata: ExtendedMetadata = {
      ma60,
      ma120,
      ma240,
      ma300,
      ma360,
      ma900,
      deviation,
      isAbove900MA: data[index].close > ma900
    };
    
    console.log(`MA60: ${ma60.toFixed(3)}`);
    console.log(`MA120: ${ma120.toFixed(3)}`);
    console.log(`MA240: ${ma240.toFixed(3)}`);
    console.log(`MA900: ${ma900.toFixed(3)}`);
      
    // 매수 조건 확인 상태 표시
    console.log('\n=== 매수 조건 체크 ===');
    console.log(`조건 1 (60MA가 120MA 상향돌파): ${crossAbove120 ? '✅' : '❌'}`);
    console.log(`조건 2 (60MA가 240MA 상향돌파): ${crossAbove240 ? '✅' : '❌'}`);
    console.log(`조건 3 (60MA가 900MA 아래): ${isBelow900MA ? '✅' : '❌'}`);
    console.log(`최종 판정: ${(crossAbove120 && crossAbove240 && isBelow900MA) ? '✅ 매수 조건 충족!' : '❌ 매수 조건 불충족'}`);
    
    return metadata;
  },
  
  // 분석 함수
  analyze(data, options?: AnalyzeOptions): AnalysisResult {
    const signals: TradeSignal[] = [];
    let currentPosition: 'buy' | null = options?.currentPosition || null;
    let lastTradeId: string | null = options?.lastTradeId || null;
    let isFirstTrade = true; // 첫 번째 거래 여부 추적
    
    // 마지막 신호 발생 시간 및 인덱스 추적
    let lastSignalIndex = options?.lastProcessedIndex ? options.lastProcessedIndex - 30 : 0; // 초기값 설정
    const minSignalInterval = 30; // 최소 30캔들(30초) 간격
    
    // 실시간 모드에서 이전 상태 유지
    if (options?.realtime && options?.lastProcessedIndex !== undefined) {
      // 이전 상태 로깅
      console.log('\n=== 이전 상태 확인 ===');
      console.log('이전 처리 인덱스:', options.lastProcessedIndex);
      console.log('이전 포지션:', options.currentPosition || '없음');
      console.log('이전 거래 ID:', options.lastTradeId || '없음');
      
      // 이전 상태 유지
      if (options.currentPosition) {
        currentPosition = options.currentPosition;
        console.log('이전 포지션 유지:', currentPosition);
      }
      
      if (options.lastTradeId) {
        lastTradeId = options.lastTradeId;
        console.log('이전 거래 ID 유지:', lastTradeId);
      }
      
      // 이전 신호 복원 (필요한 경우)
      if (options.signals && options.signals.length > 0) {
        signals.push(...options.signals);
        console.log('이전 신호 복원:', options.signals.length, '개');
      }
    }
    
    // MA900 계산을 위해 최소 900초의 데이터가 필요
    if (data.length < 900) {
      console.log('데이터가 충분하지 않습니다. 최소 900개의 캔들이 필요합니다. (15분)');
      console.log('현재 데이터 길이:', data.length, '초');
      return {
        signals,
        lastProcessedIndex: data.length - 1,
        currentPosition,
        lastTradeId
      };
    }
    
    console.log('\n=== MA 크로스 전략 분석 시작 ===');
    console.log('데이터 길이:', data.length, '초');
    console.log('분석 시작 시간:', new Date().toLocaleString('ko-KR'));
    console.log('실시간 모드:', options?.realtime ? '✅' : '❌');
    console.log('현재 포지션:', currentPosition || '없음');
    
    // 실시간 모드인 경우 마지막 캔들만 분석
    let startIndex = 0; // 처음부터 데이터 수집
    let endIndex = data.length;
    
    if (options?.realtime) {
      if (options?.lastProcessedIndex !== undefined) {
        // 이미 초기화가 완료된 경우
        if (options.lastProcessedIndex >= 900) {
        startIndex = options.lastProcessedIndex + 1;
          console.log(`실시간 모드: 신규 데이터만 분석 (인덱스 ${startIndex}부터 ${endIndex - 1}까지)`);
        } else {
          // 아직 초기화가 필요한 경우이지만, 분석은 계속 진행
          console.log('실시간 모드: 초기 데이터 수집 및 분석 중...');
          console.log(`현재: ${options.lastProcessedIndex}초 / 900초 (${((options.lastProcessedIndex/900)*100).toFixed(1)}%)`);
          startIndex = 0;  // 처음부터 분석
        }
      }
    } else {
      console.log(`전체 데이터 분석: 인덱스 ${startIndex}부터 ${endIndex - 1}까지`);
    }

    for (let i = startIndex; i < endIndex; i++) {
      // 마지막 신호와의 간격 체크
      const hasEnoughInterval = i - lastSignalIndex >= minSignalInterval;
      
      // 매수 조건 분석 (현재 포지션이 없는 경우)
      if (!currentPosition) {
        // 충분한 간격이 확보되었을 때만 신호 발생
        if (hasEnoughInterval) {
          const entryResult = this.analyzeEntry?.(data, i);
          
          // 매수 신호 발생
          if (entryResult === 'buy') {
            const price = data[i].close;
            const time = data[i].time as number;
            const id = `BUY_${time}_${price.toFixed(0)}`;
            
            // 트레이딩 신호 생성
            const signal: TradeSignal = {
              id,
              time,
              position: 'buy',
              price,
              strategy: 'MA_CROSS' as TradeStrategy,
              reason: '60MA가 120MA와 240MA를 상향돌파',
              metadata: {
                ma60: data.slice(i - 60, i).reduce((a, b) => a + b.close, 0) / 60,
              }
            };
            
            signals.push(signal);
            currentPosition = 'buy';
            lastTradeId = id;
            lastSignalIndex = i; // 마지막 신호 인덱스 업데이트
            
            console.log(`\n매수 신호 생성: ${new Date(time * 1000).toLocaleString('ko-KR')}`);
            console.log(`가격: ${price}`);
            console.log(`ID: ${id}`);
          } else {
            // 매수 신호가 없는 경우에도 매수 대기 중임을 로그로 남김
            if (i % 100 === 0 || i === endIndex - 1) {  // 100개 캔들마다 로그 출력 (너무 많은 로그 방지)
              console.log(`캔들 ${i} - 매수 대기 중...`);
            }
          }
        }
      }
      // 매도 조건 분석 (매수 포지션이 있는 경우)
      else if (currentPosition === 'buy' && lastTradeId) {
        // 충분한 간격이 확보되었을 때만 신호 발생 - 단, 매수 후 일정 시간(최소 60초=1분)은 보유
        if (i - lastSignalIndex >= 60) {
          const buySignal = signals.find(s => s.id === lastTradeId);
          
          if (buySignal) {
            const entryPrice = buySignal.price;
            const exitResult = this.analyzeExit?.(data, i, currentPosition, entryPrice);
            
            // 매도 신호 발생
            if (exitResult) {
              const price = data[i].close;
              const time = data[i].time as number;
              const id = `SELL_${time}_${price.toFixed(0)}`;
              
              // 현재 및 이전 MA 계산
              const ma60 = data.slice(i - 60, i).reduce((a, b) => a + b.close, 0) / 60;
              const prevMa60 = data.slice(i - 61, i - 1).reduce((a, b) => a + b.close, 0) / 60;
              const ma300 = data.slice(i - 300, i).reduce((a, b) => a + b.close, 0) / 300;
              const prevMa300 = data.slice(i - 301, i - 1).reduce((a, b) => a + b.close, 0) / 300;
              const ma360 = data.slice(i - 360, i).reduce((a, b) => a + b.close, 0) / 360;
              const prevMa360 = data.slice(i - 361, i - 1).reduce((a, b) => a + b.close, 0) / 360;
              
              // 매도 이유 결정
              let exitReason = '';
              const profitPercent = ((price / entryPrice) - 1) * 100;
              
              if (profitPercent <= -1.5) {
                exitReason = `손절: 수익률 ${profitPercent.toFixed(2)}%`;
              } else if (isFirstTrade && prevMa60 >= prevMa300 && ma60 < ma300) {
                exitReason = '60MA가 300MA를 하향돌파 (첫 번째 매도)';
              } else if (!isFirstTrade && prevMa60 >= prevMa360 && ma60 < ma360) {
                exitReason = '60MA가 360MA를 하향돌파 (두 번째 이후 매도)';
              } else {
                exitReason = '매도 조건 충족';
              }
              
              // 트레이딩 신호 생성
              const signal: TradeSignal = {
                id,
                time,
                position: 'sell',
                price,
                strategy: 'MA_CROSS' as TradeStrategy,
                relatedTradeId: lastTradeId,
                reason: exitReason,
                metadata: {
                  ma60: data.slice(i - 60, i).reduce((a, b) => a + b.close, 0) / 60,
                }
              };
              
              signals.push(signal);
            currentPosition = null;
            lastTradeId = null;
              lastSignalIndex = i; // 마지막 신호 인덱스 업데이트
              
              // 첫 번째 거래 완료 후 상태 업데이트
              if (isFirstTrade) {
                isFirstTrade = false;
              }
              
              console.log(`\n매도 신호 생성: ${new Date(time * 1000).toLocaleString('ko-KR')}`);
              console.log(`가격: ${price}`);
              console.log(`수익률: ${profitPercent.toFixed(2)}%`);
              console.log(`매도 이유: ${exitReason}`);
              console.log(`ID: ${id}`);
            } else {
              // 매도 신호가 없는 경우에도 매수 상태임을 로그로 남김
              if (i % 100 === 0 || i === endIndex - 1) {  // 100개 캔들마다 로그 출력 (너무 많은 로그 방지)
                console.log(`캔들 ${i} - 매수 중(매도 대기 중)...`);
              }
            }
          }
        }
      }
    }
    
    console.log('\n=== MA 크로스 전략 분석 완료 ===');
    console.log('총 신호 개수:', signals.length);
    console.log('매수 신호:', signals.filter(s => s.position === 'buy').length);
    console.log('매도 신호:', signals.filter(s => s.position === 'sell').length);
    
    // 현재 상태 확인 및 다음 액션 준비
    if (currentPosition === null) {
      console.log('\n=== 현재 상태: 매수 대기 중 ===');
      console.log('→ 다음 액션: 매수 조건 모니터링');
      
      // 마지막 캔들 정보 표시
      const lastCandle = data[data.length - 1];
      console.log(`마지막 캔들 시간: ${new Date(lastCandle.time as number * 1000).toLocaleString('ko-KR')}`);
      console.log(`마지막 캔들 가격: ${lastCandle.close.toLocaleString('ko-KR')}원`);
      
      // 이동평균선 값 표시
      const ma60 = data.slice(data.length - 60, data.length).reduce((a, b) => a + b.close, 0) / 60;
      const ma120 = data.slice(data.length - 120, data.length).reduce((a, b) => a + b.close, 0) / 120;
      const ma240 = data.slice(data.length - 240, data.length).reduce((a, b) => a + b.close, 0) / 240;
      const ma900 = data.slice(data.length - 900, data.length).reduce((a, b) => a + b.close, 0) / 900;
      
      // 이전 MA 계산
      const prevMa60 = data.slice(data.length - 61, data.length - 1).reduce((a, b) => a + b.close, 0) / 60;
      const prevMa120 = data.slice(data.length - 121, data.length - 1).reduce((a, b) => a + b.close, 0) / 120;
      const prevMa240 = data.slice(data.length - 241, data.length - 1).reduce((a, b) => a + b.close, 0) / 240;
      
      console.log(`MA60: ${ma60.toFixed(3)}`);
      console.log(`MA120: ${ma120.toFixed(3)}`);
      console.log(`MA240: ${ma240.toFixed(3)}`);
      console.log(`MA900: ${ma900.toFixed(3)}`);
      
      // 매수 조건 확인 상태 표시
      const crossAbove120 = prevMa60 <= prevMa120 && ma60 > ma120;
      const crossAbove240 = prevMa60 <= prevMa240 && ma60 > ma240;
      const isBelow900MA = ma60 < ma900;
      
      console.log('\n=== 매수 조건 체크 ===');
      console.log(`조건 1 (60MA가 120MA 상향돌파): ${crossAbove120 ? '✅' : '❌'}`);
      console.log(`조건 2 (60MA가 240MA 상향돌파): ${crossAbove240 ? '✅' : '❌'}`);
      console.log(`조건 3 (60MA가 900MA 아래): ${isBelow900MA ? '✅' : '❌'}`);
      console.log(`최종 판정: ${(crossAbove120 && crossAbove240 && isBelow900MA) ? '✅ 매수 조건 충족!' : '❌ 매수 조건 불충족'}`);
    } else {
      console.log('\n=== 현재 상태: 매수 완료(매도 대기 중) ===');
      console.log('→ 다음 액션: 매도 조건 모니터링');
      
      // 매수 정보 표시
      const buySignal = signals.find(s => s.id === lastTradeId);
      if (buySignal) {
        const buyTime = new Date(buySignal.time * 1000).toLocaleString('ko-KR');
        console.log(`매수 시간: ${buyTime}`);
        console.log(`매수 가격: ${buySignal.price.toLocaleString('ko-KR')}원`);
        
        // 현재 수익률 계산
        const currentPrice = data[data.length - 1].close;
        const profitRatio = ((currentPrice - buySignal.price) / buySignal.price * 100).toFixed(2);
        console.log(`현재 가격: ${currentPrice.toLocaleString('ko-KR')}원`);
        console.log(`현재 수익률: ${profitRatio}%`);
      }
    }
    
    console.log('\n분석 종료 시간:', new Date().toLocaleString('ko-KR'));
    
    return {
      signals,
      lastProcessedIndex: endIndex - 1,
      currentPosition,
      lastTradeId
    };
  }
};

export default maCrossStrategy; 