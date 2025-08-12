import { JenkinsClientService } from '../../services/jenkins-client';
import { JobTrackerService } from '../../services/job-tracker';
import { logger } from '../../utils/logger';
import { validateInput, triggerJobSchema, TriggerJobInput } from '../../utils/validation';

export class TriggerJobTool {
  private jenkinsClient: JenkinsClientService;
  private jobTracker: JobTrackerService;

  constructor() {
    this.jenkinsClient = new JenkinsClientService();
    this.jobTracker = new JobTrackerService();
  }

  async execute(args: any): Promise<any> {
    try {
      const { jobName, parameters, callbackInfo } = validateInput<TriggerJobInput>(triggerJobSchema, args);

      logger.info(`Triggering Jenkins job: ${jobName}`, { parameters });

      const buildResult = await this.jenkinsClient.triggerJob(jobName, parameters || {});
      
      if (callbackInfo) {
        await this.jobTracker.trackJob({
          jobName,
          buildNumber: buildResult.buildNumber,
          callbackInfo,
          status: 'PENDING',
          timestamp: Date.now(),
        });
      }

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              buildNumber: buildResult.buildNumber,
              jobName,
              status: 'TRIGGERED',
              queueId: buildResult.queueId,
            }),
          },
        ],
      };
    } catch (error) {
      logger.error('Failed to trigger Jenkins job:', error);
      throw error;
    }
  }
}