import * as child_process from 'child_process';
import {CancellationToken} from 'vscode';
import {logger} from '../../logging/extension_logger';

/** Runs a NodeJS child_process and returns its output. */
export async function checkOutput(
  command: string,
  args: string[],
  token?: CancellationToken,
  preserveNewlines = false
): Promise<string> {
  const fullCommand = `${command} ${args.join(' ')}`;
  logger.info(`Running '${fullCommand}'`);
  return new Promise((resolve, reject) => {
    const pendingProcess = child_process.exec(
      fullCommand,
      (error, stdout, stderr) => {
        cancel?.dispose();
        if (error) {
          reject(error);
        } else if (stderr) {
          reject(preserveNewlines ? stderr : stderr.trim());
        }
        resolve(preserveNewlines ? stdout : stdout.trim());
      }
    );
    const cancel = token?.onCancellationRequested(() => {
      pendingProcess.kill('SIGINT');
      cancel?.dispose();
    });
  });
}
