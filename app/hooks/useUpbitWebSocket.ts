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
  const socketRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();

  const connect = () => {
    try {
      if (socketRef.current?.readyState === WebSocket.OPEN) {
        return;
      }

      socketRef.current = new WebSocket('wss://api.upbit.com/websocket/v1');

      socketRef.current.onopen = () => {
        console.log('WebSocket 연결됨');
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
      };

      socketRef.current.onclose = () => {
        console.log('WebSocket 연결 끊김, 재연결 시도...');
        // 재연결 시도
        reconnectTimeoutRef.current = setTimeout(() => {
          connect();
        }, 5000);
      };
    } catch (error) {
      console.error('WebSocket 연결 시도 중 오류:', error);
      // 연결 실패 시 재시도
      reconnectTimeoutRef.current = setTimeout(() => {
        connect();
      }, 5000);
    }
  };

  useEffect(() => {
    connect();

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (socketRef.current) {
        socketRef.current.close();
        socketRef.current = null;
      }
    };
  }, [market]);

  return { currentPrice, lastUpdated };
}; 