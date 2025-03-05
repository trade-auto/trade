import { useCallback, useEffect, useState, useRef } from 'react';
import Websocket from 'react-websocket';
import {
  IChartApi,
  ISeriesApi,
  Time,
  BusinessDay,
  SeriesMarker
} from 'lightweight-charts';
import {
  DateRange,
  ExtendedCandlestickData,
  UpbitCandle,
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
  createTradeMarkers,
  calculateEMA,
  getChartEndpoint,
  calculateBacktestResult,
  formatDate,
} from '../utils/chartHelpers';
import { LineData } from 'lightweight-charts';
import { useUpbitStore } from '../store/useUpbitStore';
import TradingStrategyHover from './TradingStrategyHover';

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
  const [progress, setProgress] = useState(0);
  const [allData, setAllData] = useState<ExtendedCandlestickData[]>([]);
  const [markers, setMarkers] = useState<SeriesMarker<Time>[]>([]);
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
    threeHundred: true,
    nineHundred: true,
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
  const threeHundredEMASeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const nineHundredEMASeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  
  // 기타 상태
  const ongoingRequestRef = useRef<boolean>(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // 실시간 캔들 업데이트를 위한 ref
  const lastCandleRef = useRef<ExtendedCandlestickData | null>(null);

  const { tradeStrategy, updateTradeStrategy } = useUpbitStore();

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
    
    try {
      const endpoint = getChartEndpoint(chartType);
      const allProcessedData: ExtendedCandlestickData[] = [];
      let currentTo = dateRange.endDate ? dateRange.endDate : new Date();
      const startDate = dateRange.startDate;
      
      // 필요한 데이터 개수 계산
      const totalDays = Math.ceil((currentTo.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
      const estimatedCandles = chartType.startsWith('minutes/') ? totalDays * 24 * 60 / parseInt(chartType.split('/')[1]) :
                             chartType === 'days' ? totalDays :
                             chartType === 'weeks' ? Math.ceil(totalDays / 7) :
                             Math.ceil(totalDays / 30);
      
      const batchSize = 200;
      const expectedBatches = Math.ceil(estimatedCandles / batchSize);
      let currentBatch = 0;
      
      // 시작 날짜에 도달할 때까지 반복해서 데이터 가져오기
      while (true) {
        const to = currentTo.toISOString();
        
        // 진행률 업데이트
        currentBatch++;
        setProgress(Math.min(30, (currentBatch / expectedBatches) * 30));
        
        const response = await fetch(
          `https://api.upbit.com/v1/candles/${endpoint}?market=${symbol}&to=${to}&count=${batchSize}`
        );
        
        if (!response.ok) {
          throw new Error('데이터 로딩 실패');
        }
        
        const data: UpbitCandle[] = await response.json();
        
        if (!data || data.length === 0) break;
        
        // 데이터 처리
        const processedData = data.map((candle: UpbitCandle) => ({
          time: new Date(candle.candle_date_time_kst).getTime() / 1000 as Time,
          open: candle.opening_price,
          high: candle.high_price,
          low: candle.low_price,
          close: candle.trade_price,
          volume: candle.candle_acc_trade_volume,
        }));
        
        // 시작 날짜보다 이전 데이터는 필터링
        const filteredData = processedData.filter(
            candle => new Date((candle.time as number) * 1000) >= startDate
        );
        
        allProcessedData.push(...filteredData);
        
        // 마지막 캔들의 시간으로 다음 요청의 기준 시간 설정
        const lastCandle = data[data.length - 1];
        currentTo = new Date(lastCandle.candle_date_time_kst);
        
        // 시작 날짜에 도달했거나 지났으면 중단
        if (currentTo <= startDate) break;
        
        // API 호출 제한을 위한 딜레이
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      // 한 번만 정렬
      allProcessedData.sort((a, b) => {
        if (typeof a.time === 'number' && typeof b.time === 'number') {
          return a.time - b.time;
        }
        return 0;
      });
      
      setProgress(50);
      
      // 차트 업데이트를 위한 데이터 준비
      if (candleSeriesRef.current && volumeSeriesRef.current) {
        // 캔들 데이터 설정
        candleSeriesRef.current.setData(allProcessedData);
        
        // 볼륨 데이터 설정
        const volumeData = allProcessedData.map((d) => ({
          time: d.time,
          value: d.volume,
          color: d.close >= d.open ? '#26a69a' : '#ef5350',
        }));
        volumeSeriesRef.current.setData(volumeData);
        
        setProgress(70);
        
        // EMA 계산 및 설정 - 병렬 처리
        const [ema60Data, ema120Data, ema240Data, ema360Data, ema300Data, ema900Data] = await Promise.all([
          Promise.resolve(calculateEMA(allProcessedData, 60)),
          Promise.resolve(calculateEMA(allProcessedData, 120)),
          Promise.resolve(calculateEMA(allProcessedData, 240)),
          Promise.resolve(calculateEMA(allProcessedData, 360)),
          Promise.resolve(calculateEMA(allProcessedData, 300)),
          Promise.resolve(calculateEMA(allProcessedData, 900))
        ]);
        
        if (
          sixtyEMASeriesRef.current && 
          oneTwentyEMASeriesRef.current && 
          twoFortyEMASeriesRef.current && 
          threeHundredSixtyEMASeriesRef.current &&
          threeHundredEMASeriesRef.current &&
          nineHundredEMASeriesRef.current
        ) {
          // EMA 데이터 설정
          sixtyEMASeriesRef.current.setData(ema60Data);
          oneTwentyEMASeriesRef.current.setData(ema120Data);
          twoFortyEMASeriesRef.current.setData(ema240Data);
          threeHundredSixtyEMASeriesRef.current.setData(ema360Data);
          threeHundredEMASeriesRef.current.setData(ema300Data);
          nineHundredEMASeriesRef.current.setData(ema900Data);
          
          // 시리즈 가시성 설정
          sixtyEMASeriesRef.current.applyOptions({ visible: showMA.sixty });
          oneTwentyEMASeriesRef.current.applyOptions({ visible: showMA.oneTwenty });
          twoFortyEMASeriesRef.current.applyOptions({ visible: showMA.twoForty });
          threeHundredSixtyEMASeriesRef.current.applyOptions({ visible: showMA.threeHundredSixty });
          threeHundredEMASeriesRef.current.applyOptions({ visible: showMA.threeHundred });
          nineHundredEMASeriesRef.current.applyOptions({ visible: showMA.nineHundred });
        }
        
        setProgress(85);
            // 매매 신호 분석 및 마커 생성
        const signals = useUpbitStore.getState().analyzeStrategy(allProcessedData);
        const markers = createTradeMarkers(signals);  
        // 매수/매도 포인트 계산
        setMarkers(markers);
        
        // 백테스트 결과 계산
        const backtestResult = calculateBacktestResult(allProcessedData, signals, 'test');
        setBacktestResult(backtestResult);
        
        // 현재 가격 설정
        if (allProcessedData.length > 0) {
          const lastCandle = allProcessedData[allProcessedData.length - 1];
          setChartPrice(lastCandle.close);
        }
        
        // 타임스케일 피팅
        if (chartApiRef.current) {
          chartApiRef.current.timeScale().fitContent();
        }
      }
      
      // 모든 데이터 저장
      setAllData(allProcessedData);
      setLastUpdated(new Date());
      
    } catch (error) {
      console.error('데이터 로드 오류:', error);
    } finally {
      setProgress(100);
      ongoingRequestRef.current = false;
    }
  }, [dateRange, symbol, chartType, showMA]);

  // 웹소켓 메시지 핸들러 개선
  const handleSocketData = useCallback((data: string) => {
    if (!isRealtimeAPIEnabled || !candleSeriesRef.current || !volumeSeriesRef.current) return;
    
    try {
      const parsedData = JSON.parse(data);
      if (parsedData && parsedData.type === 'trade' && parsedData.code === symbol) {
        const price = parsedData.trade_price;
        const volume = parsedData.trade_volume;
        const timestamp = Math.floor(new Date(parsedData.trade_time).getTime() / 1000) as Time;
        
        setCurrentPrice(price);
        
        // 마지막 캔들 업데이트 또는 새 캔들 생성
        if (lastCandleRef.current && lastCandleRef.current.time === timestamp) {
          // 기존 캔들 업데이트
          const updatedCandle = {
            ...lastCandleRef.current,
            high: Math.max(lastCandleRef.current.high, price),
            low: Math.min(lastCandleRef.current.low, price),
            close: price,
            volume: lastCandleRef.current.volume + volume
          };
          
          lastCandleRef.current = updatedCandle;
          
          // 차트 시리즈 업데이트
          candleSeriesRef.current.update(updatedCandle);
          volumeSeriesRef.current.update({
            time: timestamp,
            value: updatedCandle.volume,
            color: updatedCandle.close >= updatedCandle.open ? '#26a69a' : '#ef5350'
          });
        } else {
          // 새 캔들 생성
          const newCandle: ExtendedCandlestickData = {
            time: timestamp,
            open: price,
            high: price,
            low: price,
            close: price,
            volume: volume
          };
          
          // 이전 캔들이 있으면 EMA 업데이트
          if (lastCandleRef.current && 
              sixtyEMASeriesRef.current && 
              oneTwentyEMASeriesRef.current && 
              twoFortyEMASeriesRef.current && 
              threeHundredSixtyEMASeriesRef.current) {
            
            // EMA 업데이트 로직
            const updateEMA = (prevEMA: number, price: number, period: number) => {
              const multiplier = 2 / (period + 1);
              return price * multiplier + prevEMA * (1 - multiplier);
            };
            
            // 각 EMA 업데이트
            const emaData: LineData<Time> = {
              time: timestamp,
              value: 0
            };
            
            if (sixtyEMASeriesRef.current.data().length > 0) {
              const lastData = sixtyEMASeriesRef.current.data()[sixtyEMASeriesRef.current.data().length - 1] as LineData<Time>;
              emaData.value = updateEMA(lastData.value, price, 60);
              sixtyEMASeriesRef.current.update(emaData);
            }
            
            // 다른 EMA 시리즈도 동일하게 업데이트
            // ... 생략 ...
          }
          
          lastCandleRef.current = newCandle;
          
          // 차트에 새 캔들 추가
          candleSeriesRef.current.update(newCandle);
          volumeSeriesRef.current.update({
            time: timestamp,
            value: volume,
            color: price >= newCandle.open ? '#26a69a' : '#ef5350'
          });
        }
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
              isAutoUpdate={isAutoUpdate}
              handleAutoUpdateToggle={() => setIsAutoUpdate(!isAutoUpdate)}
              isRealtimeAPIEnabled={isRealtimeAPIEnabled}
              handleRealtimeAPIToggle={() => setIsRealtimeAPIEnabled(!isRealtimeAPIEnabled)}
              dateRange={dateRange}
              handleDateRangeChange={(date) => setDateRange(prev => ({ ...prev, startDate: date }))}
              handleEndDateChange={(date) => setDateRange(prev => ({ ...prev, endDate: date }))}
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
            markers={markers}
            chartType={chartType}
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
            allData={allData as unknown as UpbitCandle[]}
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