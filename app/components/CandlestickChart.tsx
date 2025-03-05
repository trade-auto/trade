import { useCallback, useEffect, useState, useRef } from 'react';
import Websocket from 'react-websocket';
import {
  IChartApi,
  ISeriesApi,
} from 'lightweight-charts';
import {
  UpbitCandle,
} from '../types/candlestick';
import ChartControls from './ChartControls';
import ChartPrice from './ChartPrice';
import ChartSettings from './ChartSettings';
import BacktestResults from './BacktestResults';
import CsvDownloader from './CsvDownloader';
import ChartContainer from './ChartContainer';
import {
  createTradeMarkers,
} from '../utils/chartHelpers';
import useChartStore from '../store/chartStore';
import { updateChartSeries } from '../utils/chartUtils';

interface OrderParams {
  market: string;
  side: 'bid' | 'ask';
  volume: string;
  price: string;
  ord_type: string;
  mode: string;
}

interface CandlestickChartProps {
  symbol: string;
  chartType: string;
  initialAutoUpdate?: boolean;
  mode?: 'live' | 'test';
  handleOrder?: (params: OrderParams) => Promise<void>;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  onOrder?: (price: number, isMarketOrder: boolean) => void;
}

const CandlestickChart: React.FC<CandlestickChartProps> = ({
  symbol,
  chartType,
  initialAutoUpdate,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  mode,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  handleOrder,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  onOrder,
}) => {
  // 차트 상태 - Zustand 스토어에서 가져오기
  const {
    isAutoUpdate,
    isRealtimeAPIEnabled,
    showMA,
    lastUpdated,
    currentPrice, 
    chartPrice,
    allData,
    backtestResult,
    setAutoUpdate,
    setShowMA,
    loadData,
    updatePriceFromWebsocket,
    getTimeValue
  } = useChartStore();
  
  // 로컬 상태 - 전체화면 및 차트 높이 (UI 관련)
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [chartHeight, setChartHeight] = useState(500);
  
  // CSV 상태 (로컬 유지)
  const [csvDateRange, setCsvDateRange] = useState({
    startDate: new Date(new Date().setDate(new Date().getDate() - 7)),
    endDate: new Date(),
  });
  const [csvLoading, setCsvLoading] = useState(false);
  const [csvProgress, setCsvProgress] = useState(0);
  
  // 차트 레퍼런스
  const chartApiRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<"Histogram"> | null>(null);
  const sixtyEMASeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const oneTwentyEMASeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const twoFortyEMASeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const threeHundredSixtyEMASeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const threeHundredEMASeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const nineHundredEMASeriesRef = useRef<ISeriesApi<"Line"> | null>(null);

  // 초기화 시 자동 업데이트 설정
  useEffect(() => {
    if (initialAutoUpdate !== undefined) {
      setAutoUpdate(initialAutoUpdate);
    }
  }, [initialAutoUpdate, setAutoUpdate]);

  // 주기적 업데이트 설정
  useEffect(() => {
    if (isAutoUpdate) {
      const updateInterval = 10000; // 10초
      
      const updateTimer = setInterval(() => {
        loadData(symbol, chartType);
      }, updateInterval);
      
      return () => clearInterval(updateTimer);
    }
  }, [isAutoUpdate, loadData, symbol, chartType]);

  // 컴포넌트 마운트 시 데이터 로드
  useEffect(() => {
    loadData(symbol, chartType);
  }, [loadData, symbol, chartType]);

  // 차트 초기화 콜백
  const handleChartReady = useCallback((
    chartApi: IChartApi,
    candleSeries: ISeriesApi<"Candlestick">,
    volumeSeries: ISeriesApi<"Histogram">,
    sixtyEMASeries: ISeriesApi<"Line">,
    oneTwentyEMASeries: ISeriesApi<"Line">,
    twoFortyEMASeries: ISeriesApi<"Line">,
    threeHundredSixtyEMASeries: ISeriesApi<"Line">,
    threeHundredEMASeries: ISeriesApi<"Line">,
    nineHundredEMASeries: ISeriesApi<"Line">
  ) => {
    chartApiRef.current = chartApi;
    candleSeriesRef.current = candleSeries;
    volumeSeriesRef.current = volumeSeries;
    sixtyEMASeriesRef.current = sixtyEMASeries;
    oneTwentyEMASeriesRef.current = oneTwentyEMASeries;
    twoFortyEMASeriesRef.current = twoFortyEMASeries;
    threeHundredSixtyEMASeriesRef.current = threeHundredSixtyEMASeries;
    threeHundredEMASeriesRef.current = threeHundredEMASeries;
    nineHundredEMASeriesRef.current = nineHundredEMASeries;
    
    // 볼륨 시리즈 설정
    chartApi.priceScale('volume').applyOptions({
      scaleMargins: {
        top: 0.8,
        bottom: 0,
      },
      borderVisible: false,
    });
    
    // 차트 준비 후 데이터 로드
    loadData(symbol, chartType);
  }, [loadData, symbol, chartType]);

  // 전체화면 토글
  const toggleFullscreen = useCallback(() => {
    const elem = document.documentElement;
    
    if (!isFullscreen) {
      if (elem.requestFullscreen) {
        elem.requestFullscreen();
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    }
    
    setIsFullscreen(!isFullscreen);
  }, [isFullscreen]);

  // 차트 높이 변경 핸들러
  const handleHeightChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setChartHeight(Number(e.target.value));
  }, []);

  // CSV 저장 함수
  const saveToCSV = useCallback(async () => {
    if (csvLoading || !allData || allData.length === 0) {
      alert('데이터가 없습니다');
      return;
    }
    
    try {
      setCsvLoading(true);
      setCsvProgress(0);
      
      // 데이터 필터링
      const csvFromTime = csvDateRange.startDate.getTime() / 1000;
      const csvToTime = (csvDateRange.endDate || new Date()).getTime() / 1000;
      
      const filteredData = allData.filter((candle) => {
        const candleTime = typeof candle.time === 'number' 
          ? candle.time 
          : getTimeValue(candle.time);
        return candleTime >= csvFromTime && candleTime <= csvToTime;
      });
      
      if (filteredData.length === 0) {
        alert('선택한 기간 내 데이터가 없습니다');
        setCsvLoading(false);
        return;
      }
      
      // CSV 헤더
      let csv = 'time,open,high,low,close,volume\n';
      
      // CSV 데이터 행
      filteredData.forEach((candle, index) => {
        const time = typeof candle.time === 'number' 
          ? new Date(candle.time * 1000).toISOString() 
          : new Date(getTimeValue(candle.time) * 1000).toISOString();
        
        csv += `${time},${candle.open},${candle.high},${candle.low},${candle.close},${candle.volume}\n`;
        
        // 진행률 업데이트
        const progress = Math.round((index + 1) / filteredData.length * 100);
        setCsvProgress(progress);
      });
      
      // CSV 파일 생성 및 다운로드
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      
      // 파일명 포맷팅 함수 (formatDate 대체)
      const formatDate = (date: Date) => {
        return date.toISOString().split('T')[0];
      };
      
      link.setAttribute('download', `${symbol}_${chartType}_${formatDate(csvDateRange.startDate)}_to_${formatDate(csvDateRange.endDate || new Date())}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      setCsvProgress(100);
    } catch (error) {
      console.error('CSV 생성 오류:', error);
      alert('CSV 파일 생성 중 오류가 발생했습니다');
    } finally {
      setCsvLoading(false);
    }
  }, [allData, csvDateRange, symbol, chartType, csvLoading, getTimeValue]);

  // 웹소켓 메시지 핸들러
  const handleSocketData = useCallback((data: string) => {
    if (!isRealtimeAPIEnabled) return;
    
    try {
      const parsedData = JSON.parse(data);
      if (parsedData && parsedData.type === 'ticker' && parsedData.code === symbol) {
        const price = parsedData.trade_price;
        updatePriceFromWebsocket(price);
      }
    } catch (error) {
      console.error('웹소켓 데이터 파싱 오류:', error);
    }
  }, [isRealtimeAPIEnabled, symbol, updatePriceFromWebsocket]);

  // 데이터 변경 시 차트 업데이트
  useEffect(() => {
    if (
      allData.length > 0 &&
      candleSeriesRef.current && 
      volumeSeriesRef.current && 
      sixtyEMASeriesRef.current && 
      oneTwentyEMASeriesRef.current && 
      twoFortyEMASeriesRef.current && 
      threeHundredSixtyEMASeriesRef.current &&
      threeHundredEMASeriesRef.current &&
      nineHundredEMASeriesRef.current
    ) {
      updateChartSeries(
        chartApiRef,
        candleSeriesRef,
        volumeSeriesRef,
        {
          sixtyEMA: sixtyEMASeriesRef,
          oneTwentyEMA: oneTwentyEMASeriesRef,
          twoFortyEMA: twoFortyEMASeriesRef,
          threeHundredSixtyEMA: threeHundredSixtyEMASeriesRef,
          threeHundredEMA: threeHundredEMASeriesRef,
          nineHundredEMA: nineHundredEMASeriesRef
        },
        allData,
        showMA
      );
    }
  }, [allData, showMA]);

  return (
    <div className="w-full bg-gray-800 rounded-lg p-4 overflow-hidden">
      <div className="grid grid-cols-1 gap-4">
        {/* 가격 정보 및 컨트롤 섹션 */}
        <div className="flex flex-col md:flex-row gap-4">
          {/* 차트 컨트롤 */}
          <div className="w-full md:w-1/2">
            <ChartControls
              symbol={symbol}
              chartType={chartType}
            />
          </div>
          
          {/* 가격 정보 */}
          <div className="w-full md:w-1/2">
            <ChartPrice 
              currentPrice={currentPrice}
              chartPrice={chartPrice}
              lastUpdated={lastUpdated}
            />
          </div>
        </div>
        
        {/* 차트 컨테이너 */}
        <div className="relative w-full">
          <ChartContainer
            isFullscreen={isFullscreen}
            chartHeight={chartHeight}
            toggleFullscreen={toggleFullscreen}
            symbol={symbol}
            chartType={chartType}
            onChartReady={handleChartReady}
            createTradeMarkers={createTradeMarkers}
          />
        </div>
        
        {/* 설정 및 결과 섹션 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* 차트 설정 */}
          <div>
            <ChartSettings 
              showMA={showMA}
              updateShowMA={setShowMA}
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
            allData={allData as unknown as UpbitCandle[]}
            symbol={symbol}
            chartType={chartType}
            saveToCSV={saveToCSV}
          />
        </div>
      </div>
      
      {/* 웹소켓 연결 */}
      {isRealtimeAPIEnabled && (
        <Websocket
          url="wss://api.upbit.com/websocket/v1"
          onOpen={() => {
            console.log('웹소켓 연결됨');
          }}
          onMessage={handleSocketData}
          onError={(error: Error) => {
            console.error('웹소켓 오류:', error);
          }}
          onClose={() => {
            console.log('웹소켓 연결 닫힘');
          }}
          options={{ 
            shouldReconnect: () => isRealtimeAPIEnabled 
          }}
          protocols={[]}
          reconnectIntervalInMilliSeconds={5000}
          onSend={() => JSON.stringify([
            { ticket: `ticker-${symbol}` },
            { type: 'ticker', codes: [symbol] }
          ])}
        />
      )}
    </div>
  );
};

export { CandlestickChart }; 