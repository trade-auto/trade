import {
  Time,
  SeriesMarker,
  LineData,
  BusinessDay,
  UTCTimestamp,
  SeriesMarkerPosition,
  SeriesMarkerShape,
} from 'lightweight-charts';
import { 
  ExtendedCandlestickData, 
  DateRange,
  BacktestResult,
  Trade
} from '../types/candlestick';
import { TradeStrategy, TradeSignal } from '../types/trading';

/**
 * chartType에 따라 초기 날짜 범위를 반환한다.
 * chartType이 "seconds/"이면 최근 10분, "일봉", "월봉", "년봉" 문자열 포함 여부로 처리
 */
export const getInitialDateRange = (type: string): DateRange => {
  const now = new Date();
  let startDate: Date;
  
  if (type.startsWith('seconds/')) {
    // 초봉: 최근 2시간 데이터
    startDate = new Date(now.getTime() - 2 * 60 * 60 * 1000); // 1시간 -> 2시간
  } else if (type.startsWith('minutes/')) {
    // 1분봉: 최근 2시간 데이터
    startDate = new Date(now.getTime() - 2 * 60 * 60 * 1000);
  } else {
    // 일봉: 최근 1일 데이터
    startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  }
  
  return {
    startDate,
    endDate: null
  };
};


/// 마커 생성 함수
export const createTradeMarkers = (signals: TradeSignal[]): SeriesMarker<Time>[] => {
  if (!signals || signals.length === 0) return [];
  
  console.log(`마커 생성 중: ${signals.length}개 신호`);
  
  return signals.map(signal => {
    if (!signal || !signal.time) {
      console.warn('유효하지 않은 신호 스킵:', signal);
      return null;
    }
    
    // 포지션에 따른 마커 설정
    let position: SeriesMarkerPosition;
    let color: string;
    let shape: SeriesMarkerShape;
    let text: string;
    
    if (signal.position === 'buy') {
      position = 'belowBar' as SeriesMarkerPosition;
      color = '#26a69a'; // 녹색
      shape = 'arrowUp' as SeriesMarkerShape;
      text = '매수';
    } else if (signal.position === 'sell') {
      position = 'aboveBar' as SeriesMarkerPosition;
      color = '#ef5350'; // 빨간색
      shape = 'arrowDown' as SeriesMarkerShape;
      text = '매도';
    } else {
      // 기본값 설정
      position = 'belowBar' as SeriesMarkerPosition;
      color = '#888888'; // 회색
      shape = 'circle' as SeriesMarkerShape;
      text = signal.position || '알 수 없음';
    }
    
    const markerTime = signal.time as Time;
    console.log(`마커 생성: ${text}, 시간: ${new Date((signal.time as number) * 1000).toLocaleString('ko-KR')}`);
    
    return {
      time: markerTime,
      position,
      color,
      shape,
      text: `${text} @ ${signal.price.toLocaleString()}`,
      size: 3, // 크기 증가
      id: signal.id // 고유 ID 추가
    };
  }).filter(Boolean) as SeriesMarker<Time>[];
};

// EMA 계산 함수
export const calculateEMA = (data: ExtendedCandlestickData[], period: number): LineData<Time>[] => {
  if (!data || data.length === 0 || period <= 0) return [];
  
  const emaData: LineData<Time>[] = [];
  const multiplier = 2 / (period + 1);
  let initialSMA = 0;
  
  const validData = data.filter(item => item && item.close !== undefined);
  if (validData.length === 0) return [];
  
  // 초기 SMA 계산
  for (let i = 0; i < Math.min(period, validData.length); i++) {
    initialSMA += validData[i].close;
  }
  initialSMA /= Math.min(period, validData.length);
  
  // 첫 번째 EMA는 SMA와 동일
  if (validData.length > 0) {
    emaData.push({
      time: validData[0].time,
      value: initialSMA
    });
  }
  
  // 나머지 EMA 계산
  for (let i = 1; i < validData.length; i++) {
    const previousEMA = emaData[i - 1].value;
    const currentEMA = (validData[i].close - previousEMA) * multiplier + previousEMA;
    
    emaData.push({
      time: validData[i].time,
      value: currentEMA
    });
  }
  
  return emaData;
};

// 차트 타입에 따른 API 엔드포인트 결정
export const getChartEndpoint = (type: string) => {
  if (type.startsWith('seconds/')) {
    return 'seconds'; // 초봉 API 엔드포인트
  }
  const minutes = parseInt(type);
  if (minutes <= 240) { // 1분봉, 3분봉, 일봉(240분)
    return `minutes/${type}`;
  } else if (minutes === 7200) { // 월봉
    return 'months';
  } else { // 년봉
    return 'years';
  }
};

