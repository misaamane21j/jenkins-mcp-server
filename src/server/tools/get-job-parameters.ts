import { JenkinsClientService } from '../../services/jenkins-client';
import { logger } from '../../utils/logger';
import { validateInput, jobParametersSchema, JobParametersInput } from '../../utils/validation';
import { handleError, formatMCPError } from '../../utils/error-handler';

export class GetJobParametersTool {
  private jenkinsClient: JenkinsClientService;

  constructor() {
    this.jenkinsClient = new JenkinsClientService();
  }

  async execute(args: any): Promise<any> {
    try {
      const { jobName } = validateInput<JobParametersInput>(jobParametersSchema, args);

      logger.info(`Getting parameters for Jenkins job: ${jobName}`);

      const parameters = await this.jenkinsClient.getJobParameters(jobName);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              jobName,
              parameters,
            }),
          },
        ],
      };
    } catch (error) {
      logger.error('Failed to get job parameters:', error);
      
      // Use comprehensive error handling
      const handledError = handleError(error, 'get job parameters');
      
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