import { DateRange, UpbitCandle } from "../types/type";
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
  
export const loadAllData = async ({
  candleSeries,
  symbol,
  chartType,
  startDate,
  endDate,
  onProgress,
  onError,
  onSuccess
}: {
  candleSeries: any;
  symbol: string;
  chartType: string;
  startDate: Date;
  endDate: Date;
  onProgress: (progress: number) => void;
  onError: (error: Error) => void;
  onSuccess: (formattedData: any[]) => void;
}) => {
  try {
    const allCandleData: UpbitCandle[] = [];
    // ... 나머지 코드
  } catch (error) {
    onError(error instanceof Error ? error : new Error('Unknown error'));
  }
};
  