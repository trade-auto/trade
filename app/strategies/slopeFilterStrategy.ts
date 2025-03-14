import { CandlestickData, Time } from 'lightweight-charts';
import { TradingStrategy, TradeSignal, ExtendedMetadata, AnalyzeOptions, AnalysisResult, TradeStrategy } from './types';
import { calculateEMA, createTempCandleData, calculateRSI } from './utils';
import useUpbitStore from '../store/useUpbitStore';
import { useEffect } from 'react';

type TradeState = {
  state: 'waiting_buy' | 'buying' | 'bought' | 'waiting_sell' | 'selling' | 'sold';
  lastTrade?: 'buy' | 'sell' | null;
};

// A15 기울기 필터 전략
const slopeFilterStrategy: TradingStrategy = {
  name: 'SLOPE_FILTER',
  timeframe: '1m',
  description: '기울기 필터 기반 A15 전략 (MA/RSI/기울기)',
  author: 'System',
  version: '2.0.0',
  tags: ['trend', 'momentum', 'slope', 'filter'],
  
  indicators: {
    maPeriods: { short: 40, medium: 60, long: 120 },
    rsi: { period: 14, overbought: 70, oversold: 30 }
  },
  
  riskManagement: {
    stopLossPercent: 1.5,
    takeProfitPercent: 3.0,
    positionSizePercent: 40
  },
  
  // 진입 조건 분석
  analyzeEntry(data: CandlestickData<Time>[], index: number): 'buy' | null {
    const entryDateTime = new Date(data[index].time as number * 1000);
    console.log('\n=== 📊 A15 진입 분석 함수 호출 ===');
    console.log('분석 시작 시간:', entryDateTime.toLocaleString('ko-KR'));
    console.log('캔들 인덱스:', index);

    // 필요한 최소 데이터 검사
    const requiredData = 600; // MA600 계산에 필요
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
    const ma360 = data.slice(index - 360, index).reduce((a, b) => a + b.close, 0) / 360;

    // MA600 계산 추가
    const ma600 = data.slice(index - 600, index).reduce((a, b) => a + b.close, 0) / 600;
    const prevMa600 = data.slice(index - 601, index - 1).reduce((a, b) => a + b.close, 0) / 600;
    const slope600 = ma600 - prevMa600;
    
    // 기울기를 각도로 변환 (라디안 -> 도)
    // 1초당 변화량을 각도로 변환 (아크탄젠트 사용)
    // 분모를 1로 설정하면 1초당 변화량을 기준으로 각도 계산
    const angle600Raw = Math.atan(slope600);
    const angle600 = angle600Raw * (180 / Math.PI);
    
    // 디버깅을 위한 추가 계산
    const percentChange600 = (slope600 / prevMa600) * 100;
    
    console.log('\n=== 각도 계산 디버깅 ===');
    console.log('MA600:', ma600);
    console.log('이전 MA600:', prevMa600);
    console.log('MA600 변화량:', slope600);
    console.log('MA600 변화율(%):', percentChange600.toFixed(6) + '%');
    console.log('MA600 각도(라디안):', angle600Raw);
    console.log('MA600 각도(도):', angle600.toFixed(2) + '°');
    console.log('MA600 안정 상태 여부:', Math.abs(angle600) < 10 ? '✅ 안정적' : '❌ 불안정');

    // 기울기 계산
    const slope60 = ma60 - prevMa60;
    const slope120 = ma120 - prevMa120;
    
    // 매수 조건
    const isNotLastBuy = store.tradeState.lastTradeType !== 'bid';
    const isSlopeChange = slope60 < -0.005 || slope60 > 0.005;
    const isNotBothDownward = !(slope60 < 0 && slope120 < 0);
    const isCrossAbove120 = prevMa60 <= prevMa120 && ma60 > ma120;
    const isNarrowDeviation = Math.abs(ma60 - ma120) < 0.01 && ma60 > ma120 && slope60 > 0;
    const isPerfectAlignment = ma60 > ma120 && ma120 > ma240 && ma60 > ma120;
    const isReverseAlignment = ma60 < ma120 && ma120 < ma240;
    const isMa600Stable = Math.abs(angle600) < 10;  // 10도 미만의 변화만 허용

    // 로그 출력
    console.log('\n=== A15 매수 조건 검사 ===');
    console.log({
      'MA60': ma60.toFixed(2),
      'MA120': ma120.toFixed(2),
      'MA240': ma240.toFixed(2),
      'MA600': ma600.toFixed(2),
      '60MA 기울기': slope60.toFixed(5),
      '120MA 기울기': slope120.toFixed(5),
      '600MA 기울기': slope600.toFixed(5),
      '600MA 각도 (원시값)': angle600Raw,
      '600MA 각도 (도)': angle600.toFixed(2) + '°',
      '조건 1 (마지막 거래가 매수가 아님)': isNotLastBuy ? '✅' : '❌',
      '조건 2 (기울기 급변)': isSlopeChange ? '✅' : '❌',
      '조건 3 (60MA와 120MA가 모두 하강 기울기가 아님)': isNotBothDownward ? '✅' : '❌',
      '조건 4 (60MA가 120MA를 상방 관통)': isCrossAbove120 ? '✅' : '❌',
      '조건 5 (이격도 좁고 상승 기울기)': isNarrowDeviation ? '✅' : '❌',
      '조건 6 (완전 정배열)': isPerfectAlignment ? '✅' : '❌',
      '조건 7 (역배열 아님)': !isReverseAlignment ? '✅' : '❌',
      '조건 8 (600MA가 안정 상태)': isMa600Stable ? '✅' : '❌',
      '최종 판정': (isNotLastBuy && (isSlopeChange || (isNotBothDownward && (isCrossAbove120 || isNarrowDeviation || isPerfectAlignment))) && !isReverseAlignment && isMa600Stable) ? '✅ 매수 신호 발생!' : '❌ 매수 조건 불충족'
    });
    
    // 매수 가능 상태가 아닌 경우
    if (!canBuy) {
      console.log('\n=== ❌ 매수 불가 상태 ===');
      console.log('매수 가능 상태가 아닙니다. (waiting_buy 상태여야 함)');
      return null;
    }

    console.log('✅ 매수 가능 상태 확인');

    // 매수 시그널 생성
    if (isNotLastBuy && 
        (isSlopeChange || 
         (isNotBothDownward && (isCrossAbove120 || isNarrowDeviation || isPerfectAlignment))
        ) && 
        !isReverseAlignment && 
        isMa600Stable) {
      console.log('\n=== ✅ A15 매수 조건 충족! ===');
      console.log('상태 변경: waiting_buy → buy (매수 주문 실행)');
      return 'buy';  // 매수 신호 발생 → 매수 주문 실행 (buy)
    }

    return null;  // 매수 조건 불충족
  },
  
  // 청산 조건 분석
  analyzeExit(data: CandlestickData<Time>[], index: number, position: 'buy', entryPrice: number): boolean {
    // position이 'buy'가 아니면 매도 신호를 발생시키지 않음
    if (index < 360 || position !== 'buy') return false;
    
    // MA 계산
    const ma60 = data.slice(index - 60, index).reduce((a, b) => a + b.close, 0) / 60;
    const prevMa60 = data.slice(index - 61, index - 1).reduce((a, b) => a + b.close, 0) / 60;
    
    const ma120 = data.slice(index - 120, index).reduce((a, b) => a + b.close, 0) / 120;
    const ma240 = data.slice(index - 240, index).reduce((a, b) => a + b.close, 0) / 240;
    const ma360 = data.slice(index - 360, index).reduce((a, b) => a + b.close, 0) / 360;
    
    // 기울기 계산
    const slope60 = ma60 - prevMa60;
    
    const ma600 = data.slice(index - 600, index).reduce((a, b) => a + b.close, 0) / 600;
    const prevMa600 = data.slice(index - 601, index - 1).reduce((a, b) => a + b.close, 0) / 600;
    const slope600 = ma600 - prevMa600;

    // 기울기를 각도로 변환 (라디안 -> 도)
    const angle600Raw = Math.atan(slope600);
    const angle600 = angle600Raw * (180 / Math.PI);
    
    // 디버깅을 위한 추가 계산
    const percentChange600 = (slope600 / prevMa600) * 100;
    
    console.log('\n=== 매도 각도 계산 디버깅 ===');
    console.log('MA600:', ma600);
    console.log('이전 MA600:', prevMa600);
    console.log('MA600 변화량:', slope600);
    console.log('MA600 변화율(%):', percentChange600.toFixed(6) + '%');
    console.log('MA600 각도(라디안):', angle600Raw);
    console.log('MA600 각도(도):', angle600.toFixed(2) + '°');
    console.log('MA600 안정 상태 여부:', Math.abs(angle600) < 10 ? '✅ 안정적' : '❌ 불안정');

    // 매도 조건
    const isNarrowDeviation = Math.abs(ma60 - ma120) < 0.01 && ma60 < ma120 && slope60 < 0;
    const isPerfectReverseAlignment = ma60 < ma120 && ma120 < ma240 && ma60 < ma120;
    const isBelow600MA = ma60 < ma600;
    const isAbove360MA = data[index].close > ma360;
    const isMa600Stable = Math.abs(angle600) < 10;  // 10도 미만의 변화만 허용

    // 로그 출력
    console.log('\n=== A15 매도 신호 분석 ===');
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
      'MA60': ma60.toFixed(2),
      'MA120': ma120.toFixed(2),
      'MA240': ma240.toFixed(2),
      'MA600': ma600.toFixed(2),
      '60MA 기울기': slope60.toFixed(5),
      '600MA 기울기': slope600.toFixed(5),
      '600MA 각도': angle600.toFixed(2) + '°',
      '조건 1 (이격도 좁고 하락 기울기)': isNarrowDeviation ? '✅' : '❌',
      '조건 2 (완전 역배열)': isPerfectReverseAlignment ? '✅' : '❌',
      '조건 3 (360MA 위)': isAbove360MA ? '❌ 매도하지 않음' : '✅ 매도 가능',
      '조건 4 (600MA가 안정 상태)': isMa600Stable ? '✅' : '❌'
    });

    // 매도 시그널 생성 - 둘 중 하나라도 충족하면 매도
    const sellCondition = (isNarrowDeviation || isPerfectReverseAlignment || isBelow600MA) && !isAbove360MA && isMa600Stable;
    
    if (sellCondition) {
      console.log('\n=== 매도 조건 충족 여부 ===');
      console.log('상태 변경: waiting_sell → sell (매도 주문 실행)');
      console.log('✅ 매도 시그널 발생');
      return true;  // 매도 신호 발생 → 매도 주문 실행 (sell)
    }

    console.log('\n=== 매도 조건 충족 여부 ===');
    console.log('상태 유지: waiting_sell (매도 대기)');
    return false;  // 매도 대기 상태 유지 (waiting_sell)
  },
  
  // 지표 계산 함수
  calculateIndicators(data, index) {
    if (index < 120) {
      return {} as ExtendedMetadata;
    }
    
    // MA 계산
    const ma40 = data.slice(index - 40, index).reduce((a, b) => a + b.close, 0) / 40;
    const prevMa40 = data.slice(index - 41, index - 1).reduce((a, b) => a + b.close, 0) / 40;
    
    const ma60 = data.slice(index - 60, index).reduce((a, b) => a + b.close, 0) / 60;
    const prevMa60 = data.slice(index - 61, index - 1).reduce((a, b) => a + b.close, 0) / 60;
    
    const ma120 = data.slice(index - 120, index).reduce((a, b) => a + b.close, 0) / 120;
    
    // 기울기 계산
    const slope40 = ma40 - prevMa40;
    const slope60 = ma60 - prevMa60;
    
    // RSI 계산
    const prices = data.slice(0, index + 1).map(d => d.close);
    const rsiValue = calculateRSI(prices);
    
    const metadata: ExtendedMetadata = {
      ma40,
      ma60,
      ma120,
      slope40,
      slope60,
      rsi: rsiValue,
      isAbove120MA: data[index].close > ma120
    };
    
    return metadata;
  },
  
  // 분석 함수
  analyze(data, options?: AnalyzeOptions): AnalysisResult {
    const signals: TradeSignal[] = [];
    let currentPosition: 'buy' | null = options?.currentPosition || null;
    let lastTradeId: string | null = options?.lastTradeId || null;
    
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
    
    // MA120 계산을 위해 최소 120초의 데이터가 필요
    if (data.length < 120) {
      console.log('데이터가 충분하지 않습니다. 최소 120개의 캔들이 필요합니다. (2분)');
      console.log('현재 데이터 길이:', data.length, '초');
      return {
        signals,
        lastProcessedIndex: data.length - 1,
        currentPosition,
        lastTradeId
      };
    }
    
    console.log('\n=== A15 기울기 필터 전략 분석 시작 ===');
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
        if (options.lastProcessedIndex >= 120) {
        startIndex = options.lastProcessedIndex + 1;
          console.log(`실시간 모드: 신규 데이터만 분석 (인덱스 ${startIndex}부터 ${endIndex - 1}까지)`);
        } else {
          // 아직 초기화가 필요한 경우이지만, 분석은 계속 진행
          console.log('실시간 모드: 초기 데이터 수집 및 분석 중...');
          console.log(`현재: ${options.lastProcessedIndex}초 / 120초 (${((options.lastProcessedIndex/120)*100).toFixed(1)}%)`);
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
              strategy: 'SLOPE_FILTER' as TradeStrategy,
              reason: '120MA 아래에서 40MA와 60MA의 기울기가 양수',
              metadata: {
                ma40: data.slice(i - 40, i).reduce((a, b) => a + b.close, 0) / 40,
                ma60: data.slice(i - 60, i).reduce((a, b) => a + b.close, 0) / 60,
                ma120: data.slice(i - 120, i).reduce((a, b) => a + b.close, 0) / 120
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
              const ma40 = data.slice(i - 40, i).reduce((a, b) => a + b.close, 0) / 40;
              const prevMa40 = data.slice(i - 41, i - 1).reduce((a, b) => a + b.close, 0) / 40;
              const ma60 = data.slice(i - 60, i).reduce((a, b) => a + b.close, 0) / 60;
              const prevMa60 = data.slice(i - 61, i - 1).reduce((a, b) => a + b.close, 0) / 60;
              const ma120 = data.slice(i - 120, i).reduce((a, b) => a + b.close, 0) / 120;
              
              const slope40 = ma40 - prevMa40;
              const slope60 = ma60 - prevMa60;
              
              const isAbove120MA = ma40 > ma120 && ma60 > ma120;
              const isNegativeSlope = slope40 < -0.005 && slope60 < -0.005;
              
              // 매도 이유 결정
              let exitReason = '';
              const profitPercent = ((price / entryPrice) - 1) * 100;
              
              if (profitPercent <= -1.5) {
                exitReason = `손절: 수익률 ${profitPercent.toFixed(2)}%`;
              } else if (isAbove120MA && isNegativeSlope) {
                exitReason = '120MA 위에서 40MA와 60MA의 기울기가 음수';
              } else {
                exitReason = 'A15 매도 조건 충족';
              }
              
              // 트레이딩 신호 생성
              const signal: TradeSignal = {
                id,
                time,
              position: 'sell',
                price,
                strategy: 'SLOPE_FILTER' as TradeStrategy,
                relatedTradeId: lastTradeId,
                reason: exitReason,
                metadata: {
                  ma40,
                  ma60,
                  ma120,
                  slope40,
                  slope60
                }
              };
              
              signals.push(signal);
            currentPosition = null;
            lastTradeId = null;
              lastSignalIndex = i; // 마지막 신호 인덱스 업데이트
              
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
    
    console.log('\n=== A15 기울기 필터 전략 분석 완료 ===');
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
      const ma40 = data.slice(data.length - 40, data.length).reduce((a, b) => a + b.close, 0) / 40;
      const prevMa40 = data.slice(data.length - 41, data.length - 1).reduce((a, b) => a + b.close, 0) / 40;
      const ma60 = data.slice(data.length - 60, data.length).reduce((a, b) => a + b.close, 0) / 60;
      const prevMa60 = data.slice(data.length - 61, data.length - 1).reduce((a, b) => a + b.close, 0) / 60;
      const ma120 = data.slice(data.length - 120, data.length).reduce((a, b) => a + b.close, 0) / 120;
      
      // 기울기 계산
      const slope40 = ma40 - prevMa40;
      const slope60 = ma60 - prevMa60;
      
      // 매수 조건 체크
      const isBelow120MA = ma40 < ma120 && ma60 < ma120;
      const isPositiveSlope = slope40 > 0.005 && slope60 > 0.005;
      
      console.log(`MA40: ${ma40.toFixed(3)}`);
      console.log(`MA60: ${ma60.toFixed(3)}`);
      console.log(`MA120: ${ma120.toFixed(3)}`);
      console.log(`40MA 기울기: ${slope40.toFixed(5)}`);
      console.log(`60MA 기울기: ${slope60.toFixed(5)}`);
      
      // 매수 조건 확인 상태 표시
      console.log('\n=== 매수 조건 체크 ===');
      console.log(`조건 1 (120MA 아래): ${isBelow120MA ? '✅' : '❌'}`);
      console.log(`조건 2 (기울기 양수): ${isPositiveSlope ? '✅' : '❌'}`);
      console.log(`최종 판정: ${(isBelow120MA && isPositiveSlope) ? '✅ 매수 조건 충족!' : '❌ 매수 조건 불충족'}`);
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

export default slopeFilterStrategy; 