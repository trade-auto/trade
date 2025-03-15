import React, { useState } from 'react';
import { BacktestResult  } from '../types/candlestick';
import { formatTime } from '../utils/chartHelpers';

interface BacktestResultsProps {
  backtestResult: BacktestResult | null;
}

const BacktestResults: React.FC<BacktestResultsProps> = ({ backtestResult }) => {
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  if (!backtestResult) {
    return null;
  }

  const totalPages = Math.ceil(backtestResult.trades.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentTrades = backtestResult.trades.slice(startIndex, endIndex);

  return (
    <div className="mt-4 space-y-4">
      <div className="text-white text-lg font-bold mb-4">백테스트 결과</div>
      <div className="grid grid-cols-6 gap-4">
        <div className="bg-gray-800 p-4 rounded-lg">
          <div className="text-gray-400 text-sm">총 거래 횟수</div>
          <div className="text-white text-lg font-bold">
            {backtestResult.totalTrades}회
          </div>
        </div>
        <div className="bg-gray-800 p-4 rounded-lg">
          <div className="text-gray-400 text-sm">성공 거래 횟수</div>
          <div className="text-white text-lg font-bold">
            {backtestResult.successfulTrades}회
          </div>
        </div>
        <div className="bg-gray-800 p-4 rounded-lg">
          <div className="text-gray-400 text-sm">성공률</div>
          <div className="text-white text-lg font-bold">
            {backtestResult.successRate.toFixed(2)}%
          </div>
        </div>
        <div className="bg-gray-800 p-4 rounded-lg">
          <div className="text-gray-400 text-sm">총 수익률</div>
          <div className={`text-lg font-bold ${
            backtestResult.totalReturn >= 0 ? 'text-green-500' : 'text-red-500'
          }`}>
            {(backtestResult.totalReturn * 100).toFixed(2)}%
          </div>
        </div>
        <div className="bg-gray-800 p-4 rounded-lg">
          <div className="text-gray-400 text-sm">총 순수익률</div>
          <div className={`text-lg font-bold ${
            backtestResult.totalNetReturn >= 0 ? 'text-green-500' : 'text-red-500'
          }`}>
            {(backtestResult.totalNetReturn * 100).toFixed(2)}%
          </div>
        </div>
        <div className="bg-gray-800 p-4 rounded-lg">
          <div className="text-gray-400 text-sm">평균 수익률</div>
          <div className={`text-lg font-bold ${
            backtestResult.averageReturn >= 0 ? 'text-green-500' : 'text-red-500'
          }`}>
            {(backtestResult.averageReturn * 100).toFixed(2)}%
          </div>
        </div>
      </div>

      {backtestResult.trades.length > 0 && (
        <div className="mt-4 bg-gray-800 p-4 rounded-lg">
          <div className="flex justify-between items-center mb-4">
            <div className="text-white text-lg font-bold">거래 내역</div>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                className={`px-3 py-1 rounded ${
                  currentPage === 1 
                    ? 'bg-gray-600 text-gray-400 cursor-not-allowed' 
                    : 'bg-blue-600 text-white hover:bg-blue-700'
                }`}
              >
                이전
              </button>
              <span className="text-white">
                {currentPage} / {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages}
                className={`px-3 py-1 rounded ${
                  currentPage === totalPages 
                    ? 'bg-gray-600 text-gray-400 cursor-not-allowed' 
                    : 'bg-blue-600 text-white hover:bg-blue-700'
                }`}
              >
                다음
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-white">
              <thead>
                <tr className="text-gray-400">
                  <th className="px-4 py-2">진입 시간</th>
                  <th className="px-4 py-2">청산 시간</th>
                  <th className="px-4 py-2">진입 가격</th>
                  <th className="px-4 py-2">청산 가격</th>
                  <th className="px-4 py-2">수익률</th>
                  <th className="px-4 py-2">매수 수수료</th>
                  <th className="px-4 py-2">매도 수수료</th>
                  <th className="px-4 py-2">순수익률</th>
                  <th className="px-4 py-2">100만원 투자시 수익</th>
                  <th className="px-4 py-2">100만원 투자시 순수익</th>
                </tr>
              </thead>
              <tbody>
                {currentTrades.map((trade, index) => {
                  const feeRate = 0.0005;
                  const buyFee = feeRate * 100;
                  const sellFee = feeRate * 100;
                  const netReturn = trade.return - (feeRate * 2);
                  const profitAmount = 1000000 * trade.return;
                  const netProfitAmount = 1000000 * netReturn;
                  
                  return (
                    <tr key={startIndex + index} className="border-t border-gray-700">
                      <td className="px-4 py-2">{formatTime(trade.entryTime)}</td>
                      <td className="px-4 py-2">{formatTime(trade.exitTime)}</td>
                      <td className="px-4 py-2">{trade.entryPrice.toLocaleString()}</td>
                      <td className="px-4 py-2">{trade.exitPrice.toLocaleString()}</td>
                      <td className={`px-4 py-2 ${trade.return >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                        {(trade.return * 100).toFixed(2)}%
                      </td>
                      <td className="px-4 py-2 text-red-500">{buyFee.toFixed(2)}%</td>
                      <td className="px-4 py-2 text-red-500">{sellFee.toFixed(2)}%</td>
                      <td className={`px-4 py-2 ${netReturn >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                        {(netReturn * 100).toFixed(2)}%
                      </td>
                      <td className={`px-4 py-2 ${trade.return >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                        {profitAmount.toLocaleString()}원
                      </td>
                      <td className={`px-4 py-2 ${netReturn >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                        {netProfitAmount.toLocaleString()}원
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default BacktestResults; 