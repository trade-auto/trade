import { useCallback, useEffect, useState, useRef } from 'react';
import Websocket from 'react-websocket';
import {
  IChartApi,
  ISeriesApi,
  Time,
  BusinessDay
} from 'lightweight-charts';
import {
  DateRange,
  ExtendedCandlestickData,
  UpbitCandle,
  CrossPoint,
  BacktestResult,
  MASettings,
} from '../types/candlestick';
import ChartControls from './ChartControls';
import ChartPrice from './ChartPrice';
import ChartSettings from './ChartSettings';
import BacktestResults from './BacktestResults';
import CsvDownloader from './CsvDownloader';
import ChartContainer from './ChartContainer';
import {
  getInitialDateRange,
  findCrossPoints,
  createTradeMarkers,
  calculateEMA,
  getChartEndpoint,
  calculateBacktestResult,
  formatDate,
} from '../utils/chartHelpers';

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
  // 차트 상태
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [chartHeight, setChartHeight] = useState(500);
  const [currentPrice, setCurrentPrice] = useState(0);
  const [chartPrice, setChartPrice] = useState(0);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [allData, setAllData] = useState<ExtendedCandlestickData[]>([]);
  const [crossPoints, setCrossPoints] = useState<CrossPoint[]>([]);
  const [backtestResult, setBacktestResult] = useState<BacktestResult | null>(null);
  
  // 설정 상태
  const [dateRange, setDateRange] = useState<DateRange>(getInitialDateRange(chartType));
  const [isAutoUpdate, setIsAutoUpdate] = useState<boolean>(initialAutoUpdate ?? true);
  const [isRealtimeAPIEnabled, setIsRealtimeAPIEnabled] = useState(true);
  const [showMA, setShowMA] = useState<MASettings>({
    sixty: true,
    oneTwenty: true,
    twoForty: true,
    threeHundredSixty: true,
  });
  
  // CSV 상태
  const [csvDateRange, setCsvDateRange] = useState<DateRange>({
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
  
  // 기타 상태
  const ongoingRequestRef = useRef<boolean>(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // 타임스탬프 처리 유틸리티 함수
  const getTimeValue = useCallback((time: Time | BusinessDay | string): number => {
    if (typeof time === 'number') {
      return time;
    } else if (typeof time === 'string') {
      // ISO 날짜 문자열인 경우
      return new Date(time).getTime() / 1000;
    } else if ('timestamp' in time && typeof time.timestamp === 'number') {
      return time.timestamp;
    } else if ('year' in time && 'month' in time && 'day' in time) {
      // BusinessDay 형식인 경우
      const date = new Date(time.year, time.month - 1, time.day);
      return date.getTime() / 1000;
    }
    
    // 기본값
    return new Date().getTime() / 1000;
  }, []);

  // 데이터 로드 함수
  const loadData = useCallback(async () => {
    if (ongoingRequestRef.current) return;
    
    ongoingRequestRef.current = true;
    setIsLoading(true);
    setProgress(0);
    
    try {
      const endpoint = getChartEndpoint(chartType);
      const count = chartType.startsWith('seconds/') ? 200 : 200; // 초봉은 200개씩 가져오기
      
      const to = dateRange.endDate ? dateRange.endDate.toISOString() : new Date().toISOString();
      
      console.log(`API 요청: https://api.upbit.com/v1/candles/${endpoint}?market=${symbol}&to=${to}&count=${count}`);
      
      const response = await fetch(
        `https://api.upbit.com/v1/candles/${endpoint}?market=${symbol}&to=${to}&count=${count}`
      );
      
      if (!response.ok) {
        throw new Error('데이터 로딩 실패');
      }
      
      const data: UpbitCandle[] = await response.json();
      
      if (data && data.length > 0) {
        // 진행 상태 업데이트
        setProgress(30);
        
        // 데이터 처리
        const processedData: ExtendedCandlestickData[] = data.map((candle: UpbitCandle) => {
          const time = new Date(candle.candle_date_time_kst).getTime() / 1000;
          return {
            time: time as Time,
            open: candle.opening_price,
            high: candle.high_price,
            low: candle.low_price,
            close: candle.trade_price,
            volume: candle.candle_acc_trade_volume,
          };
        });
        
        // 진행 상태 업데이트
        setProgress(50);
        
        // 데이터 정렬 (최신 데이터가 마지막에 오도록)
        processedData.sort((a, b) => {
          if (typeof a.time === 'number' && typeof b.time === 'number') {
            return a.time - b.time;
          }
          return 0;
        });
        
        // 진행 상태 업데이트
        setProgress(70);
        
        // 시리즈 데이터 업데이트
        if (
          candleSeriesRef.current && 
          volumeSeriesRef.current && 
          sixtyEMASeriesRef.current && 
          oneTwentyEMASeriesRef.current && 
          twoFortyEMASeriesRef.current && 
          threeHundredSixtyEMASeriesRef.current
        ) {
          // 캔들 데이터 설정
          candleSeriesRef.current.setData(processedData);
          
          // 볼륨 데이터 설정
          const volumeData = processedData.map((d) => ({
            time: d.time,
            value: d.volume,
            color: d.close >= d.open ? '#26a69a' : '#ef5350',
          }));
          volumeSeriesRef.current.setData(volumeData);
          
          // EMA 계산 및 설정
          const ema60Data = calculateEMA(processedData, 60);
          const ema120Data = calculateEMA(processedData, 120);
          const ema240Data = calculateEMA(processedData, 240);
          const ema360Data = calculateEMA(processedData, 360);
          
          sixtyEMASeriesRef.current.setData(ema60Data);
          oneTwentyEMASeriesRef.current.setData(ema120Data);
          twoFortyEMASeriesRef.current.setData(ema240Data);
          threeHundredSixtyEMASeriesRef.current.setData(ema360Data);
          
          // 시리즈 가시성 설정
          sixtyEMASeriesRef.current.applyOptions({ visible: showMA.sixty });
          oneTwentyEMASeriesRef.current.applyOptions({ visible: showMA.oneTwenty });
          twoFortyEMASeriesRef.current.applyOptions({ visible: showMA.twoForty });
          threeHundredSixtyEMASeriesRef.current.applyOptions({ visible: showMA.threeHundredSixty });
          
          // 매수/매도 포인트 계산
          const cross = findCrossPoints(ema60Data, ema120Data, ema240Data, ema360Data);
          setCrossPoints(cross);
          
          // 백테스트 결과 계산
          const backtestResult = calculateBacktestResult(processedData, cross, 'test');
          setBacktestResult(backtestResult);
          
          // 현재 가격 설정
          if (processedData.length > 0) {
            const lastCandle = processedData[processedData.length - 1];
            setChartPrice(lastCandle.close);
          }
          
          // 타임스케일 피팅
          if (chartApiRef.current) {
            chartApiRef.current.timeScale().fitContent();
          }
        }
        
        // 모든 데이터 저장
        setAllData(processedData);
        setLastUpdated(new Date());
      }
    } catch (error) {
      console.error('데이터 로드 오류:', error);
    } finally {
      setIsLoading(false);
      setProgress(100);
      ongoingRequestRef.current = false;
    }
  }, [dateRange, symbol, chartType, showMA]);

  // 웹소켓 메시지 핸들러
  const handleSocketData = useCallback((data: string) => {
    if (!isRealtimeAPIEnabled) return;
    
    try {
      const parsedData = JSON.parse(data);
      if (parsedData && parsedData.type === 'ticker' && parsedData.code === symbol) {
        const price = parsedData.trade_price;
        setCurrentPrice(price);
      }
    } catch (error) {
      console.error('웹소켓 데이터 파싱 오류:', error);
    }
  }, [isRealtimeAPIEnabled, symbol]);

  // 주기적 업데이트 설정
  useEffect(() => {
    if (isAutoUpdate) {
      const updateInterval = 10000; // 10초
      
      const updateTimer = setInterval(() => {
        if (!ongoingRequestRef.current) {
          const now = new Date();
          setDateRange(prev => ({ ...prev, endDate: now }));
        }
      }, updateInterval);
      
      return () => clearInterval(updateTimer);
    }
  }, [isAutoUpdate]);

  // 데이터 로드 트리거
  useEffect(() => {
    // 중복 요청 방지를 위한 디바운싱
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    
    timeoutRef.current = setTimeout(() => {
      loadData();
    }, 300);
    
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [dateRange, loadData]);

  // 차트 초기화 콜백
  const handleChartReady = useCallback((
    chartApi: IChartApi,
    candleSeries: ISeriesApi<"Candlestick">,
    volumeSeries: ISeriesApi<"Histogram">,
    sixtyEMASeries: ISeriesApi<"Line">,
    oneTwentyEMASeries: ISeriesApi<"Line">,
    twoFortyEMASeries: ISeriesApi<"Line">,
    threeHundredSixtyEMASeries: ISeriesApi<"Line">
  ) => {
    chartApiRef.current = chartApi;
    candleSeriesRef.current = candleSeries;
    volumeSeriesRef.current = volumeSeries;
    sixtyEMASeriesRef.current = sixtyEMASeries;
    oneTwentyEMASeriesRef.current = oneTwentyEMASeries;
    twoFortyEMASeriesRef.current = twoFortyEMASeries;
    threeHundredSixtyEMASeriesRef.current = threeHundredSixtyEMASeries;
    
    // 볼륨 시리즈 설정
    chartApi.priceScale('volume').applyOptions({
      scaleMargins: {
        top: 0.8,
        bottom: 0,
      },
      borderVisible: false,
    });
    
    // 차트 준비 후 데이터 로드
    loadData();
  }, [loadData]);

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

  // 이동평균선 표시 설정 업데이트
  const updateShowMA = useCallback((newShowMA: MASettings) => {
    setShowMA(newShowMA);
    
    if (
      sixtyEMASeriesRef.current && 
      oneTwentyEMASeriesRef.current && 
      twoFortyEMASeriesRef.current && 
      threeHundredSixtyEMASeriesRef.current
    ) {
      sixtyEMASeriesRef.current.applyOptions({ visible: newShowMA.sixty });
      oneTwentyEMASeriesRef.current.applyOptions({ visible: newShowMA.oneTwenty });
      twoFortyEMASeriesRef.current.applyOptions({ visible: newShowMA.twoForty });
      threeHundredSixtyEMASeriesRef.current.applyOptions({ visible: newShowMA.threeHundredSixty });
    }
  }, []);

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

  return (
    <div className="w-full bg-gray-800 rounded-lg p-4 overflow-hidden">
      <div className="grid grid-cols-1 gap-4">
        {/* 가격 정보 및 컨트롤 섹션 */}
        <div className="flex flex-col md:flex-row gap-4">
          {/* 차트 컨트롤 */}
          <div className="w-full md:w-1/2">
            <ChartControls
              isAutoUpdate={isAutoUpdate}
              handleAutoUpdateToggle={() => setIsAutoUpdate(!isAutoUpdate)}
              isRealtimeAPIEnabled={isRealtimeAPIEnabled}
              handleRealtimeAPIToggle={() => setIsRealtimeAPIEnabled(!isRealtimeAPIEnabled)}
              dateRange={dateRange}
              handleDateRangeChange={(date) => setDateRange(prev => ({ ...prev, startDate: date }))}
              handleEndDateChange={(date) => setDateRange(prev => ({ ...prev, endDate: date }))}
              isLoading={isLoading}
              progress={progress}
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
            crossPoints={crossPoints}
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