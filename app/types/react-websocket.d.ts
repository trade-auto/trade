declare module 'react-websocket' {
  import { Component } from 'react';

  interface WebsocketProps {
    url: string;
    onMessage: (data: string) => void;
    onOpen?: () => void;
    onClose?: () => void;
    onError?: (error: any) => void;
    debug?: boolean;
    reconnect?: boolean;
    protocol?: string;
    reconnectIntervalInMilliSeconds?: number;
    shouldReconnect?: () => boolean;
    options?: {
      [key: string]: any;
    };
    protocols?: string[];
    onSend?: () => any;
  }

  export default class Websocket extends Component<WebsocketProps> {
    sendMessage(message: string): void;
  }
} 