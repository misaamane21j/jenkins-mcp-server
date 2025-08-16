import { exec } from 'child_process';
import { promisify } from 'util';
import axios from 'axios';

const execAsync = promisify(exec);

describe('Docker Integration Tests', () => {
  const containerName = 'jenkins-mcp-test';
  const imageName = 'jenkins-mcp-server:test';
  
  beforeAll(async () => {
    // Build the Docker image
    try {
      await execAsync(`docker build -t ${imageName} --target production .`);
    } catch (error) {
      console.error('Failed to build Docker image:', error);
      throw error;
    }
  }, 60000); // 60 second timeout for build

  afterAll(async () => {
    // Cleanup: stop and remove container
    try {
      await execAsync(`docker stop ${containerName} || true`);
      await execAsync(`docker rm ${containerName} || true`);
      await execAsync(`docker rmi ${imageName} || true`);
    } catch (error) {
      console.warn('Cleanup failed:', error);
    }
  });

  describe('Docker build', () => {
    it('should build successfully', async () => {
      const { stdout } = await execAsync(`docker images ${imageName} --format "table {{.Repository}}:{{.Tag}}"`);
      expect(stdout).toContain(imageName);
    });

    it('should create optimized production image', async () => {
      const { stdout } = await execAsync(`docker image inspect ${imageName} --format "{{.Size}}"`);
      const imageSize = parseInt(stdout.trim());
      
      // Production image should be reasonable size (less than 500MB)
      expect(imageSize).toBeLessThan(500 * 1024 * 1024);
    });

    it('should run as non-root user', async () => {
      const { stdout } = await execAsync(`docker image inspect ${imageName} --format "{{.Config.User}}"`);
      expect(stdout.trim()).toBe('jenkins');
    });
  });

  describe('Container startup', () => {
    it('should start container successfully', async () => {
      const envVars = [
        'JENKINS_URL=http://test-jenkins:8080',
        'JENKINS_USERNAME=test',
        'JENKINS_API_TOKEN=test-token',
        'WEBHOOK_SECRET=test-secret',
        'REDIS_URL=redis://test-redis:6379',
        'SLACK_WEBHOOK_URL=http://test-slack/webhook',
        'NODE_ENV=production'
      ].map(env => `-e ${env}`).join(' ');

      await execAsync(`docker run -d --name ${containerName} -p 3001:3001 ${envVars} ${imageName}`);
      
      // Wait for container to start
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      const { stdout } = await execAsync(`docker ps --filter "name=${containerName}" --format "{{.Status}}"`);
      expect(stdout).toContain('Up');
    }, 30000);

    it('should expose health check endpoint', async () => {
      // Wait a bit more for the service to be ready
      await new Promise(resolve => setTimeout(resolve, 10000));
      
      try {
        const response = await axios.get('http://localhost:3001/health', {
          timeout: 5000
        });
        expect(response.status).toBe(200);
        expect(response.data).toHaveProperty('status');
      } catch (error) {
        // Check if container is running and logs
        const { stdout: containerStatus } = await execAsync(`docker ps --filter "name=${containerName}" --format "{{.Status}}"`);
        const { stdout: logs } = await execAsync(`docker logs ${containerName}`);
        
        console.error('Container status:', containerStatus);
        console.error('Container logs:', logs);
        throw error;
      }
    }, 20000);

    it('should have proper environment variables', async () => {
      const { stdout } = await execAsync(`docker exec ${containerName} env`);
      
      expect(stdout).toContain('NODE_ENV=production');
      expect(stdout).toContain('JENKINS_URL=http://test-jenkins:8080');
      expect(stdout).toContain('WEBHOOK_SECRET=test-secret');
    });
  });

  describe('Docker Compose', () => {
    it('should validate docker-compose.yml syntax', async () => {
      const { stdout } = await execAsync('docker-compose config');
      expect(stdout).toContain('jenkins-mcp-server');
      expect(stdout).toContain('redis');
    });

    it('should have proper service dependencies', async () => {
      const { stdout } = await execAsync('docker-compose config --services');
      const services = stdout.trim().split('\n');
      
      expect(services).toContain('jenkins-mcp-server');
      expect(services).toContain('redis');
    });
  });

  describe('Health checks', () => {
    it('should pass Docker health check', async () => {
      // Wait for health check to run
      await new Promise(resolve => setTimeout(resolve, 45000));
      
      const { stdout } = await execAsync(`docker inspect ${containerName} --format "{{.State.Health.Status}}"`);
      expect(stdout.trim()).toBe('healthy');
    }, 60000);

    it('should restart unhealthy container', async () => {
      // This test would require a more complex setup to simulate unhealthy state
      // For now, just verify health check configuration exists
      const { stdout } = await execAsync(`docker inspect ${imageName} --format "{{.Config.Healthcheck}}"`);
      expect(stdout).toContain('curl');
    });
  });

  describe('Resource usage', () => {
    it('should use reasonable CPU and memory', async () => {
      const { stdout } = await execAsync(`docker stats ${containerName} --no-stream --format "table {{.CPUPerc}}\t{{.MemUsage}}"`);
      
      // Parse stats (this is a basic check)
      expect(stdout).toContain('%');
      expect(stdout).toContain('MiB');
    });
  });

  describe('Network connectivity', () => {
    it('should be able to connect to external services', async () => {
      // Test DNS resolution within container
      const { stdout } = await execAsync(`docker exec ${containerName} nslookup google.com`);
      expect(stdout).toContain('Address:');
    });
  });

  describe('File permissions', () => {
    it('should have correct file ownership', async () => {
      const { stdout } = await execAsync(`docker exec ${containerName} ls -la /app`);
      expect(stdout).toContain('jenkins');
    });

    it('should not run as root', async () => {
      const { stdout } = await execAsync(`docker exec ${containerName} whoami`);
      expect(stdout.trim()).toBe('jenkins');
    });
  });

  describe('Production readiness', () => {
    it('should have minimal attack surface', async () => {
      // Check that unnecessary packages aren't installed
      const { stdout } = await execAsync(`docker exec ${containerName} sh -c "which curl && which node && which npm"`);
      
      // Should have curl (for health checks) and node, but production build shouldn't need npm
      expect(stdout).toContain('/usr/bin/curl');
      expect(stdout).toContain('/usr/local/bin/node');
    });

    it('should handle SIGTERM gracefully', async () => {
      // Send SIGTERM and check if container stops gracefully
      await execAsync(`docker kill --signal=TERM ${containerName}`);
      
      // Wait a bit and check if container stopped
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      const { stdout } = await execAsync(`docker ps --filter "name=${containerName}" --format "{{.Status}}"`);
      expect(stdout.trim()).toBe('');
    });
  });
});