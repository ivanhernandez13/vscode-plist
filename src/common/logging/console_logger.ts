import {FormattedLogger} from './formatted_logger';

/** Logs to the browser console. */
export class ConsoleLogger extends FormattedLogger {
  log(message: string, args: unknown[]): void {
    args ? console.log(message, ...args) : console.log(message);
  }
}
