"use client";

import { useEffect, useRef, useCallback } from "react";
import { io, Socket } from "socket.io-client";

// WebSocket event types (mirrored from @healthpanel/shared)
export const WsEvent = {
  HEALTH_UPDATE: "health:update",
  INCIDENT_NEW: "incident:new",
  INCIDENT_RESOLVED: "incident:resolved",
  SERVICE_UPDATE: "service:update",
} as const;

export interface WsHealthUpdate {
  serviceId: number;
  status: string;
  responseTimeMs: number;
  statusCode: number;
  checkedAt: string;
}

export interface WsIncidentNew {
  id: number;
  serviceId: number;
  serviceName: string;
  startedAt: string;
}

export interface WsIncidentResolved {
  id: number;
  serviceId: number;
  serviceName: string;
  resolvedAt: string;
}

type EventHandlers = {
  onHealthUpdate?: (data: WsHealthUpdate) => void;
  onIncidentNew?: (data: WsIncidentNew) => void;
  onIncidentResolved?: (data: WsIncidentResolved) => void;
  onServiceUpdate?: (data: { serviceId: number }) => void;
};

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
const WS_URL = `${API_URL}/monitor`;

/**
 * Hook to connect to the monitor WebSocket namespace.
 * Automatically connects on mount and disconnects on unmount.
 */
export function useMonitorSocket(handlers: EventHandlers): void {
  const socketRef = useRef<Socket | null>(null);
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    const socket = io(WS_URL, {
      transports: ["websocket", "polling"],
      autoConnect: true,
    });

    socketRef.current = socket;

    socket.on(WsEvent.HEALTH_UPDATE, (data: WsHealthUpdate) => {
      handlersRef.current.onHealthUpdate?.(data);
    });

    socket.on(WsEvent.INCIDENT_NEW, (data: WsIncidentNew) => {
      handlersRef.current.onIncidentNew?.(data);
    });

    socket.on(WsEvent.INCIDENT_RESOLVED, (data: WsIncidentResolved) => {
      handlersRef.current.onIncidentResolved?.(data);
    });

    socket.on(WsEvent.SERVICE_UPDATE, (data: { serviceId: number }) => {
      handlersRef.current.onServiceUpdate?.(data);
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, []);
}
