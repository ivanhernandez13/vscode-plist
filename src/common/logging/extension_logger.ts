import {MANIFEST} from '../../core/manifest';
import {getConfiguration} from '../utilities/vscode';
import {ConsoleLogger} from './console_logger';
import {Logger, LogSeverity} from './logger';
import {OutputChannelLogger} from './output_channel_logger';

class ExtensionLogger implements Logger {
  private readonly loggers: Logger[] = [];
  private readonly severity?: LogSeverity;

  constructor() {
    const logLevel = getConfiguration(MANIFEST.SETTINGS.loggingLevel);
    if (logLevel) {
      this.severity = logLevel as LogSeverity;
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

  logVerbose(msg: string): void {
    this.logAll(msg, 'verbose');
  }

  private logAll(msg: string, severity: LogSeverity): void {
    if (!this.severity) return;
    for (const logger of this.loggers) {
      switch (severity) {
        case 'verbose':
          if (this.severity !== 'verbose') return;
          logger.logVerbose(msg);
          break;
        case 'info':
          if (['warn', 'error'].includes(this.severity)) return;
          logger.logInfo(msg);
          break;
        case 'warning':
          if (['error'].includes(this.severity)) return;
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
