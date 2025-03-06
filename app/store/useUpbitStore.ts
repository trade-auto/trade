import { create } from 'zustand';
import { format } from 'date-fns';
import { DateRange } from '../types/candlestick';
import { CandlestickData, Time } from 'lightweight-charts';

interface PriceData {
  currentPrice: number;
  lastUpdated: string;
}

interface TickerData {
  type: string;
  code: string;
  trade_price: number;
  trade_volume: number;
  opening_price: number;
  high_price: number;
  low_price: number;
  prev_closing_price: number;
  change: string;
  change_price: number;
  change_rate: number;
  signed_change_price: number;
  signed_change_rate: number;
  trade_date: string;
  trade_time: string;
  trade_timestamp: number;
  timestamp: number;
  acc_trade_price: number;
  acc_trade_price_24h: number;
  acc_trade_volume: number;
  acc_trade_volume_24h: number;
  highest_52_week_price: number;
  highest_52_week_date: string;
  lowest_52_week_price: number;
  lowest_52_week_date: string;
  market_state: string;
}

interface TradeState {
  lastTradeType: 'bid' | 'ask' | null;
  statusChangeTime: string;
  currentPrice: number;
  actionStartTime: Date | null;
  isTrading: boolean;
  theoreticalPosition: 'bid' | 'ask' | 'wait';
  missedFirstCycle: boolean;
}

// TradeStrategy 타입을 export
export type TradeStrategy = 'BOLLINGER' | 'MA_CROSS' | 'MA_CROSS_DEVIATION' | 'SLOPE_FILTER';

// maPeriods의 타입 정의
interface MAType {
  thirty: number;
  forty: number;
  sixty: number;
  oneTwenty: number;
  threeHundredSixty: number;
  twoForty: number;
  threeHundred: number;
  nineHundred: number;
}

// 포지션 타입을 더 명확하게 정의
export type PositionType = 'long' | 'short' | 'close';

// ExtendedMetadata 인터페이스에 필요한 필드 추가
interface ExtendedMetadata {
  deviation?: number;
  slope?: number;
  ma30?: number;
  ma60?: number;
  ma120?: number;
  ma240?: number;
  ma300?: number;
  ma360?: number;
  ma900?: number;
  rsi?: number;
  macd?: number;
  momentum?: number;
  ma300Slope?: number;
  ma900Slope?: number;
  upperBand?: number;
  lowerBand?: number;
  isAbove360MA?: boolean;
}

export type TradeSignal = {
  id: string;               // 고유 트레이드 ID
  time: number;
  position: PositionType;   // 포지션 타입
  price: number;
  amount?: number;          // 거래 수량 (선택사항)
  strategy: TradeStrategy;
  reason?: string;          // 신호 발생 이유
  metadata?: ExtendedMetadata;
  relatedTradeId?: string;  // 관련 거래 ID (페어링용)
};

// 진행 중인 트레이드 상태 관리를 위한 인터페이스
export interface Trade {
  id: string;
  entryTime: number;
  entryPrice: number;
  entryAmount?: number;
  entryReason?: string;
  entryMetadata?: ExtendedMetadata;
  exitTime?: number;
  exitPrice?: number;
  exitAmount?: number;
  exitReason?: string;
  exitMetadata?: ExtendedMetadata;
  strategy: TradeStrategy;
  profit?: number;
  profitPercentage?: number;
  status: 'open' | 'closed';
  type: 'long' | 'short';
}

// 진입/청산 규칙에 대한 인터페이스
export interface EntryRules {
  shouldLong: (data: CandlestickData<Time>[], index: number) => boolean;  // 롱 진입 조건
  shouldShort?: (data: CandlestickData<Time>[], index: number) => boolean; // 숏 진입 조건 (선택사항)
}

// 청산 규칙에 대한 인터페이스
export interface ExitRules {
  shouldExitLong: (data: CandlestickData<Time>[], index: number, entryPrice: number) => boolean;  // 롱 청산 조건
  shouldExitShort?: (data: CandlestickData<Time>[], index: number, entryPrice: number) => boolean; // 숏 청산 조건 (선택사항)
}

// 리스크 관리 설정
export interface RiskManagement {
  stopLossPercent?: number;      // 손절매 비율 (%)
  takeProfitPercent?: number;    // 익절 비율 (%)
  trailingStopPercent?: number;  // 트레일링 스탑 비율 (%)
  maxDrawdownPercent?: number;   // 최대 손실 허용 비율 (%)
  positionSizePercent?: number;  // 포지션 크기 비율 (%)
  maxOpenTrades?: number;        // 최대 동시 거래 수
}

// 지표 설정
export interface IndicatorSettings {
  maPeriods?: { short: number; long: number; };  // MA 기간 설정
  bollinger?: { period: number; stdDev: number; };  // 볼린저 밴드 설정
  rsi?: { period: number; overbought: number; oversold: number; };  // RSI 설정
  macd?: { fast: number; slow: number; signal: number; };  // MACD 설정
  customIndicators?: Record<string, any>;  // 사용자 정의 지표
}

// 개선된 트레이딩 전략 인터페이스
export interface TradingStrategy {
  name: TradeStrategy;
  timeframe?: string;                   // 타임프레임 설정: '1m', '5m', '15m', '1h', '4h', '1d' 등
  description: string;                  // 전략 설명
  author?: string;                      // 전략 작성자
  version?: string;                     // 전략 버전
  tags?: string[];                      // 전략 태그 (예: 'trend', 'momentum', 'mean-reversion')
  
  // 전략 설정
  indicators?: IndicatorSettings;       // 지표 설정
  riskManagement?: RiskManagement;      // 리스크 관리 설정
  
  // 진입/청산 규칙
  entryRules?: EntryRules;              // 진입 규칙
  exitRules?: ExitRules;                // 청산 규칙
  
  // 기존 분석 함수 (하위 호환성을 위해 유지)
  analyze: (data: CandlestickData<Time>[]) => TradeSignal[];
  
  // 새로운 분석 함수 (개별 컴포넌트별로 분리)
  analyzeEntry?: (data: CandlestickData<Time>[], index: number) => 'long' | 'short' | null;
  analyzeExit?: (data: CandlestickData<Time>[], index: number, position: 'long' | 'short', entryPrice: number) => boolean;
  
  // 포지션 크기 계산
  calculatePositionSize?: (data: CandlestickData<Time>[], index: number, availableBalance: number) => number;
  
  // 지표 계산 함수
  calculateIndicators?: (data: CandlestickData<Time>[]) => Record<string, any[]>;
  
  // 백테스트 결과 분석 및 시각화 메서드
  analyzeBacktestResults?: (trades: Trade[]) => Record<string, any>;
  visualizeStrategy?: (data: CandlestickData<Time>[], trades: Trade[]) => Record<string, any[]>;
}

