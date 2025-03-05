import { useCallback, useEffect, useState, useRef } from 'react';
import {
  IChartApi,
  ISeriesApi,
  Time,
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
import { useUpbitStore } from '../store/useUpbitStore';
import TradingStrategyHover from './TradingStrategyHover';
import axios from 'axios';

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
  const [chartPrice, setChartPrice] = useState(0);
  const [progress, setProgress] = useState(0);
  const [allData, setAllData] = useState<ExtendedCandlestickData[]>([]);
  const [markers, setMarkers] = useState<SeriesMarker<Time>[]>([]);
  const [backtestResult, setBacktestResult] = useState<BacktestResult | null>(null);
  
  // 설정 상태
  const [dateRange, setDateRange] = useState<DateRange>(getInitialDateRange(chartType));
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

  const { tradeStrategy, updateTradeStrategy } = useUpbitStore();

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
      
    } catch (error) {
      console.error('데이터 로드 오류:', error);
    } finally {
      setProgress(100);
      ongoingRequestRef.current = false;
    }
  }, [dateRange, symbol, chartType, showMA]);

  

  // 주기적 업데이트 설정
  useEffect(() => {
      const updateInterval = 1000; // 10초
      
      const updateTimer = setInterval(() => {
        if (!ongoingRequestRef.current) {
          const now = new Date();
          setDateRange(prev => ({ ...prev, endDate: now }));
        }
      }, updateInterval);
      
      return () => clearInterval(updateTimer);
  }, []);

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
    if (csvLoading) {
      alert('이미 다운로드가 진행 중입니다');
      return;
    }
    
    try {
      setCsvLoading(true);
      setCsvProgress(0);
      
      const csvFromTime = csvDateRange.startDate.getTime();
      const csvToTime = (csvDateRange.endDate || new Date()).getTime();
      
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
        
     
        {/* 차트 컨테이너 */}
            {/* 벡테스트용 차트 컨테이너 */}
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
           {/* 벡테스트용 차트 컨테이너 */}
        {/* <div className="relative w-full">
          <ChartContainer
            isFullscreen={isFullscreen}
            chartHeight={chartHeight}
            toggleFullscreen={toggleFullscreen}
            symbol={symbol}
            markers={markers}
            chartType={chartType}
            onChartReady={handleChartReady}
          />
        </div> */}
      </div>

    </div>
  );
};

export { CandlestickChart }; 