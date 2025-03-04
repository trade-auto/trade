/**
 * CSV 파일 처리를 위한 유틸리티 함수들
 */

/**
 * CSV 파일을 파싱하여 객체 배열로 변환
 * @param csvData CSV 데이터 문자열
 * @returns 객체 배열
 */
export const parseCSV = (csvData: string): Record<string, any>[] => {
  const lines = csvData.trim().split('\n');
  const headers = lines[0].split(',');
  
  return lines.slice(1).map(line => {
    const values = line.split(',');
    const obj: Record<string, any> = {};
    
    headers.forEach((header, index) => {
      // 숫자로 변환 가능한 값은 숫자로 변환
      const value = values[index];
      if (!isNaN(Number(value)) && value !== '') {
        obj[header] = Number(value);
      } else if (header.includes('timestamp') || header.includes('date') || header.includes('time')) {
        // 타임스탬프나 날짜 형식은 Date 객체로 변환
        obj[header] = new Date(value);
      } else {
        obj[header] = value;
      }
    });
    
    return obj;
  });
};

/**
 * 객체 배열을 CSV 문자열로 변환
 * @param data 객체 배열
 * @returns CSV 문자열
 */
export const generateCSV = (data: Record<string, any>[]): string => {
  if (data.length === 0) return '';
  
  const headers = Object.keys(data[0]);
  const headerRow = headers.join(',');
  
  const rows = data.map(obj => {
    return headers.map(header => {
      const value = obj[header];
      
      // 날짜 객체는 ISO 문자열로 변환
      if (value instanceof Date) {
        return value.toISOString();
      }
      
      // 문자열에 쉼표가 포함되어 있으면 따옴표로 감싸기
      if (typeof value === 'string' && value.includes(',')) {
        return `"${value}"`;
      }
      
      return value;
    }).join(',');
  });
  
  return [headerRow, ...rows].join('\n');
};

/**
 * CSV 데이터에서 특정 시간 범위의 데이터만 필터링
 * @param data CSV 데이터 객체 배열
 * @param startTime 시작 시간
 * @param endTime 종료 시간
 * @param timeField 시간 필드 이름
 * @returns 필터링된 데이터
 */
export const filterByTimeRange = (
  data: Record<string, any>[],
  startTime: Date,
  endTime: Date,
  timeField: string = 'timestamp(KST)'
): Record<string, any>[] => {
  return data.filter(item => {
    const itemTime = item[timeField] instanceof Date 
      ? item[timeField] 
      : new Date(item[timeField]);
    
    return itemTime >= startTime && itemTime <= endTime;
  });
};

/**
 * CSV 데이터에서 특정 가격 범위의 데이터만 필터링
 * @param data CSV 데이터 객체 배열
 * @param minPrice 최소 가격
 * @param maxPrice 최대 가격
 * @param priceField 가격 필드 이름
 * @returns 필터링된 데이터
 */
export const filterByPriceRange = (
  data: Record<string, any>[],
  minPrice: number,
  maxPrice: number,
  priceField: string = 'close'
): Record<string, any>[] => {
  return data.filter(item => {
    const price = item[priceField];
    return price >= minPrice && price <= maxPrice;
  });
};

/**
 * CSV 데이터에서 특정 필드의 통계 계산
 * @param data CSV 데이터 객체 배열
 * @param field 통계를 계산할 필드 이름
 * @returns 통계 정보
 */
export const calculateStatistics = (
  data: Record<string, any>[],
  field: string
): { min: number; max: number; avg: number; median: number; std: number } => {
  const values = data.map(item => item[field]).filter(val => !isNaN(val)) as number[];
  
  if (values.length === 0) {
    return { min: 0, max: 0, avg: 0, median: 0, std: 0 };
  }
  
  // 정렬된 값 배열
  const sortedValues = [...values].sort((a, b) => a - b);
  
  // 최소값, 최대값
  const min = sortedValues[0];
  const max = sortedValues[sortedValues.length - 1];
  
  // 평균
  const sum = sortedValues.reduce((acc, val) => acc + val, 0);
  const avg = sum / sortedValues.length;
  
  // 중앙값
  const mid = Math.floor(sortedValues.length / 2);
  const median = sortedValues.length % 2 === 0
    ? (sortedValues[mid - 1] + sortedValues[mid]) / 2
    : sortedValues[mid];
  
  // 표준편차
  const squaredDiffs = sortedValues.map(val => Math.pow(val - avg, 2));
  const variance = squaredDiffs.reduce((acc, val) => acc + val, 0) / sortedValues.length;
  const std = Math.sqrt(variance);
  
  return { min, max, avg, median, std };
};

/**
 * CSV 데이터에서 특정 필드의 변화율 계산
 * @param data CSV 데이터 객체 배열
 * @param field 변화율을 계산할 필드 이름
 * @param periods 기간 (몇 개의 데이터 포인트 간격으로 계산할지)
 * @returns 변화율이 추가된 데이터
 */
