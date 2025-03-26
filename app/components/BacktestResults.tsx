import React, { useState, useEffect } from 'react';
import { BacktestResult } from '../types/candlestick';
import { Time } from 'lightweight-charts';
import { formatTime } from '../utils/chartHelpers';
import useUpbitStore from '../store/useUpbitStore';

interface BacktestResultsProps {
  backtestResult: BacktestResult | null;
}

// 정확한 시간 변환 함수
const formatTradeTime = (time: Time | null): string => {
  if (!time) return '-';
  
  try {
    // 숫자형 타임스탬프인 경우
    if (typeof time === 'number') {
      // Unix 타임스탬프가 초 단위인지 밀리초 단위인지 확인
      const timestamp = time.toString().length > 10 ? time : time * 1000;
      return new Date(timestamp).toLocaleString('ko-KR');
    } 
    // 문자열인 경우 (ISO 형식)
    else if (typeof time === 'string') {
      return new Date(time).toLocaleString('ko-KR');
    } 
    // BusinessDay 객체인 경우
    else if (typeof time === 'object') {
      return time.toString();
    }
    return String(time);
  } catch (e) {
    console.error('시간 변환 오류:', e);
    return String(time);
  }
};

const BacktestResults: React.FC<BacktestResultsProps> = ({ backtestResult }) => {
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const [sortedTrades, setSortedTrades] = useState<BacktestResult['trades']>([]);
  const chartTimeRange = useUpbitStore(state => state.chartTimeRange);

  useEffect(() => {
    if (backtestResult?.trades) {
      // 거래를 시간 순으로 정렬
      const sorted = [...backtestResult.trades].sort((a, b) => {
        const timeA = typeof a.entryTime === 'number' ? a.entryTime : 
                     typeof a.entryTime === 'string' ? new Date(a.entryTime).getTime() / 1000 : 0;
        const timeB = typeof b.entryTime === 'number' ? b.entryTime : 
                     typeof b.entryTime === 'string' ? new Date(b.entryTime).getTime() / 1000 : 0;
        return timeA - timeB;
      });

      // 차트의 시간 범위에 맞는 거래만 필터링
      if (chartTimeRange) {
        const filteredByTime = sorted.filter(trade => {
          const tradeTime = typeof trade.entryTime === 'number' ? trade.entryTime : 
                         typeof trade.entryTime === 'string' ? new Date(trade.entryTime).getTime() / 1000 : 0;
          return tradeTime >= Number(chartTimeRange.from) && tradeTime <= Number(chartTimeRange.to);
        });
        
        console.log(`차트 시간 범위에 맞는 거래: ${filteredByTime.length}개`);
        setSortedTrades(filteredByTime.length > 0 ? filteredByTime : sorted);
      } else {
        setSortedTrades(sorted);
      }
    }
  }, [backtestResult, chartTimeRange]);

  if (!backtestResult) {
    return null;
  }

  // 필터링된 거래 기준으로 통계 계산
  const filteredBacktestResult = {
    ...backtestResult,
    totalTrades: sortedTrades.length,
    successfulTrades: sortedTrades.filter(trade => trade.return > 0).length,
    successRate: sortedTrades.length > 0 
      ? (sortedTrades.filter(trade => trade.return > 0).length / sortedTrades.length) * 100 
      : 0,
    totalReturn: sortedTrades.length > 0
      ? sortedTrades.reduce((sum, trade) => sum + trade.return, 0)
      : backtestResult.totalReturn,
    totalNetReturn: sortedTrades.length > 0
      ? sortedTrades.reduce((sum, trade) => sum + (trade.return - 0.001), 0) // 0.1% 수수료 가정
      : backtestResult.totalNetReturn,
    averageReturn: sortedTrades.length > 0
      ? sortedTrades.reduce((sum, trade) => sum + trade.return, 0) / sortedTrades.length
      : backtestResult.averageReturn,
    averageNetReturn: sortedTrades.length > 0
      ? sortedTrades.reduce((sum, trade) => sum + (trade.return - 0.001), 0) / sortedTrades.length
      : backtestResult.averageNetReturn
  };

  const totalPages = Math.ceil(sortedTrades.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentTrades = sortedTrades.slice(startIndex, endIndex);

  return (
    <div className="mt-4 space-y-4">
      <div className="text-white text-lg font-bold mb-4">백테스트 결과</div>
      <div className="grid grid-cols-6 gap-4">
        <div className="bg-gray-800 p-4 rounded-lg">
          <div className="text-gray-400 text-sm">총 거래 횟수</div>
          <div className="text-white text-lg font-bold">
            {filteredBacktestResult.totalTrades}회
          </div>
        </div>
        <div className="bg-gray-800 p-4 rounded-lg">
          <div className="text-gray-400 text-sm">성공 거래 횟수</div>
          <div className="text-white text-lg font-bold">
            {filteredBacktestResult.successfulTrades}회
          </div>
        </div>
        <div className="bg-gray-800 p-4 rounded-lg">
          <div className="text-gray-400 text-sm">성공률</div>
          <div className="text-white text-lg font-bold">
            {filteredBacktestResult.successRate.toFixed(2)}%
          </div>
        </div>
        <div className="bg-gray-800 p-4 rounded-lg">
          <div className="text-gray-400 text-sm">총 수익률</div>
          <div className={`text-lg font-bold ${
            filteredBacktestResult.totalReturn >= 0 ? 'text-green-500' : 'text-red-500'
          }`}>
            {(filteredBacktestResult.totalReturn * 100).toFixed(2)}%
          </div>
        </div>
        <div className="bg-gray-800 p-4 rounded-lg">
          <div className="text-gray-400 text-sm">총 순수익률</div>
          <div className={`text-lg font-bold ${
            filteredBacktestResult.totalNetReturn >= 0 ? 'text-green-500' : 'text-red-500'
          }`}>
            {(filteredBacktestResult.totalNetReturn * 100).toFixed(2)}%
          </div>
        </div>
        <div className="bg-gray-800 p-4 rounded-lg">
          <div className="text-gray-400 text-sm">평균 수익률</div>
          <div className={`text-lg font-bold ${
            filteredBacktestResult.averageReturn >= 0 ? 'text-green-500' : 'text-red-500'
          }`}>
            {(filteredBacktestResult.averageReturn * 100).toFixed(2)}%
          </div>
        </div>
      </div>

      {filteredBacktestResult.trades.length > 0 && (
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
                      <td className="px-4 py-2">{formatTradeTime(trade.entryTime)}</td>
                      <td className="px-4 py-2">{formatTradeTime(trade.exitTime)}</td>
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