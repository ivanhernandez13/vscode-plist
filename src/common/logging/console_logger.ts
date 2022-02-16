import {FormattedLogger} from './formatted_logger';

/** Logs to the browser console. */
export class ConsoleLogger extends FormattedLogger {
  log(message: string): void {
    console.log(message);
  }
}
