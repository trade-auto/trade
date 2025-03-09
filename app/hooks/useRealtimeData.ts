import { useState, useCallback, useRef, useEffect } from 'react';
import { 
  Time, 
  ISeriesApi, 
  ISeriesMarkersPluginApi 
} from 'lightweight-charts';
import { 
  ExtendedCandlestickData, 
  TradeSignal
} from '../types/candlestick';
import { 
  formatDateForAPI, 
  processCandle, 
  calculateEMA, 
  createTradeMarkers 
} from '../utils/chartHelpers';
import useUpbitStore from '../store/useUpbitStore';

interface UseRealtimeDataProps {
  symbol: string;
  chartType: string;
  isRealtimeAPIEnabled: boolean;
  allData: ExtendedCandlestickData[];
  setAllData: (data: ExtendedCandlestickData[]) => void;
  markers: TradeSignal[];
  setMarkers: (markers: TradeSignal[]) => void;
  setChartPrice: (price: number) => void;
  showMA: {
    sixty: boolean;
    oneTwenty: boolean;
    twoForty: boolean;
    threeHundredSixty: boolean;
    threeHundred: boolean;
    nineHundred: boolean;
  };
  candleSeriesRef: React.RefObject<ISeriesApi<"Candlestick"> | null>;
  volumeSeriesRef: React.RefObject<ISeriesApi<"Histogram"> | null>;
  sixtyEMASeriesRef: React.RefObject<ISeriesApi<"Line"> | null>;
  oneTwentyEMASeriesRef: React.RefObject<ISeriesApi<"Line"> | null>;
  twoFortyEMASeriesRef: React.RefObject<ISeriesApi<"Line"> | null>;
  threeHundredSixtyEMASeriesRef: React.RefObject<ISeriesApi<"Line"> | null>;
  threeHundredEMASeriesRef: React.RefObject<ISeriesApi<"Line"> | null>;
  nineHundredEMASeriesRef: React.RefObject<ISeriesApi<"Line"> | null>;
  markerPluginRef: React.RefObject<ISeriesMarkersPluginApi<Time> | null>;
}

interface UseRealtimeDataReturn {
  realtimeUpdateStatus: {
    isUpdating: boolean;
    lastUpdateTime: string | null;
    updateCount: number;
  };
  handleRealtimeAPIToggle: () => void;
  switchToRealtimeAfterUpdate: () => void;
}

