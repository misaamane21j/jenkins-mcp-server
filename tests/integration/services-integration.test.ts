import { JenkinsClientService } from '../../src/services/jenkins-client';
import { JobTrackerService } from '../../src/services/job-tracker';
import { WebhookHandler } from '../../src/services/webhook-handler';

// Mock Redis
jest.mock('redis', () => ({
  createClient: jest.fn().mockReturnValue({
    connect: jest.fn().mockResolvedValue(undefined),
    disconnect: jest.fn().mockResolvedValue(undefined),
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue('OK'),
    del: jest.fn().mockResolvedValue(1),
    isReady: true,
    on: jest.fn(),
    once: jest.fn(),
  }),
}));

// Mock Jenkins library
jest.mock('jenkins');

// Mock axios for notifications
jest.mock('axios');

describe('Services Integration Tests', () => {
  let jobTracker: JobTrackerService;
  let webhookHandler: WebhookHandler;

  beforeEach(async () => {
    // Create job tracker
    jobTracker = new JobTrackerService();
    await jobTracker.initialize();

    // Create webhook handler
    webhookHandler = new WebhookHandler(jobTracker);
  });

  afterEach(async () => {
    if (jobTracker) {
      await jobTracker.disconnect();
    }
  });

  describe('JobTrackerService', () => {
    it('should initialize successfully', async () => {
      expect(jobTracker).toBeDefined();
      // Additional connection verification would happen in real Redis
    });

    it('should track job information', async () => {
      const jobInfo = {
        jobName: 'test-job',
        buildNumber: 1,
        status: 'SUCCESS',
        timestamp: Date.now(),
        callbackInfo: {
          slackChannel: '#test',
          slackThreadTs: '123456',
          slackUserId: 'U123456'
        }
      };

      await expect(jobTracker.trackJob(jobInfo)).resolves.not.toThrow();
    });

    it('should retrieve job information', async () => {
      const jobInfo = {
        jobName: 'test-job',
        buildNumber: 1,
        status: 'SUCCESS',
        timestamp: Date.now(),
        callbackInfo: {
          slackChannel: '#test',
          slackThreadTs: '123456',
          slackUserId: 'U123456'
        }
      };

      await jobTracker.trackJob(jobInfo);
      const retrieved = await jobTracker.getJobInfo('test-job', 1);
      
      expect(retrieved).toBeDefined();
    });
  });

  describe('WebhookHandler', () => {
    it('should instantiate successfully', () => {
      expect(webhookHandler).toBeDefined();
    });

    it('should start webhook server', async () => {
      await expect(webhookHandler.start()).resolves.not.toThrow();
      await webhookHandler.stop();
    });
  });

  describe('JenkinsClientService', () => {
    it('should instantiate without errors', () => {
      expect(() => new JenkinsClientService()).not.toThrow();
    });
  });

  describe('Integration scenarios', () => {
    it('should handle job tracking operations', async () => {
      const jobInfo = {
        jobName: 'integration-test-job',
        buildNumber: 5,
        status: 'SUCCESS',
        timestamp: Date.now(),
        callbackInfo: {
          slackChannel: '#integration',
          slackThreadTs: '123456',
          slackUserId: 'U123456'
        }
      };

      // Track job
      await jobTracker.trackJob(jobInfo);

      // Verify job was tracked
      const retrieved = await jobTracker.getJobInfo('integration-test-job', 5);
      expect(retrieved).toBeDefined();
      expect(retrieved?.status).toBe('SUCCESS');
    });

    it('should handle multiple concurrent job tracking', async () => {
      const jobs = Array.from({ length: 5 }, (_, i) => ({
        jobName: `concurrent-job-${i}`,
        buildNumber: 1,
        status: 'SUCCESS',
        timestamp: Date.now(),
        callbackInfo: {
          slackChannel: `#job-${i}`,
          slackThreadTs: '123456',
          slackUserId: 'U123456'
        }
      }));

      const promises = jobs.map(jobInfo => 
        jobTracker.trackJob(jobInfo)
      );

      await expect(Promise.all(promises)).resolves.not.toThrow();
    });
  });

  describe('Error resilience', () => {
    it('should handle Redis disconnection gracefully', async () => {
      // Simulate Redis disconnection
      await jobTracker.disconnect();

      // Operations should throw errors when disconnected
      await expect(
        jobTracker.trackJob({ 
          jobName: 'test',
          buildNumber: 1, 
          status: 'SUCCESS', 
          timestamp: Date.now(),
          callbackInfo: {
            slackChannel: '#test',
            slackThreadTs: '123456',
            slackUserId: 'U123456'
          }
        })
      ).rejects.toThrow();
    });
  });
});