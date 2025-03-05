import { useEffect, useState } from 'react';

interface WebSocketData {
  type: string;
  code: string;
  trade_price: number;
  timestamp: number;
}

export const useUpbitWebSocket = (market: string) => {
  const [currentPrice, setCurrentPrice] = useState<number>(0);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  useEffect(() => {
    const socket = new WebSocket('wss://api.upbit.com/websocket/v1');

    socket.onopen = () => {
      const message = JSON.stringify([
        { ticket: "trade" },
        { type: "trade", codes: [market] }
      ]);
      socket.send(message);
    };

    socket.onmessage = (event) => {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          const data = JSON.parse(reader.result) as WebSocketData;
          if (data.type === 'trade') {
            setCurrentPrice(data.trade_price);
            setLastUpdated(new Date(data.timestamp));
          }
        }
      };
      reader.readAsText(event.data);
    };

    socket.onerror = (error) => {
      console.error('WebSocket 오류:', error);
    };

    return () => {
      socket.close();
    };
  }, [market]);

  return { currentPrice, lastUpdated };
}; 