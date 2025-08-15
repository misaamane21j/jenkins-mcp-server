import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { 
  ListToolsRequestSchema, 
  CallToolRequestSchema,
  InitializeRequestSchema,
  PingRequestSchema,
  NotificationSchema
} from '@modelcontextprotocol/sdk/types.js';
import { logger } from '../utils/logger';
import { handleError, formatMCPError, MCPError, AppError } from '../utils/error-handler';
import { MCPToolRegistry } from './tool-registry';
import { allToolSchemas } from './tool-schemas';
import { TriggerJobTool } from './tools/trigger-job';
import { JobStatusTool } from './tools/job-status';
import { ListJobsTool } from './tools/list-jobs';
import { GetJobParametersTool } from './tools/get-job-parameters';

export class MCPServerService {
  private toolRegistry: MCPToolRegistry;
  private triggerJobTool: TriggerJobTool;
  private jobStatusTool: JobStatusTool;
  private listJobsTool: ListJobsTool;
  private getJobParametersTool: GetJobParametersTool;
  private isInitialized = false;

  constructor(private server: Server) {
    this.toolRegistry = new MCPToolRegistry();
    this.triggerJobTool = new TriggerJobTool();
    this.jobStatusTool = new JobStatusTool();
    this.listJobsTool = new ListJobsTool();
    this.getJobParametersTool = new GetJobParametersTool();
  }

  /**
   * Register all available tools in the tool registry
   */
  private registerAllTools(): void {
    try {
      // Register all tools with their schemas and implementations
      this.toolRegistry.registerTool(
        'trigger_jenkins_job',
        allToolSchemas.find(schema => schema.name === 'trigger_jenkins_job')!,
        this.triggerJobTool
      );

      this.toolRegistry.registerTool(
        'get_job_status',
        allToolSchemas.find(schema => schema.name === 'get_job_status')!,
        this.jobStatusTool
      );

      this.toolRegistry.registerTool(
        'list_jenkins_jobs',
        allToolSchemas.find(schema => schema.name === 'list_jenkins_jobs')!,
        this.listJobsTool
      );

      this.toolRegistry.registerTool(
        'get_job_parameters',
        allToolSchemas.find(schema => schema.name === 'get_job_parameters')!,
        this.getJobParametersTool
      );

      const stats = this.toolRegistry.getStats();
      logger.info(`Successfully registered ${stats.totalTools} MCP tools: ${stats.toolNames.join(', ')}`);
    } catch (error) {
      logger.error('Failed to register MCP tools:', error);
      throw error;
    }
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) {
      logger.warn('MCP server is already initialized');
      return;
    }

