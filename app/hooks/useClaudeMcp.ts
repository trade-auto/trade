'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { 
  McpMessage, 
  McpConnection, 
  McpServerStatus, 
  WebSocketMessage,
  ClaudeMessageWindowState 
} from '@/app/types/claude-mcp';

interface UseClaudeMcpOptions {
  websocketUrl?: string;
  maxMessages?: number;
  autoReconnect?: boolean;
  reconnectInterval?: number;
  windowId?: number;
}

export const useClaudeMcp = (options: UseClaudeMcpOptions = {}) => {
  const {
    websocketUrl = 'ws://localhost:8082',
    maxMessages = 500,
    autoReconnect = true,
    reconnectInterval = 5000,
    windowId = 1
  } = options;

  const [state, setState] = useState<ClaudeMessageWindowState>({
    messages: [],
    connections: [],
    serverStatus: {
      status: 'stopped',
      port: 8082,
      clientCount: 0
    },
    isMinimized: false,
    autoScroll: true,
    maxMessages,
    filters: {
      showInfo: true,
      showSuccess: true,
      showWarning: true,
      showError: true,
      showCommand: true,
      showResponse: true,
      sources: ['mcp-server', 'loop-client', 'system']
    }
  });

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const connectionId = useRef<string>(`client-${Date.now()}`);

  const addMessage = useCallback((message: Omit<McpMessage, 'id' | 'timestamp'>) => {
    const newMessage: McpMessage = {
      ...message,
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
    };

    setState(prev => ({
      ...prev,
      messages: prev.messages.length >= maxMessages 
        ? [...prev.messages.slice(1), newMessage]
        : [...prev.messages, newMessage]
    }));
  }, [maxMessages]);

  const updateServerStatus = useCallback((status: Partial<McpServerStatus>) => {
    setState(prev => ({
      ...prev,
      serverStatus: { ...prev.serverStatus, ...status }
    }));
  }, []);

  const updateConnection = useCallback((connectionUpdate: Partial<McpConnection> & { id: string }) => {
    setState(prev => ({
      ...prev,
      connections: prev.connections.map(conn => 
        conn.id === connectionUpdate.id 
          ? { ...conn, ...connectionUpdate }
          : conn
      )
    }));
  }, []);

  const connectWebSocket = useCallback(() => {
    try {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        return;
      }

      addMessage({
        type: 'info',
        source: 'system',
        message: `WebSocket 연결 시도 중...`,
        details: websocketUrl
      });

      const ws = new WebSocket(websocketUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        addMessage({
          type: 'success',
          source: 'system',
          message: 'WebSocket 연결 성공',
          details: websocketUrl
        });

        updateServerStatus({ 
          status: 'running',
          lastActivity: new Date()
        });

        // 클리어 재연결 타이머
        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current);
          reconnectTimeoutRef.current = null;
        }
      };

      ws.onmessage = (event) => {
        try {
          const data: WebSocketMessage = JSON.parse(event.data);
          
          switch (data.type) {
            case 'message':
              if ('message' in data.data) {
                addMessage(data.data as McpMessage);
              }
              break;
              
            case 'command':
              addMessage({
                type: 'command',
                source: 'loop-client',
                message: `명령어 실행: ${(data.data as any).command}`,
                details: `작업 디렉토리: ${(data.data as any).workingDirectory}`,
                metadata: {
                  command: (data.data as any).command
                }
              });
              break;
              
            case 'status':
              updateServerStatus(data.data as McpServerStatus);
              break;
              
            case 'file-event':
              const fileEvent = data.data as any;
              addMessage({
                type: 'info',
                source: 'loop-client',
                message: `파일 ${fileEvent.type}: ${fileEvent.path}`,
                metadata: {
                  fileChange: {
                    path: fileEvent.path,
                    action: fileEvent.type.replace('file-', '')
                  }
                }
              });
              break;
              
            case 'ping':
              // pong 응답
              ws.send(JSON.stringify({ type: 'pong', timestamp: new Date().toISOString() }));
              break;
          }
        } catch (error) {
          addMessage({
            type: 'error',
            source: 'system',
            message: 'WebSocket 메시지 파싱 오류',
            details: error instanceof Error ? error.message : '알 수 없는 오류'
          });
        }
      };

      ws.onclose = (event) => {
        addMessage({
          type: 'warning',
          source: 'system',
          message: 'WebSocket 연결 종료',
          details: `코드: ${event.code}, 이유: ${event.reason || '알 수 없음'}`
        });

        updateServerStatus({ status: 'stopped' });

        // 자동 재연결
        if (autoReconnect && !reconnectTimeoutRef.current) {
          reconnectTimeoutRef.current = setTimeout(() => {
            connectWebSocket();
          }, reconnectInterval);
        }
      };

      ws.onerror = (error) => {
        addMessage({
          type: 'error',
          source: 'system',
          message: 'WebSocket 연결 오류',
          details: 'MCP 서버가 실행 중인지 확인하세요.'
        });
      };

    } catch (error) {
      addMessage({
        type: 'error',
        source: 'system',
        message: 'WebSocket 초기화 오류',
        details: error instanceof Error ? error.message : '알 수 없는 오류'
      });
    }
  }, [websocketUrl, autoReconnect, reconnectInterval, addMessage, updateServerStatus]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
  }, []);

  const clearMessages = useCallback(() => {
    setState(prev => ({ ...prev, messages: [] }));
  }, []);

  const toggleMinimized = useCallback(() => {
    setState(prev => ({ ...prev, isMinimized: !prev.isMinimized }));
  }, []);

  const setAutoScroll = useCallback((autoScroll: boolean) => {
    setState(prev => ({ ...prev, autoScroll }));
  }, []);

  const updateFilters = useCallback((filters: Partial<ClaudeMessageWindowState['filters']>) => {
    setState(prev => ({ 
      ...prev, 
      filters: { ...prev.filters, ...filters } 
    }));
  }, []);

  // 초기 연결
  useEffect(() => {
    // 테스트용 초기 메시지
    addMessage({
      type: 'info',
      source: 'system',
      message: 'Claude MCP 메시지 시스템 초기화 완료'
    });

    connectWebSocket();

    return () => {
      disconnect();
    };
  }, [connectWebSocket, disconnect, addMessage]);

  // 필터링된 메시지 계산
  const filteredMessages = state.messages.filter(msg => {
    const typeFilter = state.filters[`show${msg.type.charAt(0).toUpperCase() + msg.type.slice(1)}` as keyof typeof state.filters] as boolean;
    const sourceFilter = state.filters.sources.includes(msg.source);
    return typeFilter && sourceFilter;
  });

  return {
    ...state,
    filteredMessages,
    addMessage,
    clearMessages,
    toggleMinimized,
    setAutoScroll,
    updateFilters,
    connectWebSocket,
    disconnect,
    isConnected: wsRef.current?.readyState === WebSocket.OPEN
  };
};