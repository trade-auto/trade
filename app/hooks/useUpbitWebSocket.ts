import { useEffect, useRef } from 'react';
import { useUpbitStore } from '../store/useUpbitStore';

interface TradeData {
  type: string;
  code: string;
  trade_price: number;
  trade_volume: number;
  ask_bid: string;
  trade_time: string;
  trade_timestamp: number;
  timestamp: number;
  sequential_id: number;
  stream_type: string;
}

interface TickerData {
  type: string;
  code: string;
  trade_price: number;
  trade_volume: number;
  opening_price: number;
  high_price: number;
  low_price: number;
  prev_closing_price: number;
  change: string;
  change_price: number;
  change_rate: number;
  signed_change_price: number;
  signed_change_rate: number;
  trade_date: string;
  trade_time: string;
  trade_timestamp: number;
  timestamp: number;
  acc_trade_price: number;
  acc_trade_price_24h: number;
  acc_trade_volume: number;
  acc_trade_volume_24h: number;
  highest_52_week_price: number;
  highest_52_week_date: string;
  lowest_52_week_price: number;
  lowest_52_week_date: string;
  market_state: string;
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
              updateTickerData(symbol, tickerData);
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
  }, [symbol, addPrice, setIsConnected, updateTickerData]);
  
  return { wsRef };
}; 