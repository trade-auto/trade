import { CandlestickData, Time } from 'lightweight-charts';
import { BollingerStrategy, TradeSignal, ExtendedMetadata, AnalyzeOptions, AnalysisResult, TradeStrategy } from './types';
import { calculateStandardDeviation } from './utils';
import useUpbitStore from '../store/useUpbitStore';
import { useEffect } from 'react';
import axios from 'axios';
import { getCachedVolumeData, getTradeVolume, hasBuySignal, hasSellSignal } from './volumeUtils';

// ExtendedMetadata 타입 확장
declare module './types' {
  interface ExtendedMetadata {
    buyVolume?: number;
    sellVolume?: number;
    buySellRatio?: number;
  }
}

type TradeState = 'waiting_buy' | 'buying' | 'bought' | 'waiting_sell' | 'selling' | 'sold';

function isShortTermDowntrend(data: CandlestickData<Time>[], index: number): boolean {
  if (index < 910) return false; // 최소 910봉 필요 (MA900 포함)

  let downCount = 0;
  let totalAngle = 0;

  function calculateAngle(curr: number, prev: number, period: number): number {
    return Math.atan((curr - prev) / period) * (180 / Math.PI);
  }

  // 🔍 **최근 10봉의 각도 계산 (기울기가 -2° 이하인지 확인)**
  for (let i = index - 10 + 1; i <= index; i++) {
    const currMa600 = data.slice(i - 600, i).reduce((sum, c) => sum + c.close, 0) / 600;
    const prevMa600 = data.slice(i - 601, i - 1).reduce((sum, c) => sum + c.close, 0) / 600;
    const currMa900 = data.slice(i - 900, i).reduce((sum, c) => sum + c.close, 0) / 900;
    const prevMa900 = data.slice(i - 901, i - 1).reduce((sum, c) => sum + c.close, 0) / 900;

    const angle600 = calculateAngle(currMa600, prevMa600, 1);
    const angle900 = calculateAngle(currMa900, prevMa900, 1);

    const avgAngle = (angle600 + angle900) / 2;
    totalAngle += avgAngle;

    if (avgAngle <= -2) {
      downCount++;
    }
  }

  console.log(`\n🔍 [단기 하락 추세 분석]`);
  console.log(`✅ 최근 10봉 중 ${downCount}/10봉 기울기 -2° 이하`);
  console.log(`✅ 전체 평균 기울기: ${(totalAngle / 10).toFixed(2)}°`);

  return downCount >= 5 && totalAngle / 10 < -1.5;
}

/**
 * 이동평균선 간격이 충분히 벌어졌는지 확인
 * - 예) MA60 > MA120 > MA240 > MA360 > MA600
 * - 인접 MA 간격이 threshold% 이상
 */
function isMAFanSpreadOut(
  ma60: number,
  ma120: number,
  ma240: number,
  ma360: number,
  ma600: number,
  thresholdPercent = 0.05 // 0.01% 기준치로 대폭 완화
): boolean {
  // 1) 순서 체크: ma60 > ma120 > ma240 > ma360 > ma600
  // 모든 조건을 만족하지 않아도 됨 - 첫 번째 조건만 확인 
  if (!(ma60 > ma120)) {
    console.log('MA 순서 조건 불충족: MA60 > MA120');
    return false;
  }

  // 2) 각 MA 간 간격(%) 체크
  //    예: (MA60 - MA120)/MA120 * 100 >= thresholdPercent
  const diff60_120 = ((ma60 - ma120) / ma120) * 100;
  const diff120_240 = ((ma120 - ma240) / ma240) * 100;
  const diff240_360 = ((ma240 - ma360) / ma360) * 100;
  const diff360_600 = ((ma360 - ma600) / ma600) * 100;

  console.log(`[MA 간격] 60-120: ${diff60_120.toFixed(3)}%, 120-240: ${diff120_240.toFixed(3)}%, 240-360: ${diff240_360.toFixed(3)}%, 360-600: ${diff360_600.toFixed(3)}%`);
  console.log(`[기준치] ${thresholdPercent}% 이상`);

  // 각 구간의 간격이 thresholdPercent 이상인지 확인
  // 1개 이상의 조건만 충족해도 true 반환하도록 완화
  let passCount = 0;
  if (diff60_120 >= thresholdPercent) passCount++;
  if (diff120_240 >= thresholdPercent) passCount++;
  if (diff240_360 >= thresholdPercent) passCount++;
  if (diff360_600 >= thresholdPercent) passCount++;
  
  if (passCount < 1) {
    console.log('MA 간격 조건 불충족: 모든 구간이 기준치 미달');
    return false;
  }

  console.log(`✅ MA 간격 조건 충족! (${passCount}/4 구간 통과)`);
  return true;
}