// 백테스트 결과 계산 함수
export const calculateBacktestResult = (
  candleData: ExtendedCandlestickData[], 
  signals: TradeSignal[], 
  mode: 'live' | 'test'
): BacktestResult => {
  const trades: Trade[] = [];
  let buyPoint: TradeSignal | null = null;
  const feeRate = 0.0005;
  
  for (let i = 0; i < signals.length; i++) {
    const signal = signals[i];
    
    if (signal.position === 'buy') {
      buyPoint = signal;
      console.log(`Backtest: BUY signal detected at ${formatTime(signal.time)} - price: ${signal.price}`);
    } else if ((signal.position === 'sell') && buyPoint) {
      // 360MA 위에 있으면 매도 신호 무시 (백테스트에서도 적용)
      if (signal.metadata?.isAbove360MA) {
        console.log(`Backtest: SELL signal ignored at ${new Date((signal.time as number) * 1000).toLocaleTimeString()} - price is above 360MA`);
        continue; // 다음 포인트로 넘어감
      }
      
      console.log(`Backtest: SELL signal detected at ${formatTime(signal.time)} - price: ${signal.price}`);
      
      // buyPoint는 이미 null 체크를 했으므로 안전합니다
      const entryCandle = candleData.find(candle => candle.time === buyPoint!.time);
      const exitCandle = candleData.find(candle => candle.time === signal.time);
      
      if (!entryCandle || !exitCandle) {
        console.warn('Cannot find matching candle data for signal');
        continue;
      }

      // 매수는 고가(high)로, 매도는 저가(low)로 계산하여 보수적으로 추정
      const entryPrice = entryCandle.high;
      const exitPrice = exitCandle.low;
      const returnRate = (exitPrice - entryPrice) / entryPrice;
      
      console.log(`Backtest: Trade completed - Entry: ${entryPrice}, Exit: ${exitPrice}, Return: ${(returnRate * 100).toFixed(2)}%`);
      
      trades.push({
        entryTime: buyPoint.time as Time,
        exitTime: signal.time as Time,
        entryPrice,
        exitPrice,
        return: returnRate,
        isSuccess: returnRate > 0,
        mode: mode === 'test' ? 'test-auto' : 'live-auto',
        metadata: {
          entryMa360: buyPoint.metadata?.ma360,
          exitMa360: signal.metadata?.ma360,
          entryMa120: buyPoint.metadata?.ma120,
          exitMa120: signal.metadata?.ma120
        }
      });
      
      buyPoint = null;
    }
  }

  const totalTrades = trades.length;
  const successfulTrades = trades.filter(trade => trade.isSuccess).length;
  
  // 수수료 제외 총 수익률 (매수+매도 수수료 고려)
  const totalReturn = trades.reduce((sum, trade) => sum + trade.return, 0);
  
  // 수수료 포함 순수익률 계산 (각 거래마다 매수+매도 수수료 차감)
  const totalNetReturn = trades.reduce((sum, trade) => sum + (trade.return - (feeRate * 2)), 0);
  
  return {
    totalTrades,
    successfulTrades,
    totalReturn,
    totalNetReturn,
    successRate: totalTrades > 0 ? (successfulTrades / totalTrades) * 100 : 0,
    averageReturn: totalTrades > 0 ? totalReturn / totalTrades : 0,
    averageNetReturn: totalTrades > 0 ? totalNetReturn / totalTrades : 0,
    trades
  };
};

// 기울기 계산 함수
export const calculateSlope = (data: ExtendedCandlestickData[], period: number): number => {
  if (data.length < 2) return 0;
  
  const maData = calculateEMA(data, period);
  if (maData.length < 2) return 0;
  
  const last = maData[maData.length - 1].value;
  const prev = maData[maData.length - 2].value;
  
  return ((last - prev) / prev) * 100;
};

// 시간 표시 형식
export const formatTime = (time: Time | number): string => {
  if (typeof time === 'number') {
    return new Date(time * 1000).toLocaleString();
  } else if (typeof time === 'object' && time !== null) {
    // BusinessDay 객체인 경우
    const businessDay = time as BusinessDay;
    return new Date(businessDay.year, businessDay.month - 1, businessDay.day).toLocaleDateString();
  }
  return String(time);
};

// VMA 계산 함수
export const calculateVMA = (data: ExtendedCandlestickData[], period: number): number => {
  const volumes = data.slice(-period).map(candle => candle.volume || 0);
  const totalVolume = volumes.reduce((sum, volume) => sum + volume, 0);
  return totalVolume / period;
};

// 거래량 기반 신호 판단 함수
export const evaluateVolumeSignals = (
  candleData: ExtendedCandlestickData[], 
  currentVolume: number, 
  currentPrice: number
): string => {
  const VMA10 = calculateVMA(candleData, 10);
  const lastCandle = candleData[candleData.length - 1];
  const volumeRatio = (currentVolume / VMA10) * 100;

  if (currentVolume >= VMA10 * 2) {
    if (currentPrice > lastCandle.close) {
      return '강한 매수 신호';
    } else {
      return '강한 매도 신호';
    }
  }

  if (volumeRatio > 150) {
    return '강한 상승 신호';
  } else if (volumeRatio < 50) {
    return '약한 매매세력';
  }

  return '';
};

// OBV 계산 함수
export const calculateOBV = (data: ExtendedCandlestickData[]): number => {
  let obv = 0;
  for (let i = 1; i < data.length; i++) {
    const currentCandle = data[i];
    const previousCandle = data[i - 1];
    if (currentCandle.close > previousCandle.close) {
      obv += currentCandle.volume || 0;
    } else if (currentCandle.close < previousCandle.close) {
      obv -= currentCandle.volume || 0;
    }
  }
  return obv;
};

// 주문 수량 계산 함수
export const calculateOrderVolume = (price: number, maxOrderPrice: number): string => {
  if (price <= 0) return '0';
  const amount = maxOrderPrice * 0.25; // 최대 주문 금액의 25%
  return (amount / price).toFixed(4);
};

// 날짜 형식 변환 함수
export const formatDate = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}; 