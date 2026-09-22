import { WebSocket, WebSocketServer } from 'ws';

export interface LogEntry {
  id: string;
  timestamp: string;
  level: 'info' | 'success' | 'warn' | 'error' | 'failover';
  source: 'whatsapp' | 'ai' | 'bulk' | 'groups' | 'system';
  message: string;
  details?: any;
}

class EventBroadcaster {
  private wss: WebSocketServer | null = null;
  private logs: LogEntry[] = [];
  private readonly MAX_LOGS = 200;

  public setWss(wss: WebSocketServer) {
    this.wss = wss;
  }

  public broadcast(type: string, payload: any) {
    if (!this.wss) return;
    const data = JSON.stringify({ type, payload, timestamp: new Date().toISOString() });
    this.wss.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        try {
          client.send(data);
        } catch (err) {
          console.error('Error broadcasting to WS client:', err);
        }
      }
    });
  }

  public log(level: LogEntry['level'], source: LogEntry['source'], message: string, details?: any) {
    const entry: LogEntry = {
      id: 'log-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
      timestamp: new Date().toISOString(),
      level,
      source,
      message,
      details,
    };

    this.logs.unshift(entry);
    if (this.logs.length > this.MAX_LOGS) {
      this.logs.pop();
    }

    // Console output with color indicator
    const prefix = `[${entry.source.toUpperCase()}] [${entry.level.toUpperCase()}]:`;
    if (level === 'error') console.error(prefix, message, details || '');
    else if (level === 'warn' || level === 'failover') console.warn(prefix, message, details || '');
    else console.log(prefix, message);

    // Broadcast log in real time to UI
    this.broadcast('log', entry);

    if (level === 'failover') {
      this.broadcast('failover_alert', {
        message,
        details,
        timestamp: entry.timestamp,
      });
    }

    return entry;
  }

  public getRecentLogs(): LogEntry[] {
    return this.logs;
  }

  public clearLogs(): void {
    this.logs = [];
    this.broadcast('logs_cleared', {});
  }
}

export const eventBus = new EventBroadcaster();
