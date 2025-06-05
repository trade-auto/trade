'use client';

import React, { useRef, useEffect } from 'react';
import { useClaudeMcp } from '@/app/hooks/useClaudeMcp';
import { McpMessage } from '@/app/types/claude-mcp';

interface ClaudeMessageWindowProps {
  className?: string;
  maxMessages?: number;
  websocketUrl?: string;
  windowId?: number;
}

export const ClaudeMessageWindow: React.FC<ClaudeMessageWindowProps> = ({
  className = '',
  maxMessages = 500,
  websocketUrl = 'ws://localhost:8082',
  windowId = 1
}) => {
  const {
    filteredMessages,
    isMinimized,
    autoScroll,
    serverStatus,
    isConnected,
    clearMessages,
    toggleMinimized,
    setAutoScroll,
    updateFilters,
    filters
  } = useClaudeMcp({ websocketUrl, maxMessages });

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    if (autoScroll && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [filteredMessages, autoScroll]);

  const getMessageTypeColor = (type: McpMessage['type']) => {
    switch (type) {
      case 'info': return 'text-blue-400';
      case 'success': return 'text-green-400';
      case 'warning': return 'text-yellow-400';
      case 'error': return 'text-red-400';
      case 'command': return 'text-purple-400';
      case 'response': return 'text-cyan-400';
      default: return 'text-gray-400';
    }
  };

  const getSourceBadgeColor = (source: McpMessage['source']) => {
    switch (source) {
      case 'mcp-server': return 'bg-blue-600 text-white';
      case 'loop-client': return 'bg-green-600 text-white';
      case 'system': return 'bg-gray-600 text-white';
      default: return 'bg-gray-600 text-white';
    }
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('ko-KR', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      fractionalSecondDigits: 3
    });
  };


  if (isMinimized) {
    return (
      <div className={`fixed bottom-4 right-4 z-50 ${className}`}>
        <button
          onClick={toggleMinimized}
          className="bg-gray-800 text-white px-4 py-2 rounded-lg shadow-lg hover:bg-gray-700 transition-colors flex items-center space-x-2"
        >
          <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-400' : 'bg-red-400'}`}></div>
          <span>Claude MCP #{windowId} ({filteredMessages.length})</span>
        </button>
      </div>
    );
  }

  return (
    <div className={`bg-gray-900 border border-gray-700 rounded-lg shadow-xl ${className}`}>
      {/* 헤더 */}
      <div className="flex items-center justify-between p-3 border-b border-gray-700 bg-gray-800 rounded-t-lg">
        <div className="flex items-center space-x-2">
          <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-400 animate-pulse' : 'bg-red-400'}`}></div>
          <h3 className="text-white font-medium">Claude MCP Messages - Window {windowId}</h3>
          <span className="text-xs text-gray-400">({filteredMessages.length})</span>
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setAutoScroll(!autoScroll)}
            className={`text-xs px-2 py-1 rounded ${
              autoScroll 
                ? 'bg-blue-600 text-white' 
                : 'bg-gray-600 text-gray-300'
            } hover:opacity-80 transition-opacity`}
          >
            자동스크롤
          </button>
          <button
            onClick={clearMessages}
            className="text-xs text-red-400 hover:text-red-300 transition-colors"
          >
            지우기
          </button>
          <button
            onClick={toggleMinimized}
            className="text-gray-400 hover:text-white transition-colors"
          >
            −
          </button>
        </div>
      </div>

      {/* 메시지 영역 */}
      <div 
        ref={containerRef}
        className="h-80 overflow-y-auto p-2 space-y-1 bg-gray-900 text-sm"
        onScroll={(e) => {
          const element = e.target as HTMLDivElement;
          const isAtBottom = element.scrollHeight - element.scrollTop === element.clientHeight;
          setAutoScroll(isAtBottom);
        }}
      >
        {filteredMessages.map((msg, index) => (
          <div key={msg.id} className="flex flex-col space-y-1 p-2 rounded bg-gray-800 hover:bg-gray-750 transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <span className="text-cyan-400 font-mono">{windowId}{`>`}</span>
                <span className={`text-xs px-2 py-1 rounded-full ${getSourceBadgeColor(msg.source)}`}>
                  {msg.source}
                </span>
                <span className={`font-medium ${getMessageTypeColor(msg.type)}`}>
                  {msg.type.toUpperCase()}
                </span>
              </div>
              <span className="text-xs text-gray-500">{formatTime(msg.timestamp)}</span>
            </div>
            <div className="text-white ml-6">{msg.message}</div>
            {msg.details && (
              <div className="text-xs text-gray-400 ml-10 border-l-2 border-gray-600 pl-2">
                {msg.details}
              </div>
            )}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* 상태 표시줄 */}
      <div className="flex items-center justify-between p-2 border-t border-gray-700 bg-gray-800 rounded-b-lg text-xs text-gray-400">
        <div className="flex items-center space-x-4">
          <span className={isConnected ? 'text-green-400' : 'text-red-400'}>
            {isConnected ? '연결됨' : '연결 끊김'} ● MCP Server
          </span>
          <span className="text-blue-400">
            Port: {serverStatus.port}
          </span>
          <span>
            상태: {serverStatus.status}
          </span>
        </div>
        <div>
          {autoScroll ? '자동스크롤 켜짐' : '자동스크롤 꺼짐'}
        </div>
      </div>
    </div>
  );
};

export default ClaudeMessageWindow;