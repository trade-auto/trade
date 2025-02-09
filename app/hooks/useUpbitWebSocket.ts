import { useEffect, useRef } from 'react';
import { useUpbitStore } from '../store/useUpbitStore';

interface TradeData {
  trade_price: number;
  trade_volume: number;
  ask_bid: string;
  trade_time: string;
}

interface TickerData {
  trade_price: number;
  opening_price: number;
  high_price: number;
  low_price: number;
  timestamp: number;
}

export const useUpbitWebSocket = (symbol: string) => {
  const wsRef = useRef<WebSocket | null>(null);
  const { addPrice, setIsConnected, updateTickerData } = useUpbitStore();
  
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
            
            if (data.type === 'trade') {
              const tradeData = data as TradeData;
              addPrice(symbol, tradeData.trade_price);
            } else if (data.type === 'ticker') {
              const tickerData = data as TickerData;
              updateTickerData(symbol, {
                currentPrice: tickerData.trade_price,
                openPrice: tickerData.opening_price,
                highPrice: tickerData.high_price,
                lowPrice: tickerData.low_price,
                timestamp: tickerData.timestamp,
              });
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