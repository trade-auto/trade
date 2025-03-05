import React from 'react';
import { useUpbitWebSocket } from '../hooks/useUpbitWebSocket';

interface ChartPriceProps {
  chartPrice: number;
  market: string;
}

const ChartPrice: React.FC<ChartPriceProps> = ({
  chartPrice,
  market
}) => {
  const { currentPrice, lastUpdated } = useUpbitWebSocket(market);

  // 시세 차이 계산
  const priceDiff = currentPrice > 0 && chartPrice > 0 
    ? currentPrice - chartPrice 
    : 0;
  const priceDiffPercentage = currentPrice > 0 && chartPrice > 0
    ? (priceDiff / chartPrice) * 100
    : 0;

  return (
    <div className="grid grid-cols-4 gap-4 mb-4">
      <div className="bg-gray-800 p-4 rounded-lg">
        <div className="text-gray-400 text-sm">Upbit WebSocket 시세</div>
        <div className="text-white text-lg font-bold">
          {currentPrice.toLocaleString()} KRW
        </div>
        <div className="text-gray-400 text-xs">
          마지막 업데이트: {lastUpdated ? lastUpdated.toLocaleString('ko-KR') : '없음'}
        </div>
      </div>
      <div className="bg-gray-800 p-4 rounded-lg">
        <div className="text-gray-400 text-sm">차트 시세</div>
        <div className="text-white text-lg font-bold">
          {chartPrice.toLocaleString()} KRW
        </div>
      </div>
      <div className="bg-gray-800 p-4 rounded-lg">
        <div className="text-gray-400 text-sm">시세 차이</div>
        <div className={`text-lg font-bold ${priceDiff >= 0 ? 'text-green-500' : 'text-red-500'}`}>
          {priceDiff.toLocaleString()} KRW
        </div>
      </div>
      <div className="bg-gray-800 p-4 rounded-lg">
        <div className="text-gray-400 text-sm">시세 차이 (%)</div>
        <div className={`text-lg font-bold ${priceDiff >= 0 ? 'text-green-500' : 'text-red-500'}`}>
          {priceDiffPercentage.toFixed(4)}%
        </div>
      </div>
    </div>
  );
};

export default ChartPrice; 