// 매수/매도 거래량 비율 기반 매수 신호 분석
function analyzeEntryWithVolume(data: CandlestickData<Time>[], index: number): 'buy' | 'nobuyfrequpdown' | null {
  if (index < 60) return null; // 최소 60개 캔들 필요

  try {
    // 현재 시장 데이터 (고정값 사용)
    const market = 'KRW-BTC'; // 기본값 사용
    
    // 캐시된 거래량 데이터 가져오기
    const volumeData = getCachedVolumeData(market);
    
    // API 조회 시작 (백그라운드로 실행 - 다음 호출때 캐시 데이터 사용)
    getTradeVolume(market, 100).catch((err: Error) => console.error('거래량 업데이트 실패:', err));
    
    // 매수 신호 확인 (매수 거래량이 매도 거래량보다 20% 이상 많은 경우)
    if (hasBuySignal(volumeData.buyVolume, volumeData.sellVolume)) {
      console.log('✅ 매수 거래량 우세 → 매수 신호');
      
      // 추가 확인: 볼린저 밴드 접근 확인
      const period = 20;
      const stdDev = 2;
      const prices = data.slice(index - period, index).map(d => d.close);
      const sma = prices.reduce((a, b) => a + b, 0) / period;
      const sd = calculateStandardDeviation(prices);
      const lowerBand = sma - (stdDev * sd);
      
      const currentPrice = data[index].close;
      const distanceToLowerBand = ((currentPrice - lowerBand) / lowerBand) * 100;
      
      // 볼린저 밴드 하단에 가까울 때 (5% 이내)
      if (distanceToLowerBand <= 5) {
        console.log('✅ 볼린저 밴드 하단 접근 + 매수 거래량 우세 → 강력한 매수 신호');
        return 'buy';
      }
      
      // 그 외에도 매수 신호 유지
      return 'buy';
    }
    
    // 횡보장 감지 조건 추가
    if (volumeData.buySellRatio > 0.9 && volumeData.buySellRatio < 1.1) {
      console.log('⚠️ 매수/매도 거래량 균형 → 횡보장 감지');
      return 'nobuyfrequpdown';
    }
    
    return null;
  } catch (error) {
    console.error('거래량 기반 매수 분석 실패:', error);
    return null;
  }
}

