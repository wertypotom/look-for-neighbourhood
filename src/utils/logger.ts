type LogLevel = 'INFO' | 'WARN' | 'ERROR' | 'DEBUG';

class Logger {
  private formatMessage(level: LogLevel, message: string): string {
    const timestamp = new Date().toISOString();
    return `[${timestamp}] [${level}] ${message}`;
  }

  info(message: string, ...args: any[]) {
    console.log(this.formatMessage('INFO', message), ...args);
  }

  warn(message: string, ...args: any[]) {
    console.warn(this.formatMessage('WARN', message), ...args);
  }

  error(message: string, error?: any) {
    console.error(this.formatMessage('ERROR', message));
    if (error) {
      if (error instanceof Error) {
        console.error(error.stack);
      } else {
        console.error(error);
      }
    }
  }

  debug(message: string, ...args: any[]) {
    if (process.env.NODE_ENV === 'development') {
      console.debug(this.formatMessage('DEBUG', message), ...args);
    }
  }
}

export const logger = new Logger();
