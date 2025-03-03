import { useEffect, useRef } from 'react';
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
        onCandleCompleteRef.current && onCandleCompleteRef.current({
          ...currentCandle,
          time: currentCandle.time,
        });
      }

      // 새 캔들 시작
      currentCandle = {
        time: new Date(timestamp * 1000).toISOString(),
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
  };

  const wsRef = useRef<WebSocket | null>(null);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const { addPrice, setIsConnected, updateTickerData } = useUpbitStore();
  
  // 웹소켓 대신 폴링 방식으로 구현
  const connectWebSocket = (symbols: string[], onMessage: (data: any) => void) => {
    try {
      // 폴링 방식으로 변경: 웹소켓 연결 대신 일정 간격으로 REST API 호출
      console.log('폴링 시작:', symbols);
      
      // 기존 폴링이 있으면 중지
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
      
      // REST API 호출 함수
      const fetchTickerData = async () => {
        try {
          const symbolsParam = symbols.join(',');
          const response = await fetch(`https://api.upbit.com/v1/ticker?markets=${symbolsParam}`);
          
          if (!response.ok) {
            throw new Error(`API 오류: ${response.status}`);
          }
          
          const data = await response.json();
          
          // 배열인 경우 각 항목 처리, 단일 객체인 경우 바로 처리
          if (Array.isArray(data)) {
            data.forEach(item => {
              // 티커 데이터 포맷으로 변환
              const tickerData = {
                type: 'ticker',
                code: item.market,
                trade_price: item.trade_price,
                trade_volume: item.trade_volume,
                opening_price: item.opening_price,
                high_price: item.high_price,
                low_price: item.low_price,
                prev_closing_price: item.prev_closing_price,
                change: item.change,
                change_price: item.change_price,
                change_rate: item.change_rate,
                signed_change_price: item.signed_change_price,
                signed_change_rate: item.signed_change_rate,
                trade_date: item.trade_date,
                trade_time: item.trade_time,
                trade_timestamp: item.timestamp,
                timestamp: item.timestamp,
                acc_trade_price: item.acc_trade_price,
                acc_trade_price_24h: item.acc_trade_price_24h,
                acc_trade_volume: item.acc_trade_volume,
                acc_trade_volume_24h: item.acc_trade_volume_24h,
                highest_52_week_price: item.highest_52_week_price,
                highest_52_week_date: item.highest_52_week_date,
                lowest_52_week_price: item.lowest_52_week_price,
                lowest_52_week_date: item.lowest_52_week_date,
                market_state: item.market_state
              };
              
              onMessage(tickerData);
            });
          } else {
            // 단일 객체 처리
            const tickerData = {
              type: 'ticker',
              code: data.market,
              trade_price: data.trade_price,
              // 나머지 필드도 마찬가지로 복사
              timestamp: data.timestamp
            };
            
            onMessage(tickerData);
          }
        } catch (error) {
          console.error('티커 데이터 가져오기 오류:', error);
        }
      };
      
      // 초기 데이터 로드
      fetchTickerData();
      
      // 2초마다 폴링 (API 제한에 주의)
      pollingIntervalRef.current = setInterval(fetchTickerData, 2000);
      
      // 연결 상태 설정
      setIsConnected(true);
    } catch (error) {
      console.error('폴링 설정 오류:', error);
      setIsConnected(false);
    }
  };

  // 폴링 중지
  const disconnectWebSocket = () => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
    
    // 기존 웹소켓도 정리
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    
    setIsConnected(false);
    console.log('폴링 중지됨');
  };

  // 특정 심볼에 대한 자동 폴링 설정
  useEffect(() => {
    if (!symbol) return; // 심볼이 없으면 실행하지 않음
    
    console.log('폴링 모드 시작:', symbol);
    
    // 폴링 함수
    const startPolling = async () => {
      try {
        const response = await fetch(`https://api.upbit.com/v1/ticker?markets=${symbol}`);
        
        if (!response.ok) {
          throw new Error(`API 오류: ${response.status}`);
        }
        
        const data = await response.json();
        const tickerData = Array.isArray(data) ? data[0] : data;
        
        if (tickerData) {
          updateTickerData(symbol, tickerData);
          addPrice(symbol, tickerData.trade_price);
        }
      } catch (error) {
        console.error('폴링 오류:', error);
      }
    };
    
    // 초기 데이터 로드
    startPolling();
    
    // 3초마다 폴링 (API 제한에 주의)
    const interval = setInterval(startPolling, 3000);
    setIsConnected(true);
    
    return () => {
      clearInterval(interval);
      setIsConnected(false);
    };
  }, [symbol, addPrice, setIsConnected, updateTickerData]);
  
  return { connectWebSocket, disconnectWebSocket, setOnCandleComplete };
}; 