import Joi from 'joi';
import { JenkinsConfigOptions } from '../config/jenkins';

// Schema for Jenkins configuration validation
export const jenkinsConfigSchema = Joi.object({
  baseUrl: Joi.string().uri({ scheme: ['http', 'https'] }).required()
    .messages({
      'string.uri': 'Jenkins URL must be a valid HTTP or HTTPS URL',
      'any.required': 'Jenkins URL is required'
    }),
  
  username: Joi.string().required().min(1).max(100)
    .messages({
      'string.empty': 'Jenkins username is required',
      'string.max': 'Username cannot exceed 100 characters'
    }),
  
  password: Joi.string().optional().min(1)
    .messages({
      'string.empty': 'Password cannot be empty if provided'
    }),
  
  apiToken: Joi.string().optional().min(1)
    .messages({
      'string.empty': 'API token cannot be empty if provided'
    }),
  
  timeout: Joi.number().integer().positive().optional().default(30000)
    .messages({
      'number.positive': 'Timeout must be a positive number'
    }),
  
  crumbIssuer: Joi.boolean().optional().default(true),
  formData: Joi.boolean().optional().default(true),
  promisify: Joi.boolean().optional().default(true)
}).custom((value, helpers) => {
  // Either password or apiToken must be provided
  if (!value.password && !value.apiToken) {
    return helpers.error('custom.authRequired');
  }
  return value;
}).messages({
  'custom.authRequired': 'Either password or API token must be provided'
});

// Schema for Jenkins job trigger parameters
export const triggerJobSchema = Joi.object({
  jobName: Joi.string().required().min(1).max(255)
    .pattern(/^[a-zA-Z0-9_\-\/]+$/)
    .messages({
      'string.pattern.base': 'Job name can only contain letters, numbers, underscores, hyphens, and forward slashes',
      'string.empty': 'Job name is required',
      'string.max': 'Job name cannot exceed 255 characters'
    }),
  
  parameters: Joi.object()
    .pattern(Joi.string(), Joi.alternatives().try(
      Joi.string(),
      Joi.number(),
      Joi.boolean()
    ))
    .optional()
    .default({}),
  
  callbackInfo: Joi.object({
    slackChannel: Joi.string().required().min(1).max(100)
      .pattern(/^#[a-zA-Z0-9_\-]+$/)
      .messages({
        'string.pattern.base': 'Slack channel must start with # and contain only letters, numbers, underscores, and hyphens'
      }),
    
    slackThreadTs: Joi.string().required()
      .pattern(/^\d+\.\d+$/)
      .messages({
        'string.pattern.base': 'Slack thread timestamp must be in format "1234567890.123"'
      }),
    
    slackUserId: Joi.string().required()
      .pattern(/^U[A-Z0-9]+$/)
      .messages({
        'string.pattern.base': 'Slack user ID must start with U followed by alphanumeric characters'
      })
  }).optional()
});

// Schema for job status query
export const jobStatusSchema = Joi.object({
  jobName: Joi.string().required().min(1).max(255)
    .pattern(/^[a-zA-Z0-9_\-\/]+$/)
    .messages({
      'string.pattern.base': 'Job name can only contain letters, numbers, underscores, hyphens, and forward slashes'
    }),
  
  buildNumber: Joi.number().integer().positive().required()
    .messages({
      'number.positive': 'Build number must be a positive integer'
    })
});

// Schema for listing jobs
export const listJobsSchema = Joi.object({
  filter: Joi.string().optional().min(1).max(100)
    .messages({
      'string.empty': 'Filter cannot be empty if provided'
    }),
  
  includeDisabled: Joi.boolean().optional().default(false)
});

// Schema for getting job parameters
export const jobParametersSchema = Joi.object({
  jobName: Joi.string().required().min(1).max(255)
    .pattern(/^[a-zA-Z0-9_\-\/]+$/)
    .messages({
      'string.pattern.base': 'Job name can only contain letters, numbers, underscores, hyphens, and forward slashes'
    })
});

// Schema for webhook payload validation
export const webhookPayloadSchema = Joi.object({
  name: Joi.string().required(),
  url: Joi.string().uri().required(),
  build: Joi.object({
    number: Joi.number().integer().positive().required(),
    phase: Joi.string().valid('STARTED', 'COMPLETED', 'FINALIZED').required(),
    status: Joi.string().valid('SUCCESS', 'FAILURE', 'UNSTABLE', 'ABORTED').optional(),
    url: Joi.string().required(), // Relative URL path
    full_url: Joi.string().uri().required(),
    timestamp: Joi.number().optional(),
    duration: Joi.number().optional()
  }).required()
}).unknown(true); // Allow additional properties

// Generic validation function
export function validateInput<T>(schema: Joi.ObjectSchema, input: unknown): T {
  const { error, value } = schema.validate(input, { 
    abortEarly: false,
    stripUnknown: true,
    convert: true
  });
  
  if (error) {
    const details = error.details.map(detail => ({
      field: detail.path.join('.'),
      message: detail.message,
      value: detail.context?.value
    }));
    
    throw new ValidationError('Input validation failed', details);
  }
  
  return value as T;
}

// Custom validation error class
export class ValidationError extends Error {
  public readonly details: Array<{
    field: string;
    message: string;
    value?: unknown;
  }>;
  
  constructor(message: string, details: Array<{ field: string; message: string; value?: unknown }>) {
    super(message);
    this.name = 'ValidationError';
    this.details = details;
    
    // Ensure proper prototype chain for instanceof checks
    Object.setPrototypeOf(this, ValidationError.prototype);
  }
  
  toJSON() {
    return {
      name: this.name,
      message: this.message,
      details: this.details
    };
  }
}

// Type definitions for validated inputs
export interface TriggerJobInput {
  jobName: string;
  parameters?: Record<string, string | number | boolean>;
  callbackInfo?: {
    slackChannel: string;
    slackThreadTs: string;
    slackUserId: string;
  };
}

export interface JobStatusInput {
  jobName: string;
  buildNumber?: number;
}

export interface ListJobsInput {
  filter?: string;
  includeDisabled?: boolean;
}

export interface JobParametersInput {
  jobName: string;
}

export interface WebhookPayload {
  name: string;
  url: string;
  build: {
    number: number;
    phase: 'STARTED' | 'COMPLETED' | 'FINALIZED';
    status?: 'SUCCESS' | 'FAILURE' | 'UNSTABLE' | 'ABORTED';
    url: string;
    full_url: string;
    timestamp?: number;
    duration?: number;
  };
}