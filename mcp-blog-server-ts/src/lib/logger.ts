import { createWriteStream, WriteStream } from 'fs';
import { mkdir } from 'fs/promises';
import { dirname } from 'path';

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  component?: string;
  requestId?: string;
  userId?: string;
  metadata?: Record<string, any>;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
}

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  FATAL = 4,
}

const LOG_LEVEL_NAMES: Record<LogLevel, string> = {
  [LogLevel.DEBUG]: 'DEBUG',
  [LogLevel.INFO]: 'INFO',
  [LogLevel.WARN]: 'WARN',
  [LogLevel.ERROR]: 'ERROR',
  [LogLevel.FATAL]: 'FATAL',
};

export class StructuredLogger {
  private fileStream?: WriteStream;
  private readonly minLevel: LogLevel;
  private readonly component: string;
  private readonly enableConsole: boolean;
  private readonly enableFile: boolean;

  constructor(options: {
    component?: string;
    minLevel?: LogLevel;
    logFile?: string;
    enableConsole?: boolean;
    enableFile?: boolean;
  } = {}) {
    this.component = options.component || 'mcp-server';
    this.minLevel = options.minLevel ?? LogLevel.INFO;
    this.enableConsole = options.enableConsole ?? true;
    this.enableFile = options.enableFile ?? false;

    if (this.enableFile && options.logFile) {
      this.initializeFileLogging(options.logFile);
    }
  }

  private async initializeFileLogging(logFile: string): Promise<void> {
    try {
      await mkdir(dirname(logFile), { recursive: true });
      this.fileStream = createWriteStream(logFile, { flags: 'a' });
      
      this.fileStream.on('error', (error) => {
        console.error('Log file error:', error);
      });
    } catch (error) {
      console.error('Failed to initialize file logging:', error);
    }
  }

  private formatLogEntry(entry: LogEntry): string {
    return JSON.stringify({
      timestamp: entry.timestamp,
      level: LOG_LEVEL_NAMES[entry.level],
      component: entry.component || this.component,
      message: entry.message,
      ...(entry.requestId && { requestId: entry.requestId }),
      ...(entry.userId && { userId: entry.userId }),
      ...(entry.metadata && { metadata: entry.metadata }),
      ...(entry.error && { error: entry.error }),
    });
  }

  private writeLog(entry: LogEntry): void {
    if (entry.level < this.minLevel) {
      return;
    }

    const formattedEntry = this.formatLogEntry(entry);

    // Console output
    if (this.enableConsole) {
      const consoleMethod = this.getConsoleMethod(entry.level);
      consoleMethod(formattedEntry);
    }

    // File output
    if (this.enableFile && this.fileStream) {
      this.fileStream.write(formattedEntry + '\n');
    }
  }

  private getConsoleMethod(level: LogLevel): (...args: any[]) => void {
    switch (level) {
      case LogLevel.DEBUG:
        return console.debug;
      case LogLevel.INFO:
        return console.info;
      case LogLevel.WARN:
        return console.warn;
      case LogLevel.ERROR:
      case LogLevel.FATAL:
        return console.error;
      default:
        return console.log;
    }
  }

  private createLogEntry(
    level: LogLevel,
    message: string,
    options: {
      component?: string;
      requestId?: string;
      userId?: string;
      metadata?: Record<string, any>;
      error?: Error;
    } = {}
  ): LogEntry {
    return {
      timestamp: new Date().toISOString(),
      level,
      message,
      component: options.component,
      requestId: options.requestId,
      userId: options.userId,
      metadata: options.metadata,
      error: options.error ? {
        name: options.error.name,
        message: options.error.message,
        stack: options.error.stack,
      } : undefined,
    };
  }

  debug(message: string, options?: Parameters<typeof this.createLogEntry>[2]): void {
    this.writeLog(this.createLogEntry(LogLevel.DEBUG, message, options));
  }

  info(message: string, options?: Parameters<typeof this.createLogEntry>[2]): void {
    this.writeLog(this.createLogEntry(LogLevel.INFO, message, options));
  }

