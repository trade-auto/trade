import {
  Time,
  SeriesMarker,
  LineData,
  BusinessDay,
} from 'lightweight-charts';
import { 
  ExtendedCandlestickData, 
  CrossPoint, 
  DateRange,
  BacktestResult,
  Trade,
  UpbitCandle
} from '../types/candlestick';

/**
 * chartType에 따라 초기 날짜 범위를 반환한다.
 * chartType이 "seconds/"이면 최근 10분, "일봉", "월봉", "년봉" 문자열 포함 여부로 처리
 */
export const getInitialDateRange = (type: string): DateRange => {
  const now = new Date();
  let startDate: Date;
  
  if (type.startsWith('seconds/')) {
    // 초봉: 최근 1시간 데이터
    startDate = new Date(now.getTime() - 60 * 60 * 1000); // 30분 -> 1시간
  } else if (type === 'minutes/1') {
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

// 매수/매도 신호 생성 로직 
export const findCrossPoints = (
  sixtyEMA: LineData<Time>[], 
  oneTwentyEMAData: LineData<Time>[] | null = null,
  twoFortyEMAData: LineData<Time>[] | null = null,
  threeHundredSixtyEMAData: LineData<Time>[] | null = null
): CrossPoint[] => {
  const crossPoints: CrossPoint[] = [];
  let lastAction: 'buy' | 'sell' | null = null;
  let lastActionTime: number = 0;
  const startTime = Math.floor(Date.now() / 1000) - 3600; // 현재 시간에서 60분 전 부터 매매
  
  // 조건 지속 시간 추적을 위한 변수들
  const MIN_TIME_BETWEEN_TRADES = 30; // 30초 - 루프 외부로 이동
  
  for (let i = 11; i < sixtyEMA.length; i++) {
    const currentTime = sixtyEMA[i].time as number;
    
    // 시작 시간 이전의 신호는 무시
    if (currentTime < startTime) continue;
    
    const currSixty = sixtyEMA[i].value;
    
    // 240MA 관련 데이터 계산
    const tolerance = 3; // 초 단위 허용 오차
    const ma240Index = twoFortyEMAData ? twoFortyEMAData.findIndex(d => Math.abs((d.time as number) - (sixtyEMA[i].time as number)) < tolerance) : -1;
    const ma120Index = oneTwentyEMAData ? oneTwentyEMAData.findIndex(d => Math.abs((d.time as number) - (sixtyEMA[i].time as number)) < tolerance) : -1;
    const ma360Index = threeHundredSixtyEMAData ? threeHundredSixtyEMAData.findIndex(d => Math.abs((d.time as number) - (sixtyEMA[i].time as number)) < tolerance) : -1;
    
    // 10초 전 인덱스 계산
    const prevIndex = i - 5;
    if (prevIndex < 0 || !sixtyEMA[prevIndex] || !sixtyEMA[i]) continue;
    
    // 현재 시점과 10초 전 시점의 120MA와 240MA 값 가져오기
    const curr120MA = ma120Index >= 0 && oneTwentyEMAData && oneTwentyEMAData[ma120Index] ? oneTwentyEMAData[ma120Index].value : 0;
    const curr240MA = ma240Index >= 0 && twoFortyEMAData && twoFortyEMAData[ma240Index] ? twoFortyEMAData[ma240Index].value : 0;
    const curr360MA = ma360Index >= 0 && threeHundredSixtyEMAData && threeHundredSixtyEMAData[ma360Index] ? threeHundredSixtyEMAData[ma360Index].value : 0;
    
    // 10초 전 120MA와 240MA 인덱스 찾기
    const prev120Index = oneTwentyEMAData ? oneTwentyEMAData.findIndex(d => Math.abs((d.time as number) - (sixtyEMA[prevIndex].time as number)) < tolerance) : -1;
    const prev240Index = twoFortyEMAData ? twoFortyEMAData.findIndex(d => Math.abs((d.time as number) - (sixtyEMA[prevIndex].time as number)) < tolerance) : -1;
    const prev360Index = threeHundredSixtyEMAData ? threeHundredSixtyEMAData.findIndex(d => Math.abs((d.time as number) - (sixtyEMA[prevIndex].time as number)) < tolerance) : -1;
    const prev120MA = prev120Index >= 0 && oneTwentyEMAData ? oneTwentyEMAData[prev120Index].value : 0;
    const prev240MA = prev240Index >= 0 && twoFortyEMAData ? twoFortyEMAData[prev240Index].value : 0;
    const prev360MA = prev360Index >= 0 && threeHundredSixtyEMAData ? threeHundredSixtyEMAData[prev360Index].value : 0;   
    
    // 이격도 계산 (120MA와 240MA 간의 차이)
    const currentGap = Math.abs(curr120MA - curr240MA);
    const previousGap = Math.abs(prev120MA - prev240MA);
    
    // 이격도가 10초 전보다 근접했는지 확인
    const gapNarrowing = currentGap < previousGap;
    
    // 60MA와 120MA의 교차 여부 확인 + 정배열/역배열 상태에서의 위치 확인
    const buyCross = (sixtyEMA[prevIndex].value < prev120MA) && (currSixty > curr120MA); // 상방 돌파
    const sellCross = (sixtyEMA[prevIndex].value > prev120MA) && (currSixty < curr120MA); // 하방 돌파
    const sixtyAbove120 = (sixtyEMA[prevIndex].value > prev120MA) && (currSixty > curr120MA); // 60MA가 계속 120MA 위에 있음
    const sixtyBelow120 = (sixtyEMA[prevIndex].value < prev120MA) && (currSixty < curr120MA); // 60MA가 계속 120MA 아래에 있음
    const buyCrossOrAbove = buyCross || sixtyAbove120; // 매수 조건: 상방 돌파 또는 계속 위에 있음
    const sellCrossOrBelow = sellCross || sixtyBelow120; // 매도 조건: 하방 돌파 또는 계속 아래에 있음
    
    // 60MA와 120MA의 기울기 차이 계산 (60MA가 120MA보다 얼마나 빠르게 상승하는지)
    const sixtyMA_slope = currSixty - sixtyEMA[prevIndex].value;
    const onetwentyMA_slope = curr120MA - prev120MA;
    const slopeDifference = sixtyMA_slope - onetwentyMA_slope;

    // 60MA가 120MA를 큰 기울기로 상방 관통하는지 확인
    const strongBuyCross = buyCross && (slopeDifference > 0.5); // 0.5는 기울기 차이 임계값으로 조정 가능
    
    // 기울기 계산 (각도 단위) - 수정된 방식
    const timeDiff = 10; // 10초
    const slope120MA = Math.atan2(curr120MA - prev120MA, timeDiff) * (180 / Math.PI);
    const slope240MA = Math.atan2(curr240MA - prev240MA, timeDiff) * (180 / Math.PI);
    const slope360MA = Math.atan2(curr360MA - prev360MA, timeDiff) * (180 / Math.PI);

    // 기울기 조건
    const sloped360 = 15;
    const buySlope = (slope120MA >= 10) && (slope240MA >= 10); // 10도 이상 상향
    const sellSlope = (slope120MA <= -2) && (slope240MA <= -2); // -2도 이하 하향

    // 360MA 기울기가 +/- 15도 이내인지 확인 (횡보 상태)
    const is360MASideways = Math.abs(slope360MA) <= sloped360;
    
    // 시간 간격 조건 확인
    const timeSinceLastAction = currentTime - lastActionTime;
    console.log({
      currentTime,
      lastActionTime,
      timeSinceLastAction,
      MIN_TIME_BETWEEN_TRADES,
      skipThisIteration: timeSinceLastAction < MIN_TIME_BETWEEN_TRADES
    });

    // 정배열/역배열 상태 확인
    const ma360Value = ma360Index >= 0 && threeHundredSixtyEMAData && threeHundredSixtyEMAData[ma360Index] ? threeHundredSixtyEMAData[ma360Index].value : 0;
    const isProperAlignmentFull = (curr240MA > ma360Value);
    const isReverseAlignment = (ma360Value > curr240MA) && (curr240MA > curr120MA);

    // 60MA, 120MA, 240MA의 정배열/역배열 상태 확인
    const isFullProperAlignment = (currSixty > curr120MA) && (curr120MA > curr240MA); // 완전 정배열: 60MA > 120MA > 240MA
    const isFullReverseAlignment = (currSixty < curr120MA) && (curr120MA < curr240MA); // 완전 역배열: 60MA < 120MA < 240MA
    let prev60MASlope: number = 0;
    let prev60MASlopeTime: number = 0;
    const SLOPE_CHANGE_THRESHOLD = 30; //
          // 60MA와 120MA의 기울기가 하강인지 확인
    const slope60MA = sixtyMA_slope; // 60MA 기울기
    const is60MADownward = slope60MA < 0; // 60MA 기울기가 음수이면 하강
    const is120MADownward = slope120MA < 0; // 120MA 기울기가 음수이면 하강
    const isBothMADownward = is60MADownward && is120MADownward; // 두 MA 모두 하강 기울기

    const isRapidSlopeChange = (
      currentTime - prev60MASlopeTime <= SLOPE_CHANGE_THRESHOLD && // 30초 이내
      prev60MASlope < -5 && // 이전에 급하강 (-5도 이하)
      slope60MA > 5 // 현재 급상승 (5도 이상)
    );
    
    // 현재 60MA 기울기 저장
    if (Math.abs(slope60MA) > 5) { // 의미 있는 기울기 변화만 저장
      prev60MASlope = slope60MA;
      prev60MASlopeTime = currentTime;
    }
    
    console.log({
      currentTime: new Date(currentTime * 1000).toLocaleTimeString(),
      lastActionTime: lastActionTime > 0 ? new Date(lastActionTime * 1000).toLocaleTimeString() : 'Not set',
      timeSinceLastAction,
      MIN_TIME_BETWEEN_TRADES,
      lastAction,
      insideIs360MASidewaysBlock: true
    });
    
    if ((!is360MASideways) && (timeSinceLastAction >= MIN_TIME_BETWEEN_TRADES)) {  
      if (isBothMADownward && !isRapidSlopeChange) { 
        console.log(`Skipping buy: Both 60MA and 120MA are downward sloping. Waiting for 30 seconds.`);
        // 하강 기울기일 때는 lastActionTime을 업데이트하여 30초 동안 매수하지 않음
        lastActionTime = currentTime;
      } 
      
      // 매수 조건
      if ((lastAction !== 'buy' && 
        (isRapidSlopeChange || // 30초 이내 60MA 기울기가 급하강에서 급상승으로 변경
         (!isBothMADownward && // 60MA와 120MA가 모두 하강 기울기가 아닐 때
          (strongBuyCross || // 60MA가 120MA를 큰 기울기로 상방 관통
           (gapNarrowing && buyCrossOrAbove && buySlope) || 
           (isFullProperAlignment && buyCrossOrAbove) || 
           (isProperAlignmentFull && buyCrossOrAbove ))
         )) && 
          !isReverseAlignment)) {
        
        console.log(`BUY signal generated at ${new Date(currentTime * 1000).toLocaleTimeString()}`);
        
        // 360MA 위에 있는지 확인
        const isAbove360MA = currSixty > curr360MA;
        
        crossPoints.push({
          time: sixtyEMA[i].time,
          position: 'buy',
          price: currSixty,
          isAbove360MA: isAbove360MA,
          slopes: {
            ma60: sixtyMA_slope,
            ma120: onetwentyMA_slope,
            ma240: curr240MA - (prev240Index >= 0 && twoFortyEMAData ? twoFortyEMAData[prev240Index].value : 0),
            ma360: curr360MA - (prev360Index >= 0 && threeHundredSixtyEMAData ? threeHundredSixtyEMAData[prev360Index].value : 0)
          },
          deviations: {
            ma120: ((currSixty / curr120MA) * 100) - 100,
            ma240: ((currSixty / curr240MA) * 100) - 100
          }
        });
        lastAction = 'buy';
        lastActionTime = currentTime;
      }
      // 매도 조건
      else if (lastAction == 'buy' && 
               ((gapNarrowing && sellCrossOrBelow && sellSlope) ||
                (isFullReverseAlignment && sellCrossOrBelow))) {
        
        // 360MA 위에 있는지 확인
        const isAbove360MA = currSixty > curr360MA;
        
        // 360MA 위에 있으면 매도하지 않음
        if (isAbove360MA) {
          console.log(`SELL signal ignored - price is above 360MA at ${new Date(currentTime * 1000).toLocaleTimeString()}`);
        } else {
          // 매도 신호 생성 코드
          console.log(`SELL signal generated at ${new Date(currentTime * 1000).toLocaleTimeString()}`);
          crossPoints.push({
            time: sixtyEMA[i].time,
            position: 'sell',
            price: currSixty,
            isAbove360MA: isAbove360MA,
            slopes: {
              ma60: currSixty - sixtyEMA[i-1].value,
              ma120: curr120MA - (prev120Index >= 0 && oneTwentyEMAData ? oneTwentyEMAData[prev120Index].value : 0),
              ma240: curr240MA - (prev240Index >= 0 && twoFortyEMAData ? twoFortyEMAData[prev240Index].value : 0),
              ma360: ma360Index >= 0 && threeHundredSixtyEMAData ? threeHundredSixtyEMAData[ma360Index].value - (ma360Index > 0 ? threeHundredSixtyEMAData[ma360Index-1].value : 0) : 0
            }
          });
          lastAction = 'sell';
          lastActionTime = currentTime;
        }
      }
    } else {
      console.log(`Skipping trade: Last action (${lastAction}) was ${timeSinceLastAction} seconds ago, need to wait ${MIN_TIME_BETWEEN_TRADES - timeSinceLastAction} more seconds`);
    }
  }
  
  return crossPoints;
};

// 거래 마커 생성 함수
export const createTradeMarkers = (crossPoints: CrossPoint[]): SeriesMarker<Time>[] => {
  return crossPoints.map(point => ({
    time: point.time,
    position: point.position === 'buy' ? 'belowBar' : 'aboveBar',
    color: point.position === 'buy' ? '#2196F3' : '#e91e63',
    shape: point.position === 'buy' ? 'arrowUp' : 'arrowDown',
    text: point.position === 'buy' ? '매수' : '매도',
    size: 2
  }));
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
  crossPoints: CrossPoint[], 
  mode: 'live' | 'test'
): BacktestResult => {
  const trades: Trade[] = [];
  let buyPoint: CrossPoint | null = null;
  const feeRate = 0.0005;
  
  for (let i = 0; i < crossPoints.length; i++) {
    const point = crossPoints[i];
    
    if (point.position === 'buy') {
      buyPoint = point;
    } else if (point.position === 'sell' && buyPoint) {
      // 360MA 위에 있으면 매도 신호 무시 (백테스트에서도 적용)
      if (point.isAbove360MA) {
        console.log(`Backtest: SELL signal ignored at ${new Date((point.time as number) * 1000).toLocaleTimeString()} - price is above 360MA`);
        continue; // 다음 포인트로 넘어감
      }
      
      const entryPrice = buyPoint.price;
      const exitPrice = point.price;
      const returnRate = (exitPrice - entryPrice) / entryPrice;
      
      trades.push({
        entryTime: buyPoint.time,
        exitTime: point.time,
        entryPrice,
        exitPrice,
        return: returnRate,
        isSuccess: returnRate > 0,
        mode: mode === 'test' ? 'test-auto' : 'live-auto',
        angles: {
          entryMa360: buyPoint.slopes.ma360,
          exitMa360: point.slopes.ma360,
          entryMa120: buyPoint.slopes.ma120,
          exitMa120: point.slopes.ma120
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
export const formatTime = (time: Time): string => {
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