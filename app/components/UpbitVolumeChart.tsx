'use client';

import { useEffect, useRef, useState } from 'react';
import axios from 'axios';

interface ChartProps {
  market: string;
  interval: string;
  count: number;
  height?: number;
}

// 간단한 차트 컴포넌트
const UpbitVolumeChart: React.FC<ChartProps> = ({ market, interval, count, height = 600 }) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [candleData, setCandleData] = useState<any[]>([]);
  const [retryCount, setRetryCount] = useState(0);
  const maxRetries = 3;
  
  // 캔들 데이터 가져오기
  const fetchData = async () => {
    try {
      setIsLoading(true);
      console.log(`캔들 데이터 요청: ${market}, ${interval}, ${count}`);
      
      const response = await axios.get(`https://api.upbit.com/v1/candles/${interval}?market=${market}&count=${count}`);
      
      if (!response.data || !Array.isArray(response.data) || response.data.length === 0) {
        console.error('빈 응답 또는 응답 형식 오류', response.data);
        throw new Error('캔들 데이터 형식이 올바르지 않습니다.');
      }
      
      // 데이터 형식 변환 및 역순 정렬 (최신 데이터가 마지막)
      const formattedData = response.data
        .map((candle: any) => ({
          time: new Date(candle.candle_date_time_kst).getTime(),
          open: candle.opening_price,
          high: candle.high_price,
          low: candle.low_price,
          close: candle.trade_price,
          volume: candle.candle_acc_trade_volume,
        }))
        .reverse();
      
      setCandleData(formattedData);
      setIsLoading(false);
      setError(null);
      setRetryCount(0);
    } catch (err) {
      console.error('데이터 로드 실패:', err);
      setError(err instanceof Error ? err.message : '데이터를 로드하는 중 오류가 발생했습니다.');
      setIsLoading(false);
      
      if (retryCount < maxRetries) {
        console.log(`재시도 ${retryCount + 1}/${maxRetries} 예정...`);
        setRetryCount(prev => prev + 1);
        setTimeout(fetchData, 5000);
      }
    }
  };
  
  // 마운트 시 데이터 가져오기
  useEffect(() => {
    fetchData();
    
    // 1분마다 데이터 업데이트
    const updateInterval = setInterval(fetchData, 60000);
    
    return () => {
      clearInterval(updateInterval);
    };
  }, [market, interval, count, retryCount]);
  
  // 마지막 5개 캔들만 표시 (테이블로)
  const lastCandles = candleData.slice(-7);
  
  return (
    <div className="w-full">
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center text-white z-10">
          <div className="bg-gray-800 bg-opacity-80 p-4 rounded-lg">
            데이터 로딩 중... {retryCount > 0 && `(재시도 ${retryCount}/${maxRetries})`}
          </div>
        </div>
      )}
      
      {error && (
        <div className="absolute inset-0 flex items-center justify-center text-red-500 z-10">
          <div className="bg-gray-800 bg-opacity-80 p-4 rounded-lg">
            <div>{error}</div>
            {retryCount < maxRetries && <div className="mt-2 text-white">5초 후 재시도합니다...</div>}
          </div>
        </div>
      )}
      
      {!isLoading && !error && (
        <div>
          <div className="mb-4 text-white">
            <h3 className="text-lg font-bold">{market} 최근 캔들 데이터</h3>
            <p className="text-sm">총 {candleData.length}개 데이터 중 최근 7개 표시</p>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-white border-collapse">
              <thead>
                <tr className="bg-gray-700">
                  <th className="p-2 text-left">시간</th>
                  <th className="p-2 text-right">시가</th>
                  <th className="p-2 text-right">고가</th>
                  <th className="p-2 text-right">저가</th>
                  <th className="p-2 text-right">종가</th>
                  <th className="p-2 text-right">거래량</th>
                  <th className="p-2 text-center">변화</th>
                </tr>
              </thead>
              <tbody>
                {lastCandles.map((candle, index) => {
                  const date = new Date(candle.time);
                  const formattedDate = `${date.getMonth()+1}/${date.getDate()} ${date.getHours()}:${date.getMinutes().toString().padStart(2, '0')}`;
                  const change = candle.close - candle.open;
                  const changePercent = (change / candle.open * 100).toFixed(2);
                  const isPositive = change >= 0;
                  
                  return (
                    <tr key={candle.time} className={index % 2 === 0 ? 'bg-gray-800' : 'bg-gray-900'}>
                      <td className="p-2 text-left">{formattedDate}</td>
                      <td className="p-2 text-right">{candle.open.toLocaleString()}</td>
                      <td className="p-2 text-right">{candle.high.toLocaleString()}</td>
                      <td className="p-2 text-right">{candle.low.toLocaleString()}</td>
                      <td className="p-2 text-right">{candle.close.toLocaleString()}</td>
                      <td className="p-2 text-right">{candle.volume.toFixed(3)}</td>
                      <td className={`p-2 text-center ${isPositive ? 'text-green-500' : 'text-red-500'}`}>
                        {isPositive ? '+' : ''}{change.toLocaleString()} ({isPositive ? '+' : ''}{changePercent}%)
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          
          <div className="mt-6 bg-gray-800 p-4 rounded text-white">
            <h3 className="text-lg font-bold mb-2">간단한 통계</h3>
            {candleData.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p>시작 가격: {candleData[0].open.toLocaleString()}</p>
                  <p>현재 가격: {candleData[candleData.length-1].close.toLocaleString()}</p>
                  <p>총 변화: {(candleData[candleData.length-1].close - candleData[0].open).toLocaleString()} 
                    ({((candleData[candleData.length-1].close - candleData[0].open) / candleData[0].open * 100).toFixed(2)}%)</p>
                </div>
                <div>
                  <p>최고가: {Math.max(...candleData.map(c => c.high)).toLocaleString()}</p>
                  <p>최저가: {Math.min(...candleData.map(c => c.low)).toLocaleString()}</p>
                  <p>평균 거래량: {(candleData.reduce((sum, c) => sum + c.volume, 0) / candleData.length).toFixed(3)}</p>
                </div>
              </div>
            )}
          </div>
          
          <div className="mt-4 text-gray-400 text-sm">
            <p>* 차트 라이브러리 로딩 문제로 인해 테이블 형식으로 데이터를 표시합니다.</p>
            <p>* 1분마다 자동으로 데이터가 갱신됩니다.</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default UpbitVolumeChart; 