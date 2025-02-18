import { useState, useEffect } from 'react';
import { getClosedOrders } from '../api/upbitOrder';

interface ClosedOrdersProps {
  market: string;
  onSelectOrder: (uuid: string) => void;
}

export function ClosedOrders({ market, onSelectOrder }: ClosedOrdersProps) {
  const [orders, setOrders] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadClosedOrders = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await getClosedOrders(market);
      setOrders(data);
    } catch (error: any) {
      setError(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadClosedOrders();
  }, [market]);

  return (
    <div className="mb-8">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold text-white">종료된 주문</h2>
        <button
          onClick={loadClosedOrders}
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

      {orders.length === 0 ? (
        <div className="bg-gray-800 p-4 rounded-lg text-gray-400 text-center">
          종료된 주문이 없습니다.
        </div>
      ) : (
        <div className="bg-gray-800 rounded-lg overflow-hidden">
          <table className="w-full text-white">
            <thead className="bg-gray-700">
              <tr>
                <th className="px-4 py-2">시간</th>
                <th className="px-4 py-2">종류</th>
                <th className="px-4 py-2">가격</th>
                <th className="px-4 py-2">수량</th>
                <th className="px-4 py-2">체결량</th>
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
                    {parseFloat(order.executed_volume).toLocaleString()}
                  </td>
                  <td className="px-4 py-2">
                    {order.state === 'done' ? '완료' : '취소'}
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
      )}
    </div>
  );
} 