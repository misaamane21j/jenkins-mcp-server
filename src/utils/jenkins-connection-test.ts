import axios from 'axios';
import { JenkinsConfigOptions } from '../config/jenkins';
import { logger } from './logger';
import { validateInput, jenkinsConfigSchema } from './validation';

export interface ConnectionTestResult {
  success: boolean;
  message: string;
  details?: {
    jenkins_version?: string;
    mode?: string;
    node_name?: string;
    response_time_ms?: number;
    authenticated?: boolean;
    job_count?: number;
    crumb_issuer_enabled?: boolean;
    crumb_field?: string;
    basic_connection?: boolean;
    job_access?: boolean;
    crumb_access?: boolean;
  };
  errors?: string[];
}

export class JenkinsConnectionTester {
  private config: JenkinsConfigOptions;

  constructor(config: JenkinsConfigOptions) {
    // Validate configuration first
    this.config = validateInput(jenkinsConfigSchema, config);
  }

  async testConnection(): Promise<ConnectionTestResult> {
    const startTime = Date.now();

    try {
      logger.info('Starting Jenkins connection test...');

      // Test 1: Basic reachability
      const reachabilityResult = await this.testReachability();
      if (!reachabilityResult.success) {
        return reachabilityResult;
      }

      // Test 2: Authentication
      const authResult = await this.testAuthentication();
      if (!authResult.success) {
        return authResult;
      }

      // Test 3: API functionality
      const apiResult = await this.testApiAccess();
      if (!apiResult.success) {
        return apiResult;
      }

      const responseTime = Date.now() - startTime;
      
      return {
        success: true,
        message: 'Jenkins connection test successful',
        details: {
          ...apiResult.details,
          response_time_ms: responseTime,
          authenticated: true
        }
      };

    } catch (error) {
      logger.error('Jenkins connection test failed:', error);
      
      return {
        success: false,
        message: 'Jenkins connection test failed',
        errors: [error instanceof Error ? error.message : 'Unknown error'],
        details: {
          response_time_ms: Date.now() - startTime
        }
      };
    }
  }

