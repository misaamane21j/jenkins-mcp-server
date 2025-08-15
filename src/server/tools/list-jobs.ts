import { JenkinsClientService } from '../../services/jenkins-client';
import { logger } from '../../utils/logger';
import { validateInput, listJobsSchema, ListJobsInput } from '../../utils/validation';
import { handleError, formatMCPError } from '../../utils/error-handler';

export class ListJobsTool {
  private jenkinsClient: JenkinsClientService;

  constructor() {
    this.jenkinsClient = new JenkinsClientService();
  }

  async execute(args: any): Promise<any> {
    try {
      const { filter, includeDisabled = false } = validateInput<ListJobsInput>(listJobsSchema, args);

      logger.info('Listing Jenkins jobs', { filter, includeDisabled });

      const jobs = await this.jenkinsClient.listJobs(filter, includeDisabled);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(jobs),
          },
        ],
      };
    } catch (error) {
      logger.error('Failed to list jobs:', error);
      
      // Use comprehensive error handling
      const handledError = handleError(error, 'list Jenkins jobs');
      
      // Format as MCP error response for consistency
      const mcpErrorResponse = formatMCPError(handledError);
      
      // Return error in MCP format instead of throwing to allow client to handle gracefully
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              error: true,
              message: handledError.message,
              errorType: handledError instanceof Error ? handledError.constructor.name : 'UnknownError',
              details: mcpErrorResponse.error.details
            })
          }
        ]
      };
    }
  }
}