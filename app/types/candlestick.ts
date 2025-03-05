import { Time } from 'lightweight-charts';

export interface Candle {
  time: Time;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

// Define a Trade interface
export interface Trade {
  entryTime: Time;
  exitTime: Time;
  entryPrice: number;
  exitPrice: number;
  return: number;
  isSuccess: boolean;
  isAutomatic?: boolean;
  mode: 'test' | 'test-auto' | 'live-auto';  // 'live'를 'live-auto'로 변경
  angles?: {
    entryMa40?: number;
    exitMa40?: number;
    entryMa360?: number;
    exitMa360?: number;
    entryMa120?: number;
    exitMa120?: number;
  };
}

// 날짜 선택을 위한 인터페이스 추가
export interface DateRange {
  startDate: Date;
  endDate: Date | null;
}

// BusinessDay 타입 정의 (일봉, 월봉, 년봉 데이터가 이 형식으로 올 경우)
export interface BusinessDay {
  year: number;
  month: number;
  day: number;
}
export interface ExtendedCandlestickData extends Candle {
  // 추가 프로퍼티가 필요하면 여기에 작성
} 


export interface ChartProps {
  symbol: string;
  chartType: string;
  initialAutoUpdate?: boolean;  // 초기 자동 업데이트 상태를 위한 prop 추가
  mode: 'live' | 'test';  // 추가
  handleOrder: (params: {
    market: string;
    side: 'bid' | 'ask';
    volume: string;
    price: string;
    ord_type: string;
    mode: string;
  }) => Promise<void>;
}

export interface UpbitCandle {
  candle_date_time_kst: string;
  opening_price: number;
  high_price: number;
  low_price: number;
  trade_price: number;
  candle_acc_trade_volume: number;
}

export interface CrossPoint {
  time: Time;
  position: 'buy' | 'sell';
  price: number;
  isAbove360MA: boolean;  // 추가
  slopes: {              // 추가
   // ma40: number;
    ma60: number;
    ma360: number;
    ma120: number;
    ma240: number;
  };
  deviations?: {
    ma120: number;
    ma240: number;
  };
}

export interface BacktestResult {
  totalTrades: number;
  successfulTrades: number;
  totalReturn: number;
  totalNetReturn: number; // 수수료 제외 총 수익률 추가
  successRate: number;
  averageReturn: number;
  averageNetReturn: number; // 수수료 제외 평균 수익률 추가
  trades: Trade[];  // Trade 인터페이스를 사용하도록 변경
}