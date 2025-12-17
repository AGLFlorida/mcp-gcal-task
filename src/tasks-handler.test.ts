import { GoogleTasksHandler, Task, CreateTaskRequest, ListTasksRequest, UpdateTaskRequest, DeleteTaskRequest } from './tasks-handler';
import { GoogleAuthManager } from './auth';

jest.mock('./auth');
jest.mock('@grpc/grpc-js');
jest.mock('@grpc/proto-loader');

describe('GoogleTasksHandler', () => {
  let mockAuthManager: jest.Mocked<GoogleAuthManager>;
  let tasksHandler: GoogleTasksHandler;

  beforeEach(() => {
    mockAuthManager = {
      getGrpcCredentials: jest.fn(),
      getMetadata: jest.fn(),
    } as any;

    tasksHandler = new GoogleTasksHandler(mockAuthManager);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with auth manager', () => {
      expect(tasksHandler).toBeInstanceOf(GoogleTasksHandler);
    });
  });

  describe('listTaskLists', () => {
    it('should throw error about proto definitions not configured', async () => {
      mockAuthManager.getGrpcCredentials.mockResolvedValue({} as any);
      mockAuthManager.getMetadata.mockResolvedValue({} as any);

      await expect(tasksHandler.listTaskLists()).rejects.toThrow(
        'gRPC proto definitions not yet configured',
      );
    });

    it('should call auth manager methods before throwing', async () => {
      mockAuthManager.getGrpcCredentials.mockResolvedValue({} as any);
      mockAuthManager.getMetadata.mockResolvedValue({} as any);

      try {
        await tasksHandler.listTaskLists();
      } catch (error) {
        // Expected to throw
      }

      expect(mockAuthManager.getGrpcCredentials).toHaveBeenCalled();
      expect(mockAuthManager.getMetadata).toHaveBeenCalled();
    });

    it('should wrap errors with descriptive message', async () => {
      const error = new Error('Auth error');
      mockAuthManager.getGrpcCredentials.mockRejectedValue(error);

      await expect(tasksHandler.listTaskLists()).rejects.toThrow(
        'Failed to list task lists: Error: Auth error',
      );
    });
  });

  describe('createTask', () => {
    const createRequest: CreateTaskRequest = {
      tasklist: 'test-tasklist-id',
      task: {
        title: 'Test Task',
        notes: 'Test notes',
        status: 'needsAction',
        due: '2024-12-31T23:59:59Z',
      },
    };

    it('should throw error about proto definitions not configured', async () => {
      mockAuthManager.getGrpcCredentials.mockResolvedValue({} as any);
      mockAuthManager.getMetadata.mockResolvedValue({} as any);

      await expect(tasksHandler.createTask(createRequest)).rejects.toThrow(
        'gRPC proto definitions not yet configured',
      );
    });

    it('should call auth manager methods before throwing', async () => {
      mockAuthManager.getGrpcCredentials.mockResolvedValue({} as any);
      mockAuthManager.getMetadata.mockResolvedValue({} as any);

      try {
        await tasksHandler.createTask(createRequest);
      } catch (error) {
        // Expected to throw
      }

      expect(mockAuthManager.getGrpcCredentials).toHaveBeenCalled();
      expect(mockAuthManager.getMetadata).toHaveBeenCalled();
    });

    it('should handle task with minimal required fields', async () => {
      const minimalRequest: CreateTaskRequest = {
        tasklist: 'test-tasklist-id',
        task: {
          title: 'Minimal Task',
        },
      };

      mockAuthManager.getGrpcCredentials.mockResolvedValue({} as any);
      mockAuthManager.getMetadata.mockResolvedValue({} as any);

      await expect(tasksHandler.createTask(minimalRequest)).rejects.toThrow(
        'gRPC proto definitions not yet configured',
      );
    });

    it('should wrap errors with descriptive message', async () => {
      const error = new Error('Auth error');
      mockAuthManager.getGrpcCredentials.mockRejectedValue(error);

      await expect(tasksHandler.createTask(createRequest)).rejects.toThrow(
        'Failed to create task: Error: Auth error',
      );
    });
  });

  describe('listTasks', () => {
    const listRequest: ListTasksRequest = {
      tasklist: 'test-tasklist-id',
      showCompleted: true,
      maxResults: 10,
    };

    it('should throw error about proto definitions not configured', async () => {
      mockAuthManager.getGrpcCredentials.mockResolvedValue({} as any);
      mockAuthManager.getMetadata.mockResolvedValue({} as any);

      await expect(tasksHandler.listTasks(listRequest)).rejects.toThrow(
        'gRPC proto definitions not yet configured',
      );
    });

    it('should call auth manager methods before throwing', async () => {
      mockAuthManager.getGrpcCredentials.mockResolvedValue({} as any);
      mockAuthManager.getMetadata.mockResolvedValue({} as any);

      try {
        await tasksHandler.listTasks(listRequest);
      } catch (error) {
        // Expected to throw
      }

      expect(mockAuthManager.getGrpcCredentials).toHaveBeenCalled();
      expect(mockAuthManager.getMetadata).toHaveBeenCalled();
    });

    it('should handle request with optional parameters', async () => {
      const minimalRequest: ListTasksRequest = {
        tasklist: 'test-tasklist-id',
      };

      mockAuthManager.getGrpcCredentials.mockResolvedValue({} as any);
      mockAuthManager.getMetadata.mockResolvedValue({} as any);

      await expect(tasksHandler.listTasks(minimalRequest)).rejects.toThrow(
        'gRPC proto definitions not yet configured',
      );
    });

    it('should wrap errors with descriptive message', async () => {
      const error = new Error('Auth error');
      mockAuthManager.getGrpcCredentials.mockRejectedValue(error);

      await expect(tasksHandler.listTasks(listRequest)).rejects.toThrow(
        'Failed to list tasks: Error: Auth error',
      );
    });
  });

  describe('updateTask', () => {
    const updateRequest: UpdateTaskRequest = {
      tasklist: 'test-tasklist-id',
      taskId: 'test-task-id',
      task: {
        title: 'Updated Task',
        notes: 'Updated notes',
        status: 'completed',
      },
    };

    it('should throw error about proto definitions not configured', async () => {
      mockAuthManager.getGrpcCredentials.mockResolvedValue({} as any);
      mockAuthManager.getMetadata.mockResolvedValue({} as any);

      await expect(tasksHandler.updateTask(updateRequest)).rejects.toThrow(
        'gRPC proto definitions not yet configured',
      );
    });

    it('should call auth manager methods before throwing', async () => {
      mockAuthManager.getGrpcCredentials.mockResolvedValue({} as any);
      mockAuthManager.getMetadata.mockResolvedValue({} as any);

      try {
        await tasksHandler.updateTask(updateRequest);
      } catch (error) {
        // Expected to throw
      }

      expect(mockAuthManager.getGrpcCredentials).toHaveBeenCalled();
      expect(mockAuthManager.getMetadata).toHaveBeenCalled();
    });

    it('should handle partial task updates', async () => {
      const partialRequest: UpdateTaskRequest = {
        tasklist: 'test-tasklist-id',
        taskId: 'test-task-id',
        task: {
          status: 'completed',
        },
      };

      mockAuthManager.getGrpcCredentials.mockResolvedValue({} as any);
      mockAuthManager.getMetadata.mockResolvedValue({} as any);

      await expect(tasksHandler.updateTask(partialRequest)).rejects.toThrow(
        'gRPC proto definitions not yet configured',
      );
    });

    it('should wrap errors with descriptive message', async () => {
      const error = new Error('Auth error');
      mockAuthManager.getGrpcCredentials.mockRejectedValue(error);

      await expect(tasksHandler.updateTask(updateRequest)).rejects.toThrow(
        'Failed to update task: Error: Auth error',
      );
    });
  });

  describe('deleteTask', () => {
    const deleteRequest: DeleteTaskRequest = {
      tasklist: 'test-tasklist-id',
      taskId: 'test-task-id',
    };

    it('should throw error about proto definitions not configured', async () => {
      mockAuthManager.getGrpcCredentials.mockResolvedValue({} as any);
      mockAuthManager.getMetadata.mockResolvedValue({} as any);

      await expect(tasksHandler.deleteTask(deleteRequest)).rejects.toThrow(
        'gRPC proto definitions not yet configured',
      );
    });

    it('should call auth manager methods before throwing', async () => {
      mockAuthManager.getGrpcCredentials.mockResolvedValue({} as any);
      mockAuthManager.getMetadata.mockResolvedValue({} as any);

      try {
        await tasksHandler.deleteTask(deleteRequest);
      } catch (error) {
        // Expected to throw
      }

      expect(mockAuthManager.getGrpcCredentials).toHaveBeenCalled();
      expect(mockAuthManager.getMetadata).toHaveBeenCalled();
    });

    it('should wrap errors with descriptive message', async () => {
      const error = new Error('Auth error');
      mockAuthManager.getGrpcCredentials.mockRejectedValue(error);

      await expect(tasksHandler.deleteTask(deleteRequest)).rejects.toThrow(
        'Failed to delete task: Error: Auth error',
      );
    });
  });
});

