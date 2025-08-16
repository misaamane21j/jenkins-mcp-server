import express, { Request, Response, NextFunction } from 'express';
import { Server } from 'http';
import { validateInput, WebhookPayload, webhookPayloadSchema } from '../utils/validation';
import { handleError, formatMCPError, WebhookError } from '../utils/error-handler';
import { logger } from '../utils/logger';
import { config } from '../config/environment';
import { JobTrackerService } from './job-tracker';
import { webhookAuth } from '../middleware/webhook-auth';
import axios from 'axios';

export interface CallbackInfo {
  slackChannel: string;
  slackThreadTs: string;
  slackUserId: string;
}

export interface SlackNotificationPayload {
  jobName: string;
  buildNumber: number;
  status: 'SUCCESS' | 'FAILURE' | 'UNSTABLE' | 'ABORTED';
  buildUrl: string;
  callbackInfo: CallbackInfo;
}

export class WebhookHandler {
  private app: express.Application;
  private jobTracker: JobTrackerService;
  private server: Server | null = null;

  constructor(jobTracker: JobTrackerService) {
    this.app = express();
    this.jobTracker = jobTracker;
    this.setupMiddleware();
    this.setupRoutes();
    this.setupErrorHandling();
  }

  private setupMiddleware(): void {
    // Parse JSON payloads
    this.app.use(express.json());
    
    // Add request logging
    this.app.use((req: Request, res: Response, next: NextFunction) => {
      logger.info('Webhook request received', {
        method: req.method,
        path: req.path,
        userAgent: req.get('User-Agent'),
        contentType: req.get('Content-Type')
      });
      next();
    });
  }

  private setupRoutes(): void {
    // Health check endpoint
    this.app.get('/health', this.handleHealth.bind(this));

    // MCP tools endpoint
    this.app.get('/tools', this.handleTools.bind(this));

    // Jenkins webhook endpoint with authentication
    this.app.post('/webhook/jenkins', webhookAuth, this.handleJenkinsWebhook.bind(this));
  }

  private setupErrorHandling(): void {
    // Global error handler
    this.app.use((err: Error, req: Request, res: Response, _next: NextFunction) => {
      const handledError = handleError(err, 'webhook handler');
      const mcpError = formatMCPError(handledError);
      
      logger.error('Webhook handler error', {
        path: req.path,
        method: req.method,
        error: mcpError.error
      });

      res.status(handledError.statusCode || 500).json(mcpError);
    });
  }

