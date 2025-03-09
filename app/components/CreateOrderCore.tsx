'use client';

import { useState, useEffect, forwardRef, useImperativeHandle, useCallback } from 'react';
import { createOrder, getCurrentPrice, get3SecMA } from '../api/upbitOrder';
import useUpbitStore from '../store/useUpbitStore';
import { CreateOrderProps, OrderParams, TradeCycle, TradeStrategy } from './OrderTypes';
import { calculateMA, calculateRelativeSlope } from './TradingUtils';
import { getTradeSignal, calculateOrderVolume } from './TradingStrategies';
import { formatElapsedTime, checkTradingConditions, updateTradeCycle, getTradeStatusText, calculateTotalProfit } from './AutoTrading';
import { runBacktest, summarizeBacktestResult } from './BacktestingLogic';

export const CreateOrder = forwardRef<
  { handleAutomaticTrade: (params: OrderParams) => Promise<void> },
  CreateOrderProps
>(({ market, mode, onOrderCreated, onPriceUpdate, onQuantityUpdate, onBacktestStart, onBacktestEnd }, ref) => {
  const {
    tradeState,
    updateTradeState,
    createOrder: storeCreateOrder,
    orderLimits,
    tradeStrategy,
    updateTradeStrategy,
    dateRange,
    maPeriods
  } = useUpbitStore();
  
  // 주문 상태
  const [side, setSide] = useState<'bid' | 'ask'>('bid');
  const [volume, setVolume] = useState('');
  const [price, setPrice] = useState('');
  const [ordType, setOrdType] = useState<'limit' | 'price' | 'market'>('limit');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // 가격 정보
  const [currentPrice, setCurrentPrice] = useState<number | null>(null);
  const [ma3Price, setMa3Price] = useState<number | null>(null);
  const [priceUpdateError, setPriceUpdateError] = useState<string | null>(null);
  const [priceHistory, setPriceHistory] = useState<number[]>([]);
  
  // 자동 거래 상태
  const [autoTrading, setAutoTrading] = useState(false);
  const [tradeCycles, setTradeCycles] = useState<TradeCycle[]>([]);
  const [elapsedTime, setElapsedTime] = useState<number>(0);
  const [actionStartTime, setActionStartTime] = useState<Date | null>(null);
  const [showHistory, setShowHistory] = useState<boolean>(false);
  const [currentCycle, setCurrentCycle] = useState<'waiting_buy' | 'waiting_sell' | 'trading' | 'complete'>('waiting_buy');
  
  // 백테스트 상태
  const [isBacktesting, setIsBacktesting] = useState(false);
  const [backtestResults, setBacktestResults] = useState<any>(null);
  
  // 주문 제출 핸들러
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (isLoading) return;
    
    try {
      setIsLoading(true);
      setError(null);
      
      // 주문 파라미터 생성
      const params: OrderParams = {
        market,
        side,
        volume,
        price,
        ord_type: ordType,
        mode
      };
      
      // 주문 생성
      await handleOrder(params);
      
      // 폼 초기화
      if (ordType === 'limit') {
        setVolume('');
      }
      
      if (onOrderCreated) {
        onOrderCreated();
      }
    } catch (error: any) {
      console.error('주문 생성 오류:', error);
      setError(error.message || '주문 생성 중 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  };
  
  // 주문 처리 함수
  const handleOrder = async (params: OrderParams) => {
    try {
      const result = await createOrder(params);
      console.log('주문 결과:', result);
      return result;
    } catch (error) {
      console.error('주문 처리 오류:', error);
      throw error;
    }
  };
  
  // 자동 거래 함수
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

        // 거래 조건 확인
        const { shouldProceed, slopes, reason } = checkTradingConditions(
          params,
          currentPrice,
          priceHistory,
          { sixty: maPeriods.sixty, threeHundredSixty: maPeriods.threeHundredSixty },
          currentCycle
        );

        if (!shouldProceed) {
          console.log('거래 조건 불충족:', reason);
          return;
        }

        // 거래 사이클 업데이트
        const updatedCycles = updateTradeCycle(tradeCycles, params, currentCycle, slopes);
        setTradeCycles(updatedCycles);

        // 사이클 상태 업데이트
        if (params.side === 'bid') {
          setCurrentCycle('waiting_sell');
        } else if (params.side === 'ask') {
          setCurrentCycle('waiting_buy');
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
  
  // 자동 거래 토글
  const handleAutoTradingToggle = () => {
    if (!autoTrading) {
      const now = new Date();
      setElapsedTime(0);
      setCurrentCycle('waiting_buy');
      setTradeCycles([]);
      
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
  
  // 백테스트 시작
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
  
  // 전략 변경 핸들러
  const handleStrategyChange = (strategy: TradeStrategy) => {
    updateTradeStrategy(strategy);
  };
  
  // 퍼센트 버튼 핸들러
  const handlePercentage = (percent: number) => {
    if (!currentPrice) return;
    
    const calculatedVolume = calculateOrderVolume(currentPrice);
    const percentVolume = (parseFloat(calculatedVolume) * percent / 100).toFixed(4);
    setVolume(percentVolume);
    
    if (onQuantityUpdate) {
      onQuantityUpdate(parseFloat(percentVolume));
    }
  };
  
  // 폼 초기화
  const handleReset = () => {
    setVolume('');
    setPrice('');
    setError(null);
  };
  
  // 가격 정보 업데이트
  useEffect(() => {
    const updatePrices = async () => {
      try {
        // 현재 가격 가져오기
        const price = await getCurrentPrice(market);
        setCurrentPrice(price);
        
        if (onPriceUpdate) {
          onPriceUpdate(price);
        }
        
        // 가격 히스토리 업데이트
        setPriceHistory(prev => {
          const newHistory = [...prev, price];
          // 최대 1000개 데이터 유지
          return newHistory.slice(-1000);
        });
        
        // 3초 이동평균 가져오기
        const ma3 = await get3SecMA(market);
        setMa3Price(ma3);
        
        setPriceUpdateError(null);
      } catch (error) {
        console.error('가격 업데이트 오류:', error);
        setPriceUpdateError('가격 정보를 가져오는 중 오류가 발생했습니다.');
      }
    };
    
    // 초기 업데이트
    updatePrices();
    
    // 1초마다 업데이트
    const intervalId = setInterval(updatePrices, 1000);
    
    return () => clearInterval(intervalId);
  }, [market, onPriceUpdate]);
  
  // 자동 거래 타이머
  useEffect(() => {
    if (!autoTrading) return;
    
    const intervalId = setInterval(() => {
      setElapsedTime(prev => prev + 1);
      
      // 자동 거래 로직
      if (currentPrice && priceHistory.length > 0) {
        const signal = getTradeSignal(priceHistory, currentPrice);
        
        if (signal === 'buy' && currentCycle === 'waiting_buy') {
          // 매수 신호
          const params: OrderParams = {
            market,
            side: 'bid',
            volume: calculateOrderVolume(currentPrice),
            price: currentPrice.toString(),
            ord_type: 'limit',
            mode
          };
          
          handleAutomaticTrade(params);
        } else if (signal === 'sell' && currentCycle === 'waiting_sell') {
          // 매도 신호
          const lastCycle = tradeCycles[tradeCycles.length - 1];
          if (lastCycle && lastCycle.buyPrice) {
            const params: OrderParams = {
              market,
              side: 'ask',
              volume: calculateOrderVolume(lastCycle.buyPrice),
              price: currentPrice.toString(),
              ord_type: 'limit',
              mode
            };
            
            handleAutomaticTrade(params);
          }
        }
      }
    }, 1000);
    
    return () => clearInterval(intervalId);
  }, [autoTrading, currentCycle, currentPrice, priceHistory, market, mode, tradeCycles]);
  
  // 컴포넌트 참조 노출
  useImperativeHandle(ref, () => ({
    handleAutomaticTrade
  }));
  
  // 가격 변화 스타일 계산
  const getPriceChangeStyle = (currentPrice: number, prevPrice: number | null) => {
    if (!prevPrice) return 'text-white';
    return currentPrice > prevPrice ? 'text-green-500' : currentPrice < prevPrice ? 'text-red-500' : 'text-white';
  };
  
  // 거래 상태 텍스트
  const tradeStatusText = getTradeStatusText(
    tradeState.isTrading,
    currentCycle,
    tradeState.lastTradeType,
    tradeState.statusChangeTime
  );
  
  // 총 수익 계산
  const { totalProfit, totalProfitAmount, successCount, failCount } = calculateTotalProfit(tradeCycles);
  
  // 거래 내역 렌더링
  const renderTradeHistory = (cycles: TradeCycle[]) => (
    <div className="mt-4 bg-gray-800 p-4 rounded-lg">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-bold text-white">거래 내역</h3>
        <button
          onClick={() => setShowHistory(!showHistory)}
          className="text-blue-400 hover:text-blue-300"
        >
          {showHistory ? '접기' : '펼치기'}
        </button>
      </div>
      
      {showHistory && (
        <div className="overflow-x-auto">
          <table className="min-w-full bg-gray-900 text-white">
            <thead>
              <tr>
                <th className="px-4 py-2 border-b border-gray-700">시간</th>
                <th className="px-4 py-2 border-b border-gray-700">매수가</th>
                <th className="px-4 py-2 border-b border-gray-700">매도가</th>
                <th className="px-4 py-2 border-b border-gray-700">수익률</th>
                <th className="px-4 py-2 border-b border-gray-700">수익금</th>
                <th className="px-4 py-2 border-b border-gray-700">MA60 기울기</th>
                <th className="px-4 py-2 border-b border-gray-700">MA360 기울기</th>
              </tr>
            </thead>
            <tbody>
              {cycles.map((cycle, index) => (
                <tr key={index} className="hover:bg-gray-800">
                  <td className="px-4 py-2 border-b border-gray-700">{cycle.time}</td>
                  <td className="px-4 py-2 border-b border-gray-700">{cycle.buyPrice?.toLocaleString()}</td>
                  <td className="px-4 py-2 border-b border-gray-700">{cycle.sellPrice?.toLocaleString() || '-'}</td>
                  <td className={`px-4 py-2 border-b border-gray-700 ${
                    cycle.profit && parseFloat(cycle.profit) > 0 
                      ? 'text-green-500' 
                      : cycle.profit && parseFloat(cycle.profit) < 0 
                        ? 'text-red-500' 
                        : ''
                  }`}>
                    {cycle.profit || '-'}
                  </td>
                  <td className={`px-4 py-2 border-b border-gray-700 ${
                    cycle.profitAmount && parseFloat(cycle.profitAmount) > 0 
                      ? 'text-green-500' 
                      : cycle.profitAmount && parseFloat(cycle.profitAmount) < 0 
                        ? 'text-red-500' 
                        : ''
                  }`}>
                    {cycle.profitAmount ? `${parseInt(cycle.profitAmount).toLocaleString()}원` : '-'}
                  </td>
                  <td className="px-4 py-2 border-b border-gray-700">
                    {cycle.slopes?.ma60.toFixed(4)}%
                  </td>
                  <td className="px-4 py-2 border-b border-gray-700">
                    {cycle.slopes?.ma360.toFixed(4)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      
      <div className="mt-4 grid grid-cols-2 gap-4">
        <div className="bg-gray-700 p-3 rounded-lg">
          <p className="text-gray-400">총 수익률</p>
          <p className={`text-xl font-bold ${
            parseFloat(totalProfit) > 0 
              ? 'text-green-500' 
              : parseFloat(totalProfit) < 0 
                ? 'text-red-500' 
                : 'text-white'
          }`}>
            {totalProfit}
          </p>
        </div>
        <div className="bg-gray-700 p-3 rounded-lg">
          <p className="text-gray-400">총 수익금</p>
          <p className={`text-xl font-bold ${
            parseFloat(totalProfitAmount) > 0 
              ? 'text-green-500' 
              : parseFloat(totalProfitAmount) < 0 
                ? 'text-red-500' 
                : 'text-white'
          }`}>
            {parseInt(totalProfitAmount).toLocaleString()}원
          </p>
        </div>
        <div className="bg-gray-700 p-3 rounded-lg">
          <p className="text-gray-400">성공/실패</p>
          <p className="text-xl font-bold text-white">
            <span className="text-green-500">{successCount}</span> / <span className="text-red-500">{failCount}</span>
          </p>
        </div>
        <div className="bg-gray-700 p-3 rounded-lg">
          <p className="text-gray-400">경과 시간</p>
          <p className="text-xl font-bold text-white">
            {formatElapsedTime(elapsedTime)}
          </p>
        </div>
      </div>
    </div>
  );
  
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
        {/* 주문 폼 UI */}
        {/* 여기에 주문 폼 UI 구현 */}
        
        {/* 자동 거래 섹션 */}
        <div className="mt-6 border-t border-gray-700 pt-4">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-bold text-white">자동 거래</h3>
            <div className="flex items-center gap-2">
              <select
                value={tradeStrategy}
                onChange={(e) => handleStrategyChange(e.target.value as TradeStrategy)}
                className="bg-gray-700 text-white px-3 py-2 rounded-lg"
              >
                <option value="BOLLINGER">볼린저 밴드</option>
                <option value="MA_CROSS">이동평균 교차</option>
                <option value="MA_CROSS_DEVIATION">이동평균 교차 + 이탈</option>
                <option value="SLOPE_FILTER">기울기 필터</option>
              </select>
              <button
                type="button"
                onClick={handleAutoTradingToggle}
                className={`px-4 py-2 rounded-lg ${
                  autoTrading ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'
                } text-white`}
              >
                {autoTrading ? '자동 거래 중지' : '자동 거래 시작'}
              </button>
              <button
                type="button"
                onClick={handleBacktestStart}
                className={`px-4 py-2 rounded-lg ${
                  isBacktesting ? 'bg-red-600 hover:bg-red-700' : 'bg-purple-600 hover:bg-purple-700'
                } text-white`}
              >
                {isBacktesting ? '백테스트 중지' : '백테스트 시작'}
              </button>
            </div>
          </div>
          
          <div className="bg-gray-700 p-3 rounded-lg mb-4">
            <p className="text-gray-400">상태</p>
            <p className="text-lg font-bold text-white">{tradeStatusText}</p>
          </div>
          
          {/* 거래 내역 */}
          {tradeCycles.length > 0 && renderTradeHistory(tradeCycles)}
          
          {/* 백테스트 결과 */}
          {backtestResults && (
            <div className="mt-4 bg-gray-800 p-4 rounded-lg">
              <h3 className="text-lg font-bold text-white mb-2">백테스트 결과</h3>
              <pre className="text-white whitespace-pre-wrap">{summarizeBacktestResult(backtestResults)}</pre>
            </div>
          )}
        </div>
      </form>
    </div>
  );
});

export default CreateOrder; 