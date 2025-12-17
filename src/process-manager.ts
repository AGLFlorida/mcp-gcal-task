import * as fs from 'fs';
import * as path from 'path';
import { promisify } from 'util';

const readFile = promisify(fs.readFile);
const writeFile = promisify(fs.writeFile);
const unlink = promisify(fs.unlink);
const access = promisify(fs.access);

const DEFAULT_PID_FILE = path.join(process.cwd(), '.pid');

export class ProcessManager {
  private pidFilePath: string;

  constructor(pidFilePath?: string) {
    this.pidFilePath = pidFilePath || DEFAULT_PID_FILE;
  }

  async writePid(pid: number): Promise<void> {
    try {
      await writeFile(this.pidFilePath, pid.toString(), 'utf8');
    } catch (error) {
      throw new Error(`Failed to write PID file: ${error}`);
    }
  }

  async readPid(): Promise<number | null> {
    try {
      await access(this.pidFilePath);
      const content = await readFile(this.pidFilePath, 'utf8');
      const pid = parseInt(content.trim(), 10);
      if (isNaN(pid)) {
        return null;
      }
      return pid;
    } catch (error) {
      // File doesn't exist - this is expected (no PID file yet)
      if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
        return null;
      }
      // Unexpected error - log to stderr and throw
      console.error('Unexpected error reading PID file:', error);
      throw error;
    }
  }

  async removePidFile(): Promise<void> {
    try {
      await access(this.pidFilePath);
      await unlink(this.pidFilePath);
    } catch (error) {
      // File doesn't exist - idempotent operation, succeed silently
      if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
        return;
      }
      // Unexpected error - log to stderr and throw
      console.error('Unexpected error removing PID file:', error);
      throw error;
    }
  }

  isProcessRunning(pid: number): boolean {
    try {
      // Signal 0 doesn't kill the process, just checks if it exists
      process.kill(pid, 0);
      return true;
    } catch (error) {
      // Process doesn't exist (expected) - ESRCH error code
      if (error && typeof error === 'object' && 'code' in error && error.code === 'ESRCH') {
        return false;
      }
      // Unexpected error - log to stderr and throw
      console.error('Unexpected error checking if process is running:', error);
      throw error;
    }
  }

  getPidFilePath(): string {
    return this.pidFilePath;
  }
}

