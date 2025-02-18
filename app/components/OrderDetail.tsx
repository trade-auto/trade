import { useState } from 'react';
import { getOrder } from '../api/upbitOrder';

interface OrderDetailProps {
  uuid?: string;
}

export function OrderDetail({ uuid }: OrderDetailProps) {
  const [orderInfo, setOrderInfo] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [orderUuid, setOrderUuid] = useState(uuid || '');

  const loadOrderInfo = async () => {
    if (!orderUuid.trim()) {
      setError('주문 UUID를 입력해주세요.');
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      const data = await getOrder(orderUuid);
      setOrderInfo(data);
    } catch (error: any) {
      setError(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="mb-8">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold text-white">개별 주문 상세 정보</h2>
      </div>

      <div className="flex space-x-4 mb-4">
        <input
          type="text"
          value={orderUuid}
          onChange={(e) => setOrderUuid(e.target.value)}
          placeholder="주문 UUID를 입력하세요"
          className="flex-1 px-4 py-2 bg-gray-700 text-white rounded-lg"
        />
        <button
          onClick={loadOrderInfo}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
          disabled={isLoading}
        >
          {isLoading ? '로딩 중...' : '조회'}
        </button>
      </div>

      {error && (
        <div className="bg-red-600 text-white p-4 rounded-lg mb-4">
          {error}
        </div>
      )}

      {orderInfo && (
        <div className="bg-gray-800 p-4 rounded-lg">
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-gray-400">주문 UUID</span>
              <span className="text-white">{orderInfo.uuid}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">주문 종류</span>
              <span className="text-white">
                {orderInfo.side === 'ask' ? '매도' : '매수'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">주문 상태</span>
              <span className="text-white">
                {orderInfo.state === 'wait' ? '대기' : 
                 orderInfo.state === 'done' ? '완료' : '취소'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">마켓</span>
              <span className="text-white">{orderInfo.market}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">주문 가격</span>
              <span className="text-white">
                {parseFloat(orderInfo.price).toLocaleString()} KRW
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">주문 수량</span>
              <span className="text-white">
                {parseFloat(orderInfo.volume).toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">체결 수량</span>
              <span className="text-white">
                {parseFloat(orderInfo.executed_volume).toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">수수료</span>
              <span className="text-white">
                {parseFloat(orderInfo.paid_fee).toLocaleString()} KRW
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">생성 시간</span>
              <span className="text-white">
                {new Date(orderInfo.created_at).toLocaleString()}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 