// 트레이드 처리 함수: 이제 position 타입이 호환됨
const processTradeSignals = (signals: TradeSignal[]): TradeSignal[] => {
  const trades: Trade[] = [];
  const openTrades: Record<string, Trade> = {};
  
  // 시간순으로 정렬
  const sortedSignals = [...signals].sort((a, b) => a.time - b.time);
  
  for (const signal of sortedSignals) {
    if (signal.position === 'long') {
      // 신규 트레이드 생성
      const tradeId = signal.id || `trade-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const newTrade: Trade = {
        id: tradeId,
        entryTime: signal.time,
        entryPrice: signal.price,
        entryAmount: signal.amount,
        entryReason: signal.reason,
        entryMetadata: signal.metadata,
        strategy: signal.strategy,
        status: 'open',
        type: 'long'
      };
      openTrades[tradeId] = newTrade;
      trades.push(newTrade);
    } else if (signal.position === 'short' || signal.position === 'close') {
      // 관련 진입 트레이드 찾기
      const relatedTradeId = signal.relatedTradeId;
      let matchingTrade = relatedTradeId ? openTrades[relatedTradeId] : null;
      
      // 관련 ID가 없으면 같은 전략에 대한 가장 최근의 미종료 트레이드 찾기
      if (!matchingTrade) {
        const openTradesOfStrategy = Object.values(openTrades).filter(
          t => t.status === 'open' && t.strategy === signal.strategy && t.type === 'long'
        );
        
        if (openTradesOfStrategy.length > 0) {
          // 가장 오래된 미종료 트레이드 가져오기
          matchingTrade = openTradesOfStrategy.sort((a, b) => a.entryTime - b.entryTime)[0];
        }
      }
      
      // 매칭되는 트레이드가 있으면 종료 정보 업데이트
      if (matchingTrade) {
        matchingTrade.exitTime = signal.time;
        matchingTrade.exitPrice = signal.price;
        matchingTrade.exitAmount = signal.amount;
        matchingTrade.exitReason = signal.reason;
        matchingTrade.exitMetadata = signal.metadata;
        matchingTrade.status = 'closed';
        
        // 수익 계산
        if (matchingTrade.type === 'long') {
          matchingTrade.profit = matchingTrade.exitPrice - matchingTrade.entryPrice;
          matchingTrade.profitPercentage = (matchingTrade.exitPrice / matchingTrade.entryPrice - 1) * 100;
        } else {
          matchingTrade.profit = matchingTrade.entryPrice - matchingTrade.exitPrice;
          matchingTrade.profitPercentage = (matchingTrade.entryPrice / matchingTrade.exitPrice - 1) * 100;
        }
        
        // 종료된 트레이드는 openTrades에서 제거
        delete openTrades[matchingTrade.id];
      }
    }
  }
  
  // 백엔드에서는 Trade 객체를 사용하지만, 기존 인터페이스 호환성을 위해 TradeSignal을 반환
  return signals;
};

// 볼린저 밴드 전략 업데이트
const bollingerStrategy: TradingStrategy = {
  name: 'BOLLINGER',
  timeframe: '1m',
  description: '완화된 조건의 볼린저 밴드 전략',
  author: 'System',
  version: '1.0.0',
  tags: ['trend', 'mean-reversion'],
  
  indicators: {
    maPeriods: { short: 60, long: 120 },
    bollinger: { period: 20, stdDev: 2 }
  },
  
  riskManagement: {
    stopLossPercent: 1.5,
    takeProfitPercent: 3.0,
    positionSizePercent: 30
  },
  
  // 새로운 방식의 진입/청산 로직 (예시)
  entryRules: {
    shouldLong: (data, index) => {
      if (index < 900) return false; // 충분한 데이터 확보
      
      const ma60 = data.slice(index - 60, index).reduce((sum, d) => sum + d.close, 0) / 60;
      const ma120 = data.slice(index - 120, index).reduce((sum, d) => sum + d.close, 0) / 120;
      const ma240 = data.slice(index - 240, index).reduce((sum, d) => sum + d.close, 0) / 240;
      const ma360 = data.slice(index - 360, index).reduce((sum, d) => sum + d.close, 0) / 360;
      const ma900 = data.slice(index - 900, index).reduce((sum, d) => sum + d.close, 0) / 900;
      
      // 60MA가 120MA 상향 돌파
      const prevMa60 = data.slice(index - 61, index - 1).reduce((sum, d) => sum + d.close, 0) / 60;
      const prevMa120 = data.slice(index - 121, index - 1).reduce((sum, d) => sum + d.close, 0) / 120;
      const upward60_120 = prevMa60 <= prevMa120 && ma60 > ma120;
      
      // 240MA가 360MA 상향 돌파 체크
      let upward240_360 = false;
      for (let j = index; j < Math.min(data.length, index + 10); j++) {
        if (j < 361) continue;
        const currentMa240_j = data.slice(j - 240, j).reduce((sum, d) => sum + d.close, 0) / 240;
        const prevMa240_j = data.slice(j - 241, j - 1).reduce((sum, d) => sum + d.close, 0) / 240;
        const currentMa360_j = data.slice(j - 360, j).reduce((sum, d) => sum + d.close, 0) / 360;
        const prevMa360_j = data.slice(j - 361, j - 1).reduce((sum, d) => sum + d.close, 0) / 360;

        if (prevMa240_j <= prevMa360_j && currentMa240_j > currentMa360_j) {
          upward240_360 = true;
          break;
        }
      }
      
      // 이격도 확인
      const gap120_240 = Math.abs(ma120 - ma240) / ma240;
      const prevGap120_240 = Math.abs(prevMa120 - data.slice(index - 241, index - 1).reduce((sum, d) => sum + d.close, 0) / 240) / (data.slice(index - 241, index - 1).reduce((sum, d) => sum + d.close, 0) / 240);
      const isGapNarrowing = gap120_240 < prevGap120_240;
      
      // 매수 조건
      return (upward60_120 && upward240_360 && isGapNarrowing && ma60 > ma900);
    }
  },
  
  exitRules: {
    shouldExitLong: (data, index, entryPrice) => {
      if (index < 900) return false; // 충분한 데이터 확보
      
      const ma60 = data.slice(index - 60, index).reduce((sum, d) => sum + d.close, 0) / 60;
      const ma120 = data.slice(index - 120, index).reduce((sum, d) => sum + d.close, 0) / 120;
      const ma240 = data.slice(index - 240, index).reduce((sum, d) => sum + d.close, 0) / 240;
      const ma360 = data.slice(index - 360, index).reduce((sum, d) => sum + d.close, 0) / 360;
      const ma900 = data.slice(index - 900, index).reduce((sum, d) => sum + d.close, 0) / 900;
      
      // 60MA가 120MA 하향 돌파
      const prevMa60 = data.slice(index - 61, index - 1).reduce((sum, d) => sum + d.close, 0) / 60;
      const prevMa120 = data.slice(index - 121, index - 1).reduce((sum, d) => sum + d.close, 0) / 120;
      const downward60_120 = prevMa60 >= prevMa120 && ma60 < ma120;
      
      // 매도 조건
      return (downward60_120 && ma60 <= ma900 && ma240 <= ma360);
    }
  },

  // 기존 분석 함수 (하위 호환성을 위해 유지)
  analyze: (data) => {
    const signals: TradeSignal[] = [];
    let currentPosition: 'long' | 'short' | null = null;
    
    // 충분한 데이터 확보를 위해 900MA 기준으로 시작
    for (let i = 900; i < data.length; i++) {
      // 현재 및 이전 MAs 계산
      const ma60 = data.slice(i - 60, i).reduce((sum, d) => sum + d.close, 0) / 60;
      const prevMa60 = data.slice(i - 61, i - 1).reduce((sum, d) => sum + d.close, 0) / 60;

      const ma120 = data.slice(i - 120, i).reduce((sum, d) => sum + d.close, 0) / 120;
      const prevMa120 = data.slice(i - 121, i - 1).reduce((sum, d) => sum + d.close, 0) / 120;

      const ma240 = data.slice(i - 240, i).reduce((sum, d) => sum + d.close, 0) / 240;
      const prevMa240 = data.slice(i - 241, i - 1).reduce((sum, d) => sum + d.close, 0) / 240;

      const ma360 = data.slice(i - 360, i).reduce((sum, d) => sum + d.close, 0) / 360;
      const prevMa360 = data.slice(i - 361, i - 1).reduce((sum, d) => sum + d.close, 0) / 360;

      const ma900 = data.slice(i - 900, i).reduce((sum, d) => sum + d.close, 0) / 900;

      // 현재 120MA, 240MA의 이격도와 10초 전 이격도 비교
      const gapCurrent = Math.abs(ma240 - ma120) / ma120;
      let gapPrev = Infinity;
      if (i - 10 >= 240 && i - 10 >= 120) {
        const ma120_10 = data.slice(i - 10 - 120, i - 10).reduce((sum, d) => sum + d.close, 0) / 120;
        const ma240_10 = data.slice(i - 10 - 240, i - 10).reduce((sum, d) => sum + d.close, 0) / 240;
        gapPrev = Math.abs(ma240_10 - ma120_10) / ma120_10;
      }
      const isGapNarrowing = gapCurrent < gapPrev;

      // 60MA와 120MA 크로스
      const upward60_120 = (prevMa60 <= prevMa120 && ma60 > ma120);
      const downward60_120 = (prevMa60 >= prevMa120 && ma60 < ma120);
      // 초기 매수를 위한 60MA와 240MA 크로스
      const upward60_240 = (prevMa60 <= prevMa240 && ma60 > ma240);

      // 10초 이내 240MA와 360MA의 크로스 탐색 (상/하향 각각)
      let upward240_360 = false;
      let downward240_360 = false;
      for (let j = i; j < Math.min(data.length, i + 10); j++) {
        if (j < 361 || j < 241) continue; // MA 계산에 필요한 최소 데이터 확보
        const currentMa240_j = data.slice(j - 240, j).reduce((sum, d) => sum + d.close, 0) / 240;
        const prevMa240_j = data.slice(j - 241, j - 1).reduce((sum, d) => sum + d.close, 0) / 240;
        const currentMa360_j = data.slice(j - 360, j).reduce((sum, d) => sum + d.close, 0) / 360;
        const prevMa360_j = data.slice(j - 361, j - 1).reduce((sum, d) => sum + d.close, 0) / 360;

        if (!upward240_360 && (prevMa240_j <= prevMa360_j && currentMa240_j > currentMa360_j)) {
          upward240_360 = true;
        }
        if (!downward240_360 && (prevMa240_j >= prevMa360_j && currentMa240_j < currentMa360_j)) {
          downward240_360 = true;
        }
      }

      // 매수 시 추가 조건: 360MA와 240MA 간 이격이 0.08% 이하이면 매수하지 않음
      const gap360_240 = Math.abs(ma360 - ma240) / ma240;
      const avoidBuyDueToGap = gap360_240 <= 0.0008;

      // [매수 조건]
      // 1. 초기 매수: 포지션이 없을 때, 60MA가 120MA와 240MA 모두 상향 돌파하고,
      //    120/240 이격도가 10초 전보다 좁아지며, 360/240 이격 조건이 충족되지 않으면 매수.
      if (currentPosition === null) {
        if (upward60_120 && upward60_240 && isGapNarrowing && !avoidBuyDueToGap) {
          signals.push({
            id: `trade-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            time: data[i].time as number,
            position: 'long',
            price: data[i].close,
            strategy: 'MA_CROSS_DEVIATION' as TradeStrategy,
            reason: '초기 매수 조건 충족'
          });
          currentPosition = 'long';
        }
      }
      // 기존 숏 포지션에서 롱으로 전환: 60MA가 120MA를 상향 돌파하고,
      // 10초 이내 240MA가 상향 돌파하며, 이격도 조건 및 추가 조건이 충족되면 매수.
      else if (currentPosition === 'short') {
        if (upward60_120 && upward240_360 && isGapNarrowing && !avoidBuyDueToGap) {
          signals.push({
            id: `trade-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            time: data[i].time as number,
            position: 'long',
            price: data[i].close,
            strategy: 'MA_CROSS_DEVIATION' as TradeStrategy,
            reason: '10초 이내 240MA가 상향 돌파'
          });
          currentPosition = 'long';
        }
      }

      // [매도 조건] - 현재 롱 포지션인 경우에만
      // 1. 60MA가 120MA를 하향 돌파하고,
      // 2. 10초 이내 240MA가 하향 돌파하며,
      // 3. 120/240 이격도가 10초 전보다 좁아지고,
      // 4. 60MA가 900MA보다 위에 있으면 매도하지 않으며,
      // 5. 240MA가 360MA보다 위에 있으면 매도 신호 무시.
      if (currentPosition === 'long') {
        const ma900 = data.slice(i - 900, i).reduce((sum, d) => sum + d.close, 0) / 900;
        if (
          ma60 <= ma900 && 
          downward60_120 && 
          downward240_360 && 
          isGapNarrowing && 
          (ma240 <= ma360)
        ) {
          signals.push({
            id: `trade-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            time: data[i].time as number,
            position: 'short',
            price: data[i].close,
            strategy: 'MA_CROSS_DEVIATION' as TradeStrategy,
            reason: '60MA가 900MA보다 위에 있으며, 120/240 이격도가 10초 전보다 좁아지고, 240MA가 360MA보다 위에 있음'
          });
          currentPosition = 'short';
        }
      }
    }
    return processTradeSignals(signals);
  }
};

