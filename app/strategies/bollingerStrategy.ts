import { CandlestickData, Time } from 'lightweight-charts';
import { BollingerStrategy, TradeSignal, ExtendedMetadata, AnalyzeOptions, AnalysisResult, TradeStrategy } from './types';
import { calculateStandardDeviation } from './utils';
import useUpbitStore from '../store/useUpbitStore';
import { useEffect } from 'react';

type TradeState = 'waiting_buy' | 'buying' | 'bought' | 'waiting_sell' | 'selling' | 'sold';

// 볼린저 밴드 전략
const bollingerStrategy: BollingerStrategy = {
  name: 'BOLLINGER',
  timeframe: '1m',
  description: '볼린저 밴드와 이동평균선 기반 전략',
  author: 'System',
  version: '2.0.0',
  tags: ['trend', 'moving-average', 'bollinger'],
  
  indicators: {
    maPeriods: { short: 60, medium: 120, long: 240 }
  },
  
  riskManagement: {
    stopLossPercent: 1.0,
    takeProfitPercent: 2.0,
    positionSizePercent: 50
  },
  
  // 진입 조건 분석
  analyzeEntry(data: CandlestickData<Time>[], index: number): 'buy' | 'nobuyfrequpdown' | null {
    const entryDateTime = new Date(data[index].time as number * 1000);
    console.log('\n=== 📊 analyzeEntry 함수 진입 ===');
    console.log('분석 시작 시간:', entryDateTime.toLocaleString('ko-KR'));
    console.log('캔들 인덱스:', index);

    // 횡보장 감지 여부 초기화
    let isChoppyMarket = false;

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
    const canBuy = store.tradeState.theoreticalPosition === 'wait';
    const isNotLastBuy = store.tradeState.lastTradeType !== 'bid';
    
    console.log('\n=== 현재 거래 상태 체크 ===');
    console.log('현재 상태:', store.tradeState);
    
    // 매도 후 1분(60초) 이내에는 매수하지 않음
    const currentTimeMs = data[index].time as number * 1000;
    const lastSellTime = store.lastSellTime || 0;
    const timeSinceLastSell = currentTimeMs - lastSellTime;
    const isCooldownActive = timeSinceLastSell < 10*60000; // 5분 = 300,000ms
    
    if (isCooldownActive) {
      const remainingCooldown = Math.ceil((10*60000 - timeSinceLastSell) / 1000);
      console.log('\n=== ❌ 매도 후 대기 시간 ===');
      console.log(`마지막 매도 후 ${(timeSinceLastSell / 1000).toFixed(0)}초 경과 (${remainingCooldown}초 남음)`);
      console.log(`다음 매수 가능 시간: ${new Date(lastSellTime + 10*60000).toLocaleString('ko-KR')}`);
      
      // 마지막 매도 시점부터 현재까지의 캔들 데이터
      const sellTimeIndex = data.findIndex(d => (d.time as number * 1000) >= lastSellTime);
      if (sellTimeIndex !== -1) {
        const candlesSinceSell = data.slice(sellTimeIndex, index + 1);
        
        // 횡보 판단 기준 1: 가격 변동 범위가 일정 비율 이내인지 확인
        const highPrice = Math.max(...candlesSinceSell.map(c => c.high));
        const lowPrice = Math.min(...candlesSinceSell.map(c => c.low));
        const priceRange = ((highPrice - lowPrice) / lowPrice) * 100; // 변동 범위 (%)
        
        // MA 계산
        const ma60 = data.slice(index - 60, index).reduce((a, b) => a + b.close, 0) / 60;
        const ma120 = data.slice(index - 120, index).reduce((a, b) => a + b.close, 0) / 120;
        const ma600 = data.slice(index - 600, index).reduce((a, b) => a + b.close, 0) / 600;
        const ma900 = data.slice(index - 900, index).reduce((a, b) => a + b.close, 0) / 900;
        // 횡보 판단 기준 2: MA 기울기 확인
        const prevMa60 = data.slice(index - 61, index - 1).reduce((a, b) => a + b.close, 0) / 60;
        const prevMa120 = data.slice(index - 121, index - 1).reduce((a, b) => a + b.close, 0) / 120;
        const prevMa600 = data.slice(index - 601, index - 1).reduce((a, b) => a + b.close, 0) / 600;
        const prevMa900 = data.slice(index - 901, index - 1).reduce((a, b) => a + b.close, 0) / 900;
        const ma60Slope = Math.abs((ma60 - prevMa60) / prevMa60 * 100);
        const ma120Slope = Math.abs((ma120 - prevMa120) / prevMa120 * 100);
        const ma600Slope = Math.abs((ma600 - prevMa600) / prevMa600 * 100);
        const ma900Slope = Math.abs((ma900 - prevMa900) / prevMa900 * 100);
        
        // 횡보 판단 기준 3: 가격이 MA60과 MA120 사이에서 오르내림을 반복하는지 확인
        const closeToMA60 = Math.abs(data[index].close - ma60) / ma60 < 0.1; // 30% 이내
        const closeToMA900 = Math.abs(data[index].close - ma900) / ma900 < 0.1; // 30% 이내
        
        // 횡보 판단 기준 4: MA600과 MA900이 서로 가까이 있는지 확인
        const ma600ma900Close = Math.abs(ma600 - ma900) / ma900 < 0.15; // 15% 이내
        
        //const isRangebound = priceRange < 1.0; // 변동 범위가 1% 미만
        const isFlatMA = ma600Slope < 10 && ma900Slope < 10; // MA 기울기가 10% 미만
        const isPriceStuck = closeToMA60 || closeToMA900; // 가격이 MA 근처에 갇힘
        
        const isChoppyMarket = (isFlatMA || isPriceStuck || ma600ma900Close);
        
        if (isChoppyMarket) {
          console.log('\n=== ⚠️ 횡보장 감지됨 (nobuyfrequpdown) ===');
          console.log(`가격 변동 범위: ${priceRange.toFixed(2)}% (기준: 1.0% 미만)`);
          console.log(`MA60 기울기: ${ma60Slope.toFixed(4)}% (기준: 0.2% 미만)`);
          console.log(`MA120 기울기: ${ma120Slope.toFixed(4)}% (기준: 0.2% 미만)`);
          console.log(`가격이 MA600 근처: ${closeToMA60 ? '예' : '아니오'}`);
          console.log(`가격이 MA900 근처: ${closeToMA900 ? '예' : '아니오'}`);
          console.log(`MA600과 MA900이 근접: ${ma600ma900Close ? '예' : '아니오'} (${(Math.abs(ma600 - ma900) / ma900 * 100).toFixed(3)}%)`);
          console.log(`최종 판정: 횡보장으로 매수 금지`);
          return 'nobuyfrequpdown';
        }
      }
      
      return null;
    }
    
    // 이전 MA 계산
    const prevMa120 = data.slice(index - 121, index - 1).reduce((a, b) => a + b.close, 0) / 120;
    const prevMa240 = data.slice(index - 241, index - 1).reduce((a, b) => a + b.close, 0) / 240;
    const prevMa360 = data.slice(index - 361, index - 1).reduce((a, b) => a + b.close, 0) / 360;
    const prevMa600 = data.slice(index - 601, index - 1).reduce((a, b) => a + b.close, 0) / 600;
    // MA 계산 - 매수 가능 상태와 관계없이 계산
    const ma60 = data.slice(index - 60, index).reduce((a, b) => a + b.close, 0) / 60;
    const ma120 = data.slice(index - 120, index).reduce((a, b) => a + b.close, 0) / 120;
    const ma240 = data.slice(index - 240, index).reduce((a, b) => a + b.close, 0) / 240;
    const ma360 = data.slice(index - 360, index).reduce((a, b) => a + b.close, 0) / 360;
    const ma600 = data.slice(index - 600, index).reduce((a, b) => a + b.close, 0) / 600;
    const ma900 = data.slice(index - 900, index).reduce((a, b) => a + b.close, 0) / 900;

    // 이전 MA600 계산 (MA600 상승세 확인용)
        // 600MA의 최근 6개 값을 계산 (현재 및 이전 5봉)
    const ma900_current = ma600; // data.slice(index - 600, index)로 계산한 현재 600MA
    const ma900_1 = data.slice(index - 901, index - 1).reduce((a, b) => a + b.close, 0) / 900;
    const ma900_2 = data.slice(index - 902, index - 2).reduce((a, b) => a + b.close, 0) / 900;
    const ma900_3 = data.slice(index - 903, index - 3).reduce((a, b) => a + b.close, 0) / 900;
    const ma900_4 = data.slice(index - 904, index - 4).reduce((a, b) => a + b.close, 0) / 900;
    const ma900_5 = data.slice(index - 905, index - 5).reduce((a, b) => a + b.close, 0) / 900;

    // 각 구간별 기울기 계산 (현재 값과 바로 이전 값의 차이)
    const slope0 = ma900_current - ma900_1;
    const slope1 = ma900_1 - ma900_2;
    const slope2 = ma900_2 - ma900_3;
    const slope3 = ma900_3 - ma900_4;
    const slope4 = ma900_4 - ma900_5;

    // 5봉 동안 모두 임계치(0.1763) 이상 상승해야 상승 추세로 판단
    const isMA900Rising = slope0 > 0.1763 && slope1 > 0.1763 && slope2 > 0.1763 && slope3 > 0.1763 && slope4 > 0.1763; 
    //const slope60 = ma60 - prevMa60;
    const slope120 = ma120 - prevMa120;
    const slope240 = ma240 - prevMa240;
    const slope360 = ma360 - prevMa360;
    const slope600 = ma600 - prevMa600;
    
    // MA 조건 검사
    const isAbove120 = ma60 > ma120;
    const isAbove240 = ma60 > ma240;
    const isAbove360 = ma60 > ma360;
    const isAbove600 = ma60 > ma600;
    const isBelow360 = ma60 < ma360;
    const isBelow600 = ma60 < ma600;
    const isBelow900 = ma60 < ma900;
    const isMA600Upward = ma600 > prevMa600;
    const isAllAboveConditions = isAbove120 && isAbove240 && isAbove360 && isAbove600;
 

    const isPositiveSlope120 = slope120 > 0.1763*1;
    const isPositiveSlope240 = slope240 > 0.1763*1;
    const isPositiveSlope360 = slope360 > 0.1763*1;

    const additionalConditions = isBelow600 && isMA900Rising;
    const isAllPositiveSlopeConditions = isPositiveSlope120 && isPositiveSlope240 && isPositiveSlope360;
    // 5번째 조건 사용 여부 체크
    const { useFifthCondition } = useUpbitStore.getState();
    const isNewBuyCondition = ( isAllPositiveSlopeConditions && isAllAboveConditions ) && additionalConditions;  //isPerfectAlignment || isReverseToPerfectAlignment
    
    // MA240 상향추세 체크 (5캔들 이상)
    let ma240UpCount = 0;
    for (let i = 1; i <= 5; i++) {
      if (index - i < 0 || index - i + 1 < 0) break;
      
      const prevMa240 = data.slice(index - i - 240, index - i).reduce((a, b) => a + b.close, 0) / 240;
      const currentMa240 = data.slice(index - i + 1 - 240, index - i + 1).reduce((a, b) => a + b.close, 0) / 240;
      
      if (currentMa240 > prevMa240) {
        ma240UpCount++;
      } else {
        break;
      }
    }

 
    
    // 매수 가능 상태가 아닌 경우
    if (!canBuy) {
      console.log('\n=== ❌ 매수 불가 상태 ===');
      console.log('매수 가능 상태가 아닙니다. (waiting_buy 상태여야 함)');
      return null;
    }

    console.log('✅ 매수 가능 상태 확인');
    if (isNotLastBuy && isAllPositiveSlopeConditions && isAllAboveConditions && (additionalConditions || !useFifthCondition) && !isChoppyMarket) {
    // 매수 시그널 생성 - 5번째 조건 적용 여부에 따라 판단
   // if (ma240UpCount >= 1 && isAbove120 && isAbove240 && isMA600Upward && (isBelow360 || !useFifthCondition)) {
      console.log('\n=== ✅ 매수 조건 충족! ===');
      if (!useFifthCondition && !additionalConditions) {
        console.log('5번째 조건(MA60 < MA360)이 비활성화되어 있어 통과하였습니다.');
      }
      console.log('상태 변경: waiting_buy → buy (매수 주문 실행)');
      return 'buy';  // 매수 신호 발생 → 매수 주문 실행 (buy)
    }

    return null;  // 매수 조건 불충족
  },
  
  // 청산 조건 분석
  analyzeExit(data: CandlestickData<Time>[], index: number, position: 'buy', entryPrice: number): boolean {
    // position이 'buy'가 아니면 매도 신호를 발생시키지 않음
    if (index < 360 || position !== 'buy') return false;

    let ma600UpCount = 0; 
    
    // MA 계산
    const ma60 = data.slice(index - 60, index).reduce((a, b) => a + b.close, 0) / 60;
    const ma120 = data.slice(index - 120, index).reduce((a, b) => a + b.close, 0) / 120;
    const ma240 = data.slice(index - 240, index).reduce((a, b) => a + b.close, 0) / 240;
    const ma360 = data.slice(index - 360, index).reduce((a, b) => a + b.close, 0) / 360;
    const ma600 = data.slice(index - 600, index).reduce((a, b) => a + b.close, 0) / 600;
    
    // 이전 MA 계산
    const prevMa60 = data.slice(index - 61, index - 1).reduce((a, b) => a + b.close, 0) / 60;
    const prevMa120 = data.slice(index - 121, index - 1).reduce((a, b) => a + b.close, 0) / 120;
    const prevMa240 = data.slice(index - 241, index - 1).reduce((a, b) => a + b.close, 0) / 240;
    const prevMa600 = data.slice(index - 601, index - 1).reduce((a, b) => a + b.close, 0) / 600;

    // MA 기울기 계산
    const ma60Slope = ((ma60 - prevMa60) / prevMa60) * 100;
    const ma120Slope = ((ma120 - prevMa120) / prevMa120) * 100;
    const ma240Slope = ((ma240 - prevMa240) / prevMa240) * 100;
    const ma600Slope = ((ma600 - prevMa600) / prevMa600) * 100;

    // MA 기울기 하향 조건 (10봉 연속 하향인 경우)
    let ma120DownCount = 0;
    let ma240DownCount = 0;
    let ma60Below120Count = 0;
    let ma60Below240Count = 0;
    let ma600DownCount = 0;

    for (let i = 0; i < 10; i++) {
      const currentMa120 = data.slice(index - i - 120, index - i).reduce((a, b) => a + b.close, 0) / 120;
      const prevMa120Check = data.slice(index - i - 121, index - i - 1).reduce((a, b) => a + b.close, 0) / 120;
      const currentMa240 = data.slice(index - i - 240, index - i).reduce((a, b) => a + b.close, 0) / 240;
      const prevMa240Check = data.slice(index - i - 241, index - i - 1).reduce((a, b) => a + b.close, 0) / 240;
      const currentMa60 = data.slice(index - i - 60, index - i).reduce((a, b) => a + b.close, 0) / 60;
      const prevMa60Check = data.slice(index - i - 61, index - i - 1).reduce((a, b) => a + b.close, 0) / 60;
      const currentMa600 = data.slice(index - i - 600, index - i).reduce((a, b) => a + b.close, 0) / 600;
      const prevMa600Check = data.slice(index - i - 601, index - i - 1).reduce((a, b) => a + b.close, 0) / 600;

      if (currentMa120 < prevMa120Check) ma120DownCount++;
      if (currentMa240 < prevMa240Check) ma240DownCount++;
      if (currentMa60 < currentMa120) ma60Below120Count++;
      if (currentMa60 < currentMa240) ma60Below240Count++;
      if (currentMa600 < prevMa600Check) ma600DownCount++;
      if (currentMa600 > prevMa600Check) ma600UpCount++; 
    }

     // 이전 MA600 계산 (MA600 상승세 확인용)
    // 600MA의 최근 6개 값을 계산 (현재 및 이전 5봉)
const ma900_current = ma600; // data.slice(index - 600, index)로 계산한 현재 600MA
const ma900_1 = data.slice(index - 601, index - 1).reduce((a, b) => a + b.close, 0) / 900;
const ma900_2 = data.slice(index - 602, index - 2).reduce((a, b) => a + b.close, 0) / 900;
const ma900_3 = data.slice(index - 603, index - 3).reduce((a, b) => a + b.close, 0) / 900;
const ma900_4 = data.slice(index - 604, index - 4).reduce((a, b) => a + b.close, 0) / 900;
const ma900_5 = data.slice(index - 605, index - 5).reduce((a, b) => a + b.close, 0) / 900;
const ma900_6 = data.slice(index - 606, index - 6).reduce((a, b) => a + b.close, 0) / 900;
const ma900_7 = data.slice(index - 607, index - 7).reduce((a, b) => a + b.close, 0) / 900;
const ma900_8 = data.slice(index - 608, index - 8).reduce((a, b) => a + b.close, 0) / 900;
const ma900_9 = data.slice(index - 609, index - 9).reduce((a, b) => a + b.close, 0) / 900;


// 각 구간별 기울기 계산 (현재 값과 바로 이전 값의 차이)
const slope0 = ma900_current - ma900_1;
const slope1 = ma900_1 - ma900_2;
const slope2 = ma900_2 - ma900_3;
const slope3 = ma900_3 - ma900_4;
const slope4 = ma900_4 - ma900_5;
const slope5 = ma900_5 - ma900_6; 
const slope6 = ma900_6 - ma900_7;
const slope7 = ma900_7 - ma900_8;
const slope8 = ma900_8 - ma900_9; 
// 5봉 동안 모두 임계치(0.1763) 이상 상승해야 상승 추세로 판단
//const isMA900Rising = slope0 > 0 && slope1 > 0 && slope2 >0 && slope3 > 0 && slope4 > 0 && slope5 > 0 && slope6 > 0 && slope7 > 0 && slope8 > 0; 
const isMA900Rising = slope0 > 0.1763 && slope1 > 0.1763 && slope2 > 0.1763 && slope3 > 0.1763 && slope4 > 0.1763; 

    // 60MA가 120MA와 240MA보다 아래에 있는지 확인
    const isBelow120 = ma60 < ma120;
    const isBelow240 = ma60 < ma240;
    const isBelow360 = ma60 < ma360;
    const isBelow600 = ma60 < ma600;

    // MA600이 하락 추세인지 확인 (현재 MA600 < 이전 MA600)
    const isMA600Falling = ma600 < prevMa600;

    // 현재 가격과 매수 가격의 차이 계산 (수익률)
    const currentPrice = data[index].close;
    const profitPercent = ((currentPrice / entryPrice) - 1) * 100;
    const additionalConditions =  isMA900Rising ;//&&isBelow900;//&& isBelow600 ;&&isBelow900
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
 
 

    // 매도 시그널 생성 - 기본 조건 (README 기준으로 수정)
    if (isBelow600 &&  !isMA900Rising) {
      console.log('\n=== 매도 조건 충족 여부 ===');
      console.log('상태 변경: waiting_sell → sell (매도 주문 실행)');
      console.log({
        '체크 시간': new Date().toLocaleString('ko-KR', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false
        }),
        'MA60이 MA600 아래': isBelow600 ? '✅' : '❌',
        'MA60 값': ma60.toFixed(2),
        'MA600 값': ma600.toFixed(2),
        '최종 판정': '✅ 매도 신호 발생!'
      });
      return true;  // 매도 신호 발생 → 매도 주문 실행 (sell)
    }

    console.log('\n=== 매도 조건 충족 여부 ===');
    console.log('상태 유지: waiting_sell (매도 대기)');
    return false;  // 매도 대기 상태 유지 (waiting_sell)
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
    const ma360 = data.slice(index - 360, index).reduce((a, b) => a + b.close, 0) / 360;
    const ma600 = data.slice(index - 600, index).reduce((a, b) => a + b.close, 0) / 600;
    
    // 이전 MA600 계산 (MA600 상승세 확인용)
    const prevMa600 = data.slice(index - 601, index - 1).reduce((a, b) => a + b.close, 0) / 600;
    
    // MA240 상향추세 체크 (5캔들 이상)
    let ma240UpCount = 0;
    for (let i = 1; i <= 5; i++) {
      if (index - i < 0 || index - i + 1 < 0) break;
      
      const prevMa240 = data.slice(index - i - 240, index - i).reduce((a, b) => a + b.close, 0) / 240;
      const currentMa240 = data.slice(index - i + 1 - 240, index - i + 1).reduce((a, b) => a + b.close, 0) / 240;
      
      if (currentMa240 > prevMa240) {
        ma240UpCount++;
      } else {
        break;
      }
    }
    
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
      ma360,
      ma600,
      upperBand,
      lowerBand,
      deviation,
      isAbove600MA: data[index].close > ma600,
      ma240UpCount,
      isMA600Upward: ma600 > prevMa600
    };
    
    console.log(`MA60: ${ma60.toFixed(3)}`);
    console.log(`MA120: ${ma120.toFixed(3)}`);
    console.log(`MA240: ${ma240.toFixed(3)}`);
    console.log(`MA360: ${ma360.toFixed(3)}`);
    console.log(`MA600: ${ma600.toFixed(3)}`);
      
    // 매수 조건 확인 상태 표시
    const isAbove120 = ma60 > ma120;
    const isAbove240 = ma60 > ma240;
    const isBelow360 = ma60 < ma360;
    const isMA600Upward = ma600 > prevMa600;
      
    console.log('\n=== 매수 조건 체크 ===');
    console.log(`조건 1 (MA240 상향 5봉 이상): ${ma240UpCount >= 1 ? '✅' : '❌'} (${ma240UpCount}/5)`);
    console.log(`조건 2 (MA60 > MA120): ${isAbove120 ? '✅' : '❌'}`);
    console.log(`조건 3 (MA60 > MA240): ${isAbove240 ? '✅' : '❌'}`);
    console.log(`조건 4 (MA600 상승세): ${isMA600Upward ? '✅' : '❌'}`);
    console.log(`조건 5 (MA60 < MA360): ${isBelow360 ? '✅' : '❌'}`);
    console.log(`최종 판정: ${(ma240UpCount >= 1 && isAbove120 && isAbove240 && isMA600Upward && isBelow360) ? '✅ 매수 조건 충족!' : '❌ 매수 조건 불충족'}`);
    
    return metadata;
  },
  
  // 기존 분석 함수는 새로운 함수들을 활용
  analyze(data, options?: AnalyzeOptions): AnalysisResult {
    const signals: TradeSignal[] = [];
    let currentPosition: 'buy' | null = options?.currentPosition || null;
    let lastTradeId: string | null = options?.lastTradeId || null;
    
    // 마지막 신호 발생 시간 및 인덱스 추적
    let lastSignalIndex = options?.lastProcessedIndex ? options.lastProcessedIndex - 30 : 0; // 초기값 설정
    let lastSellTime = options?.metadata?.lastSellTime || 0; // 마지막 매도 시간 추적
    const minSignalInterval = 30; // 최소 30캔들(30초) 간격
    
    // 실시간 모드에서 이전 상태 유지
    if (options?.realtime && options?.lastProcessedIndex !== undefined) {
      // 이전 상태 로깅
      console.log('\n=== 이전 상태 확인 ===');
      console.log('이전 처리 인덱스:', options.lastProcessedIndex);
      console.log('이전 포지션:', options.currentPosition || '없음');
      console.log('이전 거래 ID:', options.lastTradeId || '없음');
      console.log('마지막 매도 시간:', options.metadata?.lastSellTime ? new Date(options.metadata.lastSellTime).toLocaleString('ko-KR') : '없음');
      
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
    
    // MA600 계산을 위해 최소 600초의 데이터가 필요
    if (data.length < 600) {
      console.log('데이터가 충분하지 않습니다. 최소 600개의 캔들이 필요합니다. (10분)');
      console.log('현재 데이터 길이:', data.length, '초');
      return {
        signals,
        lastProcessedIndex: data.length - 1,
        currentPosition,
        lastTradeId,
        metadata: {
          ...options?.metadata,
          lastSellTime // 마지막 매도 시간 저장
        }
      };
    }
    
    console.log('\n=== 볼린저 전략 분석 시작 ===');
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
        if (options.lastProcessedIndex >= 600) {
          startIndex = options.lastProcessedIndex + 1; // 이전에 처리한 다음 캔들부터 분석
          console.log(`실시간 모드: 신규 데이터만 분석 (인덱스 ${startIndex}부터 ${endIndex - 1}까지)`);
        } else {
          // 아직 초기화가 필요한 경우이지만, 분석은 계속 진행
          console.log('실시간 모드: 초기 데이터 수집 및 분석 중...');
          console.log(`현재: ${options.lastProcessedIndex}초 / 600초 (${((options.lastProcessedIndex/600)*100).toFixed(1)}%)`);
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
              strategy: 'BOLLINGER' as TradeStrategy,
              reason: '매수 조건 충족',
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
          } 
          // 횡보장 감지 신호 발생
          else if (entryResult === 'nobuyfrequpdown') {
            const time = data[i].time as number;
            console.log(`\n횡보장 감지: ${new Date(time * 1000).toLocaleString('ko-KR')}`);
            console.log('매수 신호가 억제되었습니다. (nobuyfrequpdown)');
          }
          else {
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
              
              // 트레이딩 신호 생성
              const signal: TradeSignal = {
                id,
                time,
                position: 'sell',
                price,
                strategy: 'BOLLINGER' as TradeStrategy,
                relatedTradeId: lastTradeId,
                metadata: {
                  ma60: data.slice(i - 60, i).reduce((a, b) => a + b.close, 0) / 60,
                }
              };
              
              signals.push(signal);
              currentPosition = null;
              lastTradeId = null;
              lastSignalIndex = i; // 마지막 신호 인덱스 업데이트
              lastSellTime = time * 1000; // 마지막 매도 시간 저장 (밀리초 단위)
              
              // 마지막 매도 시간을 store에도 저장
              useUpbitStore.setState({ lastSellTime: time * 1000 });
              
              console.log(`\n매도 신호 생성: ${new Date(time * 1000).toLocaleString('ko-KR')}`);
              console.log(`가격: ${price}`);
              console.log(`수익률: ${((price - entryPrice) / entryPrice * 100).toFixed(2)}%`);
              console.log(`ID: ${id}`);
              console.log(`다음 매수 가능 시간: ${new Date(lastSellTime + 10*60000).toLocaleString('ko-KR')} (10분 후)`);
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
    
    console.log('\n=== 볼린저 전략 분석 완료 ===');
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
      const ma360 = data.slice(data.length - 360, data.length).reduce((a, b) => a + b.close, 0) / 360;
      const ma600 = data.slice(data.length - 600, data.length).reduce((a, b) => a + b.close, 0) / 600;
      
      // 이전 MA600 계산 (MA600 상승세 확인용)
      const prevMa600 = data.slice(data.length - 601, data.length - 1).reduce((a, b) => a + b.close, 0) / 600;
      
      // MA240 상향추세 체크 (5캔들 이상)
      let ma240UpCount = 0;
      for (let i = 1; i <= 5; i++) {
        const idx = data.length - i;
        if (idx < 240 || idx + 1 < 240) break;
        
        const prevMa240 = data.slice(idx - 240, idx).reduce((a, b) => a + b.close, 0) / 240;
        const currentMa240 = data.slice(idx + 1 - 240, idx + 1).reduce((a, b) => a + b.close, 0) / 240;
        
        if (currentMa240 > prevMa240) {
          ma240UpCount++;
        } else {
          break;
        }
      }
      
      console.log(`MA60: ${ma60.toFixed(3)}`);
      console.log(`MA120: ${ma120.toFixed(3)}`);
      console.log(`MA240: ${ma240.toFixed(3)}`);
      console.log(`MA360: ${ma360.toFixed(3)}`);
      console.log(`MA600: ${ma600.toFixed(3)}`);
      
      // 매수 조건 확인 상태 표시
      const isAbove120 = ma60 > ma120;
      const isAbove240 = ma60 > ma240;
      const isBelow360 = ma60 < ma360;
      const isMA600Upward = ma600 > prevMa600;
      
      console.log('\n=== 매수 조건 체크 ===');
      console.log(`조건 1 (MA240 상향 5봉 이상): ${ma240UpCount >= 1 ? '✅' : '❌'} (${ma240UpCount}/5)`);
      console.log(`조건 2 (MA60 > MA120): ${isAbove120 ? '✅' : '❌'}`);
      console.log(`조건 3 (MA60 > MA240): ${isAbove240 ? '✅' : '❌'}`);
      console.log(`조건 4 (MA600 상승세): ${isMA600Upward ? '✅' : '❌'}`);
      console.log(`조건 5 (MA60 < MA360): ${isBelow360 ? '✅' : '❌'}`);
      console.log(`최종 판정: ${(ma240UpCount >= 1 && isAbove120 && isAbove240 && isMA600Upward && isBelow360) ? '✅ 매수 조건 충족!' : '❌ 매수 조건 불충족'}`);
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
      lastTradeId,
      metadata: {
        ...options?.metadata,
        lastSellTime // 마지막 매도 시간 저장
      }
    };
  }
};

export default bollingerStrategy;