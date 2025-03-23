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
  
  // 컴포넌트 마운트 시 날짜 범위를 명시적으로 설정
  useEffect(() => {
    const now = new Date();
    let startDate: Date;
    
    if (chartType.startsWith('seconds/')) {
      // 초봉: 최근 2시간 데이터로 명시적 설정
      startDate = new Date(now.getTime() - 2 * 60 * 60 * 1000);
      console.log('초봉 차트 - 시작 날짜를 2시간 전으로 설정:', startDate.toLocaleString('ko-KR'));
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
      () => {},
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
                    <span>데이터 업데이트 중...</span>
                  ) : (
                    <span>
                      마지막 업데이트: {realtimeUpdateStatus.lastUpdateTime || '없음'} (총 {realtimeUpdateStatus.updateCount}회)
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
        
        {/* 차트 설정 컴포넌트 추가 */}
        <ChartSettings
          showMA={showMA}
          updateShowMA={updateShowMA}
          chartHeight={chartHeight}
          handleHeightChange={handleHeightChange}
        />
        
        {/* 차트 컨테이너 */}
        <div className="relative w-full">
          <ChartContainer
            isFullscreen={isFullscreen}
            chartHeight={chartHeight}
            toggleFullscreen={toggleFullscreen}
            symbol={symbol}
            chartType={chartType}
            markers={[]}
            isAutoUpdate={isAutoUpdate}
            isRealtimeAPIEnabled={isRealtimeAPIEnabled}
            data={allData}
            onChartReady={handleChartReady}
          />
        </div>
        
        {/* 백테스트 결과 */}
        {csvBacktestResult && (
          <BacktestResults backtestResult={csvBacktestResult} />
        )}
        
        {/* CSV 다운로드 버튼 */}
        <CsvDownloader
          csvDateRange={csvDateRange}
          csvLoading={csvLoading}
          csvProgress={csvProgress}
          allData={allData}
          setCsvDateRange={(range) => setCsvDateRange(range as any)}
          saveToCSV={saveToCSV}
        />
        
        {/* 파일 임포트 버튼 */}
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
          CSV 파일 임포트
        </button>
      </div>
    </div>
  );
};

export default CandlestickChart; 