// MA 크로스 전략 업데이트
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
  
  // 새로운 방식의 진입/청산 로직 (예시)
  entryRules: {
    shouldLong: (data, index) => {
      if (index < 60) return false; // 충분한 데이터 확보
      
      const shortPeriod = 30;
      const longPeriod = 60;
      
      const shortMA = data.slice(index - shortPeriod, index).reduce((a, b) => a + b.close, 0) / shortPeriod;
      const longMA = data.slice(index - longPeriod, index).reduce((a, b) => a + b.close, 0) / longPeriod;
      const prevShortMA = data.slice(index - shortPeriod - 1, index - 1).reduce((a, b) => a + b.close, 0) / shortPeriod;
      const prevLongMA = data.slice(index - longPeriod - 1, index - 1).reduce((a, b) => a + b.close, 0) / longPeriod;
      
      return (prevShortMA <= prevLongMA && shortMA > longMA);
    }
  },
  
  exitRules: {
    shouldExitLong: (data, index) => {
      if (index < 60) return false; // 충분한 데이터 확보
      
      const shortPeriod = 30;
      const longPeriod = 60;
      
      const shortMA = data.slice(index - shortPeriod, index).reduce((a, b) => a + b.close, 0) / shortPeriod;
      const longMA = data.slice(index - longPeriod, index).reduce((a, b) => a + b.close, 0) / longPeriod;
      const prevShortMA = data.slice(index - shortPeriod - 1, index - 1).reduce((a, b) => a + b.close, 0) / shortPeriod;
      const prevLongMA = data.slice(index - longPeriod - 1, index - 1).reduce((a, b) => a + b.close, 0) / longPeriod;
      
      return (prevShortMA >= prevLongMA && shortMA < longMA);
    }
  },
  
  // 기존 분석 함수 (하위 호환성을 위해 유지)
  analyze: (data) => {
    const signals: TradeSignal[] = [];
    const shortPeriod = 30;
    const longPeriod = 60;
    let currentPosition: 'long' | 'short' | null = null;
    let lastTradeId: string | null = null;

    for (let i = longPeriod; i < data.length; i++) {
      const shortMA = data.slice(i - shortPeriod, i).reduce((a, b) => a + b.close, 0) / shortPeriod;
      const longMA = data.slice(i - longPeriod, i).reduce((a, b) => a + b.close, 0) / longPeriod;
      const prevShortMA = data.slice(i - shortPeriod - 1, i - 1).reduce((a, b) => a + b.close, 0) / shortPeriod;
      const prevLongMA = data.slice(i - longPeriod - 1, i - 1).reduce((a, b) => a + b.close, 0) / longPeriod;

      if (prevShortMA <= prevLongMA && shortMA > longMA && (currentPosition === null || currentPosition === 'short')) {
        const tradeId = `trade-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        signals.push({
          id: tradeId,
          time: data[i].time as number,
          position: 'long',
          price: data[i].close,
          strategy: 'MA_CROSS',
          reason: '단기 이동평균선이 장기 이동평균선을 상향 돌파',
          metadata: {
            ma30: shortMA,
            ma60: longMA
          }
        });
        currentPosition = 'long';
        lastTradeId = tradeId;
      } else if (prevShortMA >= prevLongMA && shortMA < longMA && currentPosition === 'long') {
        signals.push({
          id: `trade-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          time: data[i].time as number,
          position: 'short',
          price: data[i].close,
          strategy: 'MA_CROSS',
          reason: '단기 이동평균선이 장기 이동평균선을 하향 돌파',
          relatedTradeId: lastTradeId || undefined,
          metadata: {
            ma30: shortMA,
            ma60: longMA
          }
        });
        currentPosition = 'short';
        lastTradeId = null;
      }
    }
    
    return signals;
  }
};

