import { config } from './environment';

export const jenkinsConfig = {
  baseUrl: config.jenkins.url,
  crumbIssuer: true,
  formData: true,
  auth: {
    username: config.jenkins.username,
    password: config.jenkins.apiToken || config.jenkins.password!,
  },
};