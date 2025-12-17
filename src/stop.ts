import * as dotenv from 'dotenv';
import { ProcessManager } from './process-manager';

dotenv.config();

async function main() {
  const pidFilePath = process.env.PID_FILE_PATH;
  const processManager = new ProcessManager(pidFilePath);

  try {
    const pid = await processManager.readPid();

    if (pid === null) {
      console.log('Server is not running (no PID file found)');
      process.exit(0);
    }

    const isRunning = processManager.isProcessRunning(pid);

    if (!isRunning) {
      console.log('Server process not found (stale PID file)');
      await processManager.removePidFile();
      process.exit(0);
    }

    // Send SIGTERM for graceful shutdown
    process.kill(pid, 'SIGTERM');
    console.log(`Sent SIGTERM to process ${pid}`);

    // Wait a bit for graceful shutdown
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Check if process is still running
    if (processManager.isProcessRunning(pid)) {
      // Force kill if still running
      process.kill(pid, 'SIGKILL');
      console.log(`Sent SIGKILL to process ${pid}`);
    }

    // Clean up PID file
    await processManager.removePidFile();
    console.log('Server stopped successfully');
  } catch (error) {
    console.error(`Error stopping server: ${error}`);
    // Try to clean up PID file anyway
    await processManager.removePidFile().catch(() => {
      // Ignore cleanup errors
    });
    process.exit(1);
  }
}

main();

