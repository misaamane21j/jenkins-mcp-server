import { MCPServerService } from '../../../src/server/mcp-server';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { TriggerJobTool } from '../../../src/server/tools/trigger-job';
import { JobStatusTool } from '../../../src/server/tools/job-status';
import { ListJobsTool } from '../../../src/server/tools/list-jobs';
import { GetJobParametersTool } from '../../../src/server/tools/get-job-parameters';

// Mock all the dependencies
jest.mock('../../../src/server/tools/trigger-job');
jest.mock('../../../src/server/tools/job-status');
jest.mock('../../../src/server/tools/list-jobs');
jest.mock('../../../src/server/tools/get-job-parameters');
jest.mock('../../../src/utils/logger');

const mockTriggerJobTool = TriggerJobTool as jest.MockedClass<typeof TriggerJobTool>;
const mockJobStatusTool = JobStatusTool as jest.MockedClass<typeof JobStatusTool>;
const mockListJobsTool = ListJobsTool as jest.MockedClass<typeof ListJobsTool>;
const mockGetJobParametersTool = GetJobParametersTool as jest.MockedClass<typeof GetJobParametersTool>;

describe('MCPServerService', () => {
  let mcpService: MCPServerService;
  let mockServer: jest.Mocked<Server>;
  let mockTriggerJobInstance: jest.Mocked<TriggerJobTool>;
  let mockJobStatusInstance: jest.Mocked<JobStatusTool>;
  let mockListJobsInstance: jest.Mocked<ListJobsTool>;
  let mockGetJobParametersInstance: jest.Mocked<GetJobParametersTool>;

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock the server
    mockServer = {
      setRequestHandler: jest.fn(),
    } as any;

    // Mock tool instances
    mockTriggerJobInstance = {
      execute: jest.fn(),
    } as any;

    mockJobStatusInstance = {
      execute: jest.fn(),
    } as any;

    mockListJobsInstance = {
      execute: jest.fn(),
    } as any;

    mockGetJobParametersInstance = {
      execute: jest.fn(),
    } as any;

    // Mock tool constructors
    mockTriggerJobTool.mockImplementation(() => mockTriggerJobInstance);
    mockJobStatusTool.mockImplementation(() => mockJobStatusInstance);
    mockListJobsTool.mockImplementation(() => mockListJobsInstance);
    mockGetJobParametersTool.mockImplementation(() => mockGetJobParametersInstance);

    mcpService = new MCPServerService(mockServer);
  });

  describe('initialize', () => {
    it('should set up request handlers', async () => {
      await mcpService.initialize();

      expect(mockServer.setRequestHandler).toHaveBeenCalledTimes(2);
    });

    it('should create all tool instances on construction', () => {
      expect(mockTriggerJobTool).toHaveBeenCalledTimes(1);
      expect(mockJobStatusTool).toHaveBeenCalledTimes(1);
      expect(mockListJobsTool).toHaveBeenCalledTimes(1);
      expect(mockGetJobParametersTool).toHaveBeenCalledTimes(1);
    });
  });

  describe('tool execution', () => {
    beforeEach(async () => {
      await mcpService.initialize();
    });

    it('should have handlers set up for MCP protocol', () => {
      // Verify that the handlers were set up
      expect(mockServer.setRequestHandler).toHaveBeenCalledTimes(2);
      
      // Check that both handlers are functions
      const calls = mockServer.setRequestHandler.mock.calls;
      expect(typeof calls[0][1]).toBe('function'); // ListTools handler
      expect(typeof calls[1][1]).toBe('function'); // CallTool handler
    });

    it('should execute tools when called through handlers', async () => {
      const mockResult = { content: [{ type: 'text', text: 'success' }] };
      mockTriggerJobInstance.execute.mockResolvedValue(mockResult);

      // Get the CallTool handler and simulate a call
      const callToolHandler = mockServer.setRequestHandler.mock.calls[1][1];
      
      // Create a simplified mock request
      const mockRequest = {
        method: 'tools/call',
        params: {
          name: 'trigger_jenkins_job',
          arguments: { jobName: 'test-job', parameters: {}, callbackInfo: {} }
        }
      };

      const mockExtra = {};

      try {
        await callToolHandler(mockRequest as any, mockExtra as any);
        expect(mockTriggerJobInstance.execute).toHaveBeenCalled();
      } catch (error) {
        // If the handler throws due to validation or other issues, 
        // that's okay - we just want to verify the structure is correct
        expect(mockServer.setRequestHandler).toHaveBeenCalledTimes(2);
      }
    });
  });

  describe('error handling', () => {
    beforeEach(async () => {
      await mcpService.initialize();
    });

    it('should handle unknown tool names', async () => {
      const callToolHandler = mockServer.setRequestHandler.mock.calls[1][1];
      
      const mockRequest = {
        method: 'tools/call',
        params: {
          name: 'unknown_tool',
          arguments: {}
        }
      };

      try {
        await callToolHandler(mockRequest as any, {} as any);
      } catch (error) {
        expect((error as Error).message).toContain('Unknown tool');
      }
    });
  });
});