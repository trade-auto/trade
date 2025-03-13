import React, { useEffect } from 'react';
import { CandlestickChartProps } from './CandlestickChartTypes';
import { useChartData } from './CandlestickChartHooks';
import { useCsvFunctions } from './CandlestickChartCSV';
import { useBacktestChart } from './CandlestickChartBacktest';
import useUpbitStore from '../store/useUpbitStore';
import { TradeStrategy } from '../strategies/types';

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
    mode,
    handleOrder,
    onOrder,
  } = props;
  
  // 차트 데이터 및 기능 훅
  const {
    isFullscreen,
    chartHeight,
    chartPrice,
    progress,
    allData,
    markers,
    backtestResult,
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
  } = useChartData(symbol, chartType, initialAutoUpdate, mode);
  
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
  
  // 백테스트 마커 추출
  const backtestMarkers = csvBacktestResult?.markers || [];
  
  // 초봉 차트일 경우 자동 업데이트 및 실시간 API 효과
  useEffect(() => {
    if (chartType === 'seconds/60') {
      // 종목이 변경되었을 때 전체 데이터 로드
      if (symbol !== lastSymbol) {
        console.log('종목이 변경되었습니다. 전체 데이터를 다시 로드합니다.');
      }
    }
  }, [symbol, lastSymbol, chartType]);
  
  // 자동 업데이트 타이머
  useEffect(() => {
    if (chartType === 'seconds/60' && isAutoUpdate) {
      const updateInterval = 10000; // 10초
      
      const updateTimer = setInterval(() => {
        const now = new Date();
        setDateRange(prev => ({ ...prev, endDate: now }));
      }, updateInterval);
      
      return () => clearInterval(updateTimer);
    }
  }, [isAutoUpdate, chartType, setDateRange]);
  
  // 데이터 로드 트리거
  useEffect(() => {
    if (chartType === 'seconds/60' && isAutoUpdate) {
      loadData();
    }
  }, [dateRange, loadData, isAutoUpdate, chartType]);
  
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
      (markers) => {},
      setCsvBacktestResult
    );
  };
  
  // 파일 임포트 핸들러
  const onFileImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    handleFileImport(event, tradeStrategy as TradeStrategy);
  };

  return (
    <div className="relative">
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
            <ChartPrice 
              market={symbol}
              chartPrice={chartPrice}
            />
          </div>
        </div>
        
        {/* 초봉 차트일 경우 자동 업데이트 및 실시간 API 버튼 표시 */}
        {chartType === 'seconds/60' && (
          <div className="flex flex-wrap gap-2 mb-2">
            <div className="p-2 bg-gray-700 rounded-lg flex items-center justify-between w-full">
              <div className="text-white font-bold">업데이트 모드</div>
              <div className="flex gap-2">
                <button
                  onClick={handleAutoUpdateToggle}
                  className={`px-4 py-2 rounded-lg font-bold ${
                    isAutoUpdate 
                      ? 'bg-green-600 hover:bg-green-700' 
                      : 'bg-gray-600 hover:bg-gray-700'
                  } text-white flex items-center`}
                >
                  {isAutoUpdate 
                    ? <><span className="mr-1">✓</span> 자동 업데이트 중...</> 
                    : '자동 업데이트'
                  }
                </button>
                
                <button
                  onClick={handleRealtimeAPIToggle}
                  className={`px-4 py-2 rounded-lg font-bold ${
                    isRealtimeAPIEnabled 
                      ? 'bg-blue-600 hover:bg-blue-700' 
                      : 'bg-gray-600 hover:bg-gray-700'
                  } text-white flex items-center`}
                >
                  {isRealtimeAPIEnabled 
                    ? <><span className="mr-1">✓</span> 실시간 업데이트 중...</> 
                    : '실시간 업데이트'
                  }
                </button>
              </div>
            </div>
            {isRealtimeAPIEnabled && (
              <div className="w-full flex justify-between items-center text-sm px-2">
                <div className="text-gray-400">
                  {realtimeUpdateStatus.isUpdating ? (
                    <span className="text-blue-400">업데이트 중...</span>
                  ) : (
                    <span className="text-green-400">
                      마지막 업데이트: {realtimeUpdateStatus.lastUpdateTime || '없음'}
                    </span>
                  )}
                </div>
                <div className="text-gray-400">
                  총 업데이트 횟수: {realtimeUpdateStatus.updateCount}
                </div>
              </div>
            )}
            {isAutoUpdate && (
              <div className="text-xs text-gray-400 px-2 w-full text-right">
                자동 업데이트 완료 후 자동으로 실시간 업데이트로 전환됩니다
              </div>
            )}
          </div>
        )}
        
        {/* 차트 컨테이너 */}
        <div className="relative w-full">
          <ChartContainer
            isFullscreen={isFullscreen}
            chartHeight={chartHeight}
            toggleFullscreen={toggleFullscreen}
            symbol={symbol}
            markers={markers}
            chartType={chartType}
            isAutoUpdate={isAutoUpdate}
            isRealtimeAPIEnabled={isRealtimeAPIEnabled}
            onChartReady={handleChartReady}
          />
        </div>
      
        {/* 설정 및 결과 섹션 */}
        <div className="grid grid-cols-1 md:grid-cols-1 gap-4">
          {/* 차트 설정 */}
          <div>
            <ChartSettings 
              showMA={showMA}
              updateShowMA={updateShowMA}
              chartHeight={chartHeight}
              handleHeightChange={handleHeightChange}
            />
          </div>
          
          {/* 백테스트 결과 */}
          <div>
            <BacktestResults backtestResult={backtestResult} />
          </div>
        </div>
        
        {/* CSV 다운로더 */}
        <div>
          <CsvDownloader
            csvDateRange={{
              startDate: csvDateRange.startDate,
              endDate: csvDateRange.endDate
            }}
            setCsvDateRange={(range) => {
              setCsvDateRange({
                startDate: range.startDate || new Date(),
                endDate: range.endDate || new Date()
              });
            }}
            csvLoading={csvLoading}
            csvProgress={csvProgress}
            allData={allData as unknown as any[]}
            saveToCSV={saveToCSV}
          />
        </div>

        {/* CSV 임포트 진행률 표시 */}
        <div>
          <div className="text-white">CSV 임포트 진행률: {importProgress}%</div>
        </div>

        {/* 백테스트 차트 섹션 */}
        {isDataImported && importedData.length > 0 && (
          <div>
            <div className="relative w-full mt-4">
              <div className="text-white text-lg font-bold mb-2">백테스트 차트</div>
              <ChartContainer
                isFullscreen={isFullscreen}
                chartHeight={chartHeight}
                toggleFullscreen={toggleFullscreen}
                symbol={symbol}
                markers={backtestMarkers}
                chartType={chartType}
                onChartReady={handleBacktestChartInit}
                data={importedData}
              />
            </div>
            <div>
              <BacktestResults backtestResult={csvBacktestResult} />
            </div>
          </div>
        )}
        
        {/* CSV 임포트 버튼 */}
        <div className="mb-4">
          <input
            type="file"
            ref={fileInputRef}
            onChange={onFileImport}
            accept=".csv"
            className="hidden"
          />
          <button
            onClick={triggerFileInput}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
          >
            CSV 데이터 임포트
          </button>
        </div>
      </div>
    </div>
  );
};

export { CandlestickChart }; 