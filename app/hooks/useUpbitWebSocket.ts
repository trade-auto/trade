import { useEffect, useState, useRef, useCallback } from 'react';
import { Time } from 'lightweight-charts';
import bollingerStrategy from '../strategies/bollingerStrategy';

interface WebSocketData {
  type: string;
  code: string;
  trade_price: number;
  timestamp: number;
  trade_volume?: number;
  ask_bid?: string;
  prev_closing_price?: number;
}

interface RealTimeCandle {
  time: Time;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

// CandlestickData 인터페이스 확장하여 volume 속성 추가
interface ExtendedCandlestickData {
  time: Time;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

// 볼린저 분석 상태 타입
type AnalysisState = 'idle' | 'waiting' | 'analyzing' | 'complete';

export const useUpbitWebSocket = (market: string) => {
  const [currentPrice, setCurrentPrice] = useState<number>(0);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [lastCandle, setLastCandle] = useState<ExtendedCandlestickData | null>(null);
  const [tradeSignal, setTradeSignal] = useState<'long' | 'exit' | null>(null);
  const [candleCount, setCandleCount] = useState<number>(0);
  const [lastAnalysisTime, setLastAnalysisTime] = useState<Date | null>(null);
  const [analysisState, setAnalysisState] = useState<AnalysisState>('idle');
  
  const socketRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef<number>(0);
  const candlesRef = useRef<ExtendedCandlestickData[]>([]);
  const analyzeIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastTradeRef = useRef<{
    price: number;
    time: number;
    type: 'long' | 'exit';
  } | null>(null);
  
  const MAX_RECONNECT_ATTEMPTS = 5;
  const RECONNECT_DELAY = 3000; // 3초 후 재연결 시도
  const ANALYSIS_INTERVAL = 10000; // 10초마다 분석 실행
  
  // 볼린저 분석 상태 감지
  useEffect(() => {
    const eventListener = (event: Event) => {
      if (event instanceof CustomEvent && event.detail?.type === 'bollingerAnalysisComplete') {
        console.log('🔔 볼린저 분석 완료 이벤트 감지, 매수 분석 시작...');
        setAnalysisState('complete');
        // 분석 완료 후 즉시 매수 분석 실행
        if (candlesRef.current.length >= 900) {
          analyzeTradingStrategy();
        }
      }
    };
    
    window.addEventListener('bollingerAnalysisComplete', eventListener);
    
    return () => {
      window.removeEventListener('bollingerAnalysisComplete', eventListener);
    };
  }, []);
  
  // 메모이즈된 분석 함수
  const analyzeTradingStrategy = useCallback(() => {
    if (candlesRef.current.length < 900) {
      console.log(`캔들 데이터 부족: 현재 ${candlesRef.current.length}개, 필요 900개`);
      return;
    }
    
    setAnalysisState('analyzing');
    setLastAnalysisTime(new Date());
    console.log(`매수 신호 분석 시작: ${new Date().toLocaleString()}`);
    console.log(`분석 데이터: ${candlesRef.current.length}개 캔들`);
    
    const index = candlesRef.current.length - 1;
    
    try {
      // analyzeEntry 메소드 존재 확인 후 호출
      if (!bollingerStrategy.analyzeEntry) {
        console.error('볼린저 전략 analyzeEntry 함수가 존재하지 않습니다.');
        return;
      }
      
      const result = bollingerStrategy.analyzeEntry(candlesRef.current, index);
      console.log(`매수 분석 결과: ${result || '신호 없음'}`);
      
      if (result === 'long') {
        // 마지막 거래와 동일한 신호는 무시
        if (lastTradeRef.current?.type !== 'long') {
          console.log('🚨 실시간 매수 신호 발생!', new Date().toLocaleString());
          lastTradeRef.current = {
            price: currentPrice,
            time: Date.now(),
            type: 'long'
          };
          setTradeSignal('long');
          // 알림 실행
          sendTradeNotification(market, currentPrice, 'long');
        }
      }
      
      // 매도 신호 체크 (이미 매수한 경우에만)
      if (lastTradeRef.current?.type === 'long' && lastTradeRef.current.price > 0) {
        if (!bollingerStrategy.analyzeExit) {
          console.error('볼린저 전략 analyzeExit 함수가 존재하지 않습니다.');
          return;
        }
        
        const shouldExit = bollingerStrategy.analyzeExit(
          candlesRef.current, 
          index, 
          'long', 
          lastTradeRef.current.price
        );
        
        console.log(`매도 분석 결과: ${shouldExit ? '매도 신호' : '유지'}`);
        
        if (shouldExit) {
          console.log('🚨 실시간 매도 신호 발생!', new Date().toLocaleString());
          lastTradeRef.current = {
            price: currentPrice,
            time: Date.now(),
            type: 'exit'
          };
          setTradeSignal('exit');
          // 알림 실행
          sendTradeNotification(market, currentPrice, 'exit');
        }
      }
    } catch (error) {
      console.error('매수/매도 신호 분석 중 오류 발생:', error);
    } finally {
      setAnalysisState('idle');
    }
  }, [currentPrice, market]);
  
  // 초기 캔들 데이터 로드 (과거 데이터 가져오기)
  const loadInitialCandles = async () => {
    try {
      console.log('초기 캔들 데이터 로딩 시도...');
      // 여기서 업비트 API를 통해 과거 캔들 데이터를 로드할 수 있습니다.
      // 예시: 최근 900개의 1분봉 데이터를 가져오는 API 호출
      
      // 로드 로직 구현 필요
      // const response = await fetch(`https://api.upbit.com/v1/candles/minutes/1?market=${market}&count=900`);
      // const data = await response.json();
      
      // 임시로 빈 배열 반환
      return [];
    } catch (error) {
      console.error('초기 캔들 데이터 로딩 실패:', error);
      return [];
    }
  };
  
  // 현재 캔들 관리 (1분 캔들 기준)
  const currentCandleRef = useRef<RealTimeCandle | null>(null);
  const lastCandleTimeRef = useRef<number>(0);

  // 트레이드 데이터로 캔들 업데이트
  const updateCandle = (data: WebSocketData) => {
    const timestamp = data.timestamp;
    const price = data.trade_price;
    const volume = data.trade_volume || 0;
    
    // 현재 시간 기준으로 분 계산 (1분 캔들)
    const minuteTimestamp = Math.floor(timestamp / (60 * 1000)) * (60 * 1000);
    
    // 새로운 캔들 시작해야 하는 경우
    if (!currentCandleRef.current || minuteTimestamp > lastCandleTimeRef.current) {
      // 이전 캔들 저장
      if (currentCandleRef.current) {
        const completedCandle: ExtendedCandlestickData = {
          time: (lastCandleTimeRef.current / 1000) as Time,
          open: currentCandleRef.current.open,
          high: currentCandleRef.current.high,
          low: currentCandleRef.current.low,
          close: currentCandleRef.current.close,
          volume: currentCandleRef.current.volume
        };
        
        // 캔들 배열에 추가
        candlesRef.current.push(completedCandle);
        setLastCandle(completedCandle);
        setCandleCount(candlesRef.current.length);
        
        // 캔들 생성 로그
        if (candlesRef.current.length % 10 === 0 || candlesRef.current.length < 10) {
          console.log(`새로운 캔들 생성 완료: 누적 캔들 수 ${candlesRef.current.length}`);
        }
        
        // 배열이 너무 커지지 않도록 관리 (최대 1000개)
        if (candlesRef.current.length > 1000) {
          candlesRef.current = candlesRef.current.slice(-1000);
        }
        
        // 볼린저 전략 완료 후 즉시 매수 분석 실행 (900개 이상 데이터가 쌓였을 때)
        if (candlesRef.current.length >= 900 && analysisState === 'idle') {
          console.log('캔들 생성 후 매수 분석 자동 실행');
          // 볼린저 분석 알림 발생 - 볼린저 전략 분석이 완료되었을 때 매수 분석을 시작하도록 함
          window.dispatchEvent(new CustomEvent('bollingerAnalysisComplete', {
            detail: { type: 'bollingerAnalysisComplete' }
          }));
        }
      }
      
      // 새 캔들 시작
      currentCandleRef.current = {
        time: (minuteTimestamp / 1000) as Time,
        open: price,
        high: price,
        low: price,
        close: price,
        volume: volume
      };
      lastCandleTimeRef.current = minuteTimestamp;
    } else {
      // 기존 캔들 업데이트
      if (currentCandleRef.current) {
        currentCandleRef.current.high = Math.max(currentCandleRef.current.high, price);
        currentCandleRef.current.low = Math.min(currentCandleRef.current.low, price);
        currentCandleRef.current.close = price;
        currentCandleRef.current.volume += volume;
      }
    }
  };
  
  // 매수/매도 알림 발송
  const sendTradeNotification = (symbol: string, price: number, type: 'long' | 'exit') => {
    if ("Notification" in window && Notification.permission === "granted") {
      new Notification(
        `${type === 'long' ? '매수' : '매도'} 신호 발생: ${symbol}`, 
        {
          body: `현재 가격: ${price.toLocaleString()}원`,
          icon: '/favicon.ico'
        }
      );
    }
  };

  const connect = () => {
    try {
      // 기존 소켓이 있으면 정리
      if (socketRef.current && socketRef.current.readyState !== WebSocket.CLOSED) {
        socketRef.current.close();
      }

      console.log('Upbit WebSocket 연결 시도...');
      socketRef.current = new WebSocket('wss://api.upbit.com/websocket/v1');

      socketRef.current.onopen = () => {
        console.log('Upbit WebSocket 연결 성공!');
        setIsConnected(true);
        reconnectAttemptsRef.current = 0; // 연결 성공 시 재시도 카운트 초기화
        
        const message = JSON.stringify([
          { ticket: "trade" },
          { type: "trade", codes: [market] }
        ]);
        socketRef.current?.send(message);
      };

      socketRef.current.onmessage = (event) => {
        const reader = new FileReader();
        reader.onload = () => {
          if (typeof reader.result === 'string') {
            try {
              const data = JSON.parse(reader.result) as WebSocketData;
              if (data.type === 'trade') {
                setCurrentPrice(data.trade_price);
                setLastUpdated(new Date(data.timestamp));
                
                // 캔들 데이터 업데이트
                updateCandle(data);
              }
            } catch (error) {
              console.error('WebSocket 데이터 파싱 오류:', error);
            }
          }
        };
        reader.readAsText(event.data);
      };

      socketRef.current.onerror = (error) => {
        console.error('WebSocket 오류:', error);
        setIsConnected(false);
      };

      socketRef.current.onclose = (event) => {
        console.log(`WebSocket 연결 종료: 코드 ${event.code}, 이유: ${event.reason}`);
        setIsConnected(false);
        
        // 자동 재연결 시도
        if (reconnectAttemptsRef.current < MAX_RECONNECT_ATTEMPTS) {
          console.log(`${RECONNECT_DELAY / 1000}초 후 재연결 시도 (${reconnectAttemptsRef.current + 1}/${MAX_RECONNECT_ATTEMPTS})...`);
          reconnectTimeoutRef.current = setTimeout(() => {
            reconnectAttemptsRef.current += 1;
            connect();
          }, RECONNECT_DELAY);
        } else {
          console.error(`최대 재연결 시도 횟수(${MAX_RECONNECT_ATTEMPTS})에 도달했습니다.`);
        }
      };
    } catch (error) {
      console.error('WebSocket 연결 시도 중 오류:', error);
    }
  };

  // 초기화 및 정리
  useEffect(() => {
    // 알림 권한 요청
    if ("Notification" in window && Notification.permission !== "granted" && Notification.permission !== "denied") {
      Notification.requestPermission();
    }
    
    // 초기 캔들 데이터 로드
    loadInitialCandles().then(initialCandles => {
      if (initialCandles.length > 0) {
        candlesRef.current = initialCandles;
        setCandleCount(initialCandles.length);
        console.log(`초기 캔들 데이터 로드 완료: ${initialCandles.length}개`);
      }
      
      // WebSocket 연결
      connect();
      
      // 주기적인 분석 시작
      analyzeIntervalRef.current = setInterval(() => {
        if (analysisState === 'idle') {
          console.log('주기적 매수 분석 실행 시작');
          analyzeTradingStrategy();
        } else {
          console.log(`분석 스킵: 현재 상태 ${analysisState}`);
        }
      }, ANALYSIS_INTERVAL);
    });

    return () => {
      // 정리 함수
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      
      if (analyzeIntervalRef.current) {
        clearInterval(analyzeIntervalRef.current);
      }
      
      if (socketRef.current) {
        socketRef.current.close();
        socketRef.current = null;
      }
    };
  }, [market, analyzeTradingStrategy]);

  return { 
    currentPrice, 
    lastUpdated, 
    isConnected,
    lastCandle,
    tradeSignal,
    candles: candlesRef.current,
    lastTrade: lastTradeRef.current,
    candleCount,
    lastAnalysisTime,
    analysisState,
    isReadyForAnalysis: candlesRef.current.length >= 900
  };
}; 