'use client';

import { useState, useEffect, forwardRef, useImperativeHandle } from 'react';
import { getCurrentPrice, get3SecMA } from '../api/upbitOrder';
import useUpbitStore from '../store/useUpbitStore';
import { OrderForm } from './OrderForm';
import StrategySelector from './StrategySelector';
import { TradeHistory } from './TradeHistory';
import { formatElapsedTime, calculateTotalProfit } from '../utils/formatters';
import { getTradeSignal, calculateOrderVolume } from '../utils/strategies';
import { calculateMA, calculateRelativeSlope, calculateBollingerBands } from '../utils/indicators';
import { CreateOrderProps, OrderParams, TradeCycle } from '../types/trading';
import strategies from '../strategies';
import { Time } from 'lightweight-charts';

export const CreateOrder = forwardRef<
  { handleAutomaticTrade: (params: OrderParams) => Promise<void> },
  CreateOrderProps
>(({ market, mode, onOrderCreated, onPriceUpdate, onQuantityUpdate, onBacktestStart, onBacktestEnd }, ref) => {
  const {
    tradeState,
    updateTradeState,
    createOrder,
    orderLimits,
    tradeStrategy,
    updateTradeStrategy,
    dateRange,
    maPeriods
  } = useUpbitStore();
  
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
  const [tradeCycles, setTradeCycles] = useState<TradeCycle[]>([]);
  const [elapsedTime, setElapsedTime] = useState<number>(0);
  const [actionStartTime, setActionStartTime] = useState<Date | null>(null);
  const [showHistory, setShowHistory] = useState<boolean>(false);
  const [currentCycle, setCurrentCycle] = useState<'waiting_buy' | 'waiting_sell' | 'trading' | 'complete'>('waiting_buy');
  const [totalProfit, setTotalProfit] = useState<string>('0.00');
  
  // 백테스트 관련 상태
  const [isBacktesting, setIsBacktesting] = useState(false);
  
  // 매매 전략 상태 표시 추가
  const [currentStrategy] = useState<string>('');
  const [lastSignal, setLastSignal] = useState<string>('');

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
    } catch (error: Error | unknown) {
      setError(error instanceof Error ? error.message : 'Unknown error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  // 주기적으로 가격 업데이트 (1초마다)
  useEffect(() => {
    // 가격 정보 업데이트 함수를 내부로 이동
    const updatePricesInEffect = async () => {
      try {
        setPriceUpdateError(null);
        const [current, ma3] = await Promise.all([
          getCurrentPrice(market),
          get3SecMA(market)
        ]);
        setCurrentPrice(current);
        setMa3Price(ma3);

        // 가격 히스토리 업데이트
        setPriceHistory(prev => [...prev, current].slice(-300)); // 최근 300개 가격만 유지

        // 지정가 주문이 아닐 때는 현재가로 자동 업데이트
        if (ordType !== 'limit' && current) {
          setPrice(current.toString());
        }
      } catch (error: unknown) {
        setPriceUpdateError('가격 정보 업데이트 실패');
        console.error('가격 업데이트 중 오류:', error);
      }
    };

    updatePricesInEffect();
    const interval = setInterval(updatePricesInEffect, 1000); // 1초마다 업데이트
    
    return () => clearInterval(interval);
  }, [market, ordType]); // updatePrices 의존성 제거

  // 주문 방식이 변경될 때 가격 자동 설정
  useEffect(() => {
    if (ordType !== 'limit' && currentPrice) {
      setPrice(currentPrice.toString());
    }
  }, [ordType, currentPrice]);

  useEffect(() => {
    onPriceUpdate(currentPrice ?? 0);
  }, [currentPrice, onPriceUpdate]);

  useEffect(() => {
    // 수량 변경시 부모에게 전달
    onQuantityUpdate(Number(volume));
  }, [volume, onQuantityUpdate]);

  // 매매 조건 체크 부분 수정
  useEffect(() => {
    if ((!autoTrading && !isBacktesting) || !currentPrice) return;

    const handleTradeSignal = async () => {
      try {
        // 현재 전략에서 신호 가져오기
        const strategy = strategies[tradeStrategy];
        if (!strategy || !priceHistory.length) return;

        // 전략 분석 실행
        const result = strategy.analyze(
          priceHistory.map(price => ({
            time: Math.floor(Date.now() / 1000) as Time,
            open: price,
            high: price,
            low: price,
            close: price
          })),
          {
            realtime: true,
            currentPosition: currentCycle === 'waiting_sell' ? 'buy' : null
          }
        );

        // 마지막 신호 확인
        const lastSignal = result.signals[result.signals.length - 1];
        if (!lastSignal) return;

        // 매수 신호 처리
        if (currentCycle === 'waiting_buy' && lastSignal.position === 'buy') {
          console.log('매수 신호 감지:', lastSignal);
          await createOrder({
            market: market,
            side: 'bid',
            volume: calculateOrderVolume(currentPrice),
            price: currentPrice.toString(),
            ord_type: 'limit',
            mode: mode === 'test' ? 'test' : 'live-auto'
          });
          setCurrentCycle('waiting_sell');
          console.log('매수 주문 실행 완료');
        }
        // 매도 신호 처리
        else if (currentCycle === 'waiting_sell' && lastSignal.position === 'sell') {
          console.log('매도 신호 감지:', lastSignal);
          await createOrder({
            market: market,
            side: 'ask',
            volume: calculateOrderVolume(currentPrice),
            price: currentPrice.toString(),
            ord_type: 'limit',
            mode: mode === 'test' ? 'test' : 'live-auto'
          });
          setCurrentCycle('waiting_buy');
          console.log('매도 주문 실행 완료');
        }
      } catch (error) {
        console.error('거래 신호 처리 중 오류 발생:', error);
      }
    };

    // 거래 신호 처리 실행
    handleTradeSignal();
  }, [autoTrading, isBacktesting, currentPrice, priceHistory, tradeStrategy, currentCycle, market, mode, createOrder]);

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

  // 자동 거래 실행 함수 수정
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
        const ma60 = calculateMA(priceHistory, maPeriods.sixty);
        const ma360 = calculateMA(priceHistory, maPeriods.threeHundredSixty);

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

  // 자동 거래 토글 버튼 클릭 핸들러 수정
  const handleAutoTradingToggle = () => {
    if (!autoTrading) {
      const now = new Date();
      setElapsedTime(0); // 자동 거래 시작 시 경과 시간 리셋
      setCurrentCycle('waiting_buy'); // 항상 매수 대기로 시작
      setTradeCycles([]); // 거래 사이클 초기화
      
      updateTradeState({
        lastTradeType: null,
        statusChangeTime: now.toLocaleTimeString('ko-KR', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit'
        }),
        actionStartTime: now,
        isTrading: true,
        missedFirstCycle: false
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

  // 매매 사이클 상태를 표시하는 함수 추가
  const getTradeStatusText = () => {
    if (currentCycle === 'waiting_buy') {
      return `매수 대기 중 - ${formatElapsedTime(elapsedTime)} 경과`;
    } else if (currentCycle === 'waiting_sell') {
      return `매도 대기 중 - ${formatElapsedTime(elapsedTime)} 경과`;
    } else {
      return `거래 완료 - ${formatElapsedTime(elapsedTime)} 경과`;
    }
  };

  // ref로 handleAutomaticTrade 함수 노출
  useImperativeHandle(ref, () => ({
    handleAutomaticTrade: handleAutomaticTrade
  }));

  // 총 수익률 업데이트 useEffect 추가
  useEffect(() => {
    const profit = calculateTotalProfit(tradeCycles);
    setTotalProfit(profit);
  }, [tradeCycles]);

  // 전략 변경 핸들러 수정
  const handleStrategyChange = (strategy: any) => {
    updateTradeStrategy(strategy);
  };

  // 백테스트 시작 함수
  const handleBacktestStart = async () => {
    if (!isBacktesting) {
      setIsBacktesting(true);
      if (onBacktestStart) {
        onBacktestStart(dateRange.startDate, dateRange.endDate || new Date());
      }
    } else {
      setIsBacktesting(false);
      if (onBacktestEnd) {
        onBacktestEnd();
      }
    }
  };

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
      
      <OrderForm
        market={market}
        side={side}
        setSide={setSide}
        volume={volume}
        setVolume={setVolume}
        price={price}
        setPrice={setPrice}
        ordType={ordType}
        setOrdType={setOrdType}
        isLoading={isLoading}
        error={error}
        currentPrice={currentPrice}
        ma3Price={ma3Price}
        priceUpdateError={priceUpdateError}
        priceHistory={priceHistory}
        orderLimits={orderLimits}
        handleSubmit={handleSubmit}
      />

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
                <TradeHistory cycles={tradeCycles} />
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
        <div className="text-white font-bold">{currentStrategy}</div>
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