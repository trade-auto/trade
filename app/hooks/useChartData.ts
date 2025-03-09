import { useState, useCallback, useRef } from 'react';
import { 
  ExtendedCandlestickData, 
  UpbitCandle, 
  DateRange, 
  TradeSignal 
} from '../types/candlestick';
import { 
  getChartEndpoint, 
  processCandle, 
  calculateEMA, 
  createTradeMarkers 
} from '../utils/chartHelpers';
import useUpbitStore from '../store/useUpbitStore';

interface UseChartDataProps {
  symbol: string;
  chartType: string;
  dateRange: DateRange;
}

interface UseChartDataReturn {
  allData: ExtendedCandlestickData[];
  progress: number;
  loadData: () => Promise<void>;
  markers: TradeSignal[];
  chartPrice: number;
}

export const useChartData = ({ symbol, chartType, dateRange }: UseChartDataProps): UseChartDataReturn => {
  const [allData, setAllData] = useState<ExtendedCandlestickData[]>([]);
  const [progress, setProgress] = useState(0);
  const [markers, setMarkers] = useState<TradeSignal[]>([]);
  const [chartPrice, setChartPrice] = useState(0);
  
  const ongoingRequestRef = useRef<boolean>(false);
  const { tradeStrategy } = useUpbitStore();
  
  // 데이터 로드 함수
  const loadData = useCallback(async () => {
    if (ongoingRequestRef.current) return;
    
    ongoingRequestRef.current = true;
    
    try {
      const endpoint = getChartEndpoint(chartType);
      const allProcessedData: ExtendedCandlestickData[] = [];
      let currentTo = dateRange.endDate ? dateRange.endDate : new Date();
      const startDate = dateRange.startDate;
      
      console.warn('데이터 로드 시작:', {
        시작일: startDate.toLocaleString('ko-KR'),
        종료일: currentTo.toLocaleString('ko-KR'),
        차트타입: chartType
      });
      
      // 필요한 데이터 개수 계산
      const totalDays = Math.ceil((currentTo.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
      const estimatedCandles = chartType.startsWith('minutes/') ? totalDays * 24 * 60 / parseInt(chartType.split('/')[1]) :
                             chartType === 'days' ? totalDays :
                             chartType === 'weeks' ? Math.ceil(totalDays / 7) :
                             Math.ceil(totalDays / 30);
      
      console.warn('예상 캔들 수:', estimatedCandles);
      
      const batchSize = 200; // 업비트 API 최대 요청 개수
      const expectedBatches = Math.ceil(estimatedCandles / batchSize);
      let currentBatch = 0;
      
      // 시작 날짜에 도달할 때까지 반복해서 데이터 가져오기
      while (true) {
        const to = currentTo.toISOString();
        
        // 진행률 업데이트
        currentBatch++;
        setProgress(Math.min(30, (currentBatch / expectedBatches) * 30));
        
        try {
          console.warn(`데이터 요청 URL: https://api.upbit.com/v1/candles/${endpoint}?market=${symbol}&to=${to}&count=${batchSize}`);
          
          const response = await fetch(
            `https://api.upbit.com/v1/candles/${endpoint}?market=${symbol}&to=${to}&count=${batchSize}`
          );
          
          if (!response.ok) {
            console.error('API 응답 오류:', response.status, response.statusText);
            throw new Error(`데이터 로딩 실패: ${response.status} ${response.statusText}`);
          }
          
          const data: UpbitCandle[] = await response.json();
          
          if (!data || data.length === 0) {
            console.warn('더 이상 데이터가 없습니다.');
            break;
          }
          
          console.warn(`${currentBatch}번째 배치 데이터 수신: ${data.length}개`);
          
          // 데이터 처리
          const processedData = data.map((candle: UpbitCandle) => processCandle(candle, chartType));
          
          // 시작 날짜보다 이전 데이터는 필터링
          const filteredData = processedData.filter(
            candle => new Date((candle.time as number) * 1000) >= startDate
          );
          
          // 데이터 추가
          allProcessedData.push(...filteredData);
          
          console.warn(`현재까지 누적 데이터: ${allProcessedData.length}개`);
          
          // 최소 필요 캔들 수에 도달했는지 확인
          if (allProcessedData.length >= 900) {
            console.warn('최소 필요 캔들 수(900개)에 도달했습니다.');
          }
          
          // 마지막 캔들의 시간으로 다음 요청의 기준 시간 설정
          if (data.length < batchSize) {
            console.warn('마지막 배치 데이터가 최대 크기보다 작습니다. 데이터 로드를 종료합니다.');
            break;
          }
          
          const lastCandle = data[data.length - 1];
          currentTo = new Date(lastCandle.candle_date_time_kst);
          
          // 시작 날짜에 도달하면 종료
          if (currentTo <= startDate) {
            console.warn('시작 날짜에 도달했습니다. 데이터 로드를 종료합니다.');
            break;
          }
          
          // API 호출 제한을 위한 딜레이
          await new Promise(resolve => setTimeout(resolve, 100));
        } catch (error) {
          console.error('데이터 요청 중 오류 발생:', error);
          // 오류가 발생해도 계속 진행
          break;
        }
      }
      
      // 한 번만 정렬
      allProcessedData.sort((a, b) => {
        if (typeof a.time === 'number' && typeof b.time === 'number') {
          return a.time - b.time;
        }
        return 0;
      });
      
      setProgress(50);
      
      // 매매 신호 분석 및 마커 생성
      const selectedStrategy = useUpbitStore.getState().strategies[tradeStrategy];
      const analysisResult = selectedStrategy.analyze(allProcessedData);
      const signals = analysisResult.signals;
      
      // 마커 설정
      setMarkers(signals);
      
      // 현재 가격 설정
      if (allProcessedData.length > 0) {
        const lastCandle = allProcessedData[allProcessedData.length - 1];
        setChartPrice(lastCandle.close);
      }
      
      // 모든 데이터 저장
      setAllData(allProcessedData);
      setProgress(100);
      
    } catch (error) {
      console.error('데이터 로드 오류:', error);
    } finally {
      setProgress(100);
      ongoingRequestRef.current = false;
    }
  }, [dateRange, symbol, chartType, tradeStrategy]);
  
  return {
    allData,
    progress,
    loadData,
    markers,
    chartPrice
  };
}; 