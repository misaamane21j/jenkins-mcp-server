# Jenkins Setup Guide

This guide provides comprehensive instructions for setting up Jenkins to work with the Jenkins MCP Server.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Jenkins Configuration](#jenkins-configuration)
3. [Authentication Setup](#authentication-setup)
4. [Webhook Configuration](#webhook-configuration)
5. [Required Plugins](#required-plugins)
6. [Job Parameter Documentation](#job-parameter-documentation)
7. [Environment Variables](#environment-variables)
8. [Testing the Setup](#testing-the-setup)
9. [Troubleshooting](#troubleshooting)

## Prerequisites

- Jenkins server running version 2.400+ (LTS recommended)
- Administrator access to Jenkins
- Network connectivity between MCP server and Jenkins
- Node.js environment for running the MCP server

## Jenkins Configuration

### Basic Jenkins Settings

1. **Enable CSRF Protection**: Navigate to `Manage Jenkins > Configure Global Security`
   - Ensure "Prevent Cross Site Request Forgery exploits" is enabled
   - This allows the MCP server to obtain CSRF crumbs for API requests

2. **API Access**: Ensure Jenkins API is enabled
   - Go to `Manage Jenkins > Configure Global Security`
   - Under "Authorization", ensure your authentication method allows API access

### User Account Setup

Create or configure a Jenkins user account for the MCP server:

1. Navigate to `Manage Jenkins > Manage Users`
2. Create a new user or use an existing service account
3. Grant appropriate permissions (see [Authentication Setup](#authentication-setup))

## Authentication Setup

The MCP server supports two authentication methods:

### Method 1: API Token (Recommended)

1. **Generate API Token**:
   - Log in as the Jenkins user
   - Go to `Your Profile > Configure`
   - Under "API Token", click "Add new Token"
   - Provide a descriptive name (e.g., "MCP Server Token")
   - Copy the generated token securely

2. **Environment Configuration**:
   ```bash
   JENKINS_URL=https://your-jenkins-server.com
   JENKINS_USERNAME=mcp-service-user
   JENKINS_API_TOKEN=your-generated-api-token
   ```

### Method 2: Username/Password

1. **Environment Configuration**:
   ```bash
   JENKINS_URL=https://your-jenkins-server.com
   JENKINS_USERNAME=mcp-service-user
   JENKINS_PASSWORD=your-password
   ```

> **Security Note**: API tokens are preferred over passwords as they can be easily revoked and have specific scopes.

### Required Permissions

The Jenkins user needs the following permissions:

- **Overall**: Read
- **Job**: Build, Cancel, Discover, Read, Workspace
- **View**: Read
- **Run**: Replay, Update

For pipelines and advanced features:
- **SCM**: Tag
- **Credentials**: View (if accessing credential-bound parameters)

## Webhook Configuration

Configure Jenkins to send build completion notifications to the MCP server:

### Install Notification Plugin

1. Go to `Manage Jenkins > Manage Plugins`
2. Install the "Notification Plugin" if not already installed
3. Restart Jenkins if required

### Configure Job Notifications

For each job that should send notifications:

1. **Job Configuration**:
   - Open the job configuration
   - Scroll to "Post-build Actions"
   - Add "Job Notifications"

2. **Notification Settings**:
   - **Format**: JSON
   - **Protocol**: HTTP
   - **Event**: Job Completed
   - **URL**: `http://your-mcp-server:3001/webhook/jenkins`
   - **Timeout**: 30000 (30 seconds)

3. **Authentication** (if webhook secret is configured):
   - Add custom header: `X-Jenkins-Signature`
   - Value: `your-webhook-secret`

### Alternative: Global Notification Configuration

Configure notifications globally for all jobs:

1. Navigate to `Manage Jenkins > Configure System`
2. Find "Global Notifications" section
3. Add endpoint configuration:
   - **URL**: `http://your-mcp-server:3001/webhook/jenkins`
   - **Format**: JSON
   - **Events**: Job Started, Job Completed, Job Finalized

## Required Plugins

Install these Jenkins plugins for full MCP server functionality:

### Essential Plugins

1. **Build Timeout Plugin**: Prevents jobs from running indefinitely
2. **Timestamper Plugin**: Adds timestamps to console output
3. **Workspace Cleanup Plugin**: Manages workspace cleanup
4. **Notification Plugin**: Sends build notifications to external systems

### Recommended Plugins

1. **Pipeline Plugin**: For pipeline job support
2. **Git Plugin**: For Git repository integration
3. **Credentials Plugin**: For secure credential management
4. **Build User Vars Plugin**: Provides user information in builds
5. **Parameterized Trigger Plugin**: For complex job triggering scenarios

### Installation Steps

1. Navigate to `Manage Jenkins > Manage Plugins`
2. Go to "Available" tab
3. Search for each plugin by name
4. Select plugins and click "Install without restart"
5. Restart Jenkins when safe to do so

## Job Parameter Documentation

The MCP server can work with various Jenkins job parameter types:

### Supported Parameter Types

1. **String Parameter**:
   ```xml
   <hudson.model.StringParameterDefinition>
     <name>ENVIRONMENT</name>
     <description>Target environment for deployment</description>
     <defaultValue>staging</defaultValue>
   </hudson.model.StringParameterDefinition>
   ```

2. **Boolean Parameter**:
   ```xml
   <hudson.model.BooleanParameterDefinition>
     <name>SKIP_TESTS</name>
     <description>Skip test execution</description>
     <defaultValue>false</defaultValue>
   </hudson.model.BooleanParameterDefinition>
   ```

3. **Choice Parameter**:
   ```xml
   <hudson.model.ChoiceParameterDefinition>
     <name>BUILD_TYPE</name>
     <description>Type of build to execute</description>
     <choices>
       <string>release</string>
       <string>snapshot</string>
       <string>debug</string>
     </choices>
   </hudson.model.ChoiceParameterDefinition>
   ```

4. **File Parameter**:
   ```xml
   <hudson.model.FileParameterDefinition>
     <name>CONFIG_FILE</name>
     <description>Configuration file to upload</description>
   </hudson.model.FileParameterDefinition>
   ```

### Best Practices for Parameters

- **Use descriptive names**: Parameter names should be clear and self-explanatory
- **Provide descriptions**: Always include meaningful descriptions for parameters
- **Set sensible defaults**: Provide default values where appropriate
- **Validate inputs**: Use parameter validation where possible
- **Group related parameters**: Organize parameters logically in job configuration

## Environment Variables

Configure the following environment variables for the MCP server:

### Required Variables

```bash
# Jenkins Connection
JENKINS_URL=https://your-jenkins-server.com
JENKINS_USERNAME=mcp-service-user

# Authentication (choose one)
JENKINS_API_TOKEN=your-api-token
# OR
JENKINS_PASSWORD=your-password

# Webhook Configuration
WEBHOOK_PORT=3001
WEBHOOK_SECRET=your-webhook-secret

# MCP Server Configuration
MCP_SERVER_NAME=jenkins-mcp-server
MCP_SERVER_VERSION=1.0.0
```

### Optional Variables

```bash
# Logging
LOG_LEVEL=info
NODE_ENV=production

# Redis (for job tracking)
REDIS_URL=redis://localhost:6379

# Slack Notifications
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/...
```

### Environment File Example

Create a `.env` file in your project root:

```bash
# .env
JENKINS_URL=https://jenkins.company.com
JENKINS_USERNAME=mcp-automation
JENKINS_API_TOKEN=11234567890abcdef1234567890abcdef12
WEBHOOK_PORT=3001
WEBHOOK_SECRET=super-secret-webhook-key
MCP_SERVER_NAME=jenkins-mcp-server
MCP_SERVER_VERSION=1.0.0
LOG_LEVEL=info
NODE_ENV=production
REDIS_URL=redis://localhost:6379
```

## Testing the Setup

### 1. Test Jenkins Connection

Use the MCP server's built-in connection test:

```javascript
import { JenkinsConfiguration } from './src/config/jenkins';

const config = JenkinsConfiguration.getInstance();
const isConnected = await config.testConnection();
console.log('Connection successful:', isConnected);
```

### 2. Test API Authentication

Try listing jobs using the MCP tools:

```bash
# Using MCP client
mcp call list-jobs --filter="" --include-disabled=false
```

### 3. Test Job Triggering

Trigger a simple job to verify functionality:

```bash
# Using MCP client
mcp call trigger-job --job-name="test-job" --parameters="{}"
```

### 4. Test Webhook Delivery

1. Configure a test job with notifications
2. Trigger the job manually
3. Check MCP server logs for webhook receipt
4. Verify job status updates in MCP server

## Troubleshooting

### Common Issues

#### 1. Authentication Failures

**Symptoms**: 401 Unauthorized errors when calling Jenkins API

**Solutions**:
- Verify `JENKINS_USERNAME` is correct
- Check API token is valid and not expired
- Ensure user has required permissions
- Test authentication with curl:
  ```bash
  curl -u username:api-token https://your-jenkins-server.com/api/json
  ```

#### 2. CSRF Protection Errors

**Symptoms**: 403 Forbidden errors with CSRF protection messages

**Solutions**:
- Ensure `crumbIssuer: true` in Jenkins configuration
- Verify CSRF protection is properly configured in Jenkins
- Check the MCP server is requesting CSRF tokens correctly

#### 3. Webhook Not Received

**Symptoms**: Job completions not triggering MCP server updates

**Solutions**:
- Verify notification plugin is installed and configured
- Check webhook URL is accessible from Jenkins server
- Verify webhook port is open and MCP server is listening
- Check Jenkins system logs for webhook delivery errors

#### 4. Parameter Parsing Issues

**Symptoms**: Job parameters not recognized or parsed incorrectly

**Solutions**:
- Verify job has parameters configured
- Check parameter names and types in job configuration
- Test parameter parsing with a simple string parameter first
- Review MCP server logs for parsing errors

#### 5. Network Connectivity

**Symptoms**: Connection timeouts or network errors

**Solutions**:
- Verify Jenkins URL is accessible from MCP server host
- Check firewall rules allow connections on Jenkins port
- Test connectivity with telnet or curl
- Verify SSL certificates if using HTTPS

### Debug Mode

Enable debug logging for detailed troubleshooting:

```bash
LOG_LEVEL=debug node src/index.js
```

### Log Analysis

Check these log files for issues:

- **MCP Server Logs**: Application logs with connection and API call details
- **Jenkins System Logs**: `Manage Jenkins > System Log`
- **Job Console Outputs**: Individual job build logs
- **Webhook Delivery Logs**: Jenkins notification plugin logs

### Support Resources

- **Jenkins Documentation**: https://www.jenkins.io/doc/
- **Jenkins API Documentation**: https://www.jenkins.io/doc/book/using/remote-access-api/
- **MCP Server Issues**: Check project repository for known issues
- **Community Support**: Jenkins community forums and Slack channels

## Security Considerations

### API Token Security

- Store API tokens securely (environment variables, secret management)
- Rotate API tokens regularly
- Use dedicated service accounts with minimal required permissions
- Monitor API token usage and revoke unused tokens

### Network Security

- Use HTTPS for Jenkins connections when possible
- Implement proper firewall rules
- Consider VPN or private network connections for production
- Validate webhook signatures to prevent unauthorized requests

### Webhook Security

- Use webhook secrets to validate incoming requests
- Implement proper request validation and sanitization
- Monitor webhook endpoints for unusual activity
- Consider IP allowlisting for webhook sources

---

For additional support or questions, please refer to the project documentation or create an issue in the project repository.