import React, { useEffect, useState } from 'react';
import { useUpbitWebSocket } from '../hooks/useUpbitWebSocket';

interface ChartPriceProps {
  chartPrice: number | null;
  market: string;
}

const ChartPrice: React.FC<ChartPriceProps> = ({
  chartPrice,
  market
}) => {
  const { currentPrice, lastUpdated, isConnected } = useUpbitWebSocket(market);
  const [loading, setLoading] = useState<boolean>(true);
  const [loadingDots, setLoadingDots] = useState<string>('');
  const [loadingTime, setLoadingTime] = useState<number>(0);
  const [loadError, setLoadError] = useState<boolean>(false);
  const [fallbackPrice, setFallbackPrice] = useState<number | null>(null);

  // 로딩 애니메이션과 로딩 시간 추적
  useEffect(() => {
    let interval: NodeJS.Timeout;
    let timeInterval: NodeJS.Timeout;
    
    if (chartPrice === null && fallbackPrice === null) {
      // 로딩 상태 초기화
      setLoading(true);
      setLoadError(false);
      setLoadingTime(0);
      
      // 로딩 애니메이션
      interval = setInterval(() => {
        setLoadingDots(prev => prev.length >= 3 ? '' : prev + '.');
      }, 500);
      
      // 로딩 시간 추적
      timeInterval = setInterval(() => {
        setLoadingTime(prev => {
          // 5초 이상 로딩되면 업비트 API에서 직접 가져오기
          if (prev >= 5 && !loadError) {
            fetchDirectPrice();
          }
          
          // 15초 이상 로딩되면 오류로 간주
          if (prev >= 15) {
            setLoadError(true);
            clearInterval(timeInterval);
            return prev;
          }
          return prev + 1;
        });
      }, 1000);
      
      return () => {
        clearInterval(interval);
        clearInterval(timeInterval);
      };
    } else {
      setLoading(false);
      setLoadError(false);
    }
  }, [chartPrice, market, fallbackPrice]);

  // 업비트 API에서 직접 가격 데이터를 가져오는 함수
  const fetchDirectPrice = async () => {
    try {
      console.log(`차트 시세를 직접 가져오는 중: ${market}`);
      const response = await fetch(`https://api.upbit.com/v1/ticker?markets=${market}`);
      if (response.ok) {
        const data = await response.json();
        if (data && data.length > 0) {
          const price = data[0].trade_price;
          console.log(`${market} 시세 가져오기 성공: ${price.toLocaleString()} KRW`);
          setFallbackPrice(price);
          setLoading(false);
        }
      } else {
        console.error('업비트 API 응답 오류:', response.status);
      }
    } catch (error) {
      console.error('업비트 API 호출 오류:', error);
    }
  };

  // 데이터 새로고침 함수 (페이지 새로고침 대신 데이터만 다시 로드)
  const handleRefresh = () => {
    // 상태 리셋
    setLoading(true);
    setLoadError(false);
    setLoadingTime(0);
    setFallbackPrice(null);
    
    // 데이터 다시 가져오기
    fetchDirectPrice();
  };

  // 시세 차이 계산
  const effectiveChartPrice = chartPrice || fallbackPrice;
  const priceDiff = currentPrice > 0 && effectiveChartPrice !== null && effectiveChartPrice > 0 
    ? currentPrice - effectiveChartPrice 
    : 0;
  const priceDiffPercentage = currentPrice > 0 && effectiveChartPrice !== null && effectiveChartPrice > 0
    ? (priceDiff / effectiveChartPrice) * 100
    : 0;

  // 현재 코인 심볼에서 실제 코인명 추출 (KRW-BTC -> BTC)
  const coinSymbol = market.split('-')[1] || market;

  return (
    <div className="grid grid-cols-4 gap-4 mb-4">
      <div className="bg-gray-800 p-4 rounded-lg">
        <div className="text-gray-400 text-sm">
          Upbit WebSocket 시세
          <span className={`ml-2 inline-block w-2 h-2 rounded-full ${
            isConnected ? 'bg-green-500' : 'bg-red-500'
          }`} title={isConnected ? '연결됨' : '연결 끊김'}></span>
        </div>
        <div className="text-white text-lg font-bold">
          {currentPrice.toLocaleString()} KRW
        </div>
        <div className="text-gray-400 text-xs">
          마지막 업데이트: {lastUpdated ? lastUpdated.toLocaleString('ko-KR') : '없음'}
        </div>
      </div>
      <div className="bg-gray-800 p-4 rounded-lg">
        <div className="text-gray-400 text-sm">차트 시세 ({coinSymbol})</div>
        <div className="text-white text-lg font-bold">
          {effectiveChartPrice !== null ? (
            <>{effectiveChartPrice.toLocaleString()} KRW</>
          ) : (
            <>
              {loadError ? (
                <span className="text-red-400">
                  로드 실패
                  <button 
                    onClick={handleRefresh}
                    className="ml-2 px-2 py-1 bg-blue-600 hover:bg-blue-700 transition-colors rounded text-xs text-white"
                  >
                    데이터 다시 가져오기
                  </button>
                </span>
              ) : (
                <span className="text-blue-400">
                  로딩 중{loadingDots}
                  <span className="text-gray-400 text-xs block mt-1">
                    {coinSymbol} 데이터 가져오는 중 ({loadingTime}초)
                  </span>
                </span>
              )}
            </>
          )}
        </div>
      </div>
      <div className="bg-gray-800 p-4 rounded-lg">
        <div className="text-gray-400 text-sm">시세 차이</div>
        <div className={`text-lg font-bold ${!loading ? (priceDiff >= 0 ? 'text-green-500' : 'text-red-500') : 'text-gray-400'}`}>
          {!loading ? priceDiff.toLocaleString() : '대기 중'} {!loading ? 'KRW' : ''}
        </div>
      </div>
      <div className="bg-gray-800 p-4 rounded-lg">
        <div className="text-gray-400 text-sm">시세 차이 (%)</div>
        <div className={`text-lg font-bold ${!loading ? (priceDiff >= 0 ? 'text-green-500' : 'text-red-500') : 'text-gray-400'}`}>
          {!loading ? priceDiffPercentage.toFixed(4) : '대기 중'}{!loading ? '%' : ''}
        </div>
      </div>
    </div>
  );
};

export default ChartPrice; 