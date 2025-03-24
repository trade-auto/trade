import { CandlestickData, Time } from 'lightweight-charts';
import { TradeSignal, ExtendedMetadata, AnalyzeOptions, AnalysisResult, TradeStrategy } from './types';
import useUpbitStore from '../store/useUpbitStore';
import { getCachedVolumeData, getTradeVolume, hasBuySignal, hasSellSignal } from './volumeUtils';

// ExtendedMetadata 타입 확장
declare module './types' {
  interface ExtendedMetadata {
    buyVolume?: number;
    sellVolume?: number;
    buySellRatio?: number;
    macdLine?: number;
    signalLine?: number;
    histogram?: number;
  }
}

type TradeState = 'waiting_buy' | 'buying' | 'bought' | 'waiting_sell' | 'selling' | 'sold';

// EMA 계산 함수
function calculateEMA(prices: number[], period: number): number[] {
  const ema: number[] = [];
  const multiplier = 2 / (period + 1);
  
  // 첫 번째 EMA는 SMA(단순 이동평균)로 계산
  let sma = 0;
  for (let i = 0; i < period; i++) {
    sma += prices[i];
  }
  sma /= period;
  ema.push(sma);
  
  // 나머지 기간에 대한 EMA 계산
  for (let i = period; i < prices.length; i++) {
    const currentEMA = (prices[i] - ema[ema.length - 1]) * multiplier + ema[ema.length - 1];
    ema.push(currentEMA);
  }
  
  return ema;
}

// MACD 지표 계산 함수
function calculateMACD(prices: number[], fastPeriod = 12, slowPeriod = 26, signalPeriod = 9): { 
  macdLine: number[], 
  signalLine: number[], 
  histogram: number[] 
} {
  // 빠른 EMA 계산 (일반적으로 12일)
  const fastEMA = calculateEMA(prices, fastPeriod);
  
  // 느린 EMA 계산 (일반적으로 26일)
  const slowEMA = calculateEMA(prices, slowPeriod);
  
  // MACD 라인 계산 (빠른 EMA - 느린 EMA)
  const macdLine: number[] = [];
  for (let i = slowPeriod - 1; i < fastEMA.length; i++) {
    macdLine.push(fastEMA[i] - slowEMA[i - (slowPeriod - fastPeriod)]);
  }
  
  // 시그널 라인 계산 (MACD 라인의 9일 EMA)
  const signalLine = calculateEMA(macdLine, signalPeriod);
  
  // 히스토그램 계산 (MACD 라인 - 시그널 라인)
  const histogram: number[] = [];
  for (let i = 0; i < signalLine.length; i++) {
    histogram.push(macdLine[i + signalPeriod - 1] - signalLine[i]);
  }
  
  return { macdLine, signalLine, histogram };
}

// MACD 기반 매수 신호 분석
function analyzeEntryWithMACD(data: CandlestickData<Time>[], index: number): 'buy' | 'nobuyfrequpdown' | null {
  if (index < 35) return null; // 최소 데이터 필요 (26 + 9 = 35)

  try {
    // 가격 데이터 추출
    const prices = data.slice(index - 35, index + 1).map(d => d.close);
    
    // MACD 계산
    const { macdLine, signalLine, histogram } = calculateMACD(prices);
    
    // 현재와 이전 히스토그램 값 비교
    const currentHistogram = histogram[histogram.length - 1];
    const prevHistogram = histogram[histogram.length - 2];
    
    // MACD 크로스오버 확인 (골든 크로스)
    const isGoldenCrossEntry = prevHistogram <= 0 && currentHistogram > 0;
    
    // 시장 데이터 (고정값)
    const market = 'KRW-BTC';
    
    // 거래량 데이터 가져오기
    const volumeData = getCachedVolumeData(market);
    
    // API 조회 백그라운드 실행
    getTradeVolume(market, 100).catch((err: Error) => console.error('거래량 업데이트 실패:', err));
    
    // 매수 신호 확인
    if (isGoldenCrossEntry) {
      console.log('✅ MACD 골든 크로스 발생 → 매수 신호');
      
      // 추가 확인: 거래량 우세 확인
      if (hasBuySignal(volumeData.buyVolume, volumeData.sellVolume)) {
        console.log('✅ 매수 거래량 우세 + MACD 골든 크로스 → 강력한 매수 신호');
        return 'buy';
      }
      
      // 거래량이 우세하지 않아도 매수 신호 유지
      return 'buy';
    }
    
    // 횡보장 감지 
    if (Math.abs(currentHistogram) < 0.0001 && Math.abs(prevHistogram) < 0.0001) {
      console.log('⚠️ MACD 히스토그램 값이 작음 → 횡보장 감지');
      return 'nobuyfrequpdown';
    }
    
    return null;
  } catch (error) {
    console.error('MACD 기반 매수 분석 실패:', error);
    return null;
  }
}

