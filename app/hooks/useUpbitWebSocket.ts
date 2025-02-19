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

interface Candle {
  time: number;   // timestamp (초)
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface ExtendedCandlestickData {
  // Add any necessary properties for ExtendedCandlestickData
}

export const useUpbitWebSocket = (symbol?: string) => {
  let currentCandle: Candle | null = null;

  const onCandleCompleteRef = useRef<((candle: ExtendedCandlestickData) => void) | null>(null);
  const setOnCandleComplete = (callback: (candle: ExtendedCandlestickData) => void) => {
    onCandleCompleteRef.current = callback;
  };

  const updateCandleWithTicker = (tickerData: TickerData) => {
    const timestamp = Math.floor(tickerData.timestamp / 1000);
    
    if (!currentCandle || currentCandle.time !== timestamp) {
      // 기존 캔들이 있다면 종료(완료) 처리 후 콜백 호출
      if (currentCandle) {
        console.log('캔들 완료:', currentCandle);
        onCandleCompleteRef.current && onCandleCompleteRef.current({
          ...currentCandle,
          time: currentCandle.time as unknown as Time, // 필요한 경우 적절히 변환
        });
      }

      // 새 캔들 시작
      currentCandle = {
        time: timestamp,
        open: tickerData.trade_price,
        high: tickerData.trade_price,
        low: tickerData.trade_price,
        close: tickerData.trade_price,
        volume: tickerData.trade_volume,
      };
    } else {
      // 동일한 시간 구간이면 업데이트
      currentCandle.high = Math.max(currentCandle.high, tickerData.trade_price);
      currentCandle.low = Math.min(currentCandle.low, tickerData.trade_price);
      currentCandle.close = tickerData.trade_price;
      currentCandle.volume += tickerData.trade_volume;
    }
    
    console.log('업데이트된 캔들:', currentCandle);
  };

  const wsRef = useRef<WebSocket | null>(null);
  const { addPrice, setIsConnected, updateTickerData } = useUpbitStore();
  
  const connectWebSocket = (symbols: string[], onMessage: (data: any) => void) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.close();
    }

    wsRef.current = new WebSocket('wss://api.upbit.com/websocket/v1');

    if (wsRef.current) {
      wsRef.current.onopen = () => {
        const message = JSON.stringify([
          { ticket: "trade" },
          { type: "trade", codes: symbols }
        ]);
        wsRef.current?.send(message);
      };

      wsRef.current.onmessage = async (event) => {
        const reader = new FileReader();
        reader.onload = () => {
          if (typeof reader.result === 'string') {
            const data = JSON.parse(reader.result);
            onMessage(data);
          }
        };
        reader.readAsText(event.data);
      };
    }
  };

  const disconnectWebSocket = () => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
  };

  useEffect(() => {
    if (!symbol) return; // symbol이 없으면 실행하지 않음
    
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
        
        // 구독 메시지 수정: candle.1s 추가
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
          },
          {
            type: "candle.1s",  // 1초 캔들 데이터 구독
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
              updateCandleWithTicker(tickerData);
            } else if (data.type === 'candle.1s') {  // candle 메시지 처리
              // Upbit 캔들 메시지의 필드를 변환하여 사용 (시가: op, 고가: hp, 저가: lp, 현재가: tp)
              const candle = {
                op: data.opening_price,    // 시가
                hp: data.high_price,       // 고가
                lp: data.low_price,        // 저가
                tp: data.trade_price,      // 현재가(종가)
                volume: data.candle_acc_trade_volume,
                // KST 시간으로부터 timestamp(초) 생성
                timestamp: Math.floor(new Date(data.candle_date_time_kst).getTime() / 1000),
              };
              console.log('캔들 데이터 수신:', candle);
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
  
  return { connectWebSocket, disconnectWebSocket, setOnCandleComplete };
}; 