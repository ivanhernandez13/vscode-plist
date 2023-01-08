import {MANIFEST} from '../../core/manifest';
import {getConfiguration} from '../utilities/vscode';
import {ConsoleLogger} from './console_logger';
import {Logger, LogSeverity} from './logger';
import {OutputChannelLogger} from './output_channel_logger';

class ExtensionLogger implements Logger {
  private readonly loggers: Logger[] = [];
  private readonly severity?: LogSeverity;

  constructor() {
    const logLevel = getConfiguration(MANIFEST.settings.loggingLevel);
    if (logLevel) {
      this.severity = logLevel as LogSeverity;
      this.loggers.push(
        new OutputChannelLogger('Plist Editor'),
        new ConsoleLogger()
      );
    }
  }

  info(msg: string, ...args: unknown[]): void {
    this.logAll(msg, 'info', args);
  }

  warning(msg: string, ...args: unknown[]): void {
    this.logAll(msg, 'warning', args);
  }

  error(msg: string, ...args: unknown[]): void {
    this.logAll(msg, 'error', args);
  }

  verbose(msg: string, ...args: unknown[]): void {
    this.logAll(msg, 'verbose', args);
  }

  private logAll(msg: string, severity: LogSeverity, args: unknown[]): void {
    if (!this.severity) return;
    for (const logger of this.loggers) {
      switch (severity) {
        case 'verbose':
          if (this.severity !== 'verbose') return;
          logger.verbose(msg, args);
          break;
        case 'info':
          if (['warn', 'error'].includes(this.severity)) return;
          logger.info(msg, args);
          break;
        case 'warning':
          if (['error'].includes(this.severity)) return;
          logger.warning(msg, args);
          break;
        case 'error':
          logger.error(msg, args);
          break;
        default:
          continue;
      }
    }
  }
}

/** Centralized extension logger. */
export const logger = new ExtensionLogger();
