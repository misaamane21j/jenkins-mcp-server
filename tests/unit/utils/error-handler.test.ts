import {
  AppError,
  JenkinsError,
  AuthenticationError,
  JobNotFoundError,
  BuildNotFoundError,
  MCPError,
  RedisError,
  ConfigurationError,
  WebhookError,
  handleError,
  formatMCPError,
  setupGlobalErrorHandlers,
  isOperationalError
} from '../../../src/utils/error-handler';
import { logger } from '../../../src/utils/logger';

// Mock logger
jest.mock('../../../src/utils/logger');

describe('Error Handler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('JenkinsError', () => {
    it('should create JenkinsError with all properties', () => {
      const error = new JenkinsError('Jenkins API failed', 404, 'Job not found');

      expect(error.name).toBe('JenkinsError');
      expect(error.message).toBe('Jenkins API failed');
      expect(error.statusCode).toBe(502);
      expect(error.errorType).toBe('JENKINS_ERROR');
      expect(error.jenkinsStatusCode).toBe(404);
      expect(error.jenkinsResponse).toBe('Job not found');
      expect(error.isOperational).toBe(true);
    });

    it('should serialize to JSON correctly', () => {
      const error = new JenkinsError('Jenkins API failed', 404, 'Job not found');
      const json = error.toJSON();

      expect(json).toEqual({
        name: 'JenkinsError',
        message: 'Jenkins API failed',
        errorType: 'JENKINS_ERROR',
        statusCode: 502,
        jenkinsStatusCode: 404,
        jenkinsResponse: 'Job not found',
        stack: expect.any(String),
        cause: undefined
      });
    });

    it('should include cause error message in JSON', () => {
      const cause = new Error('Network error');
      const error = new JenkinsError('Jenkins API failed', undefined, undefined, cause);
      const json = error.toJSON();

      expect(json.cause).toBe('Network error');
    });
  });

  describe('AuthenticationError', () => {
    it('should create AuthenticationError correctly', () => {
      const error = new AuthenticationError('Invalid credentials');

      expect(error.name).toBe('AuthenticationError');
      expect(error.message).toBe('Invalid credentials');
      expect(error.statusCode).toBe(401);
      expect(error.errorType).toBe('AUTHENTICATION_ERROR');
    });
  });

  describe('JobNotFoundError', () => {
    it('should create JobNotFoundError with job name', () => {
      const error = new JobNotFoundError('my-test-job');

      expect(error.name).toBe('JobNotFoundError');
      expect(error.message).toBe('Job not found: my-test-job');
      expect(error.statusCode).toBe(404);
      expect(error.errorType).toBe('JOB_NOT_FOUND');
      expect(error.jobName).toBe('my-test-job');
    });

    it('should include job name in JSON', () => {
      const error = new JobNotFoundError('my-test-job');
      const json = error.toJSON();

      expect(json.jobName).toBe('my-test-job');
    });
  });

  describe('BuildNotFoundError', () => {
    it('should create BuildNotFoundError with job name and build number', () => {
      const error = new BuildNotFoundError('my-test-job', 123);

      expect(error.name).toBe('BuildNotFoundError');
      expect(error.message).toBe('Build not found: my-test-job#123');
      expect(error.statusCode).toBe(404);
      expect(error.errorType).toBe('BUILD_NOT_FOUND');
      expect(error.jobName).toBe('my-test-job');
      expect(error.buildNumber).toBe(123);
    });
  });

  describe('MCPError', () => {
    it('should create MCPError with MCP code', () => {
      const error = new MCPError('Invalid tool call', 'INVALID_PARAMS');

      expect(error.name).toBe('MCPError');
      expect(error.message).toBe('Invalid tool call');
      expect(error.statusCode).toBe(400);
      expect(error.errorType).toBe('MCP_ERROR');
      expect(error.mcpCode).toBe('INVALID_PARAMS');
    });
  });

  describe('RedisError', () => {
    it('should create RedisError correctly', () => {
      const error = new RedisError('Redis connection failed');

      expect(error.name).toBe('RedisError');
      expect(error.message).toBe('Redis connection failed');
      expect(error.statusCode).toBe(503);
      expect(error.errorType).toBe('REDIS_ERROR');
    });
  });

  describe('ConfigurationError', () => {
    it('should create ConfigurationError with config key', () => {
      const error = new ConfigurationError('Missing configuration', 'JENKINS_URL');

      expect(error.name).toBe('ConfigurationError');
      expect(error.message).toBe('Missing configuration');
      expect(error.statusCode).toBe(500);
      expect(error.errorType).toBe('CONFIGURATION_ERROR');
      expect(error.configKey).toBe('JENKINS_URL');
    });
  });

  describe('WebhookError', () => {
    it('should create WebhookError with webhook source', () => {
      const error = new WebhookError('Invalid webhook payload', 'jenkins');

      expect(error.name).toBe('WebhookError');
      expect(error.message).toBe('Invalid webhook payload');
      expect(error.statusCode).toBe(400);
      expect(error.errorType).toBe('WEBHOOK_ERROR');
      expect(error.webhookSource).toBe('jenkins');
    });
  });

  describe('handleError', () => {
    it('should return AppError as-is', () => {
      const originalError = new JenkinsError('Original error');
      const result = handleError(originalError);

      expect(result).toBe(originalError);
    });

    it('should convert Redis connection errors', () => {
      const originalError = new Error('ECONNREFUSED Redis connection failed');
      const result = handleError(originalError, 'test context');

      expect(result).toBeInstanceOf(RedisError);
      expect(result.message).toContain('Redis connection failed');
      expect(logger.error).toHaveBeenCalledWith('Unhandled error in test context:', originalError);
    });

    it('should convert authentication errors', () => {
      const originalError = new Error('401 Unauthorized access');
      const result = handleError(originalError);

      expect(result).toBeInstanceOf(AuthenticationError);
      expect(result.message).toContain('Authentication failed');
    });

    it('should convert 404 errors to JenkinsError', () => {
      const originalError = new Error('404 Not Found');
      const result = handleError(originalError);

      expect(result).toBeInstanceOf(JenkinsError);
      expect(result.message).toContain('Resource not found');
    });

    it('should convert HTTP status code errors to JenkinsError', () => {
      const originalError = new Error('Request failed with status code 500');
      const result = handleError(originalError);

      expect(result).toBeInstanceOf(JenkinsError);
      expect(result.message).toContain('Jenkins API error');
    });

    it('should convert generic Error to MCPError', () => {
      const originalError = new Error('Generic error message');
      const result = handleError(originalError);

      expect(result).toBeInstanceOf(MCPError);
      expect(result.message).toContain('Unexpected error');
    });

    it('should handle string errors', () => {
      const result = handleError('String error message');

      expect(result).toBeInstanceOf(MCPError);
      expect(result.message).toBe('String error message');
    });

    it('should handle unknown object errors', () => {
      const result = handleError({ custom: 'error object' });

      expect(result).toBeInstanceOf(MCPError);
      expect(result.message).toBe('Unknown error occurred');
      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe('formatMCPError', () => {
    it('should format AppError correctly', () => {
      const error = new JenkinsError('Jenkins API failed', 404);
      const formatted = formatMCPError(error);

      expect(formatted).toEqual({
        error: {
          code: 'JENKINS_ERROR',
          message: 'Jenkins API failed',
          details: error.toJSON()
        }
      });
    });

    it('should format generic Error correctly', () => {
      const error = new Error('Generic error');
      const formatted = formatMCPError(error);

      expect(formatted).toEqual({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Generic error',
          details: {
            name: 'Error',
            stack: expect.any(String)
          }
        }
      });
    });

    it('should handle Error with no message', () => {
      const error = new Error();
      const formatted = formatMCPError(error);

      expect(formatted.error.message).toBe('An unexpected error occurred');
    });
  });

  describe('isOperationalError', () => {
    it('should return true for AppError instances', () => {
      const error = new JenkinsError('Jenkins API failed');
      expect(isOperationalError(error)).toBe(true);
    });

    it('should return false for generic Error instances', () => {
      const error = new Error('Generic error');
      expect(isOperationalError(error)).toBe(false);
    });

    it('should return false for non-Error objects', () => {
      expect(isOperationalError('string error')).toBe(false);
      expect(isOperationalError({ error: 'object' })).toBe(false);
      expect(isOperationalError(null)).toBe(false);
      expect(isOperationalError(undefined)).toBe(false);
    });
  });

  describe('setupGlobalErrorHandlers', () => {
    it('should set up process event listeners', () => {
      const originalOn = process.on;
      const mockOn = jest.fn();
      process.on = mockOn;

      setupGlobalErrorHandlers();

      expect(mockOn).toHaveBeenCalledWith('uncaughtException', expect.any(Function));
      expect(mockOn).toHaveBeenCalledWith('unhandledRejection', expect.any(Function));

      // Restore original process.on
      process.on = originalOn;
    });

    it('should handle uncaught exceptions', () => {
      const originalExit = process.exit;
      const mockExit = jest.fn();
      process.exit = mockExit as any;

      const originalOn = process.on;
      let uncaughtExceptionHandler: Function | undefined;
      process.on = jest.fn((event, handler) => {
        if (event === 'uncaughtException') {
          uncaughtExceptionHandler = handler;
        }
        return process;
      }) as any;

      setupGlobalErrorHandlers();

      const testError = new Error('Uncaught test error');
      if (uncaughtExceptionHandler) {
        uncaughtExceptionHandler(testError);
      }

      expect(logger.error).toHaveBeenCalledWith('Uncaught Exception:', testError);

      // Restore originals
      process.exit = originalExit;
      process.on = originalOn;
    });

    it('should handle unhandled rejections', async () => {
      const originalOn = process.on;
      let unhandledRejectionHandler: Function | undefined;
      process.on = jest.fn((event, handler) => {
        if (event === 'unhandledRejection') {
          unhandledRejectionHandler = handler;
        }
        return process;
      }) as any;

      setupGlobalErrorHandlers();

      const testReason = new Error('Unhandled rejection');
      const testPromise = Promise.resolve().then(() => {
        throw testReason;
      });
      
      if (unhandledRejectionHandler) {
        unhandledRejectionHandler(testReason, testPromise);
      }

      // Catch the promise to prevent actual unhandled rejection
      await testPromise.catch(() => {});

      expect(logger.error).toHaveBeenCalledWith('Unhandled Rejection at:', testPromise, 'reason:', testReason);
      expect(logger.error).toHaveBeenCalledWith('Converted error:', expect.any(Object));

      // Restore original
      process.on = originalOn;
    });
  });

  describe('Error inheritance', () => {
    it('should maintain proper prototype chain', () => {
      const jenkinsError = new JenkinsError('Test error');
      const authError = new AuthenticationError('Auth error');
      const jobError = new JobNotFoundError('test-job');

      expect(jenkinsError instanceof JenkinsError).toBe(true);
      expect(jenkinsError instanceof AppError).toBe(true);
      expect(jenkinsError instanceof Error).toBe(true);

      expect(authError instanceof AuthenticationError).toBe(true);
      expect(authError instanceof AppError).toBe(true);
      expect(authError instanceof Error).toBe(true);

      expect(jobError instanceof JobNotFoundError).toBe(true);
      expect(jobError instanceof AppError).toBe(true);
      expect(jobError instanceof Error).toBe(true);
    });
  });
});