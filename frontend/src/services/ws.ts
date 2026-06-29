/**
 * Framework-agnostic WebSocket client (singleton).
 *
 * Wraps the native WebSocket to deliver validated STATE_UPDATED events to any
 * number of subscribers. It is deliberately free of React/Redux so both state
 * implementations can consume the same instance. Behaviour:
 *
 *   - lazy connect: the socket opens on the first subscriber and closes when the
 *     last one leaves, so nothing connects until something is listening;
 *   - auto-reconnect: unexpected drops retry with exponential backoff;
 *   - safe parsing: only well-formed STATE_UPDATED messages are dispatched.
 */

import type { StateUpdatedEvent, StateUpdatedPayload } from './types';

type StateListener = (payload: StateUpdatedPayload) => void;

// http(s)://host -> ws(s)://host/ws. The backend serves the socket at /ws.
const WS_URL = `${import.meta.env.VITE_API_BASE_URL.replace(/^http/, 'ws')}/ws`;

const INITIAL_RECONNECT_DELAY_MS = 1_000;
const MAX_RECONNECT_DELAY_MS = 30_000;

/** Narrow an unknown socket message to a validated STATE_UPDATED event, or null. */
function parseEvent(data: unknown): StateUpdatedEvent | null {
  if (typeof data !== 'string') return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(data);
  } catch {
    return null;
  }
  if (typeof parsed !== 'object' || parsed === null) return null;
  const message = parsed as { type?: unknown; payload?: unknown };
  if (message.type !== 'STATE_UPDATED') return null;
  if (typeof message.payload !== 'object' || message.payload === null) return null;
  // The backend (Pydantic) guarantees the payload shape; we trust it past here.
  return parsed as StateUpdatedEvent;
}

class WebSocketClient {
  private socket: WebSocket | null = null;
  private readonly listeners = new Set<StateListener>();
  private reconnectAttempts = 0;
  private reconnectTimer: number | null = null;
  private shouldConnect = false;

  /** Register a listener. Returns an unsubscribe function. */
  subscribe(listener: StateListener): () => void {
    this.listeners.add(listener);
    if (this.listeners.size === 1) {
      this.shouldConnect = true;
      this.connect();
    }
    return () => this.unsubscribe(listener);
  }

  private unsubscribe(listener: StateListener): void {
    this.listeners.delete(listener);
    if (this.listeners.size === 0) this.disconnect();
  }

  private connect(): void {
    const socket = new WebSocket(WS_URL);
    this.socket = socket;
    socket.onopen = () => {
      this.reconnectAttempts = 0;
    };
    socket.onmessage = (event: MessageEvent) => {
      const message = parseEvent(event.data);
      if (message) {
        this.listeners.forEach((listener) => listener(message.payload));
      }
    };
    // A failed/closed socket both surface here; reconnect is driven from onclose.
    socket.onclose = () => this.scheduleReconnect();
  }

  private scheduleReconnect(): void {
    this.socket = null;
    if (!this.shouldConnect) return;
    const delay = Math.min(
      INITIAL_RECONNECT_DELAY_MS * 2 ** this.reconnectAttempts,
      MAX_RECONNECT_DELAY_MS,
    );
    this.reconnectAttempts += 1;
    console.warn(`WebSocket closed; reconnecting in ${delay}ms`);
    this.reconnectTimer = window.setTimeout(() => this.connect(), delay);
  }

  private disconnect(): void {
    this.shouldConnect = false;
    if (this.reconnectTimer !== null) {
      window.clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.socket?.close();
    this.socket = null;
    this.reconnectAttempts = 0;
  }
}

export const wsClient = new WebSocketClient();
