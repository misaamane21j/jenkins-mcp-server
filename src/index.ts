import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import express from 'express';
import { config } from './config/environment';
import { logger } from './utils/logger';
import { MCPServerService } from './server/mcp-server';
import { WebhookHandler } from './services/webhook-handler';

async function main() {
  try {
    const server = new Server({
      name: config.mcp.serverName,
      version: config.mcp.serverVersion,
    }, {
      capabilities: {
        tools: {},
      },
    });

    const mcpService = new MCPServerService(server);
    await mcpService.initialize();

    const transport = new StdioServerTransport();
    await server.connect(transport);

    // For the webhook handler, we need to create the job tracker dependency
    const { JobTrackerService } = await import('./services/job-tracker');
    const jobTracker = new JobTrackerService();
    await jobTracker.initialize();
    
    const webhookHandler = new WebhookHandler(jobTracker);
    await webhookHandler.start();

    logger.info('Jenkins MCP Server initialized');
  } catch (error) {
    logger.error('Failed to start MCP server:', error);
    process.exit(1);
  }
}

main();