export const calculateChangeRate = (
  data: Record<string, any>[],
  field: string,
  periods: number = 1
): Record<string, any>[] => {
  return data.map((item, index) => {
    const result = { ...item };
    
    if (index >= periods) {
      const currentValue = item[field];
      const previousValue = data[index - periods][field];
      
      if (previousValue !== 0) {
        result[`${field}_change_rate`] = (currentValue / previousValue - 1) * 100;
      } else {
        result[`${field}_change_rate`] = 0;
      }
    } else {
      result[`${field}_change_rate`] = 0;
    }
    
    return result;
  });
};

/**
 * CSV 데이터에서 이동평균 계산
 * @param data CSV 데이터 객체 배열
 * @param field 이동평균을 계산할 필드 이름
 * @param period 이동평균 기간
 * @returns 이동평균이 추가된 데이터
 */
export const calculateMovingAverage = (
  data: Record<string, any>[],
  field: string,
  period: number
): Record<string, any>[] => {
  return data.map((item, index) => {
    const result = { ...item };
    
    if (index >= period - 1) {
      const values = data.slice(index - period + 1, index + 1).map(d => d[field]);
      const sum = values.reduce((acc, val) => acc + val, 0);
      result[`${field}_ma${period}`] = sum / period;
    } else {
      result[`${field}_ma${period}`] = null;
    }
    
    return result;
  });
};

/**
 * CSV 데이터에서 RSI 계산
 * @param data CSV 데이터 객체 배열
 * @param field RSI를 계산할 필드 이름
 * @param period RSI 기간
 * @returns RSI가 추가된 데이터
 */
export const calculateRSI = (
  data: Record<string, any>[],
  field: string,
  period: number = 14
): Record<string, any>[] => {
  const result = data.map((item, index) => {
    return { ...item };
  });
  
  // 가격 변화 계산
  for (let i = 1; i < data.length; i++) {
    result[i]['price_change'] = data[i][field] - data[i - 1][field];
  }
  
  // 상승/하락 계산
  for (let i = 1; i < data.length; i++) {
    result[i]['gain'] = Math.max(0, result[i]['price_change']);
    result[i]['loss'] = Math.abs(Math.min(0, result[i]['price_change']));
  }
  
  // 첫 번째 평균 상승/하락 계산
  if (data.length > period) {
    let avgGain = 0;
    let avgLoss = 0;
    
    for (let i = 1; i <= period; i++) {
      avgGain += result[i]['gain'];
      avgLoss += result[i]['loss'];
    }
    
    avgGain /= period;
    avgLoss /= period;
    
    result[period]['avg_gain'] = avgGain;
    result[period]['avg_loss'] = avgLoss;
    result[period]['rsi'] = 100 - (100 / (1 + avgGain / (avgLoss || 1)));
    
    // 나머지 기간 계산
    for (let i = period + 1; i < data.length; i++) {
      avgGain = (result[i - 1]['avg_gain'] * (period - 1) + result[i]['gain']) / period;
      avgLoss = (result[i - 1]['avg_loss'] * (period - 1) + result[i]['loss']) / period;
      
      result[i]['avg_gain'] = avgGain;
      result[i]['avg_loss'] = avgLoss;
      result[i]['rsi'] = 100 - (100 / (1 + avgGain / (avgLoss || 1)));
    }
  }
  
  return result;
};

/**
 * CSV 데이터에서 볼린저 밴드 계산
 * @param data CSV 데이터 객체 배열
 * @param field 볼린저 밴드를 계산할 필드 이름
 * @param period 볼린저 밴드 기간
 * @param multiplier 표준편차 승수
 * @returns 볼린저 밴드가 추가된 데이터
 */
export const calculateBollingerBands = (
  data: Record<string, any>[],
  field: string,
  period: number = 20,
  multiplier: number = 2
): Record<string, any>[] => {
  return data.map((item, index) => {
    const result = { ...item };
    
    if (index >= period - 1) {
      const values = data.slice(index - period + 1, index + 1).map(d => d[field]);
      const sum = values.reduce((acc, val) => acc + val, 0);
      const sma = sum / period;
      
      const squaredDiffs = values.map(val => Math.pow(val - sma, 2));
      const variance = squaredDiffs.reduce((acc, val) => acc + val, 0) / period;
      const std = Math.sqrt(variance);
      
      result[`${field}_sma`] = sma;
      result[`${field}_upper_band`] = sma + multiplier * std;
      result[`${field}_lower_band`] = sma - multiplier * std;
    } else {
      result[`${field}_sma`] = null;
      result[`${field}_upper_band`] = null;
      result[`${field}_lower_band`] = null;
    }
    
    return result;
  });
}; 