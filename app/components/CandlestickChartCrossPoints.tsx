import { Time, LineData } from 'lightweight-charts';
import { CrossPoint } from './CandlestickChartTypes';

/**
 * 매수/매도 신호 생성 로직
 * 60MA, 120MA, 240MA, 360MA 데이터를 기반으로 매수/매도 신호를 생성합니다.
 */
export const findCrossPoints = (
  sixtyEMA: LineData<Time>[], 
  oneTwentyEMA: LineData<Time>[], 
  twoFortyEMA: LineData<Time>[],
  threeHundredSixtyEMA: LineData<Time>[]
): CrossPoint[] => {
  const crossPoints: CrossPoint[] = [];
  let lastAction: 'buy' | 'sell' | null = null;
  let lastActionTime: number = 0;
  const startTime = Math.floor(Date.now() / 1000) - 3600; // 현재 시간에서 60분 전 부터 매매
  
  // 조건 지속 시간 추적을 위한 변수들
  let buyConditionStartTime: number | null = null;
  let sellConditionStartTime: number | null = null;
  const CONDITION_DURATION_THRESHOLD = 10; // 10초 지속 조건
  const MIN_TIME_BETWEEN_TRADES = 30; // 30초 - 루프 외부로 이동
  
  // 60MA 기울기 변화 추적을 위한 변수들 ,,,3분(180초) 이내에 120MA 통과 조건
  let ma60SlopeChangeTime: number | null = null;
  let prevMA60Slope: number | null = null;
  const MA_CROSS_TIME_LIMIT = 180; // 3분(180초) 이내에 120MA 통과 조건
  
  for (let i = 11; i < sixtyEMA.length; i++) {
    const currentTime = sixtyEMA[i].time as number;
    
    // 시작 시간 이전의 신호는 무시
    if (currentTime < startTime) continue;
    
    const currSixty = sixtyEMA[i].value;
    
    // 240MA 관련 데이터 계산
    const tolerance = 3; // 초 단위 허용 오차
    const ma240Index = twoFortyEMA ? twoFortyEMA.findIndex(d => Math.abs((d.time as number) - (sixtyEMA[i].time as number)) < tolerance) : -1;
    const ma120Index = oneTwentyEMA ? oneTwentyEMA.findIndex(d => Math.abs((d.time as number) - (sixtyEMA[i].time as number)) < tolerance) : -1;
    const ma360Index = threeHundredSixtyEMA ? threeHundredSixtyEMA.findIndex(d => Math.abs((d.time as number) - (sixtyEMA[i].time as number)) < tolerance) : -1;
    
    // 10초 전 인덱스 계산
    const prevIndex = i - 5;
    if (prevIndex < 0 || !sixtyEMA[prevIndex] || !sixtyEMA[i]) continue;
    
    // 현재 시점과 10초 전 시점의 120MA와 240MA 값 가져오기
    const curr120MA = ma120Index >= 0 && oneTwentyEMA && oneTwentyEMA[ma120Index] ? oneTwentyEMA[ma120Index].value : 0;
    const curr240MA = ma240Index >= 0 && twoFortyEMA && twoFortyEMA[ma240Index] ? twoFortyEMA[ma240Index].value : 0;
    const curr360MA = ma360Index >= 0 && threeHundredSixtyEMA && threeHundredSixtyEMA[ma360Index] ? threeHundredSixtyEMA[ma360Index].value : 0;
    
    // 10초 전 120MA와 240MA 인덱스 찾기
    const prev120Index = oneTwentyEMA ? oneTwentyEMA.findIndex(d => Math.abs((d.time as number) - (sixtyEMA[prevIndex].time as number)) < tolerance) : -1;
    const prev240Index = twoFortyEMA ? twoFortyEMA.findIndex(d => Math.abs((d.time as number) - (sixtyEMA[prevIndex].time as number)) < tolerance) : -1;
    const prev360Index = threeHundredSixtyEMA ? threeHundredSixtyEMA.findIndex(d => Math.abs((d.time as number) - (sixtyEMA[prevIndex].time as number)) < tolerance) : -1;
    const prev120MA = prev120Index >= 0 && oneTwentyEMA ? oneTwentyEMA[prev120Index].value : 0;
    const prev240MA = prev240Index >= 0 && twoFortyEMA ? twoFortyEMA[prev240Index].value : 0;
    const prev360MA = prev360Index >= 0 && threeHundredSixtyEMA ? threeHundredSixtyEMA[prev360Index].value : 0;   
    
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
    const slope60MA = Math.atan2(currSixty - sixtyEMA[prevIndex].value, timeDiff) * (180 / Math.PI);
    const slope120MA = Math.atan2(curr120MA - prev120MA, timeDiff) * (180 / Math.PI);
    const slope240MA = Math.atan2(curr240MA - prev240MA, timeDiff) * (180 / Math.PI);
    const slope360MA = Math.atan2(curr360MA - prev360MA, timeDiff) * (180 / Math.PI);

    // 기울기 조건
    const sloped360 = 15;
    const is240MAUpward = slope240MA > 10; // 상향 기울기
    const is360MAUpward = slope360MA > sloped360; // 상향 기울기
    const is240MADownward = slope240MA > 10;
    const is360MADownward = slope360MA > sloped360;
    const is240MADownwardrev = slope240MA < -2;
    const is360MADownwardrev = slope360MA < -2;
    const buySlope = (slope120MA >= 10) && (slope240MA >= 10); // 10도 이상 상향
    const sellSlope = (slope120MA <= -2) && (slope240MA <= -2); // -2도 이하 하향

    // 60MA 기울기 변화 감지 (하방 -> 상방) ,,3분(180초) 이내에 120MA 통과 조건
    const is60MAUpward = slope60MA > 0;
    const is60MADownward = slope60MA < 0;
    
    // 60MA 기울기 변화 추적
    if (prevMA60Slope !== null) {
      // 60MA 기울기가 하방에서 상방으로 변경된 경우
      if (prevMA60Slope < 0 && slope60MA > 0) {
        ma60SlopeChangeTime = currentTime;
      }
    }
    
    // 현재 60MA 기울기 저장
    prevMA60Slope = slope60MA;

    // 360MA 기울기가 +/- 15도 이내인지 확인 (횡보 상태)
    const is360MASideways = Math.abs(slope360MA) <= sloped360;
    
    // 시간 간격 조건 확인
    const timeSinceLastAction = currentTime - lastActionTime;

    // 정배열/역배열 상태 확인
    const isProperAlignment = curr120MA > curr240MA;
    const isProperAlignmentrev = curr120MA < curr240MA;
    const ma360Value = ma360Index >= 0 && threeHundredSixtyEMA && threeHundredSixtyEMA[ma360Index] ? threeHundredSixtyEMA[ma360Index].value : 0;
    const is240MABelowMA360 = curr240MA < ma360Value;
    const isProperAlignmentFull = (curr240MA > ma360Value);
    const isReverseAlignment = (ma360Value > curr240MA) && (curr240MA > curr120MA);

    // 60MA, 120MA, 240MA의 정배열/역배열 상태 확인
    const isFullProperAlignment = (currSixty > curr120MA) && (curr120MA > curr240MA); // 완전 정배열: 60MA > 120MA > 240MA
    const isFullReverseAlignment = (currSixty < curr120MA) && (curr120MA < curr240MA); // 완전 역배열: 60MA < 120MA < 240MA
    let prev60MASlope: number = 0;
    let prev60MASlopeTime: number = 0;
    const SLOPE_CHANGE_THRESHOLD = 30; //
    
    // 60MA와 120MA의 기울기가 하강인지 확인
    // const slope60MA = sixtyMA_slope; // 60MA 기울기
    // const is60MADownward = slope60MA < 0; // 60MA 기울기가 음수이면 하강
    // const is120MADownward = slope120MA < 0; // 120MA 기울기가 음수이면 하강
    // const isBothMADownward = is60MADownward && is120MADownward; // 두 MA 모두 하강 기울기

    const isBothMADownward = is60MADownward && (slope120MA < 0); // 두 MA 모두 하강 기울기

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
    
    // 새로운 매수 조건: 60MA가 하방 기울기였다가 상방으로 바뀌고 3분 이내에 120MA를 통과
    const ma60SlopeChangeToBuyCross = 
      ma60SlopeChangeTime !== null && 
      buyCross && 
      (currentTime - ma60SlopeChangeTime <= MA_CROSS_TIME_LIMIT);
    
    // 시간 간격 조건 다시 확인 (중요한 조건이므로 이중 확인)
    if ((!is360MASideways) && (timeSinceLastAction >= MIN_TIME_BETWEEN_TRADES)) {  
      if (isBothMADownward && !isRapidSlopeChange) { 
        // 하강 기울기일 때는 lastActionTime을 업데이트하여 30초 동안 매수하지 않음
        lastActionTime = currentTime;
      } 
      
      // 매수 조건
      if ((lastAction !== 'buy' && 
        (ma60SlopeChangeToBuyCross || // 새로운 조건: 60MA 기울기 변화 후 3분 이내 120MA 통과
         isRapidSlopeChange || // 30초 이내 60MA 기울기가 급하강에서 급상승으로 변경
         (!isBothMADownward && // 60MA와 120MA가 모두 하강 기울기가 아닐 때
          (strongBuyCross || // 60MA가 120MA를 큰 기울기로 상방 관통
           (gapNarrowing && buyCrossOrAbove && buySlope) || 
           (isFullProperAlignment && buyCrossOrAbove) || 
           (isProperAlignmentFull && buyCrossOrAbove && is360MAUpward))
         )) && 
        !isReverseAlignment)) {
        
        // 매수 신호 생성
        crossPoints.push({
          time: sixtyEMA[i].time,
          position: 'buy',
          price: currSixty,
          isAbove360MA: currSixty > curr360MA,
          isAbove240MA: currSixty > curr240MA,
          isAbove120MA: currSixty > curr120MA,
          isAbove60MA: true,
          slopes: {
            ma60: sixtyMA_slope,
            ma120: onetwentyMA_slope,
            ma240: curr240MA - (prev240Index >= 0 && twoFortyEMA ? twoFortyEMA[prev240Index].value : 0),
            ma360: curr360MA - (prev360Index >= 0 && threeHundredSixtyEMA ? threeHundredSixtyEMA[prev360Index].value : 0)
          },
          deviations: {
            ma120: ((currSixty / curr120MA) * 100) - 100,
            ma240: ((currSixty / curr240MA) * 100) - 100
          },
          // 새로운 매수 조건 정보 추가,,, 3분(180초) 이내에 120MA 통과 조건
          ma60SlopeChange: ma60SlopeChangeToBuyCross ? {
            changeTime: ma60SlopeChangeTime,
            crossTime: currentTime,
            timeDiff: ma60SlopeChangeTime ? currentTime - ma60SlopeChangeTime : null
          } : null
        });
        
        lastAction = 'buy';
        lastActionTime = currentTime;
      }
      // 매도 조건
      else if (lastAction == 'buy' && 
               ((gapNarrowing && sellCrossOrBelow && sellSlope) ||
                (isFullReverseAlignment && sellCrossOrBelow))) {
        
        // 매도 신호 생성
        crossPoints.push({
          time: sixtyEMA[i].time,
          position: 'sell',
          price: currSixty,
          isAbove360MA: currSixty > curr360MA,
          isAbove240MA: currSixty > curr240MA,
          isAbove120MA: currSixty > curr120MA,
          isAbove60MA: true,
          slopes: {
            ma60: currSixty - sixtyEMA[i-1].value,
            ma120: curr120MA - (prev120Index >= 0 && oneTwentyEMA ? oneTwentyEMA[prev120Index].value : 0),
            ma240: curr240MA - (prev240Index >= 0 && twoFortyEMA ? twoFortyEMA[prev240Index].value : 0),
            ma360: ma360Index >= 0 && threeHundredSixtyEMA ? threeHundredSixtyEMA[ma360Index].value - (ma360Index > 0 ? threeHundredSixtyEMA[ma360Index-1].value : 0) : 0
          }
        });
        
        lastAction = 'sell';
        lastActionTime = currentTime;
      }
    }
  }
  
  return crossPoints;
}; 