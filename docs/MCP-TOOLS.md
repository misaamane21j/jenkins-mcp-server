# MCP Tools Reference

This document provides detailed information about all MCP tools available in the Jenkins MCP Server.

## Overview

The Jenkins MCP Server provides four main tools for interacting with Jenkins CI/CD pipelines:

1. `list_jenkins_jobs` - List all Jenkins jobs
2. `trigger_jenkins_job` - Trigger a job with parameters
3. `get_job_status` - Get build status information
4. `get_job_parameters` - Get job parameter definitions

## Tool Definitions

### 1. list_jenkins_jobs

**Description**: Lists all Jenkins jobs with their current status and build information.

**Schema**:
```json
{
  "name": "list_jenkins_jobs",
  "description": "List all Jenkins jobs with their current status",
  "inputSchema": {
    "type": "object",
    "properties": {},
    "additionalProperties": false
  }
}
```

**Parameters**: None

**Response Format**:
```json
{
  "content": [
    {
      "type": "text",
      "text": "[{\"name\":\"build-frontend\",\"url\":\"http://jenkins.example.com/job/build-frontend/\",\"status\":\"SUCCESS\",\"lastBuild\":42,\"color\":\"blue\",\"buildable\":true},{\"name\":\"deploy-staging\",\"url\":\"http://jenkins.example.com/job/deploy-staging/\",\"status\":\"FAILURE\",\"lastBuild\":15,\"color\":\"red\",\"buildable\":true}]"
    }
  ]
}
```

**Example Usage**:
```javascript
// MCP Request
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "list_jenkins_jobs"
  }
}
```

**Response Fields**:
- `name`: Job name
- `url`: Jenkins job URL
- `status`: Last build status (SUCCESS, FAILURE, UNSTABLE, ABORTED)
- `lastBuild`: Last build number
- `color`: Jenkins color indicator
- `buildable`: Whether the job can be triggered

---

### 2. trigger_jenkins_job

**Description**: Triggers a Jenkins job with optional build parameters.

**Schema**:
```json
{
  "name": "trigger_jenkins_job",
  "description": "Trigger a Jenkins job with optional parameters",
  "inputSchema": {
    "type": "object",
    "properties": {
      "jobName": {
        "type": "string",
        "description": "Name of the Jenkins job to trigger"
      },
      "parameters": {
        "type": "object",
        "description": "Build parameters for the job",
        "additionalProperties": true
      }
    },
    "required": ["jobName"],
    "additionalProperties": false
  }
}
```

**Parameters**:
- `jobName` (required): Name of the Jenkins job to trigger
- `parameters` (optional): Object containing build parameters

**Response Format**:
```json
{
  "content": [
    {
      "type": "text", 
      "text": "{\"message\":\"Job triggered successfully\",\"jobName\":\"build-frontend\",\"queueId\":123,\"buildUrl\":\"http://jenkins.example.com/job/build-frontend/43/\"}"
    }
  ]
}
```

**Example Usage**:
```javascript
// MCP Request - Simple trigger
{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "tools/call",
  "params": {
    "name": "trigger_jenkins_job",
    "arguments": {
      "jobName": "build-frontend"
    }
  }
}

// MCP Request - With parameters
{
  "jsonrpc": "2.0", 
  "id": 3,
  "method": "tools/call",
  "params": {
    "name": "trigger_jenkins_job",
    "arguments": {
      "jobName": "deploy-staging",
      "parameters": {
        "ENVIRONMENT": "staging",
        "VERSION": "v1.2.3",
        "DEPLOY_DB": true,
        "NOTIFY_SLACK": false
      }
    }
  }
}
```

**Response Fields**:
- `message`: Success/failure message
- `jobName`: Name of the triggered job
- `queueId`: Jenkins queue ID for the build
- `buildUrl`: URL to the triggered build (when available)

**Common Parameters**:
- String parameters: `"BRANCH": "main"`, `"VERSION": "v1.0.0"`
- Boolean parameters: `"DEPLOY": true`, `"SKIP_TESTS": false`
- Choice parameters: `"ENVIRONMENT": "production"`

---

### 3. get_job_status

**Description**: Gets the status and details of a specific Jenkins job build.

