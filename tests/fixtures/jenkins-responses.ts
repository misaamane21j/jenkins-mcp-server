export const jenkinsJobResponse = {
  _class: "hudson.model.FreeStyleProject",
  name: "test-job",
  url: "http://jenkins.example.com/job/test-job/",
  buildable: true,
  builds: [
    {
      _class: "hudson.model.FreeStyleBuild",
      number: 1,
      url: "http://jenkins.example.com/job/test-job/1/"
    }
  ],
  firstBuild: {
    _class: "hudson.model.FreeStyleBuild",
    number: 1,
    url: "http://jenkins.example.com/job/test-job/1/"
  },
  lastBuild: {
    _class: "hudson.model.FreeStyleBuild",
    number: 1,
    url: "http://jenkins.example.com/job/test-job/1/"
  },
  lastCompletedBuild: {
    _class: "hudson.model.FreeStyleBuild",
    number: 1,
    url: "http://jenkins.example.com/job/test-job/1/"
  },
  lastFailedBuild: null,
  lastStableBuild: {
    _class: "hudson.model.FreeStyleBuild",
    number: 1,
    url: "http://jenkins.example.com/job/test-job/1/"
  },
  lastSuccessfulBuild: {
    _class: "hudson.model.FreeStyleBuild",
    number: 1,
    url: "http://jenkins.example.com/job/test-job/1/"
  },
  lastUnstableBuild: null,
  lastUnsuccessfulBuild: null,
  nextBuildNumber: 2,
  property: [],
  queueItem: null,
  concurrentBuild: false,
  downstreamProjects: [],
  scm: {},
  upstreamProjects: []
};

export const jenkinsBuildResponse = {
  _class: "hudson.model.FreeStyleBuild",
  number: 1,
  url: "http://jenkins.example.com/job/test-job/1/",
  building: false,
  description: null,
  displayName: "#1",
  duration: 1234,
  estimatedDuration: 1200,
  executor: null,
  fullDisplayName: "test-job #1",
  id: "1",
  keepLog: false,
  queueId: 1,
  result: "SUCCESS",
  timestamp: 1640995200000,
  builtOn: "",
  changeSet: {
    _class: "hudson.scm.EmptyChangeLogSet",
    items: [],
    kind: null
  }
};

export const jenkinsJobsListResponse = {
  _class: "hudson.model.Hudson",
  jobs: [
    {
      _class: "hudson.model.FreeStyleProject",
      name: "test-job-1",
      url: "http://jenkins.example.com/job/test-job-1/",
      color: "blue"
    },
    {
      _class: "hudson.model.FreeStyleProject", 
      name: "test-job-2",
      url: "http://jenkins.example.com/job/test-job-2/",
      color: "red"
    }
  ]
};

export const jenkinsJobParametersResponse = {
  _class: "hudson.model.ParametersDefinitionProperty",
  parameterDefinitions: [
    {
      _class: "hudson.model.StringParameterDefinition",
      name: "BRANCH",
      description: "Git branch to build",
      defaultParameterValue: {
        _class: "hudson.model.StringParameterValue",
        name: "BRANCH",
        value: "main"
      }
    },
    {
      _class: "hudson.model.BooleanParameterDefinition",
      name: "DEPLOY",
      description: "Deploy after build",
      defaultParameterValue: {
        _class: "hudson.model.BooleanParameterValue",
        name: "DEPLOY",
        value: false
      }
    }
  ]
};

export const webhookPayload = {
  name: "test-job",
  url: "job/test-job/",
  build: {
    full_url: "http://jenkins.example.com/job/test-job/1/",
    number: 1,
    phase: "COMPLETED",
    status: "SUCCESS",
    url: "job/test-job/1/",
    scm: {
      url: "https://github.com/example/repo.git",
      branch: "origin/main",
      commit: "abc123def456"
    },
    log: "",
    artifacts: {}
  }
};

export const mcpListJobsRequest = {
  jsonrpc: "2.0",
  id: 1,
  method: "tools/call",
  params: {
    name: "list_jenkins_jobs"
  }
};

export const mcpTriggerJobRequest = {
  jsonrpc: "2.0",
  id: 2,
  method: "tools/call",
  params: {
    name: "trigger_jenkins_job",
    arguments: {
      jobName: "test-job",
      parameters: {
        BRANCH: "develop",
        DEPLOY: true
      }
    }
  }
};

export const mcpJobStatusRequest = {
  jsonrpc: "2.0",
  id: 3,
  method: "tools/call",
  params: {
    name: "get_job_status",
    arguments: {
      jobName: "test-job",
      buildNumber: 1
    }
  }
};

export const mcpGetJobParametersRequest = {
  jsonrpc: "2.0",
  id: 4,
  method: "tools/call",
  params: {
    name: "get_job_parameters",
    arguments: {
      jobName: "test-job"
    }
  }
};