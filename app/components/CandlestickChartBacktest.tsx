import React, { useCallback, useRef, useEffect } from 'react';
import { IChartApi, ISeriesApi, createSeriesMarkers } from 'lightweight-charts';
import { ExtendedCandlestickData, SeriesMarker, Time } from './CandlestickChartTypes';
import { calculateEMA, createVolumeData, createTradeMarkers } from './CandlestickChartUtils';
import useUpbitStore from '../store/useUpbitStore';
import { TradeStrategy } from '../strategies/types';

interface BacktestChartProps {
  importedData: ExtendedCandlestickData[];
  tradeStrategy: TradeStrategy;
  onBacktestMarkersChange: (markers: SeriesMarker<Time>[]) => void;
  onBacktestResultChange: (result: any) => void;
}

export const useBacktestChart = () => {
  // 백테스트 차트 레퍼런스
  const backtestChartApiRef = useRef<IChartApi | null>(null);
  const backtestCandleSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const backtestVolumeSeriesRef = useRef<ISeriesApi<"Histogram"> | null>(null);
  const backtestSixtyEMASeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const backtestOneTwentyEMASeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const backtestTwoFortyEMASeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const backtestThreeHundredSixtyEMASeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const backtestThreeHundredEMASeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const backtestNineHundredEMASeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const backtestMarkerPluginRef = useRef<any | null>(null);
  
  // 마커 관련 상태 및 ref
  const lastBacktestMarkersRef = useRef<SeriesMarker<Time>[]>([]);
  const isMounted = useRef(true);
  const markerAppliedRef = useRef(false);
  const backtestMarkerPluginInitializedRef = useRef(false);
  
  // 백테스트 마커 초기화 및 적용을 위한 함수
  const setupBacktestMarkers = useCallback((backtestMarkers: SeriesMarker<Time>[]) => {
    if (!backtestCandleSeriesRef.current) return;
    
    try {
      // 마커 플러그인이 없으면 생성
      if (!backtestMarkerPluginRef.current) {
        console.log('백테스트 마커 플러그인 생성');
        backtestMarkerPluginRef.current = createSeriesMarkers(backtestCandleSeriesRef.current);
        backtestMarkerPluginInitializedRef.current = true;
      }
      
      // 저장된 마커가 있으면 적용
      if (backtestMarkerPluginRef.current && backtestMarkers.length > 0) {
        console.log('백테스트 마커 적용:', backtestMarkers.length);
        backtestMarkerPluginRef.current.setMarkers(backtestMarkers);
        lastBacktestMarkersRef.current = backtestMarkers;
        
        // 안전장치: 지연 마커 적용
        setTimeout(() => {
          if (backtestMarkerPluginRef.current) {
            console.log('백테스트 마커 재확인:', backtestMarkers.length);
            backtestMarkerPluginRef.current.setMarkers(backtestMarkers);
          }
        }, 500);
      }
    } catch (error) {
      console.error('백테스트 마커 설정 오류:', error);
    }
  }, []);

  // 백테스트 차트 초기화 콜백
  const handleBacktestChartReady = useCallback((
    chartApi: IChartApi,
    candleSeries: ISeriesApi<"Candlestick">,
    volumeSeries: ISeriesApi<"Histogram">,
    sixtyEMASeries: ISeriesApi<"Line">,
    oneTwentyEMASeries: ISeriesApi<"Line">,
    twoFortyEMASeries: ISeriesApi<"Line">,
    threeHundredSixtyEMASeries: ISeriesApi<"Line">,
    threeHundredEMASeries: ISeriesApi<"Line">,
    nineHundredEMASeries: ISeriesApi<"Line">,
    importedData: ExtendedCandlestickData[],
    tradeStrategy: TradeStrategy,
    setBacktestMarkers: (markers: SeriesMarker<Time>[]) => void,
    setCsvBacktestResult: (result: any) => void
  ) => {
    console.log('백테스트 차트 초기화 시작');
    
    // 백테스트 차트용 레퍼런스 생성
    backtestChartApiRef.current = chartApi;
    backtestCandleSeriesRef.current = candleSeries;
    backtestVolumeSeriesRef.current = volumeSeries;
    backtestSixtyEMASeriesRef.current = sixtyEMASeries;
    backtestOneTwentyEMASeriesRef.current = oneTwentyEMASeries;
    backtestTwoFortyEMASeriesRef.current = twoFortyEMASeries;
    backtestThreeHundredSixtyEMASeriesRef.current = threeHundredSixtyEMASeries;
    backtestThreeHundredEMASeriesRef.current = threeHundredEMASeries;
    backtestNineHundredEMASeriesRef.current = nineHundredEMASeries;
    
    // 볼륨 시리즈 설정
    backtestChartApiRef.current.priceScale('volume').applyOptions({
      scaleMargins: {
        top: 0.8,
        bottom: 0,
      },
      borderVisible: false,
    });

    // 임포트된 데이터가 있으면 차트에 표시
    if (importedData.length > 0) {
      // 캔들스틱 데이터 설정
      backtestCandleSeriesRef.current.setData(importedData);
      
      // 볼륨 데이터 설정
      const volumeData = createVolumeData(importedData);
      backtestVolumeSeriesRef.current.setData(volumeData);
      
      // EMA 데이터 설정
      const ema60Data = calculateEMA(importedData, 60);
      const ema120Data = calculateEMA(importedData, 120);
      const ema240Data = calculateEMA(importedData, 240);
      const ema360Data = calculateEMA(importedData, 360);
      const ema300Data = calculateEMA(importedData, 300);
      const ema900Data = calculateEMA(importedData, 900);

      backtestSixtyEMASeriesRef.current.setData(ema60Data);
      backtestOneTwentyEMASeriesRef.current.setData(ema120Data);
      backtestTwoFortyEMASeriesRef.current.setData(ema240Data);
      backtestThreeHundredSixtyEMASeriesRef.current.setData(ema360Data);
      backtestThreeHundredEMASeriesRef.current.setData(ema300Data);
      backtestNineHundredEMASeriesRef.current.setData(ema900Data);

      // 매매 신호 분석 및 마커 생성 (현재 선택된 전략만)
      const selectedStrategy = useUpbitStore.getState().strategies[tradeStrategy];
      const analysisResult = selectedStrategy.analyze(importedData);
      const signals = analysisResult.signals;
      const newMarkers = createTradeMarkers(signals);
      
      // 마커 상태 업데이트
      setBacktestMarkers(newMarkers);
      
      // 백테스트 결과 계산
      const backtestResult = useUpbitStore.getState().calculateBacktestResult(importedData, signals, 'test');
      setCsvBacktestResult(backtestResult);
      
      // 마커 플러그인을 즉시 설정하려고 시도하되, 
      // setTimeout을 사용하여 비동기적으로도 설정 시도
      setupBacktestMarkers(newMarkers);
      
      // 추가 안전장치: 지연 마커 적용 시도
      markerAppliedRef.current = false;
      
      const attemptApplyMarkers = () => {
        if (!markerAppliedRef.current && isMounted.current) {
          console.log('지연 마커 적용 시도:', newMarkers.length);
          setupBacktestMarkers(newMarkers);
          
          // 최대 3번 시도
          if (!markerAppliedRef.current) {
            setTimeout(() => {
              if (!markerAppliedRef.current && isMounted.current) {
                console.log('마지막 마커 적용 시도:', newMarkers.length);
                setupBacktestMarkers(newMarkers);
              }
            }, 500);
          }
        }
      };
      
      setTimeout(attemptApplyMarkers, 100);

      // 차트 피팅
      backtestChartApiRef.current.timeScale().fitContent();
    }
    
    console.log('백테스트 차트 초기화 완료');
  }, []);

  return {
    backtestChartApiRef,
    backtestCandleSeriesRef,
    backtestVolumeSeriesRef,
    backtestSixtyEMASeriesRef,
    backtestOneTwentyEMASeriesRef,
    backtestTwoFortyEMASeriesRef,
    backtestThreeHundredSixtyEMASeriesRef,
    backtestThreeHundredEMASeriesRef,
    backtestNineHundredEMASeriesRef,
    backtestMarkerPluginRef,
    setupBacktestMarkers,
    handleBacktestChartReady
  };
};

export const BacktestChart: React.FC<BacktestChartProps> = ({
  importedData,
  tradeStrategy,
  onBacktestMarkersChange,
  onBacktestResultChange
}) => {
  const {
    setupBacktestMarkers,
    handleBacktestChartReady
  } = useBacktestChart();

  // 백테스트 마커 변경 시 마커 플러그인 업데이트
  useEffect(() => {
    // 백테스트 마커 변경 로직
  }, []);

  return null; // 실제 구현에서는 차트 컨테이너 반환
}; 