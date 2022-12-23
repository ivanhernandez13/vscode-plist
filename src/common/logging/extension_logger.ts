import {MANIFEST} from '../../core/manifest';
import {getConfiguration} from '../utilities/vscode';
import {ConsoleLogger} from './console_logger';
import {Logger} from './logger';
import {OutputChannelLogger} from './output_channel_logger';

class ExtensionLogger implements Logger {
  private readonly loggers: Logger[] = [];

  constructor() {
    const logLevel = getConfiguration(MANIFEST.SETTINGS.loggingLevel);
    if (logLevel) {
      this.loggers.push(
        new OutputChannelLogger('Plist Editor'),
        new ConsoleLogger()
      );
    }
  }

  logInfo(msg: string): void {
    this.logAll(msg, 'info');
  }

  logWarning(msg: string): void {
    this.logAll(msg, 'warning');
  }

  logError(msg: string): void {
    this.logAll(msg, 'error');
  }

  private logAll(msg: string, severity: 'info' | 'warning' | 'error'): void {
    for (const logger of this.loggers) {
      switch (severity) {
        case 'info':
          logger.logInfo(msg);
          break;
        case 'warning':
          logger.logWarning(msg);
          break;
        case 'error':
          logger.logError(msg);
          break;
        default:
          continue;
      }
    }
  }
}

/** Centralized extension logger. */
export const logger = new ExtensionLogger();
