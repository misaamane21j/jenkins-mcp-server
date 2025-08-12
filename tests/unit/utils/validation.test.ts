import {
  validateInput,
  ValidationError,
  triggerJobSchema,
  jobStatusSchema,
  listJobsSchema,
  jobParametersSchema,
  webhookPayloadSchema,
  TriggerJobInput,
  JobStatusInput,
  ListJobsInput,
  JobParametersInput,
  WebhookPayload
} from '../../../src/utils/validation';

describe('Validation', () => {
  describe('ValidationError', () => {
    it('should create ValidationError with details', () => {
      const details = [
        { field: 'jobName', message: 'Job name is required', value: undefined }
      ];
      const error = new ValidationError('Validation failed', details);

      expect(error.name).toBe('ValidationError');
      expect(error.message).toBe('Validation failed');
      expect(error.details).toEqual(details);
      expect(error instanceof ValidationError).toBe(true);
    });

    it('should serialize to JSON correctly', () => {
      const details = [
        { field: 'jobName', message: 'Job name is required', value: undefined }
      ];
      const error = new ValidationError('Validation failed', details);

      expect(error.toJSON()).toEqual({
        name: 'ValidationError',
        message: 'Validation failed',
        details
      });
    });
  });

  describe('triggerJobSchema', () => {
    it('should validate valid trigger job input', () => {
      const validInput = {
        jobName: 'my-test-job',
        parameters: { branch: 'main', version: '1.0.0' },
        callbackInfo: {
          slackChannel: '#deployments',
          slackThreadTs: '1234567890.123',
          slackUserId: 'U1234567'
        }
      };

      const result = validateInput<TriggerJobInput>(triggerJobSchema, validInput);
      expect(result).toEqual(validInput);
    });

    it('should validate minimal trigger job input', () => {
      const validInput = { jobName: 'simple-job' };
      
      const result = validateInput<TriggerJobInput>(triggerJobSchema, validInput);
      expect(result.jobName).toBe('simple-job');
      expect(result.parameters).toEqual({});
    });

    it('should reject invalid job names', () => {
      const invalidInputs = [
        { jobName: '' },
        { jobName: 'job with spaces' },
        { jobName: 'job@invalid' },
        { jobName: 'a'.repeat(256) }
      ];

      invalidInputs.forEach(input => {
        expect(() => validateInput<TriggerJobInput>(triggerJobSchema, input))
          .toThrow(ValidationError);
      });
    });

    it('should reject invalid slack channel format', () => {
      const invalidInput = {
        jobName: 'valid-job',
        callbackInfo: {
          slackChannel: 'invalid-channel',
          slackThreadTs: '1234567890.123',
          slackUserId: 'U1234567'
        }
      };

      expect(() => validateInput<TriggerJobInput>(triggerJobSchema, invalidInput))
        .toThrow(ValidationError);
    });

    it('should reject invalid slack thread timestamp', () => {
      const invalidInput = {
        jobName: 'valid-job',
        callbackInfo: {
          slackChannel: '#valid',
          slackThreadTs: 'invalid-ts',
          slackUserId: 'U1234567'
        }
      };

      expect(() => validateInput<TriggerJobInput>(triggerJobSchema, invalidInput))
        .toThrow(ValidationError);
    });

    it('should reject invalid slack user ID', () => {
      const invalidInput = {
        jobName: 'valid-job',
        callbackInfo: {
          slackChannel: '#valid',
          slackThreadTs: '1234567890.123',
          slackUserId: 'invalid-user'
        }
      };

      expect(() => validateInput<TriggerJobInput>(triggerJobSchema, invalidInput))
        .toThrow(ValidationError);
    });
  });

  describe('jobStatusSchema', () => {
    it('should validate job status input with build number', () => {
      const validInput = { jobName: 'test-job', buildNumber: 123 };
      
      const result = validateInput<JobStatusInput>(jobStatusSchema, validInput);
      expect(result).toEqual(validInput);
    });

    it('should require build number for job status', () => {
      const invalidInput = { jobName: 'test-job' };
      
      expect(() => validateInput<JobStatusInput>(jobStatusSchema, invalidInput))
        .toThrow(ValidationError);
    });

    it('should reject negative build numbers', () => {
      const invalidInput = { jobName: 'test-job', buildNumber: -1 };

      expect(() => validateInput<JobStatusInput>(jobStatusSchema, invalidInput))
        .toThrow(ValidationError);
    });

    it('should reject non-integer build numbers', () => {
      const invalidInput = { jobName: 'test-job', buildNumber: 123.45 };

      expect(() => validateInput<JobStatusInput>(jobStatusSchema, invalidInput))
        .toThrow(ValidationError);
    });
  });

  describe('listJobsSchema', () => {
    it('should validate list jobs input with filter', () => {
      const validInput = { filter: 'test', includeDisabled: true };
      
      const result = validateInput<ListJobsInput>(listJobsSchema, validInput);
      expect(result).toEqual(validInput);
    });

    it('should validate list jobs input with defaults', () => {
      const validInput = {};
      
      const result = validateInput<ListJobsInput>(listJobsSchema, validInput);
      expect(result.includeDisabled).toBe(false);
    });

    it('should reject empty filter strings', () => {
      const invalidInput = { filter: '' };

      expect(() => validateInput<ListJobsInput>(listJobsSchema, invalidInput))
        .toThrow(ValidationError);
    });
  });

  describe('jobParametersSchema', () => {
    it('should validate job parameters input', () => {
      const validInput = { jobName: 'parameterized-job' };
      
      const result = validateInput<JobParametersInput>(jobParametersSchema, validInput);
      expect(result).toEqual(validInput);
    });

    it('should reject invalid job names', () => {
      const invalidInput = { jobName: 'job with spaces' };

      expect(() => validateInput<JobParametersInput>(jobParametersSchema, invalidInput))
        .toThrow(ValidationError);
    });
  });

  describe('webhookPayloadSchema', () => {
    it('should validate complete webhook payload', () => {
      const validPayload = {
        name: 'test-job',
        url: 'http://jenkins.example.com/job/test-job/',
        build: {
          number: 123,
          phase: 'COMPLETED' as const,
          status: 'SUCCESS' as const,
          url: 'job/test-job/123/',
          full_url: 'http://jenkins.example.com/job/test-job/123/',
          timestamp: 1234567890,
          duration: 60000
        },
        extraProperty: 'allowed'
      };

      const result = validateInput<WebhookPayload>(webhookPayloadSchema, validPayload);
      expect(result.name).toBe('test-job');
      expect(result.build.number).toBe(123);
      expect(result.build.phase).toBe('COMPLETED');
    });

    it('should validate minimal webhook payload', () => {
      const validPayload = {
        name: 'test-job',
        url: 'http://jenkins.example.com/job/test-job/',
        build: {
          number: 123,
          phase: 'STARTED' as const,
          url: 'job/test-job/123/',
          full_url: 'http://jenkins.example.com/job/test-job/123/'
        }
      };

      const result = validateInput<WebhookPayload>(webhookPayloadSchema, validPayload);
      expect(result.build.status).toBeUndefined();
      expect(result.build.timestamp).toBeUndefined();
    });

    it('should reject invalid webhook phases', () => {
      const invalidPayload = {
        name: 'test-job',
        url: 'http://jenkins.example.com/job/test-job/',
        build: {
          number: 123,
          phase: 'INVALID_PHASE',
          url: 'job/test-job/123/',
          full_url: 'http://jenkins.example.com/job/test-job/123/'
        }
      };

      expect(() => validateInput<WebhookPayload>(webhookPayloadSchema, invalidPayload))
        .toThrow(ValidationError);
    });

    it('should reject invalid webhook status', () => {
      const invalidPayload = {
        name: 'test-job',
        url: 'http://jenkins.example.com/job/test-job/',
        build: {
          number: 123,
          phase: 'COMPLETED' as const,
          status: 'INVALID_STATUS',
          url: 'job/test-job/123/',
          full_url: 'http://jenkins.example.com/job/test-job/123/'
        }
      };

      expect(() => validateInput<WebhookPayload>(webhookPayloadSchema, invalidPayload))
        .toThrow(ValidationError);
    });
  });

  describe('validateInput', () => {
    it('should strip unknown properties when stripUnknown is enabled', () => {
      const input = {
        jobName: 'test-job',
        unknownProperty: 'should be stripped'
      };

      const result = validateInput<JobParametersInput>(jobParametersSchema, input);
      expect(result).toEqual({ jobName: 'test-job' });
    });

    it('should convert types when convert is enabled', () => {
      const input = {
        jobName: 'test-job',
        buildNumber: '123' // String should be converted to number
      };

      const result = validateInput<JobStatusInput>(jobStatusSchema, input);
      expect(result.buildNumber).toBe(123);
      expect(typeof result.buildNumber).toBe('number');
    });

    it('should include all validation details in error', () => {
      const invalidInput = {
        jobName: '',
        buildNumber: -1
      };

      try {
        validateInput<JobStatusInput>(jobStatusSchema, invalidInput);
        fail('Expected validation to throw');
      } catch (error) {
        expect(error).toBeInstanceOf(ValidationError);
        const validationError = error as ValidationError;
        expect(validationError.details).toHaveLength(2);
        expect(validationError.details.some(d => d.field === 'jobName')).toBe(true);
        expect(validationError.details.some(d => d.field === 'buildNumber')).toBe(true);
      }
    });
  });
});