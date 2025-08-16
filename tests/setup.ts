import { config } from 'dotenv';

// Load environment variables from .env.test file
config({ path: '.env.test' });

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'error';
process.env.JENKINS_URL = 'http://test-jenkins:8080';
process.env.JENKINS_USERNAME = 'test-user';
process.env.JENKINS_API_TOKEN = 'test-token';
process.env.WEBHOOK_SECRET = 'test-secret';
process.env.WEBHOOK_PORT = '3001';
process.env.REDIS_URL = 'redis://test-redis:6379';
process.env.SLACK_WEBHOOK_URL = 'http://test-slack/webhook';
process.env.MCP_SERVER_NAME = 'jenkins-mcp-server-test';
process.env.MCP_SERVER_VERSION = '1.0.0-test';

// Global test setup
beforeAll(() => {
  // Silence console.log during tests unless LOG_LEVEL is debug
  if (process.env.LOG_LEVEL !== 'debug') {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'info').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  }
});

afterAll(() => {
  // Restore console methods
  jest.restoreAllMocks();
});

// Increase timeout for integration tests
jest.setTimeout(30000);