  private handleHealth(req: Request, res: Response): void {
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      service: 'jenkins-mcp-webhook-handler',
      version: config.mcp.serverVersion
    });
  }

  private handleTools(req: Request, res: Response): void {
    res.json({
      tools: [
        {
          name: 'trigger_jenkins_job',
          description: 'Trigger a Jenkins job with optional parameters and callback information',
          inputSchema: {
            type: 'object',
            properties: {
              jobName: {
                type: 'string',
                description: 'Name of the Jenkins job to trigger'
              },
              parameters: {
                type: 'object',
                description: 'Optional job parameters',
                additionalProperties: true
              },
              callbackInfo: {
                type: 'object',
                description: 'Optional callback information for notifications',
                properties: {
                  slackChannel: { type: 'string' },
                  slackThreadTs: { type: 'string' },
                  slackUserId: { type: 'string' }
                }
              }
            },
            required: ['jobName']
          }
        },
        {
          name: 'get_job_status',
          description: 'Get the status of a Jenkins job or specific build',
          inputSchema: {
            type: 'object',
            properties: {
              jobName: {
                type: 'string',
                description: 'Name of the Jenkins job'
              },
              buildNumber: {
                type: 'number',
                description: 'Optional specific build number'
              }
            },
            required: ['jobName']
          }
        },
        {
          name: 'list_jenkins_jobs',
          description: 'List available Jenkins jobs with optional filtering',
          inputSchema: {
            type: 'object',
            properties: {
              filter: {
                type: 'string',
                description: 'Optional filter pattern for job names'
              },
              includeDisabled: {
                type: 'boolean',
                description: 'Whether to include disabled jobs'
              }
            }
          }
        },
        {
          name: 'get_job_parameters',
          description: 'Get the parameter definitions for a Jenkins job',
          inputSchema: {
            type: 'object',
            properties: {
              jobName: {
                type: 'string',
                description: 'Name of the Jenkins job'
              }
            },
            required: ['jobName']
          }
        }
      ]
    });
  }

  private async handleJenkinsWebhook(req: Request, res: Response): Promise<void> {
    try {
      logger.info('Processing Jenkins webhook', {
        headers: {
          'content-type': req.get('Content-Type'),
          'user-agent': req.get('User-Agent')
        },
        bodySize: JSON.stringify(req.body).length
      });

      // Validate webhook payload
      const payload = validateInput<WebhookPayload>(webhookPayloadSchema, req.body);

      logger.info('Validated webhook payload', {
        jobName: payload.name,
        buildNumber: payload.build.number,
        phase: payload.build.phase,
        status: payload.build.status
      });

      // Only process completed builds with status
      if (payload.build.phase === 'COMPLETED' && payload.build.status) {
        await this.processCompletedBuild(payload);
      } else {
        logger.debug('Webhook received but not processing - build not completed or no status', {
          phase: payload.build.phase,
          status: payload.build.status
        });
      }

      res.json({
        success: true,
        message: 'Webhook processed successfully',
        jobName: payload.name,
        buildNumber: payload.build.number,
        phase: payload.build.phase
      });

    } catch (error) {
      const handledError = handleError(error, 'Jenkins webhook processing');
      
      if (handledError instanceof WebhookError) {
        logger.warn('Webhook validation failed', { error: handledError.message });
        res.status(400).json(formatMCPError(handledError));
      } else {
        logger.error('Unexpected error processing webhook', { error: handledError });
        res.status(500).json(formatMCPError(handledError));
      }
    }
  }

  private async processCompletedBuild(payload: WebhookPayload): Promise<void> {
    const { name: jobName, build } = payload;
    
    try {
      // Retrieve job tracking information from Redis
      const jobInfo = await this.jobTracker.getJobInfo(jobName, build.number);
      
      if (!jobInfo || !jobInfo.callbackInfo) {
        logger.info('No callback information found for build', {
          jobName,
          buildNumber: build.number
        });
        return;
      }

      logger.info('Found callback information, sending notification', {
        jobName,
        buildNumber: build.number,
        status: build.status,
        slackChannel: jobInfo.callbackInfo.slackChannel
      });

      // Send notification to Slack AI Agent
      await this.sendSlackNotification({
        jobName,
        buildNumber: build.number,
        status: build.status!,
        buildUrl: build.full_url,
        callbackInfo: jobInfo.callbackInfo
      });

      // Update job status in Redis
      await this.jobTracker.updateJobStatus(jobName, build.number, build.status!, {
        duration: build.duration,
        timestamp: build.timestamp || Date.now()
      });

      logger.info('Successfully processed completed build notification', {
        jobName,
        buildNumber: build.number,
        status: build.status
      });

    } catch (error) {
      logger.error('Error processing completed build', {
        jobName,
        buildNumber: build.number,
        error: handleError(error).message
      });
      throw error;
    }
  }

  private async sendSlackNotification(notification: SlackNotificationPayload): Promise<void> {
    try {
      const response = await axios.post(config.slack.webhookUrl, notification, {
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: 10000 // 10 second timeout
      });

      logger.info('Slack notification sent successfully', {
        jobName: notification.jobName,
        buildNumber: notification.buildNumber,
        status: notification.status,
        responseStatus: response.status
      });

    } catch (error) {
      logger.error('Failed to send Slack notification', {
        jobName: notification.jobName,
        buildNumber: notification.buildNumber,
        error: axios.isAxiosError(error) ? {
          status: error.response?.status,
          statusText: error.response?.statusText,
          data: error.response?.data
        } : error
      });
      
      throw new WebhookError(
        `Failed to send Slack notification: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'slack'
      );
    }
  }

  public getApp(): express.Application {
    return this.app;
  }

  public async start(): Promise<void> {
    const port = config.webhook.port;
    
    return new Promise((resolve, reject) => {
      this.server = this.app.listen(port, () => {
        logger.info('Webhook handler started', {
          port,
          endpoints: ['/health', '/tools', '/webhook/jenkins']
        });
        resolve();
      });

      this.server.on('error', (error: Error) => {
        logger.error('Webhook handler failed to start', { error });
        reject(error);
      });
    });
  }

  public async stop(): Promise<void> {
    if (!this.server) {
      logger.warn('Webhook handler server is not running');
      return;
    }

    return new Promise<void>((resolve, reject) => {
      this.server!.close((error?: Error) => {
        if (error) {
          logger.error('Error stopping webhook handler', { error });
          reject(error);
        } else {
          logger.info('Webhook handler stopped');
          this.server = null;
          resolve();
        }
      });
    });
  }
}