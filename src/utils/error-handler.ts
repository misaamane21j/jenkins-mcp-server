import { logger } from './logger';

// Base error class for all application errors
export abstract class AppError extends Error {
  abstract readonly statusCode: number;
  abstract readonly errorType: string;
  public readonly isOperational: boolean = true;

  constructor(message: string, public readonly cause?: Error) {
    super(message);
    this.name = this.constructor.name;
    
    // Ensure proper prototype chain for instanceof checks
    Object.setPrototypeOf(this, new.target.prototype);
    
    // Capture stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  abstract toJSON(): Record<string, unknown>;
}

// Jenkins API related errors
export class JenkinsError extends AppError {
  readonly statusCode = 502;
  readonly errorType = 'JENKINS_ERROR';

  constructor(
    message: string,
    public readonly jenkinsStatusCode?: number,
    public readonly jenkinsResponse?: string,
    cause?: Error
  ) {
    super(message, cause);
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      errorType: this.errorType,
      statusCode: this.statusCode,
      jenkinsStatusCode: this.jenkinsStatusCode,
      jenkinsResponse: this.jenkinsResponse,
      stack: this.stack,
      cause: this.cause?.message
    };
  }
}

// Authentication errors
export class AuthenticationError extends AppError {
  readonly statusCode = 401;
  readonly errorType = 'AUTHENTICATION_ERROR';

  constructor(message: string, cause?: Error) {
    super(message, cause);
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      errorType: this.errorType,
      statusCode: this.statusCode,
      stack: this.stack,
      cause: this.cause?.message
    };
  }
}

// Job not found errors
export class JobNotFoundError extends AppError {
  readonly statusCode = 404;
  readonly errorType = 'JOB_NOT_FOUND';

  constructor(public readonly jobName: string, cause?: Error) {
    super(`Job not found: ${jobName}`, cause);
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      errorType: this.errorType,
      statusCode: this.statusCode,
      jobName: this.jobName,
      stack: this.stack,
      cause: this.cause?.message
    };
  }
}

// Build not found errors
export class BuildNotFoundError extends AppError {
  readonly statusCode = 404;
  readonly errorType = 'BUILD_NOT_FOUND';

  constructor(
    public readonly jobName: string,
    public readonly buildNumber: number,
    cause?: Error
  ) {
    super(`Build not found: ${jobName}#${buildNumber}`, cause);
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      errorType: this.errorType,
      statusCode: this.statusCode,
      jobName: this.jobName,
      buildNumber: this.buildNumber,
      stack: this.stack,
      cause: this.cause?.message
    };
  }
}

// MCP protocol errors
export class MCPError extends AppError {
  readonly statusCode = 400;
  readonly errorType = 'MCP_ERROR';

  constructor(
    message: string,
    public readonly mcpCode?: string,
    cause?: Error
  ) {
    super(message, cause);
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      errorType: this.errorType,
      statusCode: this.statusCode,
      mcpCode: this.mcpCode,
      stack: this.stack,
      cause: this.cause?.message
    };
  }
}

// Redis connection errors
export class RedisError extends AppError {
  readonly statusCode = 503;
  readonly errorType = 'REDIS_ERROR';

  constructor(message: string, cause?: Error) {
    super(message, cause);
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      errorType: this.errorType,
      statusCode: this.statusCode,
      stack: this.stack,
      cause: this.cause?.message
    };
  }
}

// Configuration errors
export class ConfigurationError extends AppError {
  readonly statusCode = 500;
  readonly errorType = 'CONFIGURATION_ERROR';

  constructor(
    message: string,
    public readonly configKey?: string,
    cause?: Error
  ) {
    super(message, cause);
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      errorType: this.errorType,
      statusCode: this.statusCode,
      configKey: this.configKey,
      stack: this.stack,
      cause: this.cause?.message
    };
  }
}

// Webhook validation errors
export class WebhookError extends AppError {
  readonly statusCode = 400;
  readonly errorType = 'WEBHOOK_ERROR';

  constructor(
    message: string,
    public readonly webhookSource?: string,
    cause?: Error
  ) {
    super(message, cause);
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      errorType: this.errorType,
      statusCode: this.statusCode,
      webhookSource: this.webhookSource,
      stack: this.stack,
      cause: this.cause?.message
    };
  }
}

// Error handler for converting unknown errors to app errors
export function handleError(error: unknown, context?: string): AppError {
  // If it's already an AppError, return as-is
  if (error instanceof AppError) {
    return error;
  }

  // If it's a standard Error, wrap it
  if (error instanceof Error) {
    logger.error(`Unhandled error in ${context || 'unknown context'}:`, error);
    
    // Check for specific error patterns and convert appropriately
    if (error.message.includes('ECONNREFUSED') || error.message.includes('Redis')) {
      return new RedisError(`Redis connection failed: ${error.message}`, error);
    }
    
    if (error.message.includes('401') || error.message.includes('Unauthorized')) {
      return new AuthenticationError(`Authentication failed: ${error.message}`, error);
    }
    
    if (error.message.includes('404') || error.message.includes('Not Found')) {
      return new JenkinsError(`Resource not found: ${error.message}`, 404, undefined, error);
    }
    
    // Generic Jenkins error for HTTP errors
    if (error.message.includes('status code')) {
      return new JenkinsError(`Jenkins API error: ${error.message}`, undefined, undefined, error);
    }
    
    // Generic MCP error
    return new MCPError(`Unexpected error: ${error.message}`, undefined, error);
  }

  // For non-Error objects, create a generic error
  const message = typeof error === 'string' ? error : 'Unknown error occurred';
  logger.error(`Unhandled non-Error object in ${context || 'unknown context'}:`, error);
  return new MCPError(message);
}

// Format error for MCP response
export function formatMCPError(error: AppError | Error): {
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
} {
  if (error instanceof AppError) {
    return {
      error: {
        code: error.errorType,
        message: error.message,
        details: error.toJSON()
      }
    };
  }

  return {
    error: {
      code: 'INTERNAL_ERROR',
      message: error.message || 'An unexpected error occurred',
      details: {
        name: error.name || 'Error',
        stack: error.stack
      }
    }
  };
}

// Global error handler for uncaught exceptions
export function setupGlobalErrorHandlers(): void {
  process.on('uncaughtException', (error: Error) => {
    logger.error('Uncaught Exception:', error);
    
    // In production, we might want to exit gracefully
    if (process.env.NODE_ENV === 'production') {
      process.exit(1);
    }
  });

  process.on('unhandledRejection', (reason: unknown, promise: Promise<unknown>) => {
    logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
    
    // Convert to proper error and handle
    const error = handleError(reason, 'unhandledRejection');
    logger.error('Converted error:', error.toJSON());
  });
}

// Utility to check if error is operational (expected) vs programming error
export function isOperationalError(error: unknown): boolean {
  if (error instanceof AppError) {
    return error.isOperational;
  }
  return false;
}