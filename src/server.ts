import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import * as dotenv from 'dotenv';
import { WebSocketServer } from 'ws';
import { GoogleAuthManager } from './auth';
import { GoogleTasksHandler } from './tasks-handler';
import { ProcessManager } from './process-manager';
import { WebSocketTransport } from './websocket-transport';

// Load environment variables
dotenv.config();

const WEBSOCKET_PORT = parseInt(process.env.WEBSOCKET_PORT || '8080', 10);
const PID_FILE_PATH = process.env.PID_FILE_PATH;

async function main() {
  // Initialize process manager and write PID
  const processManager = new ProcessManager(PID_FILE_PATH);
  processManager.writePid(process.pid).catch((error) => {
    console.error(`Failed to write PID file: ${error}`);
  });

  // Initialize authentication
  const authConfig = {
    clientId: process.env.GOOGLE_CLIENT_ID || '',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
    redirectUri: process.env.GOOGLE_REDIRECT_URI || '',
  };

  if (!authConfig.clientId || !authConfig.clientSecret) {
    throw new Error('GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be set');
  }

  const authManager = new GoogleAuthManager(authConfig);
  const tasksHandler = new GoogleTasksHandler(authManager);

  // Create MCP server
  const server = new Server(
    {
      name: 'mcp-gcal-task',
      version: '0.0.1-alpha',
    },
    {
      capabilities: {
        tools: {},
      },
    },
  );

  // Store handler references for WebSocket routing
  let listToolsHandlerRef: (() => Promise<any>) | null = null;
  let callToolHandlerRef: ((request: any) => Promise<any>) | null = null;

  // Register tools
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    if (!listToolsHandlerRef) {
      listToolsHandlerRef = async () => {
    return {
      tools: [
        {
          name: 'create_task',
          description: 'Create a new task in a Google Tasks task list',
          inputSchema: {
            type: 'object',
            properties: {
              tasklist: {
                type: 'string',
                description: 'The ID of the task list',
              },
              title: {
                type: 'string',
                description: 'The title of the task',
              },
              notes: {
                type: 'string',
                description: 'Optional notes for the task',
              },
              status: {
                type: 'string',
                enum: ['needsAction', 'completed'],
                description: 'The status of the task',
              },
              due: {
                type: 'string',
                description: 'Due date in ISO 8601 format',
              },
            },
            required: ['tasklist', 'title'],
          },
        },
        {
          name: 'list_tasklists',
          description: 'List all task lists for the authenticated user',
          inputSchema: {
            type: 'object',
            properties: {},
          },
        },
        {
          name: 'list_tasks',
          description: 'List tasks in a specific task list',
          inputSchema: {
            type: 'object',
            properties: {
              tasklist: {
                type: 'string',
                description: 'The ID of the task list',
              },
              showCompleted: {
                type: 'boolean',
                description: 'Whether to show completed tasks',
              },
              maxResults: {
                type: 'number',
                description: 'Maximum number of results to return',
              },
            },
            required: ['tasklist'],
          },
        },
        {
          name: 'update_task',
          description: 'Update an existing task',
          inputSchema: {
            type: 'object',
            properties: {
              tasklist: {
                type: 'string',
                description: 'The ID of the task list',
              },
              taskId: {
                type: 'string',
                description: 'The ID of the task to update',
              },
              title: {
                type: 'string',
                description: 'The new title of the task',
              },
              notes: {
                type: 'string',
                description: 'The new notes for the task',
              },
              status: {
                type: 'string',
                enum: ['needsAction', 'completed'],
                description: 'The new status of the task',
              },
            },
            required: ['tasklist', 'taskId'],
          },
        },
        {
          name: 'delete_task',
          description: 'Delete a task from a task list',
          inputSchema: {
            type: 'object',
            properties: {
              tasklist: {
                type: 'string',
                description: 'The ID of the task list',
              },
              taskId: {
                type: 'string',
                description: 'The ID of the task to delete',
              },
            },
            required: ['tasklist', 'taskId'],
          },
        },
      ],
    };
      };
    }
    return await listToolsHandlerRef();
  });

  // Handle tool calls
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    if (!callToolHandlerRef) {
      callToolHandlerRef = async (_req: any) => {
    const { name, arguments: args } = request.params;

    try {
      switch (name) {
        case 'create_task': {
          const task = await tasksHandler.createTask({
            tasklist: args.tasklist as string,
            task: {
              title: args.title as string,
              notes: args.notes as string | undefined,
              status: args.status as 'needsAction' | 'completed' | undefined,
              due: args.due as string | undefined,
            },
          });
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(task, null, 2),
              },
            ],
          };
        }

        case 'list_tasklists': {
          const taskLists = await tasksHandler.listTaskLists();
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(taskLists, null, 2),
              },
            ],
          };
        }

        case 'list_tasks': {
          const tasks = await tasksHandler.listTasks({
            tasklist: args.tasklist as string,
            showCompleted: args.showCompleted as boolean | undefined,
            maxResults: args.maxResults as number | undefined,
          });
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(tasks, null, 2),
              },
            ],
          };
        }

        case 'update_task': {
          const task = await tasksHandler.updateTask({
            tasklist: args.tasklist as string,
            taskId: args.taskId as string,
            task: {
              title: args.title as string | undefined,
              notes: args.notes as string | undefined,
              status: args.status as 'needsAction' | 'completed' | undefined,
            },
          });
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(task, null, 2),
              },
            ],
          };
        }

        case 'delete_task': {
          await tasksHandler.deleteTask({
            tasklist: args.tasklist as string,
            taskId: args.taskId as string,
          });
          return {
            content: [
              {
                type: 'text',
                text: 'Task deleted successfully',
              },
            ],
          };
        }

        default:
          throw new Error(`Unknown tool: ${name}`);
      }
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Error: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
        isError: true,
      };
    }
      };
    }
    return await callToolHandlerRef(request);
  });

  // Setup graceful shutdown
  const cleanup = async () => {
    await processManager.removePidFile();
    process.exit(0);
  };

  process.on('SIGTERM', cleanup);
  process.on('SIGINT', cleanup);

  // Create WebSocket server
  const wss = new WebSocketServer({ port: WEBSOCKET_PORT });

  wss.on('connection', async (ws) => {
    console.log('MCP client connected via WebSocket');

    const transport = new WebSocketTransport(ws);

    // Handle incoming messages and route to appropriate handlers
    transport.onMessage(async (message: any) => {
      try {
        let result: any;

        if (message.method === 'tools/list') {
          if (listToolsHandlerRef) {
            result = await listToolsHandlerRef();
          } else {
            throw new Error('List tools handler not initialized');
          }
        } else if (message.method === 'tools/call') {
          if (callToolHandlerRef) {
            result = await callToolHandlerRef({ params: message.params });
          } else {
            throw new Error('Call tool handler not initialized');
          }
        } else if (message.method === 'initialize') {
          result = {
            protocolVersion: '2024-11-05',
            capabilities: { tools: {} },
            serverInfo: { name: 'mcp-gcal-task', version: '0.0.1-alpha' },
          };
        } else {
          await transport.send({
            jsonrpc: '2.0',
            id: message.id,
            error: { code: -32601, message: `Method not found: ${message.method}` },
          });
          return;
        }

        await transport.send({
          jsonrpc: '2.0',
          id: message.id,
          result,
        });
      } catch (error) {
        console.error('Error handling request:', error);
        await transport.send({
          jsonrpc: '2.0',
          id: message.id,
          error: {
            code: -32603,
            message: error instanceof Error ? error.message : 'Internal error',
          },
        });
      }
    });

    transport.onClose(() => {
      console.log('MCP client disconnected');
    });

    transport.onError((error) => {
      console.error('WebSocket error:', error);
    });

    await transport.start();
  });

  console.log(`MCP server listening on ws://localhost:${WEBSOCKET_PORT}`);
}

main().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});

