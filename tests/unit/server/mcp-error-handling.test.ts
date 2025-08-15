import { MCPServerService } from '../../../src/server/mcp-server';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
  PingRequestSchema
} from '@modelcontextprotocol/sdk/types.js';
import { 
  MCPError,
  JenkinsError,
  AuthenticationError,
  JobNotFoundError 
} from '../../../src/utils/error-handler';

// Mock the tool classes
jest.mock('../../../src/server/tools/trigger-job');
jest.mock('../../../src/server/tools/job-status');
jest.mock('../../../src/server/tools/list-jobs');
jest.mock('../../../src/server/tools/get-job-parameters');
jest.mock('../../../src/utils/logger');

describe('MCP Error Handling Integration', () => {
  let server: Server;
  let mcpService: MCPServerService;
  let mockRequestHandler: jest.Mock;

  beforeEach(() => {
    // Mock the Server class
    mockRequestHandler = jest.fn();
    server = {
      setRequestHandler: mockRequestHandler
    } as any;

    mcpService = new MCPServerService(server);
  });

  describe('Error Handling in Message Handlers', () => {
    beforeEach(async () => {
      await mcpService.initialize();
    });

    describe('ListTools error handling', () => {
      it('should handle errors in ListTools gracefully', async () => {
        // Mock the tool registry to throw an error
        jest.spyOn(mcpService.getToolRegistry(), 'getToolSchemas').mockImplementation(() => {
          throw new Error('Registry failed');
        });

        const listToolsHandler = mockRequestHandler.mock.calls.find(
          call => call[0] === ListToolsRequestSchema
        )[1];

        const mockRequest = { params: {} };

        try {
          await listToolsHandler(mockRequest);
          fail('Expected error to be thrown');
        } catch (error: any) {
          expect(error).toBeInstanceOf(Error);
          expect(error.code).toBe(-32603);
          expect(error.message).toContain('Internal error listing tools');
          expect(error.data).toBeDefined();
        }
      });

      it('should handle AppError types in ListTools', async () => {
        // Mock the tool registry to throw an AppError
        const originalError = new MCPError('Tool registry error', 'REGISTRY_ERROR');
        jest.spyOn(mcpService.getToolRegistry(), 'getToolSchemas').mockImplementation(() => {
          throw originalError;
        });

        const listToolsHandler = mockRequestHandler.mock.calls.find(
          call => call[0] === ListToolsRequestSchema
        )[1];

        try {
          await listToolsHandler({ params: {} });
          fail('Expected error to be thrown');
        } catch (error: any) {
          expect(error.code).toBe(-32603);
          expect(error.data).toMatchObject(originalError.toJSON());
        }
      });
    });

    describe('CallTool error handling', () => {
      it('should handle unknown tool with proper MCP error format', async () => {
        jest.spyOn(mcpService.getToolRegistry(), 'getToolImplementation').mockReturnValue(undefined);
        jest.spyOn(mcpService.getToolRegistry(), 'getRegisteredToolNames').mockReturnValue([
          'tool1', 'tool2', 'tool3'
        ]);

        const callToolHandler = mockRequestHandler.mock.calls.find(
          call => call[0] === CallToolRequestSchema
        )[1];

        const mockRequest = {
          params: {
            name: 'unknown_tool',
            arguments: {}
          }
        };

        try {
          await callToolHandler(mockRequest);
          fail('Expected error to be thrown');
        } catch (error: any) {
          expect(error).toBeInstanceOf(Error);
          expect(error.code).toBe(-32601);
          expect(error.message).toContain('Unknown tool: unknown_tool');
          expect(error.data).toHaveProperty('errorType', 'MCP_ERROR');
        }
      });

      it('should handle invalid arguments with proper MCP error format', async () => {
        const callToolHandler = mockRequestHandler.mock.calls.find(
          call => call[0] === CallToolRequestSchema
        )[1];

        const mockRequest = {
          params: {
            name: 'trigger_jenkins_job',
            arguments: 'invalid-string-arguments'
          }
        };

        try {
          await callToolHandler(mockRequest);
          fail('Expected error to be thrown');
        } catch (error: any) {
          expect(error.code).toBe(-32602);
          expect(error.message).toContain('Tool arguments must be an object');
          expect(error.data).toHaveProperty('errorType', 'MCP_ERROR');
        }
      });

      it('should handle tool execution errors with comprehensive error handling', async () => {
        const jenkinsError = new JenkinsError('Jenkins API failed', 500, 'Server Error');
        const mockExecute = jest.fn().mockRejectedValue(jenkinsError);

        jest.spyOn(mcpService.getToolRegistry(), 'getToolImplementation').mockReturnValue({
          execute: mockExecute
        });

        const callToolHandler = mockRequestHandler.mock.calls.find(
          call => call[0] === CallToolRequestSchema
        )[1];

        const mockRequest = {
          params: {
            name: 'trigger_jenkins_job',
            arguments: {
              jobName: 'test-job',
              parameters: {}
            }
          }
        };

        try {
          await callToolHandler(mockRequest);
          fail('Expected error to be thrown');
        } catch (error: any) {
          expect(error.code).toBe(-32603);
          expect(error.data).toHaveProperty('errorType', 'JENKINS_ERROR');
          expect(error.data).toHaveProperty('jenkinsStatusCode', 500);
        }
      });

      it('should preserve existing MCP errors without double-wrapping', async () => {
        const existingMCPError = new Error('Existing MCP error');
        (existingMCPError as any).code = -32602;

        const mockExecute = jest.fn().mockRejectedValue(existingMCPError);

        jest.spyOn(mcpService.getToolRegistry(), 'getToolImplementation').mockReturnValue({
          execute: mockExecute
        });

        const callToolHandler = mockRequestHandler.mock.calls.find(
          call => call[0] === CallToolRequestSchema
        )[1];

        const mockRequest = {
          params: {
            name: 'trigger_jenkins_job',
            arguments: {}
          }
        };

        try {
          await callToolHandler(mockRequest);
          fail('Expected error to be thrown');
        } catch (error: any) {
          expect(error).toBe(existingMCPError); // Should be exact same error
          expect(error.code).toBe(-32602);
        }
      });

      it('should handle authentication errors properly', async () => {
        const authError = new AuthenticationError('Invalid credentials');
        const mockExecute = jest.fn().mockRejectedValue(authError);

        jest.spyOn(mcpService.getToolRegistry(), 'getToolImplementation').mockReturnValue({
          execute: mockExecute
        });

        const callToolHandler = mockRequestHandler.mock.calls.find(
          call => call[0] === CallToolRequestSchema
        )[1];

        const mockRequest = {
          params: {
            name: 'trigger_jenkins_job',
            arguments: {}
          }
        };

        try {
          await callToolHandler(mockRequest);
          fail('Expected error to be thrown');
        } catch (error: any) {
          expect(error.code).toBe(-32603);
          expect(error.data).toHaveProperty('errorType', 'AUTHENTICATION_ERROR');
          expect(error.data).toHaveProperty('statusCode', 401);
        }
      });

      it('should handle job not found errors properly', async () => {
        const jobNotFoundError = new JobNotFoundError('non-existent-job');
        const mockExecute = jest.fn().mockRejectedValue(jobNotFoundError);

        jest.spyOn(mcpService.getToolRegistry(), 'getToolImplementation').mockReturnValue({
          execute: mockExecute
        });

        const callToolHandler = mockRequestHandler.mock.calls.find(
          call => call[0] === CallToolRequestSchema
        )[1];

        const mockRequest = {
          params: {
            name: 'get_job_status',
            arguments: { jobName: 'non-existent-job', buildNumber: 1 }
          }
        };

        try {
          await callToolHandler(mockRequest);
          fail('Expected error to be thrown');
        } catch (error: any) {
          expect(error.code).toBe(-32603);
          expect(error.data).toHaveProperty('errorType', 'JOB_NOT_FOUND');
          expect(error.data).toHaveProperty('jobName', 'non-existent-job');
          expect(error.data).toHaveProperty('statusCode', 404);
        }
      });
    });

    describe('Ping error handling', () => {
      it('should handle errors in Ping gracefully', async () => {
        const pingHandler = mockRequestHandler.mock.calls.find(
          call => call[0] === PingRequestSchema
        )[1];

        const mockRequest = { params: {} };

        // Ping should normally succeed, so let's test with a successful ping
        const result = await pingHandler(mockRequest);
        expect(result).toEqual({});
      });
    });
  });

  describe('Error Creation Methods', () => {
    let testMcpService: MCPServerService;

    beforeEach(() => {
      const testServer = { setRequestHandler: jest.fn() } as any;
      testMcpService = new MCPServerService(testServer);
    });

    it('should create MCP error from AppError with proper structure', () => {
      const appError = new MCPError('Test error', 'TEST_ERROR');
      
      // Access private method using type assertion
      const mcpError = (testMcpService as any).createMCPErrorFromAppError(-32603, appError);
      
      expect(mcpError).toBeInstanceOf(Error);
      expect(mcpError.message).toBe('Test error');
      expect((mcpError as any).code).toBe(-32603);
      expect((mcpError as any).data).toMatchObject(appError.toJSON());
    });

    it('should create backward compatible MCP error', () => {
      const originalError = new Error('Original error');
      
      // Access private method using type assertion
      const mcpError = (testMcpService as any).createMCPError(-32603, 'Test message', originalError);
      
      expect(mcpError).toBeInstanceOf(Error);
      expect(mcpError.message).toBe('Test message');
      expect((mcpError as any).code).toBe(-32603);
      expect((mcpError as any).data).toHaveProperty('type', 'Error');
      expect((mcpError as any).data).toHaveProperty('message', 'Original error');
    });

    it('should detect MCP errors properly', () => {
      const mcpError = new Error('MCP error');
      (mcpError as any).code = -32601;
      
      const regularError = new Error('Regular error');
      
      // Access private method using type assertion
      expect((testMcpService as any).isMCPError(mcpError)).toBe(true);
      expect((testMcpService as any).isMCPError(regularError)).toBe(false);
    });
  });
});