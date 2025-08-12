import { logger } from '../../../src/utils/logger';

// Mock the config to avoid file system dependencies
jest.mock('../../../src/config/environment', () => ({
  config: {
    app: {
      logLevel: 'info',
      nodeEnv: 'test'
    }
  }
}));

describe('Logger', () => {
  it('should export a winston logger instance', () => {
    expect(logger).toBeDefined();
    expect(typeof logger.info).toBe('function');
    expect(typeof logger.error).toBe('function');
    expect(typeof logger.warn).toBe('function');
    expect(typeof logger.debug).toBe('function');
  });

  it('should have correct service metadata', () => {
    expect(logger.defaultMeta).toEqual({ service: 'jenkins-mcp-server' });
  });

  it('should log messages without throwing errors', () => {
    expect(() => {
      logger.info('Test info message');
      logger.error('Test error message');
      logger.warn('Test warning message');
      logger.debug('Test debug message');
    }).not.toThrow();
  });

  it('should handle logging objects and metadata', () => {
    expect(() => {
      logger.info('Test message with metadata', { key: 'value', number: 42 });
      logger.error('Test error with error object', new Error('Test error'));
    }).not.toThrow();
  });
});