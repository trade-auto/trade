import { CandlestickData, Time } from 'lightweight-charts';
import { BollingerStrategy, TradeSignal, ExtendedMetadata, AnalyzeOptions, AnalysisResult, PositionType } from './types';
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
    const entryDateTime = new Date(data[index].time as number * 1000);
    console.log('\n=== 📊 analyzeEntry 함수 진입 ===');
    console.log('분석 시작 시간:', entryDateTime.toLocaleString('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    }));
    console.log('캔들 인덱스:', index);

    // 15분(900초) 데이터가 쌓일 때까지 대기
    if (index < 900) {
      console.log('초기 데이터 수집 중... (필요: 900초 = 15분)');
      return null;
    }

    // 이미 매수 포지션이 있거나 거래 중인 경우 매수 신호를 발생시키지 않음
    // 실제 구현에서는 store에서 상태를 가져와야 함
    
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

    // MA900 상승 여부를 기울기로 판단 (0.001% 이상이면 상승으로 판단)
    const isMA900Upward = ma900Slope >= 0.001;

    // MA120/240 상향 지속 기간 체크 (10봉 기준)
    let ma120UpCount = 0;
    let ma240UpCount = 0;
    let ma60Above120Count = 0;
    let ma60Above240Count = 0;

    for (let i = 0; i < 10; i++) {
      const currentMa120 = data.slice(index - i - 120, index - i).reduce((a, b) => a + b.close, 0) / 120;
      const prevMa120Check = data.slice(index - i - 121, index - i - 1).reduce((a, b) => a + b.close, 0) / 120;
      const currentMa240 = data.slice(index - i - 240, index - i).reduce((a, b) => a + b.close, 0) / 240;
      const prevMa240Check = data.slice(index - i - 241, index - i - 1).reduce((a, b) => a + b.close, 0) / 240;
      const currentMa60 = data.slice(index - i - 60, index - i).reduce((a, b) => a + b.close, 0) / 60;
      const prevMa60Check = data.slice(index - i - 61, index - i - 1).reduce((a, b) => a + b.close, 0) / 60;
      const currentMa900 = data.slice(index - i - 900, index - i).reduce((a, b) => a + b.close, 0) / 900;
      const prevMa900Check = data.slice(index - i - 901, index - i - 1).reduce((a, b) => a + b.close, 0) / 900;

      if (currentMa120 > prevMa120Check) ma120UpCount++;
      if (currentMa240 > prevMa240Check) ma240UpCount++;
      if (currentMa60 > currentMa120) ma60Above120Count++;
      if (currentMa60 > currentMa240) ma60Above240Count++;
    }

    // 60MA가 120MA와 240MA보다 위에 있는지 확인
    const isAbove120 = ma60 > ma120;
    const isAbove240 = ma60 > ma240;
    
    // 60MA가 900MA보다 아래에 있는지 확인
    const isBelow900 = ma60 < ma900;

    // 현재 가격
    const currentPrice = data[index].close;

    console.log('\n=== 볼린저 매수 신호 상세 분석 ===');
    console.log('현재 시간:', new Date().toLocaleString('ko-KR'));
    console.log('현재 가격:', currentPrice.toLocaleString('ko-KR') + '원');
    
    console.log('\n이동평균선 값:');
    console.log({
      'MA60': ma60.toLocaleString('ko-KR'),
      'MA120': ma120.toLocaleString('ko-KR'),
      'MA240': ma240.toLocaleString('ko-KR'),
      'MA900': ma900.toLocaleString('ko-KR')
    });
    
    console.log('\nMA 기울기:', {
      'MA60 기울기': ma60Slope.toFixed(4) + '%',
      'MA120 기울기': ma120Slope.toFixed(4) + '%',
      'MA240 기울기': ma240Slope.toFixed(4) + '%',
      'MA900 기울기': ma900Slope.toFixed(4) + '%'
    });
    
    console.log('\n매수 조건 상세:');
    console.log({
      '1. MA240 상향 지속 봉수': ma240UpCount + '봉 (필요: 5봉 이상)',
      '2. MA60이 MA120 위': isAbove120 ? '✅' : '❌',
      '3. MA60이 MA240 위': isAbove240 ? '✅' : '❌',
      '4. MA900 상승세': isMA900Upward ? `✅ (${ma900Slope.toFixed(4)}%)` : `❌ (${ma900Slope.toFixed(4)}%)`,
      '5. MA60이 MA900 아래': isBelow900 ? '✅' : '❌'
    });
    
    console.log('\n매수 조건 충족 여부:');
    console.log({
      '조건 1 (MA240 상향 5봉 이상)': ma240UpCount >= 5 ? '✅' : '❌',
      '조건 2 (MA60 > MA120)': isAbove120 ? '✅' : '❌',
      '조건 3 (MA60 > MA240)': isAbove240 ? '✅' : '❌',
      '조건 4 (MA900 상승세)': isMA900Upward ? '✅' : '❌',
      '조건 5 (MA60 < MA900)': isBelow900 ? '✅' : '❌',
      '최종 판정': (ma240UpCount >= 5 && isAbove120 && isAbove240 && isMA900Upward && isBelow900) ? '✅ 매수 신호 발생!' : '❌ 매수 조건 불충족'
    });

    // 매수 시그널 생성 - 기본 조건
    if (ma240UpCount >= 5 && isAbove120 && isAbove240 && isMA900Upward && isBelow900  ) {
      console.log('\n=== ✅ 매수 조건 충족! ===');
      console.log('상태 변경: waiting_buy → buy (매수 주문 실행)');
      return 'buy';  // 매수 신호 발생 → 매수 주문 실행 (buy)
    }

    // 매수 조건 불충족 사유 상세 출력
    console.log('\n=== ❌ 매수 조건 불충족 ===');
    if (ma900Slope < 0) {
      console.log('MA900 하락 중 (기울기:', ma900Slope.toFixed(4) + '%)');
    }
    console.log('상태 유지: waiting_buy (매수 대기)');
    return null;  // 매수 대기 상태 유지 (waiting_buy)
  },
  
  // 청산 조건 분석
  analyzeExit(data: CandlestickData<Time>[], index: number, position: 'buy', entryPrice: number): boolean {
    // position이 'buy'가 아니면 매도 신호를 발생시키지 않음
    if (index < 360 || position !== 'buy') return false;

    let ma900UpCount = 0; 
    
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

    // MA 기울기 하향 조건 (10봉 연속 하향인 경우)
    let ma120DownCount = 0;
    let ma240DownCount = 0;
    let ma60Below120Count = 0;
    let ma60Below240Count = 0;
    let ma900DownCount = 0;

    for (let i = 0; i < 10; i++) {
      const currentMa120 = data.slice(index - i - 120, index - i).reduce((a, b) => a + b.close, 0) / 120;
      const prevMa120Check = data.slice(index - i - 121, index - i - 1).reduce((a, b) => a + b.close, 0) / 120;
      const currentMa240 = data.slice(index - i - 240, index - i).reduce((a, b) => a + b.close, 0) / 240;
      const prevMa240Check = data.slice(index - i - 241, index - i - 1).reduce((a, b) => a + b.close, 0) / 240;
      const currentMa60 = data.slice(index - i - 60, index - i).reduce((a, b) => a + b.close, 0) / 60;
      const prevMa60Check = data.slice(index - i - 61, index - i - 1).reduce((a, b) => a + b.close, 0) / 60;
      const currentMa900 = data.slice(index - i - 900, index - i).reduce((a, b) => a + b.close, 0) / 900;
      const prevMa900Check = data.slice(index - i - 901, index - i - 1).reduce((a, b) => a + b.close, 0) / 900;

      if (currentMa120 < prevMa120Check) ma120DownCount++;
      if (currentMa240 < prevMa240Check) ma240DownCount++;
      if (currentMa60 < currentMa120) ma60Below120Count++;
      if (currentMa60 < currentMa240) ma60Below240Count++;
      if (currentMa900 < prevMa900Check) ma900DownCount++;
      if (currentMa900 > prevMa900Check) ma900UpCount++; 
    }

    // MA 기울기 하향 조건 (10봉 연속 하향인 경우)
    const isMA120240Downward = ma120DownCount >= 10 && ma240DownCount >= 10;
    const isMA900Downward = ma900DownCount >= 10;
    const isMA900Upward = ma900UpCount >= 10;

    // 60MA가 120MA와 240MA보다 아래에 있는지 확인
    const isBelow120 = ma60 < ma120;
    const isBelow240 = ma60 < ma240;

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
    console.log('MA 기울기:', {
      MA60: ma60Slope.toFixed(4) + '%',
      MA120: ma120Slope.toFixed(4) + '%',
      MA240: ma240Slope.toFixed(4) + '%',
      MA900: ma900Slope.toFixed(4) + '%'
    });
    console.log('매도 조건:', {
      '체크 시간': new Date().toLocaleString('ko-KR', {
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      }),
      'MA120 하향 지속 봉수': ma120DownCount + '봉',
      'MA240 하향 지속 봉수': ma240DownCount + '봉',
      'MA120/240 하향(10봉)': isMA120240Downward,
      'MA900 하향': isMA900Downward,
      'MA60이 MA120 아래': isBelow120,
      'MA60이 MA240 아래': isBelow240,
      '현재 수익률': profitPercent.toFixed(2) + '%'
    });

    // 매도 시그널 생성 - 기본 조건
    if (ma240DownCount >= 5 && isBelow120 && isBelow240 && isMA900Upward) {
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
        'MA240 하향 5봉 이상': ma240DownCount >= 5 ? '✅' : '❌',
        'MA60이 MA120 아래': isBelow120 ? '✅' : '❌',
        'MA60이 MA240 아래': isBelow240 ? '✅' : '❌',
        'MA900 상향': isMA900Upward ? '✅' : '❌',
        '최종 판정': '✅ 매도 신호 발생!'
      });
      return true;  // 매도 신호 발생 → 매도 주문 실행 (sell)
    }

    // 추가 매도 조건 - MA60 하락 추세이고 MA120 아래로 내려간 경우
    if (ma60Slope < 0 && isBelow120 && ma60Below120Count >= 5) {
      console.log('\n=== 추가 매도 조건 충족 여부 ===');
      console.log('상태 변경: waiting_sell → sell (매도 주문 실행)');
      console.log({
        '체크 시간': new Date().toLocaleString('ko-KR'),
        'MA60 하락 추세': ma60Slope < 0 ? '✅' : '❌',
        'MA60이 MA120 아래': isBelow120 ? '✅' : '❌',
        'MA60이 MA120 아래 지속 봉수': ma60Below120Count + '봉',
        '최종 판정': '✅ 추가 매도 신호 발생!'
      });
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
    let currentPosition: PositionType = options?.currentPosition || 'waiting_buy';
    let lastTradeId: string | null = options?.lastTradeId || null;
    
    // 실시간 모드에서는 1시간(3600초)의 데이터가 있어야 하며,
    // 그 중 첫 15분(900초)은 MA900 계산을 위한 데이터로 사용됨
    if (data.length < 3600) {
      console.log('데이터가 충분하지 않습니다. 최소 3600개의 캔들이 필요합니다. (1시간)');
      console.log('현재 데이터 길이:', data.length, '초');
      return {
        signals,
        lastProcessedIndex: data.length - 1,
        currentPosition,
        lastTradeId
      };
    }
    
    const self = this;
    
    console.log('\n=== 볼린저 전략 분석 시작 ===');
    console.log('데이터 길이:', data.length, '초');
    console.log('분석 시작 시간:', new Date().toLocaleString('ko-KR'));
    console.log('실시간 모드:', options?.realtime ? '✅' : '❌');
    
    // 실시간 모드인 경우 마지막 캔들만 분석
    // MA900 계산을 위해 시작 인덱스를 900으로 설정
    let startIndex = 900;
    let endIndex = data.length;
    
    if (options?.realtime) {
      if (options?.lastProcessedIndex !== undefined && options.lastProcessedIndex >= 900) {
        // 마지막으로 처리된 인덱스 이후의 데이터만 분석
        startIndex = options.lastProcessedIndex + 1;
        console.log(`실시간 모드: 인덱스 ${startIndex}부터 ${endIndex - 1}까지 분석합니다.`);
        console.log('MA900 계산 가능 여부:', startIndex >= 900 ? '✅' : '❌');
        
        // 현재 포지션 상태 설정
        if (options.currentPosition) {
          currentPosition = options.currentPosition;
          console.log(`현재 포지션: ${currentPosition}`);
        }
        
        if (options.lastTradeId) {
          lastTradeId = options.lastTradeId;
          console.log(`마지막 거래 ID: ${lastTradeId}`);
        }
      }
    } else {
      console.log(`전체 데이터 분석: 인덱스 ${startIndex}부터 ${endIndex - 1}까지 분석합니다.`);
      console.log('MA900 계산에 필요한 초기 데이터:', startIndex, '초');
    }

    for (let i = startIndex; i < endIndex; i++) {
      // 현재 캔들 정보 로깅
      if (i % 100 === 0 || options?.realtime) {
        console.log(`캔들 ${i}/${data.length - 1} 분석 중...`);
      }
      
      // 현재 포지션이 매수 대기인 경우에만 매수 신호 확인
      if (currentPosition === 'waiting_buy') {
        const entrySignal = self.analyzeEntry?.(data, i);
        
        if (entrySignal === 'buy') {
          const tradeId = `trade-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
          signals.push({
            id: tradeId,
            time: data[i].time as number,
            position: 'buy',
            price: data[i].close,
            strategy: 'BOLLINGER',
            reason: '매수 조건 충족',
            metadata: self.calculateIndicators?.(data, i)
          });
          
          lastTradeId = tradeId;
          currentPosition = 'waiting_sell';
          
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
      // 현재 매도 대기 포지션인 경우에만 매도 신호 확인
      else if (currentPosition === 'waiting_sell' && lastTradeId) {
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
        
        const shouldExit = self.analyzeExit?.(data, i, 'buy', entryPrice);
        
        if (shouldExit) {
          const exitTradeId = `trade-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
          signals.push({
            id: exitTradeId,
            time: data[i].time as number,
            position: 'sell',
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
          currentPosition = 'waiting_buy';
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
    
    // 현재 상태 정보 반환 (실시간 모드에서 다음 호출 시 사용)
    return {
      signals,
      lastProcessedIndex: endIndex - 1,
      currentPosition,
      lastTradeId,
      entryPrice: currentPosition === 'buy' && signals.length > 0 ? 
        signals.find(s => s.id === lastTradeId)?.price : undefined
    };
  }
};

export default bollingerStrategy; 