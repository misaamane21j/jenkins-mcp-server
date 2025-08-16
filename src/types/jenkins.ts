export interface JenkinsBuildResult {
  buildNumber: number;
  queueId: number;
  jobName: string;
  status: string;
}

export interface JenkinsJobStatus {
  jobName: string;
  buildNumber: number;
  status: 'PENDING' | 'RUNNING' | 'SUCCESS' | 'FAILURE' | 'ABORTED';
  duration?: number;
  timestamp: number;
  url?: string;
}

export interface JenkinsJobInfo {
  name: string;
  url: string;
  color: string;
  buildable: boolean;
}

export interface JobTrackingInfo {
  jobName: string;
  buildNumber: number;
  callbackInfo: {
    slackChannel: string;
    slackThreadTs: string;
    slackUserId: string;
  };
  status: string;
  timestamp: number;
  details?: unknown;
}