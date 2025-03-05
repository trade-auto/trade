import { create } from 'zustand';
import {
  DateRange,
  ExtendedCandlestickData,
  CrossPoint,
  BacktestResult,
  MASettings,
  UpbitCandle
} from '../types/candlestick';
import {
  getInitialDateRange,
  findCrossPoints,
  calculateEMA,
  getChartEndpoint,
  calculateBacktestResult,
} from '../utils/chartHelpers';
import { Time, BusinessDay } from 'lightweight-charts';

interface ChartState {
  // 차트 데이터
  allData: ExtendedCandlestickData[];
  crossPoints: CrossPoint[];
  backtestResult: BacktestResult | null;
  
  // 설정 상태
  dateRange: DateRange;
  isAutoUpdate: boolean;
  isRealtimeAPIEnabled: boolean;
  showMA: MASettings;
  
  // 로딩 상태
  isLoading: boolean;
  progress: number;
  lastUpdated: Date | null;
  currentPrice: number;
  chartPrice: number;
  
  // 데이터 로드 상태
  ongoingRequest: boolean;
}

interface ChartActions {
  // 상태 업데이트 메서드
  setDateRange: (dateRange: DateRange) => void;
  setStartDate: (date: Date) => void;
  setEndDate: (date: Date | null) => void;
  setAutoUpdate: (isAutoUpdate: boolean) => void;
  toggleAutoUpdate: () => void;
  setRealtimeAPIEnabled: (isEnabled: boolean) => void;
  toggleRealtimeAPIEnabled: () => void;
  setShowMA: (showMA: MASettings) => void;
  
  // 데이터 로드 및 처리 메서드
  loadData: (symbol: string, chartType: string) => Promise<void>;
  updatePriceFromWebsocket: (price: number) => void;
  
  // 타임스탬프 처리 유틸리티
  getTimeValue: (time: Time | BusinessDay | string) => number;
}

