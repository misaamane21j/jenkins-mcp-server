import { TriggerJobTool } from '../../../../src/server/tools/trigger-job';
import { JobStatusTool } from '../../../../src/server/tools/job-status';
import { ListJobsTool } from '../../../../src/server/tools/list-jobs';
import { GetJobParametersTool } from '../../../../src/server/tools/get-job-parameters';
import {
  JenkinsError,
  AuthenticationError,
  JobNotFoundError,
  MCPError
} from '../../../../src/utils/error-handler';

// Mock all dependencies
jest.mock('../../../../src/services/jenkins-client');
jest.mock('../../../../src/services/job-tracker');
jest.mock('../../../../src/utils/logger');
jest.mock('../../../../src/utils/validation');

const mockValidateInput = require('../../../../src/utils/validation').validateInput;

describe('Tool Error Handling', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('TriggerJobTool Error Handling', () => {
    let triggerJobTool: TriggerJobTool;

    beforeEach(() => {
      triggerJobTool = new TriggerJobTool();
    });

    it('should handle Jenkins API errors and return MCP formatted error', async () => {
      // Mock validation to pass
      mockValidateInput.mockReturnValue({
        jobName: 'test-job',
        parameters: {},
        callbackInfo: { slackChannel: '#test' }
      });

      // Mock Jenkins client to throw error
      const jenkinsError = new JenkinsError('Jenkins server unavailable', 503, 'Service Unavailable');
      const mockJenkinsClient = {
        triggerJob: jest.fn().mockRejectedValue(jenkinsError)
      };
      (triggerJobTool as any).jenkinsClient = mockJenkinsClient;

      const result = await triggerJobTool.execute({
        jobName: 'test-job',
        parameters: {},
        callbackInfo: { slackChannel: '#test' }
      });

      expect(result.content).toBeDefined();
      expect(result.content[0].type).toBe('text');
      
      const errorResponse = JSON.parse(result.content[0].text);
      expect(errorResponse.error).toBe(true);
      expect(errorResponse.message).toContain('Jenkins server unavailable');
      expect(errorResponse.errorType).toBe('JenkinsError');
      expect(errorResponse.details).toHaveProperty('errorType', 'JENKINS_ERROR');
      expect(errorResponse.details).toHaveProperty('jenkinsStatusCode', 503);
    });

    it('should handle authentication errors and return MCP formatted error', async () => {
      mockValidateInput.mockReturnValue({
        jobName: 'test-job',
        parameters: {}
      });

      const authError = new AuthenticationError('Invalid API token');
      const mockJenkinsClient = {
        triggerJob: jest.fn().mockRejectedValue(authError)
      };
      (triggerJobTool as any).jenkinsClient = mockJenkinsClient;

      const result = await triggerJobTool.execute({
        jobName: 'test-job',
        parameters: {}
      });

      const errorResponse = JSON.parse(result.content[0].text);
      expect(errorResponse.error).toBe(true);
      expect(errorResponse.message).toContain('Invalid API token');
      expect(errorResponse.errorType).toBe('AuthenticationError');
      expect(errorResponse.details).toHaveProperty('errorType', 'AUTHENTICATION_ERROR');
      expect(errorResponse.details).toHaveProperty('statusCode', 401);
    });

    it('should handle validation errors properly', async () => {
      // Mock validation to throw error
      const validationError = new Error('jobName is required');
      mockValidateInput.mockImplementation(() => {
        throw validationError;
      });

      const result = await triggerJobTool.execute({});

      const errorResponse = JSON.parse(result.content[0].text);
      expect(errorResponse.error).toBe(true);
      expect(errorResponse.message).toContain('jobName is required');
    });
  });

  describe('JobStatusTool Error Handling', () => {
    let jobStatusTool: JobStatusTool;

    beforeEach(() => {
      jobStatusTool = new JobStatusTool();
    });

    it('should handle job not found errors and return MCP formatted error', async () => {
      mockValidateInput.mockReturnValue({
        jobName: 'non-existent-job',
        buildNumber: 1
      });

      const jobNotFoundError = new JobNotFoundError('non-existent-job');
      const mockJenkinsClient = {
        getBuildStatus: jest.fn().mockRejectedValue(jobNotFoundError)
      };
      (jobStatusTool as any).jenkinsClient = mockJenkinsClient;

      const result = await jobStatusTool.execute({
        jobName: 'non-existent-job',
        buildNumber: 1
      });

      const errorResponse = JSON.parse(result.content[0].text);
      expect(errorResponse.error).toBe(true);
      expect(errorResponse.message).toContain('Job not found: non-existent-job');
      expect(errorResponse.errorType).toBe('JobNotFoundError');
      expect(errorResponse.details).toHaveProperty('errorType', 'JOB_NOT_FOUND');
      expect(errorResponse.details).toHaveProperty('jobName', 'non-existent-job');
    });

    it('should handle build number validation error', async () => {
      mockValidateInput.mockReturnValue({
        jobName: 'test-job',
        buildNumber: undefined
      });

      const result = await jobStatusTool.execute({
        jobName: 'test-job'
      });

      const errorResponse = JSON.parse(result.content[0].text);
      expect(errorResponse.error).toBe(true);
      expect(errorResponse.message).toContain('Build number is required');
    });
  });

  describe('ListJobsTool Error Handling', () => {
    let listJobsTool: ListJobsTool;

    beforeEach(() => {
      listJobsTool = new ListJobsTool();
    });

    it('should handle Jenkins connection errors', async () => {
      mockValidateInput.mockReturnValue({
        filter: 'test-*',
        includeDisabled: false
      });

      const connectionError = new Error('ECONNREFUSED: Connection refused');
      const mockJenkinsClient = {
        listJobs: jest.fn().mockRejectedValue(connectionError)
      };
      (listJobsTool as any).jenkinsClient = mockJenkinsClient;

      const result = await listJobsTool.execute({
        filter: 'test-*',
        includeDisabled: false
      });

      const errorResponse = JSON.parse(result.content[0].text);
      expect(errorResponse.error).toBe(true);
      expect(errorResponse.message).toContain('Connection refused');
    });

    it('should handle generic errors properly', async () => {
      mockValidateInput.mockReturnValue({});

      const genericError = new Error('Unexpected server error');
      const mockJenkinsClient = {
        listJobs: jest.fn().mockRejectedValue(genericError)
      };
      (listJobsTool as any).jenkinsClient = mockJenkinsClient;

      const result = await listJobsTool.execute({});

      const errorResponse = JSON.parse(result.content[0].text);
      expect(errorResponse.error).toBe(true);
      expect(errorResponse.message).toContain('Unexpected server error');
    });
  });

  describe('GetJobParametersTool Error Handling', () => {
    let getJobParametersTool: GetJobParametersTool;

    beforeEach(() => {
      getJobParametersTool = new GetJobParametersTool();
    });

    it('should handle MCP errors and return formatted response', async () => {
      mockValidateInput.mockReturnValue({
        jobName: 'test-job'
      });

      const mcpError = new MCPError('Invalid request format', 'INVALID_REQUEST');
      const mockJenkinsClient = {
        getJobParameters: jest.fn().mockRejectedValue(mcpError)
      };
      (getJobParametersTool as any).jenkinsClient = mockJenkinsClient;

      const result = await getJobParametersTool.execute({
        jobName: 'test-job'
      });

      const errorResponse = JSON.parse(result.content[0].text);
      expect(errorResponse.error).toBe(true);
      expect(errorResponse.message).toContain('Invalid request format');
      expect(errorResponse.errorType).toBe('MCPError');
      expect(errorResponse.details).toHaveProperty('errorType', 'MCP_ERROR');
      expect(errorResponse.details).toHaveProperty('mcpCode', 'INVALID_REQUEST');
    });

    it('should handle timeout errors appropriately', async () => {
      mockValidateInput.mockReturnValue({
        jobName: 'slow-job'
      });

      const timeoutError = new Error('Request timeout after 30s');
      const mockJenkinsClient = {
        getJobParameters: jest.fn().mockRejectedValue(timeoutError)
      };
      (getJobParametersTool as any).jenkinsClient = mockJenkinsClient;

      const result = await getJobParametersTool.execute({
        jobName: 'slow-job'
      });

      const errorResponse = JSON.parse(result.content[0].text);
      expect(errorResponse.error).toBe(true);
      expect(errorResponse.message).toContain('Request timeout after 30s');
    });
  });

  describe('Error Response Format Consistency', () => {
    it('should maintain consistent error response format across all tools', async () => {
      const tools = [
        new TriggerJobTool(),
        new JobStatusTool(),
        new ListJobsTool(),
        new GetJobParametersTool()
      ];

      // Mock validation to throw error for all tools
      mockValidateInput.mockImplementation(() => {
        throw new Error('Test error');
      });

      for (const tool of tools) {
        const result = await tool.execute({});
        
        expect(result.content).toBeDefined();
        expect(result.content[0].type).toBe('text');
        
        const errorResponse = JSON.parse(result.content[0].text);
        expect(errorResponse).toHaveProperty('error', true);
        expect(errorResponse).toHaveProperty('message');
        expect(errorResponse).toHaveProperty('errorType');
        expect(errorResponse).toHaveProperty('details');
      }
    });

    it('should include proper error details for AppError instances', async () => {
      mockValidateInput.mockReturnValue({ jobName: 'test-job' });

      const jenkinsError = new JenkinsError('API Error', 500, 'Internal Server Error');
      
      const triggerJobTool = new TriggerJobTool();
      const mockJenkinsClient = {
        triggerJob: jest.fn().mockRejectedValue(jenkinsError)
      };
      (triggerJobTool as any).jenkinsClient = mockJenkinsClient;

      const result = await triggerJobTool.execute({ jobName: 'test-job' });
      const errorResponse = JSON.parse(result.content[0].text);

      expect(errorResponse.details).toHaveProperty('errorType', 'JENKINS_ERROR');
      expect(errorResponse.details).toHaveProperty('statusCode', 502);
      expect(errorResponse.details).toHaveProperty('jenkinsStatusCode', 500);
      expect(errorResponse.details).toHaveProperty('jenkinsResponse', 'Internal Server Error');
    });
  });
});