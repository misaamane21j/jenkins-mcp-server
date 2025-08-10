import { createClient } from 'redis';
import { config } from '../config/environment';
import { logger } from '../utils/logger';
import { JobTrackingInfo } from '../types/jenkins';

export class JobTrackerService {
  private client: any;

  constructor() {
    this.client = createClient({ url: config.redis.url });
    this.client.on('error', (err: Error) => logger.error('Redis error:', err));
  }

  async initialize(): Promise<void> {
    await this.client.connect();
    logger.info('Job tracker service initialized');
  }

  async trackJob(jobInfo: JobTrackingInfo): Promise<void> {
    try {
      const key = `job:${jobInfo.jobName}:${jobInfo.buildNumber}`;
      await this.client.setEx(key, 3600, JSON.stringify(jobInfo)); // 1 hour TTL
      logger.info(`Tracking job: ${key}`);
    } catch (error) {
      logger.error('Failed to track job:', error);
      throw error;
    }
  }

  async getJobInfo(jobName: string, buildNumber: number): Promise<JobTrackingInfo | null> {
    try {
      const key = `job:${jobName}:${buildNumber}`;
      const data = await this.client.get(key);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      logger.error('Failed to get job info:', error);
      return null;
    }
  }

  async updateJobStatus(
    jobName: string,
    buildNumber: number,
    status: string,
    details?: any
  ): Promise<void> {
    try {
      const jobInfo = await this.getJobInfo(jobName, buildNumber);
      if (jobInfo) {
        jobInfo.status = status;
        jobInfo.details = details;
        await this.trackJob(jobInfo);
      }
    } catch (error) {
      logger.error('Failed to update job status:', error);
    }
  }

  async cleanupCompletedJob(jobName: string, buildNumber: number): Promise<void> {
    try {
      const key = `job:${jobName}:${buildNumber}`;
      await this.client.del(key);
      logger.info(`Cleaned up job tracking: ${key}`);
    } catch (error) {
      logger.error('Failed to cleanup job tracking:', error);
    }
  }

  async disconnect(): Promise<void> {
    await this.client.disconnect();
  }
}