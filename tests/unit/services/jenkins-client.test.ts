import { JenkinsClientService } from '../../../src/services/jenkins-client';
import { logger } from '../../../src/utils/logger';

// Mock the jenkins package
jest.mock('jenkins');
jest.mock('../../../src/utils/logger');

// Mock the Jenkins configuration
jest.mock('../../../src/config/jenkins', () => ({
  jenkinsConfig: {
    baseUrl: 'https://test-jenkins.com',
    crumbIssuer: true,
    formData: true,
    promisify: true,
    timeout: 30000,
    auth: {
      username: 'test-user',
      password: 'test-token',
    },
  },
}));

const mockJenkins = {
  job: {
    build: jest.fn(),
    list: jest.fn(),
    get: jest.fn(),
    config: jest.fn(),
  },
  build: {
    get: jest.fn(),
  },
  queue: {
    item: jest.fn(),
  },
  info: jest.fn(),
};

// Mock the jenkins constructor
jest.mock('jenkins', () => jest.fn(() => mockJenkins));

describe('JenkinsClientService', () => {
  let service: JenkinsClientService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new JenkinsClientService();
  });

  describe('triggerJob', () => {
    it('should trigger a job successfully', async () => {
      const jobName = 'test-job';
      const parameters = { param1: 'value1' };
      const queueId = 123;
      const buildNumber = 456;

      mockJenkins.job.build.mockResolvedValue(queueId);
      mockJenkins.queue.item.mockResolvedValue({
        executable: { number: buildNumber }
      });

      const result = await service.triggerJob(jobName, parameters);

      expect(mockJenkins.job.build).toHaveBeenCalledWith({
        name: jobName,
        parameters,
      });
      expect(result).toEqual({
        buildNumber,
        queueId,
        jobName,
        status: 'TRIGGERED',
      });
    });

    it('should handle job trigger failure', async () => {
      const jobName = 'test-job';
      const parameters = { param1: 'value1' };
      const error = new Error('Jenkins API error');

      mockJenkins.job.build.mockRejectedValue(error);

      await expect(service.triggerJob(jobName, parameters)).rejects.toThrow('Jenkins API error');
      expect(logger.error).toHaveBeenCalledWith(`Failed to trigger job ${jobName}:`, error);
    });

    it('should timeout waiting for build number', async () => {
      const jobName = 'test-job';
      const parameters = { param1: 'value1' };
      const queueId = 123;

      mockJenkins.job.build.mockResolvedValue(queueId);
      mockJenkins.queue.item.mockResolvedValue({});

      // Mock Date.now to simulate timeout
      const originalDateNow = Date.now;
      let currentTime = 1000;
      Date.now = jest.fn(() => currentTime);

      // Advance time beyond maxWait
      setTimeout(() => {
        currentTime = 35000; // Beyond 30s timeout
      }, 100);

      await expect(service.triggerJob(jobName, parameters)).rejects.toThrow(
        `Timeout waiting for build number for queue item ${queueId}`
      );

      Date.now = originalDateNow;
    });
  });

  describe('getBuildStatus', () => {
    it('should get build status successfully', async () => {
      const jobName = 'test-job';
      const buildNumber = 123;
      const buildData = {
        result: 'SUCCESS',
        duration: 60000,
        timestamp: 1234567890,
        url: 'http://jenkins/job/test-job/123/',
        building: false,
      };

      mockJenkins.build.get.mockResolvedValue(buildData);

      const result = await service.getBuildStatus(jobName, buildNumber);

      expect(mockJenkins.build.get).toHaveBeenCalledWith(jobName, buildNumber);
      expect(result).toEqual({
        jobName,
        buildNumber,
        status: 'SUCCESS',
        duration: 60000,
        timestamp: 1234567890,
        url: 'http://jenkins/job/test-job/123/',
      });
    });

    it('should handle running build status', async () => {
      const jobName = 'test-job';
      const buildNumber = 123;
      const buildData = {
        result: null,
        building: true,
        duration: 0,
        timestamp: 1234567890,
        url: 'http://jenkins/job/test-job/123/',
      };

      mockJenkins.build.get.mockResolvedValue(buildData);

      const result = await service.getBuildStatus(jobName, buildNumber);

      expect(result.status).toBe('RUNNING');
    });

    it('should handle pending build status', async () => {
      const jobName = 'test-job';
      const buildNumber = 123;
      const buildData = {
        result: null,
        building: false,
        duration: 0,
        timestamp: 1234567890,
        url: 'http://jenkins/job/test-job/123/',
      };

      mockJenkins.build.get.mockResolvedValue(buildData);

      const result = await service.getBuildStatus(jobName, buildNumber);

      expect(result.status).toBe('PENDING');
    });

    it('should handle build status error', async () => {
      const jobName = 'test-job';
      const buildNumber = 123;
      const error = new Error('Build not found');

      mockJenkins.build.get.mockRejectedValue(error);

      await expect(service.getBuildStatus(jobName, buildNumber)).rejects.toThrow('Build not found');
      expect(logger.error).toHaveBeenCalledWith(
        `Failed to get build status for ${jobName} #${buildNumber}:`,
        error
      );
    });
  });

  describe('listJobs', () => {
    const mockJobs = [
      { name: 'job1', url: 'http://jenkins/job/job1/', color: 'blue', buildable: true },
      { name: 'job2', url: 'http://jenkins/job/job2/', color: 'red', buildable: true },
      { name: 'disabled-job', url: 'http://jenkins/job/disabled-job/', color: 'disabled', buildable: false },
      { name: 'test-job', url: 'http://jenkins/job/test-job/', color: 'green', buildable: true },
    ];

    it('should list all enabled jobs', async () => {
      mockJenkins.job.list.mockResolvedValue(mockJobs);

      const result = await service.listJobs();

      expect(result).toHaveLength(3); // Excluding disabled job
      expect(result[0]).toEqual({
        name: 'job1',
        url: 'http://jenkins/job/job1/',
        color: 'blue',
        buildable: true,
      });
    });

    it('should include disabled jobs when requested', async () => {
      mockJenkins.job.list.mockResolvedValue(mockJobs);

      const result = await service.listJobs(undefined, true);

      expect(result).toHaveLength(4); // Including disabled job
    });

    it('should filter jobs by name', async () => {
      mockJenkins.job.list.mockResolvedValue(mockJobs);

      const result = await service.listJobs('test');

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('test-job');
    });

    it('should handle job list error', async () => {
      const error = new Error('Cannot list jobs');
      mockJenkins.job.list.mockRejectedValue(error);

      await expect(service.listJobs()).rejects.toThrow('Cannot list jobs');
      expect(logger.error).toHaveBeenCalledWith('Failed to list jobs:', error);
    });
  });

  describe('getJobParameters', () => {
    it('should parse job parameters from XML config', async () => {
      const jobName = 'test-job';
      const configXml = `<project>
  <properties>
    <hudson.model.ParametersDefinitionProperty>
      <parameterDefinitions>
        <hudson.model.StringParameterDefinition>
          <name>BRANCH</name>
          <description>Branch to build</description>
          <defaultValue>main</defaultValue>
        </hudson.model.StringParameterDefinition>
        <hudson.model.BooleanParameterDefinition>
          <name>DEPLOY</name>
          <description>Deploy after build</description>
          <defaultValue>false</defaultValue>
        </hudson.model.BooleanParameterDefinition>
      </parameterDefinitions>
    </hudson.model.ParametersDefinitionProperty>
  </properties>
</project>`;

      mockJenkins.job.config.mockResolvedValue(configXml);

      const result = await service.getJobParameters(jobName);

      expect(mockJenkins.job.config).toHaveBeenCalledWith(jobName);
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        name: 'BRANCH',
        description: 'Branch to build',
        defaultValue: 'main',
        type: 'String',
      });
      expect(result[1]).toEqual({
        name: 'DEPLOY',
        description: 'Deploy after build',
        defaultValue: 'false',
        type: 'Boolean',
      });
    });

    it('should handle job with no parameters', async () => {
      const jobName = 'simple-job';
      const configXml = '<project><properties></properties></project>';

      mockJenkins.job.config.mockResolvedValue(configXml);

      const result = await service.getJobParameters(jobName);

      expect(result).toEqual([]);
    });

    it('should handle job config error', async () => {
      const jobName = 'test-job';
      const error = new Error('Job not found');

      mockJenkins.job.config.mockRejectedValue(error);

      await expect(service.getJobParameters(jobName)).rejects.toThrow('Job not found');
      expect(logger.error).toHaveBeenCalledWith(`Failed to get job parameters for ${jobName}:`, error);
    });
  });

  describe('getJobInfo', () => {
    it('should get job info successfully', async () => {
      const jobName = 'test-job';
      const jobData = {
        name: 'test-job',
        url: 'http://jenkins/job/test-job/',
        description: 'Test job description',
        buildable: true,
        color: 'blue',
        lastBuild: { number: 123 },
        nextBuildNumber: 124,
      };

      mockJenkins.job.get.mockResolvedValue(jobData);

      const result = await service.getJobInfo(jobName);

      expect(mockJenkins.job.get).toHaveBeenCalledWith(jobName);
      expect(result).toEqual(jobData);
    });

    it('should handle job info error', async () => {
      const jobName = 'test-job';
      const error = new Error('Job not found');

      mockJenkins.job.get.mockRejectedValue(error);

      await expect(service.getJobInfo(jobName)).rejects.toThrow('Job not found');
      expect(logger.error).toHaveBeenCalledWith(`Failed to get job info for ${jobName}:`, error);
    });
  });

  describe('authenticateWithJenkins', () => {
    it('should authenticate successfully', async () => {
      mockJenkins.info.mockResolvedValue({ version: '2.401.3' });

      const result = await service.authenticateWithJenkins();

      expect(mockJenkins.info).toHaveBeenCalled();
      expect(result).toBe(true);
      expect(logger.info).toHaveBeenCalledWith('Jenkins authentication successful');
    });

    it('should handle authentication failure', async () => {
      const error = new Error('Authentication failed');
      mockJenkins.info.mockRejectedValue(error);

      await expect(service.authenticateWithJenkins()).rejects.toThrow('Authentication failed');
      expect(logger.error).toHaveBeenCalledWith('Jenkins authentication failed:', error);
    });
  });
});