  warn(message: string, options?: Parameters<typeof this.createLogEntry>[2]): void {
    this.writeLog(this.createLogEntry(LogLevel.WARN, message, options));
  }

  error(message: string, options?: Parameters<typeof this.createLogEntry>[2]): void {
    this.writeLog(this.createLogEntry(LogLevel.ERROR, message, options));
  }

  fatal(message: string, options?: Parameters<typeof this.createLogEntry>[2]): void {
    this.writeLog(this.createLogEntry(LogLevel.FATAL, message, options));
  }

  // Convenience methods for common scenarios
  authSuccess(userId: string, requestId?: string): void {
    this.info('Authentication successful', {
      component: 'auth',
      userId,
      requestId,
      metadata: { event: 'auth_success' }
    });
  }

  authFailure(reason: string, requestId?: string): void {
    this.warn('Authentication failed', {
      component: 'auth',
      requestId,
      metadata: { event: 'auth_failure', reason }
    });
  }

  postCreated(postId: string, title: string, userId?: string, requestId?: string): void {
    this.info('Blog post created', {
      component: 'posts',
      userId,
      requestId,
      metadata: {
        event: 'post_created',
        postId,
        title
      }
    });
  }

  postCreationFailed(error: Error, title?: string, userId?: string, requestId?: string): void {
    this.error('Blog post creation failed', {
      component: 'posts',
      userId,
      requestId,
      error,
      metadata: {
        event: 'post_creation_failed',
        title
      }
    });
  }

  apiCallStarted(method: string, url: string, requestId?: string): void {
    this.debug('API call started', {
      component: 'api-client',
      requestId,
      metadata: {
        event: 'api_call_started',
        method,
        url
      }
    });
  }

  apiCallCompleted(method: string, url: string, statusCode: number, duration: number, requestId?: string): void {
    this.info('API call completed', {
      component: 'api-client',
      requestId,
      metadata: {
        event: 'api_call_completed',
        method,
        url,
        statusCode,
        duration
      }
    });
  }

  apiCallFailed(method: string, url: string, error: Error, requestId?: string): void {
    this.error('API call failed', {
      component: 'api-client',
      requestId,
      error,
      metadata: {
        event: 'api_call_failed',
        method,
        url
      }
    });
  }

  mcpToolCalled(toolName: string, requestId?: string): void {
    this.info('MCP tool called', {
      component: 'mcp',
      requestId,
      metadata: {
        event: 'tool_called',
        toolName
      }
    });
  }

  mcpToolCompleted(toolName: string, success: boolean, duration: number, requestId?: string): void {
    this.info('MCP tool completed', {
      component: 'mcp',
      requestId,
      metadata: {
        event: 'tool_completed',
        toolName,
        success,
        duration
      }
    });
  }

  securityEvent(eventType: string, details: Record<string, any>, requestId?: string): void {
    this.warn('Security event', {
      component: 'security',
      requestId,
      metadata: {
        event: 'security_event',
        eventType,
        ...details
      }
    });
  }

  performanceMetric(metric: string, value: number, unit: string, requestId?: string): void {
    this.info('Performance metric', {
      component: 'performance',
      requestId,
      metadata: {
        event: 'performance_metric',
        metric,
        value,
        unit
      }
    });
  }

  async close(): Promise<void> {
    if (this.fileStream) {
      return new Promise((resolve, reject) => {
        this.fileStream!.end((error: any) => {
          if (error) {
            reject(error);
          } else {
            resolve();
          }
        });
      });
    }
  }
}

// Default logger instance
export const logger = new StructuredLogger({
  component: 'mcp-blog-server',
  minLevel: process.env['NODE_ENV'] === 'production' ? LogLevel.INFO : LogLevel.DEBUG,
  enableConsole: true,
  enableFile: process.env['LOG_FILE'] ? true : false,
  logFile: process.env['LOG_FILE'],
});

// Request ID generator for tracing
export function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}