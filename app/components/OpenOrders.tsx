import { useState, useEffect, forwardRef, useImperativeHandle } from 'react';
import { getOpenOrders, cancelOrder, cancelAllOrders, cancelAndNewOrder } from '../api/upbitOrder';

interface OpenOrdersProps {
  market: string;
  onSelectOrder: (uuid: string) => void;
}

export const OpenOrders = forwardRef(({ market, onSelectOrder }: OpenOrdersProps, ref) => {
  const [orders, setOrders] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cancellingOrder, setCancellingOrder] = useState<string | null>(null);
  const [isCancellingAll, setIsCancellingAll] = useState(false);
  const [reorderingUuid, setReorderingUuid] = useState<string | null>(null);

  const loadOpenOrders = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await getOpenOrders(market);
      setOrders(data);
    } catch (error: any) {
      setError(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancelOrder = async (uuid: string) => {
    if (!confirm('정말로 이 주문을 취소하시겠습니까?')) {
      return;
    }

    try {
      setCancellingOrder(uuid);
      await cancelOrder(uuid);
      // 주문 목록 새로고침
      await loadOpenOrders();
    } catch (error: any) {
      setError(error.message);
    } finally {
      setCancellingOrder(null);
    }
  };

  const handleCancelAllOrders = async () => {
    if (!confirm('모든 대기 중인 주문을 취소하시겠습니까?')) {
      return;
    }

    try {
      setIsCancellingAll(true);
      setError(null);
      await cancelAllOrders();
      await loadOpenOrders(); // 주문 목록 새로고침
    } catch (error: any) {
      setError(error.message);
    } finally {
      setIsCancellingAll(false);
    }
  };

  const handleCancelAndNewOrder = async (order: any) => {
    if (!confirm('현재 주문을 취소하고 새로운 가격으로 재주문하시겠습니까?')) {
      return;
    }

    const newPrice = prompt('새로운 주문 가격을 입력하세요:', order.price);
    if (!newPrice) return;

    try {
      setReorderingUuid(order.uuid);
      setError(null);
      
      await cancelAndNewOrder({
        prev_order_uuid: order.uuid,
        new_ord_type: 'limit',
        new_price: newPrice,
        new_volume: 'remain_only',
      });

      await loadOpenOrders(); // 주문 목록 새로고침
    } catch (error: any) {
      setError(error.message);
    } finally {
      setReorderingUuid(null);
    }
  };

  // ref를 통해 loadOpenOrders 함수를 외부에 노출
  useImperativeHandle(ref, () => ({
    loadOpenOrders
  }));

  useEffect(() => {
    loadOpenOrders();
  }, [market]);

  return (
    <div className="mb-8">
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center space-x-4">
          <h2 className="text-xl font-bold text-white">체결 대기 주문</h2>
          {orders.length > 0 && (
            <button
              onClick={handleCancelAllOrders}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg"
              disabled={isCancellingAll}
            >
              {isCancellingAll ? '일괄 취소 중...' : '전체 주문 취소'}
            </button>
          )}
        </div>
        <button
          onClick={loadOpenOrders}
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
          체결 대기 중인 주문이 없습니다.
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
                <th className="px-4 py-2">미체결량</th>
                <th className="px-4 py-2">상태</th>
                <th className="px-4 py-2">상세</th>
                <th className="px-4 py-2">취소</th>
                <th className="px-4 py-2">재주문</th>
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
                    {parseFloat(order.remaining_volume).toLocaleString()}
                  </td>
                  <td className="px-4 py-2">
                    {order.state === 'wait' ? '대기' : '예약'}
                  </td>
                  <td className="px-4 py-2">
                    <button
                      onClick={() => onSelectOrder(order.uuid)}
                      className="px-3 py-1 bg-blue-600 hover:bg-blue-700 rounded text-white"
                    >
                      상세
                    </button>
                  </td>
                  <td className="px-4 py-2">
                    <button
                      onClick={() => handleCancelOrder(order.uuid)}
                      className="px-3 py-1 bg-red-600 hover:bg-red-700 rounded text-white"
                      disabled={cancellingOrder === order.uuid}
                    >
                      {cancellingOrder === order.uuid ? '취소 중...' : '주문 취소'}
                    </button>
                  </td>
                  <td className="px-4 py-2">
                    <button
                      onClick={() => handleCancelAndNewOrder(order)}
                      className="px-3 py-1 bg-yellow-600 hover:bg-yellow-700 rounded text-white"
                      disabled={reorderingUuid === order.uuid}
                    >
                      {reorderingUuid === order.uuid ? '처리 중...' : '가격 변경'}
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
}); 