import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { ListToolsRequestSchema, CallToolRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { logger } from '../utils/logger';
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

      // Set up ListTools request handler using the registry
      this.server.setRequestHandler(ListToolsRequestSchema, async () => {
        return {
          tools: this.toolRegistry.getToolSchemas()
        };
      });

      // Set up CallTool request handler using the registry
      this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
        const { name, arguments: args } = request.params;

        try {
          // Get tool implementation from registry
          const implementation = this.toolRegistry.getToolImplementation(name);
          
          if (!implementation) {
            const registeredTools = this.toolRegistry.getRegisteredToolNames();
            throw new Error(`Unknown tool: ${name}. Available tools: ${registeredTools.join(', ')}`);
          }

          logger.debug(`Executing tool: ${name}`, { args });
          return await implementation.execute(args);
        } catch (error) {
          logger.error(`Error executing tool ${name}:`, error);
          throw error;
        }
      });

      this.isInitialized = true;
      logger.info('MCP server tools initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize MCP server:', error);
      throw error;
    }
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