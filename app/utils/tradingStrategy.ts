import { LineData, Time } from 'lightweight-charts';

// 매수매도 판단을 위한 인터페이스 정의
export interface CrossPoint {
  time: Time;
  position: 'buy' | 'sell';
  price: number;
  isAbove360MA: boolean;
  slopes: {
    ma60: number;
    ma120: number;
    ma240: number;
    ma360: number;
  };
  deviations?: {
    ma120: number;
    ma240: number;
  };
}

// 매수매도 판단 로직을 위한 설정 인터페이스
export interface TradingStrategyConfig {
  minTimeBetweenTrades: number;
  conditionDurationThreshold: number;
}

// 기본 설정값
const DEFAULT_CONFIG: TradingStrategyConfig = {
  minTimeBetweenTrades: 30,
  conditionDurationThreshold: 10
};

/**
 * 매수매도 신호 생성 로직
 * @param sixtyEMA 60초 이동평균 데이터
 * @param oneTwentyEMA 120초 이동평균 데이터
 * @param twoFortyEMA 240초 이동평균 데이터
 * @param threeHundredSixtyEMA 360초 이동평균 데이터
 * @param isFirstBuy 초기 매수 여부
 * @param config 설정값
 * @returns 매수매도 신호 배열
 */
export const findCrossPoints = (
  sixtyEMA: LineData<Time>[],
  oneTwentyEMA: LineData<Time>[],
  twoFortyEMA: LineData<Time>[],
  threeHundredSixtyEMA: LineData<Time>[],
  isFirstBuy: boolean,
  config: TradingStrategyConfig = DEFAULT_CONFIG
): CrossPoint[] => {
  const crossPoints: CrossPoint[] = [];
  let lastAction: 'buy' | 'sell' | null = null;
  let lastActionTime: number = 0;
  const startTime = Math.floor(Date.now() / 1000) - 3600; // 현재 시간에서 60분 전 부터 매매
  
  // 필요한 MA 데이터 가져오기
  const ma360Data = threeHundredSixtyEMA;
  const ma240Data = twoFortyEMA;
  const ma120Data = oneTwentyEMA;
  const ma60Data = sixtyEMA;
  
  // 조건 지속 시간 추적을 위한 변수들
  let buyConditionStartTime: number | null = null;
  let sellConditionStartTime: number | null = null;
  const CONDITION_DURATION_THRESHOLD = config.conditionDurationThreshold; // 10초 지속 조건
  const MIN_TIME_BETWEEN_TRADES = config.minTimeBetweenTrades;

  for (let i = 11; i < sixtyEMA.length; i++) {
    const currentTime = sixtyEMA[i].time as number;
    
    // 최근 60분 데이터만 처리
    if (currentTime < startTime) continue;
    
    // 마지막 거래 후 최소 시간이 지났는지 확인
    const timeSinceLastAction = lastActionTime ? currentTime - lastActionTime : Infinity;
    if (timeSinceLastAction >= MIN_TIME_BETWEEN_TRADES) {
      // 현재 및 이전 인덱스 계산
      const prevIndex = i - 1;
      
      // 각 MA 데이터의 인덱스 찾기
      const ma60Index = ma60Data.findIndex(d => d.time === sixtyEMA[i].time);
      const ma120Index = ma120Data.findIndex(d => d.time === sixtyEMA[i].time);
      const ma240Index = ma240Data.findIndex(d => d.time === sixtyEMA[i].time);
      const ma360Index = ma360Data.findIndex(d => d.time === sixtyEMA[i].time);
      
      // 이전 MA 데이터의 인덱스 찾기
      const prev120Index = ma120Data.findIndex(d => d.time === sixtyEMA[prevIndex].time);
      const prev240Index = ma240Data.findIndex(d => d.time === sixtyEMA[prevIndex].time);
      const prev360Index = ma360Data.findIndex(d => d.time === sixtyEMA[prevIndex].time);
      
      // 현재 값 가져오기
      const currSixty = sixtyEMA[i].value as number;
      const curr120MA = ma120Index >= 0 && ma120Data ? ma120Data[ma120Index].value as number : 0;
      const curr240MA = ma240Index >= 0 && ma240Data ? ma240Data[ma240Index].value as number : 0;
      const curr360MA = ma360Index >= 0 && ma360Data ? ma360Data[ma360Index].value as number : 0;
      
      // 이전 값 가져오기
      const prev120MA = prev120Index >= 0 && ma120Data ? ma120Data[prev120Index].value as number : 0;
      const prev240MA = prev240Index >= 0 && ma240Data ? ma240Data[prev240Index].value as number : 0;
      const prev360MA = prev360Index >= 0 && ma360Data ? ma360Data[prev360Index].value as number : 0;
      
      // 이격도 계산 (120MA와 240MA 간의 차이)
      const currentGap = Math.abs(curr120MA - curr240MA);
      const previousGap = Math.abs(prev120MA - prev240MA);
      
      // 이격도가 10초 전보다 근접했는지 확인
      const gapNarrowing = currentGap < previousGap;
      
      // 60MA와 120MA의 교차 여부 확인 + 정배열/역배열 상태에서의 위치 확인
      const buyCross = (sixtyEMA[prevIndex].value as number < prev120MA) && (currSixty > curr120MA); // 상방 돌파
      const sellCross = (sixtyEMA[prevIndex].value as number > prev120MA) && (currSixty < curr120MA); // 하방 돌파
      const sixtyAbove120 = (sixtyEMA[prevIndex].value as number > prev120MA) && (currSixty > curr120MA); // 60MA가 계속 120MA 위에 있음
      const sixtyBelow120 = (sixtyEMA[prevIndex].value as number < prev120MA) && (currSixty < curr120MA); // 60MA가 계속 120MA 아래에 있음
      const buyCrossOrAbove = buyCross || sixtyAbove120; // 매수 조건: 상방 돌파 또는 계속 위에 있음
      const sellCrossOrBelow = sellCross || sixtyBelow120; // 매도 조건: 하방 돌파 또는 계속 아래에 있음
      
      // 60MA와 120MA의 기울기 차이 계산 (60MA가 120MA보다 얼마나 빠르게 상승하는지)
      const sixtyMA_slope = currSixty - (sixtyEMA[prevIndex].value as number);
      const onetwentyMA_slope = curr120MA - prev120MA;
      const slopeDifference = sixtyMA_slope - onetwentyMA_slope;

      // 60MA 기울기 변화 확인 (상방으로 바뀌는지)
      const is60MAUpwardChange = sixtyMA_slope > 0 && (prevIndex > 0 ? ((sixtyEMA[prevIndex].value as number) - (sixtyEMA[prevIndex-1].value as number)) <= 0 : false);

      // 60MA가 120MA를 큰 기울기로 상방 관통하는지 확인
      const strongBuyCross = buyCross && (slopeDifference > 0.5); // 0.5는 기울기 차이 임계값으로 조정 가능
      
      // 기울기 계산 (각도 단위)
      const timeDiff = 10;
      const sixtyMA_angle = Math.atan(sixtyMA_slope / timeDiff) * (180 / Math.PI);
      const onetwentyMA_angle = Math.atan(onetwentyMA_slope / timeDiff) * (180 / Math.PI);
      const twofortyMA_angle = Math.atan((curr240MA - prev240MA) / timeDiff) * (180 / Math.PI);
      const threesixtyMA_angle = Math.atan((curr360MA - prev360MA) / timeDiff) * (180 / Math.PI);
      
      // 360MA 기울기가 작은지 확인 (횡보 상태)
      const is360MASideways = Math.abs(threesixtyMA_angle) < 0.1; // 0.1도 미만은 횡보로 간주
      
      // 정배열/역배열 확인
      const isNormalAlignment = currSixty > curr120MA && curr120MA > curr240MA && curr240MA > curr360MA;
      const isReverseAlignment = currSixty < curr120MA && curr120MA < curr240MA && curr240MA < curr360MA;
      const isFullReverseAlignment = isReverseAlignment && sixtyBelow120;
      
      // 매수 기울기 조건
      const buySlope = sixtyMA_angle > 0 && onetwentyMA_angle > 0;
      
      // 매도 기울기 조건
      const sellSlope = sixtyMA_angle < 0 && onetwentyMA_angle < 0;
      
      // 초기 매수 조건 확인 (360MA 횡보 상태 무시)
      if (isFirstBuy) {
        console.log(`초기 매수 조건 확인 (360MA 횡보 상태 무시): isReverseAlignment=${isReverseAlignment}, is60MAUpwardChange=${is60MAUpwardChange}, buyCross=${buyCross}`);
        
        // 초기 매수 조건 (역배열에서 60MA가 상방으로 바뀌고 120MA 통과시)
        if (isReverseAlignment && is60MAUpwardChange && buyCross) {
          console.log(`FIRST BUY signal generated at ${new Date(currentTime * 1000).toLocaleTimeString()} - 역배열에서 60MA 상방 전환 및 120MA 통과`);
          
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
              ma240: curr240MA - (prev240Index >= 0 && ma240Data ? ma240Data[prev240Index].value as number : 0),
              ma360: curr360MA - (prev360Index >= 0 && ma360Data ? ma360Data[prev360Index].value as number : 0)
            },
            deviations: {
              ma120: ((currSixty / curr120MA) * 100) - 100,
              ma240: ((currSixty / curr240MA) * 100) - 100
            }
          });
          
          lastAction = 'buy';
          lastActionTime = currentTime;
          return crossPoints; // 초기 매수 신호 발견 시 바로 반환
        }
      } else {
        // 일반 매수/매도 조건 (360MA 횡보 상태일 때만)
        if (is360MASideways) {
          // 매수 조건
          if ((lastAction === 'sell' || lastAction === null) && 
              ((gapNarrowing && buyCrossOrAbove && buySlope) ||
               (isNormalAlignment && buyCrossOrAbove))) {
            
            // 매수 신호 생성 코드
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
                ma240: curr240MA - (prev240Index >= 0 && ma240Data ? ma240Data[prev240Index].value as number : 0),
                ma360: curr360MA - (prev360Index >= 0 && ma360Data ? ma360Data[prev360Index].value as number : 0)
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
                  ma60: currSixty - (sixtyEMA[i-1].value as number),
                  ma120: curr120MA - (prev120Index >= 0 && ma120Data ? ma120Data[prev120Index].value as number : 0),
                  ma240: curr240MA - (prev240Index >= 0 && ma240Data ? ma240Data[prev240Index].value as number : 0),
                  ma360: ma360Index >= 0 && ma360Data ? (ma360Data[ma360Index].value as number) - (ma360Index > 0 ? (ma360Data[ma360Index-1].value as number) : 0) : 0
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
    }
  }
  
  return crossPoints;
};

