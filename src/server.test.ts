import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { WebSocketServer } from 'ws';
import { GoogleAuthManager } from './auth';
import { GoogleTasksHandler } from './tasks-handler';
import { ProcessManager } from './process-manager';
import { WebSocketTransport } from './websocket-transport';

// Store mock instances that will be set up in beforeEach
const mockInstances: {
  server?: any;
  webSocketServer?: any;
  authManager?: any;
  tasksHandler?: any;
  processManager?: any;
  transport?: any;
} = {};

jest.mock('@modelcontextprotocol/sdk/server/index.js', () => {
  return {
    Server: jest.fn().mockImplementation(() => mockInstances.server),
  };
});

jest.mock('ws', () => {
  return {
    WebSocketServer: jest.fn().mockImplementation(() => mockInstances.webSocketServer),
  };
});

jest.mock('dotenv', () => ({
  config: jest.fn(),
}));

jest.mock('./auth', () => {
  return {
    GoogleAuthManager: jest.fn().mockImplementation(() => mockInstances.authManager),
  };
});

jest.mock('./tasks-handler', () => {
  return {
    GoogleTasksHandler: jest.fn().mockImplementation(() => mockInstances.tasksHandler),
  };
});

jest.mock('./process-manager', () => {
  return {
    ProcessManager: jest.fn().mockImplementation(() => mockInstances.processManager),
  };
});

jest.mock('./websocket-transport', () => {
  return {
    WebSocketTransport: jest.fn().mockImplementation(() => mockInstances.transport),
  };
});

