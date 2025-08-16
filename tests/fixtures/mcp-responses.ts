export const mcpSuccessResponse = {
  jsonrpc: "2.0",
  id: 1,
  result: {
    content: [
      {
        type: "text",
        text: "Operation completed successfully"
      }
    ]
  }
};

export const mcpErrorResponse = {
  jsonrpc: "2.0",
  id: 1,
  error: {
    code: -32602,
    message: "Invalid params",
    data: {
      details: "Missing required parameter: jobName"
    }
  }
};

export const mcpListJobsResponse = {
  jsonrpc: "2.0",
  id: 1,
  result: {
    content: [
      {
        type: "text",
        text: JSON.stringify([
          {
            name: "test-job-1",
            url: "http://jenkins.example.com/job/test-job-1/",
            status: "SUCCESS",
            lastBuild: 5
          },
          {
            name: "test-job-2", 
            url: "http://jenkins.example.com/job/test-job-2/",
            status: "FAILURE",
            lastBuild: 3
          }
        ])
      }
    ]
  }
};

export const mcpTriggerJobResponse = {
  jsonrpc: "2.0",
  id: 2,
  result: {
    content: [
      {
        type: "text",
        text: JSON.stringify({
          message: "Job triggered successfully",
          jobName: "test-job",
          queueId: 123,
          buildUrl: "http://jenkins.example.com/job/test-job/6/"
        })
      }
    ]
  }
};

export const mcpJobStatusResponse = {
  jsonrpc: "2.0",
  id: 3,
  result: {
    content: [
      {
        type: "text",
        text: JSON.stringify({
          jobName: "test-job",
          buildNumber: 1,
          status: "SUCCESS",
          result: "SUCCESS",
          building: false,
          duration: 1234,
          timestamp: 1640995200000,
          url: "http://jenkins.example.com/job/test-job/1/"
        })
      }
    ]
  }
};

export const mcpJobParametersResponse = {
  jsonrpc: "2.0",
  id: 4,
  result: {
    content: [
      {
        type: "text",
        text: JSON.stringify({
          jobName: "test-job",
          parameters: [
            {
              name: "BRANCH",
              type: "string",
              description: "Git branch to build", 
              defaultValue: "main"
            },
            {
              name: "DEPLOY",
              type: "boolean",
              description: "Deploy after build",
              defaultValue: false
            }
          ]
        })
      }
    ]
  }
};

export const mcpListToolsResponse = {
  jsonrpc: "2.0",
  id: 0,
  result: {
    tools: [
      {
        name: "list_jenkins_jobs",
        description: "List all Jenkins jobs with their current status",
        inputSchema: {
          type: "object",
          properties: {},
          additionalProperties: false
        }
      },
      {
        name: "trigger_jenkins_job",
        description: "Trigger a Jenkins job with optional parameters",
        inputSchema: {
          type: "object",
          properties: {
            jobName: {
              type: "string",
              description: "Name of the Jenkins job to trigger"
            },
            parameters: {
              type: "object",
              description: "Build parameters for the job",
              additionalProperties: true
            }
          },
          required: ["jobName"],
          additionalProperties: false
        }
      },
      {
        name: "get_job_status",
        description: "Get the status of a specific Jenkins job build",
        inputSchema: {
          type: "object",
          properties: {
            jobName: {
              type: "string",
              description: "Name of the Jenkins job"
            },
            buildNumber: {
              type: "number",
              description: "Build number to check (optional, defaults to latest)"
            }
          },
          required: ["jobName"],
          additionalProperties: false
        }
      },
      {
        name: "get_job_parameters",
        description: "Get the parameters definition for a Jenkins job",
        inputSchema: {
          type: "object",
          properties: {
            jobName: {
              type: "string",
              description: "Name of the Jenkins job"
            }
          },
          required: ["jobName"],
          additionalProperties: false
        }
      }
    ]
  }
};