/**
 * 매수매도 신호를 기반으로 주문 실행 여부를 결정하는 함수
 * @param crossPoints 매수매도 신호 배열
 * @param currentPrice 현재 가격
 * @param ma3Price 3초 이동평균 가격
 * @param isFirstBuy 초기 매수 여부
 * @param lastTradeType 마지막 거래 유형
 * @returns 주문 실행 정보 (실행 여부, 주문 유형, 가격)
 */
export const checkAndExecuteOrder = (
  crossPoints: CrossPoint[],
  currentPrice: number,
  ma3Price: number,
  isFirstBuy: boolean,
  lastTradeType: 'bid' | 'ask' | null
): { shouldExecute: boolean; side: 'bid' | 'ask'; price: number } | null => {
  console.log(`주문 실행 조건 확인: currentPrice=${currentPrice}, ma3Price=${ma3Price}, isFirstBuy=${isFirstBuy}, lastTradeType=${lastTradeType}`);
  
  // 초기 매수 조건 확인 (crossPoints에서 매수 신호가 있는지)
  if (isFirstBuy && crossPoints.length > 0) {
    const lastCrossPoint = crossPoints[crossPoints.length - 1];
    if (lastCrossPoint.position === 'buy') {
      console.log('초기 매수 신호 감지');
      return {
        shouldExecute: true,
        side: 'bid',
        price: currentPrice
      };
    }
  }
  
  // 기존 매수/매도 로직
  if (currentPrice < ma3Price * 0.999) {
    // 매수 조건
    if (lastTradeType === 'ask' || lastTradeType === null) {
      console.log('매수 조건 충족');
      return {
        shouldExecute: true,
        side: 'bid',
        price: currentPrice
      };
    }
  } else if (currentPrice > ma3Price * 1.001 && lastTradeType === 'bid') {
    // 매도 조건
    console.log('매도 조건 충족');
    return {
      shouldExecute: true,
      side: 'ask',
      price: currentPrice
    };
  }
  
  return null;
};

