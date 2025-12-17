import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';
import { WebSocket } from 'ws';

export class WebSocketTransport implements Transport {
  private ws: WebSocket;
  private messageHandlers: Array<(message: any) => void> = [];

  constructor(ws: WebSocket) {
    this.ws = ws;
    this.setupMessageHandling();
  }

  private setupMessageHandling(): void {
    this.ws.on('message', (data: Buffer) => {
      try {
        const message = JSON.parse(data.toString());
        this.messageHandlers.forEach((handler) => handler(message));
      } catch (error) {
        console.error('Failed to parse WebSocket message:', error);
      }
    });
  }

  async start(): Promise<void> {
    // Transport is ready when WebSocket is open
    if (this.ws.readyState === WebSocket.OPEN) {
      return;
    }
    // Wait for connection to open
    return new Promise((resolve) => {
      if (this.ws.readyState === WebSocket.OPEN) {
        resolve();
      } else {
        this.ws.once('open', () => resolve());
      }
    });
  }

  async send(message: any): Promise<void> {
    if (this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    } else {
      throw new Error('WebSocket is not open');
    }
  }

  async close(): Promise<void> {
    this.ws.close();
  }

  onMessage(handler: (message: any) => void): void {
    this.messageHandlers.push(handler);
  }

  onClose(handler: () => void): void {
    this.ws.on('close', handler);
  }

  onError(handler: (error: Error) => void): void {
    this.ws.on('error', handler);
  }
}

