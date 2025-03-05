import { useEffect, useRef, useState } from 'react';
import { useUpbitStore } from '../store/useUpbitStore';
import { Time } from 'lightweight-charts';
import { Candle, ExtendedCandlestickData } from '../types/candlestick';

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