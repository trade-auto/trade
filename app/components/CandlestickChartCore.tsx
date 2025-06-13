import React, { useEffect, useCallback, useState } from 'react';
import { CandlestickChartProps } from './CandlestickChartTypes';
import { useChartData } from './CandlestickChartHooks';
import { useCsvFunctions } from './CandlestickChartCSV';
import { useBacktestChart } from './CandlestickChartBacktest';
import useUpbitStore from '../store/useUpbitStore';
import { TradeStrategy } from '../strategies/types';
import { DateRange, BacktestResult } from '../types/candlestick';
import { CandlestickChart } from './CandlestickChart';
import MACDChart from './MACDChart';
import PolMACDChart from './PolMACDChart';
import PolMACDChartFixed from './PolMACDChartFixed';

// 컴포넌트
import ChartControls from './ChartControls';
import ChartPrice from './ChartPrice';
import ChartSettings from './ChartSettings';
import BacktestResults from './BacktestResults';
import CsvDownloader from './CsvDownloader';
import ChartContainer from './ChartContainer';
import TradingStrategyHover from './TradingStrategyHover';
import { CoinSelector } from './CoinSelector';

const CandlestickChartCore: React.FC<CandlestickChartProps> = (props) => {
  const {
    symbol,
    chartType: propsChartType,
    initialAutoUpdate = true,
    initialDataCount = 400, // 기본값 400으로 설정
    mode,
    handleOrder,
    onOrder,
    onChartTypeChange: propsOnChartTypeChange,
    showMA: initialShowMA,
  } = props;
  
  // 차트 타입의 기본값을 5분봉으로 설정
  const [chartType, setChartType] = React.useState<string>(propsChartType || 'minutes/5');
  const [dataCount, setDataCount] = React.useState<number>(initialDataCount);
  
  // 직접 dateRange 상태 관리
  const [localDateRange, setLocalDateRange] = React.useState<DateRange>({
    startDate: new Date(new Date().getTime() - 48 * 60 * 60 * 1000), // 기본 48시간
    endDate: null
  });
  
  // 이동평균선 표시 상태는 useChartData 훅에서 관리됨
  
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
  
  // 컴포넌트 마운트 시 localStorage에서 캔들 개수 불러오기 및 240 EMA 설정 확인
  React.useEffect(() => {
    try {
      const savedCount = localStorage.getItem('chartDataCount');
      console.log('Saved candle count from localStorage:', savedCount);
      if (savedCount) {
        const parsedCount = parseInt(savedCount, 10);
        // 2300이면 400으로 재설정
        if (parsedCount > 1000) {
          console.log('Resetting candle count from', parsedCount, 'to 400');
          setDataCount(400);
          localStorage.setItem('chartDataCount', '400');
        } else if (parsedCount === 200 || parsedCount === 300) {
          setDataCount(400);
          localStorage.setItem('chartDataCount', '400');
        } else {
          setDataCount(parsedCount);
        }
      } else {
        // 저장된 값이 없으면 400으로 설정
        setDataCount(400);
        localStorage.setItem('chartDataCount', '400');
      }
      
      // 240 EMA 설정 확인 및 수정
      const maSettings = localStorage.getItem('maSettings');
      if (maSettings) {
        const parsedSettings = JSON.parse(maSettings);
        console.log('Current maSettings in localStorage:', parsedSettings);
        
        // props로 240 EMA가 true로 전달되었는데 localStorage가 false인 경우
        if (initialShowMA?.twoForty === true && parsedSettings.twoForty === false) {
          console.log('Fixing 240 EMA setting in localStorage...');
          parsedSettings.twoForty = true;
          localStorage.setItem('maSettings', JSON.stringify(parsedSettings));
          console.log('240 EMA setting updated in localStorage');
        }
      }
    } catch (error) {
      console.error('설정 로드/수정 실패:', error);
    }
  }, [initialShowMA]);
  
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
  } = useChartData(symbol, chartType, initialAutoUpdate, mode, dataCount, initialShowMA);
  
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
  
  // 백테스트 결과 상태 추가
  const [polMacdBacktestResult, setPolMacdBacktestResult] = useState<BacktestResult | null>(null);
  
  // 컴포넌트 마운트 시 날짜 범위를 명시적으로 설정
  useEffect(() => {
    const now = new Date();
    let startDate = new Date(now.getTime() - 8 * 60 * 60 * 1000); // 기본값 설정
    
    if (chartType.startsWith('seconds/')) {
      // 초봉: 12시간으로 확장 (12시간 = 720개 캔들)
      startDate = new Date(now.getTime() - 12 * 60 * 60 * 1000);
      console.log('초봉 차트 - 시작 날짜를 12시간 전으로 설정:', startDate.toLocaleString('ko-KR'));
      setLocalDateRange((prev: DateRange) => ({ ...prev, startDate }));
    } else if (chartType.startsWith('minutes/')) {
      // 분봉: 기간 설정
      const minutes = parseInt(chartType.split('/')[1]);
      if (minutes === 5) {
        // 5분봉: 더 많은 데이터를 위해 7일로 확장 (7일 = 2016개 캔들)
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      } else if (minutes === 15) {
        // 15분봉: 14일로 확장 (14일 = 1344개 캔들)
        startDate = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
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
    fiveEMASeries: any,
    tenEMASeries: any,
    twentyEMASeries: any,
    thirtyEMASeries: any,
    fortyEightEMASeries: any,
    sixtyEMASeries: any,
    ninetyEMASeries: any,
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
      fiveEMASeries,
      tenEMASeries,
      twentyEMASeries,
      thirtyEMASeries,
      fortyEightEMASeries,
      sixtyEMASeries,
      ninetyEMASeries,
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
          <div className="mb-4 relative">
            <ChartContainer
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
              onChartReady={isDataImported ? handleBacktestChartInit : handleChartReady}
            />
          </div>
          
          {/* 코인 선택기 추가 */}
          <CoinSelector />
          
          {tradeStrategy === 'MACD' && (polMacdBacktestResult || csvBacktestResult) && (
            <div className="backtest-results-container mb-4" style={{ 
              padding: '20px',
              borderTop: '1px solid #ddd',
              backgroundColor: '#f8f9fa'
            }}>
              <h3 className="text-lg font-bold mb-4">백테스트 결과</h3>
              <BacktestResults backtestResult={polMacdBacktestResult || csvBacktestResult} />
            </div>
          )}
        </div>

        {/* MACD 관련 차트들 - 항상 표시 */}
        <div className="w-full" style={{ height: '900px' }}>
          <h3 className="text-lg font-bold mb-2 text-white">EMA-MACD-RSI 전략 차트</h3>
          <div className="bg-gray-800 p-3 rounded-lg mb-3 text-sm">
            <div className="grid grid-cols-2 gap-4 text-white">
              <div>
                <strong className="text-blue-400">매수 조건 (모두 충족 시):</strong>
                <ul className="list-disc list-inside mt-1 text-gray-300">
                  <li><span className="text-purple-400">TREND</span>: 200 EMA 상승 & 가격 > 200 EMA</li>
                  <li><span className="text-purple-500">EMA20</span>: 20 EMA 근처 되돌림 (±0.5 ATR)</li>
                  <li><span className="text-purple-600">MACD+</span>: MACD 골든크로스</li>
                  <li><span className="text-purple-300">RSI+</span>: RSI 55 상향 돌파</li>
                  <li><span className="text-blue-500 font-bold">BUY ▲</span>: 모든 조건 충족 시 매수 신호</li>
                </ul>
              </div>
              <div>
                <strong className="text-red-400">매도 조건 (하나라도 충족 시):</strong>
                <ul className="list-disc list-inside mt-1 text-gray-300">
                  <li>5 EMA < 20 EMA 데드크로스</li>
                  <li><span className="text-purple-600">MACD-</span>: 히스토그램 2봉 연속 음수</li>
                  <li><span className="text-purple-300">RSI-</span>: RSI ≥ 70 후 첫 음봉</li>
                  <li><span className="text-red-500 font-bold">SELL ▼</span>: 조건 충족 시 매도 신호</li>
                </ul>
              </div>
            </div>
            <div className="mt-2 text-yellow-400">
              💡 보라색 마커는 매매 신호 전후 10개 캔들에서만 표시됩니다.
            </div>
          </div>
          <PolMACDChartFixed 
            data={isDataImported ? importedData : allData} 
            height={800} 
            showMA={chartShowMA}
            onBacktestResultChange={setPolMacdBacktestResult} 
          />
        </div>
        {tradeStrategy === 'MACD' && (
          <div className="w-full" style={{ height: '300px' }}>
            <MACDChart data={isDataImported ? importedData : allData} />
          </div>
        )}
        
        {/* 설정 및 결과 섹션 */}
        <div className="flex flex-col md:flex-row gap-4">
          <div className="w-full md:w-1/2">
            <ChartSettings
              showMA={chartShowMA}
              updateShowMA={updateShowMA}
              chartHeight={chartHeight}
              handleHeightChange={handleHeightChange}
              chartType={chartType}
              onChartTypeChange={(type) => setChartType(type)}
            />
          </div>
          <div className="w-full md:w-1/2">
            {/* 백테스트 결과 중복 표시 제거 */}
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