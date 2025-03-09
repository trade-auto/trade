'use client';

import { useState, forwardRef, useImperativeHandle, useEffect } from 'react';
import { createOrder } from '../../api/upbitOrder';
import useUpbitStore from '../../store/useUpbitStore';
import { CreateOrderProps, OrderParams, TradeCycle, TradeStrategy } from './types';
import { formatElapsedTime, calculateRelativeSlope, calculateMA } from './utils';
import { usePriceInfo, useAutoTrading, useOrderVolume } from './hooks';
import TradeHistoryTable from './TradeHistoryTable';
import StrategySelector from './StrategySelector';

export const CreateOrder = forwardRef<
  { handleAutomaticTrade: (params: OrderParams) => Promise<void> },
  CreateOrderProps
>(({ market, mode, onOrderCreated, onPriceUpdate, onQuantityUpdate, onBacktestStart }, ref) => {
  const {
    tradeState,
    updateTradeState,
    createOrder: storeCreateOrder,
    orderLimits,
    tradeStrategy,
    updateTradeStrategy,
    dateRange
  } = useUpbitStore();
  
  // 주문 상태
  const [side, setSide] = useState<'bid' | 'ask'>('bid');
  const [ordType, setOrdType] = useState<'limit' | 'price' | 'market'>('limit');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // 커스텀 훅 사용
  const { 
    currentPrice, 
    ma3Price, 
    priceUpdateError, 
    priceHistory, 
    price, 
    setPrice, 
    getPriceChangeStyle 
  } = usePriceInfo(market, ordType);
  
  const {
    volume,
    setVolume,
    activePercent,
    orderAmount,
    setOrderAmount,
    handlePercentage,
    handleReset
  } = useOrderVolume(ma3Price, orderLimits);
  
  const {
    autoTrading,
    isBacktesting,
    tradeCycles,
    currentCycle,
    elapsedTime,
    showHistory,
    lastSignal,
    totalProfit,
    setTradeCycles,
    setCurrentCycle,
    setShowHistory,
    handleAutoTradingToggle,
    handleBacktestStart: startBacktest,
    calculateTotalProfit
  } = useAutoTrading(market, mode, currentPrice, priceHistory);

  // 가격이나 수량이 변경될 때마다 주문 금액 업데이트
  useEffect(() => {
    const calculatedAmount = Number(price) * Number(volume);
    setOrderAmount(calculatedAmount);
  }, [price, volume, setOrderAmount]);

  // 현재 가격 부모 컴포넌트에 전달
  useEffect(() => {
    onPriceUpdate(currentPrice ?? 0);
  }, [currentPrice, onPriceUpdate]);

  // 수량 변경시 부모에게 전달
  useEffect(() => {
    onQuantityUpdate(Number(volume));
  }, [volume, onQuantityUpdate]);

  // 폼 제출 핸들러
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!volume || !price) {
      setError('수량과 가격을 입력해주세요.');
      return;
    }

    // 주문 금액 계산
    const orderAmount = Number(price) * Number(volume);

    // 주문 제한 설정 확인
    if (orderAmount < orderLimits.minOrderPrice) {
      setError(`최소 주문 금액(${orderLimits.minOrderPrice.toLocaleString()} KRW)보다 작습니다.`);
      return;
    }

    if (orderAmount > orderLimits.maxOrderPrice) {
      setError(`최대 주문 금액(${orderLimits.maxOrderPrice.toLocaleString()} KRW)을 초과했습니다.`);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      await storeCreateOrder({
        market,
        side,
        volume,
        price,
        ord_type: ordType,
        mode: mode === 'test' ? 'test' : 'live-auto'
      });

      // 입력 필드 초기화
      setVolume('');
      setPrice('');
      
      // 주문 생성 후 콜백 실행
      if (onOrderCreated) {
        onOrderCreated();
      }
    } catch (error: Error | unknown) {
      setError(error instanceof Error ? error.message : 'Unknown error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  // 매매 상태 표시 함수
  const getTradeStatusText = () => {
    if (currentCycle === 'waiting_buy') {
      return `매수 대기 중 - ${formatElapsedTime(elapsedTime)} 경과`;
    } else if (currentCycle === 'waiting_sell') {
      return `매도 대기 중 - ${formatElapsedTime(elapsedTime)} 경과`;
    } else {
      return `거래 완료 - ${formatElapsedTime(elapsedTime)} 경과`;
    }
  };

  // 전략 변경 핸들러
  const handleStrategyChange = (strategy: TradeStrategy) => {
    updateTradeStrategy(strategy);
  };

  // 백테스트 시작 함수
  const handleBacktestStart = () => {
    startBacktest(onBacktestStart);
  };

  // 자동 거래 실행 함수
  const handleAutomaticTrade = async (params: OrderParams) => {
    if (isLoading) return;

    try {
      setIsLoading(true);
      
      if (mode === 'test') {
        const now = new Date().toLocaleTimeString('ko-KR', { 
            hour: '2-digit', 
            minute: '2-digit', 
            second: '2-digit' 
        });

        // 현재 MA 기울기 계산
        const ma60 = calculateMA(priceHistory, 60);
        const ma360 = calculateMA(priceHistory, 360);

        const slope60 = calculateRelativeSlope(ma60);
        const slope360 = calculateRelativeSlope(ma360);

        // 360MA 기준 위치 확인
        if (!currentPrice) return;  // currentPrice가 null이면 함수 종료

        const currentMA = currentPrice;
        const isAbove360MA = currentMA > ma360[ma360.length - 1];

        // 기울기 임계값 설정 추가
        const buyThreshold = 0.01;   // 1%
        const sellThreshold = -0.01; // -1%

        if (params.side === 'bid' && currentCycle === 'waiting_buy') {
          // 360MA 조건 강화
          if (!isAbove360MA && slope360 > buyThreshold) {  // 360MA 기울기가 임계값보다 커야함
            setTradeCycles(prev => {
              const newCycle = {
                cycle: ['매수'],
                times: [now],
                time: now,
                buyPrice: parseFloat(params.price),
                sellPrice: null,
                profit: null,
                profitAmount: null,
                slopes: {
                  ma60: slope60,
                  ma300: slope60,
                  ma360: slope360,
                  ma900: slope360
                }
              };
              return [...prev, newCycle];
            });
          } else {
            console.log(`360MA 조건 불충족으로 매수 취소 (기울기: ${slope360.toFixed(4)}%)`);
            return;
          }
        } else if (params.side === 'ask' && currentCycle === 'waiting_sell') {
          console.log('매도 조건 체크:', {
            isAbove360MA,
            slope360,
            sellThreshold,
            condition: slope360 < sellThreshold
          });
          
          if (isAbove360MA && slope360 < sellThreshold) {  // 360MA 기울기가 임계값보다 작아야함
            setTradeCycles(prev => {
              const lastCycle = prev[prev.length - 1];
              if (lastCycle && lastCycle.cycle.length === 1) {
                const updatedCycle = {
                  cycle: ['매도'],
                  times: [now],
                  time: now,
                  buyPrice: lastCycle.buyPrice,
                  sellPrice: parseFloat(params.price),
                  profit: null,
                  profitAmount: null,
                  slopes: {
                    ma60: slope60,
                    ma300: slope60,
                    ma360: slope360,
                    ma900: slope360
                  }
                };
                return [...prev.slice(0, -1), updatedCycle];
              }
              return prev;
            });
          } else {
            console.log('매도 취소 이유:', {
              isAbove360MA: isAbove360MA ? '만족' : '불만족',
              slope360: `${slope360.toFixed(4)}% (임계값: ${sellThreshold}%)`
            });
            return;
          }
        } else {
          console.log('현재 상태에서 실행할 수 없는 주문:', {
            requestedSide: params.side,
            currentCycle
          });
          return;
        }

        if (onOrderCreated) {
          onOrderCreated();
        }
      }
    } catch (error: Error | unknown) {
      console.error('자동 거래 실패:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // ref로 handleAutomaticTrade 함수 노출
  useImperativeHandle(ref, () => ({
    handleAutomaticTrade
  }));

  return (
    <div className="mb-8">
      <div className="flex items-center gap-2">
        <h2 className="text-xl font-bold text-white">주문하기</h2>
        {mode === 'test' && (
          <span className="px-2 py-1 bg-blue-500 text-white text-sm rounded-full">
            테스트 모드
          </span>
        )}
        {mode === 'live' && (
          <span className="px-2 py-1 bg-red-500 text-white text-sm rounded-full">
            실전 모드
          </span>
        )}
      </div>
      
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
              onClick={handleReset}
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

      {/* 자동 거래 토글 버튼과 상태 표시 부분 */}
      {mode === 'test' && (
        <div className="mt-4 flex items-center gap-4">
          <button
            onClick={handleAutoTradingToggle}
            className={`px-6 py-2 rounded font-bold ${
              autoTrading 
                ? 'bg-red-600 hover:bg-red-700'
                : 'bg-gray-600 hover:bg-gray-700'
            } text-white`}
            disabled={isBacktesting}
          >
            {autoTrading ? '자동 거래 중지' : '자동 거래 시작'}
          </button>

          {/* 백테스트 시작 버튼 */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleBacktestStart}
              className={`px-6 py-2 rounded font-bold ${
                isBacktesting 
                  ? 'bg-red-600 hover:bg-red-700'
                  : 'bg-blue-600 hover:bg-blue-700'
              } text-white`}
              disabled={autoTrading}
            >
              {isBacktesting ? '백테스트 중지' : '백테스트 시작'}
            </button>
          </div>

          {/* 백테스트 상태 표시 */}
          {isBacktesting && (
            <div className="px-4 py-2 bg-gray-700 rounded">
              <span className="text-white">
                백테스트 기간: {dateRange.startDate.toLocaleDateString()} ~ {dateRange.endDate?.toLocaleDateString() || new Date().toLocaleDateString()}
              </span>
            </div>
          )}

          {/* 매매 전략 선택 스위치 */}
          <StrategySelector 
            tradeStrategy={tradeStrategy}
            handleStrategyChange={handleStrategyChange}
            disabled={autoTrading || isBacktesting}
          />

          {autoTrading && (
            <div className="flex flex-col items-start">
              <span className="text-gray-400 mb-2">현재 상태:</span>
              <span className={`px-3 py-1 rounded-full text-sm font-semibold mb-1 ${
                tradeState.lastTradeType === null
                  ? 'bg-yellow-600 text-white'
                  : tradeState.lastTradeType === 'bid'
                    ? 'bg-red-600 text-white'
                    : 'bg-blue-600 text-white'
              }`}>
                {getTradeStatusText()}
              </span>
              <button
                onClick={() => setShowHistory(!showHistory)}
                className="mt-2 px-3 py-1 bg-gray-600 hover:bg-gray-700 text-white rounded"
              >
                {showHistory ? '히스토리 숨기기' : '히스토리 보기'}
              </button>
              {showHistory && tradeCycles.length > 0 && (
                <div className="mt-2">
                  <TradeHistoryTable cycles={tradeCycles} />
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* 총 수익률 표시 */}
      <div className="text-white text-lg font-bold">
        총 수익률: {totalProfit}%
      </div>

      {/* 전략 상태 표시 패널 추가 */}
      <div className="mt-4 bg-gray-800 p-4 rounded-lg">
        {lastSignal && (
          <div className="mt-2 text-yellow-400">
            마지막 신호: {lastSignal}
          </div>
        )}
      </div>
    </div>
  );
});

CreateOrder.displayName = 'CreateOrder';

export default CreateOrder; 