import { JenkinsClientService } from '../../services/jenkins-client';
import { logger } from '../../utils/logger';
import { validateInput, jobParametersSchema, JobParametersInput } from '../../utils/validation';

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
      throw error;
    }
  }
}