/**
 * 파이썬 코드와 유사한 방식으로 매수매도 신호를 생성하는 함수
 * @param prices 가격 데이터 배열
 * @param currentPrice 현재 가격
 * @returns 매수매도 신호 ('buy', 'sell', 또는 null)
 */
export const getTradeSignal = (prices: number[], currentPrice: number): 'buy' | 'sell' | null => {
  // RSI 계산
  const rsi = computeRSI(prices);
  const currentRSI = rsi[rsi.length - 1];
  
  // MACD 계산
  const [macdLine, macdSignal] = computeMACD(prices);
  const currentMACDLine = macdLine[macdLine.length - 1];
  const currentMACDSignal = macdSignal[macdSignal.length - 1];
  const prevMACDLine = macdLine[macdLine.length - 2];
  const prevMACDSignal = macdSignal[macdSignal.length - 2];
  
  // MACD 크로스 확인
  const macdBullish = (prevMACDLine < prevMACDSignal) && (currentMACDLine > currentMACDSignal);
  
  // 볼린저 밴드 계산
  const [sma, upperBand, lowerBand] = computeBollinger(prices);
  const currentLowerBand = lowerBand[lowerBand.length - 1];
  const currentUpperBand = upperBand[upperBand.length - 1];
  
  // 모멘텀 계산
  const momentum = computeMomentum(prices);
  const currentMomentum = momentum[momentum.length - 1];
  
  // 이동평균 계산
  const ma60 = getMA(prices, 60);
  const ma120 = getMA(prices, 120);
  const ma240 = getMA(prices, 240);
  const ma300 = getMA(prices, 300);
  const ma360 = getMA(prices, 360);
  const ma900 = getMA(prices, 900);
  
  // 상승 추세 확인
  const uptrend6ea = ma60[ma60.length - 1] > ma120[ma120.length - 1] && 
                     ma120[ma120.length - 1] > ma240[ma240.length - 1] && 
                     ma240[ma240.length - 1] > ma300[ma300.length - 1] && 
                     ma300[ma300.length - 1] > ma360[ma360.length - 1] && 
                     ma360[ma360.length - 1] > ma900[ma900.length - 1];
  
  // 매수 조건
  if ((currentRSI < 30) || 
      (macdBullish && uptrend6ea) || 
      (currentPrice < currentLowerBand * 1.01 && currentMomentum > 0)) {
    return 'buy';
  }
  
  // 매도 조건
  if ((currentRSI > 70) || 
      (currentPrice > currentUpperBand * 0.99)) {
    return 'sell';
  }
  
  return null;
};