**Schema**:
```json
{
  "name": "get_job_status",
  "description": "Get the status of a specific Jenkins job build",
  "inputSchema": {
    "type": "object",
    "properties": {
      "jobName": {
        "type": "string",
        "description": "Name of the Jenkins job"
      },
      "buildNumber": {
        "type": "number",
        "description": "Build number to check (optional, defaults to latest)"
      }
    },
    "required": ["jobName"],
    "additionalProperties": false
  }
}
```

**Parameters**:
- `jobName` (required): Name of the Jenkins job
- `buildNumber` (optional): Specific build number (defaults to latest build)

**Response Format**:
```json
{
  "content": [
    {
      "type": "text",
      "text": "{\"jobName\":\"build-frontend\",\"buildNumber\":42,\"status\":\"SUCCESS\",\"result\":\"SUCCESS\",\"building\":false,\"duration\":125000,\"timestamp\":1640995200000,\"url\":\"http://jenkins.example.com/job/build-frontend/42/\",\"description\":\"Built from main branch\",\"builtOn\":\"jenkins-agent-1\"}"
    }
  ]
}
```

**Example Usage**:
```javascript
// MCP Request - Latest build
{
  "jsonrpc": "2.0",
  "id": 4,
  "method": "tools/call",
  "params": {
    "name": "get_job_status",
    "arguments": {
      "jobName": "build-frontend"
    }
  }
}

// MCP Request - Specific build
{
  "jsonrpc": "2.0",
  "id": 5,
  "method": "tools/call",
  "params": {
    "name": "get_job_status",
    "arguments": {
      "jobName": "build-frontend",
      "buildNumber": 40
    }
  }
}
```

**Response Fields**:
- `jobName`: Name of the job
- `buildNumber`: Build number
- `status`: Current build status
- `result`: Final build result (SUCCESS, FAILURE, UNSTABLE, ABORTED)
- `building`: Whether the build is currently running
- `duration`: Build duration in milliseconds
- `timestamp`: Build start timestamp
- `url`: Jenkins build URL
- `description`: Build description
- `builtOn`: Jenkins node/agent name

**Status Values**:
- `SUCCESS`: Build completed successfully
- `FAILURE`: Build failed
- `UNSTABLE`: Build completed with test failures or warnings
- `ABORTED`: Build was cancelled
- `IN_PROGRESS`: Build is currently running

---

### 4. get_job_parameters

**Description**: Gets the parameter definitions for a Jenkins job, showing what parameters are available for triggering.

**Schema**:
```json
{
  "name": "get_job_parameters",
  "description": "Get the parameters definition for a Jenkins job",
  "inputSchema": {
    "type": "object",
    "properties": {
      "jobName": {
        "type": "string",
        "description": "Name of the Jenkins job"
      }
    },
    "required": ["jobName"],
    "additionalProperties": false
  }
}
```

**Parameters**:
- `jobName` (required): Name of the Jenkins job

**Response Format**:
```json
{
  "content": [
    {
      "type": "text",
      "text": "{\"jobName\":\"deploy-staging\",\"parameters\":[{\"name\":\"ENVIRONMENT\",\"type\":\"choice\",\"description\":\"Target environment\",\"defaultValue\":\"staging\",\"choices\":[\"staging\",\"production\"]},{\"name\":\"VERSION\",\"type\":\"string\",\"description\":\"Version to deploy\",\"defaultValue\":\"latest\"},{\"name\":\"NOTIFY_SLACK\",\"type\":\"boolean\",\"description\":\"Send Slack notification\",\"defaultValue\":true}]}"
    }
  ]
}
```

**Example Usage**:
```javascript
// MCP Request
{
  "jsonrpc": "2.0",
  "id": 6,
  "method": "tools/call",
  "params": {
    "name": "get_job_parameters",
    "arguments": {
      "jobName": "deploy-staging"
    }
  }
}
```

**Response Fields**:
- `jobName`: Name of the job
- `parameters`: Array of parameter definitions

**Parameter Definition Fields**:
- `name`: Parameter name
- `type`: Parameter type (string, boolean, choice, text, password)
- `description`: Parameter description
- `defaultValue`: Default value
- `choices`: Available choices (for choice parameters)

**Parameter Types**:
- `string`: Simple string input
- `boolean`: True/false checkbox
- `choice`: Dropdown with predefined options
- `text`: Multi-line text input
- `password`: Masked string input
- `file`: File upload parameter

## Error Handling

All tools return standardized error responses when operations fail:

