type WebviewLogSeverity = 'verbose' | 'info' | 'warn' | 'error';

class WebviewLogger {
  constructor(private readonly severity?: string) {}

  private get timestamp(): string {
    const date = new Date();
    return `${date.toLocaleDateString(
      'en-US'
    )} ${date.getHours()}:${date.getMinutes()}:${date.getSeconds()}:${date.getMilliseconds()}`;
  }

  private processArgs(
    severity: WebviewLogSeverity,
    source: string,
    message: string,
    args: unknown[]
  ): {[key: string]: unknown} {
    let processedArgs: {[key: string]: unknown} = {};

    if (args.length === 1) {
      const arg = args[0];
      processedArgs = typeof arg === 'object' ? {...arg} : {arg0: arg};
    } else {
      for (const [index, arg] of Object.entries(args)) {
        processedArgs[`arg${index}`] = arg;
      }
    }

    const timestamp = this.timestamp;
    processedArgs.__context__ = {severity, timestamp, source, message};
    return processedArgs;
  }

  private log(
    severity: WebviewLogSeverity,
    source: string,
    message: string,
    args: unknown[]
  ) {
    if (!this.severity) return;
    switch (severity) {
      case 'verbose':
        if (this.severity !== 'verbose') return;
        break;
      case 'info':
        if (['warn', 'error'].includes(this.severity)) return;
        break;
      case 'warn':
        if (['error'].includes(this.severity)) return;
        break;
      case 'error':
        console.error(message, ...args);
        return;
      default:
        break;
    }

    console.log(`[${source}]:`, message);
    console.log(this.processArgs(severity, source, message, args));
  }

  verbose(source: string, message: string, ...args: unknown[]) {
    this.log('verbose', source, message, args);
  }
  info(source: string, message: string, ...args: unknown[]) {
    this.log('info', source, message, args);
  }
  warn(source: string, message: string, ...args: unknown[]) {
    this.log('warn', source, message, args);
  }
  error(source: string, message: string, ...args: unknown[]) {
    this.log('error', source, message, args);
  }
}

const EXTENSION_LOG_LEVEL = document.getElementById('extensionLogLevel')?.title;

export const logger = new WebviewLogger(EXTENSION_LOG_LEVEL);
logger.info('Logger', `Initiliazed with level '${EXTENSION_LOG_LEVEL}'`);
