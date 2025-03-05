import { useState, useEffect, useCallback } from 'react';
import { getClosedOrders } from '../api/upbitOrder';

interface Order {
  uuid: string;
  created_at: string;
  side: 'ask' | 'bid';
  price: string;
  volume: string;
  state: 'wait' | 'done' | 'cancel';
}

interface ClosedOrdersProps {
  market: string;
  onSelectOrder: (uuid: string) => void;
}

export function ClosedOrders({ market, onSelectOrder }: ClosedOrdersProps) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'1day' | '7days' | '30days' | 'all'>('7days');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const loadClosedOrders = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await getClosedOrders(market);
      const filteredData = filterOrdersByDate(data, filter);
      setOrders(filteredData);
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다');
    } finally {
      setIsLoading(false);
    }
  }, [market, filter]);

  const filterOrdersByDate = (orders: Order[], filter: string) => {
    const now = new Date();
    let filteredOrders = orders;

    if (filter === '1day') {
      const oneDayAgo = new Date(now.setDate(now.getDate() - 1));
      filteredOrders = orders.filter(order => new Date(order.created_at) >= oneDayAgo);
    } else if (filter === '7days') {
      const sevenDaysAgo = new Date(now.setDate(now.getDate() - 7));
      filteredOrders = orders.filter(order => new Date(order.created_at) >= sevenDaysAgo);
    } else if (filter === '30days') {
      const thirtyDaysAgo = new Date(now.setDate(now.getDate() - 30));
      filteredOrders = orders.filter(order => new Date(order.created_at) >= thirtyDaysAgo);
    }

    return filteredOrders;
  };

  useEffect(() => {
    loadClosedOrders();
  }, [loadClosedOrders]);

  return (
    <div className="bg-gray-800 p-4 rounded-lg">
      <h2 className="text-xl font-bold text-white mb-4">종료된 주문</h2>
      <div className="relative mb-4">
        <button
          onClick={() => setIsDropdownOpen(!isDropdownOpen)}
          className="px-4 py-2 bg-gray-700 text-white rounded-lg"
        >
          {filter === '1day' ? '최근 1일' : filter === '7days' ? '최근 7일' : filter === '30days' ? '최근 30일' : '전체'}
        </button>
        {isDropdownOpen && (
          <div className="absolute mt-2 w-48 bg-gray-700 rounded-lg shadow-lg z-10">
            <button
              onClick={() => { setFilter('1day'); setIsDropdownOpen(false); }}
              className="block w-full text-left px-4 py-2 text-white hover:bg-gray-600"
            >
              최근 1일
            </button>
            <button
              onClick={() => { setFilter('7days'); setIsDropdownOpen(false); }}
              className="block w-full text-left px-4 py-2 text-white hover:bg-gray-600"
            >
              최근 7일
            </button>
            <button
              onClick={() => { setFilter('30days'); setIsDropdownOpen(false); }}
              className="block w-full text-left px-4 py-2 text-white hover:bg-gray-600"
            >
              최근 30일
            </button>
            <button
              onClick={() => { setFilter('all'); setIsDropdownOpen(false); }}
              className="block w-full text-left px-4 py-2 text-white hover:bg-gray-600"
            >
              전체
            </button>
          </div>
        )}
      </div>

      {isLoading ? (
        <div className="text-white">로딩 중...</div>
      ) : error ? (
        <div className="text-red-500">{error}</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-700">
            <thead className="bg-gray-700">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">UUID</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">시간</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">종류</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">가격</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">수량</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">상태</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">상세</th>
              </tr>
            </thead>
            <tbody className="bg-gray-800 divide-y divide-gray-700">
              {orders.map((order) => (
                <tr key={order.uuid}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">{order.uuid}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                    {new Date(order.created_at).toLocaleString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                    {order.side === 'ask' ? '매도' : '매수'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                    {parseFloat(order.price).toLocaleString()} KRW
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                    {parseFloat(order.volume).toLocaleString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                    {order.state === 'wait' ? '대기' : 
                     order.state === 'done' ? '완료' : '취소'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <button
                      onClick={() => onSelectOrder(order.uuid)}
                      className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white font-semibold rounded-lg shadow-md"
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