// 매수/매도 거래량 비율 기반 매도 신호 분석
function analyzeExitWithVolume(data: CandlestickData<Time>[], index: number, position: 'buy', entryPrice: number): boolean {
  if (position !== 'buy') return false;
  if (index < 60) return false;

  try {
    // 현재 시장 데이터 (고정값 사용)
    const market = 'KRW-BTC'; // 기본값 사용
    
    // 캐시된 거래량 데이터 가져오기
    const volumeData = getCachedVolumeData(market);
    
    // API 조회 시작 (백그라운드로 실행 - 다음 호출때 캐시 데이터 사용)
    getTradeVolume(market, 100).catch((err: Error) => console.error('거래량 업데이트 실패:', err));
    
    // 매도 신호 확인 (매수 거래량이 매도 거래량보다 20% 이상 적은 경우)
    if (hasSellSignal(volumeData.buyVolume, volumeData.sellVolume)) {
      console.log('❌ 매도 거래량 우세 → 매도 신호');
      return true;
    }
    
    // 익절 조건
    const currentPrice = data[index].close;
    const profitPercent = ((currentPrice - entryPrice) / entryPrice) * 100;
    if (profitPercent >= 2.0) {
      console.log(`✅ 목표 수익률 ${profitPercent.toFixed(2)}% 달성 → 익절 매도`);
      return true;
    }
    
    // 손절 조건
    if (profitPercent <= -1.0) {
      console.log(`❌ 손실 ${profitPercent.toFixed(2)}% 발생 → 손절 매도`);
      return true;
    }
    
    return false;
  } catch (error) {
    console.error('거래량 기반 매도 분석 실패:', error);
    return false;
  }
}

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
  
  /**
   * 이익 목표 달성 여부 확인 (익절 조건)
   */
  shouldTakeProfit(entryPrice: number, currentPrice: number, takeProfitPercent = 2.0): boolean {
    const profitRatio = ((currentPrice - entryPrice) / entryPrice) * 100;
    console.log(`현재 수익률: ${profitRatio.toFixed(2)}% (목표: ${takeProfitPercent}%)`);
    return profitRatio >= takeProfitPercent;
  },
  
  /**
   * 최근 N봉 동안 MA600이 연속 하락 중인지 확인
   */
  isDowntrend(data: CandlestickData<Time>[], index: number, period = 5): boolean {
    // MA600을 계산하려면 최소 600개 캔들이 필요
    if (index < 600 + period) return false;

    let downCount = 0;

    for (let i = 0; i < period; i++) {
      const currMa600 = data.slice(index - i - 600, index - i)
                            .reduce((sum, c) => sum + c.close, 0) / 600;
      const prevMa600 = data.slice(index - i - 601, index - i - 1)
                            .reduce((sum, c) => sum + c.close, 0) / 600;
      
      // 이번 봉의 MA600이 이전 봉의 MA600보다 낮으면 "하락"으로 카운트
      if (currMa600 < prevMa600) {
        downCount++;
      }
    }

    // period(예: 5)봉 모두 하락이면 "하락 추세"로 판단
    return (downCount === period);
  },
  
  /**
   * 과거 60봉의 MA600 값을 검사하여,
   * - 전 5봉만 연속 상승하면 됨 (15봉에서 대폭 완화)
   * - 이후 평균 증감폭 조건은 제거 (항상 통과)
   */
  isUptrend(data: CandlestickData<Time>[], index: number ): boolean {
    // MA600 계산을 위해 최소 610봉(600 + 10)이 필요함
    if (index < 610) return false;

    const ma600Array: number[] = [];
    // 가장 최근 10봉의 MA600 값을 계산
    for (let i = index - 10 + 1; i <= index; i++) {
      const ma600Val =
        data.slice(i - 600, i).reduce((sum, c) => sum + c.close, 0) / 600;
      ma600Array.push(ma600Val);
    }
    
    // 조건: 5봉만 연속 상승하면 됨 (각각 이전보다 커야 함)
    let upCount = 0;
    for (let k = 0; k < 9; k++) {
      if (ma600Array[k] < ma600Array[k + 1]) {
        upCount++;
      }
    }

    // 5봉 이상 상승했으면 상승 추세로 판단
    if (upCount >= 5) {
      console.log(`MA600 최근 ${upCount}/9 봉이 상승 중: 상승 추세`);
      return true;
    }
    
    console.log(`MA600 최근 ${upCount}/9 봉만 상승 중: 상승 추세 아님`);
    return false;
  },
  // 진입 조건 분석
  analyzeEntry: analyzeEntryWithVolume,
  
  // 청산 조건 분석
  analyzeExit: analyzeExitWithVolume,
  
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
    
    // 거래량 데이터 가져오기 (동기 함수 사용)
    const market = 'KRW-BTC'; // 기본값 사용
    const volumeData = getCachedVolumeData(market);
    
    // API 조회 시작 (백그라운드로 실행 - 다음 호출때 캐시 데이터 사용)
    getTradeVolume(market, 100).catch((err: Error) => console.error('거래량 업데이트 실패:', err));
    
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
      isMA600Upward: ma600 > prevMa600,
      // 거래량 관련 데이터 추가
      buyVolume: volumeData.buyVolume,
      sellVolume: volumeData.sellVolume,
      buySellRatio: volumeData.buySellRatio
    };
    
    console.log(`[거래량 지표] 매수: ${volumeData.buyVolume.toFixed(4)}, 매도: ${volumeData.sellVolume.toFixed(4)}, 비율: ${volumeData.buySellRatio.toFixed(2)}`);
    console.log(`MA60: ${ma60.toFixed(3)}, MA120: ${ma120.toFixed(3)}, MA240: ${ma240.toFixed(3)}, MA360: ${ma360.toFixed(3)}, MA600: ${ma600.toFixed(3)}`);
      
    // 매수 조건 확인 상태 표시
    const isAbove120 = ma60 > ma120;
    const isAbove240 = ma60 > ma240;
    const isBelow360 = ma60 < ma360;
    const isMA600Upward = ma600 > prevMa600;
    const hasBuyVolumeAdvantage = volumeData.buySellRatio > 1.0;
      
    console.log('\n=== 매수 조건 체크 ===');
    console.log(`조건 1 (매수 거래량 우세): ${hasBuyVolumeAdvantage ? '✅' : '❌'} (${volumeData.buySellRatio.toFixed(2)})`);
    console.log(`조건 2 (MA60 > MA120): ${isAbove120 ? '✅' : '❌'}`);
    console.log(`조건 3 (MA60 > MA240): ${isAbove240 ? '✅' : '❌'}`);
    console.log(`조건 4 (MA600 상승세): ${isMA600Upward ? '✅' : '❌'}`);
    console.log(`조건 5 (MA60 < MA360): ${isBelow360 ? '✅' : '❌'}`);
    
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