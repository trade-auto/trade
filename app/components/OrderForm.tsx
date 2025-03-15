'use client';

import { useState, useEffect, useCallback } from 'react';
import { getPriceChangeStyle } from '../utils/formatters';

interface OrderFormProps {
  market: string;
  side: 'bid' | 'ask';
  setSide: (side: 'bid' | 'ask') => void;
  volume: string;
  setVolume: (volume: string) => void;
  price: string;
  setPrice: (price: string) => void;
  ordType: 'limit' | 'price' | 'market';
  setOrdType: (ordType: 'limit' | 'price' | 'market') => void;
  isLoading: boolean;
  error: string | null;
  currentPrice: number | null;
  ma3Price: number | null;
  priceUpdateError: string | null;
  priceHistory: number[];
  orderLimits: {
    minOrderPrice: number;
    maxOrderPrice: number;
  };
  handleSubmit: (e: React.FormEvent) => Promise<void>;
}

export const OrderForm: React.FC<OrderFormProps> = ({
  market,
  side,
  setSide,
  volume,
  setVolume,
  price,
  setPrice,
  ordType,
  setOrdType,
  isLoading,
  error,
  currentPrice,
  ma3Price,
  priceUpdateError,
  priceHistory,
  orderLimits,
  handleSubmit
}) => {
  // 활성화된 퍼센트 상태 추가
  const [activePercent, setActivePercent] = useState(25);
  
  // 실시간 주문 금액 계산을 위한 state 추가
  const [orderAmount, setOrderAmount] = useState<number>(0);

  // 25% 금액에 해당하는 수량 계산 함수
  const calculatePercentVolume = useCallback(() => {
    if (ma3Price && orderLimits.maxOrderPrice) {
      const quarterAmount = orderLimits.maxOrderPrice * 0.25; // 최대 주문 금액의 25%
      return (quarterAmount / ma3Price).toFixed(4);
    }
    return '0';
  }, [ma3Price, orderLimits.maxOrderPrice]);

  // 컴포넌트 마운트 시 25% 수량 자동 설정
  useEffect(() => {
    if (ma3Price) {
      setVolume(calculatePercentVolume());
    }
  }, [ma3Price, orderLimits.maxOrderPrice, calculatePercentVolume, setVolume]);

  // 퍼센트 버튼 핸들러
  const handlePercentage = (percent: number) => {
    setActivePercent(percent);
    if (ma3Price && orderLimits.maxOrderPrice) {
      const amount = orderLimits.maxOrderPrice * (percent / 100);
      const calculatedVolume = (amount / ma3Price).toFixed(4);
      setVolume(calculatedVolume);
    }
  };

  const handleReset = () => {
    setVolume('');
  };

  // 가격이나 수량이 변경될 때마다 주문 금액 업데이트
  useEffect(() => {
    const calculatedAmount = Number(price) * Number(volume);
    setOrderAmount(calculatedAmount);
  }, [price, volume]);

  return (
    <>
      <form onSubmit={handleSubmit} className="bg-gray-800 p-4 rounded-lg">
        <div className="grid grid-cols-2 gap-4 mb-4">
          {/* 주문 종류 선택 */}
          <div>
            <label className="block text-gray-400 mb-2">주문 종류</label>
            <div className="flex space-x-2">
              <button
                type="button"
                onClick={() => setSide('bid')}
                className={`flex-1 px-4 py-2 rounded ${
                  side === 'bid' 
                    ? 'bg-green-600 text-white' 
                    : 'bg-gray-700 text-gray-300'
                }`}
              >
                {side === 'bid' ? '✓ 매수' : '매수'}
              </button>
              <button
                type="button"
                onClick={() => setSide('ask')}
                className={`flex-1 px-4 py-2 rounded ${
                  side === 'ask' 
                    ? 'bg-red-600 text-white' 
                    : 'bg-gray-700 text-gray-300'
                }`}
              >
                {side === 'ask' ? '✓ 매도' : '매도'}
              </button>
            </div>
          </div>

          {/* 주문 방식 선택 */}
          <div>
            <label className="block text-gray-400 mb-2">주문 방식</label>
            <div className="flex space-x-2 mb-4">
              <button
                type="button"
                onClick={() => setOrdType('limit')}
                className={`px-4 py-2 rounded-lg ${
                  ordType === 'limit' 
                    ? 'bg-blue-600 text-white' 
                    : 'bg-gray-700 text-gray-300'
                }`}
              >
                {ordType === 'limit' ? '✓ 지정가' : '지정가'}
              </button>
              <button
                type="button"
                onClick={() => setOrdType('price')}
                className={`px-4 py-2 rounded-lg ${
                  ordType === 'price' 
                    ? 'bg-blue-600 text-white' 
                    : 'bg-gray-700 text-gray-300'
                }`}
              >
                {ordType === 'price' ? '✓ 시장가(KRW)' : '시장가(KRW)'}
              </button>
              <button
                type="button"
                onClick={() => setOrdType('market')}
                className={`px-4 py-2 rounded-lg ${
                  ordType === 'market' 
                    ? 'bg-blue-600 text-white' 
                    : 'bg-gray-700 text-gray-300'
                }`}
              >
                {ordType === 'market' ? '✓ 시장가(수량)' : '시장가(수량)'}
              </button>
            </div>
          </div>
        </div>

        {/* 가격 입력 */}
        <div className="mb-4">
          <label className="block text-gray-400 mb-2">가격 (KRW)</label>
          <div className="space-y-2">
            <div className="flex space-x-2">
              <input
                type="number"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="가격을 입력하세요"
                className="flex-1 px-4 py-2 bg-gray-700 text-white rounded"
                min="0"
                step="1"
                disabled={ordType !== 'limit'}
              />
              {currentPrice && (
                <>
                  <button
                    type="button"
                    onClick={() => setPrice(currentPrice.toString())}
                    className={`px-4 py-2 ${
                      ordType !== 'limit' 
                        ? 'bg-gray-600 cursor-not-allowed' 
                        : 'bg-blue-600 hover:bg-blue-700'
                    } text-white rounded whitespace-nowrap`}
                    disabled={ordType !== 'limit'}
                  >
                    현재가: {currentPrice.toLocaleString()} KRW
                  </button>
                  <button
                    type="button"
                    onClick={() => setPrice('')}
                    className={`px-4 py-2 ${
                      ordType !== 'limit'
                        ? 'bg-gray-600 cursor-not-allowed'
                        : 'bg-gray-600 hover:bg-gray-700'
                    } text-white rounded`}
                    disabled={ordType !== 'limit'}
                  >
                    초기화
                  </button>
                </>
              )}
            </div>

            {/* 가격 히스토리 표시 */}
            {priceHistory.length > 0 && (
              <div className="grid grid-cols-3 gap-2 bg-gray-700 p-2 rounded">
                <div className="text-center">
                  <div className="text-xs text-gray-400">이전가</div>
                  <div className={getPriceChangeStyle(priceHistory[0], null)}>
                    {priceHistory[0]?.toLocaleString() || '-'}
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-xs text-gray-400">현재가</div>
                  <div className={getPriceChangeStyle(priceHistory[1], priceHistory[0])}>
                    {priceHistory[1]?.toLocaleString() || '-'}
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-xs text-gray-400">이후가</div>
                  <div className={getPriceChangeStyle(priceHistory[2], priceHistory[1])}>
                    {priceHistory[2]?.toLocaleString() || '-'}
                  </div>
                </div>
              </div>
            )}

            {ma3Price && ordType === 'limit' && (
              <button
                type="button"
                onClick={() => setPrice(ma3Price.toString())}
                className={`px-4 py-2 ${
                  ordType !== 'limit' 
                    ? 'bg-gray-600 cursor-not-allowed' 
                    : 'bg-blue-600 hover:bg-blue-700'
                } text-white rounded`}
                disabled={ordType !== 'limit'}
              >
                3초 중간가: {ma3Price.toLocaleString()} KRW
              </button>
            )}
            {priceUpdateError && (
              <div className="text-red-500 text-sm">{priceUpdateError}</div>
            )}
          </div>
        </div>

        {/* 수량 입력 및 퍼센트 버튼 */}
        <div className="mb-4">
          <label className="block text-gray-400 mb-2">수량</label>
          <div className="flex space-x-2">
            <input
              type="number"
              value={volume}
              onChange={(e) => {
                setVolume(e.target.value);
                setActivePercent(0); // 수동 입력 시 활성 퍼센트 초기화
              }}
              placeholder="수량을 입력하세요"
              className="flex-1 px-4 py-2 bg-gray-700 text-white rounded"
              min="0"
              step="0.0001"
            />
            <button
              type="button"
              onClick={() => handlePercentage(100)}
              className={`px-3 py-2 ${
                activePercent === 100 
                  ? 'bg-blue-600 hover:bg-blue-700' 
                  : 'bg-gray-600 hover:bg-gray-700'
              } text-white rounded`}
            >
              {activePercent === 100 ? '✓ 최대' : '최대'}
            </button>
            <button
              type="button"
              onClick={() => handlePercentage(50)}
              className={`px-3 py-2 ${
                activePercent === 50 
                  ? 'bg-blue-600 hover:bg-blue-700' 
                  : 'bg-gray-600 hover:bg-gray-700'
              } text-white rounded`}
            >
              {activePercent === 50 ? '✓ 50%' : '50%'}
            </button>
            <button
              type="button"
              onClick={() => handlePercentage(25)}
              className={`px-3 py-2 ${
                activePercent === 25 
                  ? 'bg-blue-600 hover:bg-blue-700' 
                  : 'bg-gray-600 hover:bg-gray-700'
              } text-white rounded`}
            >
              {activePercent === 25 ? '✓ 25%' : '25%'}
            </button>
            <button
              type="button"
              onClick={() => handlePercentage(10)}
              className={`px-3 py-2 ${
                activePercent === 10 
                  ? 'bg-blue-600 hover:bg-blue-700' 
                  : 'bg-gray-600 hover:bg-gray-700'
              } text-white rounded`}
            >
              {activePercent === 10 ? '✓ 10%' : '10%'}
            </button>
            <button
              type="button"
              onClick={() => {
                handleReset();
                setActivePercent(0);
              }}
              className="px-3 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded"
            >
              초기화
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-4 bg-red-600 text-white rounded">
            {error}
          </div>
        )}

        <button
          type="submit"
          className={`w-full py-2 rounded font-bold ${
            isLoading 
              ? 'bg-gray-600' 
              : side === 'bid'
                ? 'bg-green-600 hover:bg-green-700'
                : 'bg-red-600 hover:bg-red-700'
          } text-white`}
          disabled={isLoading}
        >
          {isLoading ? '주문 처리 중...' : side === 'bid' ? '매수하기' : '매도하기'}
        </button>
      </form>

      {/* 주문 금액 표시 */}
      {orderAmount > 0 && (
        <div className="mt-4 p-4 bg-gray-700 rounded">
          <div className="text-gray-400">예상 주문 금액</div>
          <div className="text-xl font-bold text-white">
            {orderAmount.toLocaleString()} KRW
          </div>
          
          {/* 주문 제한 표시 */}
          {(() => {
            if (orderAmount < orderLimits.minOrderPrice) {
              return (
                <div className="text-red-500 text-sm mt-2">
                  최소 주문 금액({orderLimits.minOrderPrice.toLocaleString()} KRW)보다 작습니다.
                </div>
              );
            }
            if (orderAmount > orderLimits.maxOrderPrice) {
              return (
                <div className="text-red-500 text-sm mt-2">
                  최대 주문 금액({orderLimits.maxOrderPrice.toLocaleString()} KRW)을 초과했습니다.
                </div>
              );
            }
            return null;
          })()}
        </div>
      )}
    </>
  );
}; 