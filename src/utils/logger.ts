type LogLevel = 'info' | 'warn' | 'error' | 'debug';

class Logger {
  private isDevelopment: boolean;

  constructor() {
    this.isDevelopment = process.env.NODE_ENV !== 'production';
  }

  private log(level: LogLevel, message: string, ...args: unknown[]): void {
    if (!this.isDevelopment) {
      return;
    }

    const timestamp = new Date().toISOString();
    const formattedMessage = `[${timestamp}] ${level.toUpperCase()}: ${message}`;

    switch (level) {
      case 'error':
        console.error(formattedMessage, ...args);
        break;
      case 'warn':
        console.warn(formattedMessage, ...args);
        break;
      case 'debug':
        console.debug(formattedMessage, ...args);
        break;
      default:
        console.log(formattedMessage, ...args);
    }
  }

  info(message: string, ...args: unknown[]): void {
    this.log('info', message, ...args);
  }

  warn(message: string, ...args: unknown[]): void {
    this.log('warn', message, ...args);
  }

  error(message: string, ...args: unknown[]): void {
    this.log('error', message, ...args);
  }

  debug(message: string, ...args: unknown[]): void {
    this.log('debug', message, ...args);
  }
}

export const logger = new Logger(); 