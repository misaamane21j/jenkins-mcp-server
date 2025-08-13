import { MCPToolSchema } from '../types/mcp';

/**
 * Schema for trigger_jenkins_job tool
 */
export const triggerJenkinsJobSchema: MCPToolSchema = {
  name: 'trigger_jenkins_job',
  description: 'Trigger a Jenkins job with parameters and optional callback information for notifications',
  inputSchema: {
    type: 'object',
    properties: {
      jobName: { 
        type: 'string', 
        description: 'Name of the Jenkins job to trigger' 
      },
      parameters: { 
        type: 'object', 
        description: 'Job parameters as key-value pairs',
        additionalProperties: true
      },
      callbackInfo: {
        type: 'object',
        description: 'Callback information for Slack notifications when job completes',
        properties: {
          slackChannel: { 
            type: 'string',
            description: 'Slack channel ID or name for notifications'
          },
          slackThreadTs: { 
            type: 'string',
            description: 'Slack thread timestamp for threaded responses'
          },
          slackUserId: { 
            type: 'string',
            description: 'Slack user ID to mention in notifications'
          },
        },
        required: ['slackChannel', 'slackThreadTs', 'slackUserId'],
      },
    },
    required: ['jobName', 'parameters', 'callbackInfo'],
  },
};

/**
 * Schema for get_job_status tool
 */
export const getJobStatusSchema: MCPToolSchema = {
  name: 'get_job_status',
  description: 'Get the status and details of a Jenkins job build',
  inputSchema: {
    type: 'object',
    properties: {
      jobName: { 
        type: 'string', 
        description: 'Name of the Jenkins job' 
      },
      buildNumber: { 
        type: 'number', 
        description: 'Build number to get status for' 
      },
    },
    required: ['jobName', 'buildNumber'],
  },
};

/**
 * Schema for list_jenkins_jobs tool
 */
export const listJenkinsJobsSchema: MCPToolSchema = {
  name: 'list_jenkins_jobs',
  description: 'List available Jenkins jobs with optional filtering',
  inputSchema: {
    type: 'object',
    properties: {
      filter: { 
        type: 'string', 
        description: 'Optional filter pattern for job names (supports wildcards)' 
      },
      includeDisabled: { 
        type: 'boolean', 
        description: 'Whether to include disabled jobs in the results (default: false)' 
      },
    },
    additionalProperties: false,
  },
};

/**
 * Schema for get_job_parameters tool
 */
export const getJobParametersSchema: MCPToolSchema = {
  name: 'get_job_parameters',
  description: 'Get the parameter definitions and schema for a Jenkins job',
  inputSchema: {
    type: 'object',
    properties: {
      jobName: { 
        type: 'string', 
        description: 'Name of the Jenkins job to get parameters for' 
      },
    },
    required: ['jobName'],
  },
};

/**
 * Collection of all tool schemas
 */
export const toolSchemas = {
  trigger_jenkins_job: triggerJenkinsJobSchema,
  get_job_status: getJobStatusSchema,
  list_jenkins_jobs: listJenkinsJobsSchema,
  get_job_parameters: getJobParametersSchema,
} as const;

/**
 * Array of all tool schemas for easy iteration
 */
export const allToolSchemas: MCPToolSchema[] = Object.values(toolSchemas);