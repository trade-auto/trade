'use client';

import React, { useState, useEffect } from 'react';

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
  onOrder?: (price: number, isMarketOrder: boolean) => void;
}

export function CandlestickChart(props: CandlestickChartProps) {
  const { symbol, chartType } = props;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentPrice, setCurrentPrice] = useState<number | null>(null);
  
  useEffect(() => {
    let isMounted = true;
    const controller = new AbortController();
    
    const fetchCurrentPrice = async () => {
      setLoading(true);
      setError(null);
      
      try {
        const timeoutId = setTimeout(() => controller.abort(), 5000);
        
        const response = await fetch(`https://api.upbit.com/v1/ticker?markets=${symbol}`, {
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        if (!response.ok) {
          throw new Error(`상태 코드: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (isMounted) {
          if (data && data.length > 0) {
            setCurrentPrice(data[0].trade_price);
          }
          setLoading(false);
        }
      } catch (err: any) {
        if (isMounted) {
          console.error('가격 데이터 로드 중 오류:', err);
          setError(err.name === 'AbortError' ? '요청 시간 초과' : (err.message || '가격 데이터를 불러올 수 없습니다'));
          setLoading(false);
        }
      }
    };
    
    fetchCurrentPrice();
    
    return () => {
      isMounted = false;
      controller.abort();
    };
  }, [symbol]);
  
  return (
    <div className="p-4 bg-gray-800 rounded-lg">
      <div className="text-white text-lg mb-4">
        <h2>차트 임시 대체 구현</h2>
        <p>심볼: {symbol}</p>
        <p>차트 유형: {chartType}</p>
        {loading && <p className="text-blue-400">데이터 로드 중...</p>}
        {error && <p className="text-red-400">오류: {error}</p>}
        {currentPrice && <p className="text-green-400">현재 가격: {currentPrice.toLocaleString()}원</p>}
      </div>
      <p className="text-gray-400 text-sm">
        CandlestickChart 컴포넌트를 간소화된 버전으로 교체했습니다. 
        Promise 타임아웃 오류를 해결하기 위한 임시 조치입니다.
      </p>
    </div>
  );
}
