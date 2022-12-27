export type LogSeverity = 'info' | 'warning' | 'error' | 'verbose';

export interface Logger {
  info(msg: string, args: unknown[]): void;
  warning(msg: string, args: unknown[]): void;
  error(msg: string, args: unknown[]): void;
  verbose(msg: string, args: unknown[]): void;
}