// 기술적 지표 계산 함수들
function computeRSI(prices: number[], window: number = 14): number[] {
  const result: number[] = [];
  const deltas = prices.slice(1).map((price, i) => price - prices[i]);
  
  const gains = deltas.map(delta => Math.max(delta, 0));
  const losses = deltas.map(delta => Math.abs(Math.min(delta, 0)));
  
  let avgGain = gains.slice(0, window).reduce((sum, gain) => sum + gain, 0) / window;
  let avgLoss = losses.slice(0, window).reduce((sum, loss) => sum + loss, 0) / window;
  
  result.push(100 - (100 / (1 + avgGain / (avgLoss || 1))));
  
  for (let i = window; i < deltas.length; i++) {
    avgGain = (avgGain * (window - 1) + gains[i]) / window;
    avgLoss = (avgLoss * (window - 1) + losses[i]) / window;
    result.push(100 - (100 / (1 + avgGain / (avgLoss || 1))));
  }
  
  return result;
}

function computeMACD(prices: number[], fast: number = 12, slow: number = 26, signal: number = 9): [number[], number[]] {
  const emaFast = calculateEMA(prices, fast);
  const emaSlow = calculateEMA(prices, slow);
  
  const macdLine = emaFast.map((value, i) => value - emaSlow[i]);
  const macdSignal = calculateEMA(macdLine, signal);
  
  return [macdLine, macdSignal];
}

function calculateEMA(prices: number[], period: number): number[] {
  const result: number[] = [];
  const k = 2 / (period + 1);
  
  // 첫 번째 값은 SMA로 초기화
  let ema = prices.slice(0, period).reduce((sum, price) => sum + price, 0) / period;
  result.push(ema);
  
  for (let i = period; i < prices.length; i++) {
    ema = prices[i] * k + ema * (1 - k);
    result.push(ema);
  }
  
  return result;
}

function computeBollinger(prices: number[], window: number = 20, numStd: number = 2): [number[], number[], number[]] {
  const sma: number[] = [];
  const upperBand: number[] = [];
  const lowerBand: number[] = [];
  
  for (let i = window - 1; i < prices.length; i++) {
    const slice = prices.slice(i - window + 1, i + 1);
    const avg = slice.reduce((sum, price) => sum + price, 0) / window;
    const std = Math.sqrt(slice.reduce((sum, price) => sum + Math.pow(price - avg, 2), 0) / window);
    
    sma.push(avg);
    upperBand.push(avg + numStd * std);
    lowerBand.push(avg - numStd * std);
  }
  
  return [sma, upperBand, lowerBand];
}

function computeMomentum(prices: number[], period: number = 10): number[] {
  const result: number[] = [];
  
  for (let i = period; i < prices.length; i++) {
    result.push((prices[i] / prices[i - period]) - 1);
  }
  
  return result;
}

function getMA(prices: number[], period: number, window: number = 3): number[] {
  // 리샘플링 효과를 시뮬레이션하기 위해 단순화된 방법 사용
  const resampled: number[] = [];
  for (let i = 0; i < prices.length; i += period / 60) {
    resampled.push(prices[Math.min(Math.floor(i), prices.length - 1)]);
  }
  
  const result: number[] = [];
  for (let i = window - 1; i < resampled.length; i++) {
    const slice = resampled.slice(i - window + 1, i + 1);
    const avg = slice.reduce((sum, price) => sum + price, 0) / window;
    result.push(avg);
  }
  
  return result;
} 