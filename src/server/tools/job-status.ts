import { JenkinsClientService } from '../../services/jenkins-client';
import { logger } from '../../utils/logger';
import { validateInput, jobStatusSchema, JobStatusInput } from '../../utils/validation';

export class JobStatusTool {
  private jenkinsClient: JenkinsClientService;

  constructor() {
    this.jenkinsClient = new JenkinsClientService();
  }

  async execute(args: any): Promise<any> {
    try {
      const { jobName, buildNumber } = validateInput<JobStatusInput>(jobStatusSchema, args);

      logger.info(`Getting status for Jenkins job: ${jobName} #${buildNumber}`);

      if (buildNumber === undefined) {
        throw new Error('Build number is required');
      }
      const status = await this.jenkinsClient.getBuildStatus(jobName, buildNumber);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(status),
          },
        ],
      };
    } catch (error) {
      logger.error('Failed to get job status:', error);
      throw error;
    }
  }
}