// MACD 기반 매도 신호 분석
function analyzeExitWithMACD(data: CandlestickData<Time>[], index: number, position: 'buy', entryPrice: number): boolean {
  if (position !== 'buy') return false;
  if (index < 35) return false;

  try {
    // 가격 데이터 추출
    const prices = data.slice(index - 35, index + 1).map(d => d.close);
    
    // MACD 계산
    const { macdLine, signalLine, histogram } = calculateMACD(prices);
    
    // 현재와 이전 히스토그램 값 비교
    const currentHistogram = histogram[histogram.length - 1];
    const prevHistogram = histogram[histogram.length - 2];
    
    // MACD 크로스언더 확인 (데드 크로스)
    const isDeadCross = prevHistogram >= 0 && currentHistogram < 0;
    
    // 시장 데이터 (고정값)
    const market = 'KRW-BTC';
    
    // 거래량 데이터 가져오기
    const volumeData = getCachedVolumeData(market);
    
    // API 조회 백그라운드 실행
    getTradeVolume(market, 100).catch((err: Error) => console.error('거래량 업데이트 실패:', err));
    
    // 매도 신호 확인
    if (isDeadCross) {
      console.log('❌ MACD 데드 크로스 발생 → 매도 신호');
      return true;
    }
    
    // 매도 신호 추가 확인: 거래량 기반
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
    console.error('MACD 기반 매도 분석 실패:', error);
    return false;
  }
}

