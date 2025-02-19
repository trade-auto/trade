'use client';

import { useState, useEffect, forwardRef, useImperativeHandle } from 'react';
import { createOrder, getCurrentPrice, get3SecMA } from '../api/upbitOrder';
import { useUpbitStore } from '../store/useUpbitStore';

interface CreateOrderProps {
  market: string;
  mode: 'live' | 'test';
  onOrderCreated: () => void;
  onPriceUpdate: (price: number) => void;
  onQuantityUpdate: (quantity: number) => void;
}

export const CreateOrder = forwardRef<
  { handleAutomaticTrade: (tradeSide: 'bid' | 'ask', tradePrice: number) => Promise<void> },
  CreateOrderProps
>(({ market, mode, onOrderCreated, onPriceUpdate, onQuantityUpdate }, ref) => {
  const { tradeState, updateTradeState } = useUpbitStore();
  const [side, setSide] = useState<'bid' | 'ask'>('bid');
  const [volume, setVolume] = useState('');
  const [price, setPrice] = useState('');
  const [ordType, setOrdType] = useState<'limit' | 'price' | 'market'>('limit');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentPrice, setCurrentPrice] = useState<number | null>(null);
  const [ma3Price, setMa3Price] = useState<number | null>(null);
  const [priceUpdateError, setPriceUpdateError] = useState<string | null>(null);
  const [priceHistory, setPriceHistory] = useState<number[]>([]);
  const [autoTrading, setAutoTrading] = useState(false);
  const [lastTradeType, setLastTradeType] = useState<'bid' | 'ask' | null>(null);
  const [isTradeComplete, setIsTradeComplete] = useState(false);
  const [tradeStatus, setTradeStatus] = useState<'waiting_buy' | 'waiting_sell' | 'trading' | 'complete'>('waiting_buy');
  const [statusChangeTime, setStatusChangeTime] = useState<string>(new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
  const [statusHistory, setStatusHistory] = useState<{ status: string, time: string }[]>([]);
  const [tradeCycles, setTradeCycles] = useState<{ cycle: string[], times: string[], time: string }[]>([]);
  const [elapsedTime, setElapsedTime] = useState<number>(0);
  const [actionStartTime, setActionStartTime] = useState<Date | null>(null);

  // localStorage에서 주문 제한 설정을 가져오는 함수
  const getOrderLimits = () => {
    const savedSettings = localStorage.getItem('orderLimitSettings');
    if (savedSettings) {
      return JSON.parse(savedSettings);
    }
    return {
      minOrderPrice: 5000,
      maxOrderPrice: 1000000000
    };
  };

  const [orderLimits, setOrderLimits] = useState(getOrderLimits());

  // 주문 제한 설정이 변경될 때마다 업데이트
  useEffect(() => {
    const handleStorageChange = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail) {
        setOrderLimits(customEvent.detail);
      } else {
        setOrderLimits(getOrderLimits());
      }
    };

    // 커스텀 이벤트 리스너 등록
    window.addEventListener('orderLimitSettingsChanged', handleStorageChange);
    
    return () => {
      window.removeEventListener('orderLimitSettingsChanged', handleStorageChange);
    };
  }, []);

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

      await createOrder({
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
    } catch (error: any) {
      setError(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  // 활성화된 퍼센트 상태 추가
  const [activePercent, setActivePercent] = useState(25);

  // 25% 금액에 해당하는 수량 계산 함수
  const calculatePercentVolume = () => {
    if (ma3Price && orderLimits.maxOrderPrice) {
      const quarterAmount = orderLimits.maxOrderPrice * 0.25; // 최대 주문 금액의 25%
      return (quarterAmount / ma3Price).toFixed(4);
    }
    return '0';
  };

  // 컴포넌트 마운트 시 25% 수량 자동 설정
  useEffect(() => {
    if (ma3Price) {
      setVolume(calculatePercentVolume());
    }
  }, [ma3Price, orderLimits.maxOrderPrice]);

  // 퍼센트 버튼 핸들러 수정
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

  // 가격 정보 업데이트 함수
  const updatePrices = async () => {
    try {
      setPriceUpdateError(null);
      const [current, ma3] = await Promise.all([
        getCurrentPrice(market),
        get3SecMA(market)
      ]);
      setCurrentPrice(current);
      setMa3Price(ma3);

      // 가격 히스토리 업데이트
      setPriceHistory(prev => {
        const newHistory = [...prev, current].slice(-3); // 최근 3개 가격만 유지
        return newHistory;
      });

      // 지정가 주문이 아닐 때는 현재가로 자동 업데이트
      if (ordType !== 'limit' && current) {
        setPrice(current.toString());
      }
    } catch (error: any) {
      setPriceUpdateError('가격 정보 업데이트 실패');
      console.error('가격 업데이트 중 오류:', error);
    }
  };

  // 3초 MA 가격 변경 시 현재가도 업데이트
  const handleMa3PriceClick = () => {
    if (ma3Price) {
      setPrice(ma3Price.toString());
      setCurrentPrice(ma3Price); // 현재가도 3초 MA 가격으로 업데이트
    }
  };

  // 주기적으로 가격 업데이트 (1초마다)
  useEffect(() => {
    updatePrices();
    const interval = setInterval(updatePrices, 1000); // 1초마다 업데이트
    
    return () => clearInterval(interval);
  }, [market, ordType]); // ordType이 변경될 때도 다시 설정

  // 주문 방식이 변경될 때 가격 자동 설정
  useEffect(() => {
    if (ordType !== 'limit' && currentPrice) {
      setPrice(currentPrice.toString());
    }
  }, [ordType, currentPrice]);

  // 가격 변화 표시 함수
  const getPriceChangeStyle = (currentPrice: number, prevPrice: number | null) => {
    if (!prevPrice) return 'text-white';
    return currentPrice > prevPrice ? 'text-green-500' : currentPrice < prevPrice ? 'text-red-500' : 'text-white';
  };

  // 실시간 주문 금액 계산을 위한 state 추가
  const [orderAmount, setOrderAmount] = useState<number>(0);

  // 가격이나 수량이 변경될 때마다 주문 금액 업데이트
  useEffect(() => {
    const calculatedAmount = Number(price) * Number(volume);
    setOrderAmount(calculatedAmount);
  }, [price, volume]);

  useEffect(() => {
    onPriceUpdate(currentPrice ?? 0);
  }, [currentPrice, onPriceUpdate]);

  useEffect(() => {
    // 수량 변경시 부모에게 전달
    onQuantityUpdate(Number(volume));
  }, [volume, onQuantityUpdate]);

  // 수익률 계산 함수
  const calculateProfitRate = (buyPrice: number, sellPrice: number) => {
    if (buyPrice === 0) return 0;
    return ((sellPrice - buyPrice) / buyPrice) * 100;
  };

  // 매매 사이클 업데이트 함수 수정
  const updateTradeCycle = (status: string) => {
    const currentTime = new Date().toLocaleTimeString('ko-KR', { 
      hour: '2-digit', 
      minute: '2-digit', 
      second: '2-digit' 
    });
    
    setTradeCycles(prev => {
      const lastCycle = prev[0] || { cycle: [], times: [], time: currentTime };
      
      // 새로운 사이클 시작 조건 수정
      if (prev.length === 0 && status === '매수 대기') {
        // 첫 번째 사이클인 경우에만 매수 대기 상태 추가
        return [{ 
          cycle: [status], 
          times: [currentTime],
          time: currentTime 
        }];
      }
      
      // 기존 사이클 업데이트
      if (lastCycle.cycle.length < 4) {
        const updatedCycle = {
          cycle: [...lastCycle.cycle, status],
          times: [...lastCycle.times, currentTime],
          time: lastCycle.time
        };
        return [updatedCycle, ...prev.slice(1)];
      }

      return prev;
    });
  };

  // 매매 조건 체크 수정 - 상태 구독만 하도록 변경
  useEffect(() => {
    if (autoTrading && currentPrice && ma3Price) {
      const { lastTradeType, statusChangeTime } = useUpbitStore.getState().tradeState;

      // 상태가 변경될 때만 업데이트
      if (lastTradeType !== tradeState.lastTradeType) {
        setStatusChangeTime(statusChangeTime);
        if (lastTradeType === 'bid') {
          updateTradeCycle('매수');
        } else if (lastTradeType === 'ask') {
          updateTradeCycle('매도');
        } else if (!tradeCycles.length) {  // 첫 사이클인 경우에만 매수 대기 추가
          updateTradeCycle('매수 대기');
        }
      }
    }
  }, [autoTrading, currentPrice, ma3Price, tradeState.lastTradeType]);

  // 경과 시간 업데이트를 위한 useEffect 수정
  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (autoTrading) {
      // 초기 시간 설정
      if (!actionStartTime) {
        setActionStartTime(new Date());
      }
      
      // 1초마다 경과 시간 업데이트
      interval = setInterval(() => {
        if (actionStartTime) {
          const now = new Date();
          const elapsed = Math.floor((now.getTime() - actionStartTime.getTime()) / 1000);
          setElapsedTime(elapsed);
        }
      }, 1000);
    }

    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [autoTrading, actionStartTime]);

  // 경과 시간을 포맷하는 함수 추가
  const formatElapsedTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = seconds % 60;

    if (hours > 0) {
      return `${hours}시간 ${minutes}분 ${remainingSeconds}초`;
    } else if (minutes > 0) {
      return `${minutes}분 ${remainingSeconds}초`;
    } else {
      return `${remainingSeconds}초`;
    }
  };

  // 자동 거래 실행 함수 수정 - 상태 변경 로직 제거
  const handleAutomaticTrade = async (tradeSide: 'bid' | 'ask', tradePrice: number) => {
    if (isLoading) return;

    try {
      setIsLoading(true);
      
      if (mode === 'test') {
        // 거래 정보 기록만 수행
        const tradeInfo = {
          side: tradeSide,
          price: tradePrice,
          volume: volume,
          time: new Date().toLocaleTimeString('ko-KR', { 
            hour: '2-digit', 
            minute: '2-digit', 
            second: '2-digit' 
          })
        };

        if (onOrderCreated) {
          onOrderCreated();
        }
      }
    } catch (error: any) {
      console.error('자동 거래 실패:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // 자동 거래 토글 버튼 클릭 핸들러 수정
  const handleAutoTradingToggle = () => {
    if (!autoTrading) {
      const now = new Date();
      const { theoreticalPosition } = useUpbitStore.getState().tradeState;
      
      // 이미 매수 시점을 놓쳤는지 확인
      const missedFirstCycle = theoreticalPosition === 'ask' || theoreticalPosition === 'wait';
      
      updateTradeState({
        lastTradeType: null,
        statusChangeTime: now.toLocaleTimeString('ko-KR', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit'
        }),
        actionStartTime: now,
        isTrading: true,
        missedFirstCycle
      });
    } else {
      updateTradeState({
        actionStartTime: null,
        isTrading: false,
        missedFirstCycle: false
      });
    }
    setAutoTrading(!autoTrading);
  };

  // UI 수정
  const [showHistory, setShowHistory] = useState(false);

  // 매매 사이클 상태를 표시하는 함수 추가
  const getTradeStatusText = () => {
    const { lastTradeType, statusChangeTime, missedFirstCycle } = tradeState;

    if (lastTradeType === null) {
      if (missedFirstCycle) {
        return `첫 매수 시점 놓침, 다음 사이클 대기 중 (${statusChangeTime}) - ${formatElapsedTime(elapsedTime)} 경과`;
      }
      return `첫 매수 대기 중 (${statusChangeTime}) - ${formatElapsedTime(elapsedTime)} 경과`;
    } else if (lastTradeType === 'bid') {
      return `매수 완료, 매도 대기 중 (${statusChangeTime}) - ${formatElapsedTime(elapsedTime)} 경과`;
    } else {
      return `매도 완료, 다음 매수 대기 중 (${statusChangeTime}) - ${formatElapsedTime(elapsedTime)} 경과`;
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
                매수
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
                매도
              </button>
            </div>
          </div>

          {/* 주문 방식 선택 */}
          <div>
            <label className="block text-gray-400 mb-2">주문 방식</label>
            <select
              value={ordType}
              onChange={(e) => setOrdType(e.target.value as 'limit' | 'price' | 'market')}
              className="w-full px-4 py-2 bg-gray-700 text-white rounded"
            >
              <option value="limit">지정가</option>
              <option value="price">시장가(매수)</option>
              <option value="market">시장가(매도)</option>
            </select>
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
                onClick={handleMa3PriceClick}
                className="w-full px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded"
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
              최대
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
              50%
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
              25%
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
              10%
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

      {/* 자동 거래 토글 버튼과 상태 표시 부분 수정 */}
      {mode === 'test' && (
        <div className="mt-4 flex items-center gap-4">
          <button
            onClick={handleAutoTradingToggle}
            className={`px-6 py-2 rounded font-bold ${
              autoTrading 
                ? 'bg-red-600 hover:bg-red-700'
                : 'bg-gray-600 hover:bg-gray-700'
            } text-white`}
          >
            {autoTrading ? '자동 거래 중지' : '자동 거래 시작'}
          </button>

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
              {showHistory && (
                <div className="mt-2">
                  {tradeCycles.map((entry, index) => (
                    <div key={index} className="block px-3 py-1 rounded-full text-sm font-semibold bg-gray-700 text-white mb-1">
                      사이클 {index + 1}: {entry.cycle.map((status, i) => 
                        `${status} (${entry.times[i]})`
                      ).join(' -> ')}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}); 