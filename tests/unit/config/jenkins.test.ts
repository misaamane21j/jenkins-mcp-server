// Mock the logger first
jest.mock('../../../src/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
  },
}));

// Mock the environment config
jest.mock('../../../src/config/environment', () => ({
  config: {
    jenkins: {
      url: 'https://test-jenkins.com',
      username: 'test-user',
      apiToken: 'test-token',
      password: undefined,
    },
  },
}));

// Mock the connection test utility
jest.mock('../../../src/utils/jenkins-connection-test', () => ({
  testJenkinsConnection: jest.fn(),
}));

// Mock the validation utility
jest.mock('../../../src/utils/validation', () => ({
  validateInput: jest.fn((schema, input) => input), // Return input by default
  jenkinsConfigSchema: jest.fn(),
}));

// Import after mocking
import { JenkinsConfiguration } from '../../../src/config/jenkins';
import { testJenkinsConnection } from '../../../src/utils/jenkins-connection-test';
import { validateInput, jenkinsConfigSchema } from '../../../src/utils/validation';

const mockTestJenkinsConnection = testJenkinsConnection as jest.MockedFunction<typeof testJenkinsConnection>;
const mockValidateInput = validateInput as jest.MockedFunction<typeof validateInput>;

describe('JenkinsConfiguration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset the singleton instance
    (JenkinsConfiguration as any).instance = undefined;
    
    // Mock successful validation by default
    mockValidateInput.mockImplementation((schema, input) => input);
  });

  describe('getInstance', () => {
    it('should create a singleton instance', () => {
      const instance1 = JenkinsConfiguration.getInstance();
      const instance2 = JenkinsConfiguration.getInstance();
      
      expect(instance1).toBe(instance2);
      expect(instance1).toBeInstanceOf(JenkinsConfiguration);
    });
  });

  describe('getConfig', () => {
    it('should return properly formatted configuration', () => {
      const instance = JenkinsConfiguration.getInstance();
      const config = instance.getConfig();
      
      expect(config).toEqual({
        baseUrl: 'https://test-jenkins.com',
        crumbIssuer: true,
        formData: true,
        promisify: true,
        timeout: 30000,
        auth: {
          username: 'test-user',
          password: 'test-token',
        },
      });
    });

    it('should prefer API token over password', () => {
      // Reset instance
      (JenkinsConfiguration as any).instance = undefined;
      
      // Mock validation to return config with both token and password
      mockValidateInput.mockImplementationOnce((schema, input: any) => ({
        ...input,
        apiToken: 'test-token',
        password: 'test-password'
      }));
      
      const instance = JenkinsConfiguration.getInstance();
      const config = instance.getConfig();
      
      expect(config.auth.password).toBe('test-token');
    });

    it('should use password when API token is not available', () => {
      // Reset instance
      (JenkinsConfiguration as any).instance = undefined;
      
      // Mock validation to return config with password
      mockValidateInput.mockImplementationOnce((schema, input: any) => ({
        ...input,
        apiToken: undefined,
        password: 'test-password'
      }));
      
      const instance = JenkinsConfiguration.getInstance();
      const config = instance.getConfig();
      
      expect(config.auth.password).toBe('test-password');
    });
  });

  describe('getConnectionOptions', () => {
    it('should return connection options', () => {
      const instance = JenkinsConfiguration.getInstance();
      const options = instance.getConnectionOptions();
      
      expect(options).toEqual({
        baseUrl: 'https://test-jenkins.com',
        username: 'test-user',
        apiToken: 'test-token',
        password: undefined,
        timeout: 30000,
        crumbIssuer: true,
        formData: true,
        promisify: true,
      });
    });
  });

  describe('testConnection', () => {
    it('should return successful connection test result', async () => {
      const mockResult = {
        success: true,
        message: 'Connection successful',
        details: { jenkins_version: '2.400' },
      };
      
      mockTestJenkinsConnection.mockResolvedValue(mockResult);
      
      const instance = JenkinsConfiguration.getInstance();
      const result = await instance.testConnection();
      
      expect(result).toEqual(mockResult);
      expect(mockTestJenkinsConnection).toHaveBeenCalledWith({
        baseUrl: 'https://test-jenkins.com',
        username: 'test-user',
        apiToken: 'test-token',
        password: undefined,
        timeout: 30000,
        crumbIssuer: true,
        formData: true,
        promisify: true,
      });
    });

    it('should handle connection test failure', async () => {
      const mockError = new Error('Connection failed');
      mockTestJenkinsConnection.mockRejectedValue(mockError);
      
      const instance = JenkinsConfiguration.getInstance();
      const result = await instance.testConnection();
      
      expect(result).toEqual({
        success: false,
        message: 'Jenkins connection test failed',
        errors: ['Connection failed'],
      });
    });
  });

  describe('validateAndTestConnection', () => {
    it('should validate and test connection successfully', async () => {
      const mockTestResult = {
        success: true,
        message: 'Connection successful',
      };
      
      mockTestJenkinsConnection.mockResolvedValue(mockTestResult);
      
      const instance = JenkinsConfiguration.getInstance();
      const result = await instance.validateAndTestConnection();
      
      expect(result).toEqual({
        valid: true,
        connected: true,
        testResult: mockTestResult,
      });
    });

    it('should handle validation failure', async () => {
      const mockError = new Error('Validation failed');
      mockValidateInput.mockImplementation(() => {
        throw mockError;
      });
      
      // Reset instance to trigger validation error
      (JenkinsConfiguration as any).instance = undefined;
      
      expect(() => JenkinsConfiguration.getInstance()).toThrow('Jenkins configuration validation failed: Validation failed');
    });

    it('should handle connection test failure after successful validation', async () => {
      const mockTestResult = {
        success: false,
        message: 'Connection failed',
        errors: ['Network error'],
      };
      
      mockTestJenkinsConnection.mockResolvedValue(mockTestResult);
      
      const instance = JenkinsConfiguration.getInstance();
      const result = await instance.validateAndTestConnection();
      
      expect(result).toEqual({
        valid: true,
        connected: false,
        testResult: mockTestResult,
      });
    });
  });

  describe('configuration validation', () => {
    it('should validate configuration using Joi schema', () => {
      const instance = JenkinsConfiguration.getInstance();
      
      expect(mockValidateInput).toHaveBeenCalledWith(
        expect.any(Function), // jenkinsConfigSchema
        expect.objectContaining({
          baseUrl: 'https://test-jenkins.com',
          username: 'test-user',
          apiToken: 'test-token',
        })
      );
    });
  });
});

describe('Jenkins Configuration Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset the singleton instance
    (JenkinsConfiguration as any).instance = undefined;
  });

  it('should throw error when validation fails during instantiation', () => {
    const mockError = new Error('Invalid configuration');
    mockValidateInput.mockImplementation(() => {
      throw mockError;
    });
    
    expect(() => JenkinsConfiguration.getInstance()).toThrow('Jenkins configuration validation failed: Invalid configuration');
  });

  it('should build configuration with default values', () => {
    // Reset instance
    (JenkinsConfiguration as any).instance = undefined;
    
    // Mock validation to return config with defaults
    mockValidateInput.mockImplementationOnce((schema, input: any) => ({
      ...input,
      timeout: 30000,
      crumbIssuer: true,
      formData: true,
      promisify: true,
    }));
    
    const instance = JenkinsConfiguration.getInstance();
    const options = instance.getConnectionOptions();
    
    expect(options.timeout).toBe(30000);
    expect(options.crumbIssuer).toBe(true);
    expect(options.formData).toBe(true);
    expect(options.promisify).toBe(true);
  });
});