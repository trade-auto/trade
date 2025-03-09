import { CandlestickData, Time } from 'lightweight-charts';

// 전략 유형 정의
export type TradeStrategy = 'BOLLINGER' | 'MA_CROSS' | 'MA_CROSS_DEVIATION' | 'SLOPE_FILTER';

// 포지션 유형 정의
export type PositionType = 'buy' | 'sell' | null;

// 이동평균선 타입 정의
export interface MAType {
  thirty: number;
  forty: number;
  sixty: number;
  oneTwenty: number;
  twoForty: number;
  threeHundredSixty: number;
  threeHundred: number;
  nineHundred: number;
}

// 확장 메타데이터 인터페이스
export interface ExtendedMetadata {
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

// 트레이드 신호 타입
export interface TradeSignal {
  id: string;               // 고유 트레이드 ID
  time: number;
  position: PositionType;   // 포지션 타입
  price: number;
  amount?: number;          // 거래 수량 (선택사항)
  strategy: TradeStrategy;
  reason?: string;          // 신호 발생 이유
  metadata?: ExtendedMetadata;
  relatedTradeId?: string;  // 관련 거래 ID (페어링용)
}

// 트레이드 인터페이스
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

// 진입 규칙 인터페이스
export interface EntryRules {
  shouldLong: (data: CandlestickData<Time>[], index: number) => boolean;  // 롱 진입 조건
  shouldShort?: (data: CandlestickData<Time>[], index: number) => boolean; // 숏 진입 조건 (선택사항)
}

// 청산 규칙 인터페이스
export interface ExitRules {
  shouldExitLong: (data: CandlestickData<Time>[], index: number, entryPrice: number) => boolean;  // 롱 청산 조건
  shouldExitShort?: (data: CandlestickData<Time>[], index: number, entryPrice: number) => boolean; // 숏 청산 조건 (선택사항)
}

// 리스크 관리 인터페이스
export interface RiskManagement {
  stopLossPercent?: number;      // 손절매 비율 (%)
  takeProfitPercent?: number;    // 익절 비율 (%)
  trailingStopPercent?: number;  // 트레일링 스탑 비율 (%)
  maxDrawdownPercent?: number;   // 최대 손실 허용 비율 (%)
  positionSizePercent?: number;  // 포지션 크기 비율 (%)
  maxOpenTrades?: number;        // 최대 동시 거래 수
}

// 지표 설정 인터페이스
export interface IndicatorSettings {
  maPeriods?: { short: number; long: number; };  // MA 기간 설정
  bollinger?: { period: number; stdDev: number; };  // 볼린저 밴드 설정
  rsi?: { period: number; overbought: number; oversold: number; };  // RSI 설정
  macd?: { fast: number; slow: number; signal: number; };  // MACD 설정
  customIndicators?: Record<string, any>;  // 사용자 정의 지표
}

// 분석 결과 인터페이스 추가
export interface AnalysisResult {
  signals: TradeSignal[];
  lastProcessedIndex: number;
  currentPosition: 'buy' | null;
  lastTradeId: string | null;
  entryPrice?: number;
}

// 분석 옵션 인터페이스 추가
export interface AnalyzeOptions {
  realtime?: boolean;
  lastProcessedIndex?: number;
  currentPosition?: 'buy' | null;
  lastTradeId?: string | null;
  entryPrice?: number;
}

// 트레이딩 전략 인터페이스
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
  analyze: (data: CandlestickData<Time>[], options?: AnalyzeOptions) => AnalysisResult;
  
  // 새로운 분석 함수 (개별 컴포넌트별로 분리)
  analyzeEntry?: (data: CandlestickData<Time>[], index: number) => 'buy' | null;
  analyzeExit?: (data: CandlestickData<Time>[], index: number, position: 'buy', entryPrice: number) => boolean;
  
  // 포지션 크기 계산
  calculatePositionSize?: (data: CandlestickData<Time>[], index: number, availableBalance: number) => number;
  
  // 지표 계산 함수
  calculateIndicators?: (data: CandlestickData<Time>[], index: number) => ExtendedMetadata;
  
  // 백테스트 결과 분석 및 시각화 메서드
  analyzeBacktestResults?: (trades: Trade[]) => Record<string, any>;
  visualizeStrategy?: (data: CandlestickData<Time>[], trades: Trade[]) => Record<string, any[]>;
}

// 볼린저 전략 인터페이스 (롱 포지션만 사용)
export interface BollingerStrategy extends Omit<TradingStrategy, 'analyzeEntry' | 'analyzeExit'> {
  analyzeEntry?: (data: CandlestickData<Time>[], index: number) => 'buy' | null;
  analyzeExit?: (data: CandlestickData<Time>[], index: number, position: 'buy', entryPrice: number) => boolean;
} 