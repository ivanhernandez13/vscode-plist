import {Logger} from './logger';

/**
 * Abstract class that provides timestamps and severity labels to logged
 * messages.
 */
export abstract class FormattedLogger implements Logger {
  private get timestamp(): string {
    const date = new Date();
    return `${date.toLocaleDateString(
      'en-US'
    )} ${date.getHours()}:${date.getMinutes()}:${date.getSeconds()}:${date.getMilliseconds()}`;
  }

  abstract log(msg: string): void;

  private formatMessage(
    message: string,
    level: 'INFO' | 'WARN' | 'ERROR' | 'VERBOSE'
  ): string {
    return `${this.timestamp} | ${level} | ${message}`;
  }

  logInfo(message: string): void {
    this.log(this.formatMessage(message, 'INFO'));
  }

  logWarning(message: string): void {
    this.log(this.formatMessage(message, 'WARN'));
  }

  logError(message: string): void {
    this.log(this.formatMessage(message, 'ERROR'));
  }

  logVerbose(message: string): void {
    this.log(this.formatMessage(message, 'VERBOSE'));
  }
}
