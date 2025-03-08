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
  Trade,
  TradeSignal
} from '../types/candlestick';

/**
 * chartType에 따라 초기 날짜 범위를 반환한다.
 * chartType이 "seconds/"이면 최근 10분, "일봉", "월봉", "년봉" 문자열 포함 여부로 처리
 */
export const getInitialDateRange = (type: string): DateRange => {
  const now = new Date();
  let startDate: Date;
  
  if (type.startsWith('seconds/')) {
    // 초봉: 최근 30분 데이터
     // 초봉: 최근 1시간 데이터
    startDate = new Date(now.getTime() - 60 * 60 * 1000); // 30분 -> 1시간
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
  return signals.map(signal => {
    // 포지션에 따른 마커 설정
    let position: SeriesMarkerPosition;
    let color: string;
    let shape: SeriesMarkerShape;
    let text: string;
    
    // 시간 포맷팅
    const timeStr = formatTime(signal.time);
    
    if (signal.position === 'long') {
      position = 'belowBar' as SeriesMarkerPosition;
      color = '#26a69a'; // 녹색
      shape = 'arrowUp' as SeriesMarkerShape;
      text = `매수 @ ${signal.price.toLocaleString()} (${timeStr})`;
    } else if (signal.position === 'short' || signal.position === 'close') {
      position = 'aboveBar' as SeriesMarkerPosition;
      color = '#ef5350'; // 빨간색
      shape = 'arrowDown' as SeriesMarkerShape;
      text = `매도 @ ${signal.price.toLocaleString()} (${timeStr})`;
    } else {
      // 기본값 설정
      position = 'belowBar' as SeriesMarkerPosition;
      color = '#888888'; // 회색
      shape = 'circle' as SeriesMarkerShape;
      text = `${signal.position} @ ${signal.price.toLocaleString()} (${timeStr})`;
    }
    
    return {
      time: signal.time as Time,
      position,
      color,
      shape,
      text,
      size: 2
    };
  });
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
  
  console.log(`백테스트 시작: 총 ${signals.length}개 신호 분석 시작`);
  
  // 예외 처리: 신호가 없는 경우
  if (signals.length === 0) {
    console.warn('백테스트 오류: 분석할 신호가 없습니다');
    return {
      totalTrades: 0,
      successfulTrades: 0,
      failedTrades: 0,
      successRate: 0,
      totalReturn: 0,
      totalNetReturn: 0,
      averageReturn: 0,
      averageNetReturn: 0,
      trades: []
    };
  }
  
  // 디버깅용: 전체 신호 목록의 처음과 마지막 몇 개 출력
  if (signals.length > 0) {
    const firstSignals = signals.slice(0, Math.min(3, signals.length));
    const lastSignals = signals.slice(Math.max(0, signals.length - 3));
    
    console.log('첫 신호들:', firstSignals.map(s => ({
      포지션: s.position,
      시간: formatTime(s.time),
      가격: s.price
    })));
    
    console.log('마지막 신호들:', lastSignals.map(s => ({
      포지션: s.position,
      시간: formatTime(s.time),
      가격: s.price
    })));
  }
  
  // 첫 번째 신호가 매도 신호인 경우 경고
  if (signals.length > 0 && (signals[0].position === 'close' || signals[0].position === 'short')) {
    console.warn(`백테스트 경고: 첫 번째 신호가 매도(${signals[0].position}) 신호입니다. 시간: ${formatTime(signals[0].time)}`);
  }
  
  // 신호 처리
  for (let i = 0; i < signals.length; i++) {
    const signal = signals[i];
    const signalTimeFormatted = formatTime(signal.time);
    const signalDateObj = new Date((signal.time as number) * 1000);
    
    if (signal.position === 'long') {
      // 이미 진행 중인 매수가 있는 경우 경고
      if (buyPoint !== null) {
        console.warn(`[${signalTimeFormatted}] 경고: 이전 매수 신호(${formatTime(buyPoint.time)})가 청산되지 않았는데 새로운 매수 신호가 발생했습니다.`);
      }
      
      buyPoint = signal;
      console.log(`[${signalTimeFormatted}] 매수 신호 감지 - 가격: ${signal.price.toLocaleString()}원, 인덱스: ${i}/${signals.length-1}`);
    } else if ((signal.position === 'close' || signal.position === 'short') && buyPoint) {
      // 360MA 위에 있으면 매도 신호 무시 (백테스트에서도 적용)
      if (signal.metadata?.isAbove360MA) {
        console.log(`[${signalTimeFormatted}] 매도 신호 무시 - 360MA 위에 있음, 가격: ${signal.price.toLocaleString()}원`);
        continue; // 다음 포인트로 넘어감
      }
      
      console.log(`[${signalTimeFormatted}] 매도 신호 감지 - 가격: ${signal.price.toLocaleString()}원, 인덱스: ${i}/${signals.length-1}`);
      
      // buyPoint는 이미 null 체크를 했으므로 안전합니다
      const entryCandle = candleData.find(candle => candle.time === buyPoint!.time);
      const exitCandle = candleData.find(candle => candle.time === signal.time);
      
      if (!entryCandle || !exitCandle) {
        console.warn(`[${signalTimeFormatted}] 신호에 맞는 캔들 데이터를 찾을 수 없음`);
        continue;
      }

      // 매수는 고가(high)로, 매도는 저가(low)로 계산하여 보수적으로 추정
      const entryPrice = entryCandle.high;
      const exitPrice = exitCandle.low;
      const returnRate = (exitPrice - entryPrice) / entryPrice;
      const entryTimeFormatted = formatTime(buyPoint.time);
      
      console.log(`[${signalTimeFormatted}] 거래 완료 - 매수(${entryTimeFormatted}): ${entryPrice.toLocaleString()}원, 매도(${signalTimeFormatted}): ${exitPrice.toLocaleString()}원, 수익률: ${(returnRate * 100).toFixed(2)}%`);
      
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
    } else if ((signal.position === 'close' || signal.position === 'short') && buyPoint === null) {
      // 매수 없이 매도 신호가 나온 경우
      console.warn(`[${signalTimeFormatted}] 경고: 매수 신호 없이 매도 신호가 감지되었습니다. 무시됩니다.`);
    }
  }
  
  // 마지막 구매 포인트가 청산되지 않은 경우
  if (buyPoint) {
    console.warn(`주의: 청산되지 않은 매수 신호가 있습니다. 시간: ${formatTime(buyPoint.time)}, 가격: ${buyPoint.price.toLocaleString()}원`);
    
    // 마지막 캔들을 기준으로 가상의 청산 결과 계산 (선택사항)
    if (candleData.length > 0 && mode === 'test') {
      const lastCandle = candleData[candleData.length - 1];
      const entryCandle = candleData.find(candle => candle.time === buyPoint.time);
      
      if (entryCandle) {
        const entryPrice = entryCandle.high;
        const exitPrice = lastCandle.close; // 마지막 종가로 가상 청산
        const returnRate = (exitPrice - entryPrice) / entryPrice;
        
        console.log(`가상 청산 계산 (마지막 캔들 기준) - 진입: ${entryPrice.toLocaleString()}원, 청산: ${exitPrice.toLocaleString()}원, 수익률: ${(returnRate * 100).toFixed(2)}%`);
      }
    }
  }
  
  console.log(`백테스트 완료: 총 ${trades.length}개 거래 생성됨`);
  
  // 거래가 없는 경우 기본 결과 반환
  if (trades.length === 0) {
    return {
      totalTrades: 0,
      successfulTrades: 0,
      failedTrades: 0,
      successRate: 0,
      totalReturn: 0,
      totalNetReturn: 0,
      averageReturn: 0,
      averageNetReturn: 0,
      trades: []
    };
  }
  
  const totalTrades = trades.length;
  const successfulTrades = trades.filter(trade => trade.isSuccess).length;
  const failedTrades = totalTrades - successfulTrades;
  
  // 수수료 제외 총 수익률 (매수+매도 수수료 고려)
  const totalReturn = trades.reduce((sum, trade) => sum + trade.return, 0);
  
  // 수수료 포함 순수익률 계산 (각 거래마다 매수+매도 수수료 차감)
  const totalNetReturn = trades.reduce((sum, trade) => sum + (trade.return - (feeRate * 2)), 0);
  
  return {
    totalTrades,
    successfulTrades,
    failedTrades,
    successRate: totalTrades > 0 ? (successfulTrades / totalTrades) * 100 : 0,
    totalReturn,
    totalNetReturn,
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