import { TriggerJobTool } from '../../../../src/server/tools/trigger-job';
import { JenkinsClientService } from '../../../../src/services/jenkins-client';
import { JobTrackerService } from '../../../../src/services/job-tracker';
import { ValidationError } from '../../../../src/utils/validation';

// Mock the dependencies
jest.mock('../../../../src/services/jenkins-client');
jest.mock('../../../../src/services/job-tracker');
jest.mock('../../../../src/utils/logger');

const mockJenkinsClient = JenkinsClientService as jest.MockedClass<typeof JenkinsClientService>;
const mockJobTracker = JobTrackerService as jest.MockedClass<typeof JobTrackerService>;

describe('TriggerJobTool', () => {
  let tool: TriggerJobTool;
  let mockJenkinsInstance: jest.Mocked<JenkinsClientService>;
  let mockJobTrackerInstance: jest.Mocked<JobTrackerService>;

  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();
    
    // Create mock instances
    mockJenkinsInstance = {
      triggerJob: jest.fn(),
    } as any;
    
    mockJobTrackerInstance = {
      trackJob: jest.fn(),
    } as any;

    // Mock constructor returns
    mockJenkinsClient.mockImplementation(() => mockJenkinsInstance);
    mockJobTracker.mockImplementation(() => mockJobTrackerInstance);

    tool = new TriggerJobTool();
  });

  describe('execute', () => {
    const validArgs = {
      jobName: 'test-job',
      parameters: { branch: 'main', version: '1.0.0' },
      callbackInfo: {
        slackChannel: '#test-channel',
        slackThreadTs: '1234567890.123',
        slackUserId: 'U123456789'
      }
    };

    it('should successfully trigger a Jenkins job with valid parameters', async () => {
      const mockBuildResult = {
        buildNumber: 123,
        queueId: 456,
        jobName: 'test-job',
        status: 'TRIGGERED'
      };

      mockJenkinsInstance.triggerJob.mockResolvedValue(mockBuildResult);
      mockJobTrackerInstance.trackJob.mockResolvedValue(undefined);

      const result = await tool.execute(validArgs);

      // Verify Jenkins client called correctly
      expect(mockJenkinsInstance.triggerJob).toHaveBeenCalledWith(
        'test-job',
        { branch: 'main', version: '1.0.0' }
      );

      // Verify job tracker called correctly
      expect(mockJobTrackerInstance.trackJob).toHaveBeenCalledWith({
        jobName: 'test-job',
        buildNumber: 123,
        callbackInfo: validArgs.callbackInfo,
        status: 'PENDING',
        timestamp: expect.any(Number)
      });

      // Verify response format
      expect(result).toEqual({
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              buildNumber: 123,
              jobName: 'test-job',
              status: 'TRIGGERED',
              queueId: 456
            })
          }
        ]
      });
    });

    it('should validate required fields', async () => {
      const invalidArgs = {};

      await expect(tool.execute(invalidArgs)).rejects.toThrow(ValidationError);
    });

    it('should validate job name format', async () => {
      const invalidArgs = {
        ...validArgs,
        jobName: 'invalid job name!'  // Contains invalid characters
      };

      await expect(tool.execute(invalidArgs)).rejects.toThrow(ValidationError);
    });

    it('should validate Slack channel format', async () => {
      const invalidArgs = {
        ...validArgs,
        callbackInfo: {
          ...validArgs.callbackInfo,
          slackChannel: 'test-channel'  // Missing #
        }
      };

      await expect(tool.execute(invalidArgs)).rejects.toThrow(ValidationError);
    });

    it('should handle Jenkins client errors', async () => {
      mockJenkinsInstance.triggerJob.mockRejectedValue(new Error('Jenkins error'));

      await expect(tool.execute(validArgs)).rejects.toThrow('Jenkins error');
      expect(mockJobTrackerInstance.trackJob).not.toHaveBeenCalled();
    });

    it('should handle job tracker errors', async () => {
      const mockBuildResult = {
        buildNumber: 123,
        queueId: 456,
        jobName: 'test-job',
        status: 'TRIGGERED'
      };

      mockJenkinsInstance.triggerJob.mockResolvedValue(mockBuildResult);
      mockJobTrackerInstance.trackJob.mockRejectedValue(new Error('Tracker error'));

      await expect(tool.execute(validArgs)).rejects.toThrow('Tracker error');
    });

    it('should work without optional parameters', async () => {
      const minimalArgs = {
        jobName: 'test-job',
        parameters: {},
      };

      const mockBuildResult = {
        buildNumber: 123,
        queueId: 456,
        jobName: 'test-job',
        status: 'TRIGGERED'
      };

      mockJenkinsInstance.triggerJob.mockResolvedValue(mockBuildResult);
      mockJobTrackerInstance.trackJob.mockResolvedValue(undefined);

      const result = await tool.execute(minimalArgs);

      expect(result.content[0].text).toContain('test-job');
      expect(mockJenkinsInstance.triggerJob).toHaveBeenCalledWith('test-job', {});
    });
  });
});