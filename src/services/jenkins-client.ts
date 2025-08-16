const jenkins = require('jenkins');
import { jenkinsConfig } from '../config/jenkins';
import { logger } from '../utils/logger';
import { JenkinsBuildResult, JenkinsJobInfo, JenkinsJobStatus } from '../types/jenkins';

export class JenkinsClientService {
  private client: any;

  constructor() {
    this.client = jenkins(jenkinsConfig);
  }

  async triggerJob(jobName: string, parameters: Record<string, any>): Promise<JenkinsBuildResult> {
    try {
      const queueId = await this.client.job.build({
        name: jobName,
        parameters,
      });

      const buildNumber = await this.waitForBuildNumber(queueId);

      return {
        buildNumber,
        queueId,
        jobName,
        status: 'TRIGGERED',
      };
    } catch (error) {
      logger.error(`Failed to trigger job ${jobName}:`, error);
      throw error;
    }
  }

  async getBuildStatus(jobName: string, buildNumber: number): Promise<JenkinsJobStatus> {
    try {
      const build = await this.client.build.get(jobName, buildNumber);
      
      return {
        jobName,
        buildNumber,
        status: build.result || (build.building ? 'RUNNING' : 'PENDING'),
        duration: build.duration,
        timestamp: build.timestamp,
        url: build.url,
      };
    } catch (error) {
      logger.error(`Failed to get build status for ${jobName} #${buildNumber}:`, error);
      throw error;
    }
  }

  async listJobs(filter?: string, includeDisabled: boolean = false): Promise<JenkinsJobInfo[]> {
    try {
      const jobs = await this.client.job.list();
      
      let filteredJobs = jobs;
      
      if (!includeDisabled) {
        filteredJobs = jobs.filter((job: any) => job.color !== 'disabled');
      }
      
      if (filter) {
        filteredJobs = filteredJobs.filter((job: any) => 
          job.name.toLowerCase().includes(filter.toLowerCase())
        );
      }
      
      return filteredJobs.map((job: any) => ({
        name: job.name,
        url: job.url,
        color: job.color,
        buildable: job.buildable,
      }));
    } catch (error) {
      logger.error('Failed to list jobs:', error);
      throw error;
    }
  }

  async getJobParameters(jobName: string): Promise<any[]> {
    try {
      const jobConfig = await this.client.job.config(jobName);
      
      // Parse XML config to extract parameter definitions
      const parameterDefinitions = this.parseJobParameters(jobConfig);
      
      return parameterDefinitions;
    } catch (error) {
      logger.error(`Failed to get job parameters for ${jobName}:`, error);
      throw error;
    }
  }

  async getJobInfo(jobName: string): Promise<any> {
    try {
      const job = await this.client.job.get(jobName);
      
      return {
        name: job.name,
        url: job.url,
        description: job.description,
        buildable: job.buildable,
        color: job.color,
        lastBuild: job.lastBuild,
        nextBuildNumber: job.nextBuildNumber,
      };
    } catch (error) {
      logger.error(`Failed to get job info for ${jobName}:`, error);
      throw error;
    }
  }

  async authenticateWithJenkins(): Promise<boolean> {
    try {
      // Test authentication by making a simple API call
      await this.client.info();
      logger.info('Jenkins authentication successful');
      return true;
    } catch (error) {
      logger.error('Jenkins authentication failed:', error);
      throw error;
    }
  }

  private parseJobParameters(configXml: string): any[] {
    // Basic XML parsing for parameter definitions
    // In production, consider using a proper XML parser like xml2js
    const parameterMatches = configXml.match(/<hudson\.model\.\w+ParameterDefinition[^>]*>[\s\S]*?<\/hudson\.model\.\w+ParameterDefinition>/g) || [];
    
    return parameterMatches.map(param => {
      const nameMatch = param.match(/<name>([\s\S]*?)<\/name>/);
      const descriptionMatch = param.match(/<description>([\s\S]*?)<\/description>/);
      const defaultValueMatch = param.match(/<defaultValue>([\s\S]*?)<\/defaultValue>/);
      const typeMatch = param.match(/hudson\.model\.(\w+)ParameterDefinition/);
      
      return {
        name: nameMatch ? nameMatch[1].trim() : '',
        description: descriptionMatch ? descriptionMatch[1].trim() : '',
        defaultValue: defaultValueMatch ? defaultValueMatch[1].trim() : '',
        type: typeMatch ? typeMatch[1] : 'String',
      };
    });
  }

  private async waitForBuildNumber(queueId: number, maxWait: number = 30000): Promise<number> {
    const startTime = Date.now();
    
    while (Date.now() - startTime < maxWait) {
      try {
        const queueItem = await this.client.queue.item(queueId);
        if (queueItem.executable) {
          return queueItem.executable.number;
        }
      } catch {
        // Queue item might not be available yet
      }
      
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    throw new Error(`Timeout waiting for build number for queue item ${queueId}`);
  }
}