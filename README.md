# Jenkins MCP Server

A Model Context Protocol (MCP) server that provides seamless integration with Jenkins CI/CD pipelines. This server enables Claude and other MCP-compatible clients to interact with Jenkins jobs, monitor build status, and receive real-time notifications.

## 🚀 Features

- **Jenkins Job Management**: List, trigger, and monitor Jenkins jobs
- **Real-time Status Updates**: Webhook-based job status notifications
- **Redis Job Tracking**: Persistent job state tracking and caching
- **Slack Integration**: Automated build notifications to Slack channels
- **MCP Tools**: Four comprehensive tools for Jenkins interaction
- **Docker Support**: Full containerization with Docker Compose
- **Comprehensive Testing**: Unit and integration tests with 80%+ coverage

## 📋 Prerequisites

- Node.js 20+ 
- Jenkins server with API access
- Redis server
- Docker (optional, for containerized deployment)

## 🛠️ Installation

### Local Development

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd jenkins-mcp-server
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment**
   ```bash
   cp .env.example .env
   # Edit .env with your Jenkins and Redis configuration
   ```

4. **Build the project**
   ```bash
   npm run build
   ```

### Docker Deployment

1. **Using Docker Compose (Recommended)**
   ```bash
   # Copy and configure environment
   cp .env.example .env
   
   # Start services
   docker-compose up -d
   ```

2. **Manual Docker Build**
   ```bash
   # Build image
   docker build -t jenkins-mcp-server .
   
   # Run container
   docker run -d \
     --name jenkins-mcp-server \
     -p 3001:3001 \
     --env-file .env \
     jenkins-mcp-server
   ```

## ⚙️ Configuration

### Environment Variables

| Variable | Description | Required | Default |
|----------|-------------|----------|---------|
| `JENKINS_URL` | Jenkins server URL | ✅ | - |
| `JENKINS_USERNAME` | Jenkins username | ✅ | - |
| `JENKINS_PASSWORD` | Jenkins password | ✅* | - |
| `JENKINS_API_TOKEN` | Jenkins API token | ✅* | - |
| `WEBHOOK_SECRET` | Webhook authentication secret | ✅ | - |
| `WEBHOOK_PORT` | Webhook server port | ❌ | `3001` |
| `REDIS_URL` | Redis connection URL | ❌ | `redis://localhost:6379` |
| `SLACK_WEBHOOK_URL` | Slack webhook for notifications | ❌ | - |
| `NODE_ENV` | Node environment | ❌ | `development` |
| `LOG_LEVEL` | Logging level | ❌ | `info` |

*Either `JENKINS_PASSWORD` or `JENKINS_API_TOKEN` is required

### Jenkins Setup

1. **Create API Token**
   - Go to Jenkins → People → [Your User] → Configure
   - Add new API token
   - Use this token in `JENKINS_API_TOKEN`

2. **Configure Webhooks**
   - Install "Notification Plugin" in Jenkins
   - Configure job notifications to POST to:
     ```
     http://your-server:3001/webhook
     ```

3. **Required Jenkins Permissions**
   - Job/Read
   - Job/Build  
   - Job/Configure (for parameter discovery)

## 🔧 Usage

### MCP Client Integration

Add to your MCP client configuration:

```json
{
  "mcpServers": {
    "jenkins": {
      "command": "node",
      "args": ["/path/to/jenkins-mcp-server/dist/index.js"],
      "env": {
        "JENKINS_URL": "http://jenkins.example.com:8080",
        "JENKINS_USERNAME": "your-username",
        "JENKINS_API_TOKEN": "your-api-token",
        "WEBHOOK_SECRET": "your-webhook-secret",
        "REDIS_URL": "redis://localhost:6379"
      }
    }
  }
}
```

### Available MCP Tools

#### 1. `list_jenkins_jobs`
Lists all Jenkins jobs with their current status.

```javascript
// Parameters: none
// Returns: Array of job objects with name, URL, status, and last build info
```

#### 2. `trigger_jenkins_job`
Triggers a Jenkins job with optional parameters.

```javascript
// Parameters:
{
  "jobName": "my-build-job",           // Required
  "parameters": {                      // Optional
    "BRANCH": "feature/new-feature",
    "DEPLOY": true
  }
}
```

#### 3. `get_job_status`
Gets the status of a specific Jenkins job build.

```javascript
// Parameters:
{
  "jobName": "my-build-job",    // Required
  "buildNumber": 42             // Optional (defaults to latest)
}
```

#### 4. `get_job_parameters`
Gets the parameter definitions for a Jenkins job.

```javascript
// Parameters:
{
  "jobName": "my-build-job"     // Required
}
```

### API Endpoints

#### Health Check
```bash
GET /health
# Returns: {"status": "healthy", "timestamp": "..."}
```

