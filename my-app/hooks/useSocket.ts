'use client';

import { useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';

let globalSocket: Socket | null = null;

function getSocket(): Socket {
  if (globalSocket) return globalSocket;

  if (typeof window === 'undefined') {
    throw new Error('Socket can only be used in browser');
  }

  const configuredUrl = process.env.NEXT_PUBLIC_WS_URL?.trim();
  let wsUrl = window.location.origin;

  if (configuredUrl) {
    try {
      const parsed = new URL(configuredUrl);
      const host = parsed.hostname;
      if (host !== 'localhost' && host !== '127.0.0.1' && host !== '0.0.0.0') {
        wsUrl = configuredUrl;
      }
    } catch {
      wsUrl = window.location.origin;
    }
  }

  globalSocket = io(wsUrl, {
    path: '/api/socket',
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    forceNew: false,
    multiplex: true,
  });

  globalSocket.on('connect', () => {
    console.log('[Socket] Connected');
  });

  globalSocket.on('connect_error', (error) => {
    console.warn('[Socket] Connection error:', error.message || error);
  });

  globalSocket.on('error', (error) => {
    console.error('[Socket] Error:', error);
  });

  globalSocket.on('disconnect', (reason) => {
    console.warn('[Socket] Disconnected:', reason);
  });

  return globalSocket;
}

interface UseSocketOptions {
  room?: string;
  events?: Record<string, (data: unknown) => void>;
}

export function useSocket({ room, events }: UseSocketOptions = {}) {
  const socketRef = useRef<Socket | null>(null);
  const wrappedHandlersRef = useRef<Record<string, (data: unknown) => void>>({});
  
  useEffect(() => {
    const socket = getSocket();
    socketRef.current = socket;

    // Clean up old wrapped handlers
    Object.entries(wrappedHandlersRef.current).forEach(([event, wrappedHandler]) => {
      socket.off(event, wrappedHandler);
    });
    wrappedHandlersRef.current = {};

    // Join room if specified - always emit join-room when room prop changes
    // This ensures reconnection works after navigation
    if (room) {
      socket.emit('join-room', room);
    }

    // Register new event handlers
    if (events) {
      Object.entries(events).forEach(([event, handler]) => {
        const wrappedHandler = (data: unknown) => {
          handler(data);
        };
        wrappedHandlersRef.current[event] = wrappedHandler;
        socket.on(event, wrappedHandler);
      });
    }

    return () => {
      // Clean up event listeners on unmount
      Object.entries(wrappedHandlersRef.current).forEach(([event, wrappedHandler]) => {
        socket.off(event, wrappedHandler);
      });
    };
  }, [room, events]);

  const emit = useCallback((event: string, data: unknown) => {
    if (socketRef.current) {
      socketRef.current.emit(event, data);
    }
  }, []);

  return { emit };
}
