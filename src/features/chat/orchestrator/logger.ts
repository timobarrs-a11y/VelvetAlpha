type LogLevel = 'info' | 'warn' | 'error' | 'debug';

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  data?: unknown;
}

class Logger {
  private logs: LogEntry[] = [];
  private maxLogs = 1000;

  private createEntry(level: LogLevel, message: string, data?: unknown): LogEntry {
    return {
      timestamp: new Date().toISOString(),
      level,
      message,
      data,
    };
  }

  info(message: string, data?: unknown): void {
    const entry = this.createEntry('info', message, data);
    this.logs.push(entry);
    if (this.logs.length > this.maxLogs) {
      this.logs.shift();
    }
    console.log(`[INFO] ${message}`, data || '');
  }

  warn(message: string, data?: unknown): void {
    const entry = this.createEntry('warn', message, data);
    this.logs.push(entry);
    if (this.logs.length > this.maxLogs) {
      this.logs.shift();
    }
    console.warn(`[WARN] ${message}`, data || '');
  }

  error(message: string, data?: unknown): void {
    const entry = this.createEntry('error', message, data);
    this.logs.push(entry);
    if (this.logs.length > this.maxLogs) {
      this.logs.shift();
    }
    console.error(`[ERROR] ${message}`, data || '');
  }

  debug(message: string, data?: unknown): void {
    const entry = this.createEntry('debug', message, data);
    this.logs.push(entry);
    if (this.logs.length > this.maxLogs) {
      this.logs.shift();
    }
    console.debug(`[DEBUG] ${message}`, data || '');
  }

  getLogs(): LogEntry[] {
    return [...this.logs];
  }

  clear(): void {
    this.logs = [];
  }
}

export const logger = new Logger();
