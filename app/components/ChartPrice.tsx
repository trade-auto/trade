import React from 'react';

interface ChartPriceProps {
  currentPrice: number;
  chartPrice: number;
  lastUpdated: Date | null;
}

const ChartPrice: React.FC<ChartPriceProps> = ({
  currentPrice,
  chartPrice,
  lastUpdated
}) => {
  // 시세 차이 계산
  const priceDiff = currentPrice > 0 && chartPrice > 0 
    ? currentPrice - chartPrice 
    : 0;
  const priceDiffPercentage = currentPrice > 0 && chartPrice > 0
    ? (priceDiff / chartPrice) * 100
    : 0;

  return (
    <div className="bg-gray-700 rounded-lg p-4">
      <div className="text-white text-lg font-bold mb-2">가격 정보</div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-gray-800 p-3 rounded-lg">
          <div className="text-gray-400 text-sm">현재 가격 (업비트 웹소켓)</div>
          <div className="text-white text-lg font-bold">{currentPrice.toLocaleString()} KRW</div>
        </div>
        <div className="bg-gray-800 p-3 rounded-lg">
          <div className="text-gray-400 text-sm">차트 가격</div>
          <div className="text-white text-lg font-bold">{chartPrice.toLocaleString()} KRW</div>
        </div>
        <div className="bg-gray-800 p-3 rounded-lg">
          <div className="text-gray-400 text-sm">가격 차이</div>
          <div className={`text-lg font-bold ${priceDiff > 0 ? 'text-green-500' : priceDiff < 0 ? 'text-red-500' : 'text-white'}`}>
            {priceDiff > 0 ? '+' : ''}{priceDiff.toLocaleString()} KRW
          </div>
        </div>
        <div className="bg-gray-800 p-3 rounded-lg">
          <div className="text-gray-400 text-sm">가격 차이 %</div>
          <div className={`text-lg font-bold ${priceDiffPercentage > 0 ? 'text-green-500' : priceDiffPercentage < 0 ? 'text-red-500' : 'text-white'}`}>
            {priceDiffPercentage > 0 ? '+' : ''}{priceDiffPercentage.toFixed(2)}%
          </div>
        </div>
      </div>
      <div className="mt-2 text-right text-gray-400 text-xs">
        마지막 업데이트: {lastUpdated ? lastUpdated.toLocaleString('ko-KR') : '없음'}
      </div>
    </div>
  );
};

export default ChartPrice; 