import { Request, Response } from 'express';
import axios from 'axios';
import { config } from '../config/environment';
import { logger } from '../utils/logger';
import { JobTrackerService } from './job-tracker';
import { JenkinsWebhookPayload } from '../types/webhook';

export class WebhookHandlerService {
  private jobTracker: JobTrackerService;

  constructor() {
    this.jobTracker = new JobTrackerService();
  }

  async handleJenkinsWebhook(req: Request, res: Response): Promise<void> {
    try {
      const payload: JenkinsWebhookPayload = req.body;
      
      if (!this.validateWebhook(req)) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      logger.info('Received Jenkins webhook:', payload);

      const { name: jobName, number: buildNumber, status, duration } = payload;
      
      const jobInfo = await this.jobTracker.getJobInfo(jobName, buildNumber);
      if (!jobInfo) {
        logger.warn(`No tracking info found for job: ${jobName} #${buildNumber}`);
        res.status(200).json({ message: 'No tracking info found' });
        return;
      }

      await this.jobTracker.updateJobStatus(jobName, buildNumber, status, {
        duration,
        timestamp: Date.now(),
      });

      await this.notifySlackAgent(jobInfo, status, { duration });

      if (status === 'SUCCESS' || status === 'FAILURE' || status === 'ABORTED') {
        await this.jobTracker.cleanupCompletedJob(jobName, buildNumber);
      }

      res.status(200).json({ message: 'Webhook processed successfully' });
    } catch (error) {
      logger.error('Failed to handle Jenkins webhook:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  private validateWebhook(req: Request): boolean {
    // Implement webhook signature validation based on your Jenkins setup
    const signature = req.headers['x-jenkins-signature'] as string;
    return true; // Placeholder - implement actual validation
  }

  private async notifySlackAgent(
    jobInfo: any,
    status: string,
    details: any
  ): Promise<void> {
    try {
      await axios.post(config.slack.webhookUrl, {
        channel: jobInfo.callbackInfo.slackChannel,
        threadTs: jobInfo.callbackInfo.slackThreadTs,
        userId: jobInfo.callbackInfo.slackUserId,
        jobName: jobInfo.jobName,
        buildNumber: jobInfo.buildNumber,
        status,
        details,
      });
    } catch (error) {
      logger.error('Failed to notify Slack agent:', error);
    }
  }
}