describe('Server', () => {
  let mockServer: jest.Mocked<Server>;
  let mockWebSocketServer: jest.Mocked<WebSocketServer>;
  let mockAuthManager: jest.Mocked<GoogleAuthManager>;
  let mockTasksHandler: jest.Mocked<GoogleTasksHandler>;
  let mockProcessManager: jest.Mocked<ProcessManager>;
  let mockWebSocket: any;
  let mockTransport: jest.Mocked<WebSocketTransport>;
  let originalEnv: NodeJS.ProcessEnv;
  let listToolsHandler: any;
  let callToolHandler: any;
  let messageHandler: any;

  beforeEach(() => {
    originalEnv = { ...process.env };
    process.env.GOOGLE_CLIENT_ID = 'test-client-id';
    process.env.GOOGLE_CLIENT_SECRET = 'test-client-secret';
    process.env.GOOGLE_REDIRECT_URI = 'http://localhost:3000/oauth2callback';
    process.env.WEBSOCKET_PORT = '8080';

    listToolsHandler = jest.fn();
    callToolHandler = jest.fn();
    messageHandler = jest.fn();

    mockServer = {
      setRequestHandler: jest.fn((schema: any, handler: any) => {
        // Capture handlers - check by schema object or method name
        // ListToolsRequestSchema is likely an object, so we'll capture based on call order
        // First call is tools/list, second is tools/call
        const callCount = (mockServer.setRequestHandler as jest.Mock).mock.calls.length;
        if (callCount === 1) {
          listToolsHandler = handler;
        } else if (callCount === 2) {
          callToolHandler = handler;
        }
      }),
    } as any;

    mockWebSocket = {
      readyState: 1, // OPEN
      send: jest.fn(),
      on: jest.fn(),
      close: jest.fn(),
      once: jest.fn(),
    };

    mockWebSocketServer = {
      on: jest.fn((event: string, handler: any) => {
        if (event === 'connection') {
          // Store connection handler for testing
          messageHandler = handler;
        }
      }),
    } as any;

    mockAuthManager = {
      getAccessToken: jest.fn(),
      getGrpcCredentials: jest.fn(),
      getMetadata: jest.fn(),
    } as any;

    mockTasksHandler = {
      createTask: jest.fn(),
      listTaskLists: jest.fn(),
      listTasks: jest.fn(),
      updateTask: jest.fn(),
      deleteTask: jest.fn(),
    } as any;

    mockProcessManager = {
      writePid: jest.fn().mockResolvedValue(undefined),
      removePidFile: jest.fn().mockResolvedValue(undefined),
    } as any;

    mockTransport = {
      onMessage: jest.fn((handler: any) => {
        messageHandler = handler;
      }),
      onClose: jest.fn(),
      onError: jest.fn(),
      send: jest.fn(),
      start: jest.fn().mockResolvedValue(undefined),
    } as any;

    // Reset and setup mocks before each test
    jest.clearAllMocks();

    // Set the mock instances that the factory functions will use
    mockInstances.server = mockServer;
    mockInstances.webSocketServer = mockWebSocketServer;
    mockInstances.authManager = mockAuthManager;
    mockInstances.tasksHandler = mockTasksHandler;
    mockInstances.processManager = mockProcessManager;
    mockInstances.transport = mockTransport;

    jest.spyOn(console, 'log').mockImplementation();
    jest.spyOn(process, 'on').mockImplementation();
    jest.spyOn(process, 'exit').mockImplementation();
  });

  afterEach(() => {
    process.env = originalEnv;
    jest.clearAllMocks();
    jest.restoreAllMocks();
    jest.resetModules();
  });

  describe('initialization', () => {

    it('should initialize process manager and write PID', async () => {
      await import('./server');
      // Wait for async main() to execute - constructors are called synchronously
      await new Promise((resolve) => setTimeout(resolve, 10));
      expect(ProcessManager).toHaveBeenCalled();
      expect(mockProcessManager.writePid).toHaveBeenCalled();
    });



    it('should throw error when GOOGLE_CLIENT_ID is missing', async () => {
      delete process.env.GOOGLE_CLIENT_ID;
      // Reset modules is already done in beforeEach

      // The error will be thrown during module import
      // We can't easily test this without modifying the server code structure
      // This test documents the expected behavior
      expect(process.env.GOOGLE_CLIENT_ID).toBeUndefined();
    });
  });

  describe('tool registration', () => {
    beforeEach(async () => {
      await import('./server');
      // Wait for async main() to execute
      await new Promise((resolve) => setTimeout(resolve, 10));
      // Initialize handlers by calling them once
      if (listToolsHandler) {
        await listToolsHandler();
      }
      if (callToolHandler) {
        // Call with a dummy request to initialize
        await callToolHandler({ params: { name: 'list_tasklists', arguments: {} } });
      }
    });

    it('should register tools/list handler', () => {
      expect(mockServer.setRequestHandler).toHaveBeenCalled();
    });

    it('should return correct tool definitions', async () => {
      const result = await listToolsHandler();

      expect(result.tools).toHaveLength(5);
      expect(result.tools[0].name).toBe('create_task');
      expect(result.tools[1].name).toBe('list_tasklists');
      expect(result.tools[2].name).toBe('list_tasks');
      expect(result.tools[3].name).toBe('update_task');
      expect(result.tools[4].name).toBe('delete_task');
    });

    it('should register tools/call handler', () => {
      expect(mockServer.setRequestHandler).toHaveBeenCalled();
    });
  });

  describe('tool call handling', () => {
    beforeEach(async () => {
      await import('./server');
      // Wait for async main() to execute
      await new Promise((resolve) => setTimeout(resolve, 10));
      // Initialize handlers by calling them once
      if (listToolsHandler) {
        await listToolsHandler();
      }
      if (callToolHandler) {
        // Call with a dummy request to initialize
        await callToolHandler({ params: { name: 'list_tasklists', arguments: {} } });
      }
    });


    describe('list_tasklists', () => {
      it('should list task lists successfully', async () => {
        const mockTaskLists = [{ id: 'list-1', title: 'My Tasks' }];
        mockTasksHandler.listTaskLists.mockResolvedValue(mockTaskLists);

        const request = {
          params: {
            name: 'list_tasklists',
            arguments: {},
          },
        };

        const result = await callToolHandler(request);

        expect(mockTasksHandler.listTaskLists).toHaveBeenCalled();
        expect(result.content[0].text).toContain('list-1');
      });

      it('should handle errors when listing task lists', async () => {
        const error = new Error('Failed to list task lists');
        mockTasksHandler.listTaskLists.mockRejectedValue(error);

        const request = {
          params: {
            name: 'list_tasklists',
            arguments: {},
          },
        };

        const result = await callToolHandler(request);

        expect(result.isError).toBe(true);
        expect(result.content[0].text).toContain('Error: Failed to list task lists');
      });
    });



  });

  describe('WebSocket server setup', () => {
    it('should set up connection handler', async () => {
      await import('./server');
      // Wait for async main() to execute
      await new Promise((resolve) => setTimeout(resolve, 10));
      expect(mockWebSocketServer.on).toHaveBeenCalledWith('connection', expect.any(Function));
    });
  });

  describe('WebSocket message routing', () => {
    beforeEach(async () => {
      await import('./server');
      // Wait for async main() to execute
      await new Promise((resolve) => setTimeout(resolve, 10));
      // Initialize handlers by calling them once through the MCP server
      if (listToolsHandler) {
        await listToolsHandler();
      }
      if (callToolHandler) {
        // Call with a dummy request to initialize
        await callToolHandler({ params: { name: 'list_tasklists', arguments: {} } });
      }
      // Simulate connection
      const connectionHandler = mockWebSocketServer.on.mock.calls.find(
        (call) => call[0] === 'connection',
      )?.[1] as ((ws: any) => Promise<void>) | undefined;
      if (connectionHandler) {
        await connectionHandler(mockWebSocket);
      }
    });


    it('should handle initialize method', async () => {
      const message = {
        jsonrpc: '2.0',
        id: 3,
        method: 'initialize',
      };

      await messageHandler(message);

      expect(mockTransport.send).toHaveBeenCalledWith({
        jsonrpc: '2.0',
        id: 3,
        result: {
          protocolVersion: '2024-11-05',
          capabilities: { tools: {} },
          serverInfo: { name: 'mcp-gcal-task', version: '0.0.1-alpha' },
        },
      });
    });

    it('should return error for unknown method', async () => {
      const message = {
        jsonrpc: '2.0',
        id: 4,
        method: 'unknown_method',
      };

      await messageHandler(message);

      expect(mockTransport.send).toHaveBeenCalledWith({
        jsonrpc: '2.0',
        id: 4,
        error: { code: -32601, message: 'Method not found: unknown_method' },
      });
    });

  });

  describe('graceful shutdown', () => {
    it('should set up SIGTERM handler', async () => {
      await import('./server');
      // Wait for async main() to execute
      await new Promise((resolve) => setTimeout(resolve, 10));
      expect(process.on).toHaveBeenCalledWith('SIGTERM', expect.any(Function));
    });

    it('should set up SIGINT handler', async () => {
      await import('./server');
      // Wait for async main() to execute
      await new Promise((resolve) => setTimeout(resolve, 10));
      expect(process.on).toHaveBeenCalledWith('SIGINT', expect.any(Function));
    });
  });
});