    try {
      // Register all tools in the registry
      this.registerAllTools();

      // Set up comprehensive MCP protocol message handlers
      this.setupMessageHandlers();

      this.isInitialized = true;
      logger.info('MCP server protocol message handlers initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize MCP server:', error);
      throw error;
    }
  }

  /**
   * Set up comprehensive MCP protocol message handlers
   */
  private setupMessageHandlers(): void {
    // Handle ListTools requests
    this.server.setRequestHandler(ListToolsRequestSchema, async (request) => {
      try {
        logger.debug('Handling ListTools request');
        
        const tools = this.toolRegistry.getToolSchemas();
        logger.debug(`Returning ${tools.length} tools`, { toolNames: tools.map(t => t.name) });
        
        return {
          tools
        };
      } catch (error) {
        logger.error('Error handling ListTools request:', error);
        const handledError = handleError(error, 'ListTools request handler');
        throw this.createMCPError(-32603, 'Internal error listing tools', handledError);
      }
    });

    // Handle CallTool requests with comprehensive validation and error handling
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        logger.debug('Handling CallTool request', { 
          toolName: name, 
          hasArgs: !!args 
        });

        // Validate tool exists in registry
        const implementation = this.toolRegistry.getToolImplementation(name);
        
        if (!implementation) {
          const registeredTools = this.toolRegistry.getRegisteredToolNames();
          const errorMsg = `Unknown tool: ${name}. Available tools: ${registeredTools.join(', ')}`;
          logger.warn(errorMsg, { requestedTool: name, availableTools: registeredTools });
          const mcpError = new MCPError(errorMsg, 'TOOL_NOT_FOUND');
          throw this.createMCPErrorFromAppError(-32601, mcpError);
        }

        // Validate arguments if provided
        if (args && typeof args !== 'object') {
          const errorMsg = 'Tool arguments must be an object';
          logger.warn(errorMsg, { toolName: name, argsType: typeof args });
          const mcpError = new MCPError(errorMsg, 'INVALID_ARGUMENTS');
          throw this.createMCPErrorFromAppError(-32602, mcpError);
        }

        // Execute tool with request tracking
        logger.info(`Executing tool: ${name}`, { toolName: name });
        const startTime = Date.now();
        
        const result = await implementation.execute(args || {});
        
        const executionTime = Date.now() - startTime;
        logger.info(`Tool execution completed: ${name}`, { 
          toolName: name, 
          executionTimeMs: executionTime,
          success: true
        });

        return result;
      } catch (error) {
        const executionTime = Date.now();
        logger.error(`Error executing tool ${name}:`, { 
          toolName: name, 
          error: error instanceof Error ? error.message : String(error),
          executionTimeMs: executionTime
        });

        // Handle the error using our comprehensive error handler
        const handledError = handleError(error, `tool execution for '${name}'`);
        
        // Re-throw MCP errors with proper codes, wrap others
        if (this.isMCPError(error)) {
          throw error;
        }
        
        throw this.createMCPErrorFromAppError(-32603, handledError);
      }
    });

    // Handle Ping requests for connection health monitoring
    this.server.setRequestHandler(PingRequestSchema, async (request) => {
      try {
        logger.debug('Handling Ping request');
        return {}; // Empty response indicates successful ping
      } catch (error) {
        logger.error('Error handling Ping request:', error);
        const handledError = handleError(error, 'Ping request handler');
        throw this.createMCPError(-32603, 'Internal error handling ping', handledError);
      }
    });

    // Set up notification handlers if needed (currently none required for our tools)
    this.setupNotificationHandlers();

    logger.info('MCP protocol message handlers configured successfully');
  }

  /**
   * Set up notification handlers for the MCP server
   */
  private setupNotificationHandlers(): void {
    // Handle notifications (if any specific notifications are needed for Jenkins tools)
    // For now, we don't need specific notification handlers for Jenkins operations
    // This method is here for future extension
    logger.debug('Notification handlers configured (none required for current tools)');
  }

  /**
   * Create a standardized MCP error response from an AppError
   */
  private createMCPErrorFromAppError(code: number, appError: AppError): Error {
    const error = new Error(appError.message);
    (error as any).code = code;
    (error as any).data = appError.toJSON();
    return error;
  }

  /**
   * Create a standardized MCP error response (backward compatibility)
   */
  private createMCPError(code: number, message: string, originalError?: any): Error {
    const error = new Error(message);
    (error as any).code = code;
    
    // Use our error handler to get better error formatting
    if (originalError && originalError instanceof AppError) {
      (error as any).data = originalError.toJSON();
    } else if (originalError instanceof Error) {
      (error as any).data = {
        type: originalError.constructor.name,
        message: originalError.message,
        stack: originalError.stack
      };
    } else {
      (error as any).data = originalError;
    }
    
    return error;
  }

  /**
   * Check if an error is already an MCP error
   */
  private isMCPError(error: any): boolean {
    return error && typeof error.code === 'number';
  }

  async stop(): Promise<void> {
    if (!this.isInitialized) {
      logger.warn('MCP server is not initialized');
      return;
    }

    try {
      // Clear all registered tools
      this.toolRegistry.clear();
      this.isInitialized = false;
      logger.info('MCP server stopped');
    } catch (error) {
      logger.error('Error stopping MCP server:', error);
      throw error;
    }
  }

  get initialized(): boolean {
    return this.isInitialized;
  }

  /**
   * Get access to the tool registry for external management
   */
  getToolRegistry(): MCPToolRegistry {
    return this.toolRegistry;
  }
}