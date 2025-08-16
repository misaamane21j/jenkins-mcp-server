import axios from 'axios';
import { JenkinsConnectionTester, testJenkinsConnection, comprehensiveJenkinsTest } from '../../../src/utils/jenkins-connection-test';
import { JenkinsConfigOptions } from '../../../src/config/jenkins';

// Mock axios
jest.mock('axios');
const mockAxios = axios as jest.Mocked<typeof axios>;

// Mock logger
jest.mock('../../../src/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
  },
}));

// Mock validation
jest.mock('../../../src/utils/validation', () => ({
  validateInput: jest.fn((schema, input) => input),
  jenkinsConfigSchema: jest.fn(),
}));

describe('JenkinsConnectionTester', () => {
  let mockConfig: JenkinsConfigOptions;
  let tester: JenkinsConnectionTester;

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockConfig = {
      baseUrl: 'https://test-jenkins.com',
      username: 'test-user',
      apiToken: 'test-token',
      timeout: 30000,
      crumbIssuer: true,
      formData: true,
      promisify: true,
    };
    
    tester = new JenkinsConnectionTester(mockConfig);
  });

  describe('testConnection', () => {
    it('should return success for fully working Jenkins', async () => {
      // Mock successful responses for all tests
      mockAxios.get
        .mockResolvedValueOnce({ status: 401 }) // Reachability (401 means reachable but needs auth)
        .mockResolvedValueOnce({ status: 200, data: { fullName: 'Test User' } }) // Authentication
        .mockResolvedValueOnce({ 
          status: 200, 
          data: { version: '2.400', mode: 'NORMAL', nodeName: 'master' } 
        }); // API access

      const result = await tester.testConnection();

      expect(result.success).toBe(true);
      expect(result.message).toBe('Jenkins connection test successful');
      expect(result.details).toMatchObject({
        jenkins_version: '2.400',
        mode: 'NORMAL',
        node_name: 'master',
        authenticated: true,
      });
      expect(result.details?.response_time_ms).toBeDefined();
    });

    it('should fail on unreachable server', async () => {
      const connectionError = new Error('Connection refused') as any;
      connectionError.code = 'ECONNREFUSED';
      connectionError.isAxiosError = true;
      mockAxios.get.mockRejectedValue(connectionError);
      mockAxios.isAxiosError.mockReturnValue(true);

      const result = await tester.testConnection();

      expect(result.success).toBe(false);
      expect(result.message).toBe('Cannot connect to Jenkins server');
      expect(result.errors).toContain('Connection refused - check if Jenkins is running and URL is correct');
    });

    it('should fail on DNS resolution failure', async () => {
      const dnsError = new Error('getaddrinfo ENOTFOUND') as any;
      dnsError.code = 'ENOTFOUND';
      dnsError.isAxiosError = true;
      mockAxios.get.mockRejectedValue(dnsError);
      mockAxios.isAxiosError.mockReturnValue(true);

      const result = await tester.testConnection();

      expect(result.success).toBe(false);
      expect(result.message).toBe('Jenkins server not found');
      expect(result.errors).toContain('DNS resolution failed - check Jenkins URL');
    });

    it('should fail on timeout', async () => {
      const timeoutError = new Error('Timeout') as any;
      timeoutError.code = 'ETIMEDOUT';
      timeoutError.isAxiosError = true;
      mockAxios.get.mockRejectedValue(timeoutError);
      mockAxios.isAxiosError.mockReturnValue(true);

      const result = await tester.testConnection();

      expect(result.success).toBe(false);
      expect(result.message).toBe('Connection to Jenkins timed out');
      expect(result.errors).toContain('Connection timeout - check network connectivity and firewall');
    });

    it('should fail on authentication error', async () => {
      // Mock reachable server but auth failure
      const authError = new Error('Unauthorized') as any;
      authError.response = { status: 401 };
      authError.isAxiosError = true;
      
      mockAxios.get
        .mockResolvedValueOnce({ status: 401 }) // Reachable
        .mockRejectedValueOnce(authError); // Auth failure
      mockAxios.isAxiosError.mockReturnValue(true);

      const result = await tester.testConnection();

      expect(result.success).toBe(false);
      expect(result.message).toBe('Jenkins authentication failed');
      expect(result.errors).toContain('Invalid credentials - check username and API token/password');
    });

    it('should fail on permission error', async () => {
      // Mock reachable server and successful auth but permission denied
      mockAxios.get
        .mockResolvedValueOnce({ status: 401 }) // Reachable
        .mockResolvedValueOnce({ status: 200, data: { fullName: 'Test User' } }) // Auth success
        .mockRejectedValueOnce({ 
          response: { status: 403 },
          isAxiosError: true 
        }); // Permission denied

      const result = await tester.testConnection();

      expect(result.success).toBe(false);
      expect(result.message).toBe('Error during API access test');
    });

    it('should handle server errors', async () => {
      mockAxios.get.mockResolvedValue({ status: 500, statusText: 'Internal Server Error' });

      const result = await tester.testConnection();

      expect(result.success).toBe(false);
      expect(result.message).toBe('Jenkins server returned server error');
      expect(result.errors).toContain('HTTP 500: Internal Server Error');
    });
  });

  describe('testJobListAccess', () => {
    it('should successfully test job list access', async () => {
      const mockJobData = {
        jobs: [
          { name: 'job1', url: 'job/job1/', buildable: true },
          { name: 'job2', url: 'job/job2/', buildable: false },
        ]
      };
      
      mockAxios.get.mockResolvedValue({ status: 200, data: mockJobData });

      const result = await tester.testJobListAccess();

      expect(result.success).toBe(true);
      expect(result.message).toBe('Jenkins job list access successful (2 jobs found)');
      expect(result.details?.job_count).toBe(2);
      expect(mockAxios.get).toHaveBeenCalledWith(
        'https://test-jenkins.com/api/json?tree=jobs[name,url,buildable]',
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': expect.stringMatching(/^Basic /)
          })
        })
      );
    });

    it('should handle empty job list', async () => {
      mockAxios.get.mockResolvedValue({ status: 200, data: { jobs: [] } });

      const result = await tester.testJobListAccess();

      expect(result.success).toBe(true);
      expect(result.message).toBe('Jenkins job list access successful (0 jobs found)');
      expect(result.details?.job_count).toBe(0);
    });

    it('should handle job list access failure', async () => {
      mockAxios.get.mockResolvedValue({ status: 403, statusText: 'Forbidden' });

      const result = await tester.testJobListAccess();

      expect(result.success).toBe(false);
      expect(result.message).toBe('Jenkins job list access failed');
      expect(result.errors).toContain('HTTP 403: Forbidden');
    });
  });

  describe('testCrumbAccess', () => {
    it('should successfully test CSRF crumb access', async () => {
      const mockCrumbData = {
        crumb: 'test-crumb-value',
        crumbRequestField: 'Jenkins-Crumb'
      };
      
      mockAxios.get.mockResolvedValue({ status: 200, data: mockCrumbData });

      const result = await tester.testCrumbAccess();

      expect(result.success).toBe(true);
      expect(result.message).toBe('Jenkins CSRF crumb access successful');
      expect(result.details).toMatchObject({
        crumb_issuer_enabled: true,
        crumb_field: 'Jenkins-Crumb'
      });
    });

    it('should handle disabled CSRF protection', async () => {
      mockAxios.get.mockResolvedValue({ status: 404 });

      const result = await tester.testCrumbAccess();

      expect(result.success).toBe(true);
      expect(result.message).toBe('Jenkins CSRF protection is disabled');
      expect(result.details?.crumb_issuer_enabled).toBe(false);
    });

    it('should handle crumb access failure', async () => {
      mockAxios.get.mockResolvedValue({ status: 500, statusText: 'Internal Server Error' });

      const result = await tester.testCrumbAccess();

      expect(result.success).toBe(false);
      expect(result.message).toBe('Jenkins CSRF crumb access failed');
      expect(result.errors).toContain('HTTP 500: Internal Server Error');
    });
  });

  describe('configuration validation', () => {
    it('should use password when API token is not provided', () => {
      const configWithPassword: JenkinsConfigOptions = {
        ...mockConfig,
        apiToken: undefined,
        password: 'test-password'
      };

      const testerWithPassword = new JenkinsConnectionTester(configWithPassword);
      
      // Test that the tester was created successfully
      expect(testerWithPassword).toBeInstanceOf(JenkinsConnectionTester);
    });
  });
});

