import { ListJobsTool } from '../../../../src/server/tools/list-jobs';
import { JenkinsClientService } from '../../../../src/services/jenkins-client';
import { ValidationError } from '../../../../src/utils/validation';

// Mock the dependencies
jest.mock('../../../../src/services/jenkins-client');
jest.mock('../../../../src/utils/logger');

const mockJenkinsClient = JenkinsClientService as jest.MockedClass<typeof JenkinsClientService>;

describe('ListJobsTool', () => {
  let tool: ListJobsTool;
  let mockJenkinsInstance: jest.Mocked<JenkinsClientService>;

  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();
    
    // Create mock instance
    mockJenkinsInstance = {
      listJobs: jest.fn(),
    } as any;

    // Mock constructor returns
    mockJenkinsClient.mockImplementation(() => mockJenkinsInstance);

    tool = new ListJobsTool();
  });

  describe('execute', () => {
    const mockJobs = [
      {
        name: 'test-job-1',
        url: 'http://jenkins.example.com/job/test-job-1/',
        color: 'blue',
        buildable: true
      },
      {
        name: 'test-job-2',
        url: 'http://jenkins.example.com/job/test-job-2/',
        color: 'red',
        buildable: true
      },
      {
        name: 'disabled-job',
        url: 'http://jenkins.example.com/job/disabled-job/',
        color: 'disabled',
        buildable: false
      }
    ];

    it('should successfully list jobs without filters', async () => {
      const args = {};

      mockJenkinsInstance.listJobs.mockResolvedValue(mockJobs);

      const result = await tool.execute(args);

      // Verify Jenkins client called correctly
      expect(mockJenkinsInstance.listJobs).toHaveBeenCalledWith(undefined, false);

      // Verify response format
      expect(result).toEqual({
        content: [
          {
            type: 'text',
            text: JSON.stringify(mockJobs)
          }
        ]
      });
    });

    it('should list jobs with filter parameter', async () => {
      const args = {
        filter: 'test'
      };

      mockJenkinsInstance.listJobs.mockResolvedValue(mockJobs.slice(0, 2));

      const result = await tool.execute(args);

      // Verify Jenkins client called correctly
      expect(mockJenkinsInstance.listJobs).toHaveBeenCalledWith('test', false);

      const responseText = JSON.parse(result.content[0].text);
      expect(responseText).toHaveLength(2);
      expect(responseText.every((job: any) => job.name.includes('test'))).toBe(true);
    });

    it('should include disabled jobs when requested', async () => {
      const args = {
        includeDisabled: true
      };

      mockJenkinsInstance.listJobs.mockResolvedValue(mockJobs);

      const result = await tool.execute(args);

      // Verify Jenkins client called correctly
      expect(mockJenkinsInstance.listJobs).toHaveBeenCalledWith(undefined, true);

      const responseText = JSON.parse(result.content[0].text);
      expect(responseText).toHaveLength(3);
    });

    it('should use both filter and includeDisabled parameters', async () => {
      const args = {
        filter: 'job',
        includeDisabled: true
      };

      mockJenkinsInstance.listJobs.mockResolvedValue(mockJobs);

      const result = await tool.execute(args);

      // Verify Jenkins client called correctly
      expect(mockJenkinsInstance.listJobs).toHaveBeenCalledWith('job', true);

      const responseText = JSON.parse(result.content[0].text);
      expect(responseText).toHaveLength(3);
    });

    it('should validate filter parameter length', async () => {
      const invalidArgs = {
        filter: ''  // Empty string not allowed
      };

      const result = await tool.execute(invalidArgs);
      const errorResponse = JSON.parse(result.content[0].text);
      expect(errorResponse.error).toBe(true);
      expect(errorResponse.message).toContain('validation failed');
    });

    it('should validate filter parameter maximum length', async () => {
      const invalidArgs = {
        filter: 'a'.repeat(101)  // Exceeds 100 character limit
      };

      const result = await tool.execute(invalidArgs);
      const errorResponse = JSON.parse(result.content[0].text);
      expect(errorResponse.error).toBe(true);
      expect(errorResponse.message).toContain('validation failed');
    });

    it('should validate includeDisabled parameter type', async () => {
      const invalidArgs = {
        includeDisabled: 'true'  // String instead of boolean
      };

      // Joi should convert string to boolean, so this should work
      mockJenkinsInstance.listJobs.mockResolvedValue(mockJobs);

      const result = await tool.execute(invalidArgs);

      expect(mockJenkinsInstance.listJobs).toHaveBeenCalledWith(undefined, true);
    });

    it('should handle Jenkins client errors', async () => {
      mockJenkinsInstance.listJobs.mockRejectedValue(new Error('Connection failed'));

      const result = await tool.execute({});
      const errorResponse = JSON.parse(result.content[0].text);
      expect(errorResponse.error).toBe(true);
      expect(errorResponse.message).toContain('Connection failed');
    });

    it('should handle empty job list', async () => {
      const args = {
        filter: 'nonexistent'
      };

      mockJenkinsInstance.listJobs.mockResolvedValue([]);

      const result = await tool.execute(args);

      const responseText = JSON.parse(result.content[0].text);
      expect(responseText).toEqual([]);
    });

    it('should handle jobs in folders', async () => {
      const folderJobs = [
        {
          name: 'folder/job-1',
          url: 'http://jenkins.example.com/job/folder/job/job-1/',
          color: 'blue',
          buildable: true
        },
        {
          name: 'folder/subfolder/job-2',
          url: 'http://jenkins.example.com/job/folder/job/subfolder/job/job-2/',
          color: 'red',
          buildable: true
        }
      ];

      mockJenkinsInstance.listJobs.mockResolvedValue(folderJobs);

      const result = await tool.execute({});

      const responseText = JSON.parse(result.content[0].text);
      expect(responseText).toEqual(folderJobs);
    });

    it('should handle case-insensitive filtering', async () => {
      const args = {
        filter: 'TEST'
      };

      // Assuming the Jenkins client handles case-insensitive filtering
      mockJenkinsInstance.listJobs.mockResolvedValue(mockJobs.slice(0, 2));

      const result = await tool.execute(args);

      expect(mockJenkinsInstance.listJobs).toHaveBeenCalledWith('TEST', false);
    });
  });
});