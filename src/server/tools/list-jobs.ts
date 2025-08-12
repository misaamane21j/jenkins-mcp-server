import { JenkinsClientService } from '../../services/jenkins-client';
import { logger } from '../../utils/logger';
import { validateInput, listJobsSchema, ListJobsInput } from '../../utils/validation';

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
      throw error;
    }
  }
}