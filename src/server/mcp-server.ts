import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { ListToolsRequestSchema, CallToolRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { logger } from '../utils/logger';
import { TriggerJobTool } from './tools/trigger-job';
import { JobStatusTool } from './tools/job-status';
import { ListJobsTool } from './tools/list-jobs';
import { GetJobParametersTool } from './tools/get-job-parameters';

export class MCPServerService {
  private triggerJobTool: TriggerJobTool;
  private jobStatusTool: JobStatusTool;
  private listJobsTool: ListJobsTool;
  private getJobParametersTool: GetJobParametersTool;

  constructor(private server: Server) {
    this.triggerJobTool = new TriggerJobTool();
    this.jobStatusTool = new JobStatusTool();
    this.listJobsTool = new ListJobsTool();
    this.getJobParametersTool = new GetJobParametersTool();
  }

  async initialize(): Promise<void> {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: 'trigger_jenkins_job',
            description: 'Trigger a Jenkins job with parameters',
            inputSchema: {
              type: 'object',
              properties: {
                jobName: { type: 'string', description: 'Name of the Jenkins job' },
                parameters: { type: 'object', description: 'Job parameters' },
                callbackInfo: {
                  type: 'object',
                  properties: {
                    slackChannel: { type: 'string' },
                    slackThreadTs: { type: 'string' },
                    slackUserId: { type: 'string' },
                  },
                  required: ['slackChannel', 'slackThreadTs', 'slackUserId'],
                },
              },
              required: ['jobName', 'parameters', 'callbackInfo'],
            },
          },
          {
            name: 'get_job_status',
            description: 'Get the status of a Jenkins job build',
            inputSchema: {
              type: 'object',
              properties: {
                jobName: { type: 'string', description: 'Name of the Jenkins job' },
                buildNumber: { type: 'number', description: 'Build number' },
              },
              required: ['jobName', 'buildNumber'],
            },
          },
          {
            name: 'list_jenkins_jobs',
            description: 'List available Jenkins jobs',
            inputSchema: {
              type: 'object',
              properties: {
                filter: { type: 'string', description: 'Filter jobs by name' },
                includeDisabled: { type: 'boolean', description: 'Include disabled jobs' },
              },
            },
          },
          {
            name: 'get_job_parameters',
            description: 'Get parameter definitions for a Jenkins job',
            inputSchema: {
              type: 'object',
              properties: {
                jobName: { type: 'string', description: 'Name of the Jenkins job' },
              },
              required: ['jobName'],
            },
          },
        ],
      };
    });

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      switch (name) {
        case 'trigger_jenkins_job':
          return await this.triggerJobTool.execute(args);
        case 'get_job_status':
          return await this.jobStatusTool.execute(args);
        case 'list_jenkins_jobs':
          return await this.listJobsTool.execute(args);
        case 'get_job_parameters':
          return await this.getJobParametersTool.execute(args);
        default:
          throw new Error(`Unknown tool: ${name}`);
      }
    });

    logger.info('MCP server tools initialized');
  }
}