export interface Logger {
  logInfo(msg: string): void;
  logWarning(msg: string): void;
  logError(msg: string): void;
}
