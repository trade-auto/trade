import { Time } from 'lightweight-charts';

export interface Candle {
  time: Time;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface ExtendedCandlestickData extends Candle {
  // 추가 프로퍼티가 필요하면 여기에 작성
} 