import { useState, useEffect, useCallback } from 'react';
import { getCurrentPrice, get3SecMA } from '../../api/upbitOrder';
import { TradeCycle, TradeCycleStatus, TradeStrategy } from './types';
import { calculateMA, getTradeSignal, isBollingerBandSignal } from './utils';
import useUpbitStore from '../../store/useUpbitStore';

// 가격 정보 훅
export const usePriceInfo = (market: string, ordType: string) => {
  const [currentPrice, setCurrentPrice] = useState<number | null>(null);
  const [ma3Price, setMa3Price] = useState<number | null>(null);
  const [priceUpdateError, setPriceUpdateError] = useState<string | null>(null);
  const [priceHistory, setPriceHistory] = useState<number[]>([]);
  const [price, setPrice] = useState('');

  // 주기적으로 가격 업데이트 (1초마다)
  useEffect(() => {
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

    updatePrices();
    const interval = setInterval(updatePrices, 1000); // 1초마다 업데이트
    
    return () => clearInterval(interval);
  }, [market, ordType]);

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

  return {
    currentPrice,
    ma3Price,
    priceUpdateError,
    priceHistory,
    price,
    setPrice,
    getPriceChangeStyle
  };
};

// 자동 거래 훅
export const useAutoTrading = (
  market: string, 
  mode: 'live' | 'test', 
  currentPrice: number | null, 
  priceHistory: number[]
) => {
  const [autoTrading, setAutoTrading] = useState(false);
  const [isBacktesting, setIsBacktesting] = useState(false);
  const [tradeCycles, setTradeCycles] = useState<TradeCycle[]>([]);
  const [currentCycle, setCurrentCycle] = useState<TradeCycleStatus>('waiting_buy');
  const [elapsedTime, setElapsedTime] = useState<number>(0);
  const [actionStartTime, setActionStartTime] = useState<Date | null>(null);
  const [showHistory, setShowHistory] = useState<boolean>(false);
  const [lastSignal, setLastSignal] = useState<string>('');
  const [totalProfit, setTotalProfit] = useState<string>('0.00');

  const { tradeStrategy, updateTradeState, maPeriods, dateRange } = useUpbitStore();

  // 자동 거래 토글 핸들러
  const handleAutoTradingToggle = useCallback(() => {
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
  }, [autoTrading, updateTradeState]);

  // 백테스트 시작 핸들러
  const handleBacktestStart = useCallback((onBacktestStart?: (startDate: Date, endDate: Date) => void) => {
    if (!isBacktesting) {
      setIsBacktesting(true);
      if (onBacktestStart) {
        onBacktestStart(dateRange.startDate, dateRange.endDate || new Date());
      }
    } else {
      setIsBacktesting(false);
    }
  }, [isBacktesting, dateRange]);

  // 매매 조건 체크
  useEffect(() => {
    if ((!autoTrading && !isBacktesting) || !currentPrice) return;

    let signal = '';

    if (tradeStrategy === 'BOLLINGER' && priceHistory.length >= 20) {
      // 볼린저 밴드 전략
      const bollingerSignal = isBollingerBandSignal(priceHistory);
      if (bollingerSignal === 'buy' && currentCycle === 'waiting_buy') {
        signal = '볼린저 밴드 매수 신호: 하단 밴드 돌파';
      } else if (bollingerSignal === 'sell' && currentCycle === 'waiting_sell') {
        signal = '볼린저 밴드 매도 신호: 상단 밴드 돌파';
      }
    } else if (tradeStrategy === 'MA_CROSS' && priceHistory.length >= 60) {
      // 단순 이동평균선 교차 전략
      const ma30 = calculateMA(priceHistory, maPeriods.thirty);
      const ma40 = calculateMA(priceHistory, maPeriods.forty);
      const ma60 = calculateMA(priceHistory, maPeriods.sixty);
      
      // 30MA와 40MA의 교차
      if (ma30[ma30.length - 2] <= ma40[ma40.length - 2] && 
          ma30[ma30.length - 1] > ma40[ma40.length - 1]) {
        signal = '이동평균선 매수 신호: 30MA가 40MA 상향돌파';
      } else if (ma30[ma30.length - 2] >= ma40[ma40.length - 2] && 
                 ma30[ma30.length - 1] < ma40[ma40.length - 1]) {
        signal = '이동평균선 매도 신호: 30MA가 40MA 하향돌파';
      }
      
      // 40MA와 60MA의 교차도 확인
      if (ma40[ma40.length - 2] <= ma60[ma60.length - 2] && 
          ma40[ma40.length - 1] > ma60[ma60.length - 1]) {
        signal += '\n이동평균선 매수 신호: 40MA가 60MA 상향돌파';
      } else if (ma40[ma40.length - 2] >= ma60[ma60.length - 2] && 
                 ma40[ma40.length - 1] < ma60[ma60.length - 1]) {
        signal += '\n이동평균선 매도 신호: 40MA가 60MA 하향돌파';
      }
    } else if (tradeStrategy === 'MA_CROSS_DEVIATION' && priceHistory.length >= 120) {
      // 이격도 필터 적용 전략
      const ma40 = calculateMA(priceHistory, maPeriods.forty);  // 40일 이동평균
      const ma60 = calculateMA(priceHistory, maPeriods.sixty);  // 60일 이동평균
      const ma120 = calculateMA(priceHistory, maPeriods.oneTwenty); // 120일 이동평균
      
      // 이격도 계산: (60일 MA - 120일 MA) / 120일 MA
      const gap = Math.abs(ma60[ma60.length - 1] - ma120[ma120.length - 1]) / ma120[ma120.length - 1];
      
      if (gap >= 0.02) { // 이격도가 2% 이상일 때
        // 매수 조건: 
        // 1. 40MA와 60MA가 모두 120MA 위에 있음
        if (ma40[ma40.length - 1] > ma120[ma120.length - 1] && 
            ma60[ma60.length - 1] > ma120[ma120.length - 1]) {
          signal = `이격도 매수 신호: 이격도 ${(gap * 100).toFixed(2)}%`;
        } 
        // 매도 조건:
        // 1. 40MA와 60MA가 모두 120MA 아래에 있음
        else if (ma40[ma40.length - 1] < ma120[ma120.length - 1] && 
                 ma60[ma60.length - 1] < ma120[ma120.length - 1]) {
          signal = `이격도 매도 신호: 이격도 ${(gap * 100).toFixed(2)}%`;
        }
      }
    } else if (tradeStrategy === 'SLOPE_FILTER' && priceHistory.length >= 360) {
      // 새로운 조건 적용: getTradeSignal 함수 사용
      const priceData: number[] = priceHistory.slice(-100);
      const tradeSignal = getTradeSignal(priceData, currentPrice);

      if (tradeSignal === 'buy' && currentCycle === 'waiting_buy') {
        signal = '기울기 필터 매수 신호';
      } else if (tradeSignal === 'sell' && currentCycle === 'waiting_sell') {
        signal = '기울기 필터 매도 신호';
      }
    }

    if (signal !== lastSignal) {
      setLastSignal(signal);
      console.log(signal);
    }
  }, [autoTrading, isBacktesting, currentPrice, priceHistory, tradeStrategy, currentCycle, lastSignal, maPeriods]);

  // 경과 시간 업데이트
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

  // 총 수익률 계산 함수
  const calculateTotalProfit = useCallback((cycles: TradeCycle[] = []) => {
    if (!cycles || cycles.length === 0) return '0.00';

    const totalProfit = cycles.reduce((acc, cycle) => {
      if (cycle.profit) {
        return acc + parseFloat(cycle.profit);
      }
      return acc;
    }, 0);

    return totalProfit.toFixed(2);
  }, []);

  // 총 수익률 업데이트
  useEffect(() => {
    const profit = calculateTotalProfit(tradeCycles);
    setTotalProfit(profit);
  }, [tradeCycles, calculateTotalProfit]);

  return {
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
    handleBacktestStart,
    calculateTotalProfit
  };
};

// 주문 수량 관련 훅
export const useOrderVolume = (ma3Price: number | null, orderLimits: { minOrderPrice: number, maxOrderPrice: number }) => {
  const [volume, setVolume] = useState('');
  const [activePercent, setActivePercent] = useState(25);
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
  }, [ma3Price, orderLimits.maxOrderPrice, calculatePercentVolume]);

  // 퍼센트 버튼 핸들러
  const handlePercentage = useCallback((percent: number) => {
    setActivePercent(percent);
    if (ma3Price && orderLimits.maxOrderPrice) {
      const amount = orderLimits.maxOrderPrice * (percent / 100);
      const calculatedVolume = (amount / ma3Price).toFixed(4);
      setVolume(calculatedVolume);
    }
  }, [ma3Price, orderLimits.maxOrderPrice]);

  // 초기화 핸들러
  const handleReset = useCallback(() => {
    setVolume('');
    setActivePercent(0);
  }, []);

  return {
    volume,
    setVolume,
    activePercent,
    setActivePercent,
    orderAmount,
    setOrderAmount,
    handlePercentage,
    handleReset
  };
}; 