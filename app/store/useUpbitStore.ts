import { create } from 'zustand';
import { format } from 'date-fns';
import { DateRange } from '../types/candlestick';
import { CandlestickData, Time } from 'lightweight-charts';
import { useCallback } from 'react';

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
  buyLimitMark?: {
    time: string;
    reason: string;
  };
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
  ma60Slope?: number;
  ma120Slope?: number;
  ma240Slope?: number;
  upperBand?: number;
  lowerBand?: number;
  isAbove360MA?: boolean;
  isAbove900MA?: boolean;
  ma120UpCount?: number;
  ma240UpCount?: number;
  ma900UpCount?: number;
  isMA120240Upward?: boolean;
  isMA900Upward?: boolean;
  isAbove120?: boolean;
  isAbove240?: boolean;
  ma60Above120Count?: number;
  ma60Above240Count?: number;
  ma120DownCount?: number;
  ma240DownCount?: number;
  ma900DownCount?: number;
  isMA120240Downward?: boolean;
  isMA900Downward?: boolean;
  isBelow120?: boolean;
  isBelow240?: boolean;
  ma60Below120Count?: number;
  ma60Below240Count?: number;
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
  
  // 기존 분석 함수
  analyze: (data: CandlestickData<Time>[]) => TradeSignal[];
  
  // 새로운 분석 함수 (개별 컴포넌트별로 분리)
  analyzeEntry?: (data: CandlestickData<Time>[], index: number) => 'long' | 'short' | null;
  analyzeExit?: (data: CandlestickData<Time>[], index: number, position: 'long' | 'short', entryPrice: number) => boolean;
  
  // 포지션 크기 계산
  calculatePositionSize?: (data: CandlestickData<Time>[], index: number, availableBalance: number) => number;
  
  // 지표 계산 함수
  calculateIndicators?: (data: CandlestickData<Time>[], index: number) => ExtendedMetadata;
  
  // 백테스트 결과 분석 및 시각화 메서드
  analyzeBacktestResults?: (trades: Trade[]) => Record<string, any>;
  visualizeStrategy?: (data: CandlestickData<Time>[], trades: Trade[]) => Record<string, any[]>;
}

