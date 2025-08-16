import { config } from './environment';
import { logger } from '../utils/logger';
import { validateInput, jenkinsConfigSchema } from '../utils/validation';
import { testJenkinsConnection, ConnectionTestResult } from '../utils/jenkins-connection-test';

export interface JenkinsConfigOptions {
  baseUrl: string;
  username: string;
  password?: string;
  apiToken?: string;
  timeout?: number;
  crumbIssuer?: boolean;
  formData?: boolean;
  promisify?: boolean;
}

export class JenkinsConfiguration {
  private static instance: JenkinsConfiguration;
  private configOptions: JenkinsConfigOptions;

  private constructor() {
    this.configOptions = this.buildConfiguration();
    this.validateConfiguration();
  }

  public static getInstance(): JenkinsConfiguration {
    if (!JenkinsConfiguration.instance) {
      JenkinsConfiguration.instance = new JenkinsConfiguration();
    }
    return JenkinsConfiguration.instance;
  }

  public getConfig(): any {
    return {
      baseUrl: this.configOptions.baseUrl,
      crumbIssuer: this.configOptions.crumbIssuer,
      formData: this.configOptions.formData,
      promisify: this.configOptions.promisify,
      timeout: this.configOptions.timeout,
      auth: {
        username: this.configOptions.username,
        password: this.configOptions.apiToken || this.configOptions.password,
      },
    };
  }

  public getConnectionOptions(): JenkinsConfigOptions {
    return { ...this.configOptions };
  }

  private buildConfiguration(): JenkinsConfigOptions {
    return {
      baseUrl: config.jenkins.url,
      username: config.jenkins.username,
      password: config.jenkins.password,
      apiToken: config.jenkins.apiToken,
      timeout: 30000, // 30 seconds
      crumbIssuer: true,
      formData: true,
      promisify: true,
    };
  }

  private validateConfiguration(): void {
    try {
      // Use Joi schema validation for comprehensive validation
      this.configOptions = validateInput(jenkinsConfigSchema, this.configOptions);
      logger.info('Jenkins configuration validated successfully');
    } catch (error) {
      const errorMessage = `Jenkins configuration validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
      logger.error(errorMessage);
      throw new Error(errorMessage);
    }
  }

  public async testConnection(): Promise<ConnectionTestResult> {
    try {
      return await testJenkinsConnection(this.configOptions);
    } catch (error) {
      logger.error('Jenkins connection test failed:', error);
      return {
        success: false,
        message: 'Jenkins connection test failed',
        errors: [error instanceof Error ? error.message : 'Unknown error']
      };
    }
  }

  public async validateAndTestConnection(): Promise<{ valid: boolean; connected: boolean; testResult: ConnectionTestResult }> {
    let valid = false;
    let connected = false;
    let testResult: ConnectionTestResult;

    try {
      // First validate configuration
      this.validateConfiguration();
      valid = true;
      
      // Then test connection
      testResult = await this.testConnection();
      connected = testResult.success;
      
    } catch (error) {
      testResult = {
        success: false,
        message: 'Configuration validation failed',
        errors: [error instanceof Error ? error.message : 'Unknown error']
      };
    }

    return {
      valid,
      connected,
      testResult
    };
  }
}

// Export function to get config for backward compatibility
export const getJenkinsConfig = () => JenkinsConfiguration.getInstance().getConfig();

// Export the config object lazily to avoid issues during testing
let _jenkinsConfig: any;
export const jenkinsConfig = new Proxy({}, {
  get(target, prop) {
    if (!_jenkinsConfig) {
      _jenkinsConfig = JenkinsConfiguration.getInstance().getConfig();
    }
    return _jenkinsConfig[prop];
  }
});