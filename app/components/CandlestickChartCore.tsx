import React, { useEffect, useCallback } from 'react';
import { CandlestickChartProps } from './CandlestickChartTypes';
import { useChartData } from './CandlestickChartHooks';
import { useCsvFunctions } from './CandlestickChartCSV';
import { useBacktestChart } from './CandlestickChartBacktest';
import useUpbitStore from '../store/useUpbitStore';
import { TradeStrategy } from '../strategies/types';
import PolMACDChart from './PolMACDChart';
import MACDChart from './MACDChart';

// 컴포넌트
import ChartControls from './ChartControls';
import ChartPrice from './ChartPrice';
import ChartSettings from './ChartSettings';
import BacktestResults from './BacktestResults';
import CsvDownloader from './CsvDownloader';
import ChartContainer from './ChartContainer';
import TradingStrategyHover from './TradingStrategyHover';

const CandlestickChart: React.FC<CandlestickChartProps> = (props) => {
  const {
    symbol,
    chartType,
    initialAutoUpdate = true,
    initialDataCount = 200, // 기본값 200으로 설정
    mode,
    handleOrder,
    onOrder,
    onChartTypeChange: propsOnChartTypeChange,
  } = props;
  
  // 차트 데이터 및 기능 훅
  const {
    isFullscreen,
    chartHeight,
    chartPrice,
    progress,
    allData,
    isAutoUpdate,
    isRealtimeAPIEnabled,
    lastSymbol,
    dateRange,
    showMA,
    realtimeUpdateStatus,
    
    // 함수
    setDateRange,
    toggleFullscreen,
    updateShowMA,
    handleHeightChange,
    handleAutoUpdateToggle,
    handleRealtimeAPIToggle,
    handleChartReady,
    loadData
  } = useChartData(symbol, chartType, initialAutoUpdate, mode, initialDataCount);
  
  // CSV 관련 기능 훅
  const {
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
    triggerFileInput
  } = useCsvFunctions(symbol);
  
  // 백테스트 차트 훅
  const { handleBacktestChartReady } = useBacktestChart();
  
  // 업비트 스토어
  const { tradeStrategy, updateTradeStrategy } = useUpbitStore();
  
  // 컴포넌트 마운트 시 날짜 범위를 명시적으로 설정
  useEffect(() => {
    const now = new Date();
    let startDate: Date;
    
    if (chartType.startsWith('seconds/')) {
      // 초봉: 최근 2시간 데이터로 명시적 설정
      startDate = new Date(now.getTime() - 2 * 60 * 60 * 1000);
      console.log('초봉 차트 - 시작 날짜를 2시간 전으로 설정:', startDate.toLocaleString('ko-KR'));
      setDateRange(prev => ({ ...prev, startDate }));
    } else if (chartType.startsWith('minutes/')) {
      // 분봉: 기간 설정
      const minutes = parseInt(chartType.split('/')[1]);
      if (minutes === 5) {
        // 5분봉: 576개 캔들 데이터 (5분 × 576 = 2880분 = 48시간)
        startDate = new Date(now.getTime() - 48 * 60 * 60 * 1000);
      } else if (minutes === 15) {
        // 15분봉: 672개 캔들 데이터 (15분 × 672 = 10080분 = 168시간 = 7일)
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      } else {
        // 기본: 최근 8시간 데이터
        startDate = new Date(now.getTime() - 8 * 60 * 60 * 1000);
      }
      console.log(`${minutes}분봉 차트 - 시작 날짜 설정:`, startDate.toLocaleString('ko-KR'));
      setDateRange(prev => ({ ...prev, startDate }));
    }
  }, [chartType, setDateRange]);
  
  // 초봉 차트일 경우 자동 업데이트 및 실시간 API 효과
  useEffect(() => {
    if (chartType === 'seconds/60') {
      // 종목이 변경되었을 때 전체 데이터 로드
      if (symbol !== lastSymbol) {
        console.log('종목이 변경되었습니다. 전체 데이터를 다시 로드합니다.');
      }
    }
  }, [symbol, lastSymbol, chartType]);
  
  // 데이터 로드 트리거 - 날짜 범위 변경 시
  useEffect(() => {
    loadData();
    console.log(`날짜 범위 변경됨: ${dateRange.startDate.toLocaleString()} - 데이터 새로 로드`);
  }, [dateRange, loadData]);
  
  // 차트 타입 변경 시 별도의 데이터 로드 트리거
  useEffect(() => {
    if (chartType === 'minutes/5') {
      console.log('5분봉 차트로 변경됨 - 목표: 576개 캔들 데이터 로드');
    } else if (chartType === 'minutes/15') {
      console.log('15분봉 차트로 변경됨 - 목표: 672개 캔들 데이터 로드');
    } else if (chartType === 'seconds/60') {
      console.log('초봉 차트로 변경됨 - 최근 2시간 데이터 로드');
    }
    
    console.log(`차트 타입 변경됨: ${chartType} - CandlestickChartHooks에서 데이터 로드 처리 중`);
  }, [chartType]);
  
  // 자동 업데이트는 초봉 차트에만 적용
  useEffect(() => {
    if (chartType === 'seconds/60' && isAutoUpdate) {
      const updateInterval = 10000; // 10초
      
      const updateTimer = setInterval(() => {
        loadData();
      }, updateInterval);
      
      return () => clearInterval(updateTimer);
    }
  }, [isAutoUpdate, chartType, loadData]);
  
  // 백테스트 차트 초기화 핸들러
  const handleBacktestChartInit = (
    chartApi: any,
    candleSeries: any,
    volumeSeries: any,
    sixtyEMASeries: any,
    oneTwentyEMASeries: any,
    twoFortyEMASeries: any,
    threeHundredSixtyEMASeries: any,
    sixHundredEMASeries: any,
    nineHundredEMASeries: any
  ) => {
    handleBacktestChartReady(
      chartApi,
      candleSeries,
      volumeSeries,
      sixtyEMASeries,
      oneTwentyEMASeries,
      twoFortyEMASeries,
      threeHundredSixtyEMASeries,
      sixHundredEMASeries,
      nineHundredEMASeries,
      importedData,
      tradeStrategy as TradeStrategy,
      () => {},
      setCsvBacktestResult
    );
  };
  
  // 파일 임포트 핸들러
  const handleFileImportWithStrategy = (event: React.ChangeEvent<HTMLInputElement>) => {
    handleFileImport(event, tradeStrategy as TradeStrategy);
  };

  return (
    <div className="flex flex-col w-full h-full">
      <TradingStrategyHover 
        tradeStrategy={tradeStrategy}
        updateTradeStrategy={updateTradeStrategy}
      />
      <div className="grid grid-cols-1 gap-4">
        {/* 가격 정보 및 컨트롤 섹션 */}
        <div className="flex flex-col md:flex-row gap-4">
          {/* 차트 컨트롤 */}
          <div className="w-full md:w-1/2">
            <ChartControls
              dateRange={dateRange}
              handleDateRangeChange={(date) => setDateRange(prev => ({ ...prev, startDate: date }))}
              handleEndDateChange={(date) => setDateRange(prev => ({ ...prev, endDate: date }))}
              progress={progress}
            />
          </div>
          
          {/* 가격 정보 */}
          <div className="w-full md:w-1/2">
            <ChartPrice chartPrice={chartPrice} market={symbol} />
          </div>
        </div>
        
        {/* 메인 차트 */}
        <div className="w-full">
          <ChartContainer
            onChartReady={isDataImported ? handleBacktestChartInit : handleChartReady}
            chartHeight={chartHeight}
            isFullscreen={isFullscreen}
            toggleFullscreen={toggleFullscreen}
            symbol={symbol}
            chartType={chartType}
            markers={realtimeUpdateStatus.markers || []}
            isAutoUpdate={isAutoUpdate}
            isRealtimeAPIEnabled={isRealtimeAPIEnabled}
            data={isDataImported ? importedData : allData}
            showMA={showMA}
          />
        </div>

        {/* PolMACD 차트 - tradeStrategy가 'MACD'일 때만 표시 */}
        {tradeStrategy === 'MACD' && (
          <>
            <div className="w-full" style={{ height: '300px' }}>
              <PolMACDChart data={isDataImported ? importedData : allData} />
            </div>
            <div className="w-full" style={{ height: '300px' }}>
              <MACDChart data={isDataImported ? importedData : allData} />
            </div>
          </>
        )}
        
        {/* 설정 및 결과 섹션 */}
        <div className="flex flex-col md:flex-row gap-4">
          <div className="w-full md:w-1/2">
            <ChartSettings
              showMA={showMA}
              updateShowMA={updateShowMA}
              chartHeight={chartHeight}
              handleHeightChange={handleHeightChange}
              chartType={chartType}
              onChartTypeChange={propsOnChartTypeChange || (() => {})}
            />
          </div>
          <div className="w-full md:w-1/2">
            <BacktestResults backtestResult={csvBacktestResult} />
          </div>
        </div>
        
        {/* CSV 다운로더 */}
        <div className="w-full">
          <CsvDownloader
            csvDateRange={csvDateRange}
            setCsvDateRange={(range) => {
              const newRange = {
                startDate: range.startDate || csvDateRange.startDate,
                endDate: range.endDate || csvDateRange.endDate
              };
              setCsvDateRange(newRange);
            }}
            csvLoading={csvLoading}
            csvProgress={csvProgress}
            allData={allData}
            saveToCSV={saveToCSV}
            isDataImported={isDataImported}
            importProgress={importProgress}
            fileInputRef={fileInputRef}
            onFileImport={handleFileImportWithStrategy}
            triggerFileInput={triggerFileInput}
          />
        </div>
      </div>
    </div>
  );
};

export default CandlestickChart; 