  private async testReachability(): Promise<ConnectionTestResult> {
    try {
      logger.debug('Testing Jenkins reachability...');
      
      const response = await axios.get(`${this.config.baseUrl}/api/json`, {
        timeout: this.config.timeout || 30000,
        validateStatus: (status) => status < 500, // Accept 401/403 as reachable
      });

      if (response.status >= 400 && response.status < 500) {
        // Server is reachable but requires authentication
        return {
          success: true,
          message: 'Jenkins server is reachable'
        };
      }

      if (response.status >= 500) {
        return {
          success: false,
          message: 'Jenkins server returned server error',
          errors: [`HTTP ${response.status}: ${response.statusText}`]
        };
      }

      return {
        success: true,
        message: 'Jenkins server is reachable'
      };

    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (error.code === 'ECONNREFUSED') {
          return {
            success: false,
            message: 'Cannot connect to Jenkins server',
            errors: ['Connection refused - check if Jenkins is running and URL is correct']
          };
        }
        
        if (error.code === 'ENOTFOUND') {
          return {
            success: false,
            message: 'Jenkins server not found',
            errors: ['DNS resolution failed - check Jenkins URL']
          };
        }
        
        if (error.code === 'ETIMEDOUT') {
          return {
            success: false,
            message: 'Connection to Jenkins timed out',
            errors: ['Connection timeout - check network connectivity and firewall']
          };
        }
        
        return {
          success: false,
          message: 'Network error connecting to Jenkins',
          errors: [error.message]
        };
      }

      return {
        success: false,
        message: 'Unexpected error during reachability test',
        errors: [error instanceof Error ? error.message : 'Unknown error']
      };
    }
  }

  private async testAuthentication(): Promise<ConnectionTestResult> {
    try {
      logger.debug('Testing Jenkins authentication...');
      
      const auth = this.getAuthHeader();
      
      const response = await axios.get(`${this.config.baseUrl}/me/api/json`, {
        headers: {
          'Authorization': auth
        },
        timeout: this.config.timeout || 30000,
      });

      if (response.status === 200) {
        const userData = response.data;
        return {
          success: true,
          message: 'Jenkins authentication successful',
          details: {
            authenticated: true,
            node_name: userData.fullName || userData.id
          }
        };
      }

      return {
        success: false,
        message: 'Jenkins authentication failed',
        errors: [`HTTP ${response.status}: ${response.statusText}`]
      };

    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (error.response?.status === 401) {
          return {
            success: false,
            message: 'Jenkins authentication failed',
            errors: ['Invalid credentials - check username and API token/password']
          };
        }
        
        if (error.response?.status === 403) {
          return {
            success: false,
            message: 'Jenkins authentication failed',
            errors: ['Access forbidden - check user permissions']
          };
        }
      }

      return {
        success: false,
        message: 'Error during authentication test',
        errors: [error instanceof Error ? error.message : 'Unknown error']
      };
    }
  }

  private async testApiAccess(): Promise<ConnectionTestResult> {
    try {
      logger.debug('Testing Jenkins API access...');
      
      const auth = this.getAuthHeader();
      
      const response = await axios.get(`${this.config.baseUrl}/api/json`, {
        headers: {
          'Authorization': auth
        },
        timeout: this.config.timeout || 30000,
      });

      if (response.status === 200) {
        const serverInfo = response.data;
        
        return {
          success: true,
          message: 'Jenkins API access successful',
          details: {
            jenkins_version: serverInfo.version,
            mode: serverInfo.mode,
            node_name: serverInfo.nodeName
          }
        };
      }

      return {
        success: false,
        message: 'Jenkins API access failed',
        errors: [`HTTP ${response.status}: ${response.statusText}`]
      };

    } catch (error) {
      return {
        success: false,
        message: 'Error during API access test',
        errors: [error instanceof Error ? error.message : 'Unknown error']
      };
    }
  }

  async testJobListAccess(): Promise<ConnectionTestResult> {
    try {
      logger.debug('Testing Jenkins job list access...');
      
      const auth = this.getAuthHeader();
      
      const response = await axios.get(`${this.config.baseUrl}/api/json?tree=jobs[name,url,buildable]`, {
        headers: {
          'Authorization': auth
        },
        timeout: this.config.timeout || 30000,
      });

      if (response.status === 200) {
        const jobData = response.data;
        const jobCount = jobData.jobs ? jobData.jobs.length : 0;
        
        return {
          success: true,
          message: `Jenkins job list access successful (${jobCount} jobs found)`,
          details: {
            job_count: jobCount
          }
        };
      }

      return {
        success: false,
        message: 'Jenkins job list access failed',
        errors: [`HTTP ${response.status}: ${response.statusText}`]
      };

    } catch (error) {
      return {
        success: false,
        message: 'Error during job list access test',
        errors: [error instanceof Error ? error.message : 'Unknown error']
      };
    }
  }

  async testCrumbAccess(): Promise<ConnectionTestResult> {
    try {
      logger.debug('Testing Jenkins CSRF crumb access...');
      
      const auth = this.getAuthHeader();
      
      const response = await axios.get(`${this.config.baseUrl}/crumbIssuer/api/json`, {
        headers: {
          'Authorization': auth
        },
        timeout: this.config.timeout || 30000,
        validateStatus: (status) => status < 500, // Accept 404 if crumb issuer is disabled
      });

      if (response.status === 200) {
        const crumbData = response.data;
        return {
          success: true,
          message: 'Jenkins CSRF crumb access successful',
          details: {
            crumb_issuer_enabled: true,
            crumb_field: crumbData.crumbRequestField
          }
        };
      }

      if (response.status === 404) {
        return {
          success: true,
          message: 'Jenkins CSRF protection is disabled',
          details: {
            crumb_issuer_enabled: false
          }
        };
      }

      return {
        success: false,
        message: 'Jenkins CSRF crumb access failed',
        errors: [`HTTP ${response.status}: ${response.statusText}`]
      };

    } catch (error) {
      return {
        success: false,
        message: 'Error during CSRF crumb access test',
        errors: [error instanceof Error ? error.message : 'Unknown error']
      };
    }
  }

  private getAuthHeader(): string {
    const credentials = `${this.config.username}:${this.config.apiToken || this.config.password}`;
    return `Basic ${Buffer.from(credentials).toString('base64')}`;
  }
}

// Convenience function for quick connection testing
export async function testJenkinsConnection(config: JenkinsConfigOptions): Promise<ConnectionTestResult> {
  const tester = new JenkinsConnectionTester(config);
  return await tester.testConnection();
}

// Comprehensive connection test including job and crumb access
export async function comprehensiveJenkinsTest(config: JenkinsConfigOptions): Promise<{
  overall: ConnectionTestResult;
  details: {
    basic: ConnectionTestResult;
    jobAccess: ConnectionTestResult;
    crumbAccess: ConnectionTestResult;
  };
}> {
  const tester = new JenkinsConnectionTester(config);
  
  const basicTest = await tester.testConnection();
  const jobTest = await tester.testJobListAccess();
  const crumbTest = await tester.testCrumbAccess();
  
  const overallSuccess = basicTest.success && jobTest.success && crumbTest.success;
  
  return {
    overall: {
      success: overallSuccess,
      message: overallSuccess 
        ? 'All Jenkins connectivity tests passed' 
        : 'Some Jenkins connectivity tests failed',
      details: {
        basic_connection: basicTest.success,
        job_access: jobTest.success,
        crumb_access: crumbTest.success
      }
    },
    details: {
      basic: basicTest,
      jobAccess: jobTest,
      crumbAccess: crumbTest
    }
  };
}