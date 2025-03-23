'use client';

import { useEffect, useRef, useState } from 'react';
import axios from 'axios';

interface ChartProps {
  market: string;
  interval: string;
  count: number;
  height?: number;
}

interface CandleData {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  buyVolume?: number;  // 매수량 (추정)
  sellVolume?: number; // 매도량 (추정)
}

// 간단한 차트 컴포넌트
const UpbitVolumeChart: React.FC<ChartProps> = ({ market, interval, count, height = 600 }) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [candleData, setCandleData] = useState<CandleData[]>([]);
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
      
      console.log(`캔들 데이터 응답: ${response.data.length}개 데이터 수신`);
      
      // 데이터 형식 변환 및 역순 정렬 (최신 데이터가 마지막)
      const formattedData = response.data
        .map((candle: any) => {
          // 매수/매도 거래량 추정 (상승 캔들은 매수가 많음, 하락 캔들은 매도가 많음)
          const isUp = candle.trade_price >= candle.opening_price;
          const volume = candle.candle_acc_trade_volume;
          
          // 상승 캔들: 60% 매수, 40% 매도 / 하락 캔들: 40% 매수, 60% 매도 (추정)
          const buyRatio = isUp ? 0.6 : 0.4;
          const sellRatio = isUp ? 0.4 : 0.6;
          
          const buyVolume = volume * buyRatio;
          const sellVolume = volume * sellRatio;
          
          return {
            time: new Date(candle.candle_date_time_kst).getTime(),
            open: candle.opening_price,
            high: candle.high_price,
            low: candle.low_price,
            close: candle.trade_price,
            volume: candle.candle_acc_trade_volume,
            buyVolume,
            sellVolume
          };
        })
        .reverse();
      
      console.log(`데이터 처리 완료: ${formattedData.length}개 데이터 가공됨`);
      console.log(`첫번째 캔들: `, formattedData[0]);
      console.log(`마지막 캔들: `, formattedData[formattedData.length - 1]);
      
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
                  <th className="p-2 text-right">매수량</th>
                  <th className="p-2 text-right">매도량</th>
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
                      <td className="p-2 text-right text-green-500">{candle.buyVolume?.toFixed(3)}</td>
                      <td className="p-2 text-right text-red-500">{candle.sellVolume?.toFixed(3)}</td>
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
                  <p>총 거래량: {candleData.reduce((sum, c) => sum + c.volume, 0).toFixed(3)}</p>
                  <p>매수/매도 비율: {(candleData.reduce((sum, c) => sum + (c.buyVolume || 0), 0) / candleData.reduce((sum, c) => sum + (c.sellVolume || 0), 0)).toFixed(2)}</p>
                </div>
              </div>
            )}
          </div>
          
          <div className="mt-6 bg-gray-800 p-4 rounded text-white">
            <h3 className="text-lg font-bold mb-2">캔들별 매수/매도 거래량 분석</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-white border-collapse">
                <thead>
                  <tr className="bg-gray-700">
                    <th className="p-2 text-left">시간</th>
                    <th className="p-2 text-right">매수량</th>
                    <th className="p-2 text-right">매도량</th>
                    <th className="p-2 text-right">차이(매수-매도)</th>
                    <th className="p-2 text-right">비율(매수/매도)</th>
                    <th className="p-2 text-center">시각화</th>
                  </tr>
                </thead>
                <tbody>
                  {lastCandles.map((candle, index) => {
                    const date = new Date(candle.time);
                    const formattedDate = `${date.getMonth()+1}/${date.getDate()} ${date.getHours()}:${date.getMinutes().toString().padStart(2, '0')}`;
                    const buyVolume = candle.buyVolume || 0;
                    const sellVolume = candle.sellVolume || 0;
                    const volumeDiff = buyVolume - sellVolume;
                    const volumeRatio = sellVolume !== 0 ? buyVolume / sellVolume : 0;
                    const isPositive = volumeDiff >= 0;
                    
                    // 차이를 시각화하기 위한 바 너비 계산 (최대 100%)
                    const maxDiff = Math.max(...lastCandles.map(c => Math.abs((c.buyVolume || 0) - (c.sellVolume || 0))));
                    const barWidth = maxDiff ? Math.abs(volumeDiff) / maxDiff * 100 : 0;
                    
                    return (
                      <tr key={candle.time} className={index % 2 === 0 ? 'bg-gray-800' : 'bg-gray-900'}>
                        <td className="p-2 text-left">{formattedDate}</td>
                        <td className="p-2 text-right text-green-500">{buyVolume.toFixed(3)}</td>
                        <td className="p-2 text-right text-red-500">{sellVolume.toFixed(3)}</td>
                        <td className={`p-2 text-right ${isPositive ? 'text-green-500' : 'text-red-500'}`}>
                          {isPositive ? '+' : ''}{volumeDiff.toFixed(3)}
                        </td>
                        <td className="p-2 text-right">{volumeRatio.toFixed(2)}</td>
                        <td className="p-2">
                          <div className="flex items-center justify-center h-4">
                            {isPositive ? (
                              <div 
                                className="bg-green-500 h-full rounded-sm" 
                                style={{ width: `${barWidth}%` }}
                                title={`매수우세: ${volumeDiff.toFixed(3)}`}
                              />
                            ) : (
                              <div 
                                className="bg-red-500 h-full rounded-sm" 
                                style={{ width: `${barWidth}%` }}
                                title={`매도우세: ${Math.abs(volumeDiff).toFixed(3)}`}
                              />
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
          
          <div className="mt-6 bg-gray-800 p-4 rounded text-white">
            <h3 className="text-lg font-bold mb-2">매수-매도 거래량 차이 차트</h3>
            <p className="mb-4 text-sm">※ 양수(초록색)는 매수 우세, 음수(빨간색)는 매도 우세를 나타냅니다.</p>
            <div className="h-48 flex items-center justify-center gap-2 mt-4">
              {lastCandles.map((candle, index) => {
                const buyVolume = candle.buyVolume || 0;
                const sellVolume = candle.sellVolume || 0;
                const volumeDiff = buyVolume - sellVolume;
                const isPositive = volumeDiff >= 0;
                
                // 최대 차이를 기준으로 높이 계산
                const maxDiff = Math.max(...lastCandles.map(c => Math.abs((c.buyVolume || 0) - (c.sellVolume || 0))));
                const heightPercent = maxDiff ? Math.abs(volumeDiff) / maxDiff * 80 : 0; // 최대 80%의 높이
                
                const date = new Date(candle.time);
                const formattedTime = `${date.getHours()}:${String(date.getMinutes()).padStart(2, '0')}`;
                
                return (
                  <div key={index} className="flex flex-col items-center" style={{ width: `${90 / lastCandles.length}%` }}>
                    <div className="w-full flex items-center justify-center h-full">
                      {isPositive ? (
                        <>
                          <div className="h-px w-full bg-gray-600 absolute"></div>
                          <div 
                            className="w-full bg-green-500 opacity-80 rounded-t" 
                            style={{ height: `${heightPercent}%` }}
                            title={`매수우세: ${volumeDiff.toFixed(3)}`}
                          ></div>
                        </>
                      ) : (
                        <>
                          <div className="h-px w-full bg-gray-600 absolute"></div>
                          <div 
                            className="w-full bg-red-500 opacity-80 rounded-b" 
                            style={{ height: `${heightPercent}%`, marginTop: 'auto' }}
                            title={`매도우세: ${Math.abs(volumeDiff).toFixed(3)}`}
                          ></div>
                        </>
                      )}
                    </div>
                    <div className="text-xs mt-2 text-center">
                      {formattedTime}
                      <div className="text-xs">
                        {volumeDiff > 0 ? 
                          <span className="text-green-500">↑ {volumeDiff.toFixed(1)}</span> : 
                          <span className="text-red-500">↓ {Math.abs(volumeDiff).toFixed(1)}</span>}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          
          <div className="mt-6 bg-gray-800 p-4 rounded text-white">
            <h3 className="text-lg font-bold mb-2">거래량 분석</h3>
            <p className="mb-2 text-sm">※ 매수/매도 거래량은 캔들 방향에 따라 추정한 값입니다.</p>
            <div className="h-64 flex items-end justify-center gap-2 mt-4">
              {lastCandles.map((candle, index) => {
                const buyHeight = (candle.buyVolume || 0) / Math.max(...lastCandles.map(c => c.volume)) * 100;
                const sellHeight = (candle.sellVolume || 0) / Math.max(...lastCandles.map(c => c.volume)) * 100;
                const date = new Date(candle.time);
                const formattedTime = `${date.getHours()}:${String(date.getMinutes()).padStart(2, '0')}`;
                
                return (
                  <div key={index} className="flex flex-col items-center" style={{ width: `${90 / lastCandles.length}%` }}>
                    <div className="w-full flex flex-col-reverse items-center">
                      <div 
                        className="w-full bg-green-500 opacity-80 rounded-t" 
                        style={{ height: `${buyHeight}%` }}
                        title={`매수량: ${candle.buyVolume?.toFixed(3)}`}
                      ></div>
                      <div 
                        className="w-full bg-red-500 opacity-80 rounded-t" 
                        style={{ height: `${sellHeight}%` }}
                        title={`매도량: ${candle.sellVolume?.toFixed(3)}`}
                      ></div>
                    </div>
                    <div className="text-xs mt-1 text-center">
                      {formattedTime}
                      <div className="text-xs">
                        {candle.close > candle.open ? 
                          <span className="text-green-500">↑</span> : 
                          <span className="text-red-500">↓</span>}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="flex justify-center gap-6 mt-4">
              <div className="flex items-center">
                <div className="w-4 h-4 bg-green-500 mr-2 rounded"></div>
                <span className="text-sm">매수량</span>
              </div>
              <div className="flex items-center">
                <div className="w-4 h-4 bg-red-500 mr-2 rounded"></div>
                <span className="text-sm">매도량</span>
              </div>
            </div>
            
            <div className="mt-6">
              <h4 className="text-md font-semibold mb-2">매수/매도 비율</h4>
              <div className="relative h-8 bg-gray-700 rounded overflow-hidden">
                {candleData.length > 0 && (
                  <>
                    <div 
                      className="absolute h-full bg-green-500"
                      style={{ 
                        width: `${(candleData.reduce((sum, c) => sum + (c.buyVolume || 0), 0) / 
                                candleData.reduce((sum, c) => sum + c.volume, 0)) * 100}%` 
                      }}
                    ></div>
                    <div className="absolute inset-0 flex items-center justify-center text-white text-sm">
                      매수 {((candleData.reduce((sum, c) => sum + (c.buyVolume || 0), 0) / 
                            candleData.reduce((sum, c) => sum + c.volume, 0)) * 100).toFixed(1)}% / 
                      매도 {((candleData.reduce((sum, c) => sum + (c.sellVolume || 0), 0) / 
                            candleData.reduce((sum, c) => sum + c.volume, 0)) * 100).toFixed(1)}%
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
          
          <div className="mt-4 text-gray-400 text-sm">
            <p>* 차트 라이브러리 로딩 문제로 인해 테이블 형식으로 데이터를 표시합니다.</p>
            <p>* 1분마다 자동으로 데이터가 갱신됩니다.</p>
            <p>* 매수/매도 거래량은 캔들 방향에 따라 추정한 값으로, 실제와 차이가 있을 수 있습니다.</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default UpbitVolumeChart; 