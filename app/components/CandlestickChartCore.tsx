import React, { useEffect, useCallback } from 'react';
import { CandlestickChartProps } from './CandlestickChartTypes';
import { useChartData } from './CandlestickChartHooks';
import { useCsvFunctions } from './CandlestickChartCSV';
import { useBacktestChart } from './CandlestickChartBacktest';
import useUpbitStore from '../store/useUpbitStore';
import { TradeStrategy } from '../strategies/types';
import { DateRange } from '../types/candlestick';
import { CandlestickChart } from './CandlestickChart';
import MACDChart from './MACDChart';
import PolMACDChart from './PolMACDChart';

// 컴포넌트
import ChartControls from './ChartControls';
import ChartPrice from './ChartPrice';
import ChartSettings from './ChartSettings';
import BacktestResults from './BacktestResults';
import CsvDownloader from './CsvDownloader';
import ChartContainer from './ChartContainer';
import TradingStrategyHover from './TradingStrategyHover';

const CandlestickChartCore: React.FC<CandlestickChartProps> = (props) => {
  const {
    symbol,
    chartType: propsChartType,
    initialAutoUpdate = true,
    initialDataCount = 200, // 기본값 200으로 설정
    mode,
    handleOrder,
    onOrder,
    onChartTypeChange: propsOnChartTypeChange,
  } = props;
  
  // 차트 타입의 기본값을 5분봉으로 설정
  const [chartType, setChartType] = React.useState<string>(propsChartType || 'minutes/5');
  const [dataCount, setDataCount] = React.useState<number>(initialDataCount);
  
  // 직접 dateRange 상태 관리
  const [localDateRange, setLocalDateRange] = React.useState<DateRange>({
    startDate: new Date(new Date().getTime() - 48 * 60 * 60 * 1000), // 기본 48시간
    endDate: null
  });
  
  // 이동평균선 표시 상태 초기화
  const [showMA, setShowMA] = React.useState({
    five: false,
    ten: false,
    twenty: false,
    thirty: false,
    ninety: false,
    sixty: false,
    oneTwenty: false,
    twoForty: false,
    threeHundredSixty: false,
    sixHundred: false,
    nineHundred: false
  });
  
  // 차트 타입이 변경될 때 props에 전달된 onChartTypeChange 함수 호출
  React.useEffect(() => {
    if (propsOnChartTypeChange && typeof propsOnChartTypeChange === 'function') {
      propsOnChartTypeChange(chartType);
    }
  }, [chartType, propsOnChartTypeChange]);
  
  // 캔들 개수 증가 함수
  const increaseDataCount = useCallback(() => {
    setDataCount(prev => {
      const newCount = prev + 100;
      // localStorage에 저장
      try {
        localStorage.setItem('chartDataCount', newCount.toString());
      } catch (error) {
        console.error('캔들 개수 저장 실패:', error);
      }
      return newCount;
    });
  }, []);
  
  // 캔들 개수 감소 함수
  const decreaseDataCount = useCallback(() => {
    setDataCount(prev => {
      // 최소 200개는 유지
      const newCount = Math.max(200, prev - 100);
      // localStorage에 저장
      try {
        localStorage.setItem('chartDataCount', newCount.toString());
      } catch (error) {
        console.error('캔들 개수 저장 실패:', error);
      }
      return newCount;
    });
  }, []);
  
  // 컴포넌트 마운트 시 localStorage에서 캔들 개수 불러오기
  React.useEffect(() => {
    try {
      const savedCount = localStorage.getItem('chartDataCount');
      if (savedCount) {
        setDataCount(parseInt(savedCount, 10));
      }
    } catch (error) {
      console.error('저장된 캔들 개수 로드 실패:', error);
    }
  }, []);
  
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
    showMA: chartShowMA,
    realtimeUpdateStatus,
    
    // 함수
    toggleFullscreen,
    updateShowMA,
    handleHeightChange: handleHeightChangeEvent,
    handleAutoUpdateToggle,
    handleRealtimeAPIToggle,
    handleChartReady,
    loadData
  } = useChartData(symbol, chartType, initialAutoUpdate, mode, dataCount);
  
  // 차트 높이 변경 핸들러
  const handleHeightChange = (height: number) => {
    handleHeightChangeEvent({ target: { value: height.toString() } } as React.ChangeEvent<HTMLInputElement>);
  };
  
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
    let startDate = new Date(now.getTime() - 8 * 60 * 60 * 1000); // 기본값 설정
    
    if (chartType.startsWith('seconds/')) {
      // 초봉: 최근 2시간 데이터로 명시적 설정
      startDate = new Date(now.getTime() - 2 * 60 * 60 * 1000);
      console.log('초봉 차트 - 시작 날짜를 2시간 전으로 설정:', startDate.toLocaleString('ko-KR'));
      setLocalDateRange((prev: DateRange) => ({ ...prev, startDate }));
    } else if (chartType.startsWith('minutes/')) {
      // 분봉: 기간 설정
      const minutes = parseInt(chartType.split('/')[1]);
      if (minutes === 5) {
        // 5분봉: 576개 캔들 데이터 (5분 × 576 = 2880분 = 48시간)
        startDate = new Date(now.getTime() - 48 * 60 * 60 * 1000);
      } else if (minutes === 15) {
        // 15분봉: 672개 캔들 데이터 (15분 × 672 = 10080분 = 168시간 = 7일)
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      }
      console.log(`${minutes}분봉 차트 - 시작 날짜 설정:`, startDate.toLocaleString('ko-KR'));
      setLocalDateRange((prev: DateRange) => ({ ...prev, startDate }));
    }

    // MACD 계산을 위한 추가 데이터 기간 설정
    const macdStartDate = new Date(startDate.getTime() - 26 * 24 * 60 * 60 * 1000); // 26일 추가
    setLocalDateRange((prev: DateRange) => ({ ...prev, startDate: macdStartDate }));
  }, [chartType]);
  
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
    console.log(`날짜 범위 변경됨: ${localDateRange.startDate.toLocaleString()} - 데이터 새로 로드`);
  }, [localDateRange, loadData]);
  
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
        <div className="flex flex-col gap-4">
          {/* 차트 컨트롤 */}
          <div className="flex flex-wrap items-center gap-4">
            <ChartControls
              dateRange={localDateRange}
              handleDateRangeChange={(date) => setLocalDateRange((prev: DateRange) => ({ ...prev, startDate: date }))}
              handleEndDateChange={(date) => setLocalDateRange((prev: DateRange) => ({ ...prev, endDate: date }))}
              progress={progress}
              isAutoUpdate={isAutoUpdate}
              isRealtimeAPIEnabled={isRealtimeAPIEnabled}
              handleAutoUpdateToggle={handleAutoUpdateToggle}
              handleRealtimeAPIToggle={handleRealtimeAPIToggle}
              realtimeUpdateStatus={realtimeUpdateStatus}
              dataCount={dataCount}
              increaseDataCount={increaseDataCount}
              decreaseDataCount={decreaseDataCount}
            />
          </div>
          
          {/* 가격 정보 */}
          <div className="flex items-center gap-4">
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
            showMA={chartShowMA}
          />
        </div>

        {/* MACD 관련 차트들 - tradeStrategy가 'MACD'일 때만 표시 */}
        {tradeStrategy === 'MACD' && (
          <>
            <div className="w-full" style={{ height: '400px' }}>
              <PolMACDChart data={isDataImported ? importedData : allData} height={400} showMA={showMA} />
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
              updateShowMA={setShowMA}
              chartHeight={chartHeight}
              handleHeightChange={handleHeightChange}
              chartType={chartType}
              onChartTypeChange={(type) => setChartType(type)}
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

export default CandlestickChartCore; 