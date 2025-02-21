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

// 파라미터 타입 정의
interface OrderParams {
  market: string;
  side: 'bid' | 'ask';
  volume: string;
  price: string;
  ord_type: string;
  mode: string;
}

// Define the type for a trade cycle entry
interface TradeCycle {
  cycle: string[];
  times: string[];
  time: string;
  buyPrice: number | null;
  sellPrice: number | null;
  profit: string | null;
  profitAmount: string | null;
}

// 매매 전략 타입 정의 추가
type TradeStrategy = 'BOLLINGER' | 'MA_CROSS' | 'MA_CROSS_DEVIATION' | 'SLOPE_FILTER';

export const CreateOrder = forwardRef<
  { handleAutomaticTrade: (params: OrderParams) => Promise<void> },
  CreateOrderProps
>(({ market, mode, onOrderCreated, onPriceUpdate, onQuantityUpdate }, ref) => {
  const { tradeState, updateTradeState, maPeriods } = useUpbitStore();
  
  // 로컬 스토리지에서 마지막 전략 불러오기
  const savedStrategy = localStorage.getItem('lastTradeStrategy') as TradeStrategy || 'BOLLINGER';
  const [tradeStrategy, setTradeStrategy] = useState<TradeStrategy>(savedStrategy);

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
  const [tradeCycles, setTradeCycles] = useState<{ cycle: string[], times: string[], time: string, buyPrice: number | null, sellPrice: number | null, profit: string | null, profitAmount: string | null }[]>([]);
  const [elapsedTime, setElapsedTime] = useState<number>(0);
  const [actionStartTime, setActionStartTime] = useState<Date | null>(null);
  const [showHistory, setShowHistory] = useState<boolean>(false);
  const [currentCycle, setCurrentCycle] = useState<'waiting_buy' | 'waiting_sell' | 'trading' | 'complete'>('waiting_buy');
  const [totalProfit, setTotalProfit] = useState<string>('0.00');

  // 볼린저 밴드 계산을 위한 상태 추가
  const [upperBand, setUpperBand] = useState<number | null>(null);
  const [lowerBand, setLowerBand] = useState<number | null>(null);
  const [basis, setBasis] = useState<number | null>(null);

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
      const lastCycle = prev[0] || { cycle: [], times: [], time: currentTime, buyPrice: null, sellPrice: null, profit: null, profitAmount: null };
      
      // 새로운 사이클 시작 조건 수정
      if (prev.length === 0 && status === '매수 대기') {
        // 첫 번째 사이클인 경우에만 매수 대기 상태 추가
        return [{ 
          cycle: [status], 
          times: [currentTime],
          time: currentTime,
          buyPrice: null,
          sellPrice: null,
          profit: null,
          profitAmount: null
        }];
      }
      
      // 기존 사이클 업데이트
      if (lastCycle.cycle.length < 4) {
        const updatedCycle = {
          cycle: [...lastCycle.cycle, status],
          times: [...lastCycle.times, currentTime],
          time: lastCycle.time,
          buyPrice: lastCycle.buyPrice,
          sellPrice: lastCycle.sellPrice,
          profit: lastCycle.profit,
          profitAmount: lastCycle.profitAmount
        };
        return [updatedCycle, ...prev.slice(1)];
      }

      return prev;
    });
  };

  // 볼린저 밴드 계산 함수
  const calculateBollingerBands = (prices: number[], period: number = 20, multiplier: number = 2) => {
    if (prices.length < period) return null;

    const sma = prices.slice(-period).reduce((a, b) => a + b) / period;
    const squaredDiffs = prices.slice(-period).map(p => Math.pow(p - sma, 2));
    const standardDeviation = Math.sqrt(squaredDiffs.reduce((a, b) => a + b) / period);
    
    return {
      upper: sma + (standardDeviation * multiplier),
      lower: sma - (standardDeviation * multiplier),
      middle: sma
    };
  };

  // 매매 전략 상태 표시 추가
  const [currentStrategy, setCurrentStrategy] = useState<string>('');
  const [lastSignal, setLastSignal] = useState<string>('');

  // 매매 조건 체크 부분 수정
  useEffect(() => {
    if (!autoTrading || !currentPrice) return;

    let signal = '';
    let inPosition = false;

    if (tradeStrategy === 'BOLLINGER' && priceHistory.length >= 20) {
      // 볼린저 밴드 전략
      const bands = calculateBollingerBands(priceHistory);
      if (bands) {
        if (currentPrice > bands.upper && currentCycle === 'waiting_buy') {
          signal = '볼린저 밴드 매수 신호: 상단 밴드 돌파';
        } else if (currentPrice < bands.lower && currentCycle === 'waiting_sell') {
          signal = '볼린저 밴드 매도 신호: 하단 밴드 도달';
        }
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
    } else if (tradeStrategy === 'SLOPE_FILTER' && priceHistory.length >= 120) {
      // 기울기 필터 이동평균선 전략
      const ma40 = calculateMA(priceHistory, maPeriods.forty);
      const ma60 = calculateMA(priceHistory, maPeriods.sixty);
      const ma120 = calculateMA(priceHistory, maPeriods.oneTwenty);

      const slope40 = ma40[ma40.length - 1] - ma40[ma40.length - 2];
      const slope60 = ma60[ma60.length - 1] - ma60[ma60.length - 2];

      const currentPrice = priceHistory[priceHistory.length - 1];

      // 임계치 설정
      const sellThreshold = -0.005;
      const buyThreshold = 0.005;
      const strongSellThreshold = -0.01; // 강한 매도 임계치
      const strongBuyThreshold = 0.01;   // 강한 매수 임계치

      if (inPosition) {
        // 포지션 보유 중인 경우
        if (currentPrice < ma120[ma120.length - 1]) {
          // 120MA 아래: 약세 영역
          if (slope40 < strongSellThreshold && slope60 < strongSellThreshold) {
            signal = '기울기 필터 매도 신호';
            inPosition = false;
          } else {
            signal = '기울기 필터 보유';
          }
        } else {
          signal = '기울기 필터 보유';
        }
      } else {
        // 포지션 미보유 상태인 경우
        if (currentPrice < ma120[ma120.length - 1]) {
          // 120MA 아래: 약세 영역
          if (slope40 > strongBuyThreshold && slope60 > strongBuyThreshold) {
            signal = '기울기 필터 매수 신호';
            inPosition = true;
          } else {
            signal = '기울기 필터 보유';
          }
        } else {
          signal = '기울기 필터 보유';
        }
      }
    }

    if (signal !== lastSignal) {
      setLastSignal(signal);
      console.log(signal); // 콘솔에 신호 출력
    }

    setCurrentStrategy(`현재 전략: ${tradeStrategy}`);
  }, [autoTrading, currentPrice, priceHistory, tradeStrategy]);

  // 이동평균 계산 함수 추가
  const calculateMA = (prices: number[], period: number) => {
    const result: number[] = [];
    for (let i = period - 1; i < prices.length; i++) {
      const sum = prices.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0);
      result.push(sum / period);
    }
    return result;
  };

  // 가격 히스토리 업데이트
  useEffect(() => {
    if (currentPrice) {
      setPriceHistory(prev => [...prev, currentPrice].slice(-100)); // 최근 100개 가격만 유지
    }
  }, [currentPrice]);

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

        // 현재 상태에 따른 주문 실행 조건 체크
        if (params.side === 'bid' && currentCycle === 'waiting_buy') {
          // 매수는 매수 대기 상태일 때만 실행
      console.log(' test bid 자동 거래 시작:', { params, currentCycle });

          console.log('매수 신호 감지 - 상태 업데이트');
          setCurrentCycle('waiting_sell');
          setElapsedTime(0);
          
          const buyPrice = parseFloat(params.price);
          if (isNaN(buyPrice)) {
            console.error('Invalid buy price:', params.price);
            return;
          }

          const fixedBuyAmount = 10000; // 매수 금액을 10,000원으로 고정
          const volume = (fixedBuyAmount / buyPrice).toFixed(4); // 매수 수량 계산

          setTradeCycles(prev => {
            const newCycle = {
              cycle: ['매수'],
              times: [now],
              time: now,
              buyPrice: buyPrice, // 매수 가격 기록
              sellPrice: null, // 초기 청산 가격은 null
              profit: null, // 초기 수익률은 null
              profitAmount: null // 초기 수익 금액은 null
            };
            return [...prev, newCycle];
          });

          updateTradeState({
            lastTradeType: 'bid',
            statusChangeTime: now,
            isTrading: true
          });
        } else if (params.side === 'ask' && currentCycle === 'waiting_sell') {
          // 매도는 매도 대기 상태일 때만 실행
      console.log(' test ask 자동 거래 시작:', { params, currentCycle });

          console.log('매도 신호 감지 - 상태 업데이트');
          setCurrentCycle('waiting_buy');
          setElapsedTime(0);

          setTradeCycles(prev => {
            const lastCycle = prev[prev.length - 1];
            if (lastCycle && lastCycle.cycle.length === 1 && lastCycle.buyPrice !== null) {
              const sellPrice = parseFloat(params.price);
              if (isNaN(sellPrice)) {
                console.error('Invalid sell price:', params.price);
                return prev;
              }

              const profit = ((sellPrice - lastCycle.buyPrice) / lastCycle.buyPrice) * 100; // 수익률 계산
              const profitAmount = (sellPrice - lastCycle.buyPrice) * parseFloat(volume); // 수익 금액 계산

              const updatedCycle = {
                ...lastCycle,
                cycle: [...lastCycle.cycle, '매도'],
                times: [...lastCycle.times, now],
                sellPrice: sellPrice, // 청산 가격 기록
                profit: profit.toFixed(2), // 수익률 기록
                profitAmount: profitAmount.toFixed(2) // 수익 금액 기록
              };
              return [...prev.slice(0, -1), updatedCycle];
            }
            return prev;
          });

          updateTradeState({
            lastTradeType: 'ask',
            statusChangeTime: now,
            isTrading: true
          });
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

  // 총 수익률 계산 함수 추가
  const calculateTotalProfit = (cycles: { profit: string | null }[] = []) => {
    if (!cycles || cycles.length === 0) return '0.00';

    const totalProfit = cycles.reduce((acc, cycle) => {
      if (cycle.profit) {
        return acc + parseFloat(cycle.profit);
      }
      return acc;
    }, 0);

    return totalProfit.toFixed(2);
  };

  // 총 수익률 업데이트 useEffect 추가
  useEffect(() => {
    const profit = calculateTotalProfit(tradeCycles);
    setTotalProfit(profit);
  }, [tradeCycles]);

  // 사이클 정보 표시 수정
  const renderTradeHistory = (cycles: TradeCycle[]) => (
    <div className="overflow-x-auto mt-2">
      <table className="min-w-full text-white">
        <thead>
          <tr className="text-gray-400">
            <th className="px-4 py-2">진입 시간</th>
            <th className="px-4 py-2">청산 시간</th>
            <th className="px-4 py-2">진입 가격 (3MA)</th>
            <th className="px-4 py-2">매수 가격</th>
            <th className="px-4 py-2">청산 가격 (3MA)</th>
            <th className="px-4 py-2">매도 가격</th>
            <th className="px-4 py-2">수익률</th>
            <th className="px-4 py-2">100만원 투자시 수익</th>
            <th className="px-4 py-2">체결 상태</th>
            <th className="px-4 py-2">거래 모드</th>
          </tr>
        </thead>
        <tbody>
          {cycles.map((entry, index) => {
            const profitAmount = entry.profitAmount ? parseFloat(entry.profitAmount) * (1000000 / 10000) : 0;
            
            return (
              <tr key={index} className="border-t border-gray-700">
                <td className="px-4 py-2">{entry.times[0]}</td>
                <td className="px-4 py-2">{entry.times[1] || '-'}</td>
                <td className="px-4 py-2">{entry.buyPrice?.toFixed(3) || 'N/A'}</td>
                <td className="px-4 py-2">{entry.buyPrice?.toFixed(3) || 'N/A'}</td>
                <td className="px-4 py-2">{entry.sellPrice?.toFixed(3) || 'N/A'}</td>
                <td className="px-4 py-2">{entry.sellPrice?.toFixed(3) || 'N/A'}</td>
                <td className={`px-4 py-2 ${entry.profit && parseFloat(entry.profit) >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                  {entry.profit ? `${entry.profit}%` : 'N/A'}
                </td>
                <td className={`px-4 py-2 ${profitAmount >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                  {profitAmount ? `${profitAmount.toLocaleString()}원` : 'N/A'}
                </td>
                <td className="px-4 py-2">
                  {entry.times[1] ? '체결완료' : '미체결'}
                </td>
                <td className="px-4 py-2">
                  <span className="px-2 py-1 rounded-full text-xs font-semibold bg-blue-500 text-white">
                    테스트
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );

  // 전략 변경 시 로컬 스토리지에 저장
  const handleStrategyChange = (strategy: TradeStrategy) => {
    setTradeStrategy(strategy);
    localStorage.setItem('lastTradeStrategy', strategy);
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

          {/* 매매 전략 선택 버튼 수정 */}
          <div className="flex gap-2">
            <button
              onClick={() => handleStrategyChange('BOLLINGER')}
              disabled={autoTrading}
              className={`px-4 py-2 rounded font-bold ${
                tradeStrategy === 'BOLLINGER'
                  ? 'bg-blue-600 ring-2 ring-white'
                  : autoTrading
                    ? 'bg-gray-500 cursor-not-allowed opacity-50'
                    : 'bg-gray-600 hover:bg-gray-700'
              } text-white transition-all duration-200`}
            >
              {tradeStrategy === 'BOLLINGER' ? '✓ 볼린저 밴드' : '볼린저 밴드'}
            </button>
            <button
              onClick={() => handleStrategyChange('MA_CROSS')}
              disabled={autoTrading}
              className={`px-4 py-2 rounded font-bold ${
                tradeStrategy === 'MA_CROSS'
                  ? 'bg-blue-600 ring-2 ring-white'
                  : autoTrading
                    ? 'bg-gray-500 cursor-not-allowed opacity-50'
                    : 'bg-gray-600 hover:bg-gray-700'
              } text-white transition-all duration-200`}
            >
              {tradeStrategy === 'MA_CROSS' ? '✓ 이동평균선 교차' : '이동평균선 교차'}
            </button>
            <button
              onClick={() => handleStrategyChange('MA_CROSS_DEVIATION')}
              disabled={autoTrading}
              className={`px-4 py-2 rounded font-bold ${
                tradeStrategy === 'MA_CROSS_DEVIATION'
                  ? 'bg-blue-600 ring-2 ring-white'
                  : autoTrading
                    ? 'bg-gray-500 cursor-not-allowed opacity-50'
                    : 'bg-gray-600 hover:bg-gray-700'
              } text-white transition-all duration-200`}
            >
              {tradeStrategy === 'MA_CROSS_DEVIATION' ? '✓ 이격도 MA 교차' : '이격도 MA 교차'}
            </button>
            <button
              onClick={() => handleStrategyChange('SLOPE_FILTER')}
              disabled={autoTrading}
              className={`px-4 py-2 rounded font-bold ${
                tradeStrategy === 'SLOPE_FILTER'
                  ? 'bg-blue-600 ring-2 ring-white'
                  : autoTrading
                    ? 'bg-gray-500 cursor-not-allowed opacity-50'
                    : 'bg-gray-600 hover:bg-gray-700'
              } text-white transition-all duration-200`}
            >
              {tradeStrategy === 'SLOPE_FILTER' ? '✓ 기울기 필터' : '기울기 필터'}
            </button>
          </div>

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
                  {renderTradeHistory(tradeCycles)}
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