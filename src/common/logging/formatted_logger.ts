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

  abstract log(msg: string, args: unknown[]): void;

  private formatMessage(
    message: string,
    level: 'INFO' | 'WARN' | 'ERROR' | 'VERBOSE'
  ): string {
    return `${this.timestamp} | ${level} | ${message}`;
  }

  info(message: string, args: unknown[]): void {
    this.log(this.formatMessage(message, 'INFO'), args);
  }

  warning(message: string, args: unknown[]): void {
    this.log(this.formatMessage(message, 'WARN'), args);
  }

  error(message: string, args: unknown[]): void {
    this.log(this.formatMessage(message, 'ERROR'), args);
  }

  verbose(message: string, args: unknown[]): void {
    this.log(this.formatMessage(message, 'VERBOSE'), args);
  }
}
