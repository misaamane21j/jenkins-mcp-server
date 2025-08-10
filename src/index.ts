import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import express from 'express';
import { config } from './config/environment';
import { logger } from './utils/logger';
import { MCPServerService } from './server/mcp-server';
import { WebhookHandlerService } from './services/webhook-handler';

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

    const app = express();
    const webhookHandler = new WebhookHandlerService();
    
    app.use(express.json());
    app.post('/webhook/jenkins', webhookHandler.handleJenkinsWebhook.bind(webhookHandler));
    app.get('/health', (req, res) => res.json({ status: 'healthy' }));
    
    app.listen(config.webhook.port, () => {
      logger.info(`Webhook server started on port ${config.webhook.port}`);
    });

    logger.info('Jenkins MCP Server initialized');
  } catch (error) {
    logger.error('Failed to start MCP server:', error);
    process.exit(1);
  }
}

main();