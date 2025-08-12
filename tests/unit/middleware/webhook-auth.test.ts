import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { webhookAuth, webhookAuthBypass } from '../../../src/middleware/webhook-auth';
import { config } from '../../../src/config/environment';
import { logger } from '../../../src/utils/logger';

// Mock dependencies
jest.mock('../../../src/config/environment');
jest.mock('../../../src/utils/logger');

describe('Webhook Authentication Middleware', () => {
  let req: Partial<Request>;
  let res: Partial<Response>;
  let next: NextFunction;

  const mockConfig = {
    webhook: { secret: 'test-webhook-secret' },
    app: { nodeEnv: 'test' }
  };

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup config mock - ensure webhook secret is properly set
    (config as any).webhook = { ...mockConfig.webhook };
    (config as any).app = { ...mockConfig.app };

    req = {
      get: jest.fn(),
      body: { test: 'data' },
      path: '/webhook/jenkins'
    };

    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };

    next = jest.fn();
  });

  function createSignature(body: string, secret: string, algorithm: 'sha1' | 'sha256' = 'sha256'): string {
    const hmac = crypto.createHmac(algorithm, secret);
    hmac.update(body, 'utf8');
    const signature = hmac.digest('hex');
    return algorithm === 'sha256' ? `sha256=${signature}` : `sha1=${signature}`;
  }

  describe('webhookAuth', () => {

    it('should allow requests with valid GitHub-style SHA-256 signature', () => {
      const body = JSON.stringify(req.body);
      const validSignature = createSignature(body, mockConfig.webhook.secret, 'sha256');
      
      (req.get as jest.Mock).mockReturnValue(validSignature);

      webhookAuth(req as Request, res as Response, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should allow requests with valid GitHub-style SHA-1 signature', () => {
      const body = JSON.stringify(req.body);
      const validSignature = createSignature(body, mockConfig.webhook.secret, 'sha1');
      
      (req.get as jest.Mock).mockReturnValue(validSignature);

      webhookAuth(req as Request, res as Response, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should allow requests with valid raw signature', () => {
      const body = JSON.stringify(req.body);
      const hmac = crypto.createHmac('sha256', mockConfig.webhook.secret);
      hmac.update(body, 'utf8');
      const validSignature = hmac.digest('hex');
      
      (req.get as jest.Mock).mockReturnValue(validSignature);

      webhookAuth(req as Request, res as Response, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should check both X-Hub-Signature-256 and X-Jenkins-Signature headers', () => {
      const body = JSON.stringify(req.body);
      const validSignature = createSignature(body, mockConfig.webhook.secret, 'sha256');
      
      // First call returns null (X-Hub-Signature-256), second returns signature (X-Jenkins-Signature)
      (req.get as jest.Mock)
        .mockReturnValueOnce(null)
        .mockReturnValueOnce(validSignature);

      webhookAuth(req as Request, res as Response, next);

      expect(req.get).toHaveBeenCalledWith('X-Hub-Signature-256');
      expect(req.get).toHaveBeenCalledWith('X-Jenkins-Signature');
      expect(next).toHaveBeenCalled();
    });

    it('should reject requests with no signature header', () => {
      (req.get as jest.Mock).mockReturnValue(undefined);

      webhookAuth(req as Request, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(expect.any(Number));
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        error: expect.objectContaining({
          message: expect.any(String)
        })
      }));
      expect(next).not.toHaveBeenCalled();
    });

    it('should reject requests with invalid signature', () => {
      // Ensure config is properly set
      (config as any).webhook.secret = mockConfig.webhook.secret;
      
      const invalidSignature = 'sha256=invalid-signature-hash';
      (req.get as jest.Mock).mockReturnValue(invalidSignature);

      webhookAuth(req as Request, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        error: {
          code: 'WEBHOOK_AUTH_FAILED',
          message: 'Invalid webhook signature'
        }
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should handle missing webhook secret gracefully', () => {
      // Save original secret
      const originalSecret = (config as any).webhook.secret;
      (config as any).webhook.secret = null;
      
      const body = JSON.stringify(req.body);
      const signature = createSignature(body, 'any-secret', 'sha256');
      
      (req.get as jest.Mock).mockReturnValue(signature);

      webhookAuth(req as Request, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(logger.error).toHaveBeenCalledWith(
        'Webhook secret not configured but signature verification attempted'
      );
      
      // Restore original secret
      (config as any).webhook.secret = originalSecret;
    });

    it('should handle malformed signature gracefully', () => {
      const malformedSignature = 'not-a-valid-hex-string';
      (req.get as jest.Mock).mockReturnValue(malformedSignature);

      webhookAuth(req as Request, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(logger.error).toHaveBeenCalledWith(
        'Error verifying webhook signature',
        expect.any(Object)
      );
    });

    it('should log successful signature verification in debug mode', () => {
      const body = JSON.stringify(req.body);
      const validSignature = createSignature(body, mockConfig.webhook.secret, 'sha256');
      
      (req.get as jest.Mock).mockReturnValue(validSignature);

      webhookAuth(req as Request, res as Response, next);

      expect(logger.debug).toHaveBeenCalledWith(
        'Webhook signature verified successfully',
        {
          path: '/webhook/jenkins',
          signatureType: 'GitHub-style'
        }
      );
    });

    it('should log signature type correctly for Jenkins-style signatures', () => {
      const body = JSON.stringify(req.body);
      const hmac = crypto.createHmac('sha256', mockConfig.webhook.secret);
      hmac.update(body, 'utf8');
      const validSignature = hmac.digest('hex'); // Raw signature, no prefix
      
      (req.get as jest.Mock).mockReturnValue(validSignature);

      webhookAuth(req as Request, res as Response, next);

      expect(logger.debug).toHaveBeenCalledWith(
        'Webhook signature verified successfully',
        {
          path: '/webhook/jenkins',
          signatureType: 'Jenkins-style'
        }
      );
    });

    it('should log warning for authentication failures', () => {
      const invalidSignature = 'sha256=invalid-signature';
      (req.get as jest.Mock).mockReturnValue(invalidSignature);

      webhookAuth(req as Request, res as Response, next);

      expect(logger.warn).toHaveBeenCalledWith(
        'Webhook authentication failed: invalid signature',
        expect.objectContaining({
          providedSignature: expect.stringContaining('sha256=inv'),
          path: '/webhook/jenkins',
          bodySize: expect.any(Number)
        })
      );
    });

    it('should handle unexpected errors during verification', () => {
      // Save original secret and set valid one
      const originalSecret = (config as any).webhook.secret;
      (config as any).webhook.secret = mockConfig.webhook.secret;
      
      // Mock crypto to throw an error
      const originalTimingSafeEqual = crypto.timingSafeEqual;
      jest.spyOn(crypto, 'timingSafeEqual').mockImplementation(() => {
        throw new Error('Crypto operation failed');
      });

      const body = JSON.stringify(req.body);
      const signature = createSignature(body, mockConfig.webhook.secret, 'sha256');
      (req.get as jest.Mock).mockReturnValue(signature);

      webhookAuth(req as Request, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(expect.any(Number));
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        error: expect.objectContaining({
          message: expect.any(String)
        })
      }));

      // Restore original function
      crypto.timingSafeEqual = originalTimingSafeEqual;
      (config as any).webhook.secret = originalSecret;
    });

    it('should use timing-safe comparison to prevent timing attacks', () => {
      // Save original secret and set valid one
      const originalSecret = (config as any).webhook.secret;
      (config as any).webhook.secret = mockConfig.webhook.secret;
      
      const timingSafeEqualSpy = jest.spyOn(crypto, 'timingSafeEqual');
      
      const body = JSON.stringify(req.body);
      const validSignature = createSignature(body, mockConfig.webhook.secret, 'sha256');
      
      (req.get as jest.Mock).mockReturnValue(validSignature);

      webhookAuth(req as Request, res as Response, next);

      expect(timingSafeEqualSpy).toHaveBeenCalled();
      
      timingSafeEqualSpy.mockRestore();
      (config as any).webhook.secret = originalSecret;
    });
  });

  describe('webhookAuthBypass', () => {
    it('should allow requests in development environment', () => {
      (config as any).app.nodeEnv = 'development';

      webhookAuthBypass(req as Request, res as Response, next);

      expect(next).toHaveBeenCalled();
      expect(logger.warn).toHaveBeenCalledWith(
        'Webhook authentication bypassed for development',
        {
          path: '/webhook/jenkins',
          environment: 'development'
        }
      );
    });

    it('should allow requests in test environment', () => {
      (config as any).app.nodeEnv = 'test';

      webhookAuthBypass(req as Request, res as Response, next);

      expect(next).toHaveBeenCalled();
      expect(logger.warn).toHaveBeenCalledWith(
        'Webhook authentication bypassed for development',
        {
          path: '/webhook/jenkins',
          environment: 'test'
        }
      );
    });

    it('should reject bypass attempts in production environment', () => {
      (config as any).app.nodeEnv = 'production';

      expect(() => {
        webhookAuthBypass(req as Request, res as Response, next);
      }).toThrow('Auth bypass not allowed in production');

      expect(next).not.toHaveBeenCalled();
      expect(logger.error).toHaveBeenCalledWith(
        'Attempted to use webhook auth bypass in production environment'
      );
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty request body', () => {
      // Save original secret and set valid one
      const originalSecret = (config as any).webhook.secret;
      (config as any).webhook.secret = mockConfig.webhook.secret;
      
      req.body = {};
      const body = JSON.stringify(req.body);
      const validSignature = createSignature(body, mockConfig.webhook.secret, 'sha256');
      
      (req.get as jest.Mock).mockReturnValue(validSignature);

      webhookAuth(req as Request, res as Response, next);

      expect(next).toHaveBeenCalled();
      
      (config as any).webhook.secret = originalSecret;
    });

    it('should handle large request body', () => {
      // Save original secret and set valid one
      const originalSecret = (config as any).webhook.secret;
      (config as any).webhook.secret = mockConfig.webhook.secret;
      
      const largeBody = { data: 'x'.repeat(10000) };
      req.body = largeBody;
      const body = JSON.stringify(req.body);
      const validSignature = createSignature(body, mockConfig.webhook.secret, 'sha256');
      
      (req.get as jest.Mock).mockReturnValue(validSignature);

      webhookAuth(req as Request, res as Response, next);

      expect(next).toHaveBeenCalled();
      
      (config as any).webhook.secret = originalSecret;
    });

    it('should handle special characters in body', () => {
      // Save original secret and set valid one
      const originalSecret = (config as any).webhook.secret;
      (config as any).webhook.secret = mockConfig.webhook.secret;
      
      const specialBody = { message: 'Hello 世界! 🚀 Special chars: àáâãäå' };
      req.body = specialBody;
      const body = JSON.stringify(req.body);
      const validSignature = createSignature(body, mockConfig.webhook.secret, 'sha256');
      
      (req.get as jest.Mock).mockReturnValue(validSignature);

      webhookAuth(req as Request, res as Response, next);

      expect(next).toHaveBeenCalled();
      
      (config as any).webhook.secret = originalSecret;
    });
  });
});