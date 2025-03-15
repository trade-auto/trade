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

    const ma360 = data.slice(index - 360, index).reduce((a, b) => a + b.close, 0) / 360;
    const prevMa360 = data.slice(index - 361, index - 1).reduce((a, b) => a + b.close, 0) / 360;

    // MA600 계산 추가
    const ma600 = data.slice(index - 600, index).reduce((a, b) => a + b.close, 0) / 600;
    const prevMa600 = data.slice(index - 601, index - 1).reduce((a, b) => a + b.close, 0) / 600;
    const slope600 = ma600 - prevMa600;
    
    // MA900 계산 추가
    const ma900 = data.slice(index - 900, index).reduce((a, b) => a + b.close, 0) / 900;
    const prevMa900 = data.slice(index - 901, index - 1).reduce((a, b) => a + b.close, 0) / 900;
    const slope900 = ma900 - prevMa900;
    
    // 기울기를 각도로 변환 (라디안 -> 도)
    // 1초당 변화량을 각도로 변환 (아크탄젠트 사용)
    // 분모를 1로 설정하면 1초당 변화량을 기준으로 각도 계산
    const angle600Raw = Math.atan(slope600);
    const angle600 = angle600Raw * (180 / Math.PI);
    
    // MA900 각도 계산
    const angle900Raw = Math.atan(slope900);
    const angle900 = angle900Raw * (180 / Math.PI);
    
    // 디버깅을 위한 추가 계산
    const percentChange600 = (slope600 / prevMa600) * 100;
    const percentChange900 = (slope900 / prevMa900) * 100;
    
    console.log('\n=== 각도 계산 디버깅 ===');
    console.log('MA600:', ma600);
    console.log('이전 MA600:', prevMa600);
    console.log('MA600 변화량:', slope600);
    console.log('MA600 변화율(%):', percentChange600.toFixed(6) + '%');
    console.log('MA600 각도(라디안):', angle600Raw);
    console.log('MA600 각도(도):', angle600.toFixed(2) + '°');
    console.log('MA600 각도 방향:', angle600 > 0 ? '✅ 상승' : '❌ 하강');
    console.log('MA600 안정 상태 여부:', Math.abs(angle600) < 10 ? '✅ 안정적' : '❌ 불안정');
    
    console.log('MA900:', ma900);
    console.log('이전 MA900:', prevMa900);
    console.log('MA900 변화량:', slope900);
    console.log('MA900 변화율(%):', percentChange900.toFixed(6) + '%');
    console.log('MA900 각도(라디안):', angle900Raw);
    console.log('MA900 각도(도):', angle900.toFixed(2) + '°');
    console.log('MA900 각도 방향:', angle900 > 0 ? '✅ 상승' : '❌ 하강');
    console.log('MA900 안정 상태 여부:', Math.abs(angle900) < 10 ? '✅ 안정적' : '❌ 불안정');

    // 기울기 계산
    const slope60 = ma60 - prevMa60;
    const slope120 = ma120 - prevMa120;
    const slope240 = ma240 - prevMa240;
    const slope360 = ma360 - prevMa360;
    
    // 매수 조건
    const isNotLastBuy = store.tradeState.lastTradeType !== 'bid';
    
    // 상방 관통 조건
    const isCrossAbove120 = prevMa60 <= prevMa120 && ma60 > ma120;
    const isCrossAbove240 = prevMa60 <= prevMa240 && ma60 > ma240;
    const isCrossAbove360 = prevMa60 <= prevMa360 && ma60 > ma360;
    
    // MA60이 다른 MA보다 위에 있는 조건 추가
    const isAbove120 = ma60 > ma120;
    const isAbove240 = ma60 > ma240;
    const isAbove360 = ma60 > ma360;
    
    // MA60이 MA600 아래에 있는 조건 추가
    const isBelow600 = ma60 < ma600;
    
    // MA들이 서로 가까이 있는 조건 추가
    const maxDeviation = 0.005; // 0.5% 이내의 편차를 가까운 것으로 간주
    const isMA120And240Close = Math.abs(ma120 - ma240) / ma120 < maxDeviation;
    const isMA120And360Close = Math.abs(ma120 - ma360) / ma120 < maxDeviation;
    const isMA240And360Close = Math.abs(ma240 - ma360) / ma240 < maxDeviation;
    const isAllMAClose = isMA120And240Close && isMA120And360Close && isMA240And360Close;
    
    // 양의 기울기 조건
    const isPositiveSlope120 = slope120 > 0;
    const isPositiveSlope240 = slope240 > 0;
    const isPositiveSlope360 = slope360 > 0;
    
    // 정배열 조건
    const isPerfectAlignment = ma60 > ma120 && ma120 > ma240;
    
    // 새로운 매수 조건 조합
    // 관통 조건 또는 이미 위에 있는 조건
    const isAllAboveConditions = isAbove120 && isAbove240 && isAbove360;
    const isAllPositiveSlopeConditions = isPositiveSlope120 && isPositiveSlope240 && isPositiveSlope360;
    
    // MA900 기울기가 양수인 조건 추가
    const isMA900Rising = slope900 > 0;
    
    // MA600 기울기가 양수인 조건 추가
    const isMA600Rising = slope600 > 0;
    
    // 디버깅을 위한 로그 추가
    console.log('\n=== MA900 기울기 디버깅 ===');
    console.log('MA900 기울기 값:', slope900);
    console.log('MA900 기울기 양수 여부:', isMA900Rising ? '✅ 양수' : '❌ 음수');
    console.log('MA900 기울기 정확한 값:', slope900.toFixed(10));
    
    console.log('\n=== MA600 기울기 디버깅 ===');
    console.log('MA600 기울기 값:', slope600);
    console.log('MA600 기울기 양수 여부:', isMA600Rising ? '✅ 양수' : '❌ 음수');
    console.log('MA600 기울기 정확한 값:', slope600.toFixed(10));
    
    // MA가 가까이 있는 조건 추가
    const conditionA = isPerfectAlignment && isAllPositiveSlopeConditions && isAllAboveConditions;
    const conditionB = isAllMAClose && isAllPositiveSlopeConditions && isAbove120;
    const additionalConditions = isBelow600 && isMA600Rising;
    
    const isNewBuyCondition = (conditionA || conditionB) && additionalConditions;
    
    // 디버깅을 위한 로그 추가
    console.log('\n=== 매수 조건 디버깅 ===');
    console.log('조건 A (정배열 조건):', conditionA ? '✅ 충족' : '❌ 불충족');
    console.log('조건 B (MA 수렴 조건):', conditionB ? '✅ 충족' : '❌ 불충족');
    console.log('추가 조건 (MA600 아래 & MA600 상승):', additionalConditions ? '✅ 충족' : '❌ 불충족');
    console.log('최종 매수 조건:', isNewBuyCondition ? '✅ 충족' : '❌ 불충족');
    
    // 로그 출력
    console.log('\n=== A15 매수 조건 검사 ===');
    console.log({
      'MA60': ma60.toFixed(2),
      'MA120': ma120.toFixed(2),
      'MA240': ma240.toFixed(2),
      'MA360': ma360.toFixed(2),
      'MA600': ma600.toFixed(2),
      'MA900': ma900.toFixed(2),
      '60MA 기울기': slope60.toFixed(5),
      '120MA 기울기': slope120.toFixed(5),
      '240MA 기울기': slope240.toFixed(5),
      '360MA 기울기': slope360.toFixed(5),
      '600MA 기울기': slope600.toFixed(5),
      '900MA 기울기': slope900.toFixed(5),
      '600MA 각도 (원시값)': angle600Raw,
      '600MA 각도 (도)': angle600.toFixed(2) + '°',
      '600MA 각도 방향': angle600 > 0 ? '✅ 상승' : '❌ 하강',
      '900MA 각도 (원시값)': angle900Raw,
      '900MA 각도 (도)': angle900.toFixed(2) + '°',
      '900MA 각도 방향': angle900 > 0 ? '✅ 상승' : '❌ 하강',
      '조건 1 (마지막 거래가 매수가 아님)': isNotLastBuy ? '✅' : '❌',
      '조건 2-1 (MA60이 MA120 위)': isAbove120 ? '✅' : '❌',
      '조건 2-2 (MA60이 MA240 위)': isAbove240 ? '✅' : '❌',
      '조건 2-3 (MA60이 MA360 위)': isAbove360 ? '✅' : '❌',
      '조건 2-4 (MA120 양의 기울기)': isPositiveSlope120 ? '✅' : '❌',
      '조건 2-5 (MA240 양의 기울기)': isPositiveSlope240 ? '✅' : '❌',
      '조건 2-6 (MA360 양의 기울기)': isPositiveSlope360 ? '✅' : '❌',
      '조건 2-7 (완전 정배열)': isPerfectAlignment ? '✅' : '❌',
      '조건 3-1 (MA120과 MA240이 가까움)': isMA120And240Close ? '✅' : '❌',
      '조건 3-2 (MA120과 MA360이 가까움)': isMA120And360Close ? '✅' : '❌',
      '조건 3-3 (MA240과 MA360이 가까움)': isMA240And360Close ? '✅' : '❌',
      '조건 3-4 (모든 MA가 가까움)': isAllMAClose ? '✅' : '❌',
      '조건 4 (MA60이 MA600 아래)': isBelow600 ? '✅' : '❌',
      '조건 5 (MA600 기울기 상승)': isMA600Rising ? '✅' : '❌',
      '최종 판정': (isNotLastBuy && isNewBuyCondition) ? '✅ 매수 신호 발생!' : '❌ 매수 조건 불충족'
    });
    
    // 매수 가능 상태가 아닌 경우
    if (!canBuy) {
      console.log('\n=== ❌ 매수 불가 상태 ===');
      console.log('매수 가능 상태가 아닙니다. (waiting_buy 상태여야 함)');
      return null;
    }

    console.log('✅ 매수 가능 상태 확인');

    // 매수 시그널 생성
    if (isNotLastBuy && isNewBuyCondition) {
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
    const prevMa120 = data.slice(index - 121, index - 1).reduce((a, b) => a + b.close, 0) / 120;
    
    const ma240 = data.slice(index - 240, index).reduce((a, b) => a + b.close, 0) / 240;
    const prevMa240 = data.slice(index - 241, index - 1).reduce((a, b) => a + b.close, 0) / 240;
    
    const ma360 = data.slice(index - 360, index).reduce((a, b) => a + b.close, 0) / 360;
    const prevMa360 = data.slice(index - 361, index - 1).reduce((a, b) => a + b.close, 0) / 360;
    
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
    
    // 하방 관통 조건을 단순 비교로 변경
    const isBelow120 = ma60 < ma120;
    const isBelow240 = ma60 < ma240;
    const isBelow360 = ma60 < ma360;
    const isBelow600 = ma60 < ma600;
    
    // 역배열 조건
    const isPerfectReverseAlignment = ma60 < ma120 && ma120 < ma240;
    
    // 정배열 조건
    const isPerfectAlignment = ma60 > ma120 && ma120 > ma240;
    
    // 정배열이면서 하방 관통 조건
    const isPerfectAlignmentWithCrossBelow = isPerfectAlignment && isBelow120 && isBelow240 && isBelow360 && isBelow600;
    
    // MA600 하락 조건
    const isMa600Declining = angle600 < 0;  // MA600이 하락할 때만 매도
    
    console.log('\n=== 매도 각도 계산 디버깅 ===');
    console.log('MA600:', ma600);
    console.log('이전 MA600:', prevMa600);
    console.log('MA600 변화량:', slope600);
    console.log('MA600 변화율(%):', percentChange600.toFixed(6) + '%');
    console.log('MA600 각도(라디안):', angle600Raw);
    console.log('MA600 각도(도):', angle600.toFixed(2) + '°');
    console.log('MA600 각도 방향:', angle600 > 0 ? '✅ 상승' : '❌ 하강');
    console.log('MA600 안정 상태 여부:', Math.abs(angle600) < 10 ? '✅ 안정적' : '❌ 불안정');

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
      'MA360': ma360.toFixed(2),
      'MA600': ma600.toFixed(2),
      '60MA 기울기': slope60.toFixed(5),
      '600MA 기울기': slope600.toFixed(5),
      '600MA 각도': angle600.toFixed(2) + '°',
      '조건 1-1 (완전 역배열)': isPerfectReverseAlignment ? '✅' : '❌',
      '조건 1-2 (정배열이면서 하방 관통)': isPerfectAlignmentWithCrossBelow ? '✅' : '❌',
      '조건 1-2-1 (MA60이 MA120 아래에 위치)': isBelow120 ? '✅' : '❌',
      '조건 1-2-2 (MA60이 MA240 아래에 위치)': isBelow240 ? '✅' : '❌',
      '조건 1-2-3 (MA60이 MA360 아래에 위치)': isBelow360 ? '✅' : '❌',
      '조건 1-2-4 (MA60이 MA600 아래에 위치)': isBelow600 ? '✅' : '❌',
      '조건 2 (MA600 하락 중)': isMa600Declining ? '✅' : '❌'
    });

    // 매도 시그널 생성
    const sellCondition = (isPerfectReverseAlignment || isPerfectAlignmentWithCrossBelow) || isMa600Declining;
    
    // 매도 조건 상세 로그 추가
    console.log('\n=== 매도 조건 상세 분석 ===');
    console.log('완전 역배열 조건:', isPerfectReverseAlignment ? '✅ 충족' : '❌ 불충족');
    console.log('정배열이면서 하방 관통 조건:', isPerfectAlignmentWithCrossBelow ? '✅ 충족' : '❌ 불충족');
    console.log('MA600 하락 조건:', isMa600Declining ? '✅ 충족' : '❌ 불충족');
    
    if (isPerfectAlignmentWithCrossBelow) {
      console.log('\n정배열이면서 하방 관통 조건 상세:');
      console.log('- 정배열 (MA60 > MA120 > MA240):', isPerfectAlignment ? '✅' : '❌');
      console.log('- MA60이 MA120 아래에 위치:', isBelow120 ? '✅' : '❌');
      console.log('- MA60이 MA240 아래에 위치:', isBelow240 ? '✅' : '❌');
      console.log('- MA60이 MA360 아래에 위치:', isBelow360 ? '✅' : '❌');
      console.log('- MA60이 MA600 아래에 위치:', isBelow600 ? '✅' : '❌');
    }
    
    if (sellCondition) {
      console.log('\n=== 매도 조건 충족 여부 ===');
      console.log('상태 변경: waiting_sell → sell (매도 주문 실행)');
      console.log('✅ 매도 시그널 발생');
      console.log('매도 이유:', 
        isPerfectReverseAlignment ? '완전 역배열' : 
        isPerfectAlignmentWithCrossBelow ? '정배열이면서 하방 관통' : 
        isMa600Declining ? 'MA600 하락 중' : '알 수 없음');
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
              
              if (isAbove120MA && isNegativeSlope) {
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