import { useState } from 'react';
import { getOrdersByIds } from '../api/upbitOrder';

interface OrderListByIdProps {
  onSelectOrder: (uuid: string) => void;
}

export function OrderListById({ onSelectOrder }: OrderListByIdProps) {
  const [orders, setOrders] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uuidInput, setUuidInput] = useState('');
  const [isInputVisible, setIsInputVisible] = useState(false);

  const loadOrderList = async () => {
    const uuids = uuidInput.split(',').map(uuid => uuid.trim()).filter(uuid => uuid);
    
    if (uuids.length === 0) {
      setError('주문 ID를 입력해주세요. (여러 개인 경우 쉼표로 구분)');
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      const data = await getOrdersByIds(uuids);
      setOrders(data);
      setIsInputVisible(false);
    } catch (error: any) {
      setError(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="mb-8">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold text-white">ID로 주문 조회</h2>
        <button
          onClick={() => setIsInputVisible(!isInputVisible)}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
        >
          {isInputVisible ? '취소' : 'ID로 주문 조회하기'}
        </button>
      </div>

      {isInputVisible && (
        <div className="bg-gray-800 p-4 rounded-lg mb-4">
          <div className="flex space-x-4">
            <input
              type="text"
              value={uuidInput}
              onChange={(e) => setUuidInput(e.target.value)}
              placeholder="주문 ID를 입력하세요 (여러 개인 경우 쉼표로 구분)"
              className="flex-1 px-4 py-2 bg-gray-700 text-white rounded-lg"
            />
            <button
              onClick={loadOrderList}
              className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg"
              disabled={isLoading}
            >
              {isLoading ? '로딩 중...' : '조회'}
            </button>
          </div>
          <p className="text-gray-400 text-sm mt-2">
            여러 주문을 조회하려면 ID를 쉼표(,)로 구분하여 입력하세요.
          </p>
        </div>
      )}

      {error && (
        <div className="bg-red-600 text-white p-4 rounded-lg mb-4">
          {error}
        </div>
      )}

      {orders.length > 0 && (
        <div className="bg-gray-800 rounded-lg overflow-hidden">
          <table className="w-full text-white">
            <thead className="bg-gray-700">
              <tr>
                <th className="px-4 py-2">주문 ID</th>
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
                  <td className="px-4 py-2">{order.uuid}</td>
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
      )}
    </div>
  );
} 