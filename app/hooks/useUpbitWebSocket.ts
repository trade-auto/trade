import { useEffect, useState, useRef, useCallback } from 'react';

interface WebSocketData {
  type: string;
  code: string;
  trade_price: number;
  timestamp: number;
}

export const useUpbitWebSocket = (market: string) => {
  const [currentPrice, setCurrentPrice] = useState<number>(0);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected' | 'error'>('disconnected');
  const socketRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();
  const reconnectAttemptsRef = useRef<number>(0);
  const maxReconnectAttempts = 5;
  const reconnectDelay = 3000;

  const connect = useCallback(() => {
    try {
      // 이미 연결되어 있는 경우 새 연결 생성 안함
      if (socketRef.current?.readyState === WebSocket.OPEN) {
        return;
      }

      // 진행 중인 연결이 있다면 정리
      if (socketRef.current) {
        socketRef.current.close();
      }

      setConnectionStatus('connecting');
      socketRef.current = new WebSocket('wss://api.upbit.com/websocket/v1');

      socketRef.current.onopen = () => {
        console.log('WebSocket 연결됨');
        setConnectionStatus('connected');
        reconnectAttemptsRef.current = 0; // 연결 성공 시 재시도 카운터 리셋
        
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
              console.error('WebSocket 데이터 파싱 오류:', error instanceof Error ? error.message : String(error));
            }
          }
        };
        reader.readAsText(event.data);
      };

      socketRef.current.onerror = (event) => {
        // EventTarget 인터페이스로부터 더 자세한 정보 얻기
        const wsEvent = event as Event;
        
        setConnectionStatus('error');
        console.error('WebSocket 오류 발생:');
        console.error('- 이벤트 타입:', wsEvent.type);
        
        // 상대적 시간 정보만 사용
        try {
          // 브라우저 이벤트 타임스탬프 (페이지 로드 후 경과 시간, 밀리초)
          const relativeTime = wsEvent.timeStamp ? 
            `페이지 로드 후 ${(wsEvent.timeStamp / 1000).toFixed(2)}초` : 
            'unknown';
            
          console.error('- 상대 시간:', relativeTime);
          
          // 세션 시작 후 경과 시간 추가 (성능 API 사용)
          if (typeof performance !== 'undefined' && performance.now) {
            const sessionTime = (performance.now() / 1000).toFixed(2);
            console.error('- 세션 시간:', `${sessionTime}초`);
          }
        } catch (timeError) {
          console.error('- 시간 정보 처리 중 오류:', timeError);
        }
        
        // WebSocket 상태 코드와 설명 추가
        const readyStateMap = {
          0: "CONNECTING",
          1: "OPEN",
          2: "CLOSING",
          3: "CLOSED"
        };
        const currentState = socketRef.current?.readyState ?? -1;
        const stateDesc = readyStateMap[currentState as keyof typeof readyStateMap] || "UNKNOWN";
        console.error(`- 연결 상태: ${stateDesc} (${currentState})`);
        
        // 추가 정보: 브라우저 네트워크 상태
        if (typeof navigator !== 'undefined' && 'onLine' in navigator) {
          console.error('- 브라우저 온라인 상태:', navigator.onLine ? '온라인' : '오프라인');
        }
        
        // 연결 시도 정보 추가
        console.error(`- 재연결 시도: ${reconnectAttemptsRef.current}/${maxReconnectAttempts}`);
        
        // 네트워크 정보 추가 (가능한 경우)
        try {
          // NetworkInformation API는 TypeScript에서 아직 완전히 지원되지 않습니다
          const connection = (navigator as any).connection;
          if (connection) {
            // 네트워크 정보 로깅
            const networkInfo: Record<string, any> = {};
            
            if ('effectiveType' in connection) networkInfo.유형 = connection.effectiveType;
            if ('downlink' in connection) networkInfo.다운링크 = `${connection.downlink} Mbps`;
            if ('saveData' in connection) networkInfo.데이터절약 = connection.saveData ? '활성화' : '비활성화';
            if ('rtt' in connection) networkInfo.RTT = `${connection.rtt}ms`;
            
            // 모든 네트워크 정보를 한 번에 로깅
            console.error('- 네트워크 정보:', networkInfo);
          }
        } catch (navError) {
          console.error('- 네트워크 정보 접근 중 오류:', navError);
        }
        
        // 시스템 성능 정보 추가
        if ('memory' in performance) {
          const memory = (performance as any).memory;
          if (memory) {
            console.error('- 메모리 사용량:', 
              `${Math.round(memory.usedJSHeapSize / 1048576)}MB / ${Math.round(memory.jsHeapSizeLimit / 1048576)}MB`);
          }
        }
      };

      socketRef.current.onclose = (event) => {
        setConnectionStatus('disconnected');
        console.log(`WebSocket 연결 끊김 (코드: ${event.code}, 이유: ${event.reason || '알 수 없음'})`);
        
        // 최대 재시도 횟수 확인
        if (reconnectAttemptsRef.current < maxReconnectAttempts) {
          const delay = reconnectDelay * Math.pow(1.5, reconnectAttemptsRef.current);
          console.log(`${delay}ms 후 재연결 시도... (${reconnectAttemptsRef.current + 1}/${maxReconnectAttempts})`);
          
          reconnectAttemptsRef.current++;
          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, delay);
        } else {
          console.error(`최대 재연결 시도 횟수(${maxReconnectAttempts})에 도달했습니다.`);
        }
      };
    } catch (error) {
      setConnectionStatus('error');
      console.error('WebSocket 연결 시도 중 오류:', error instanceof Error ? error.message : String(error));
      
      if (reconnectAttemptsRef.current < maxReconnectAttempts) {
        const delay = reconnectDelay * Math.pow(1.5, reconnectAttemptsRef.current);
        reconnectAttemptsRef.current++;
        reconnectTimeoutRef.current = setTimeout(() => {
          connect();
        }, delay);
      }
    }
  }, [market]);

  // 네트워크 상태 변화 감지 및 재연결
  useEffect(() => {
    const handleOnline = () => {
      console.log('네트워크 연결됨, WebSocket 재연결 시도...');
      connect();
    };

    window.addEventListener('online', handleOnline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
    };
  }, [connect]);

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
  }, [market, connect]);

  return { 
    currentPrice, 
    lastUpdated,
    connectionStatus,
    reconnect: connect // 수동 재연결 가능하도록 함수 노출
  };
}; 