describe('Convenience Functions', () => {
  let mockConfig: JenkinsConfigOptions;

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockConfig = {
      baseUrl: 'https://test-jenkins.com',
      username: 'test-user',
      apiToken: 'test-token',
      timeout: 30000,
      crumbIssuer: true,
      formData: true,
      promisify: true,
    };
  });

  describe('testJenkinsConnection', () => {
    it('should return connection test result', async () => {
      // Mock successful connection test
      mockAxios.get
        .mockResolvedValueOnce({ status: 401 })
        .mockResolvedValueOnce({ status: 200, data: { fullName: 'Test User' } })
        .mockResolvedValueOnce({ 
          status: 200, 
          data: { version: '2.400', mode: 'NORMAL', nodeName: 'master' } 
        });

      const result = await testJenkinsConnection(mockConfig);

      expect(result.success).toBe(true);
      expect(result.message).toBe('Jenkins connection test successful');
    });
  });

  describe('comprehensiveJenkinsTest', () => {
    it('should run all tests and return comprehensive results', async () => {
      // Mock all successful responses
      mockAxios.get
        // Basic connection test (3 calls)
        .mockResolvedValueOnce({ status: 401 })
        .mockResolvedValueOnce({ status: 200, data: { fullName: 'Test User' } })
        .mockResolvedValueOnce({ 
          status: 200, 
          data: { version: '2.400', mode: 'NORMAL', nodeName: 'master' } 
        })
        // Job access test
        .mockResolvedValueOnce({ 
          status: 200, 
          data: { jobs: [{ name: 'test-job', url: 'job/test-job/', buildable: true }] } 
        })
        // Crumb access test
        .mockResolvedValueOnce({ 
          status: 200, 
          data: { crumb: 'test-crumb', crumbRequestField: 'Jenkins-Crumb' } 
        });

      const result = await comprehensiveJenkinsTest(mockConfig);

      expect(result.overall.success).toBe(true);
      expect(result.overall.message).toBe('All Jenkins connectivity tests passed');
      expect(result.overall.details).toMatchObject({
        basic_connection: true,
        job_access: true,
        crumb_access: true
      });

      expect(result.details.basic.success).toBe(true);
      expect(result.details.jobAccess.success).toBe(true);
      expect(result.details.crumbAccess.success).toBe(true);
    });

    it('should report failure when any test fails', async () => {
      // Mock basic connection success but job access failure
      mockAxios.get
        // Basic connection test (3 calls)
        .mockResolvedValueOnce({ status: 401 })
        .mockResolvedValueOnce({ status: 200, data: { fullName: 'Test User' } })
        .mockResolvedValueOnce({ 
          status: 200, 
          data: { version: '2.400', mode: 'NORMAL', nodeName: 'master' } 
        })
        // Job access test failure
        .mockResolvedValueOnce({ status: 403, statusText: 'Forbidden' })
        // Crumb access test
        .mockResolvedValueOnce({ 
          status: 200, 
          data: { crumb: 'test-crumb', crumbRequestField: 'Jenkins-Crumb' } 
        });

      const result = await comprehensiveJenkinsTest(mockConfig);

      expect(result.overall.success).toBe(false);
      expect(result.overall.message).toBe('Some Jenkins connectivity tests failed');
      expect(result.overall.details).toMatchObject({
        basic_connection: true,
        job_access: false,
        crumb_access: true
      });

      expect(result.details.basic.success).toBe(true);
      expect(result.details.jobAccess.success).toBe(false);
      expect(result.details.crumbAccess.success).toBe(true);
    });
  });
});