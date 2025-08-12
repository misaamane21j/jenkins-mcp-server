import { JobStatusTool } from '../../../../src/server/tools/job-status';
import { JenkinsClientService } from '../../../../src/services/jenkins-client';
import { ValidationError } from '../../../../src/utils/validation';

// Mock the dependencies
jest.mock('../../../../src/services/jenkins-client');
jest.mock('../../../../src/utils/logger');

const mockJenkinsClient = JenkinsClientService as jest.MockedClass<typeof JenkinsClientService>;

describe('JobStatusTool', () => {
  let tool: JobStatusTool;
  let mockJenkinsInstance: jest.Mocked<JenkinsClientService>;

  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();
    
    // Create mock instance
    mockJenkinsInstance = {
      getBuildStatus: jest.fn(),
    } as any;

    // Mock constructor returns
    mockJenkinsClient.mockImplementation(() => mockJenkinsInstance);

    tool = new JobStatusTool();
  });

  describe('execute', () => {
    const validArgs = {
      jobName: 'test-job',
      buildNumber: 123
    };

    it('should successfully get job status with valid parameters', async () => {
      const mockStatus: any = {
        jobName: 'test-job',
        buildNumber: 123,
        status: 'SUCCESS' as const,
        duration: 30000,
        timestamp: 1640995200000,
        url: 'http://jenkins.example.com/job/test-job/123/'
      };

      mockJenkinsInstance.getBuildStatus.mockResolvedValue(mockStatus);

      const result = await tool.execute(validArgs);

      // Verify Jenkins client called correctly
      expect(mockJenkinsInstance.getBuildStatus).toHaveBeenCalledWith('test-job', 123);

      // Verify response format
      expect(result).toEqual({
        content: [
          {
            type: 'text',
            text: JSON.stringify(mockStatus)
          }
        ]
      });
    });

    it('should validate required jobName field', async () => {
      const invalidArgs = {
        buildNumber: 123
      };

      await expect(tool.execute(invalidArgs)).rejects.toThrow(ValidationError);
    });

    it('should validate required buildNumber field', async () => {
      const invalidArgs = {
        jobName: 'test-job'
      };

      await expect(tool.execute(invalidArgs)).rejects.toThrow(ValidationError);
    });

    it('should validate job name format', async () => {
      const invalidArgs = {
        jobName: 'invalid job name!',  // Contains invalid characters
        buildNumber: 123
      };

      await expect(tool.execute(invalidArgs)).rejects.toThrow(ValidationError);
    });

    it('should validate build number is positive integer', async () => {
      const invalidArgs = {
        jobName: 'test-job',
        buildNumber: -1
      };

      await expect(tool.execute(invalidArgs)).rejects.toThrow(ValidationError);
    });

    it('should validate build number is integer', async () => {
      const invalidArgs = {
        jobName: 'test-job',
        buildNumber: 123.45
      };

      await expect(tool.execute(invalidArgs)).rejects.toThrow(ValidationError);
    });

    it('should handle Jenkins client errors', async () => {
      mockJenkinsInstance.getBuildStatus.mockRejectedValue(new Error('Build not found'));

      await expect(tool.execute(validArgs)).rejects.toThrow('Build not found');
    });

    it('should handle different job statuses', async () => {
      const statuses = ['SUCCESS', 'FAILURE', 'UNSTABLE', 'ABORTED', 'RUNNING', 'PENDING'];
      
      for (const status of statuses) {
        const mockStatus: any = {
          jobName: 'test-job',
          buildNumber: 123,
          status: status as any,
          duration: status === 'RUNNING' ? null : 30000,
          timestamp: 1640995200000,
          url: 'http://jenkins.example.com/job/test-job/123/'
        };

        mockJenkinsInstance.getBuildStatus.mockResolvedValue(mockStatus);

        const result = await tool.execute(validArgs);
        const responseText = JSON.parse(result.content[0].text);
        
        expect(responseText.status).toBe(status);
      }
    });

    it('should handle jobs with forward slashes in name', async () => {
      const args = {
        jobName: 'folder/sub-folder/test-job',
        buildNumber: 123
      };

      const mockStatus: any = {
        jobName: 'folder/sub-folder/test-job',
        buildNumber: 123,
        status: 'SUCCESS' as const,
        duration: 30000,
        timestamp: 1640995200000,
        url: 'http://jenkins.example.com/job/folder/job/sub-folder/job/test-job/123/'
      };

      mockJenkinsInstance.getBuildStatus.mockResolvedValue(mockStatus);

      const result = await tool.execute(args);

      expect(mockJenkinsInstance.getBuildStatus).toHaveBeenCalledWith('folder/sub-folder/test-job', 123);
      
      const responseText = JSON.parse(result.content[0].text);
      expect(responseText.jobName).toBe('folder/sub-folder/test-job');
    });
  });
});