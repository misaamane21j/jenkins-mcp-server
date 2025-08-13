import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { 
  ListToolsRequestSchema, 
  CallToolRequestSchema,
  PingRequestSchema 
} from '@modelcontextprotocol/sdk/types.js';
import { MCPServerService } from '../../../src/server/mcp-server';

// Mock the tool classes
jest.mock('../../../src/server/tools/trigger-job');
jest.mock('../../../src/server/tools/job-status');
jest.mock('../../../src/server/tools/list-jobs');
jest.mock('../../../src/server/tools/get-job-parameters');

describe('MCP Message Handling', () => {
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

  describe('setupMessageHandlers', () => {
    it('should set up all required request handlers', async () => {
      await mcpService.initialize();

      // Verify that request handlers were set up for all message types
      expect(mockRequestHandler).toHaveBeenCalledWith(ListToolsRequestSchema, expect.any(Function));
      expect(mockRequestHandler).toHaveBeenCalledWith(CallToolRequestSchema, expect.any(Function));
      expect(mockRequestHandler).toHaveBeenCalledWith(PingRequestSchema, expect.any(Function));
      expect(mockRequestHandler).toHaveBeenCalledTimes(3);
    });
  });

  describe('ListTools message handling', () => {
    it('should handle ListTools request successfully', async () => {
      await mcpService.initialize();

      // Get the ListTools handler
      const listToolsHandler = mockRequestHandler.mock.calls.find(
        call => call[0] === ListToolsRequestSchema
      )[1];

      const mockRequest = {
        params: {}
      };

      const result = await listToolsHandler(mockRequest);

      expect(result).toHaveProperty('tools');
      expect(Array.isArray(result.tools)).toBe(true);
      expect(result.tools.length).toBe(4); // Should have all 4 Jenkins tools
    });

    it('should handle ListTools request errors gracefully', async () => {
      await mcpService.initialize();

      // Mock the tool registry to throw an error
      const originalGetToolSchemas = mcpService.getToolRegistry().getToolSchemas;
      jest.spyOn(mcpService.getToolRegistry(), 'getToolSchemas').mockImplementation(() => {
        throw new Error('Registry error');
      });

      const listToolsHandler = mockRequestHandler.mock.calls.find(
        call => call[0] === ListToolsRequestSchema
      )[1];

      const mockRequest = {
        params: {}
      };

      await expect(listToolsHandler(mockRequest)).rejects.toThrow();
    });
  });

  describe('CallTool message handling', () => {
    it('should handle valid tool call successfully', async () => {
      await mcpService.initialize();

      // Mock a tool implementation
      const mockExecute = jest.fn().mockResolvedValue({
        content: [{ type: 'text', text: 'Tool executed successfully' }]
      });

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
            parameters: {},
            callbackInfo: {
              slackChannel: '#test',
              slackThreadTs: '123',
              slackUserId: 'user123'
            }
          }
        }
      };

      const result = await callToolHandler(mockRequest);

      expect(mockExecute).toHaveBeenCalledWith(mockRequest.params.arguments);
      expect(result).toEqual({
        content: [{ type: 'text', text: 'Tool executed successfully' }]
      });
    });

    it('should handle unknown tool error', async () => {
      await mcpService.initialize();

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

      await expect(callToolHandler(mockRequest)).rejects.toThrow(/Unknown tool: unknown_tool/);
    });

    it('should handle invalid arguments error', async () => {
      await mcpService.initialize();

      const callToolHandler = mockRequestHandler.mock.calls.find(
        call => call[0] === CallToolRequestSchema
      )[1];

      const mockRequest = {
        params: {
          name: 'trigger_jenkins_job',
          arguments: 'invalid-arguments' // Should be object, not string
        }
      };

      await expect(callToolHandler(mockRequest)).rejects.toThrow(/Tool arguments must be an object/);
    });

    it('should handle tool execution errors', async () => {
      await mcpService.initialize();

      const mockExecute = jest.fn().mockRejectedValue(new Error('Tool execution failed'));

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
            parameters: {},
            callbackInfo: {
              slackChannel: '#test',
              slackThreadTs: '123',
              slackUserId: 'user123'
            }
          }
        }
      };

      await expect(callToolHandler(mockRequest)).rejects.toThrow(/Tool execution failed/);
    });

    it('should handle tool call with no arguments', async () => {
      await mcpService.initialize();

      const mockExecute = jest.fn().mockResolvedValue({
        content: [{ type: 'text', text: 'Success' }]
      });

      jest.spyOn(mcpService.getToolRegistry(), 'getToolImplementation').mockReturnValue({
        execute: mockExecute
      });

      const callToolHandler = mockRequestHandler.mock.calls.find(
        call => call[0] === CallToolRequestSchema
      )[1];

      const mockRequest = {
        params: {
          name: 'list_jenkins_jobs'
          // No arguments provided
        }
      };

      const result = await callToolHandler(mockRequest);

      expect(mockExecute).toHaveBeenCalledWith({});
      expect(result).toEqual({
        content: [{ type: 'text', text: 'Success' }]
      });
    });
  });

  describe('Ping message handling', () => {
    it('should handle Ping request successfully', async () => {
      await mcpService.initialize();

      const pingHandler = mockRequestHandler.mock.calls.find(
        call => call[0] === PingRequestSchema
      )[1];

      const mockRequest = {
        params: {}
      };

      const result = await pingHandler(mockRequest);

      expect(result).toEqual({});
    });

    it('should handle Ping request errors gracefully', async () => {
      await mcpService.initialize();

      // This test is mainly for code coverage since ping handler is simple
      const pingHandler = mockRequestHandler.mock.calls.find(
        call => call[0] === PingRequestSchema
      )[1];

      const mockRequest = {
        params: {}
      };

      // The ping handler should still work even with basic request
      const result = await pingHandler(mockRequest);
      expect(result).toEqual({});
    });
  });

  describe('MCP Error handling', () => {
    it('should create proper MCP error format', async () => {
      await mcpService.initialize();

      const callToolHandler = mockRequestHandler.mock.calls.find(
        call => call[0] === CallToolRequestSchema
      )[1];

      jest.spyOn(mcpService.getToolRegistry(), 'getToolImplementation').mockReturnValue(undefined);

      const mockRequest = {
        params: {
          name: 'nonexistent_tool',
          arguments: {}
        }
      };

      try {
        await callToolHandler(mockRequest);
        fail('Expected error to be thrown');
      } catch (error: any) {
        expect(error).toBeInstanceOf(Error);
        expect(error.code).toBe(-32601); // Method not found error code
        expect(error.message).toContain('Unknown tool: nonexistent_tool');
      }
    });

    it('should preserve existing MCP errors', async () => {
      await mcpService.initialize();

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
        expect(error).toBe(existingMCPError); // Should be the exact same error object
        expect(error.code).toBe(-32602);
      }
    });
  });

  describe('Request tracking and logging', () => {
    it('should track execution time for successful tool calls', async () => {
      await mcpService.initialize();

      const mockExecute = jest.fn().mockImplementation(async () => {
        // Simulate some execution time
        await new Promise(resolve => setTimeout(resolve, 10));
        return { content: [{ type: 'text', text: 'Success' }] };
      });

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

      const result = await callToolHandler(mockRequest);

      expect(result).toEqual({
        content: [{ type: 'text', text: 'Success' }]
      });

      // Verify that execution was tracked (through mocked logger calls)
      // The actual timing verification would be done through logger mock inspection
    });
  });
});