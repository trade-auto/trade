import { useEffect, useState, useRef } from 'react';

interface WebSocketData {
  type: string;
  code: string;
  trade_price: number;
  timestamp: number;
}

interface WebSocketError {
  error: Event;
  message: string;
  timestamp: number;
}

export const useUpbitWebSocket = (market: string) => {
  const [currentPrice, setCurrentPrice] = useState<number>(0);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [lastError, setLastError] = useState<WebSocketError | null>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef<number>(0);
  const MAX_RECONNECT_ATTEMPTS = 5;
  const RECONNECT_DELAY = 3000; // 3초 후 재연결 시도

  const handleWebSocketError = (error: Event) => {
    const errorInfo: WebSocketError = {
      error,
      message: 'WebSocket 연결 중 오류가 발생했습니다.',
      timestamp: Date.now()
    };

    if (error instanceof ErrorEvent) {
      errorInfo.message = `WebSocket 오류: ${error.message}`;
    } else if (socketRef.current) {
      switch (socketRef.current.readyState) {
        case WebSocket.CONNECTING:
          errorInfo.message = 'WebSocket 연결 시도 중 오류가 발생했습니다.';
          break;
        case WebSocket.CLOSING:
          errorInfo.message = 'WebSocket 연결이 종료되는 중입니다.';
          break;
        case WebSocket.CLOSED:
          errorInfo.message = 'WebSocket 연결이 종료되었습니다.';
          break;
      }
    }

    console.error(errorInfo.message, {
      timestamp: new Date(errorInfo.timestamp).toISOString(),
      readyState: socketRef.current?.readyState,
      market
    });

    setLastError(errorInfo);
    setIsConnected(false);
  };

  const connect = () => {
    try {
      // 기존 소켓이 있으면 정리
      if (socketRef.current && socketRef.current.readyState !== WebSocket.CLOSED) {
        socketRef.current.close();
      }

      console.log('Upbit WebSocket 연결 시도...', {
        market,
        attempt: reconnectAttemptsRef.current + 1,
        maxAttempts: MAX_RECONNECT_ATTEMPTS,
        timestamp: new Date().toISOString()
      });

      socketRef.current = new WebSocket('wss://api.upbit.com/websocket/v1');

      socketRef.current.onopen = () => {
        console.log('Upbit WebSocket 연결 성공!', {
          market,
          timestamp: new Date().toISOString()
        });
        setIsConnected(true);
        setLastError(null);
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
              console.error('WebSocket 데이터 파싱 오류:', {
                error,
                data: reader.result,
                market,
                timestamp: new Date().toISOString()
              });
            }
          }
        };
        reader.readAsText(event.data);
      };

      socketRef.current.onerror = handleWebSocketError;

      socketRef.current.onclose = (event) => {
        console.log('WebSocket 연결 종료:', {
          code: event.code,
          reason: event.reason || '알 수 없는 이유',
          market,
          timestamp: new Date().toISOString()
        });
        
        setIsConnected(false);
        
        // 자동 재연결 시도
        if (reconnectAttemptsRef.current < MAX_RECONNECT_ATTEMPTS) {
          console.log('WebSocket 재연결 예약됨:', {
            delay: RECONNECT_DELAY,
            attempt: reconnectAttemptsRef.current + 1,
            maxAttempts: MAX_RECONNECT_ATTEMPTS,
            market,
            timestamp: new Date().toISOString()
          });

          reconnectTimeoutRef.current = setTimeout(() => {
            reconnectAttemptsRef.current += 1;
            connect();
          }, RECONNECT_DELAY);
        } else {
          const errorMessage = `최대 재연결 시도 횟수(${MAX_RECONNECT_ATTEMPTS})에 도달했습니다.`;
          console.error(errorMessage, {
            market,
            timestamp: new Date().toISOString()
          });
          setLastError({
            error: event,
            message: errorMessage,
            timestamp: Date.now()
          });
        }
      };
    } catch (error) {
      console.error('WebSocket 연결 시도 중 오류:', {
        error,
        market,
        timestamp: new Date().toISOString()
      });
      handleWebSocketError(error as Event);
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

  return { currentPrice, lastUpdated, isConnected, lastError };
}; 