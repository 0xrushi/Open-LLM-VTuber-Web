/* eslint-disable react/jsx-no-constructed-context-values */
import React, { useContext, useCallback } from 'react';
import { wsService } from '@/services/websocket-service';
import { useLocalStorage } from '@/hooks/utils/use-local-storage';

const host = typeof window !== 'undefined' ? window.location.host : '127.0.0.1:12393';
const wsProtocol = typeof window !== 'undefined' && window.location.protocol === 'https:' ? 'wss:' : 'ws:';
const httpProtocol = typeof window !== 'undefined' && window.location.protocol === 'https:' ? 'https:' : 'http:';
const DEFAULT_WS_URL = `${wsProtocol}//${host}/client-ws`;
const DEFAULT_BASE_URL = `${httpProtocol}//${host}`;

export interface HistoryInfo {
  uid: string;
  latest_message: {
    role: 'human' | 'ai';
    timestamp: string;
    content: string;
  } | null;
  timestamp: string | null;
}

interface WebSocketContextProps {
  sendMessage: (message: object) => void;
  wsState: string;
  reconnect: () => void;
  wsUrl: string;
  setWsUrl: (url: string) => void;
  baseUrl: string;
  setBaseUrl: (url: string) => void;
}

export const WebSocketContext = React.createContext<WebSocketContextProps>({
  sendMessage: wsService.sendMessage.bind(wsService),
  wsState: 'CLOSED',
  reconnect: () => wsService.connect(DEFAULT_WS_URL),
  wsUrl: DEFAULT_WS_URL,
  setWsUrl: () => {},
  baseUrl: DEFAULT_BASE_URL,
  setBaseUrl: () => {},
});

export function useWebSocket() {
  const context = useContext(WebSocketContext);
  if (!context) {
    throw new Error('useWebSocket must be used within a WebSocketProvider');
  }
  return context;
}

export const defaultWsUrl = DEFAULT_WS_URL;
export const defaultBaseUrl = DEFAULT_BASE_URL;

export function WebSocketProvider({ children }: { children: React.ReactNode }) {
  const [wsUrl, setWsUrl] = useLocalStorage('wsUrl', DEFAULT_WS_URL);
  const [baseUrl, setBaseUrl] = useLocalStorage('baseUrl', DEFAULT_BASE_URL);

  // Auto-fix: If we are on HTTPS but the saved URLs are HTTP or pointing to the wrong port,
  // reset them to the default (which uses the current host/proxy).
  React.useEffect(() => {
    if (typeof window !== 'undefined' && window.location.protocol === 'https:') {
      const isIncorrectProtocol = wsUrl.startsWith('ws:') || baseUrl.startsWith('http:');
      const isIncorrectPort = (wsUrl.includes(':12393') || baseUrl.includes(':12393')) && !window.location.host.includes(':12393');
      
      if (isIncorrectProtocol || isIncorrectPort) {
        console.log('Detected incorrect connection URLs for HTTPS context. Force resetting to defaults.');
        // Directly update localStorage to be sure
        localStorage.setItem('wsUrl', JSON.stringify(DEFAULT_WS_URL));
        localStorage.setItem('baseUrl', JSON.stringify(DEFAULT_BASE_URL));
        setWsUrl(DEFAULT_WS_URL);
        setBaseUrl(DEFAULT_BASE_URL);
        
        // Force a page reload to ensure everything is clean if we just fixed a major port mismatch
        if (isIncorrectPort) {
          window.location.reload();
        }
      }
    }
  }, [wsUrl, baseUrl, setWsUrl, setBaseUrl]);

  const handleSetWsUrl = useCallback((url: string) => {
    setWsUrl(url);
    wsService.connect(url);
  }, [setWsUrl]);

  const value = {
    sendMessage: wsService.sendMessage.bind(wsService),
    wsState: 'CLOSED',
    reconnect: () => wsService.connect(wsUrl),
    wsUrl,
    setWsUrl: handleSetWsUrl,
    baseUrl,
    setBaseUrl,
  };

  return (
    <WebSocketContext.Provider value={value}>
      {children}
    </WebSocketContext.Provider>
  );
}
