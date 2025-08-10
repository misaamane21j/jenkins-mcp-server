import dotenv from 'dotenv';

dotenv.config();

export const config = {
  jenkins: {
    url: process.env.JENKINS_URL!,
    username: process.env.JENKINS_USERNAME!,
    password: process.env.JENKINS_PASSWORD,
    apiToken: process.env.JENKINS_API_TOKEN,
  },
  mcp: {
    serverName: process.env.MCP_SERVER_NAME || 'jenkins-mcp-server',
    serverVersion: process.env.MCP_SERVER_VERSION || '1.0.0',
  },
  webhook: {
    port: parseInt(process.env.WEBHOOK_PORT || '3001', 10),
    secret: process.env.WEBHOOK_SECRET!,
  },
  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
  },
  slack: {
    webhookUrl: process.env.SLACK_WEBHOOK_URL!,
  },
  app: {
    nodeEnv: process.env.NODE_ENV || 'development',
    logLevel: process.env.LOG_LEVEL || 'info',
  },
};