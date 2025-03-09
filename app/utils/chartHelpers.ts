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
    // 초봉: 최근 24시간 데이터 (900개 이상의 캔들을 확보하기 위해 시간 증가)
    startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  } else if (type.startsWith('minutes/')) {
    // 1분봉: 최근 48시간 데이터 (900개 이상의 캔들을 확보하기 위해 시간 증가)
    const minutes = parseInt(type.split('/')[1]);
    const hoursNeeded = Math.ceil(1200 * minutes / 60); // 여유있게 1200개로 설정
    startDate = new Date(now.getTime() - hoursNeeded * 60 * 60 * 1000);
  } else if (type === 'days') {
    // 일봉: 최근 1000일 데이터 (여유있게 1000개로 설정)
    startDate = new Date(now.getTime() - 1000 * 24 * 60 * 60 * 1000);
  } else if (type === 'weeks') {
    // 주봉: 최근 1000주 데이터 (여유있게 1000개로 설정)
    startDate = new Date(now.getTime() - 1000 * 7 * 24 * 60 * 60 * 1000);
  } else {
    // 월봉: 최근 1000개월 데이터 (약 83년)
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    startDate = new Date(currentYear - 83, currentMonth, 1);
  }
  
  return {
    startDate,
    endDate: null
  };
};


/// 마커 생성 함수
export const createTradeMarkers = (signals: TradeSignal[]): SeriesMarker<Time>[] => {
  return signals.filter(signal => signal && signal.time).map(signal => {
    let position: SeriesMarkerPosition = 'belowBar';
    let shape: SeriesMarkerShape = 'circle';
    let color = 'rgba(0, 0, 0, 0)';
    let text = '';
    
    if (signal.position === 'long') {
      position = 'belowBar';
      shape = 'arrowUp';
      color = 'rgba(38, 166, 154, 0.7)';
      text = '매수';
    } else if (signal.position === 'short' || signal.position === 'exit') {
      position = 'aboveBar';
      shape = 'arrowDown';
      color = 'rgba(239, 83, 80, 0.7)';
      text = signal.position === 'short' ? '매도' : '청산';
    }
    
    return {
      time: signal.time,
      position,
      shape,
      color,
      text: `${text} @ ${signal.price.toLocaleString()}`,
      size: 1.5,
      id: signal.id
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
  
  // 데이터가 부족한 경우 경고 로그 출력
  if (validData.length < period) {
    console.warn(`경고: EMA${period} 계산을 위한 데이터가 부족합니다. 필요: ${period}, 현재: ${validData.length}`);
    // 그래도 계속 진행 (가능한 한 많은 데이터로 계산)
  }
  
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
    // 초봉 API 엔드포인트 수정
    // 업비트 API는 초 단위 캔들을 지원하지 않으므로 1분봉으로 대체
    // 하지만 실시간성을 높이기 위해 1분봉 사용
    return `minutes/1`;
  }
  const minutes = parseInt(type.split('/')[1] || type);
  if (minutes <= 240) { // 1분봉, 3분봉, 일봉(240분)
    return `minutes/${minutes}`;
  } else if (minutes === 7200) { // 월봉
    return 'months';
  } else { // 년봉
    return 'years';
  }
};

// 백테스트 결과 계산
export const calculateBacktestResult = (
  data: ExtendedCandlestickData[],
  signals: TradeSignal[],
  mode: 'live' | 'test'
): BacktestResult => {
  const trades: Trade[] = [];
  let buyPoint: TradeSignal | null = null;
  const feeRate = 0.0005;
  
  for (let i = 0; i < signals.length; i++) {
    const signal = signals[i];
    
    if (signal.position === 'long') {
      buyPoint = signal;
      console.log(`Backtest: BUY signal detected at ${formatTime(signal.time)} - price: ${signal.price}`);
    } else if ((signal.position === 'exit' || signal.position === 'short') && buyPoint) {
      // 360MA 위에 있으면 매도 신호 무시 (백테스트에서도 적용)
      if (signal.metadata?.isAbove360MA) {
        console.log(`Backtest: SELL signal ignored at ${new Date((signal.time as number) * 1000).toLocaleTimeString()} - price is above 360MA`);
        continue; // 다음 포인트로 넘어감
      }
      
      console.log(`Backtest: SELL signal detected at ${formatTime(signal.time)} - price: ${signal.price}`);
      
      // buyPoint는 이미 null 체크를 했으므로 안전합니다
      const entryCandle = data.find(candle => candle.time === buyPoint!.time);
      const exitCandle = data.find(candle => candle.time === signal.time);
      
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
  
  const winningTrades = successfulTrades;
  const losingTrades = totalTrades - successfulTrades;
  const winRate = totalTrades > 0 ? (winningTrades / totalTrades) * 100 : 0;
  const totalProfit = totalReturn;
  const totalLoss = -totalNetReturn;
  const netProfit = totalNetReturn;
  const profitFactor = totalProfit / Math.abs(totalLoss);
  const maxDrawdown = 0; // 최대 손절 폭 계산 필요
  const averageProfit = totalTrades > 0 ? totalReturn / totalTrades : 0;
  const averageLoss = totalTrades > 0 ? totalNetReturn / totalTrades : 0;
  const initialBalance = 0; // 초기 자본금 계산 필요
  const finalBalance = 0; // 최종 자본금 계산 필요
  const roi = 0; // 순이익 대비 투자 수익률 계산 필요
  
  return {
    totalTrades,
    winningTrades,
    losingTrades,
    winRate,
    totalProfit,
    totalLoss,
    netProfit,
    profitFactor,
    maxDrawdown: maxDrawdown * 100, // 백분율로 변환
    averageProfit,
    averageLoss,
    initialBalance,
    finalBalance,
    roi
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

// 날짜 포맷 함수
export const formatDateForAPI = (date: Date): string => {
  // 현재 시간에서 1초를 더해 가장 최신 데이터를 가져오도록 함
  const adjustedDate = new Date(date.getTime() + 1000);
  return adjustedDate.toISOString();
};

// 캔들 데이터 처리 함수
export const processCandle = (candle: any, chartType: string): ExtendedCandlestickData => {
  // 시간 처리 개선
  let timeValue: Time;
  
  if (candle.timestamp) {
    // timestamp가 있는 경우 (밀리초 단위)
    timeValue = Math.floor(candle.timestamp / 1000) as Time;
  } else if (candle.candle_date_time_kst) {
    // KST 시간이 있는 경우
    // 업비트 API는 KST(한국 시간)로 시간을 반환함
    // 형식: "2023-01-01T12:00:00"
    const kstDateStr = candle.candle_date_time_kst;
    
    // 방법 3: 로컬 시간대로 해석 (가장 간단하고 일관된 방법)
    // 브라우저가 자동으로 로컬 시간대로 해석하도록 함
    const localDate = new Date(kstDateStr);
    timeValue = Math.floor(localDate.getTime() / 1000) as Time;
    
    console.warn('시간 처리:', {
      원본: kstDateStr,
      변환결과: localDate.toLocaleString('ko-KR'),
      타임스탬프: timeValue
    });
  } else {
    // 둘 다 없는 경우 현재 시간 사용
    timeValue = Math.floor(Date.now() / 1000) as Time;
    console.warn('캔들 데이터에 시간 정보가 없습니다. 현재 시간을 사용합니다.');
  }
  
  return {
    time: timeValue,
    open: candle.opening_price,
    high: candle.high_price,
    low: candle.low_price,
    close: candle.trade_price,
    volume: candle.candle_acc_trade_volume,
  };
}; 