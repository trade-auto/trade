import { useState, useEffect } from 'react';
import { getOrderHistory } from '../api/upbitOrder';

interface OrderHistoryProps {
  market: string;
  onSelectOrder: (uuid: string) => void;
}

export function OrderHistory({ market, onSelectOrder }: OrderHistoryProps) {
  const [orders, setOrders] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState('7d'); // 기본값 7일

  const loadOrderHistory = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await getOrderHistory(market);
      
      // 선택된 기간에 따라 데이터 필터링
      const periodInDays = parseInt(period);
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - periodInDays);
      
      const filteredOrders = data.filter(order => 
        new Date(order.created_at) >= cutoffDate
      );
      
      setOrders(filteredOrders);
    } catch (error: any) {
      setError(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadOrderHistory();
  }, [market, period]);

  return (
    <div className="mb-8">
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center space-x-4">
          <h2 className="text-xl font-bold text-white">개별 주문 내역</h2>
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className="bg-gray-700 text-white px-3 py-1 rounded-lg"
          >
            <option value="1d">최근 1일</option>
            <option value="7d">최근 7일</option>
            <option value="30d">최근 30일</option>
            <option value="90d">최근 90일</option>
          </select>
        </div>
        <button
          onClick={loadOrderHistory}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
          disabled={isLoading}
        >
          {isLoading ? '로딩 중...' : '새로고침'}
        </button>
      </div>

      {error && (
        <div className="bg-red-600 text-white p-4 rounded-lg mb-4">
          {error}
        </div>
      )}

      <div className="bg-gray-800 rounded-lg overflow-hidden">
        <table className="w-full text-white">
          <thead className="bg-gray-700">
            <tr>
              <th className="px-4 py-2">시간</th>
              <th className="px-4 py-2">종류</th>
              <th className="px-4 py-2">가격</th>
              <th className="px-4 py-2">수량</th>
              <th className="px-4 py-2">상태</th>
              <th className="px-4 py-2">상세</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((order) => (
              <tr key={order.uuid} className="border-t border-gray-700">
                <td className="px-4 py-2">
                  {new Date(order.created_at).toLocaleString()}
                </td>
                <td className="px-4 py-2">
                  {order.side === 'ask' ? '매도' : '매수'}
                </td>
                <td className="px-4 py-2">
                  {parseFloat(order.price).toLocaleString()} KRW
                </td>
                <td className="px-4 py-2">
                  {parseFloat(order.volume).toLocaleString()}
                </td>
                <td className="px-4 py-2">
                  {order.state === 'wait' ? '대기' : 
                   order.state === 'done' ? '완료' : '취소'}
                </td>
                <td className="px-4 py-2">
                  <button
                    onClick={() => onSelectOrder(order.uuid)}
                    className="px-3 py-1 bg-blue-600 hover:bg-blue-700 rounded"
                  >
                    상세
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
} 