#### Webhook Endpoint
```bash
POST /webhook
# Headers: X-Jenkins-Signature: sha256=<signature>
# Body: Jenkins notification payload
```

## 🧪 Testing

### Run All Tests
```bash
npm test
```

### Test Categories
```bash
# Unit tests only
npm run test:unit

# Integration tests only  
npm run test:integration

# With coverage report
npm run test:coverage

# Docker integration tests
npm run test:docker

# Watch mode for development
npm run test:watch
```

### Test Structure
```
tests/
├── unit/                    # Unit tests with mocks
│   ├── config/             # Configuration tests
│   ├── middleware/         # Middleware tests  
│   ├── server/             # MCP server tests
│   ├── services/           # Service layer tests
│   └── utils/              # Utility tests
├── integration/            # Integration tests
│   ├── mcp-jenkins-integration.test.ts
│   ├── webhook-integration.test.ts
│   └── docker-integration.test.ts
├── fixtures/               # Test data and mocks
└── setup.ts               # Test configuration
```

## 🔍 Development

### Development Commands
```bash
# Start development server
npm run dev

# Type checking
npm run typecheck

# Linting
npm run lint
npm run lint:fix

# Docker development
npm run docker:build
npm run docker:run
npm run docker:stop
npm run docker:logs
```

### Project Structure
```
src/
├── config/                 # Configuration management
├── middleware/             # Express middleware
├── server/                 # MCP server implementation
│   └── tools/             # MCP tool implementations
├── services/               # Business logic services
├── types/                  # TypeScript type definitions
└── utils/                  # Utility functions
```

## 📊 Monitoring

### Logging
The server uses Winston for structured logging:

- **Development**: Console output with colorization
- **Production**: JSON format for log aggregation
- **Levels**: error, warn, info, debug

### Health Checks
- HTTP endpoint: `GET /health`
- Docker health check: Built-in container monitoring
- Redis connectivity: Automatic reconnection with circuit breaker

### Metrics
Job tracking provides metrics for:
- Build success/failure rates
- Build duration trends  
- Job trigger frequency
- System performance

## 🔒 Security

### Authentication
- Jenkins API token or username/password authentication
- Webhook signature verification using HMAC-SHA256
- Environment-based secret management

### Network Security  
- HTTPS support for external communications
- Redis AUTH support
- Container isolation in Docker deployment

### Input Validation
- Joi schema validation for all inputs
- Parameter sanitization for Jenkins API calls
- XSS protection for webhook payloads

## 🐳 Docker

### Images
- **Development**: Includes dev dependencies and source watching
- **Production**: Optimized multi-stage build, non-root user

### Docker Compose Services
- `jenkins-mcp-server`: Main application
- `jenkins-mcp-server-dev`: Development version  
- `redis`: Job tracking database

### Health Checks
- Application health endpoint monitoring
- Redis connectivity verification
- Automatic container restart on failure

## 📚 Documentation

- [MCP Tools Reference](docs/MCP-TOOLS.md) - Detailed tool documentation
- [Jenkins Setup Guide](docs/JENKINS-SETUP.md) - Jenkins configuration
- [Security Analysis](docs/SECURITY-ANALYSIS.md) - Security considerations

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Write tests for new functionality
4. Ensure all tests pass and coverage requirements are met
5. Submit a pull request

### Development Guidelines
- Follow TypeScript best practices
- Maintain 80%+ test coverage
- Use conventional commit messages
- Update documentation for new features

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

## 🆘 Troubleshooting

### Common Issues

**Jenkins Connection Failed**
```bash
# Check Jenkins URL and credentials
curl -u username:token http://jenkins.example.com:8080/api/json

# Verify network connectivity
npm run test:integration
```

**Redis Connection Issues**
```bash
# Check Redis connectivity
redis-cli -u redis://localhost:6379 ping

# Verify Redis configuration
docker-compose logs redis
```

**Webhook Not Receiving Events**
```bash
# Check webhook endpoint
curl -X POST http://localhost:3001/webhook \
  -H "Content-Type: application/json" \
  -d '{"test": "payload"}'

# Verify Jenkins notification plugin configuration
```

**Docker Build Failures**
```bash
# Clear Docker cache
docker system prune -f

# Rebuild with no cache
docker build --no-cache -t jenkins-mcp-server .
```

### Getting Help

- Check the [Issues](../../issues) page for known problems
- Review logs with `npm run docker:logs`
- Run diagnostics with `npm run test:integration`

## 🏗️ Architecture

The Jenkins MCP Server follows a layered architecture:

1. **MCP Layer**: Protocol implementation and tool registration
2. **Service Layer**: Business logic for Jenkins integration  
3. **Infrastructure Layer**: Redis, HTTP server, and external APIs
4. **Configuration Layer**: Environment and validation management

This design ensures separation of concerns, testability, and maintainability while providing a robust integration platform for Jenkins automation.