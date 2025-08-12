import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { config } from '../config/environment';
import { logger } from '../utils/logger';
import { WebhookError } from '../utils/error-handler';

/**
 * Middleware to verify webhook signatures for Jenkins notifications
 * 
 * This middleware validates that webhooks are coming from an authorized source
 * by verifying HMAC signatures using a shared secret.
 */
export function webhookAuth(req: Request, res: Response, next: NextFunction): void {
  try {
    const signature = req.get('X-Hub-Signature-256') || req.get('X-Jenkins-Signature');
    
    if (!signature) {
      logger.warn('Webhook authentication failed: no signature header found', {
        headers: Object.keys(req.headers),
        path: req.path
      });
      throw new WebhookError('Missing webhook signature', 'authentication');
    }

    // Get raw body for signature verification
    const rawBody = JSON.stringify(req.body);
    
    if (!isValidSignature(rawBody, signature)) {
      logger.warn('Webhook authentication failed: invalid signature', {
        providedSignature: signature.substring(0, 10) + '...',
        path: req.path,
        bodySize: rawBody.length
      });
      throw new WebhookError('Invalid webhook signature', 'authentication');
    }

    logger.debug('Webhook signature verified successfully', {
      path: req.path,
      signatureType: signature.startsWith('sha256=') ? 'GitHub-style' : 'Jenkins-style'
    });

    next();

  } catch (error) {
    if (error instanceof WebhookError) {
      res.status(401).json({
        error: {
          code: 'WEBHOOK_AUTH_FAILED',
          message: error.message
        }
      });
    } else {
      logger.error('Unexpected error in webhook authentication', { error });
      res.status(500).json({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Authentication error'
        }
      });
    }
  }
}

/**
 * Verify webhook signature using HMAC SHA-256
 * Supports both GitHub-style (sha256=<hex>) and Jenkins-style signatures
 */
function isValidSignature(body: string, signature: string): boolean {
  if (!config.webhook.secret) {
    logger.error('Webhook secret not configured but signature verification attempted');
    return false;
  }

  try {
    // Create HMAC hash of the request body
    const hmac = crypto.createHmac('sha256', config.webhook.secret);
    hmac.update(body, 'utf8');
    const calculatedSignature = hmac.digest('hex');

    // Handle different signature formats
    let providedSignature: string;
    
    if (signature.startsWith('sha256=')) {
      // GitHub-style signature
      providedSignature = signature.slice(7);
    } else if (signature.startsWith('sha1=')) {
      // GitHub SHA-1 style (less secure, but supported for compatibility)
      const sha1Hmac = crypto.createHmac('sha1', config.webhook.secret);
      sha1Hmac.update(body, 'utf8');
      const calculatedSha1 = sha1Hmac.digest('hex');
      providedSignature = signature.slice(5);
      
      return crypto.timingSafeEqual(
        Buffer.from(calculatedSha1, 'hex'),
        Buffer.from(providedSignature, 'hex')
      );
    } else {
      // Raw signature (Jenkins default)
      providedSignature = signature;
    }

    // Use timing-safe comparison to prevent timing attacks
    return crypto.timingSafeEqual(
      Buffer.from(calculatedSignature, 'hex'),
      Buffer.from(providedSignature, 'hex')
    );

  } catch (error) {
    logger.error('Error verifying webhook signature', {
      error: error instanceof Error ? error.message : error,
      signatureLength: signature.length,
      bodyLength: body.length
    });
    return false;
  }
}

/**
 * Development-only middleware that bypasses webhook authentication
 * Only use in non-production environments for testing
 */
export function webhookAuthBypass(req: Request, res: Response, next: NextFunction): void {
  if (config.app.nodeEnv === 'production') {
    logger.error('Attempted to use webhook auth bypass in production environment');
    throw new WebhookError('Auth bypass not allowed in production', 'configuration');
  }

  logger.warn('Webhook authentication bypassed for development', {
    path: req.path,
    environment: config.app.nodeEnv
  });

  next();
}