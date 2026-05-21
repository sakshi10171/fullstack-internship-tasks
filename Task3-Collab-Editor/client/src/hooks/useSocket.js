// Import required React hooks and socket.io client
import { useEffect, useRef, useCallback } from 'react';
import { io } from 'socket.io-client';

// Backend socket server URL
const SOCKET_URL =
  process.env.REACT_APP_SOCKET_URL || 'http://localhost:5000';

// Custom hook for socket connection handling
export const useSocket = () => {

  // Store socket instance using useRef
  const socketRef = useRef(null);

  // Function to establish socket connection
  const connect = useCallback(() => {

    // Create socket instance if not already created
    if (!socketRef.current) {

      socketRef.current = io(SOCKET_URL, {

        // Prevent automatic connection
        autoConnect: false,

        // Allowed transport methods
        transports: ['websocket', 'polling'],
      });
    }

    // Connect socket if not already connected
    if (!socketRef.current.connected) {
      socketRef.current.connect();
    }

    return socketRef.current;

  }, []);

  // Function to disconnect socket
  const disconnect = useCallback(() => {

    if (socketRef.current) {

      // Disconnect active socket connection
      socketRef.current.disconnect();

      // Clear socket reference
      socketRef.current = null;
    }

  }, []);

  // Function to emit/send socket events
  const emit = useCallback((event, data) => {

    // Emit event only if socket is connected
    if (socketRef.current?.connected) {

      socketRef.current.emit(event, data);
    }

  }, []);

  // Function to listen for socket events
  const on = useCallback((event, handler) => {

    socketRef.current?.on(event, handler);

  }, []);

  // Function to remove socket event listeners
  const off = useCallback((event, handler) => {

    socketRef.current?.off(event, handler);

  }, []);

  // Cleanup socket connection when component unmounts
  useEffect(() => {

    return () => {
      disconnect();
    };

  }, [disconnect]);

  // Return socket utility functions
  return {
    connect,
    disconnect,
    emit,
    on,
    off,
    socketRef
  };
};
