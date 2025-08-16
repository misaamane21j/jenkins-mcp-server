export interface JenkinsWebhookPayload {
  name: string;
  url: string;
  build: {
    full_url: string;
    number: number;
    queue_id: number;
    timestamp: number;
    duration: number;
    result: string;
    artifacts: unknown[];
    log: string;
  };
  number: number;
  status: 'SUCCESS' | 'FAILURE' | 'ABORTED' | 'UNSTABLE';
  duration: number;
}