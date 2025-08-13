import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import express from 'express';
import { config } from './config/environment';
import { logger } from './utils/logger';
import { MCPServerService } from './server/mcp-server';
import { WebhookHandler } from './services/webhook-handler';

let mcpService: MCPServerService | null = null;
let server: Server | null = null;
let webhookHandler: WebhookHandler | null = null;

async function main() {
  try {
    logger.info('Starting Jenkins MCP Server...');

    // Initialize MCP Server
    server = new Server({
      name: config.mcp.serverName,
      version: config.mcp.serverVersion,
    }, {
      capabilities: {
        tools: {},
      },
    });

    mcpService = new MCPServerService(server);
    await mcpService.initialize();

    // Connect transport
    const transport = new StdioServerTransport();
    await server.connect(transport);
    logger.info('MCP server connected via stdio transport');

    // Initialize webhook services
    const { JobTrackerService } = await import('./services/job-tracker');
    const jobTracker = new JobTrackerService();
    await jobTracker.initialize();
    
    webhookHandler = new WebhookHandler(jobTracker);
    await webhookHandler.start();

    logger.info('Jenkins MCP Server initialized successfully');

    // Setup graceful shutdown
    setupGracefulShutdown();

  } catch (error) {
    logger.error('Failed to start MCP server:', error);
    await cleanup();
    process.exit(1);
  }
}

function setupGracefulShutdown() {
  const signals = ['SIGINT', 'SIGTERM', 'SIGQUIT'];
  
  signals.forEach((signal) => {
    process.on(signal, async () => {
      logger.info(`Received ${signal}, shutting down gracefully...`);
      await cleanup();
      process.exit(0);
    });
  });

  process.on('uncaughtException', async (error) => {
    logger.error('Uncaught exception:', error);
    await cleanup();
    process.exit(1);
  });

  process.on('unhandledRejection', async (reason, promise) => {
    logger.error('Unhandled rejection at:', promise, 'reason:', reason);
    await cleanup();
    process.exit(1);
  });
}

async function cleanup() {
  try {
    if (webhookHandler) {
      await webhookHandler.stop();
    }
    if (mcpService) {
      await mcpService.stop();
    }
    logger.info('Cleanup completed');
  } catch (error) {
    logger.error('Error during cleanup:', error);
  }
}

main();