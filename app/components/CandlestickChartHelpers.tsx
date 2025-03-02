import { Time, LineData } from 'lightweight-charts';
import { ExtendedCandlestickData } from '../types/candlestick';
import { BusinessDay, DateRange } from './CandlestickChartTypes';

// 차트 관련 상수
export const MIN_SLOPE_THRESHOLD = 2;
export const MAX_SLOPE_THRESHOLD = 5;
export const THRESHOLD_ANGLE_360 = MAX_SLOPE_THRESHOLD;
export const THRESHOLD_ANGLE_360_MINUS = -MIN_SLOPE_THRESHOLD;
export const THRESHOLD_ANGLE_40 = MAX_SLOPE_THRESHOLD;
export const THRESHOLD_ANGLE_40_MINUS = -MIN_SLOPE_THRESHOLD;
export const THRESHOLD_ANGLE_60 = MAX_SLOPE_THRESHOLD;
export const THRESHOLD_ANGLE_60_MINUS = -MIN_SLOPE_THRESHOLD;
export const THRESHOLD_ANGLE_120 = MAX_SLOPE_THRESHOLD;
export const THRESHOLD_ANGLE_120_MINUS = -MIN_SLOPE_THRESHOLD;
export const THRESHOLD_ANGLE_60_PLUS = THRESHOLD_ANGLE_60;
export const THRESHOLD_ANGLE_120_PLUS = THRESHOLD_ANGLE_120;

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

/**
 * chartType에 따라 x축의 tick 표시 형식을 반환한다.
 * - 초봉: HH:mm:ss  
 * - 일봉: YYYY.MM.DD HH:mm  
 * - 월봉: YYYY년 M월  
 * - 년봉: YYYY년  
 * - 기본 분봉: HH:mm  
 *
 * 데이터의 시간 값은 timestamp(number) 또는 BusinessDay 객체일 수 있으므로
 * 이를 구분하여 Date 객체로 변환한 후 포맷팅한다.
 */
export const getTickMarkFormatter = (chartType: string): ((time: number | BusinessDay, tickMarkType?: any) => string) => {
  return (time: number | BusinessDay): string => {
    let date: Date;
    if (typeof time === "number") {
      // timestamp (초 단위)인 경우
      date = new Date(time * 1000);
    } else {
      // BusinessDay 객체인 경우
      date = new Date(time.year, time.month - 1, time.day);
    }
    if (chartType.indexOf("일봉") !== -1) {
      // 일봉: 날짜와 시간 모두 표시 (예, "2023.10.12 09:30")
      const datePart = date.toLocaleDateString("ko-KR", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      });
      const timePart = date.toLocaleTimeString("ko-KR", {
        hour: "2-digit",
        minute: "2-digit",
      });
      return `${datePart} ${timePart}`;
    } else if (chartType.indexOf("월봉") !== -1) {
      // 월봉: 연도와 월 (예, "2023년 10월")
      return `${date.getFullYear()}년 ${date.getMonth() + 1}월`;
    } else if (chartType.indexOf("년봉") !== -1) {
      // 년봉: 연도만 (예, "2023년")
      return `${date.getFullYear()}년`;
    } else if (chartType.indexOf("seconds") !== -1) {
      // 초봉: HH:mm:ss
      return date.toLocaleTimeString("ko-KR", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });
    } else {
      // 기본적으로 분봉 등: HH:mm
      return date.toLocaleTimeString("ko-KR", {
        hour: "2-digit",
        minute: "2-digit",
      });
    }
  };
};

/**
 * EMA(지수 이동 평균) 계산 함수
 */
export const calculateEMA = (data: ExtendedCandlestickData[], period: number): LineData<Time>[] => {
  if (!data || data.length === 0 || period <= 0) return [];
  
  const emaData: LineData<Time>[] = [];
  let multiplier = 2 / (period + 1);
  let initialSMA = 0;
  
  const validData = data.filter(item => item && item.close !== undefined);
  
  if (validData.length === 0) return [];
  
  for (let i = 0; i < Math.min(period, validData.length); i++) {
    initialSMA += validData[i].close;
  }
  initialSMA /= Math.min(period, validData.length);
  
  if (validData.length > 0) {
    emaData.push({
      time: validData[0].time,
      value: initialSMA
    });
  }
  
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

/**
 * 시간 포맷팅 함수
 */
export const formatTime = (time: Time): string => {
  if (typeof time === 'number') {
    return new Date(time * 1000).toLocaleString();
  } else if (typeof time === 'object' && time !== null) {
    const businessDay = time as BusinessDay;
    return new Date(businessDay.year, businessDay.month - 1, businessDay.day).toLocaleDateString();
  }
  return String(time);
};

/**
 * 기울기 계산 함수
 */
export const calculateSlope = (data: ExtendedCandlestickData[], period: number): number => {
  if (data.length < 2) return 0;
  
  const maData = calculateEMA(data, period);
  if (maData.length < 2) return 0;
  
  const last = maData[maData.length - 1].value;
  const prev = maData[maData.length - 2].value;
  
  return ((last - prev) / prev) * 100;
};

/**
 * 각도 계산 함수
 */
export const calculateAngle = (currentValue: number, previousValue: number, timeDiff: number = 10): number => {
  if (timeDiff === 0 || currentValue === undefined || previousValue === undefined) return 0;
  
  const angleRad = Math.atan((currentValue - previousValue) / timeDiff);
  const angleDeg = angleRad * (180 / Math.PI);
  
  return angleDeg;
}; 