// EMA 계산 유틸리티 함수
function calculateEMA(data: CandlestickData<Time>[], period: number): { time: Time; value: number }[] {
  const k = 2 / (period + 1);
  const emaData: { time: Time; value: number }[] = [];
  let ema = data[0].close;

  for (let i = 0; i < data.length; i++) {
    ema = data[i].close * k + ema * (1 - k);
    emaData.push({ time: data[i].time, value: ema });
  }

  return emaData;
}

// MACD 시그널 라인 계산을 위한 임시 데이터 생성 함수
function createTempCandleData(time: Time, close: number): CandlestickData<Time> {
  return {
    time,
    open: close,
    high: close,
    low: close,
    close
  };
}

// 이격도 MA 이탈
const maDeviationStrategy: TradingStrategy = {
  name: 'MA_CROSS_DEVIATION',
  analyze: (data) => {
    const signals: TradeSignal[] = [];
    let currentPosition: 'long' | 'short' | null = null;
    
    // 충분한 데이터 확보를 위해 360MA 기준으로 시작
    for (let i = 360; i < data.length; i++) {
      // 현재 및 이전 MAs 계산
      const ma60 = data.slice(i - 60, i).reduce((sum, d) => sum + d.close, 0) / 60;
      const prevMa60 = data.slice(i - 61, i - 1).reduce((sum, d) => sum + d.close, 0) / 60;

      const ma120 = data.slice(i - 120, i).reduce((sum, d) => sum + d.close, 0) / 120;
      const prevMa120 = data.slice(i - 121, i - 1).reduce((sum, d) => sum + d.close, 0) / 120;

      const ma240 = data.slice(i - 240, i).reduce((sum, d) => sum + d.close, 0) / 240;
      const prevMa240 = data.slice(i - 241, i - 1).reduce((sum, d) => sum + d.close, 0) / 240;

      const ma360 = data.slice(i - 360, i).reduce((sum, d) => sum + d.close, 0) / 360;
      const prevMa360 = data.slice(i - 361, i - 1).reduce((sum, d) => sum + d.close, 0) / 360;

      // 현재 120MA, 240MA의 이격도와 10초 전 이격도 비교
      const gapCurrent = Math.abs(ma240 - ma120) / ma120;
      let gapPrev = Infinity;
      if (i - 10 >= 240 && i - 10 >= 120) {
        const ma120_10 = data.slice(i - 10 - 120, i - 10).reduce((sum, d) => sum + d.close, 0) / 120;
        const ma240_10 = data.slice(i - 10 - 240, i - 10).reduce((sum, d) => sum + d.close, 0) / 240;
        gapPrev = Math.abs(ma240_10 - ma120_10) / ma120_10;
      }
      const isGapNarrowing = gapCurrent < gapPrev;

      // 60MA와 120MA 크로스
      const upward60_120 = (prevMa60 <= prevMa120 && ma60 > ma120);
      const downward60_120 = (prevMa60 >= prevMa120 && ma60 < ma120);
      // 초기 매수를 위한 60MA와 240MA 크로스
      const upward60_240 = (prevMa60 <= prevMa240 && ma60 > ma240);

      // 10초 이내 240MA와 360MA의 크로스 탐색 (상/하향 각각)
      let upward240_360 = false;
      let downward240_360 = false;
      for (let j = i; j < Math.min(data.length, i + 10); j++) {
        if (j < 361 || j < 241) continue; // MA 계산에 필요한 최소 데이터 확보
        const currentMa240_j = data.slice(j - 240, j).reduce((sum, d) => sum + d.close, 0) / 240;
        const prevMa240_j = data.slice(j - 241, j - 1).reduce((sum, d) => sum + d.close, 0) / 240;
        const currentMa360_j = data.slice(j - 360, j).reduce((sum, d) => sum + d.close, 0) / 360;
        const prevMa360_j = data.slice(j - 361, j - 1).reduce((sum, d) => sum + d.close, 0) / 360;

        if (!upward240_360 && (prevMa240_j <= prevMa360_j && currentMa240_j > currentMa360_j)) {
          upward240_360 = true;
        }
        if (!downward240_360 && (prevMa240_j >= prevMa360_j && currentMa240_j < currentMa360_j)) {
          downward240_360 = true;
        }
      }

      // 매수 시 추가 조건: 360MA와 240MA 간 이격이 0.08% 이하이면 매수하지 않음
      const gap360_240 = Math.abs(ma360 - ma240) / ma240;
      const avoidBuyDueToGap = gap360_240 <= 0.0008;

      // [매수 조건]
      // 1. 초기 매수: 포지션이 없을 때, 60MA가 120MA와 240MA 모두 상향 돌파하고,
      //    120/240 이격도가 10초 전보다 좁아지며, 360/240 이격 조건이 충족되지 않으면 매수.
      if (currentPosition === null) {
        if (upward60_120  && isGapNarrowing ){ //&& upward60_240){ //&& !avoidBuyDueToGap) {
          signals.push({
            id: `trade-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            time: data[i].time as number,
            position: 'long',
            price: data[i].close,
            strategy: 'MA_CROSS_DEVIATION' as TradeStrategy,
            reason: '초기 매수 조건 충족'
          });
          currentPosition = 'long';
        }
      }
      // 기존 숏 포지션에서 롱으로 전환: 60MA가 120MA를 상향 돌파하고,
      // 10초 이내 240MA가 상향 돌파하며, 이격도 조건 및 추가 조건이 충족되면 매수.
      else if (currentPosition === 'short') {
        if (upward60_120 && upward240_360 && isGapNarrowing && !avoidBuyDueToGap) {
          signals.push({
            id: `trade-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            time: data[i].time as number,
            position: 'long',
            price: data[i].close,
            strategy: 'MA_CROSS_DEVIATION' as TradeStrategy,
            reason: '10초 이내 240MA가 상향 돌파'
          });
          currentPosition = 'long';
        }
      }

      // [매도 조건] - 현재 롱 포지션인 경우에만
      // 1. 60MA가 120MA를 하향 돌파하고,
      // 2. 10초 이내 240MA가 하향 돌파하며,
      // 3. 120/240 이격도가 10초 전보다 좁아지고,
      // 4. 60MA가 900MA보다 위에 있으면 매도하지 않으며,
      // 5. 240MA가 360MA보다 위에 있으면 매도 신호 무시.
      if (currentPosition === 'long') {
        const ma900 = data.slice(i - 900, i).reduce((sum, d) => sum + d.close, 0) / 900;
        if (
          ma60 <= ma900 && 
          downward60_120 && 
          downward240_360 && 
          isGapNarrowing && 
          (ma240 <= ma360)
        ) {
          signals.push({
            id: `trade-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            time: data[i].time as number,
            position: 'short',
            price: data[i].close,
            strategy: 'MA_CROSS_DEVIATION' as TradeStrategy,
            reason: '60MA가 900MA보다 위에 있으며, 120/240 이격도가 10초 전보다 좁아지고, 240MA가 360MA보다 위에 있음'
          });
          currentPosition = 'short';
        }
      }
    }
    return processTradeSignals(signals);
  },
  description: '120/240 이격 및 60MA/120MA, 240MA/360MA 크로스 조건 기반 전략 (추가 60/900, 초기 매수 조건 포함)'
};

// RSI 계산 헬퍼 함수
function calculateRSI(prices: number[]): number {
  const rsiPeriod = 14;
  const gains = [];
  const losses = [];
  
  for (let i = 1; i < prices.length; i++) {
    const diff = prices[i] - prices[i - 1];
    if (diff >= 0) {
      gains.push(diff);
      losses.push(0);
    } else {
      gains.push(0);
      losses.push(Math.abs(diff));
    }
  }
  
  const avgGain = gains.slice(-rsiPeriod).reduce((a, b) => a + b, 0) / rsiPeriod;
  const avgLoss = losses.slice(-rsiPeriod).reduce((a, b) => a + b, 0) / rsiPeriod;
  const rs = avgGain / (avgLoss || 1);
  return 100 - (100 / (1 + rs));
}

// 기울기 필터 전략
const slopeFilterStrategy: TradingStrategy = {
  name: 'SLOPE_FILTER',
  analyze: (data) => {
    const signals: TradeSignal[] = [];
    // 기본 파라미터 설정
    const ma60Period = 60;
    const ma120Period = 120;
    const ma240Period = 240;
    const ma300Period = 300;
    const ma360Period = 360;
    const ma900Period = 900;
    const rsiPeriod = 14;
    const macdFast = 12;
    const macdSlow = 26;
    const macdSignal = 9;
    const bbandsLength = 20;
    const bbandsStdDev = 2;
    let currentPosition: 'long' | 'short' | null = null;

    // 최소 필요 데이터 포인트 계산
    const minDataPoints = Math.max(ma900Period, rsiPeriod, macdSlow + macdSignal);
    if (data.length < minDataPoints) return signals;

    for (let i = minDataPoints; i < data.length; i++) {
      const prices = data.slice(0, i + 1).map(d => d.close);
      
      // 이동평균선 계산
      const ma60 = prices.slice(-ma60Period).reduce((a, b) => a + b, 0) / ma60Period;
      const ma120 = prices.slice(-ma120Period).reduce((a, b) => a + b, 0) / ma120Period;
      const ma240 = prices.slice(-ma240Period).reduce((a, b) => a + b, 0) / ma240Period;
      const ma300 = prices.slice(-ma300Period).reduce((a, b) => a + b, 0) / ma300Period;
      const ma360 = prices.slice(-ma360Period).reduce((a, b) => a + b, 0) / ma360Period;
      const ma900 = prices.slice(-ma900Period).reduce((a, b) => a + b, 0) / ma900Period;

      // 이전 이동평균선 계산 (교차 확인용)
      const prevMa60 = prices.slice(-ma60Period-1, -1).reduce((a, b) => a + b, 0) / ma60Period;
      const prevMa120 = prices.slice(-ma120Period-1, -1).reduce((a, b) => a + b, 0) / ma120Period;

      // MACD 계산
      const emaFast = calculateEMA(data.slice(0, i + 1), macdFast).slice(-1)[0]?.value || 0;
      const emaSlow = calculateEMA(data.slice(0, i + 1), macdSlow).slice(-1)[0]?.value || 0;
      const macd = emaFast - emaSlow;
      const macdSignalLine = calculateEMA(
        data.slice(0, i + 1).map(d => createTempCandleData(d.time, 
          calculateEMA([createTempCandleData(d.time, d.close)], macdFast)[0]?.value - 
          calculateEMA([createTempCandleData(d.time, d.close)], macdSlow)[0]?.value || 0
        )),
        macdSignal
      ).slice(-1)[0]?.value || 0;
      const macdHistogram = macd - macdSignalLine;
      const prevMacdHistogram = calculateEMA(
        data.slice(0, i).map(d => createTempCandleData(d.time,
          calculateEMA([createTempCandleData(d.time, d.close)], macdFast)[0]?.value -
          calculateEMA([createTempCandleData(d.time, d.close)], macdSlow)[0]?.value || 0
        )),
        macdSignal
      ).slice(-1)[0]?.value || 0;

      // RSI 계산
      const rsiSlice = prices.slice(-rsiPeriod * 2);
      const gains = [];
      const losses = [];
      for (let j = 1; j < rsiSlice.length; j++) {
        const diff = rsiSlice[j] - rsiSlice[j - 1];
        if (diff >= 0) {
          gains.push(diff);
          losses.push(0);
        } else {
          gains.push(0);
          losses.push(Math.abs(diff));
        }
      }
      const avgGain = gains.slice(-rsiPeriod).reduce((a, b) => a + b, 0) / rsiPeriod;
      const avgLoss = losses.slice(-rsiPeriod).reduce((a, b) => a + b, 0) / rsiPeriod;
      const rs = avgGain / (avgLoss || 1);
      const rsi = 100 - (100 / (1 + rs));
      const prevRsi = i > 0 ? calculateRSI(prices.slice(0, i)) : rsi;

      // 볼린저 밴드 계산
      const bbandsSlice = prices.slice(-bbandsLength);
      const bbandsMA = bbandsSlice.reduce((a, b) => a + b, 0) / bbandsLength;
      const bbandsStd = Math.sqrt(
        bbandsSlice.reduce((a, b) => a + Math.pow(b - bbandsMA, 2), 0) / bbandsLength
      );
      const upperBand = bbandsMA + (bbandsStdDev * bbandsStd);
      const lowerBand = bbandsMA - (bbandsStdDev * bbandsStd);

      // 매수 조건 확인
      const isLongCondition = 
        // 이동평균선 정렬 및 교차 조건
        ma60 > ma120 && ma120 > ma240 && ma240 > ma300 && ma300 > ma360 && ma360 > ma900 &&
        prevMa60 <= prevMa120 && ma60 > ma120 && // MA60이 MA120 상향 돌파
        // MACD 조건
        macdHistogram > 0 && prevMacdHistogram <= 0 && // MACD 상향 돌파
        // RSI 조건
        ((rsi < 30 && rsi > prevRsi) || (rsi >= 40 && rsi <= 60)) && // RSI 상승 반전 또는 중립대역
        // 볼린저 밴드 조건
        data[i].close <= lowerBand;

      // 매도 조건 확인
      const isShortCondition = 
        // 이동평균선 정렬 붕괴 또는 하향 돌파
        (ma60 < ma120 || ma120 < ma240 || prevMa60 >= prevMa120 && ma60 < ma120) &&
        // MACD 조건
        macdHistogram < 0 && prevMacdHistogram >= 0 && // MACD 하향 돌파
        // RSI 조건
        rsi > 70 &&
        // 볼린저 밴드 조건
        data[i].close >= upperBand;

      if (isLongCondition && (currentPosition === null || currentPosition === 'short')) {
        signals.push({
          id: `trade-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          time: data[i].time as number,
          position: 'long',
          price: data[i].close,
          strategy: 'SLOPE_FILTER' as TradeStrategy,
          reason: '이동평균선 정렬 및 교차 조건 충족',
          metadata: {
            deviation: Math.abs(data[i].close - ma60) / ma60,
            ma360,
            ma120,
            isAbove360MA: data[i].close > ma360,
            rsi,
            macd: macdHistogram
          }
        });
        currentPosition = 'long';
      } else if (isShortCondition && currentPosition === 'long') {
        signals.push({
          id: `trade-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          time: data[i].time as number,
          position: 'short',
          price: data[i].close,
          strategy: 'SLOPE_FILTER' as TradeStrategy,
          reason: '이동평균선 정렬 붕괴 또는 하향 돌파',
          metadata: {
            deviation: Math.abs(data[i].close - ma60) / ma60,
            ma360,
            ma120,
            isAbove360MA: data[i].close > ma360,
            rsi,
            macd: macdHistogram
          }
        });
        currentPosition = 'short';
      }
    }
    return processTradeSignals(signals);
  },
  description: '통합 기술적 분석 전략 (MA/MACD/RSI/BB)'
};

// 전략 맵 정의
const strategies: Record<TradeStrategy, TradingStrategy> = {
  BOLLINGER: bollingerStrategy,
  MA_CROSS: maCrossStrategy,
  MA_CROSS_DEVIATION: maDeviationStrategy,
  SLOPE_FILTER: slopeFilterStrategy
};

interface UpbitStore {
  prices: Record<string, PriceData>;
  tickers: Record<string, TickerData>;
  isConnected: boolean;
  addPrice: (symbol: string, price: number) => void;
  setIsConnected: (status: boolean) => void;
  updateLastUpdated: (symbol: string) => void;
  updateTickerData: (symbol: string, data: TickerData) => void;
  tradeState: TradeState;
  updateTradeState: (update: Partial<TradeState>) => void;
  createOrder: (params: {
    market: string;
    side: 'bid' | 'ask';
    volume: string;
    price: string;
    ord_type: string;
    mode: string;
  }) => Promise<void>;
  orderLimits: {
    minOrderPrice: number;
    maxOrderPrice: number;
  };
  maPeriods: MAType;
  updateMAPeriod: (type: 'thirty' | 'forty' | 'sixty' | 'oneTwenty' | 'twoForty' | 'threeHundredSixty' | 'threeHundred' | 'nineHundred', value: number) => void;
  showMA: {
    thirty: boolean;
    forty: boolean;
    sixty: boolean;
    oneTwenty: boolean;
    twoForty: boolean;
    threeHundredSixty: boolean;
    threeHundred: boolean;
    nineHundred: boolean;
  };
  updateShowMA: (type: 'thirty' | 'forty' | 'sixty' | 'oneTwenty' | 'twoForty' | 'threeHundredSixty' | 'threeHundred' | 'nineHundred') => void;
  tradeStrategy: TradeStrategy;
  updateTradeStrategy: (strategy: TradeStrategy) => void;
  dateRange: DateRange;
  updateDateRange: (startDate: Date, endDate: Date | null) => void;
  strategies: Record<TradeStrategy, TradingStrategy>;
  getStrategy: (name: TradeStrategy) => TradingStrategy;
  analyzeStrategy: (data: CandlestickData<Time>[]) => TradeSignal[];
  trades: Trade[];
  addTrade: (trade: Trade) => void;
  updateTrade: (tradeId: string, updates: Partial<Trade>) => void;
  getOpenTrades: () => Trade[];
  getClosedTrades: () => Trade[];
}

// 로컬 스토리지에서 MA 설정 불러오기
const loadMASettings = () => {
  if (typeof window !== 'undefined') {
    try {
      const savedShowMA = localStorage.getItem('showMA');
      const savedMAPeriods = localStorage.getItem('maPeriods');
      
      return {
        showMA: savedShowMA ? JSON.parse(savedShowMA) : {
          thirty: true,
          forty: true,
          sixty: true,
          oneTwenty: true,
          twoForty: true,
          threeHundredSixty: true,
          threeHundred: true,
          nineHundred: true,
        },
        maPeriods: savedMAPeriods ? JSON.parse(savedMAPeriods) : {
          thirty: 30,
          forty: 40,
          sixty: 60,
          oneTwenty: 120,
          twoForty: 240,
          threeHundredSixty: 360,
          threeHundred: 300,
          nineHundred: 900,
        }
      };
    } catch (error) {
      console.error('MA 설정 로드 오류:', error);
    }
  }
  // 서버 사이드에서는 기본값을 반환하거나 다른 처리를 할 수 있습니다.
  return {
    showMA: {
      thirty: true,
      forty: true,
      sixty: true,
      oneTwenty: true,
      twoForty: true,
      threeHundredSixty: true,
      threeHundred: true,
      nineHundred: true,
    },
    maPeriods: {
      thirty: 30,
      forty: 40,
      sixty: 60,
      oneTwenty: 120,
      twoForty: 240,
      threeHundredSixty: 360,
      threeHundred: 300,
      nineHundred: 900,
    }
  };
};

const savedSettings = loadMASettings();

const isClient = typeof window !== 'undefined';

const tradeStrategy = isClient ? (localStorage.getItem('lastTradeStrategy') as TradeStrategy) || 'BOLLINGER' : 'BOLLINGER';

export const useUpbitStore = create<UpbitStore>()((set, get) => ({
  prices: {},
  tickers: {},
  isConnected: false,
  
  addPrice: (symbol: string, price: number) => set((state) => ({
    prices: {
      ...state.prices,
      [symbol]: {
        currentPrice: price,
        lastUpdated: format(new Date(), 'yyyy-MM-dd HH:mm:ss')
      }
    }
  })),
  
  setIsConnected: (status: boolean) => set({ isConnected: status }),
  
  updateLastUpdated: (symbol: string) => set((state) => ({
    prices: {
      ...state.prices,
      [symbol]: {
        ...state.prices[symbol],
        lastUpdated: format(new Date(), 'yyyy-MM-dd HH:mm:ss')
      }
    }
  })),

  updateTickerData: (symbol: string, data: TickerData) => set((state) => ({
    tickers: {
      ...state.tickers,
      [symbol]: data
    }
  })),

  tradeState: {
    lastTradeType: null,
    statusChangeTime: '',
    currentPrice: 0,
    actionStartTime: null,
    isTrading: false,
    theoreticalPosition: 'wait',
    missedFirstCycle: false
  },

  updateTradeState: (update) => 
    set((state) => ({
      tradeState: { ...state.tradeState, ...update }
    })),

  createOrder: async (params) => {
    try {
      // 실제 주문 로직 구현
      const response = await fetch('/api/order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params)
      });
      if (!response.ok) throw new Error('주문 실패');
    } catch (error) {
      console.error('주문 오류:', error);
      throw error;
    }
  },

  orderLimits: {
    minOrderPrice: 5000,
    maxOrderPrice: 1000000000
  },

  maPeriods: savedSettings.maPeriods,

  updateMAPeriod: (type, value) => set((state) => {
    const newMAPeriods = {
      ...state.maPeriods,
      [type]: value,
    };
    
    if (isClient) {
      // 로컬 스토리지에 저장
      localStorage.setItem('maPeriods', JSON.stringify(newMAPeriods));
    }
    
    return { maPeriods: newMAPeriods };
  }),

  showMA: savedSettings.showMA,

  updateShowMA: (type) => set((state) => {
    const newShowMA = {
      ...state.showMA,
      [type]: !state.showMA[type],
    };
    
    if (isClient) {
      // 로컬 스토리지에 저장
      localStorage.setItem('showMA', JSON.stringify(newShowMA));
    }
    
    return { showMA: newShowMA };
  }),

  // 로컬 스토리지에서 마지막 전략 불러오기 또는 기본값 설정
  tradeStrategy,
  
  updateTradeStrategy: (strategy) => {
    localStorage.setItem('lastTradeStrategy', strategy);
    set({ tradeStrategy: strategy });
    // 차트 데이터를 초기화하거나 새로고침하는 로직 추가
    const data = get().analyzeStrategy([]); // 빈 데이터로 초기화
    // 차트 컴포넌트에 데이터 업데이트 로직 추가 필요
  },

  // 초기 dateRange 설정
  dateRange: {
    startDate: new Date(),
    endDate: null
  },

  // dateRange 업데이트 함수
  updateDateRange: (startDate: Date, endDate: Date | null) => 
    set((state) => ({
      dateRange: {
        ...state.dateRange,
        startDate,
        endDate
      }
    })),

  // 전략 관련 상태 및 함수 추가
  strategies,
  
  getStrategy: (name) => strategies[name],
  
  analyzeStrategy: (data) => {
    const currentStrategy = get().tradeStrategy;
    return strategies[currentStrategy].analyze(data);
  },

  trades: [],

  addTrade: (trade) => set((state) => ({
    trades: [...state.trades, trade]
  })),

  updateTrade: (tradeId, updates) => set((state) => ({
    trades: state.trades.map(trade =>
      trade.id === tradeId ? { ...trade, ...updates } : trade
    )
  })),

  getOpenTrades: () => get().trades.filter(trade => trade.status === 'open'),

  getClosedTrades: () => get().trades.filter(trade => trade.status === 'closed')
})); 

const detectMAReversal = (prices: number[], shortPeriod: number = 3, midPeriod: number = 10, longPeriod: number = 20): 'buy' | 'sell' | 'hold' => {
  if (prices.length < longPeriod + 2) return 'hold'; // 충분한 데이터가 없으면 홀드
  
  const shortMA = calculateMA(prices, shortPeriod);
  const midMA = calculateMA(prices, midPeriod);
  const longMA = calculateMA(prices, longPeriod);
  
  // 이전 캔들에서 단기 < 중기였다가 현재 캔들에서 단기 > 중기가 되면 매수 신호
  const prevShortMA = shortMA[shortMA.length - 2];
  const prevMidMA = midMA[midMA.length - 2];
  const currentShortMA = shortMA[shortMA.length - 1];
  const currentMidMA = midMA[midMA.length - 1];
  const currentLongMA = longMA[longMA.length - 1];
  
  // 추세 방향 확인 (장기 이동평균 기준)
  const isUptrend = currentShortMA > currentLongMA && currentMidMA > currentLongMA;
  const isDowntrend = currentShortMA < currentLongMA && currentMidMA < currentLongMA;
  
  if (prevShortMA < prevMidMA && currentShortMA > currentMidMA && isUptrend) {
    return 'buy'; // 상승 돌파 + 상승 추세
  } else if (prevShortMA > prevMidMA && currentShortMA < currentMidMA && isDowntrend) {
    return 'sell'; // 하락 돌파 + 하락 추세
  }
  
  return 'hold';
};

// 거래 시그널 함수 수정
let currentPosition: 'long' | 'short' | 'close' = 'close';

const getTradeSignal = (priceData: number[], currentPrice: number): "long" | "short" | "close" => {
  const ma60 = calculateMA(priceData, 60);
  const ma120 = calculateMA(priceData, 120);
  const ma300 = calculateMA(priceData, 300);
  const ma360 = calculateMA(priceData, 360);
  const ma900 = calculateMA(priceData, 900);
  if (ma60.length === 0 || ma120.length === 0 || ma300.length === 0 || ma360.length === 0 || ma900.length === 0) return "close";

  const ma120_latest = ma120[ma120.length - 1];
  const ma360_latest = ma360[ma360.length - 1];

  const angle60 = getAngle(ma60);
  const angle300 = getAngle(ma300);
  const angle900 = getAngle(ma900);
  const prevPrice = priceData[priceData.length - 2];
  const prev_ma120 = ma120[ma120.length - 2];

  const buy120Cross = prev_ma120 !== undefined && prevPrice < prev_ma120 && currentPrice >= ma120_latest;
  const sell120Cross = prev_ma120 !== undefined && prevPrice > prev_ma120 && currentPrice <= ma120_latest;

  const buyAngleDuration = updateConditionDuration("60MA_angle_above_45", angle60);
  const sellAngleDuration = updateConditionDuration("60MA_angle_below_minus45", angle60);

  if (!ma360_latest) return "close";

  const is300MASloping = angle300 > 0;
  const is900MASloping = angle900 > 0;
  
  const rsi = calculateRSI(priceData);
  const macd = calculateMACD(priceData);
  const bollingerSignal = isBollingerBandSignal(priceData);
  const maReversalSignal = detectMAReversal(priceData);
  
  if (currentPrice < ma360_latest) {
    const slopeCondition = (angle60 >= 10 && buyAngleDuration >= 5) || buy120Cross;
    const rsiCondition = rsi < 60;
    const macdCondition = macd.histogram > -2;
    const bollingerCondition = bollingerSignal === 'buy';
    const maReversalCondition = maReversalSignal === 'buy';
    const additionalIndicatorsCount = [
      rsiCondition, 
      macdCondition, 
      bollingerCondition, 
      maReversalCondition
    ].filter(Boolean).length;
    if (slopeCondition && is300MASloping && additionalIndicatorsCount >= 1 && currentPosition !== 'long') {
      currentPosition = 'long';
      return "long";
    }
    return "close";
  } else {
    const slopeCondition = (angle60 <= -30 && sellAngleDuration >= 15) || sell120Cross;
    const rsiCondition = rsi > 50;
    const macdCondition = macd.histogram < 1 && macd.macd < 1;
    const bollingerCondition = bollingerSignal === 'sell';
    const maReversalCondition = maReversalSignal === 'sell';
    const additionalIndicatorsCount = [
      rsiCondition, 
      macdCondition, 
      bollingerCondition, 
      maReversalCondition
    ].filter(Boolean).length;
    if (slopeCondition && additionalIndicatorsCount >= 1 && currentPosition !== 'short') {
      currentPosition = 'short';
      return "short";
    }
    return "close";
  }
}; 

// 이동평균 계산 함수
function calculateMA(prices: number[], period: number): number[] {
  const ma: number[] = [];
  for (let i = period - 1; i < prices.length; i++) {
    const sum = prices.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0);
    ma.push(sum / period);
  }
  return ma;
}

// 각도 계산 함수
function getAngle(ma: number[]): number {
  if (ma.length < 2) return 0;
  const delta = ma[ma.length - 1] - ma[ma.length - 2];
  return Math.atan(delta) * (180 / Math.PI); // 라디안을 각도로 변환
}

// 조건 지속 시간 업데이트 함수
function updateConditionDuration(conditionName: string, angle: number): number {
  // 이 함수는 조건이 유지된 시간을 계산하여 반환합니다.
  // 실제 구현은 조건에 따라 다를 수 있습니다.
  return 30; // 예시로 30초를 반환
}

// MACD 계산 함수
function calculateMACD(prices: number[]): { macd: number; signal: number; histogram: number } {
  // MACD 계산 로직을 여기에 구현합니다.
  return { macd: 0, signal: 0, histogram: 0 }; // 예시 반환값
}

// 볼린저 밴드 시그널 확인 함수
function isBollingerBandSignal(prices: number[]): 'buy' | 'sell' | 'hold' {
  // 볼린저 밴드 시그널 계산 로직을 여기에 구현합니다.
  return 'hold'; // 예시 반환값
}

function calculateUpperBand(prices: number[], period: number = 20, stdDevMultiplier: number = 2): number {
  const movingAverage = calculateMA(prices, period).slice(-1)[0];
  const stdDev = calculateStandardDeviation(prices.slice(-period));
  return movingAverage + (stdDev * stdDevMultiplier);
}

function calculateLowerBand(prices: number[], period: number = 20, stdDevMultiplier: number = 2): number {
  const movingAverage = calculateMA(prices, period).slice(-1)[0];
  const stdDev = calculateStandardDeviation(prices.slice(-period));
  return movingAverage - (stdDev * stdDevMultiplier);
}

function calculateStandardDeviation(prices: number[]): number {
  const mean = prices.reduce((a, b) => a + b, 0) / prices.length;
  const variance = prices.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / prices.length;
  return Math.sqrt(variance);
} 