// 볼린저 밴드 전략 (확장)
const bollingerStrategy: TradingStrategy = {
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
    if (index < 360) return null;

    const store = useUpbitStore.getState();
    const { lastTradeType, isTrading } = store.tradeState;
    
    // 이미 매수 포지션이 있거나 거래 중인 경우 매수 신호를 발생시키지 않음
    if (lastTradeType === 'bid' || isTrading) {
      console.log('❌ 매수 제한:', {
        '이유': lastTradeType === 'bid' ? '이미 매수 포지션 존재' : '거래 진행 중',
        '현재 거래 상태': isTrading ? '거래중' : '대기중',
        '마지막 거래 유형': lastTradeType
      });
      return null;
    }
    
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

    // MA120/240 상향 지속 기간 체크 (10봉 기준)
    let ma120UpCount = 0;
    let ma240UpCount = 0;
    let ma60Above120Count = 0;
    let ma60Above240Count = 0;
    let ma900UpCount = 0;

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
      if (currentMa900 > prevMa900Check) ma900UpCount++;
    }

    // MA 기울기 상향 조건 (10봉 연속 상향인 경우)
    const isMA120240Upward = ma120UpCount >= 10 && ma240UpCount >= 10;
    const isMA900Upward = ma900UpCount >= 10;

    // 60MA가 120MA와 240MA보다 위에 있는지 확인
    const isAbove120 = ma60 > ma120;
    const isAbove240 = ma60 > ma240;

    // 현재 가격
    const currentPrice = data[index].close;

    console.log('\n=== 볼린저 매수 신호 상세 분석 ===');
    console.log('현재 시간:', new Date().toLocaleString('ko-KR'));
    console.log('현재 가격:', currentPrice.toLocaleString('ko-KR') + '원');
    console.log('현재 거래 상태:', {
      '마지막 거래 유형': lastTradeType,
      '매수 가능 여부': lastTradeType === 'ask' || lastTradeType === null ? '✅' : '❌'
    });
    
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
      '4. MA900 상향(10봉)': isMA900Upward ? '✅' : '❌'
    });
    
    console.log('\n매수 조건 충족 여부:');
    console.log({
      '조건 1 (MA240 상향 5봉 이상)': ma240UpCount >= 5 ? '✅' : '❌',
      '조건 2 (MA60 > MA120)': isAbove120 ? '✅' : '❌',
      '조건 3 (MA60 > MA240)': isAbove240 ? '✅' : '❌',
      '조건 4 (MA900 상향 10봉)': isMA900Upward ? '✅' : '❌',
      '최종 판정': (ma240UpCount >= 5 && isAbove120 && isAbove240 && isMA900Upward) ? '✅ 매수 신호 발생!' : '❌ 매수 조건 불충족'
    });

    // 매수 시그널 생성
    if (ma240UpCount >= 5 && isAbove120 && isAbove240 && isMA900Upward) {
      console.log('\n=== ✅ 매수 조건 충족! ===');
      return 'long';
    }
    
    // 완화된 매수 조건 추가 (MA900 상향 조건 제외)
    if (ma240UpCount >= 3 && isAbove120 && isAbove240) {
      console.log('\n=== ✅ 완화된 매수 조건 충족! ===');
      console.log('완화된 조건: MA900 상향 조건 제외, MA240 상향 3봉 이상');
      return 'long';
    }
    
    console.log('\n=== ❌ 매수 조건 불충족 ===');
    return null;
  },
  
  // 청산 조건 분석
  analyzeExit(data, index, position, entryPrice) {
    if (index < 360 || position !== 'long') return false;

    const store = useUpbitStore.getState();
    const lastTradeType = store.tradeState.lastTradeType;
    const lastBuyTime = store.tradeState.statusChangeTime;
let ma900UpCount = 0; 
    // 마지막 거래가 매수가 아니면 매도하지 않음
    if (lastTradeType !== 'bid') {
      console.log('❌ 매도 제한: 이전 거래가 매수가 아님');
      return false;
    }

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
      if (currentMa900 > prevMa900Check) ma900UpCount++; // 이 줄을 추가하세요
    }

    // MA 기울기 하향 조건 (10봉 연속 하향인 경우)
    const isMA120240Downward = ma120DownCount >= 10 && ma240DownCount >= 10;
    const isMA900Downward = ma900DownCount >= 10;
    const isMA900Upward = ma900UpCount >= 10; // 이 줄을 추가하세요

    // 60MA가 120MA와 240MA보다 아래에 있는지 확인
    const isBelow120 = ma60 < ma120;
    const isBelow240 = ma60 < ma240;

    console.log('\n=== 매도 신호 분석 ===');
    console.log('현재 거래 상태:', {
      '마지막 거래 유형': lastTradeType,
      '매도 가능 여부': lastTradeType === 'bid',
      '마지막 매수 시간': new Date(lastBuyTime).toLocaleString('ko-KR', {
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
      'MA60이 MA240 아래': isBelow240
    });

    // 매도 시그널 생성
    if (ma240DownCount >= 5 && isBelow120 && isBelow240 && isMA900Upward) {
      console.log('\n=== 매도 조건 충족 여부 ===');
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
        'MA120/240 하향(10봉)': isMA120240Downward ? '✅' : '❌',
        'MA60이 MA120 아래': isBelow120 ? '✅' : '❌',
        'MA60이 MA240 아래': isBelow240 ? '✅' : '❌',
        'MA900 상향': isMA900Upward ? '✅' : '❌',
        '최종 판정': '✅ 매도 신호 발생!'
      });
      return true;
    }

    console.log('\n=== 매도 조건 충족 여부 ===');
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
      'MA120/240 하향(10봉)': isMA120240Downward ? '✅' : '❌',
      'MA60이 MA120 아래': isBelow120 ? '✅' : '❌',
      'MA60이 MA240 아래': isBelow240 ? '✅' : '❌',
      'MA900 상향': isMA900Upward ? '✅' : '❌',
      '최종 판정': '❌ 매도 조건 불충족'
    });
    return false;
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

    // MA 상향/하향 지속 기간 체크 (10봉 기준)
    let ma120UpCount = 0;
    let ma240UpCount = 0;
    let ma900UpCount = 0;
    let ma60Above120Count = 0;
    let ma60Above240Count = 0;
    
    let ma120DownCount = 0;
    let ma240DownCount = 0;
    let ma900DownCount = 0;
    let ma60Below120Count = 0;
    let ma60Below240Count = 0;

    for (let i = 0; i < 10; i++) {
      const currentMa60 = data.slice(index - i - 60, index - i).reduce((a, b) => a + b.close, 0) / 60;
      const prevMa60Check = data.slice(index - i - 61, index - i - 1).reduce((a, b) => a + b.close, 0) / 60;
      const currentMa120 = data.slice(index - i - 120, index - i).reduce((a, b) => a + b.close, 0) / 120;
      const prevMa120Check = data.slice(index - i - 121, index - i - 1).reduce((a, b) => a + b.close, 0) / 120;
      const currentMa240 = data.slice(index - i - 240, index - i).reduce((a, b) => a + b.close, 0) / 240;
      const prevMa240Check = data.slice(index - i - 241, index - i - 1).reduce((a, b) => a + b.close, 0) / 240;
      const currentMa900 = data.slice(index - i - 900, index - i).reduce((a, b) => a + b.close, 0) / 900;
      const prevMa900Check = data.slice(index - i - 901, index - i - 1).reduce((a, b) => a + b.close, 0) / 900;

      // 상향 카운트
      if (currentMa120 > prevMa120Check) ma120UpCount++;
      if (currentMa240 > prevMa240Check) ma240UpCount++;
      if (currentMa900 > prevMa900Check) ma900UpCount++;
      if (currentMa60 > currentMa120) ma60Above120Count++;
      if (currentMa60 > currentMa240) ma60Above240Count++;
      
      // 하향 카운트
      if (currentMa120 < prevMa120Check) ma120DownCount++;
      if (currentMa240 < prevMa240Check) ma240DownCount++;
      if (currentMa900 < prevMa900Check) ma900DownCount++;
      if (currentMa60 < currentMa120) ma60Below120Count++;
      if (currentMa60 < currentMa240) ma60Below240Count++;
    }

    // 조건 판정
    const isMA120240Upward = ma120UpCount >= 10 && ma240UpCount >= 10;
    const isMA900Upward = ma900UpCount >= 10;
    const isAbove120 = ma60 > ma120;
    const isAbove240 = ma60 > ma240;
    
    const isMA120240Downward = ma120DownCount >= 10 && ma240DownCount >= 10;
    const isMA900Downward = ma900DownCount >= 10;
    const isBelow120 = ma60 < ma120;
    const isBelow240 = ma60 < ma240;
    
    const metadata: ExtendedMetadata = {
      ma30: 0,
      ma60,
      ma120,
      ma240,
      ma900,
      ma60Slope,
      ma120Slope,
      ma240Slope,
      ma900Slope,
      ma120UpCount,
      ma240UpCount,
      ma900UpCount,
      ma60Above120Count,
      ma60Above240Count,
      isMA120240Upward,
      isMA900Upward,
      isAbove120,
      isAbove240,
      ma120DownCount,
      ma240DownCount,
      ma900DownCount,
      ma60Below120Count,
      ma60Below240Count,
      isMA120240Downward,
      isMA900Downward,
      isBelow120,
      isBelow240
    };
    
    return metadata;
  },
  
  // 기존 analyze 함수는 새로운 함수들을 활용
  analyze(data) {
    const signals: TradeSignal[] = [];
    const store = useUpbitStore.getState();
    const { lastTradeType } = store.tradeState;
    
    // 마지막 거래 유형에 따라 현재 포지션 설정
    // 'bid'(매수)인 경우 'long', 'ask'(매도)인 경우 null로 설정
    let currentPosition = lastTradeType === 'bid' ? 'long' : null;
    
    console.log('\n=== 전략 분석 시작 ===');
    console.log('초기 포지션 설정:', {
      '마지막 거래 유형': lastTradeType === 'bid' ? '매수' : 
                        lastTradeType === 'ask' ? '매도' : '없음',
      '현재 포지션': currentPosition === 'long' ? '롱' : '없음',
      '매수 신호 검사 가능 여부': currentPosition === null ? '✅' : '❌'
    });
    
    let lastTradeId: string | null = null;
    
    if (data.length < 360) {
      return signals;
    }
    
    const self = this;

    for (let i = 360; i < data.length; i++) {
      // 현재 포지션이 없는 경우에만 매수 신호 확인
      if (currentPosition === null) {
        // 매수 조건 검사 전 로그 출력
        console.log('\n=== 매수 조건 검사 시작 ===');
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
          '현재 포지션': currentPosition === null ? '없음' : currentPosition,
          '마지막 거래 유형': lastTradeType === 'bid' ? '매수' : 
                           lastTradeType === 'ask' ? '매도' : '없음'
        });
        
        const entrySignal = self.analyzeEntry?.(data, i);
        
        if (entrySignal === 'long') {
          console.log('\n=== 🔔 매수 신호 감지! ===');
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
            '매수 신호 유형': entrySignal,
            '현재 가격': data[i].close
          });
          
          // 매수 신호 생성
          const tradeId = `trade-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
          signals.push({
            id: tradeId,
            time: data[i].time as number,
            position: 'long',
            price: data[i].close,
            strategy: 'BOLLINGER',
            reason: '매수 조건 충족',
            metadata: {
              ...self.calculateIndicators?.(data, i),
              ma120UpCount: self.calculateIndicators?.(data, i)?.ma120UpCount,
              ma240UpCount: self.calculateIndicators?.(data, i)?.ma240UpCount,
              ma900UpCount: self.calculateIndicators?.(data, i)?.ma900UpCount,
              ma60Above120Count: self.calculateIndicators?.(data, i)?.ma60Above120Count,
              ma60Above240Count: self.calculateIndicators?.(data, i)?.ma60Above240Count,
              isMA120240Upward: self.calculateIndicators?.(data, i)?.isMA120240Upward,
              isMA900Upward: self.calculateIndicators?.(data, i)?.isMA900Upward,
              isAbove120: self.calculateIndicators?.(data, i)?.isAbove120,
              isAbove240: self.calculateIndicators?.(data, i)?.isAbove240
            }
          });
          
          lastTradeId = tradeId;
          currentPosition = 'long';
          
          // 매수 신호 생성 시 tradeState 업데이트
          store.updateTradeState({
            lastTradeType: 'bid',
            statusChangeTime: new Date().toISOString(),
            isTrading: false
          });
          
          console.log('\n=== ✅ 매수 마커 생성 완료 ===');
          console.log({
            '체크 시간': new Date().toLocaleString('ko-KR', {
              year: 'numeric',
              month: '2-digit',
              day: '2-digit',
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
              hour12: false
            })
          });
          continue; // 매수 신호가 발생하면 매도 조건을 확인하지 않고 다음 캔들로 이동
        } else {
          console.log('❌ 매수 신호 없음');
        }
      } 
      // 현재 롱 포지션인 경우에만 매도 신호 확인
      else if (currentPosition === 'long' && lastTradeId) {
        // 매도 조건 검사 전 로그 출력
        console.log('\n=== 매도 조건 검사 시작 ===');
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
          '현재 포지션': currentPosition,
          '마지막 거래 유형': lastTradeType === 'bid' ? '매수' : 
                           lastTradeType === 'ask' ? '매도' : '없음',
          '마지막 거래 ID': lastTradeId
        });
        
        const entrySignalIndex = signals.findIndex(signal => signal.id === lastTradeId);
        
        if (entrySignalIndex >= 0) {
          const entryPrice = signals[entrySignalIndex].price;
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
              metadata: {
                ...self.calculateIndicators?.(data, i),
                ma120DownCount: self.calculateIndicators?.(data, i)?.ma120DownCount,
                ma240DownCount: self.calculateIndicators?.(data, i)?.ma240DownCount,
                ma900DownCount: self.calculateIndicators?.(data, i)?.ma900DownCount,
                ma60Below120Count: self.calculateIndicators?.(data, i)?.ma60Below120Count,
                ma60Below240Count: self.calculateIndicators?.(data, i)?.ma60Below240Count,
                isMA120240Downward: self.calculateIndicators?.(data, i)?.isMA120240Downward,
                isMA900Downward: self.calculateIndicators?.(data, i)?.isMA900Downward,
                isBelow120: self.calculateIndicators?.(data, i)?.isBelow120,
                isBelow240: self.calculateIndicators?.(data, i)?.isBelow240
              },
              relatedTradeId: lastTradeId
            });
            
            // 매도 신호 생성 시 tradeState 업데이트
          store.updateTradeState({
            lastTradeType: 'ask',
            statusChangeTime: new Date().toISOString(),
            isTrading: false
          });
          
            console.log('✅ 매도 신호 생성:', {
              시간: new Date(data[i].time as number).toLocaleString('ko-KR'),
              가격: data[i].close.toLocaleString('ko-KR') + '원',
              '이전 포지션': currentPosition,
              '매수가': entryPrice.toLocaleString('ko-KR') + '원',
              '수익률': ((data[i].close / entryPrice - 1) * 100).toFixed(2) + '%',
              '거래 ID': exitTradeId,
              '관련 매수 ID': lastTradeId
            });
            
            // 매도 조건 상세 정보 로그
            const indicators = self.calculateIndicators?.(data, i);
            console.log('매도 조건 상세:', {
              'MA240 하향 지속 봉수': indicators?.ma240DownCount + '봉',
              'MA900 하향 지속 봉수': indicators?.ma900DownCount + '봉',
              'MA60이 MA120 아래 지속 봉수': indicators?.ma60Below120Count + '봉',
              'MA60이 MA240 아래 지속 봉수': indicators?.ma60Below240Count + '봉',
              'MA120/240 하향(10봉)': indicators?.isMA120240Downward ? '✅' : '❌',
              'MA900 하향': indicators?.isMA900Downward ? '✅' : '❌',
              'MA60이 MA120 아래': indicators?.isBelow120 ? '✅' : '❌',
              'MA60이 MA240 아래': indicators?.isBelow240 ? '✅' : '❌',
              '체크 시간': new Date().toLocaleString('ko-KR', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                hour12: false
              })
            });
            
            // 매도 신호 생성 후 즉시 포지션과 거래 ID 초기화
            currentPosition = null;
            // store 상태 업데이트
            store.updateTradeState({
              lastTradeType: 'ask',
              statusChangeTime: new Date().toISOString(),
              isTrading: false
            });
            
            console.log('✅ 매도 후 상태 초기화 완료:', {
              '현재 포지션': currentPosition,
              '다음 매수 준비': '완료'
            });
            lastTradeId = null;
            continue; // 현재 캔들에서 매도 신호를 생성한 후 다음 캔들로 이동
          }
        }
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

// MA 크로스 전략 (확장)
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
  
  // 진입 조건 분석
  analyzeEntry(data, index) {
    if (index < 60) return null; // 충분한 데이터 확보
    
    const shortPeriod = 30;
    const longPeriod = 60;
    
    const shortMA = data.slice(index - shortPeriod, index).reduce((a, b) => a + b.close, 0) / shortPeriod;
    const longMA = data.slice(index - longPeriod, index).reduce((a, b) => a + b.close, 0) / longPeriod;
    const prevShortMA = data.slice(index - shortPeriod - 1, index - 1).reduce((a, b) => a + b.close, 0) / shortPeriod;
    const prevLongMA = data.slice(index - longPeriod - 1, index - 1).reduce((a, b) => a + b.close, 0) / longPeriod;
    
    if (prevShortMA <= prevLongMA && shortMA > longMA) {
      return 'long';
    }
    
    return null;
  },
  
  // 청산 조건 분석
  analyzeExit(data, index, position, entryPrice) {
    if (index < 60 || position !== 'long') return false; // 충분한 데이터 확보 및 롱 포지션 확인
    //let ma900UpCount = 0; // 이 줄을 추가하세요
    const shortPeriod = 30;
    const longPeriod = 60;
    
    const shortMA = data.slice(index - shortPeriod, index).reduce((a, b) => a + b.close, 0) / shortPeriod;
    const longMA = data.slice(index - longPeriod, index).reduce((a, b) => a + b.close, 0) / longPeriod;
    const prevShortMA = data.slice(index - shortPeriod - 1, index - 1).reduce((a, b) => a + b.close, 0) / shortPeriod;
    const prevLongMA = data.slice(index - longPeriod - 1, index - 1).reduce((a, b) => a + b.close, 0) / longPeriod;
    
    // 단기 이동평균이 장기 이동평균을 하향 돌파하면 청산
    return (prevShortMA >= prevLongMA && shortMA < longMA);
  },
  
  // 지표 계산 함수
  calculateIndicators(data, index) {
    if (index < 60) {
      return {} as ExtendedMetadata;
    }
    
    const shortPeriod = 30;
    const longPeriod = 60;
    
    const shortMA = data.slice(index - shortPeriod, index).reduce((a, b) => a + b.close, 0) / shortPeriod;
    const longMA = data.slice(index - longPeriod, index).reduce((a, b) => a + b.close, 0) / longPeriod;
    
    const metadata: ExtendedMetadata = {
      ma30: shortMA,
      ma60: longMA
    };
    
    return metadata;
  },
  
  // 기존 analyze 함수는 새로운 함수들을 활용
  analyze(data) {
    const signals: TradeSignal[] = [];
    const shortPeriod = 30;
    const longPeriod = 60;
    let currentPosition: 'long' | null = null; // 'short' 제거하고 'long' 또는 null만 사용
    let lastTradeId: string | null = null;
    
    if (data.length < longPeriod) {
      return signals;
    }
    
    const self = this; // this 컨텍스트 저장

    for (let i = longPeriod; i < data.length; i++) {
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
            strategy: 'MA_CROSS',
            reason: '단기 이동평균선이 장기 이동평균선을 상향 돌파',
            metadata: self.calculateIndicators?.(data, i)
          });
          currentPosition = 'long';
          lastTradeId = tradeId;
          console.log('✅ 매수 신호 생성:', {
            시간: new Date(data[i].time as number).toLocaleString('ko-KR'),
            가격: data[i].close.toLocaleString('ko-KR') + '원',
            '현재 포지션': currentPosition,
            '거래 ID': tradeId
          });
        }
      } else if (currentPosition === 'long') {
        // 마지막 롱 진입 신호의 인덱스 찾기
        const entrySignalIndex = signals.findIndex(signal => 
          signal.id === lastTradeId && signal.position === 'long');
        
        if (entrySignalIndex >= 0) {
          const entryPrice = signals[entrySignalIndex].price;
          const shouldExit = self.analyzeExit?.(data, i, 'long', entryPrice);
          
          if (shouldExit) {
            const exitTradeId = `trade-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
            signals.push({
              id: exitTradeId,
              time: data[i].time as number,
              position: 'close',
              price: data[i].close,
              strategy: 'MA_CROSS',
              reason: '단기 이동평균선이 장기 이동평균선을 하향 돌파',
              relatedTradeId: lastTradeId || undefined,
              metadata: self.calculateIndicators?.(data, i)
            });
            currentPosition = null; // 'short'에서 null로 변경
            lastTradeId = null;
            console.log('✅ 매도 신호 생성:', {
              시간: new Date(data[i].time as number).toLocaleString('ko-KR'),
              가격: data[i].close.toLocaleString('ko-KR') + '원',
              '이전 포지션': 'long',
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
    
    return signals;
  }
};

