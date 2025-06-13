'use client';

import { useState, useEffect } from 'react';
import { getOrderChance } from '../api/upbitOrder';

interface OrderChanceInfoProps {
  market: string;
}

export function OrderChanceInfo({ market }: OrderChanceInfoProps) {
  const [orderInfo, setOrderInfo] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // localStorage에서 주문 제한 설정을 가져오는 함수
  const getOrderLimits = () => {
    if (typeof window === 'undefined') {
      return {
        minOrderPrice: 5000,
        maxOrderPrice: 1000000000
      };
    }
    const savedSettings = localStorage.getItem('orderLimitSettings');
    if (savedSettings) {
      return JSON.parse(savedSettings);
    }
    return {
      minOrderPrice: 5000,
      maxOrderPrice: 1000000000
    };
  };

  const [orderLimits, setOrderLimits] = useState(() => getOrderLimits());

  // 주문 제한 설정이 변경될 때마다 업데이트
  useEffect(() => {
    const handleSettingsChange = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail) {
        setOrderLimits(customEvent.detail);
      } else {
        setOrderLimits(getOrderLimits());
      }
    };

    window.addEventListener('orderLimitSettingsChanged', handleSettingsChange);
    
    return () => {
      window.removeEventListener('orderLimitSettingsChanged', handleSettingsChange);
    };
  }, []);

  const loadOrderInfo = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await getOrderChance(market);
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
        <h2 className="text-xl font-bold text-white">주문 가능 정보</h2>
        <button
          onClick={loadOrderInfo}
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

      {orderInfo && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-gray-800 p-4 rounded-lg">
            <h3 className="text-lg font-bold text-white mb-4">기본 정보</h3>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-400">마켓</span>
                <span className="text-white">{orderInfo.market.id}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">매수 수수료</span>
                <span className="text-white">{parseFloat(orderInfo.bid_fee) * 100}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">매도 수수료</span>
                <span className="text-white">{parseFloat(orderInfo.ask_fee) * 100}%</span>
              </div>
            </div>
          </div>

          <div className="bg-gray-800 p-4 rounded-lg">
            <h3 className="text-lg font-bold text-white mb-4">매수 계정</h3>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-400">화폐</span>
                <span className="text-white">{orderInfo.bid_account.currency}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">주문 가능</span>
                <span className="text-white">
                  {parseFloat(orderInfo.bid_account.balance).toLocaleString()} {orderInfo.bid_account.currency}
                </span>
              </div>
            </div>
          </div>

          <div className="bg-gray-800 p-4 rounded-lg">
            <h3 className="text-lg font-bold text-white mb-4">매도 계정</h3>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-400">화폐</span>
                <span className="text-white">{orderInfo.ask_account.currency}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">주문 가능</span>
                <span className="text-white">
                  {parseFloat(orderInfo.ask_account.balance).toLocaleString()} {orderInfo.ask_account.currency}
                </span>
              </div>
            </div>
          </div>

          <div className="bg-gray-800 p-4 rounded-lg">
            <h3 className="text-lg font-bold text-white mb-2">주문 제한</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-gray-400">최소 매수 금액</div>
                <div className="text-white font-bold">
                  {orderLimits.minOrderPrice.toLocaleString()} KRW
                </div>
              </div>
              <div>
                <div className="text-gray-400">최대 매수 금액</div>
                <div className="text-white font-bold">
                  {orderLimits.maxOrderPrice.toLocaleString()} KRW
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 