```json
{
  "error": {
    "code": -32602,
    "message": "Failed to trigger Jenkins job",
    "data": {
      "details": "Job 'non-existent-job' not found",
      "jobName": "non-existent-job"
    }
  }
}
```

**Common Error Codes**:
- `-32602`: Invalid params (missing required parameters)
- `-32603`: Internal error (Jenkins API failures, network issues)
- `-32601`: Method not found (invalid tool name)

**Error Data Fields**:
- `details`: Human-readable error description
- `jobName`: Job name when applicable
- `buildNumber`: Build number when applicable

## Rate Limiting

The Jenkins MCP Server implements rate limiting to prevent API abuse:

- **Default Limit**: 100 requests per minute per tool
- **Burst Allowance**: Up to 10 requests in 10 seconds
- **Backoff Strategy**: Exponential backoff on rate limit errors

Rate limit information is included in Redis for monitoring and debugging.

## Caching Strategy

To improve performance and reduce Jenkins API load:

- **Job List**: Cached for 30 seconds
- **Job Status**: Cached for 10 seconds
- **Job Parameters**: Cached for 5 minutes (rarely change)
- **Build Results**: Cached permanently (immutable)

Cache keys include job names and build numbers for proper invalidation.

## Authentication

All tools require valid Jenkins authentication:

1. **API Token** (recommended): Set `JENKINS_API_TOKEN`
2. **Username/Password**: Set `JENKINS_USERNAME` and `JENKINS_PASSWORD`

The server validates authentication on startup and periodically checks connectivity.

## Webhook Integration

The MCP tools work in conjunction with Jenkins webhooks for real-time updates:

1. Jenkins sends webhook notifications on build events
2. Server updates Redis cache with latest status
3. Subsequent MCP tool calls return cached data for improved performance

Configure Jenkins webhook URL: `http://your-server:3001/webhook`

## Best Practices

### Tool Usage
- Use `list_jenkins_jobs` to discover available jobs
- Check `get_job_parameters` before triggering parameterized jobs
- Monitor builds with `get_job_status` after triggering
- Implement proper error handling for all tool calls

### Performance
- Cache job lists locally when possible
- Use webhook notifications instead of polling for status updates
- Batch multiple job operations when feasible
- Implement exponential backoff for failed requests

### Security
- Use API tokens instead of passwords
- Restrict Jenkins user permissions to minimum required
- Validate all parameters before sending to Jenkins
- Log security events for monitoring

## Examples

### Complete Deployment Workflow

```javascript
// 1. List available jobs
const jobsResponse = await mcpClient.callTool("list_jenkins_jobs", {});
const jobs = JSON.parse(jobsResponse.content[0].text);

// 2. Find deployment job
const deployJob = jobs.find(job => job.name === "deploy-production");

// 3. Get parameters for the job
const paramsResponse = await mcpClient.callTool("get_job_parameters", {
  jobName: "deploy-production"
});
const { parameters } = JSON.parse(paramsResponse.content[0].text);

// 4. Trigger deployment with parameters
const triggerResponse = await mcpClient.callTool("trigger_jenkins_job", {
  jobName: "deploy-production",
  parameters: {
    VERSION: "v2.1.0",
    ENVIRONMENT: "production",
    NOTIFY_SLACK: true
  }
});

// 5. Monitor build progress
const { buildUrl } = JSON.parse(triggerResponse.content[0].text);
let building = true;
while (building) {
  await new Promise(resolve => setTimeout(resolve, 30000)); // Wait 30s
  
  const statusResponse = await mcpClient.callTool("get_job_status", {
    jobName: "deploy-production"
  });
  const status = JSON.parse(statusResponse.content[0].text);
  
  building = status.building;
  console.log(`Build ${status.buildNumber}: ${status.status}`);
}
```

### Error Handling Example

```javascript
try {
  const response = await mcpClient.callTool("trigger_jenkins_job", {
    jobName: "non-existent-job"
  });
} catch (error) {
  if (error.code === -32602) {
    console.error("Invalid parameters:", error.data.details);
  } else if (error.code === -32603) {
    console.error("Jenkins API error:", error.data.details);
    // Implement retry logic
  } else {
    console.error("Unexpected error:", error.message);
  }
}
```

This reference provides comprehensive information for effectively using the Jenkins MCP Server tools in your automation workflows.