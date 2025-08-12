import { GetJobParametersTool } from '../../../../src/server/tools/get-job-parameters';
import { JenkinsClientService } from '../../../../src/services/jenkins-client';
import { ValidationError } from '../../../../src/utils/validation';

// Mock the dependencies
jest.mock('../../../../src/services/jenkins-client');
jest.mock('../../../../src/utils/logger');

const mockJenkinsClient = JenkinsClientService as jest.MockedClass<typeof JenkinsClientService>;

describe('GetJobParametersTool', () => {
  let tool: GetJobParametersTool;
  let mockJenkinsInstance: jest.Mocked<JenkinsClientService>;

  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();
    
    // Create mock instance
    mockJenkinsInstance = {
      getJobParameters: jest.fn(),
    } as any;

    // Mock constructor returns
    mockJenkinsClient.mockImplementation(() => mockJenkinsInstance);

    tool = new GetJobParametersTool();
  });

  describe('execute', () => {
    const validArgs = {
      jobName: 'test-job'
    };

    const mockParameters = [
      {
        name: 'branch',
        description: 'Git branch to build',
        defaultValue: 'main',
        type: 'String'
      },
      {
        name: 'version',
        description: 'Version number',
        defaultValue: '1.0.0',
        type: 'String'
      },
      {
        name: 'skipTests',
        description: 'Skip running tests',
        defaultValue: 'false',
        type: 'Boolean'
      },
      {
        name: 'environment',
        description: 'Target environment',
        defaultValue: 'development',
        type: 'Choice'
      }
    ];

    it('should successfully get job parameters with valid job name', async () => {
      mockJenkinsInstance.getJobParameters.mockResolvedValue(mockParameters);

      const result = await tool.execute(validArgs);

      // Verify Jenkins client called correctly
      expect(mockJenkinsInstance.getJobParameters).toHaveBeenCalledWith('test-job');

      // Verify response format
      expect(result).toEqual({
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              jobName: 'test-job',
              parameters: mockParameters
            })
          }
        ]
      });
    });

    it('should validate required jobName field', async () => {
      const invalidArgs = {};

      await expect(tool.execute(invalidArgs)).rejects.toThrow(ValidationError);
    });

    it('should validate job name format', async () => {
      const invalidArgs = {
        jobName: 'invalid job name!'  // Contains invalid characters
      };

      await expect(tool.execute(invalidArgs)).rejects.toThrow(ValidationError);
    });

    it('should validate job name minimum length', async () => {
      const invalidArgs = {
        jobName: ''  // Empty string
      };

      await expect(tool.execute(invalidArgs)).rejects.toThrow(ValidationError);
    });

    it('should validate job name maximum length', async () => {
      const invalidArgs = {
        jobName: 'a'.repeat(256)  // Exceeds 255 character limit
      };

      await expect(tool.execute(invalidArgs)).rejects.toThrow(ValidationError);
    });

    it('should handle Jenkins client errors', async () => {
      mockJenkinsInstance.getJobParameters.mockRejectedValue(new Error('Job not found'));

      await expect(tool.execute(validArgs)).rejects.toThrow('Job not found');
    });

    it('should handle job with no parameters', async () => {
      mockJenkinsInstance.getJobParameters.mockResolvedValue([]);

      const result = await tool.execute(validArgs);

      const responseData = JSON.parse(result.content[0].text);
      expect(responseData.parameters).toEqual([]);
      expect(responseData.jobName).toBe('test-job');
    });

    it('should handle jobs with forward slashes in name', async () => {
      const args = {
        jobName: 'folder/sub-folder/test-job'
      };

      mockJenkinsInstance.getJobParameters.mockResolvedValue(mockParameters);

      const result = await tool.execute(args);

      expect(mockJenkinsInstance.getJobParameters).toHaveBeenCalledWith('folder/sub-folder/test-job');
      
      const responseData = JSON.parse(result.content[0].text);
      expect(responseData.jobName).toBe('folder/sub-folder/test-job');
    });

    it('should handle different parameter types', async () => {
      const diverseParameters = [
        {
          name: 'stringParam',
          description: 'A string parameter',
          defaultValue: 'default',
          type: 'String'
        },
        {
          name: 'booleanParam',
          description: 'A boolean parameter',
          defaultValue: 'true',
          type: 'Boolean'
        },
        {
          name: 'choiceParam',
          description: 'A choice parameter',
          defaultValue: 'option1',
          type: 'Choice'
        },
        {
          name: 'passwordParam',
          description: 'A password parameter',
          defaultValue: '',
          type: 'Password'
        },
        {
          name: 'textParam',
          description: 'A text parameter',
          defaultValue: 'multi\nline\ntext',
          type: 'Text'
        }
      ];

      mockJenkinsInstance.getJobParameters.mockResolvedValue(diverseParameters);

      const result = await tool.execute(validArgs);

      const responseData = JSON.parse(result.content[0].text);
      expect(responseData.parameters).toHaveLength(5);
      expect(responseData.parameters[0].type).toBe('String');
      expect(responseData.parameters[1].type).toBe('Boolean');
      expect(responseData.parameters[2].type).toBe('Choice');
      expect(responseData.parameters[3].type).toBe('Password');
      expect(responseData.parameters[4].type).toBe('Text');
    });

    it('should handle parameters with no default values', async () => {
      const parametersWithoutDefaults = [
        {
          name: 'requiredParam',
          description: 'A required parameter',
          defaultValue: '',
          type: 'String'
        }
      ];

      mockJenkinsInstance.getJobParameters.mockResolvedValue(parametersWithoutDefaults);

      const result = await tool.execute(validArgs);

      const responseData = JSON.parse(result.content[0].text);
      expect(responseData.parameters[0].defaultValue).toBe('');
    });

    it('should handle parameters with special characters in descriptions', async () => {
      const parametersWithSpecialChars = [
        {
          name: 'specialParam',
          description: 'Parameter with special chars: <>&"\'',
          defaultValue: 'default',
          type: 'String'
        }
      ];

      mockJenkinsInstance.getJobParameters.mockResolvedValue(parametersWithSpecialChars);

      const result = await tool.execute(validArgs);

      const responseData = JSON.parse(result.content[0].text);
      expect(responseData.parameters[0].description).toBe('Parameter with special chars: <>&"\'');
    });
  });
});