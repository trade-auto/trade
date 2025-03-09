'use client';

import { TradeCycle } from '../types/trading';

interface TradeHistoryProps {
  cycles: TradeCycle[];
}

export const TradeHistory: React.FC<TradeHistoryProps> = ({ cycles }) => {
  return (
    <div className="overflow-x-auto mt-2">
      <table className="min-w-full text-white">
        <thead>
          <tr className="text-gray-400">
            <th className="px-4 py-2">진입 시간</th>
            <th className="px-4 py-2">청산 시간</th>
            <th className="px-4 py-2">진입 가격 (3MA)</th>
            <th className="px-4 py-2">매수 가격</th>
            <th className="px-4 py-2">청산 가격 (3MA)</th>
            <th className="px-4 py-2">매도 가격</th>
            <th className="px-4 py-2">수익률</th>
            <th className="px-4 py-2">100만원 투자시 수익</th>
            <th className="px-4 py-2">체결 상태</th>
            <th className="px-4 py-2">거래 모드</th>
            <th className="px-4 py-2">360MA 기울기</th>
          </tr>
        </thead>
        <tbody>
          {cycles.map((entry, index) => {
            const profitAmount = entry.profitAmount ? parseFloat(entry.profitAmount) * (1000000 / 10000) : 0;
            
            return (
              <tr key={index} className="border-t border-gray-700">
                <td className="px-4 py-2">{entry.times[0]}</td>
                <td className="px-4 py-2">{entry.times[1] || '-'}</td>
                <td className="px-4 py-2">{entry.buyPrice?.toFixed(3) || 'N/A'}</td>
                <td className="px-4 py-2">{entry.buyPrice?.toFixed(3) || 'N/A'}</td>
                <td className="px-4 py-2">{entry.sellPrice?.toFixed(3) || 'N/A'}</td>
                <td className="px-4 py-2">{entry.sellPrice?.toFixed(3) || 'N/A'}</td>
                <td className={`px-4 py-2 ${entry.profit && parseFloat(entry.profit) >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                  {entry.profit ? `${entry.profit}%` : 'N/A'}
                </td>
                <td className={`px-4 py-2 ${profitAmount >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                  {profitAmount ? `${profitAmount.toLocaleString()}원` : 'N/A'}
                </td>
                <td className="px-4 py-2">
                  {entry.times[1] ? '체결완료' : '미체결'}
                </td>
                <td className="px-4 py-2">
                  <span className="px-2 py-1 rounded-full text-xs font-semibold bg-blue-500 text-white">
                    테스트
                  </span>
                </td>
                <td className={`px-4 py-2 ${
                  (entry.slopes?.ma360 ?? 0) > 0 ? 'text-green-500' : 'text-red-500'
                }`}>
                  {entry.slopes?.ma360?.toFixed(4) || '-'}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}; 