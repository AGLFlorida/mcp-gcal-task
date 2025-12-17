import * as dotenv from 'dotenv';
import chalk from 'chalk';
import { ProcessManager } from './process-manager';

dotenv.config();

async function main() {
  const pidFilePath = process.env.PID_FILE_PATH;
  const processManager = new ProcessManager(pidFilePath);

  try {
    const pid = await processManager.readPid();

    if (pid === null) {
      console.log(chalk.yellow('stopped'));
      process.exit(0);
    }

    const isRunning = processManager.isProcessRunning(pid);

    if (isRunning) {
      console.log(chalk.green('running'));
    } else {
      console.log(chalk.yellow('stopped'));
      // Clean up stale PID file
      await processManager.removePidFile();
    }
  } catch (error) {
    console.error(`Error checking status: ${error}`);
    console.log(chalk.yellow('stopped'));
    process.exit(1);
  }
}

main();

