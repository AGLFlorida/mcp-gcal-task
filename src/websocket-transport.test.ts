import { WebSocket } from 'ws';
import { WebSocketTransport } from './websocket-transport';

jest.mock('ws');

describe('WebSocketTransport', () => {
  let mockWebSocket: jest.Mocked<WebSocket>;
  let transport: WebSocketTransport;
  //let messageHandlers: Array<(data: Buffer) => void>;
  let eventHandlers: {
    message?: (data: Buffer) => void;
    close?: () => void;
    error?: (error: Error) => void;
    open?: () => void;
  };

  beforeEach(() => {
    //messageHandlers = [];
    eventHandlers = {};

    mockWebSocket = {
      on: jest.fn((event: string, handler: any) => {
        if (event === 'message') {
          eventHandlers.message = handler;
        } else if (event === 'close') {
          eventHandlers.close = handler;
        } else if (event === 'error') {
          eventHandlers.error = handler;
        } else if (event === 'open') {
          eventHandlers.open = handler;
        }
      }),
      once: jest.fn((event: string, handler: any) => {
        if (event === 'open') {
          eventHandlers.open = handler;
        }
      }),
      send: jest.fn(),
      close: jest.fn(),
    } as any;

    Object.defineProperty(mockWebSocket, 'readyState', {
      value: WebSocket.OPEN,
      writable: true,
      configurable: true,
    });

    (WebSocket as jest.MockedClass<typeof WebSocket>).mockImplementation(() => {
      return mockWebSocket;
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with WebSocket and set up message handling', () => {
      transport = new WebSocketTransport(mockWebSocket);

      expect(mockWebSocket.on).toHaveBeenCalledWith('message', expect.any(Function));
    });

    it('should register message handler that parses JSON', () => {
      transport = new WebSocketTransport(mockWebSocket);
      const testMessage = { jsonrpc: '2.0', id: 1, method: 'test' };
      const buffer = Buffer.from(JSON.stringify(testMessage));

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      eventHandlers.message!(buffer);

      expect(consoleSpy).not.toHaveBeenCalled();
    });
  });

  describe('start', () => {
    it('should return immediately if WebSocket is already OPEN', async () => {
      Object.defineProperty(mockWebSocket, 'readyState', {
        value: WebSocket.OPEN,
        writable: true,
        configurable: true,
      });
      transport = new WebSocketTransport(mockWebSocket);

      await expect(transport.start()).resolves.toBeUndefined();
    });

    it('should wait for open event if WebSocket is not OPEN', async () => {
      Object.defineProperty(mockWebSocket, 'readyState', {
        value: WebSocket.CONNECTING,
        writable: true,
        configurable: true,
      });
      transport = new WebSocketTransport(mockWebSocket);

      const startPromise = transport.start();

      // Simulate WebSocket opening
      setTimeout(() => {
        Object.defineProperty(mockWebSocket, 'readyState', {
          value: WebSocket.OPEN,
          writable: true,
          configurable: true,
        });
        if (eventHandlers.open) {
          eventHandlers.open();
        }
      }, 10);

      await expect(startPromise).resolves.toBeUndefined();
      expect(mockWebSocket.once).toHaveBeenCalledWith('open', expect.any(Function));
    });

    it('should resolve immediately if WebSocket becomes OPEN during check', async () => {
      let readyStateCheck = 0;
      Object.defineProperty(mockWebSocket, 'readyState', {
        get: jest.fn(() => {
          readyStateCheck++;
          return readyStateCheck === 1 ? WebSocket.CONNECTING : WebSocket.OPEN;
        }),
      });

      transport = new WebSocketTransport(mockWebSocket);

      await expect(transport.start()).resolves.toBeUndefined();
    });
  });

  describe('send', () => {
    beforeEach(() => {
      transport = new WebSocketTransport(mockWebSocket);
    });

    it('should send JSON stringified message when WebSocket is OPEN', async () => {
      Object.defineProperty(mockWebSocket, 'readyState', {
        value: WebSocket.OPEN,
        writable: true,
        configurable: true,
      });
      const message = { jsonrpc: '2.0', id: 1, result: { test: 'data' } };

      await transport.send(message);

      expect(mockWebSocket.send).toHaveBeenCalledWith(JSON.stringify(message));
    });

    it('should throw error when WebSocket is not OPEN', async () => {
      Object.defineProperty(mockWebSocket, 'readyState', {
        value: WebSocket.CLOSED,
        writable: true,
        configurable: true,
      });
      const message = { jsonrpc: '2.0', id: 1, result: {} };

      await expect(transport.send(message)).rejects.toThrow('WebSocket is not open');
      expect(mockWebSocket.send).not.toHaveBeenCalled();
    });

    it('should throw error when WebSocket is CONNECTING', async () => {
      Object.defineProperty(mockWebSocket, 'readyState', {
        value: WebSocket.CONNECTING,
        writable: true,
        configurable: true,
      });
      const message = { jsonrpc: '2.0', id: 1, result: {} };

      await expect(transport.send(message)).rejects.toThrow('WebSocket is not open');
    });
  });

  describe('close', () => {
    beforeEach(() => {
      transport = new WebSocketTransport(mockWebSocket);
    });

    it('should close WebSocket connection', async () => {
      await transport.close();

      expect(mockWebSocket.close).toHaveBeenCalled();
    });
  });

  describe('onMessage', () => {
    beforeEach(() => {
      transport = new WebSocketTransport(mockWebSocket);
    });

    it('should register message handler', () => {
      const handler = jest.fn();
      transport.onMessage(handler);

      const testMessage = { jsonrpc: '2.0', id: 1, method: 'test' };
      const buffer = Buffer.from(JSON.stringify(testMessage));

      eventHandlers.message!(buffer);

      expect(handler).toHaveBeenCalledWith(testMessage);
    });

    it('should register multiple message handlers', () => {
      const handler1 = jest.fn();
      const handler2 = jest.fn();
      transport.onMessage(handler1);
      transport.onMessage(handler2);

      const testMessage = { jsonrpc: '2.0', id: 1, method: 'test' };
      const buffer = Buffer.from(JSON.stringify(testMessage));

      eventHandlers.message!(buffer);

      expect(handler1).toHaveBeenCalledWith(testMessage);
      expect(handler2).toHaveBeenCalledWith(testMessage);
    });

    it('should handle invalid JSON gracefully', () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      const handler = jest.fn();
      transport.onMessage(handler);

      const invalidBuffer = Buffer.from('invalid json');

      eventHandlers.message!(invalidBuffer);

      expect(consoleSpy).toHaveBeenCalledWith(
        'Failed to parse WebSocket message:',
        expect.any(Error),
      );
      expect(handler).not.toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe('onClose', () => {
    beforeEach(() => {
      transport = new WebSocketTransport(mockWebSocket);
    });

    it('should register close handler', () => {
      const handler = jest.fn();
      transport.onClose(handler);

      expect(mockWebSocket.on).toHaveBeenCalledWith('close', handler);
    });

    it('should call handler when WebSocket closes', () => {
      const handler = jest.fn();
      transport.onClose(handler);

      eventHandlers.close!();

      expect(handler).toHaveBeenCalled();
    });
  });

  describe('onError', () => {
    beforeEach(() => {
      transport = new WebSocketTransport(mockWebSocket);
    });

    it('should register error handler', () => {
      const handler = jest.fn();
      transport.onError(handler);

      expect(mockWebSocket.on).toHaveBeenCalledWith('error', handler);
    });

    it('should call handler when WebSocket errors', () => {
      const handler = jest.fn();
      const error = new Error('WebSocket error');
      transport.onError(handler);

      eventHandlers.error!(error);

      expect(handler).toHaveBeenCalledWith(error);
    });
  });

  describe('message handling', () => {
    beforeEach(() => {
      transport = new WebSocketTransport(mockWebSocket);
    });

    it('should parse JSON messages and call registered handlers', () => {
      const handler = jest.fn();
      transport.onMessage(handler);

      const testMessage = { jsonrpc: '2.0', id: 1, method: 'tools/list' };
      const buffer = Buffer.from(JSON.stringify(testMessage));

      eventHandlers.message!(buffer);

      expect(handler).toHaveBeenCalledWith(testMessage);
    });

    it('should handle complex nested JSON messages', () => {
      const handler = jest.fn();
      transport.onMessage(handler);

      const complexMessage = {
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/call',
        params: {
          name: 'create_task',
          arguments: {
            tasklist: '@default',
            title: 'Test Task',
            notes: 'Test notes',
          },
        },
      };
      const buffer = Buffer.from(JSON.stringify(complexMessage));

      eventHandlers.message!(buffer);

      expect(handler).toHaveBeenCalledWith(complexMessage);
    });

    it('should handle empty message object', () => {
      const handler = jest.fn();
      transport.onMessage(handler);

      const emptyMessage = {};
      const buffer = Buffer.from(JSON.stringify(emptyMessage));

      eventHandlers.message!(buffer);

      expect(handler).toHaveBeenCalledWith(emptyMessage);
    });
  });
});

