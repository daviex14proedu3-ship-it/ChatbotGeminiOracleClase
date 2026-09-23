import { authStorage } from './api';

type EventCallback = (payload: any) => void;

class SocketClient {
  private ws: WebSocket | null = null;
  private listeners = new Map<string, Set<EventCallback>>();
  private reconnectTimer: any = null;
  private isConnected = false;

  constructor() {
    // Only connect automatically if there is an active session token
    if (authStorage.getToken()) {
      this.connect();
    }
  }

  public connect(): void {
    const token = authStorage.getToken();
    if (!token) {
      return;
    }

    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const url = `${protocol}//${host}?token=${encodeURIComponent(token)}`;

    try {
      this.ws = new WebSocket(url);

      this.ws.onopen = () => {
        this.isConnected = true;
        if (this.reconnectTimer) {
          clearTimeout(this.reconnectTimer);
          this.reconnectTimer = null;
        }
        this.emit('connection_change', { connected: true });
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'auth_error') {
            this.disconnect();
            window.dispatchEvent(new CustomEvent('auth:unauthorized'));
            return;
          }
          if (data.type) {
            this.emit(data.type, data.payload);
          }
        } catch (e) {
          // ignore
        }
      };

      this.ws.onclose = () => {
        this.isConnected = false;
        this.emit('connection_change', { connected: false });
        if (authStorage.getToken()) {
          this.scheduleReconnect();
        }
      };

      this.ws.onerror = () => {
        this.isConnected = false;
      };
    } catch (err) {
      if (authStorage.getToken()) {
        this.scheduleReconnect();
      }
    }
  }

  public disconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.onclose = null;
      this.ws.onerror = null;
      this.ws.close();
      this.ws = null;
    }
    this.isConnected = false;
    this.emit('connection_change', { connected: false });
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, 3000);
  }

  public on(event: string, callback: EventCallback): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);

    return () => {
      this.listeners.get(event)?.delete(callback);
    };
  }

  public emit(event: string, payload: any): void {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      callbacks.forEach((cb) => cb(payload));
    }
  }

  public send(type: string, payload: any = {}): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type, payload }));
    }
  }

  public isSocketOpen(): boolean {
    return this.isConnected;
  }
}

export const socket = new SocketClient();
