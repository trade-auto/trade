import React, { useCallback, useState, useRef, ChangeEvent } from 'react';
import axios from 'axios';
import { ExtendedCandlestickData, DateRange, Time, UpbitCandle } from './CandlestickChartTypes';
import { formatDate, createTradeMarkers, calculateBacktestResult } from './CandlestickChartUtils';
import useUpbitStore from '../store/useUpbitStore';
import { TradeStrategy, TradeSignal } from '../types/trading';
import { TradeSignal as StrategyTradeSignal } from '../strategies/types';

export const useCsvFunctions = (symbol: string) => {
  // CSV 상태
  const [csvDateRange, setCsvDateRange] = useState<DateRange>({
    startDate: new Date(new Date().setHours(new Date().getHours() - 4)),
    endDate: new Date(),
  });
  const [csvLoading, setCsvLoading] = useState(false);
  const [csvProgress, setCsvProgress] = useState(0);
  
  // CSV 임포트 관련 상태
  const [importedData, setImportedData] = useState<ExtendedCandlestickData[]>([]);
  const [isDataImported, setIsDataImported] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importProgress, setImportProgress] = useState(0);
  const [csvBacktestResult, setCsvBacktestResult] = useState<any>(null);
  const [backtestMarkers, setBacktestMarkers] = useState<any[]>([]);

  // CSV 저장 함수
  const saveToCSV = useCallback(async () => {
    if (csvLoading) {
      alert('이미 다운로드가 진행 중입니다');
      return;
    }
    
    try {
      setCsvLoading(true);
      setCsvProgress(0);
      
      const csvToTime = (csvDateRange.endDate || new Date()).getTime();
      const csvFromTime = new Date(csvToTime - 24 * 60 * 60 * 1000).getTime();
      
      // 초봉 데이터를 저장할 배열
      const allCandleData: UpbitCandle[] = [];
      let currentTo = new Date(csvToTime);
      const batchSize = 200; // API 한 번에 가져올 수 있는 최대 캔들 수
      let retryCount = 0;
      const maxRetries = 3;
      
      while (currentTo.getTime() > csvFromTime) {
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 30000);

          const response = await axios.get('https://api.upbit.com/v1/candles/seconds', {
            params: {
              market: symbol,
              to: currentTo.toISOString(),
              count: batchSize
            }
          });

          clearTimeout(timeoutId);
          
          const data: UpbitCandle[] = response.data;
          
          if (!data || data.length === 0) break;
          
          // 시작 날짜보다 이전 데이터는 필터링
          const filteredData = data.filter(
            candle => new Date(candle.candle_date_time_kst).getTime() >= csvFromTime
          );
          
          allCandleData.push(...filteredData);
          
          // 진행률 업데이트
          const progress = Math.min(
            90,
            ((csvToTime - currentTo.getTime()) / (csvToTime - csvFromTime)) * 100
          );
          setCsvProgress(Math.round(progress));
          
          // 마지막 캔들의 시간으로 다음 요청의 기준 시정 설정
          const lastCandle = data[data.length - 1];
          currentTo = new Date(lastCandle.candle_date_time_kst);
          
          // API 호출 제한을 위한 딜레이
          await new Promise(resolve => setTimeout(resolve, 200));
          
          // 성공 시 재시도 카운트 초기화
          retryCount = 0;
          
        } catch (error) {
          console.error('데이터 가져오기 오류:', error);
          retryCount++;
          
          if (axios.isAxiosError(error)) {
            if (error.response) {
              console.log(`Error Status Code: ${error.response.status}`);
              console.log('Error Response Data:', error.response.data);
            }
          }
          
          if (retryCount >= maxRetries) {
            throw new Error(`데이터 가져오기 실패: ${maxRetries}회 재시도 후 실패`);
          }
          
          // 재시도 전 대기 시간 증가
          await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
          continue; // 현재 시점 재시도
        }
      }
      
      if (allCandleData.length === 0) {
        throw new Error('다운로드된 데이터가 없습니다');
      }
      
      setCsvProgress(92);
      
      // 데이터 정렬
      allCandleData.sort((a, b) => 
        new Date(a.candle_date_time_kst).getTime() - new Date(b.candle_date_time_kst).getTime()
      );
      
      setCsvProgress(95);
      
      // CSV 헤더
      let csv = 'timestamp,date_time,open_price,high_price,low_price,trade_price,volume\n';
      
      // CSV 데이터 행
      allCandleData.forEach((candle) => {
        const dateTime = new Date(candle.candle_date_time_kst);
        const formattedDate = dateTime.getFullYear() + '-' +
          String(dateTime.getMonth() + 1).padStart(2, '0') + '-' +
          String(dateTime.getDate()).padStart(2, '0') + 'T' +
          String(dateTime.getHours()).padStart(2, '0') + ':' +
          String(dateTime.getMinutes()).padStart(2, '0') + ':' +
          String(dateTime.getSeconds()).padStart(2, '0');

        csv += `${dateTime.getTime()},${formattedDate},${candle.opening_price},${candle.high_price},${candle.low_price},${candle.trade_price},${candle.candle_acc_trade_volume}\n`;
      });
      
      setCsvProgress(98);
      
      // CSV 파일 생성 및 다운로드
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `${symbol}_1sec_${formatDate(csvDateRange.startDate)}_to_${formatDate(csvDateRange.endDate || new Date())}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      setCsvProgress(100);
    } catch (error) {
      console.error('CSV 생성 오류:', error);
      let errorMessage = '알 수 없는 오류가 발생했습니다';
      
      if (error instanceof Error) {
        if (error.message.includes('Failed to fetch')) {
          errorMessage = '서버 연결에 실패했습니다. 인터넷 연결을 확인하거나 잠시 후 다시 시도해주세요.';
        } else {
          errorMessage = error.message;
        }
      }
      
      alert(`CSV 파일 생성 중 오류가 발생했습니다.\n${errorMessage}`);
    } finally {
      setCsvLoading(false);
    }
  }, [csvDateRange, symbol, csvLoading]);

  // CSV 파일 임포트 핸들러
  const handleFileImport = useCallback((event: ChangeEvent<HTMLInputElement>, tradeStrategy: TradeStrategy) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const text = e.target?.result as string;
        const rows = text.split('\n');
        const totalRows = rows.length;
        
        // CSV 데이터 파싱
        const parsedData: ExtendedCandlestickData[] = rows.slice(1)
          .filter(row => row.trim())
          .map((row, index) => {
            const columns = row.split(',');
            // 진행률 업데이트
            setImportProgress(Math.round((index / totalRows) * 100));
            return {
              time: parseInt(columns[0]) / 1000 as Time,
              open: parseFloat(columns[2]),
              high: parseFloat(columns[3]),
              low: parseFloat(columns[4]),
              close: parseFloat(columns[5]),
              volume: parseFloat(columns[6])
            };
          })
          .sort((a, b) => (a.time as number) - (b.time as number));

        setImportedData(parsedData);
        setIsDataImported(true);
        
        // 매매 신호 분석 및 마커 생성
        const selectedStrategy = useUpbitStore.getState().strategies[tradeStrategy];
        const analysisResult = selectedStrategy.analyze(parsedData);
        const signals = analysisResult.signals;
        
        const convertedSignals = signals
          .filter(signal => signal.position === 'buy' || signal.position === 'sell')
          .map(signal => ({
            ...signal,
            time: (Number(signal.time) as unknown) as Time,
            position: signal.position as 'buy' | 'sell',
            metadata: signal.metadata ? {
              ...signal.metadata,
              ma60: signal.metadata.ma60 ?? 0
            } : undefined
          })) as TradeSignal[];
        
        const strategyMarkers = createTradeMarkers(convertedSignals);
        setBacktestMarkers(strategyMarkers);
        
        // 백테스트 결과 계산
        const csvResult = useUpbitStore.getState().calculateBacktestResult(
          parsedData,
          convertedSignals as unknown as StrategyTradeSignal[],
          'test'
        );
        setCsvBacktestResult(csvResult);

      } catch (error) {
        console.error('CSV 파일 파싱 오류:', error);
        alert('CSV 파일 처리 중 오류가 발생했습니다.');
      }
    };
    reader.readAsText(file);
  }, []);

  // 파일 선택 트리거
  const triggerFileInput = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  return {
    csvDateRange,
    setCsvDateRange,
    csvLoading,
    csvProgress,
    importedData,
    isDataImported,
    fileInputRef,
    importProgress,
    csvBacktestResult,
    setCsvBacktestResult,
    saveToCSV,
    handleFileImport,
    triggerFileInput,
    setImportedData,
    setIsDataImported,
    backtestMarkers,
    setBacktestMarkers
  };
}; 