export type LogSeverity = 'info' | 'warning' | 'error' | 'verbose';

export interface Logger {
  logInfo(msg: string): void;
  logWarning(msg: string): void;
  logError(msg: string): void;
  logVerbose(msg: string): void;
}
