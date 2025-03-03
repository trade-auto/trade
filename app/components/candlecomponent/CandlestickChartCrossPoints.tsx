import { Time, LineData } from 'lightweight-charts';
import { CrossPoint } from './CandlestickChartTypes';
import { calculateSlope } from './CandlestickChartHelpers';

/**
 * 매수/매도 신호 생성 로직
 * 60MA, 120MA, 240MA, 360MA 데이터를 기반으로 매수/매도 신호를 생성합니다.
 */
export const findCrossPoints = (
  sixtyEMA: LineData<Time>[], 
  oneTwentyEMA: LineData<Time>[], 
  twoFortyEMA: LineData<Time>[],
  threeSixtyEMA: LineData<Time>[]
): CrossPoint[] => {
  const crossPoints: CrossPoint[] = [];
  let lastAction: 'buy' | 'sell' | null = null;
  let lastActionTime: number = 0;
  const startTime = Math.floor(Date.now() / 1000) - 1500; // 현재 시간에서 25분 전 부터 매매

  for (let i = 11; i < sixtyEMA.length; i++) {
    const currentTime = sixtyEMA[i].time as number;
    
    // 시작 시간 이전의 신호는 무시
    if (currentTime < startTime) continue;
    
    const currSixty = sixtyEMA[i].value;
    const currOneTwenty = oneTwentyEMA[i].value;
    const currTwoForty = twoFortyEMA[i].value;
    const currThreeSixty = threeSixtyEMA[i].value;

    const prevSixty = sixtyEMA[i - 10].value;
    const prevOneTwenty = oneTwentyEMA[i - 10].value;
    const prevTwoForty = twoFortyEMA[i - 10].value;

    // 이격도 조건
    const currentGap = Math.abs(currOneTwenty - currTwoForty);
    const previousGap = Math.abs(prevOneTwenty - prevTwoForty);
    const gapNarrowing = currentGap < previousGap;

    // 크로스 조건
    const buyCross = (prevSixty < prevOneTwenty) && (currSixty > currOneTwenty);
    const sellCross = (prevSixty > prevOneTwenty) && (currSixty < currOneTwenty);

    // 기울기 조건
    const timeDiff = 10; // 10초
    // 직접 기울기 계산
    const slopeOneTwenty = ((currOneTwenty - prevOneTwenty) / prevOneTwenty) * 100;
    const slopeTwoForty = ((currTwoForty - prevTwoForty) / prevTwoForty) * 100;

    const buySlope = (slopeOneTwenty >= 5) && (slopeTwoForty >= 5);
    const sellSlope = (slopeOneTwenty <= -2) && (slopeTwoForty <= -2);

    // 보유 조건
    const proximityThreshold = 0.005; // 0.5%
    const holdCondition = Math.abs(currThreeSixty - currTwoForty) / currThreeSixty < proximityThreshold;

    // 최종 전략 결정
    if (holdCondition) {
      // 포지션 유지
      continue;
    } else {
      if (gapNarrowing && buyCross && buySlope && lastAction !== 'buy') {
        crossPoints.push({
          time: sixtyEMA[i].time,
          position: 'buy',
          price: currSixty,
          isAbove360MA: false,
          slopes: {
            ma60: currSixty - prevSixty,
            ma120: currOneTwenty - prevOneTwenty,
            ma240: currTwoForty - prevTwoForty,
            ma360: currThreeSixty - prevTwoForty
          }
        });
        lastAction = 'buy';
        lastActionTime = currentTime;
      } else if (gapNarrowing && sellCross && sellSlope && lastAction === 'buy') {
        crossPoints.push({
          time: sixtyEMA[i].time,
          position: 'sell',
          price: currSixty,
          isAbove360MA: false,
          slopes: {
            ma60: currSixty - prevSixty,
            ma120: currOneTwenty - prevOneTwenty,
            ma240: currTwoForty - prevTwoForty,
            ma360: currThreeSixty - prevTwoForty
          }
        });
        lastAction = 'sell';
        lastActionTime = currentTime;
      }
    }
  }

  return crossPoints;
}; 