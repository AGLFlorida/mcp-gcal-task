import * as fs from 'fs';
import * as path from 'path';
import { ProcessManager } from './process-manager';

jest.mock('fs', () => ({
  readFile: jest.fn(),
  writeFile: jest.fn(),
  unlink: jest.fn(),
  access: jest.fn(),
}));

jest.mock('util', () => ({
  promisify: jest.fn((fn: jest.Mock) => {
    return jest.fn((...args: any[]) => {
      return new Promise((resolve, reject) => {
        fn(...args, (err: Error | null, result?: any) => {
          if (err) reject(err);
          else resolve(result);
        });
      });
    });
  }),
}));

describe('ProcessManager', () => {
  let processManager: ProcessManager;
  const mockPid = 12345;
  const customPidPath = '/custom/path/.pid';

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(process, 'kill').mockImplementation(() => true);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('constructor', () => {
    it('should use default PID file path when not provided', () => {
      processManager = new ProcessManager();
      const expectedPath = path.join(process.cwd(), '.pid');

      expect(processManager.getPidFilePath()).toBe(expectedPath);
    });

    it('should use custom PID file path when provided', () => {
      processManager = new ProcessManager(customPidPath);

      expect(processManager.getPidFilePath()).toBe(customPidPath);
    });
  });

  describe('writePid', () => {
    beforeEach(() => {
      processManager = new ProcessManager();
    });

    it('should write PID to file successfully', async () => {
      (fs.writeFile as unknown as jest.Mock).mockImplementation((...args: any[]) => {
        const callback = args[args.length - 1];
        if (typeof callback === 'function') {
          callback(null);
        }
      });

      await processManager.writePid(mockPid);

      expect(fs.writeFile).toHaveBeenCalledWith(
        processManager.getPidFilePath(),
        mockPid.toString(),
        'utf8',
        expect.any(Function),
      );
    });

    it('should throw error when file write fails', async () => {
      const error = new Error('Write failed');
      (fs.writeFile as unknown as jest.Mock).mockImplementation((...args: any[]) => {
        const callback = args[args.length - 1];
        if (typeof callback === 'function') {
          callback(error);
        }
      });

      await expect(processManager.writePid(mockPid)).rejects.toThrow(
        'Failed to write PID file: Error: Write failed',
      );
    });
  });

  describe('readPid', () => {
    beforeEach(() => {
      processManager = new ProcessManager();
    });

    it('should read PID from file successfully', async () => {
      (fs.access as unknown as jest.Mock).mockImplementation((...args: any[]) => {
        const callback = args[args.length - 1];
        if (typeof callback === 'function') {
          callback(null);
        }
      });
      (fs.readFile as unknown as jest.Mock).mockImplementation((...args: any[]) => {
        const callback = args[args.length - 1];
        if (typeof callback === 'function') {
          callback(null, mockPid.toString());
        }
      });

      const result = await processManager.readPid();

      expect(fs.access).toHaveBeenCalledWith(
        processManager.getPidFilePath(),
        expect.any(Function),
      );
      expect(fs.readFile).toHaveBeenCalledWith(
        processManager.getPidFilePath(),
        'utf8',
        expect.any(Function),
      );
      expect(result).toBe(mockPid);
    });

    it('should return null when file does not exist', async () => {
      const error = new Error('File not found') as NodeJS.ErrnoException;
      error.code = 'ENOENT';
      (fs.access as unknown as jest.Mock).mockImplementation((...args: any[]) => {
        const callback = args[args.length - 1];
        if (typeof callback === 'function') {
          callback(error);
        }
      });

      const result = await processManager.readPid();

      expect(result).toBeNull();
      expect(fs.readFile).not.toHaveBeenCalled();
    });

    it('should return null when PID is invalid (NaN)', async () => {
      (fs.access as unknown as jest.Mock).mockImplementation((...args: any[]) => {
        const callback = args[args.length - 1];
        if (typeof callback === 'function') {
          callback(null);
        }
      });
      (fs.readFile as unknown as jest.Mock).mockImplementation((...args: any[]) => {
        const callback = args[args.length - 1];
        if (typeof callback === 'function') {
          callback(null, 'invalid-pid');
        }
      });

      const result = await processManager.readPid();

      expect(result).toBeNull();
    });

    it('should return null when PID file is empty', async () => {
      (fs.access as unknown as jest.Mock).mockImplementation((...args: any[]) => {
        const callback = args[args.length - 1];
        if (typeof callback === 'function') {
          callback(null);
        }
      });
      (fs.readFile as unknown as jest.Mock).mockImplementation((...args: any[]) => {
        const callback = args[args.length - 1];
        if (typeof callback === 'function') {
          callback(null, '');
        }
      });

      const result = await processManager.readPid();

      expect(result).toBeNull();
    });

    it('should handle whitespace in PID file', async () => {
      (fs.access as unknown as jest.Mock).mockImplementation((...args: any[]) => {
        const callback = args[args.length - 1];
        if (typeof callback === 'function') {
          callback(null);
        }
      });
      (fs.readFile as unknown as jest.Mock).mockImplementation((...args: any[]) => {
        const callback = args[args.length - 1];
        if (typeof callback === 'function') {
          callback(null, '  12345  ');
        }
      });

      const result = await processManager.readPid();

      expect(result).toBe(mockPid);
    });

    it('should throw when readFile fails with unexpected error', async () => {
      (fs.access as unknown as jest.Mock).mockImplementation((...args: any[]) => {
        const callback = args[args.length - 1];
        if (typeof callback === 'function') {
          callback(null);
        }
      });
      const readError = new Error('Read failed');
      (fs.readFile as unknown as jest.Mock).mockImplementation((...args: any[]) => {
        const callback = args[args.length - 1];
        if (typeof callback === 'function') {
          callback(readError);
        }
      });

      await expect(processManager.readPid()).rejects.toThrow('Read failed');
    });
  });

  describe('removePidFile', () => {
    beforeEach(() => {
      processManager = new ProcessManager();
    });

    it('should remove PID file successfully', async () => {
      (fs.access as unknown as jest.Mock).mockImplementation((...args: any[]) => {
        const callback = args[args.length - 1];
        if (typeof callback === 'function') {
          callback(null);
        }
      });
      (fs.unlink as unknown as jest.Mock).mockImplementation((...args: any[]) => {
        const callback = args[args.length - 1];
        if (typeof callback === 'function') {
          callback(null);
        }
      });

      await processManager.removePidFile();

      expect(fs.access).toHaveBeenCalledWith(
        processManager.getPidFilePath(),
        expect.any(Function),
      );
      expect(fs.unlink).toHaveBeenCalledWith(
        processManager.getPidFilePath(),
        expect.any(Function),
      );
    });

    it('should not throw when file does not exist', async () => {
      const error = new Error('File not found') as NodeJS.ErrnoException;
      error.code = 'ENOENT';
      (fs.access as unknown as jest.Mock).mockImplementation((...args: any[]) => {
        const callback = args[args.length - 1];
        if (typeof callback === 'function') {
          callback(error);
        }
      });

      await expect(processManager.removePidFile()).resolves.not.toThrow();
      expect(fs.unlink).not.toHaveBeenCalled();
    });

    it('should throw when unlink fails with unexpected error', async () => {
      (fs.access as unknown as jest.Mock).mockImplementation((...args: any[]) => {
        const callback = args[args.length - 1];
        if (typeof callback === 'function') {
          callback(null);
        }
      });
      const unlinkError = new Error('Unlink failed');
      (fs.unlink as unknown as jest.Mock).mockImplementation((...args: any[]) => {
        const callback = args[args.length - 1];
        if (typeof callback === 'function') {
          callback(unlinkError);
        }
      });

      await expect(processManager.removePidFile()).rejects.toThrow('Unlink failed');
    });
  });

  describe('isProcessRunning', () => {
    beforeEach(() => {
      processManager = new ProcessManager();
    });

    it('should return true when process exists', () => {
      (process.kill as jest.Mock).mockReturnValue(true);

      const result = processManager.isProcessRunning(mockPid);

      expect(process.kill).toHaveBeenCalledWith(mockPid, 0);
      expect(result).toBe(true);
    });

    it('should return false when process does not exist', () => {
      const error = new Error('Process not found') as NodeJS.ErrnoException;
      error.code = 'ESRCH';
      (process.kill as jest.Mock).mockImplementation(() => {
        throw error;
      });

      const result = processManager.isProcessRunning(mockPid);

      expect(process.kill).toHaveBeenCalledWith(mockPid, 0);
      expect(result).toBe(false);
    });

    it('should return false when process.kill throws any error', () => {
      const error = new Error('ESRCH') as NodeJS.ErrnoException;
      error.code = 'ESRCH';
      (process.kill as jest.Mock).mockImplementation(() => {
        throw error;
      });

      const result = processManager.isProcessRunning(mockPid);

      expect(result).toBe(false);
    });
  });

  describe('getPidFilePath', () => {
    it('should return the correct PID file path', () => {
      processManager = new ProcessManager(customPidPath);

      expect(processManager.getPidFilePath()).toBe(customPidPath);
    });
  });
});

