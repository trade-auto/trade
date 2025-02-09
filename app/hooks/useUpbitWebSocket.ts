import { useEffect, useRef } from 'react';
import { useUpbitStore } from '../store/useUpbitStore';

export const useUpbitWebSocket = (symbol: string) => {
  const wsRef = useRef<WebSocket | null>(null);
  const { addPrice, setIsConnected } = useUpbitStore();
  
  useEffect(() => {
    const connect = () => {
      // 기존 연결이 있으면 닫기
      if (wsRef.current) {
        wsRef.current.close();
      }

      const ws = new WebSocket('wss://api.upbit.com/websocket/v1');
      wsRef.current = ws;
      
      ws.onopen = () => {
        setIsConnected(true);
        console.log('웹소켓 연결됨');
        
        // 구독 메시지 전송
        const message = JSON.stringify([
          { ticket: "UNIQUE_TICKET" },
          {
            type: "trade",
            codes: [symbol],
            isOnlyRealtime: true
          },
          {
            type: "ticker",
            codes: [symbol],
            isOnlyRealtime: true
          }
        ]);
        
        ws.send(message);
      };
      
      ws.onmessage = (event) => {
        const reader = new FileReader();
        reader.onload = () => {
          if (typeof reader.result === 'string') {
            const data = JSON.parse(reader.result);
            
            if (data.type === 'trade' || data.type === 'ticker') {
              addPrice(symbol, data.trade_price);
            }
          }
        };
        
        reader.readAsText(event.data);
      };
      
      ws.onclose = () => {
        setIsConnected(false);
        console.log('웹소켓 연결 끊김');
        setTimeout(connect, 1000); // 재연결 시도
      };
      
      ws.onerror = (error) => {
        console.error('웹소켓 에러:', error);
        ws.close();
      };
    };
    
    connect();
    
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [symbol]);
  
  return { wsRef };
}; 