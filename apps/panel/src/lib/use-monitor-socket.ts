"use client";

import { useEffect, useRef } from "react";
import { io, Socket } from "socket.io-client";

// WebSocket event types (mirrored from @healthpanel/shared)
export const WsEvent = {
  HEALTH_UPDATE: "health:update",
  INCIDENT_NEW: "incident:new",
  INCIDENT_RESOLVED: "incident:resolved",
  SERVICE_UPDATE: "service:update",
  RESOURCE_WARNING: "resource:warning",
} as const;

export interface WsHealthUpdate {
  serviceId: number;
  status: string;
  responseTimeMs: number;
  statusCode: number;
  checkedAt: string;
  responseData?: Record<string, unknown> | null;
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

export interface WsResourceWarning {
  serviceId: number;
  serviceName: string;
  warnings: Array<{
    type: "disk" | "memory";
    usedPercent: number;
    threshold: number;
    detail: string;
  }>;
  timestamp: string;
}

type EventHandlers = {
  onHealthUpdate?: (data: WsHealthUpdate) => void;
  onIncidentNew?: (data: WsIncidentNew) => void;
  onIncidentResolved?: (data: WsIncidentResolved) => void;
  onServiceUpdate?: (data: { serviceId: number }) => void;
  onResourceWarning?: (data: WsResourceWarning) => void;
};

// If NEXT_PUBLIC_WS_URL is set (dev), connect to that host.
// Otherwise (production behind Nginx), connect to same origin.
const WS_BASE = process.env["NEXT_PUBLIC_WS_URL"] ?? "";
const WS_NAMESPACE = `${WS_BASE}/monitor`;

/**
 * Hook to connect to the monitor WebSocket namespace.
 * Automatically connects on mount and disconnects on unmount.
 */
export function useMonitorSocket(handlers: EventHandlers): void {
  const socketRef = useRef<Socket | null>(null);
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    const socket = io(WS_NAMESPACE, {
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

    socket.on(WsEvent.RESOURCE_WARNING, (data: WsResourceWarning) => {
      handlersRef.current.onResourceWarning?.(data);
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, []);
}