export const useRealtimeData = ({
  symbol,
  chartType,
  isRealtimeAPIEnabled,
  allData,
  setAllData,
  markers,
  setMarkers,
  setChartPrice,
  showMA,
  candleSeriesRef,
  volumeSeriesRef,
  sixtyEMASeriesRef,
  oneTwentyEMASeriesRef,
  twoFortyEMASeriesRef,
  threeHundredSixtyEMASeriesRef,
  threeHundredEMASeriesRef,
  nineHundredEMASeriesRef,
  markerPluginRef
}: UseRealtimeDataProps): UseRealtimeDataReturn => {
  // 실시간 업데이트 상태
  const [realtimeUpdateStatus, setRealtimeUpdateStatus] = useState<{
    isUpdating: boolean;
    lastUpdateTime: string | null;
    updateCount: number;
  }>({
    isUpdating: false,
    lastUpdateTime: null,
    updateCount: 0
  });
  
  // 마지막 분석 결과 상태 저장
  const [lastAnalysisResult, setLastAnalysisResult] = useState<{
    lastProcessedIndex: number;
    currentPosition: 'long' | null;
    lastTradeId: string | null;
    entryPrice?: number;
  }>({
    lastProcessedIndex: -1,
    currentPosition: null,
    lastTradeId: null
  });
  
  const ongoingRequestRef = useRef<boolean>(false);
  const { tradeStrategy } = useUpbitStore();
  
  // 실시간 API 업데이트로 전환하는 함수
  const switchToRealtimeAfterUpdate = useCallback(() => {
    console.warn('자동 업데이트 완료 후 실시간 API로 전환 시도...');
    console.warn('현재 데이터 개수:', allData.length);
    
    // 데이터가 충분한지 확인
    if (allData.length < 900) {
      console.warn('데이터가 충분하지 않습니다. 현재 데이터 개수:', allData.length);
      console.warn('실시간 모드에서는 데이터 길이 검증을 건너뛰고 계속 진행합니다.');
    }
    
    // 마지막 분석 결과 초기화
    setLastAnalysisResult({
      lastProcessedIndex: allData.length - 1,
      currentPosition: null,
      lastTradeId: null
    });
    
    // 이평선 초기화
    if (
      sixtyEMASeriesRef.current && 
      oneTwentyEMASeriesRef.current && 
      twoFortyEMASeriesRef.current && 
      threeHundredSixtyEMASeriesRef.current &&
      threeHundredEMASeriesRef.current &&
      nineHundredEMASeriesRef.current
    ) {
      try {
        console.warn('실시간 API 전환 시 이평선 초기화 중...');
        
        // EMA 계산
        const ema60Data = calculateEMA(allData, 60);
        const ema120Data = calculateEMA(allData, 120);
        const ema240Data = calculateEMA(allData, 240);
        const ema360Data = calculateEMA(allData, 360);
        const ema300Data = calculateEMA(allData, 300);
        const ema900Data = calculateEMA(allData, 900);
        
        // EMA 데이터 설정
        sixtyEMASeriesRef.current.setData(ema60Data);
        oneTwentyEMASeriesRef.current.setData(ema120Data);
        twoFortyEMASeriesRef.current.setData(ema240Data);
        threeHundredSixtyEMASeriesRef.current.setData(ema360Data);
        threeHundredEMASeriesRef.current.setData(ema300Data);
        nineHundredEMASeriesRef.current.setData(ema900Data);
        
        // 시리즈 가시성 설정 확인
        sixtyEMASeriesRef.current.applyOptions({ visible: showMA.sixty });
        oneTwentyEMASeriesRef.current.applyOptions({ visible: showMA.oneTwenty });
        twoFortyEMASeriesRef.current.applyOptions({ visible: showMA.twoForty });
        threeHundredSixtyEMASeriesRef.current.applyOptions({ visible: showMA.threeHundredSixty });
        threeHundredEMASeriesRef.current.applyOptions({ visible: showMA.threeHundred });
        nineHundredEMASeriesRef.current.applyOptions({ visible: showMA.nineHundred });
        
        console.warn('이평선 초기화 완료');
      } catch (error) {
        console.error('이평선 초기화 중 오류 발생:', error);
      }
    }
  }, [allData, showMA, sixtyEMASeriesRef, oneTwentyEMASeriesRef, twoFortyEMASeriesRef, threeHundredSixtyEMASeriesRef, threeHundredEMASeriesRef, nineHundredEMASeriesRef]);
  
  // 실시간 API 업데이트 함수
  const updateRealtimeData = useCallback(async () => {
    if (!isRealtimeAPIEnabled || !chartType.startsWith('seconds/') || ongoingRequestRef.current) return;
    
    // 실시간 데이터 업데이트 로직
    try {
      // 기존 로직 유지
      console.warn('실시간 데이터 업데이트 중...');
      
      // 실시간 데이터 가져오기
      const now = new Date();
      console.warn('현재 시간:', now.toLocaleString('ko-KR'));
      
      const endpoint = 'minutes/1'; // 초봉은 1분봉으로 대체
      
      // API 호출 시작
      ongoingRequestRef.current = true;
      
      // API URL 구성
      const to = formatDateForAPI(now);
      const count = 1; // 최신 캔들 1개만 가져옴
      const url = `https://api.upbit.com/v1/candles/${endpoint}?market=${symbol}&count=${count}&to=${to}`;
      
      console.warn('실시간 데이터 요청 URL:', url);
      
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`API 응답 오류: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      
      console.warn('실시간 데이터 응답:', data);
      
      if (!data || data.length === 0) {
        console.warn('실시간 데이터가 없습니다.');
        ongoingRequestRef.current = false;
        return;
      }
      
      // 응답 데이터의 시간 정보 확인
      const responseTime = data[0].candle_date_time_kst;
      console.warn('응답 데이터 시간 (KST):', responseTime);
      
      // 새 캔들 데이터 처리
      const newCandle = processCandle(data[0], chartType);
      console.warn('처리된 캔들 데이터:', {
        시간: new Date((newCandle.time as number) * 1000).toLocaleString('ko-KR'),
        시가: newCandle.open,
        고가: newCandle.high,
        저가: newCandle.low,
        종가: newCandle.close,
        거래량: newCandle.volume
      });
      
      // 마지막 캔들 업데이트 또는 새 캔들 추가
      if (allData.length > 0) {
        const lastCandle = allData[allData.length - 1];
        let updatedData: ExtendedCandlestickData[] = [];
        
        // 같은 시간의 캔들이면 업데이트, 아니면 새로 추가
        if (lastCandle.time === newCandle.time) {
          // 기존 캔들 업데이트
          updatedData = [...allData];
          updatedData[updatedData.length - 1] = newCandle;
          setAllData(updatedData);
          
          // 차트 시리즈 업데이트
          if (candleSeriesRef.current) {
            candleSeriesRef.current.update(newCandle);
          }
        } else {
          // 새 캔들 추가
          updatedData = [...allData, newCandle];
          setAllData(updatedData);
          
          // 차트 시리즈에 추가
          if (candleSeriesRef.current) {
            candleSeriesRef.current.update(newCandle);
          }
          
          // 볼륨 데이터 업데이트
          if (volumeSeriesRef.current) {
            volumeSeriesRef.current.update({
              time: newCandle.time,
              value: newCandle.volume,
              color: newCandle.close >= newCandle.open ? '#26a69a' : '#ef5350',
            });
          }
        }
        
        // 현재 가격 업데이트
        setChartPrice(newCandle.close);
        
        // 실시간 업데이트 상태 업데이트
        setRealtimeUpdateStatus(prev => ({
          isUpdating: true,
          lastUpdateTime: new Date().toLocaleString('ko-KR'),
          updateCount: prev.updateCount + 1
        }));
        
        // 이평선 업데이트 (매번 업데이트)
        console.warn('이평선 업데이트 중...');
        
        // EMA 계산 및 설정
        if (
          sixtyEMASeriesRef.current && 
          oneTwentyEMASeriesRef.current && 
          twoFortyEMASeriesRef.current && 
          threeHundredSixtyEMASeriesRef.current &&
          threeHundredEMASeriesRef.current &&
          nineHundredEMASeriesRef.current
        ) {
          try {
            // 데이터가 충분한지 확인
            if (updatedData.length < 60) {
              console.warn('이평선 계산을 위한 데이터가 부족합니다. 최소 60개 필요, 현재:', updatedData.length);
            } else {
              console.warn('이평선 데이터 계산 중... 데이터 개수:', updatedData.length);
              
              // EMA 계산
              const ema60Data = calculateEMA(updatedData, 60);
              const ema120Data = calculateEMA(updatedData, 120);
              const ema240Data = calculateEMA(updatedData, 240);
              const ema360Data = calculateEMA(updatedData, 360);
              const ema300Data = calculateEMA(updatedData, 300);
              const ema900Data = calculateEMA(updatedData, 900);
              
              console.warn('이평선 데이터 계산 완료:', {
                'EMA60': ema60Data.length,
                'EMA120': ema120Data.length,
                'EMA240': ema240Data.length,
                'EMA360': ema360Data.length,
                'EMA300': ema300Data.length,
                'EMA900': ema900Data.length
              });
              
              // EMA 데이터 설정
              sixtyEMASeriesRef.current.setData(ema60Data);
              oneTwentyEMASeriesRef.current.setData(ema120Data);
              twoFortyEMASeriesRef.current.setData(ema240Data);
              threeHundredSixtyEMASeriesRef.current.setData(ema360Data);
              threeHundredEMASeriesRef.current.setData(ema300Data);
              nineHundredEMASeriesRef.current.setData(ema900Data);
              
              // 시리즈 가시성 설정 확인
              sixtyEMASeriesRef.current.applyOptions({ visible: showMA.sixty });
              oneTwentyEMASeriesRef.current.applyOptions({ visible: showMA.oneTwenty });
              twoFortyEMASeriesRef.current.applyOptions({ visible: showMA.twoForty });
              threeHundredSixtyEMASeriesRef.current.applyOptions({ visible: showMA.threeHundredSixty });
              threeHundredEMASeriesRef.current.applyOptions({ visible: showMA.threeHundred });
              nineHundredEMASeriesRef.current.applyOptions({ visible: showMA.nineHundred });
              
              console.warn('이평선 업데이트 완료');
            }
          } catch (error) {
            console.error('이평선 업데이트 중 오류 발생:', error);
          }
        }
        
        // 전략 분석 실행
        const selectedStrategy = useUpbitStore.getState().strategies[tradeStrategy];
        const analysisResult = selectedStrategy.analyze(updatedData, {
          realtime: true,
          lastProcessedIndex: lastAnalysisResult.lastProcessedIndex,
          currentPosition: lastAnalysisResult.currentPosition,
          lastTradeId: lastAnalysisResult.lastTradeId,
          entryPrice: lastAnalysisResult.entryPrice
        });
        
        // 새로운 신호가 있으면 마커 업데이트
        if (analysisResult.signals.length > 0) {
          const newMarkers = createTradeMarkers(analysisResult.signals);
          setMarkers(prev => [...prev, ...analysisResult.signals]);
          
          // 마커 적용
          if (markerPluginRef.current) {
            console.log('실시간 마커 업데이트:', newMarkers.length, '개');
            
            // 모든 마커 적용 (기존 마커 + 새 마커)
            const allMarkers = [...markers, ...analysisResult.signals];
            const allMarkerElements = createTradeMarkers(allMarkers);
            markerPluginRef.current.setMarkers(allMarkerElements);
            
            // 안전장치: 지연 마커 적용
            setTimeout(() => {
              if (markerPluginRef.current) {
                console.log('지연 실시간 마커 적용:', allMarkerElements.length, '개');
                markerPluginRef.current.setMarkers(allMarkerElements);
              }
            }, 300);
          }
        }
        
        // 분석 결과 저장
        setLastAnalysisResult({
          lastProcessedIndex: analysisResult.lastProcessedIndex,
          currentPosition: analysisResult.currentPosition,
          lastTradeId: analysisResult.lastTradeId,
          entryPrice: analysisResult.entryPrice
        });
      }
    } catch (error) {
      console.error('실시간 데이터 업데이트 오류:', error);
    } finally {
      // API 호출 완료
      ongoingRequestRef.current = false;
    }
  }, [isRealtimeAPIEnabled, chartType, symbol, allData, markers, tradeStrategy, lastAnalysisResult, showMA, candleSeriesRef, volumeSeriesRef, sixtyEMASeriesRef, oneTwentyEMASeriesRef, twoFortyEMASeriesRef, threeHundredSixtyEMASeriesRef, threeHundredEMASeriesRef, nineHundredEMASeriesRef, markerPluginRef, setAllData, setChartPrice, setMarkers]);
  
  // 실시간 API 업데이트 타이머
  useEffect(() => {
    // 초봉 차트가 아니면 실행하지 않음
    if (chartType !== 'seconds/60' || !isRealtimeAPIEnabled) return;
    
    console.warn('실시간 API 업데이트 시작...');
    const realtimeInterval = 1000; // 1초로 변경 (3초 -> 1초)
    
    const realtimeTimer = setInterval(() => {
      console.warn('실시간 업데이트 타이머 실행:', new Date().toLocaleString('ko-KR'));
      updateRealtimeData();
    }, realtimeInterval);
    
    return () => clearInterval(realtimeTimer);
  }, [isRealtimeAPIEnabled, updateRealtimeData, chartType]);
  
  // 실시간 API 토글 핸들러
  const handleRealtimeAPIToggle = useCallback(() => {
    // 이 함수는 CandlestickChart 컴포넌트에서 구현해야 함
    // 여기서는 인터페이스만 제공
  }, []);
  
  return {
    realtimeUpdateStatus,
    handleRealtimeAPIToggle,
    switchToRealtimeAfterUpdate
  };
}; 