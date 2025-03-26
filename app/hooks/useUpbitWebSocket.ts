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
  const connectionTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const MAX_RECONNECT_ATTEMPTS = 5;
  const RECONNECT_DELAY = 3000; // 3초 후 재연결 시도
  const CONNECTION_TIMEOUT = 10000; // 10초 연결 타임아웃

  const cleanupSocket = () => {
    if (socketRef.current) {
      try {
        socketRef.current.onopen = null;
        socketRef.current.onmessage = null;
        socketRef.current.onerror = null;
        socketRef.current.onclose = null;
        socketRef.current.close();
      } catch (e) {
        console.error('소켓 정리 중 오류:', e);
      }
    }
  };

  const clearTimeouts = () => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    
    if (connectionTimeoutRef.current) {
      clearTimeout(connectionTimeoutRef.current);
      connectionTimeoutRef.current = null;
    }
  };

  const connect = () => {
    try {
      // 기존 소켓 및 타이머 정리
      cleanupSocket();
      clearTimeouts();

      console.log('Upbit WebSocket 연결 시도...');
      socketRef.current = new WebSocket('wss://api.upbit.com/websocket/v1');

      // 연결 타임아웃 설정
      connectionTimeoutRef.current = setTimeout(() => {
        if (socketRef.current && socketRef.current.readyState !== WebSocket.OPEN) {
          console.error('WebSocket 연결 타임아웃');
          cleanupSocket();
          setIsConnected(false);
          
          // 재연결 시도
          if (reconnectAttemptsRef.current < MAX_RECONNECT_ATTEMPTS) {
            reconnectAttemptsRef.current += 1;
            console.log(`연결 타임아웃 후 재연결 시도 (${reconnectAttemptsRef.current}/${MAX_RECONNECT_ATTEMPTS})...`);
            connect();
          }
        }
      }, CONNECTION_TIMEOUT);

      socketRef.current.onopen = () => {
        console.log('Upbit WebSocket 연결 성공!');
        setIsConnected(true);
        reconnectAttemptsRef.current = 0; // 연결 성공 시 재시도 카운트 초기화
        
        // 연결 타임아웃 정리
        if (connectionTimeoutRef.current) {
          clearTimeout(connectionTimeoutRef.current);
          connectionTimeoutRef.current = null;
        }
        
        const message = JSON.stringify([
          { ticket: "trade" },
          { type: "trade", codes: [market] }
        ]);
        
        // 소켓이 열려있는지 확인 후 메시지 전송
        if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
          socketRef.current.send(message);
        } else {
          console.error('WebSocket이 열려있지 않아 메시지를 보낼 수 없습니다');
        }
      };

      socketRef.current.onmessage = (event) => {
        // 바이너리 데이터를 직접 처리
        if (event.data instanceof Blob) {
          event.data.text().then(text => {
            try {
              const data = JSON.parse(text) as WebSocketData;
              if (data.type === 'trade') {
                setCurrentPrice(data.trade_price);
                setLastUpdated(new Date(data.timestamp));
              }
            } catch (error) {
              console.error('데이터 파싱 오류:', error);
            }
          }).catch(error => {
            console.error('Blob 텍스트 변환 중 오류:', error);
          });
        } else {
          console.warn('예상치 못한 WebSocket 메시지 형식:', typeof event.data);
        }
      };

      socketRef.current.onerror = (error: Event) => {
        const ws = error.target as WebSocket;
        console.error('WebSocket 오류:', {
          type: error.type,
          timeStamp: error.timeStamp,
          url: ws?.url || 'unknown',
          readyState: ws?.readyState !== undefined ? 
            ['CONNECTING', 'OPEN', 'CLOSING', 'CLOSED'][ws.readyState] : 'unknown'
        });
        
        setIsConnected(false);
        clearTimeouts();
        
        // 오류 발생 시 소켓 상태 확인 및 재연결 시도
        try {
          cleanupSocket();
          
          if (reconnectAttemptsRef.current < MAX_RECONNECT_ATTEMPTS) {
            console.log(`${RECONNECT_DELAY / 1000}초 후 재연결 시도 (${reconnectAttemptsRef.current + 1}/${MAX_RECONNECT_ATTEMPTS})...`);
            
            reconnectTimeoutRef.current = setTimeout(() => {
              reconnectAttemptsRef.current += 1;
              connect();
            }, RECONNECT_DELAY);
          } else {
            console.error(`최대 재연결 시도 횟수(${MAX_RECONNECT_ATTEMPTS})에 도달했습니다.`);
          }
        } catch (e) {
          console.error('WebSocket 오류 처리 중 추가 오류 발생:', e);
        }
      };

      socketRef.current.onclose = (event) => {
        console.log(`WebSocket 연결 종료: 코드 ${event.code}, 이유: ${event.reason || '이유 없음'}`);
        setIsConnected(false);
        clearTimeouts();
        
        // 정상적인 종료가 아닌 경우 자동 재연결 시도
        if (event.code !== 1000 && event.code !== 1001) {
          if (reconnectAttemptsRef.current < MAX_RECONNECT_ATTEMPTS) {
            console.log(`비정상 종료로 인한 재연결 시도: ${RECONNECT_DELAY / 1000}초 후 (${reconnectAttemptsRef.current + 1}/${MAX_RECONNECT_ATTEMPTS})...`);
            
            reconnectTimeoutRef.current = setTimeout(() => {
              reconnectAttemptsRef.current += 1;
              connect();
            }, RECONNECT_DELAY);
          } else {
            console.error(`최대 재연결 시도 횟수(${MAX_RECONNECT_ATTEMPTS})에 도달했습니다.`);
          }
        }
      };
    } catch (error) {
      console.error('WebSocket 연결 시도 중 오류:', error);
      
      // 기본 예외 처리에서도 재연결 시도
      if (reconnectAttemptsRef.current < MAX_RECONNECT_ATTEMPTS) {
        console.log(`연결 오류 후 재연결 시도: ${RECONNECT_DELAY / 1000}초 후 (${reconnectAttemptsRef.current + 1}/${MAX_RECONNECT_ATTEMPTS})...`);
        reconnectTimeoutRef.current = setTimeout(() => {
          reconnectAttemptsRef.current += 1;
          connect();
        }, RECONNECT_DELAY);
      }
    }
  };

  useEffect(() => {
    connect();

    return () => {
      clearTimeouts();
      cleanupSocket();
    };
  }, [market]);

  return { currentPrice, lastUpdated, isConnected };
}; 