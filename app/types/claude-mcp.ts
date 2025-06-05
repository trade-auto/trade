export interface McpMessage {
  id: string;
  timestamp: Date;
  type: 'info' | 'success' | 'warning' | 'error' | 'command' | 'response';
  source: 'mcp-server' | 'loop-client' | 'system';
  message: string;
  details?: string;
  metadata?: {
    processId?: number;
    command?: string;
    exitCode?: number;
    duration?: number;
    fileChange?: {
      path: string;
      action: 'added' | 'modified' | 'deleted';
    };
  };
}

export interface McpConnection {
  id: string;
  type: 'mcp-server' | 'loop-client';
  status: 'connected' | 'disconnected' | 'connecting' | 'error';
  url: string;
  lastPing?: Date;
  connectionTime?: Date;
  messageCount: number;
}

export interface McpServerStatus {
  status: 'running' | 'stopped' | 'error';
  port: number;
  uptime?: number;
  clientCount: number;
  lastActivity?: Date;
}

export interface LoopClientCommand {
  id: string;
  command: string;
  workingDirectory: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  startTime?: Date;
  endTime?: Date;
  output?: string[];
  errorOutput?: string[];
  exitCode?: number;
}

export interface FileSystemEvent {
  type: 'file-added' | 'file-modified' | 'file-deleted' | 'directory-created' | 'directory-deleted';
  path: string;
  timestamp: Date;
  size?: number;
  isDirectory: boolean;
}

export interface WebSocketMessage {
  type: 'message' | 'command' | 'status' | 'file-event' | 'ping' | 'pong';
  data: McpMessage | LoopClientCommand | FileSystemEvent | McpServerStatus;
  timestamp: string;
}

export interface ClaudeMessageWindowState {
  messages: McpMessage[];
  connections: McpConnection[];
  serverStatus: McpServerStatus;
  isMinimized: boolean;
  autoScroll: boolean;
  maxMessages: number;
  filters: {
    showInfo: boolean;
    showSuccess: boolean;
    showWarning: boolean;
    showError: boolean;
    showCommand: boolean;
    showResponse: boolean;
    sources: ('mcp-server' | 'loop-client' | 'system')[];
  };
}