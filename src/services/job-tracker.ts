import { createClient, RedisClientType } from 'redis';
import { config } from '../config/environment';
import { logger } from '../utils/logger';
import { JobTrackingInfo } from '../types/jenkins';

export class JobTrackerService {
  private client: RedisClientType;
  private isConnected: boolean = false;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 5;

  constructor() {
    this.client = createClient({ 
      url: config.redis.url,
      socket: {
        reconnectStrategy: (retries) => {
          if (retries > this.maxReconnectAttempts) {
            logger.error('Max Redis reconnect attempts reached');
            return false;
          }
          return Math.min(retries * 100, 3000);
        }
      }
    });
    
    this.client.on('error', (err: Error) => {
      logger.error('Redis error:', err);
      this.isConnected = false;
    });
    
    this.client.on('connect', () => {
      logger.info('Redis client connected');
      this.isConnected = true;
      this.reconnectAttempts = 0;
    });
    
    this.client.on('disconnect', () => {
      logger.warn('Redis client disconnected');
      this.isConnected = false;
    });
  }

  async initialize(): Promise<void> {
    try {
      if (!this.isConnected) {
        await this.client.connect();
      }
      logger.info('Job tracker service initialized');
    } catch (error) {
      logger.error('Failed to initialize job tracker service:', error);
      throw error;
    }
  }

  private async ensureConnection(): Promise<void> {
    if (!this.isConnected) {
      throw new Error('Redis client not connected');
    }
  }

  async trackJob(jobInfo: JobTrackingInfo): Promise<void> {
    try {
      await this.ensureConnection();
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
      await this.ensureConnection();
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
      await this.ensureConnection();
      const jobInfo = await this.getJobInfo(jobName, buildNumber);
      if (jobInfo) {
        jobInfo.status = status;
        jobInfo.details = details;
        jobInfo.timestamp = Date.now();
        await this.trackJob(jobInfo);
        logger.info(`Updated job status: ${jobName}#${buildNumber} -> ${status}`);
      } else {
        logger.warn(`Job info not found for update: ${jobName}#${buildNumber}`);
      }
    } catch (error) {
      logger.error('Failed to update job status:', error);
      throw error;
    }
  }

  async cleanupCompletedJob(jobName: string, buildNumber: number): Promise<void> {
    try {
      await this.ensureConnection();
      const key = `job:${jobName}:${buildNumber}`;
      await this.client.del(key);
      logger.info(`Cleaned up job tracking: ${key}`);
    } catch (error) {
      logger.error('Failed to cleanup job tracking:', error);
    }
  }

  async cleanupExpiredJobs(): Promise<void> {
    try {
      await this.ensureConnection();
      const pattern = 'job:*';
      const keys = await this.client.keys(pattern);
      let cleanedCount = 0;
      
      for (const key of keys) {
        const ttl = await this.client.ttl(key);
        if (ttl === -1) { // Key has no expiration set
          await this.client.expire(key, 3600); // Set 1 hour expiration
        } else if (ttl === -2) { // Key doesn't exist (expired)
          cleanedCount++;
        }
      }
      
      if (cleanedCount > 0) {
        logger.info(`Cleaned up ${cleanedCount} expired job tracking entries`);
      }
    } catch (error) {
      logger.error('Failed to cleanup expired jobs:', error);
    }
  }

  async disconnect(): Promise<void> {
    try {
      if (this.isConnected) {
        await this.client.disconnect();
        this.isConnected = false;
        logger.info('Redis client disconnected');
      }
    } catch (error) {
      logger.error('Error disconnecting Redis client:', error);
    }
  }
}