// MACD 전략
const macdStrategy = {
  name: 'MACD',
  timeframe: '1m',
  description: 'MACD 지표 기반 전략',
  author: 'System',
  version: '1.0.0',
  tags: ['trend', 'macd', 'oscillator'],
  
  indicators: {
    macdPeriods: { fast: 12, slow: 26, signal: 9 }
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
  
  // 진입 조건 분석
  analyzeEntry: analyzeEntryWithMACD,
  
  // 청산 조건 분석
  analyzeExit: analyzeExitWithMACD,
  
  // 지표 계산 함수
  calculateIndicators(data: CandlestickData<Time>[], index: number) {
    if (index < 35) {
      return {} as ExtendedMetadata;
    }
    
    // 가격 데이터 추출
    const prices = data.slice(index - 35, index + 1).map((d: CandlestickData<Time>) => d.close);
    
    // MACD 계산
    const { macdLine, signalLine, histogram } = calculateMACD(prices);
    
    // 현재 값 가져오기
    const currentMacdLine = macdLine[macdLine.length - 1];
    const currentSignalLine = signalLine[signalLine.length - 1];
    const currentHistogram = histogram[histogram.length - 1];
    
    // 거래량 데이터 가져오기
    const market = 'KRW-BTC'; // 기본값 사용
    const volumeData = getCachedVolumeData(market);
    
    // API 조회 시작 (백그라운드로 실행)
    getTradeVolume(market, 100).catch((err: Error) => console.error('거래량 업데이트 실패:', err));
    
    const metadata: ExtendedMetadata = {
      macdLine: currentMacdLine,
      signalLine: currentSignalLine,
      histogram: currentHistogram,
      // 거래량 관련 데이터 추가
      buyVolume: volumeData.buyVolume,
      sellVolume: volumeData.sellVolume,
      buySellRatio: volumeData.buySellRatio
    };
    
    console.log(`[MACD 지표] MACD: ${currentMacdLine !== undefined ? currentMacdLine.toFixed(6) : 'N/A'}, 시그널: ${currentSignalLine !== undefined ? currentSignalLine.toFixed(6) : 'N/A'}, 히스토그램: ${currentHistogram !== undefined ? currentHistogram.toFixed(6) : 'N/A'}`);
    console.log(`[거래량 지표] 매수: ${volumeData.buyVolume.toFixed(4)}, 매도: ${volumeData.sellVolume.toFixed(4)}, 비율: ${volumeData.buySellRatio.toFixed(2)}`);
      
    // 매수 조건 확인 상태 표시
    const isGoldenCrossSignal = histogram.length >= 2 && histogram[histogram.length - 2] <= 0 && currentHistogram > 0;
    const isDeadCross = histogram.length >= 2 && histogram[histogram.length - 2] >= 0 && currentHistogram < 0;
    const hasBuyVolumeAdvantage = volumeData.buySellRatio > 1.0;
      
    console.log('\n=== 매수 조건 체크 ===');
    console.log(`조건 1 (MACD 골든 크로스): ${isGoldenCrossSignal ? '✅' : '❌'}`);
    console.log(`조건 2 (매수 거래량 우세): ${hasBuyVolumeAdvantage ? '✅' : '❌'} (${volumeData.buySellRatio.toFixed(2)})`);
    
    if (isGoldenCrossSignal) {
      console.log('✅ MACD 골든 크로스 발생: 매수 신호');
    } else if (isDeadCross) {
      console.log('❌ MACD 데드 크로스 발생: 매도 신호');
    }
    
    return metadata;
  },
  
  // 분석 함수
  analyze(data: CandlestickData<Time>[], options?: AnalyzeOptions): AnalysisResult {
    const signals: TradeSignal[] = [];
    let currentPosition: 'buy' | null = options?.currentPosition || null;
    let lastTradeId: string | null = options?.lastTradeId || null;
    
    // 마지막 신호 발생 시간 및 인덱스 추적
    let lastSignalIndex = options?.lastProcessedIndex ? options.lastProcessedIndex - 10 : 0; // 초기값 설정
    let lastSellTime = options?.metadata?.lastSellTime || 0; // 마지막 매도 시간 추적
    const minSignalInterval = 10; // 최소 10캔들(30분) 간격
    
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
    
    // MACD 계산을 위해 최소 35개의 데이터가 필요
    if (data.length < 35) {
      console.log('데이터가 충분하지 않습니다. 최소 35개의 캔들이 필요합니다.');
      console.log('현재 데이터 길이:', data.length);
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
    
    console.log('\n=== MACD 전략 분석 시작 ===');
    console.log('데이터 길이:', data.length);
    console.log('분석 시작 시간:', new Date().toLocaleString('ko-KR'));
    console.log('실시간 모드:', options?.realtime ? '✅' : '❌');
    console.log('현재 포지션:', currentPosition || '없음');
    
    // 실시간 모드인 경우 마지막 캔들만 분석
    let startIndex = 0; // 처음부터 데이터 수집
    let endIndex = data.length;
    
    if (options?.realtime) {
      if (options?.lastProcessedIndex !== undefined) {
        // 이미 초기화가 완료된 경우
        if (options.lastProcessedIndex >= 35) {
          startIndex = options.lastProcessedIndex + 1; // 이전에 처리한 다음 캔들부터 분석
          console.log(`실시간 모드: 신규 데이터만 분석 (인덱스 ${startIndex}부터 ${endIndex - 1}까지)`);
        } else {
          // 아직 초기화가 필요한 경우이지만, 분석은 계속 진행
          console.log('실시간 모드: 초기 데이터 수집 및 분석 중...');
          console.log(`현재: ${options.lastProcessedIndex}캔들 / 35캔들 (${((options.lastProcessedIndex/35)*100).toFixed(1)}%)`);
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
              strategy: 'MACD' as TradeStrategy,
              reason: 'MACD 골든 크로스',
              metadata: {
                macdLine: this.calculateIndicators(data, i).macdLine,
                signalLine: this.calculateIndicators(data, i).signalLine,
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
        // 충분한 간격이 확보되었을 때만 신호 발생 - 단, 매수 후 일정 시간(최소 20캔들=1시간)은 보유
        if (i - lastSignalIndex >= 20) {
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
                strategy: 'MACD' as TradeStrategy,
                relatedTradeId: lastTradeId,
                reason: 'MACD 데드 크로스',
                metadata: {
                  macdLine: this.calculateIndicators(data, i).macdLine,
                  signalLine: this.calculateIndicators(data, i).signalLine,
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
              console.log(`다음 매수 가능 시간: ${new Date(lastSellTime + 30*60000).toLocaleString('ko-KR')} (30분 후)`);
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
    
    console.log('\n=== MACD 전략 분석 완료 ===');
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
      
      // MACD 지표 표시
      if (data.length >= 35) {
        const prices = data.slice(data.length - 35, data.length).map((d: CandlestickData<Time>) => d.close);
        const { macdLine, signalLine, histogram } = calculateMACD(prices);
        
        const currentMacdLine = macdLine[macdLine.length - 1];
        const currentSignalLine = signalLine[signalLine.length - 1];
        const currentHistogram = histogram[histogram.length - 1];
        
        console.log(`MACD: ${currentMacdLine !== undefined ? currentMacdLine.toFixed(6) : 'N/A'}`);
        console.log(`시그널: ${currentSignalLine !== undefined ? currentSignalLine.toFixed(6) : 'N/A'}`);
        console.log(`히스토그램: ${currentHistogram !== undefined ? currentHistogram.toFixed(6) : 'N/A'}`);
        
        // 매수 조건 확인 상태 표시 (isGoldenCross 변수 중복 선언 제거)
        // 이미 위에서 계산된 값을 사용
        const isGoldenCrossCheck = histogram.length >= 2 && histogram[histogram.length - 2] <= 0 && currentHistogram > 0;
        
        console.log('\n=== 매수 조건 체크 ===');
        console.log(`조건 1 (MACD 골든 크로스): ${isGoldenCrossCheck ? '✅' : '❌'}`);
        console.log(`최종 판정: ${isGoldenCrossCheck ? '✅ 매수 조건 충족!' : '❌ 매수 조건 불충족'}`);
      }
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
        
        // MACD 지표 표시
        if (data.length >= 35) {
          const prices = data.slice(data.length - 35, data.length).map((d: CandlestickData<Time>) => d.close);
          const { macdLine, signalLine, histogram } = calculateMACD(prices);
          
          const currentMacdLine = macdLine[macdLine.length - 1];
          const currentSignalLine = signalLine[signalLine.length - 1];
          const currentHistogram = histogram[histogram.length - 1];
          
          console.log(`MACD: ${currentMacdLine !== undefined ? currentMacdLine.toFixed(6) : 'N/A'}`);
          console.log(`시그널: ${currentSignalLine !== undefined ? currentSignalLine.toFixed(6) : 'N/A'}`);
          console.log(`히스토그램: ${currentHistogram !== undefined ? currentHistogram.toFixed(6) : 'N/A'}`);
          
          // 매도 조건 확인 상태 표시
          const isDeadCross = histogram.length >= 2 && histogram[histogram.length - 2] >= 0 && currentHistogram < 0;
          
          console.log('\n=== 매도 조건 체크 ===');
          console.log(`조건 1 (MACD 데드 크로스): ${isDeadCross ? '✅' : '❌'}`);
        }
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

export default macdStrategy; 