// 이격도 MA 이탈
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
    console.log('=== 디버깅 정보 ===');
    console.log('데이터 길이:', data.length);
    console.log('현재 포지션:', currentPosition);
    console.log('데이터 인덱스:', index);
    
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
      return 'long';
    }
    
    return null;
  },
  
  // 청산 조건 분석 - 단순화
  analyzeExit(data, index, position, entryPrice) {
    if (index < 900 || position !== 'long') return false;
    
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
    
    // 첫 번째 매도인 경우
    if (isFirstTrade) {
        if (downward60_300) {
            isFirstTrade = false;
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
  analyze(data) {
    const signals: TradeSignal[] = [];
    let currentPosition: 'long' | null = null;
    let lastTradeId: string | null = null;
    
    // 충분한 데이터가 있는지 확인
    if (data.length < 240) {
      return signals;
    }
    
    const self = this; // this 컨텍스트 저장
    
    // 각 봉마다 분석 (240MA 기준으로 시작)
    for (let i = 240; i < data.length; i++) {
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
            strategy: 'MA_CROSS_DEVIATION',
            reason: '이동평균선 교차 및 이격도 조건 충족',
            metadata: self.calculateIndicators?.(data, i)
          });
          currentPosition = 'long';
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
      else if (currentPosition === 'long') {
        // 마지막 롱 진입 신호의 인덱스 찾기
        const entrySignalIndex = signals.findIndex(signal => 
          signal.id === lastTradeId && signal.position === 'long');
        
        if (entrySignalIndex >= 0) {
          const entryPrice = signals[entrySignalIndex].price;
          const shouldExit = self.analyzeExit?.(data, i, 'long', entryPrice);
          
          if (shouldExit) {
            const exitTradeId = `trade-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
            signals.push({
              id: exitTradeId,
              time: data[i].time as number,
              position: 'close',
              price: data[i].close,
              strategy: 'MA_CROSS_DEVIATION',
              reason: '이동평균선 하향 돌파 또는 추세 붕괴',
              relatedTradeId: lastTradeId || undefined,
              metadata: self.calculateIndicators?.(data, i)
            });
            currentPosition = null; // 'short'에서 null로 변경
            lastTradeId = null;
            console.log('✅ 매도 신호 생성 (MA_CROSS_DEVIATION):', {
              시간: new Date(data[i].time as number).toLocaleString('ko-KR'),
              가격: data[i].close.toLocaleString('ko-KR') + '원',
              '이전 포지션': 'long',
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
    
    return signals;
  }
};

// 기울기 필터 전략
const slopeFilterStrategy: TradingStrategy = {
  name: 'SLOPE_FILTER',
  timeframe: '1m',
  description: '통합 기술적 분석 전략 (MA/MACD/RSI/BB)',
  author: 'System',
  version: '1.0.0',
  tags: ['trend', 'momentum', 'oscillator'],
  
  indicators: {
    maPeriods: { short: 60, long: 120 },
    bollinger: { period: 20, stdDev: 2 },
    rsi: { period: 14, overbought: 70, oversold: 30 },
    macd: { fast: 12, slow: 26, signal: 9 }
  },
  
  // 진입 조건 분석
  analyzeEntry(data, index) {
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
    
    // 최소 필요 데이터 포인트 확인
    const minDataPoints = Math.max(ma900Period, rsiPeriod, macdSlow + macdSignal);
    if (index < minDataPoints) return null;
    
    const prices = data.slice(0, index + 1).map(d => d.close);
    
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
    const emaFast = calculateEMA(data.slice(0, index + 1), macdFast).slice(-1)[0]?.value || 0;
    const emaSlow = calculateEMA(data.slice(0, index + 1), macdSlow).slice(-1)[0]?.value || 0;
    const macd = emaFast - emaSlow;
    const macdSignalLine = calculateEMA(
      data.slice(0, index + 1).map(d => createTempCandleData(d.time, 
        calculateEMA([createTempCandleData(d.time, d.close)], macdFast)[0]?.value - 
        calculateEMA([createTempCandleData(d.time, d.close)], macdSlow)[0]?.value || 0
      )),
      macdSignal
    ).slice(-1)[0]?.value || 0;
    const macdHistogram = macd - macdSignalLine;
    const prevMacdHistogram = calculateEMA(
      data.slice(0, index).map(d => createTempCandleData(d.time,
        calculateEMA([createTempCandleData(d.time, d.close)], macdFast)[0]?.value -
        calculateEMA([createTempCandleData(d.time, d.close)], macdSlow)[0]?.value || 0
      )),
      macdSignal
    ).slice(-1)[0]?.value || 0;
    
    // RSI 계산
    const rsi = calculateRSI(prices);
    const prevRsi = index > 0 ? calculateRSI(prices.slice(0, -1)) : rsi;
    
    // 볼린저 밴드 계산
    const bbandsSlice = prices.slice(-bbandsLength);
    const bbandsMA = bbandsSlice.reduce((a, b) => a + b, 0) / bbandsLength;
    const bbandsStd = Math.sqrt(
      bbandsSlice.reduce((a, b) => a + Math.pow(b - bbandsMA, 2), 0) / bbandsLength
    );
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
      data[index].close <= lowerBand;
    
    if (isLongCondition) {
      return 'long';
    }
    
    return null;
  },
  
  // 청산 조건 분석
  analyzeExit(data, index, position, entryPrice) {
    if (position !== 'long' || index < 900) return false;
    
    // 기본 파라미터 설정
    const ma60Period = 60;
    const ma120Period = 120;
    const ma240Period = 240;
    const rsiPeriod = 14;
    const macdFast = 12;
    const macdSlow = 26;
    const macdSignal = 9;
    const bbandsLength = 20;
    const bbandsStdDev = 2;
    
    const prices = data.slice(0, index + 1).map(d => d.close);
    
    // 이동평균선 계산
    const ma60 = prices.slice(-ma60Period).reduce((a, b) => a + b, 0) / ma60Period;
    const ma120 = prices.slice(-ma120Period).reduce((a, b) => a + b, 0) / ma120Period;
    const ma240 = prices.slice(-ma240Period).reduce((a, b) => a + b, 0) / ma240Period;
    
    // 이전 이동평균선 계산 (교차 확인용)
    const prevMa60 = prices.slice(-ma60Period-1, -1).reduce((a, b) => a + b, 0) / ma60Period;
    const prevMa120 = prices.slice(-ma120Period-1, -1).reduce((a, b) => a + b, 0) / ma120Period;
    
    // MACD 계산
    const emaFast = calculateEMA(data.slice(0, index + 1), macdFast).slice(-1)[0]?.value || 0;
    const emaSlow = calculateEMA(data.slice(0, index + 1), macdSlow).slice(-1)[0]?.value || 0;
    const macd = emaFast - emaSlow;
    const macdSignalLine = calculateEMA(
      data.slice(0, index + 1).map(d => createTempCandleData(d.time, 
        calculateEMA([createTempCandleData(d.time, d.close)], macdFast)[0]?.value - 
        calculateEMA([createTempCandleData(d.time, d.close)], macdSlow)[0]?.value || 0
      )),
      macdSignal
    ).slice(-1)[0]?.value || 0;
    const macdHistogram = macd - macdSignalLine;
    const prevMacdHistogram = calculateEMA(
      data.slice(0, index).map(d => createTempCandleData(d.time,
        calculateEMA([createTempCandleData(d.time, d.close)], macdFast)[0]?.value -
        calculateEMA([createTempCandleData(d.time, d.close)], macdSlow)[0]?.value || 0
      )),
      macdSignal
    ).slice(-1)[0]?.value || 0;
    
    // RSI 계산
    const rsi = calculateRSI(prices);
    
    // 볼린저 밴드 계산
    const bbandsSlice = prices.slice(-bbandsLength);
    const bbandsMA = bbandsSlice.reduce((a, b) => a + b, 0) / bbandsLength;
    const bbandsStd = Math.sqrt(
      bbandsSlice.reduce((a, b) => a + Math.pow(b - bbandsMA, 2), 0) / bbandsLength
    );
    const upperBand = bbandsMA + (bbandsStdDev * bbandsStd);
    
    // 손절매/익절 조건
    const stopLossTriggered = (data[index].close / entryPrice - 1) <= -this.riskManagement?.stopLossPercent! / 100;
    const takeProfitTriggered = (data[index].close / entryPrice - 1) >= this.riskManagement?.takeProfitPercent! / 100;
    
    // 매도 조건 확인
    const isShortCondition = 
      // 이동평균선 정렬 붕괴 또는 하향 돌파
      (ma60 < ma120 || ma120 < ma240 || prevMa60 >= prevMa120 && ma60 < ma120) ||
      // MACD 조건
      (macdHistogram < 0 && prevMacdHistogram >= 0) || // MACD 하향 돌파
      // RSI 조건
      rsi > 70 ||
      // 볼린저 밴드 조건
      data[index].close >= upperBand;
    
    return isShortCondition || stopLossTriggered || takeProfitTriggered;
  },
  
  // 지표 계산 함수
  calculateIndicators(data, index) {
    if (index < 900) {
      return {} as ExtendedMetadata;
    }
    
    const prices = data.slice(0, index + 1).map(d => d.close);
    
    // 이동평균선 계산
    const ma60 = prices.slice(-60).reduce((a, b) => a + b, 0) / 60;
    const ma120 = prices.slice(-120).reduce((a, b) => a + b, 0) / 120;
    const ma240 = prices.slice(-240).reduce((a, b) => a + b, 0) / 240;
    const ma360 = prices.slice(-360).reduce((a, b) => a + b, 0) / 360;
    
    // MACD 계산
    const macdFast = 12;
    const macdSlow = 26;
    const emaFast = calculateEMA(data.slice(0, index + 1), macdFast).slice(-1)[0]?.value || 0;
    const emaSlow = calculateEMA(data.slice(0, index + 1), macdSlow).slice(-1)[0]?.value || 0;
    const macdValue = emaFast - emaSlow;
    
    // RSI 계산
    const rsiValue = calculateRSI(prices);
    
    const metadata: ExtendedMetadata = {
      ma60,
      ma120,
      ma240,
      ma360,
      deviation: Math.abs(data[index].close - ma60) / ma60,
      isAbove360MA: data[index].close > ma360,
      rsi: rsiValue,
      macd: macdValue
    };
    
    return metadata;
  },
  
  // 기존 분석 함수
  analyze(data) {
    const signals: TradeSignal[] = [];
    let currentPosition: 'long' | null = null;
    let lastTradeId: string | null = null;
    
    // 충분한 데이터가 있는지 확인
    const minDataPoints = 900;
    if (data.length < minDataPoints) {
      return signals;
    }
    
    const self = this; // this 컨텍스트 저장
    
    // 각 봉마다 분석
    for (let i = minDataPoints; i < data.length; i++) {
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
            strategy: 'SLOPE_FILTER',
            reason: '이동평균선 정렬 및 지표 조건 충족',
            metadata: self.calculateIndicators?.(data, i)
          });
          currentPosition = 'long';
          lastTradeId = tradeId;
          console.log('✅ 매수 신호 생성 (SLOPE_FILTER):', {
            시간: new Date(data[i].time as number).toLocaleString('ko-KR'),
            가격: data[i].close.toLocaleString('ko-KR') + '원',
            '현재 포지션': currentPosition,
            '거래 ID': tradeId
          });
        }
      } 
      // 현재 롱 포지션인 경우, 청산 조건 확인
      else if (currentPosition === 'long') {
        // 마지막 롱 진입 신호의 인덱스 찾기
        const entrySignalIndex = signals.findIndex(signal => 
          signal.id === lastTradeId && signal.position === 'long');
        
        if (entrySignalIndex >= 0) {
          const entryPrice = signals[entrySignalIndex].price;
          const shouldExit = self.analyzeExit?.(data, i, 'long', entryPrice);
          
          if (shouldExit) {
            const exitTradeId = `trade-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
            signals.push({
              id: exitTradeId,
              time: data[i].time as number,
              position: 'close',
              price: data[i].close,
              strategy: 'SLOPE_FILTER',
              reason: '기술적 조건 붕괴 또는 한계 도달',
              relatedTradeId: lastTradeId || undefined,
              metadata: self.calculateIndicators?.(data, i)
            });
            currentPosition = null; // 'short'에서 null로 변경
            lastTradeId = null;
            console.log('✅ 매도 신호 생성 (SLOPE_FILTER):', {
              시간: new Date(data[i].time as number).toLocaleString('ko-KR'),
              가격: data[i].close.toLocaleString('ko-KR') + '원',
              '이전 포지션': 'long',
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
    
    return signals;
  }
};

// 전략 맵 정의
const strategies: Record<TradeStrategy, TradingStrategy> = {
  BOLLINGER: bollingerStrategy,
  MA_CROSS: maCrossStrategy,
  MA_CROSS_DEVIATION: maCrossDeviationStrategy,
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
  initializeTrades: () => void;
  resetTradeState: () => void;
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
    statusChangeTime: new Date().toISOString(), // 초기 시간 설정
    currentPrice: 0,
    actionStartTime: null,
    isTrading: false,
    theoreticalPosition: 'wait' as const,
    missedFirstCycle: false
  },

  updateTradeState: (update) => set((state) => {
    const newState = { ...state.tradeState, ...update };
    
    // 거래 상태 변경 시 로그 추가
    if (update.lastTradeType !== undefined) {
      const lastTradeTime = update.statusChangeTime || new Date().toISOString();
      const formattedTime = new Date(lastTradeTime).toLocaleString('ko-KR', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      });

      console.log('\n=== 거래 상태 업데이트 ===');
      console.log('포지션 변경:', {
        '이전 포지션': state.tradeState.lastTradeType === 'bid' ? '매수' : 
                      state.tradeState.lastTradeType === 'ask' ? '매도' : '대기',
        '새 포지션': update.lastTradeType === 'bid' ? '매수' : 
                    update.lastTradeType === 'ask' ? '매도' : '대기',
        '마지막 거래 시간': formattedTime
      });
      console.log('거래 상태:', {
        '거래중': newState.isTrading ? 'O' : 'X',
        '이론적 포지션': newState.theoreticalPosition,
        '첫 사이클 미스': newState.missedFirstCycle ? 'O' : 'X'
      });
      if (update.currentPrice) {
        console.log('가격 정보:', {
          '현재가': update.currentPrice.toLocaleString('ko-KR') + '원',
          '거래 시간': formattedTime
        });
      }
    }
    
    // localStorage에 거래 상태 저장
    if (typeof window !== 'undefined') {
      localStorage.setItem('tradeState', JSON.stringify(newState));
    }
    
    return {
      tradeState: newState
    };
  }),

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

  addTrade: (trade) => set((state) => {
    const newTrades = [...state.trades, trade];
    
    // localStorage에 거래 기록 저장
    if (typeof window !== 'undefined') {
      localStorage.setItem('trades', JSON.stringify(newTrades));
    }
    
    console.log('새로운 거래 추가:', {
      거래ID: trade.id,
      시간: new Date(trade.entryTime).toLocaleString('ko-KR'),
      유형: trade.type
    });
    
    return { trades: newTrades };
  }),

  updateTrade: (tradeId, updates) => set((state) => ({
    trades: state.trades.map(trade =>
      trade.id === tradeId ? { ...trade, ...updates } : trade
    )
  })),

  getOpenTrades: () => get().trades.filter(trade => trade.status === 'open'),

  getClosedTrades: () => get().trades.filter(trade => trade.status === 'closed'),

  // 거래 기록 초기화 함수 추가
  initializeTrades: () => {
    if (typeof window !== 'undefined') {
      const savedTrades = localStorage.getItem('trades');
      const savedTradeState = localStorage.getItem('tradeState');
      
      if (savedTrades) {
        set({ trades: JSON.parse(savedTrades) });
      }
      
      if (savedTradeState) {
        set({ tradeState: JSON.parse(savedTradeState) });
      }
    }
  },

  // 거래 상태 리셋 함수 추가
  resetTradeState: () => {
    const initialState: TradeState = {
      lastTradeType: null,
      statusChangeTime: new Date().toISOString(),
      currentPrice: 0,
      actionStartTime: null,
      isTrading: false,
      theoreticalPosition: 'wait' as const,
      missedFirstCycle: false
    };
    
    set({ tradeState: initialState });
    
    if (typeof window !== 'undefined') {
      localStorage.setItem('tradeState', JSON.stringify(initialState));
    }
  }
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
      currentPosition = 'close';
      return "close";
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

// MA 기울기 계산 함수
function calculateMASlope(data: CandlestickData<Time>[], period: number): number {
  const ma = data.slice(-period-10, -1).map(d => d.close).reduce((a, b) => a + b, 0) / period;
  const currentMA = data.slice(-period).map(d => d.close).reduce((a, b) => a + b, 0) / period;
  return currentMA - ma;
} 

// 첫 매수 여부를 추적하기 위한 변수 추가
let isFirstTrade = true;

const getTimeValue = (time: Time): number => {
    if (typeof time === 'number') return time;
    if (typeof time === 'string') return new Date(time).getTime();
    if ('time' in time) return time.time as number;
    // BusinessDay 타입 처리
    const { year, month, day } = time;
    return new Date(year, month - 1, day).getTime();
};

const preprocessChartData = (data: CandlestickData<Time>[]) => {
    const sortedData = [...data].sort((a, b) => getTimeValue(a.time) - getTimeValue(b.time));
    
    return sortedData.filter((item, index) => 
        index === 0 || getTimeValue(item.time) > getTimeValue(sortedData[index - 1].time)
    );
};

interface CandlestickChartProps {
    importedData: CandlestickData<Time>[];
    backtestCandleSeries: any;
    volumeSeries: any;
}

interface ExtendedCandlestickData extends CandlestickData<Time> {
    volume?: number;
}

const handleBacktestChartReady = ({ importedData, backtestCandleSeries, volumeSeries }: CandlestickChartProps) => {
    if (importedData.length > 0) {
        const processedData = preprocessChartData(importedData as ExtendedCandlestickData[]);
        
        // 차트 데이터 설정 전에 기존 데이터 클리어
        backtestCandleSeries.setData([]);
        volumeSeries.setData([]);
        
        // 약간의 지연 후 새 데이터 설정
        setTimeout(() => {
            // 캔들스틱 데이터 설정
            backtestCandleSeries.setData(processedData);
            
            // 볼륨 데이터 설정
            const volumeData = (processedData as ExtendedCandlestickData[]).map(d => ({
                time: d.time,
                value: d.volume || 0,
                color: (d.close || 0) >= (d.open || 0) ? 'rgba(0, 150, 136, 0.8)' : 'rgba(255, 82, 82, 0.8)'
            }));
            volumeSeries.setData(volumeData);
            
            // 거래 기록 다시 로드
            const store = useUpbitStore.getState();
            store.initializeTrades();
        }, 100);
    }
};
 