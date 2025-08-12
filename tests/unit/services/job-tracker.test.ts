import { JobTrackerService } from '../../../src/services/job-tracker';
import { logger } from '../../../src/utils/logger';

// Mock Redis client
const mockRedisClient = {
  connect: jest.fn(),
  disconnect: jest.fn(),
  setEx: jest.fn(),
  get: jest.fn(),
  del: jest.fn(),
  keys: jest.fn(),
  ttl: jest.fn(),
  expire: jest.fn(),
  on: jest.fn(),
};

// Mock createClient to return our mock
jest.mock('redis', () => ({
  createClient: jest.fn(() => mockRedisClient),
}));

jest.mock('../../../src/config/environment', () => ({
  config: {
    app: {
      logLevel: 'info',
    },
    redis: {
      url: 'redis://localhost:6379',
    },
  },
}));

jest.mock('../../../src/utils/logger');

describe('JobTrackerService', () => {
  let service: JobTrackerService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new JobTrackerService();
    // Simulate successful connection
    mockRedisClient.connect.mockResolvedValue(undefined);
  });

  describe('constructor', () => {
    it('should create Redis client with correct configuration', () => {
      const redis = require('redis');
      expect(redis.createClient).toHaveBeenCalledWith({
        url: 'redis://localhost:6379',
        socket: {
          reconnectStrategy: expect.any(Function),
        },
      });
    });

    it('should set up event listeners', () => {
      expect(mockRedisClient.on).toHaveBeenCalledWith('error', expect.any(Function));
      expect(mockRedisClient.on).toHaveBeenCalledWith('connect', expect.any(Function));
      expect(mockRedisClient.on).toHaveBeenCalledWith('disconnect', expect.any(Function));
    });
  });

  describe('initialize', () => {
    it('should connect to Redis successfully', async () => {
      await service.initialize();

      expect(mockRedisClient.connect).toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalledWith('Job tracker service initialized');
    });

    it('should handle connection failure', async () => {
      const error = new Error('Connection failed');
      mockRedisClient.connect.mockRejectedValue(error);

      await expect(service.initialize()).rejects.toThrow('Connection failed');
      expect(logger.error).toHaveBeenCalledWith('Failed to initialize job tracker service:', error);
    });
  });

  describe('trackJob', () => {
    const mockJobInfo = {
      jobName: 'test-job',
      buildNumber: 123,
      callbackInfo: {
        slackChannel: '#test',
        slackThreadTs: '1234567890.123',
        slackUserId: 'U123456',
      },
      status: 'PENDING',
      timestamp: Date.now(),
    };

    beforeEach(async () => {
      // Initialize the service first
      await service.initialize();
      // Simulate connection established
      const connectHandler = mockRedisClient.on.mock.calls.find(call => call[0] === 'connect')[1];
      connectHandler();
    });

    it('should track job successfully', async () => {
      mockRedisClient.setEx.mockResolvedValue('OK');

      await service.trackJob(mockJobInfo);

      expect(mockRedisClient.setEx).toHaveBeenCalledWith(
        'job:test-job:123',
        3600,
        JSON.stringify(mockJobInfo)
      );
      expect(logger.info).toHaveBeenCalledWith('Tracking job: job:test-job:123');
    });

    it('should handle tracking failure', async () => {
      const error = new Error('Redis error');
      mockRedisClient.setEx.mockRejectedValue(error);

      await expect(service.trackJob(mockJobInfo)).rejects.toThrow('Redis error');
      expect(logger.error).toHaveBeenCalledWith('Failed to track job:', error);
    });

    it('should throw error when not connected', async () => {
      // Simulate disconnection
      const disconnectHandler = mockRedisClient.on.mock.calls.find(call => call[0] === 'disconnect')[1];
      disconnectHandler();

      await expect(service.trackJob(mockJobInfo)).rejects.toThrow('Redis client not connected');
    });
  });

  describe('getJobInfo', () => {
    const mockJobData = {
      jobName: 'test-job',
      buildNumber: 123,
      status: 'PENDING',
      timestamp: Date.now(),
    };

    beforeEach(async () => {
      await service.initialize();
      const connectHandler = mockRedisClient.on.mock.calls.find(call => call[0] === 'connect')[1];
      connectHandler();
    });

    it('should get job info successfully', async () => {
      mockRedisClient.get.mockResolvedValue(JSON.stringify(mockJobData));

      const result = await service.getJobInfo('test-job', 123);

      expect(mockRedisClient.get).toHaveBeenCalledWith('job:test-job:123');
      expect(result).toEqual(mockJobData);
    });

    it('should return null when job not found', async () => {
      mockRedisClient.get.mockResolvedValue(null);

      const result = await service.getJobInfo('test-job', 123);

      expect(result).toBeNull();
    });

    it('should handle get failure', async () => {
      const error = new Error('Redis get error');
      mockRedisClient.get.mockRejectedValue(error);

      const result = await service.getJobInfo('test-job', 123);

      expect(result).toBeNull();
      expect(logger.error).toHaveBeenCalledWith('Failed to get job info:', error);
    });
  });

  describe('updateJobStatus', () => {
    const mockJobInfo = {
      jobName: 'test-job',
      buildNumber: 123,
      status: 'PENDING',
      timestamp: Date.now(),
    };

    beforeEach(async () => {
      await service.initialize();
      const connectHandler = mockRedisClient.on.mock.calls.find(call => call[0] === 'connect')[1];
      connectHandler();
    });

    it('should update job status successfully', async () => {
      mockRedisClient.get.mockResolvedValue(JSON.stringify(mockJobInfo));
      mockRedisClient.setEx.mockResolvedValue('OK');

      await service.updateJobStatus('test-job', 123, 'SUCCESS', { duration: 60000 });

      expect(mockRedisClient.get).toHaveBeenCalledWith('job:test-job:123');
      expect(mockRedisClient.setEx).toHaveBeenCalledWith(
        'job:test-job:123',
        3600,
        expect.stringContaining('"status":"SUCCESS"')
      );
      expect(logger.info).toHaveBeenCalledWith('Updated job status: test-job#123 -> SUCCESS');
    });

    it('should handle job not found', async () => {
      mockRedisClient.get.mockResolvedValue(null);

      await service.updateJobStatus('test-job', 123, 'SUCCESS');

      expect(logger.warn).toHaveBeenCalledWith('Job info not found for update: test-job#123');
    });

    it('should handle get failure during update', async () => {
      const error = new Error('Get failed');
      mockRedisClient.get.mockRejectedValue(error);

      // Should not throw because getJobInfo catches the error and returns null
      await service.updateJobStatus('test-job', 123, 'SUCCESS');

      expect(logger.error).toHaveBeenCalledWith('Failed to get job info:', error);
      expect(logger.warn).toHaveBeenCalledWith('Job info not found for update: test-job#123');
    });

    it('should handle setEx failure during update', async () => {
      const mockJobInfo = { jobName: 'test-job', buildNumber: 123, status: 'PENDING', timestamp: Date.now() };
      mockRedisClient.get.mockResolvedValue(JSON.stringify(mockJobInfo));
      const error = new Error('SetEx failed');
      mockRedisClient.setEx.mockRejectedValue(error);

      await expect(service.updateJobStatus('test-job', 123, 'SUCCESS')).rejects.toThrow('SetEx failed');
      expect(logger.error).toHaveBeenCalledWith('Failed to track job:', error);
    });
  });

  describe('cleanupCompletedJob', () => {
    beforeEach(async () => {
      await service.initialize();
      const connectHandler = mockRedisClient.on.mock.calls.find(call => call[0] === 'connect')[1];
      connectHandler();
    });

    it('should cleanup job successfully', async () => {
      mockRedisClient.del.mockResolvedValue(1);

      await service.cleanupCompletedJob('test-job', 123);

      expect(mockRedisClient.del).toHaveBeenCalledWith('job:test-job:123');
      expect(logger.info).toHaveBeenCalledWith('Cleaned up job tracking: job:test-job:123');
    });

    it('should handle cleanup failure', async () => {
      const error = new Error('Cleanup failed');
      mockRedisClient.del.mockRejectedValue(error);

      await service.cleanupCompletedJob('test-job', 123);

      expect(logger.error).toHaveBeenCalledWith('Failed to cleanup job tracking:', error);
    });
  });

  describe('cleanupExpiredJobs', () => {
    beforeEach(async () => {
      await service.initialize();
      const connectHandler = mockRedisClient.on.mock.calls.find(call => call[0] === 'connect')[1];
      connectHandler();
    });

    it('should cleanup expired jobs successfully', async () => {
      mockRedisClient.keys.mockResolvedValue(['job:test1:1', 'job:test2:2']);
      mockRedisClient.ttl.mockResolvedValueOnce(-1).mockResolvedValueOnce(-2);
      mockRedisClient.expire.mockResolvedValue(1);

      await service.cleanupExpiredJobs();

      expect(mockRedisClient.keys).toHaveBeenCalledWith('job:*');
      expect(mockRedisClient.expire).toHaveBeenCalledWith('job:test1:1', 3600);
      expect(logger.info).toHaveBeenCalledWith('Cleaned up 1 expired job tracking entries');
    });

    it('should handle cleanup failure', async () => {
      const error = new Error('Keys failed');
      mockRedisClient.keys.mockRejectedValue(error);

      await service.cleanupExpiredJobs();

      expect(logger.error).toHaveBeenCalledWith('Failed to cleanup expired jobs:', error);
    });
  });

  describe('disconnect', () => {
    beforeEach(async () => {
      await service.initialize();
      const connectHandler = mockRedisClient.on.mock.calls.find(call => call[0] === 'connect')[1];
      connectHandler();
    });

    it('should disconnect successfully', async () => {
      mockRedisClient.disconnect.mockResolvedValue(undefined);

      await service.disconnect();

      expect(mockRedisClient.disconnect).toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalledWith('Redis client disconnected');
    });

    it('should handle disconnect failure', async () => {
      const error = new Error('Disconnect failed');
      mockRedisClient.disconnect.mockRejectedValue(error);

      await service.disconnect();

      expect(logger.error).toHaveBeenCalledWith('Error disconnecting Redis client:', error);
    });

    it('should not attempt disconnect if not connected', async () => {
      // Simulate disconnection
      const disconnectHandler = mockRedisClient.on.mock.calls.find(call => call[0] === 'disconnect')[1];
      disconnectHandler();

      await service.disconnect();

      expect(mockRedisClient.disconnect).not.toHaveBeenCalled();
    });
  });
});