import React, { useCallback, useRef, useEffect } from 'react';
import { IChartApi, ISeriesApi, SeriesMarker } from 'lightweight-charts';
import { ExtendedCandlestickData, Time } from './CandlestickChartTypes';
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
      const signals = analysisResult.signals.map(signal => ({
        ...signal,
        time: Number(signal.time)
      }));
      const newMarkers = createTradeMarkers(signals);
      
      // 마커 상태 업데이트
      setBacktestMarkers(newMarkers);
      
      // 백테스트 결과 계산
      const backtestResult = useUpbitStore.getState().calculateBacktestResult(importedData, signals, 'test');
      setCsvBacktestResult(backtestResult);

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
    handleBacktestChartReady
  } = useBacktestChart();

  return null; // 실제 구현에서는 차트 컨테이너 반환
}; 