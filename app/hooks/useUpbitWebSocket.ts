import { useEffect, useState, useRef } from 'react';

interface WebSocketData {
  type: string;
  code: string;
  trade_price: number;
  timestamp: number;
}

export const useUpbitWebSocket = (market: string) => {
  const [currentPrice, setCurrentPrice] = useState<number>(0);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const socketRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef<number>(0);
  const MAX_RECONNECT_ATTEMPTS = 5;
  const RECONNECT_DELAY = 3000; // 3초 후 재연결 시도

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

  useEffect(() => {
    connect();

    return () => {
      // 정리 함수
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      
      if (socketRef.current) {
        socketRef.current.close();
        socketRef.current = null;
      }
    };
  }, [market]);

  return { currentPrice, lastUpdated, isConnected };
}; 