// Zustand 스토어 생성
const useChartStore = create<ChartState & ChartActions>((set, get) => ({
  // 초기 상태
  allData: [],
  crossPoints: [],
  backtestResult: null,
  
  dateRange: getInitialDateRange('minutes/1'),
  isAutoUpdate: true,
  isRealtimeAPIEnabled: true,
  showMA: {
    sixty: true,
    oneTwenty: true,
    twoForty: true,
    threeHundredSixty: true,
    threeHundred: true,
    nineHundred: true,
  },
  
  isLoading: false,
  progress: 0,
  lastUpdated: null,
  currentPrice: 0,
  chartPrice: 0,
  
  ongoingRequest: false,
  
  // 상태 업데이트 메서드
  setDateRange: (dateRange) => set({ dateRange }),
  setStartDate: (startDate) => set((state) => ({
    dateRange: { ...state.dateRange, startDate }
  })),
  setEndDate: (endDate) => set((state) => ({
    dateRange: { ...state.dateRange, endDate }
  })),
  setAutoUpdate: (isAutoUpdate) => set({ isAutoUpdate }),
  toggleAutoUpdate: () => set((state) => ({ isAutoUpdate: !state.isAutoUpdate })),
  setRealtimeAPIEnabled: (isRealtimeAPIEnabled) => set({ isRealtimeAPIEnabled }),
  toggleRealtimeAPIEnabled: () => set((state) => ({ isRealtimeAPIEnabled: !state.isRealtimeAPIEnabled })),
  setShowMA: (showMA) => set({ showMA }),
  
  // 타임스탬프 처리 유틸리티
  getTimeValue: (time) => {
    if (typeof time === 'number') {
      return time;
    } else if (typeof time === 'string') {
      // ISO 날짜 문자열인 경우
      return new Date(time).getTime() / 1000;
    } else if ('timestamp' in time && typeof time.timestamp === 'number') {
      return time.timestamp;
    } else if ('year' in time && 'month' in time && 'day' in time) {
      // BusinessDay 형식인 경우
      const date = new Date(time.year, time.month - 1, time.day);
      return date.getTime() / 1000;
    }
    
    // 기본값
    return new Date().getTime() / 1000;
  },
  
  // 웹소켓 가격 업데이트
  updatePriceFromWebsocket: (price) => set({ currentPrice: price }),
  
  // 데이터 로드 함수
  loadData: async (symbol, chartType) => {
    const state = get();
    
    // 이미 요청 중이면 중복 요청 방지
    if (state.ongoingRequest) return;
    
    set({ ongoingRequest: true, isLoading: true, progress: 0 });
    
    try {
      const endpoint = getChartEndpoint(chartType);
      
      // 초봉/분봉 차트에 대해 더 많은 데이터를 가져오기 위한 count 계산
      let count = 200; // 기본값
      
      // startDate와 endDate 사이의 간격을 기반으로 count 값 동적 계산
      if (state.dateRange.startDate && state.dateRange.endDate) {
        const timeDiff = state.dateRange.endDate.getTime() - state.dateRange.startDate.getTime();
        
        if (chartType.startsWith('seconds/')) {
          // 초봉: 초 단위로 계산 (초당 1개 캔들)
          const secondsDiff = Math.ceil(timeDiff / 1000);
          count = Math.min(Math.max(secondsDiff, 200), 1000); // 최소 200개, 최대 1000개
        } else if (chartType === 'minutes/1') {
          // 1분봉: 분 단위로 계산 (분당 1개 캔들)
          const minutesDiff = Math.ceil(timeDiff / (60 * 1000));
          count = Math.min(Math.max(minutesDiff, 200), 1000); // 최소 200개, 최대 1000개
        } else {
          // 다른 봉차트: 시간/일/주/월 단위 (각 단위당 1개 캔들)
          count = Math.min(Math.max(Math.ceil(timeDiff / (60 * 60 * 1000)), 200), 1000);
        }
      } else if (chartType.startsWith('seconds/')) {
        count = 400; // 초봉은 400개씩 가져오기 (30분 데이터 표시를 위해 증가)
      }
      
      // 종료 날짜 설정
      const to = state.dateRange.endDate 
        ? state.dateRange.endDate.toISOString() 
        : new Date().toISOString();
      
      console.log(`API 요청: https://api.upbit.com/v1/candles/${endpoint}?market=${symbol}&to=${to}&count=${count}`);
      
      const response = await fetch(
        `https://api.upbit.com/v1/candles/${endpoint}?market=${symbol}&to=${to}&count=${count}`
      );
      
      if (!response.ok) {
        throw new Error('데이터 로딩 실패');
      }
      
      const data: UpbitCandle[] = await response.json();
      
      if (data && data.length > 0) {
        // 진행 상태 업데이트
        set({ progress: 30 });
        
        // 데이터 처리
        let processedData: ExtendedCandlestickData[] = data.map((candle: UpbitCandle) => {
          const time = new Date(candle.candle_date_time_kst).getTime() / 1000;
          return {
            time: time as Time,
            open: candle.opening_price,
            high: candle.high_price,
            low: candle.low_price,
            close: candle.trade_price,
            volume: candle.candle_acc_trade_volume,
          };
        });
        
        // 진행 상태 업데이트
        set({ progress: 50 });
        
        // 데이터 정렬 (최신 데이터가 마지막에 오도록)
        processedData.sort((a, b) => {
          if (typeof a.time === 'number' && typeof b.time === 'number') {
            return a.time - b.time;
          }
          return 0;
        });
        
        // startDate에 따라 데이터 필터링
        if (state.dateRange.startDate) {
          const startTimestamp = state.dateRange.startDate.getTime() / 1000;
          processedData = processedData.filter(candle => {
            const candleTime = typeof candle.time === 'number' 
              ? candle.time 
              : state.getTimeValue(candle.time);
            return candleTime >= startTimestamp;
          });
        }
        
        // 진행 상태 업데이트
        set({ progress: 70 });
        
        // EMA 계산
        const ema60Data = calculateEMA(processedData, 60);
        const ema120Data = calculateEMA(processedData, 120);
        const ema240Data = calculateEMA(processedData, 240);
        const ema360Data = calculateEMA(processedData, 360);
        
        // 교차 지점 계산
        const cross = findCrossPoints(ema60Data, ema120Data, ema240Data, ema360Data);
        
        // 백테스트 결과 계산
        const backtestResult = calculateBacktestResult(processedData, cross, 'test');
        
        // 현재 가격 설정
        let chartPrice = 0;
        if (processedData.length > 0) {
          const lastCandle = processedData[processedData.length - 1];
          chartPrice = lastCandle.close;
        }
        
        // 모든 데이터 저장
        set({
          allData: processedData,
          crossPoints: cross,
          backtestResult,
          chartPrice,
          lastUpdated: new Date(),
          progress: 100,
          isLoading: false,
          ongoingRequest: false
        });
      }
    } catch (error) {
      console.error('데이터 로드 오류:', error);
      set({ isLoading: false, progress: 0, ongoingRequest: false });
    }
  },
}));

export default useChartStore; 