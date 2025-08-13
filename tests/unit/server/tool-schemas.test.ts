import { 
  triggerJenkinsJobSchema,
  getJobStatusSchema,
  listJenkinsJobsSchema,
  getJobParametersSchema,
  toolSchemas,
  allToolSchemas
} from '../../../src/server/tool-schemas';

describe('Tool Schemas', () => {
  describe('triggerJenkinsJobSchema', () => {
    it('should have correct name and description', () => {
      expect(triggerJenkinsJobSchema.name).toBe('trigger_jenkins_job');
      expect(triggerJenkinsJobSchema.description).toContain('Trigger a Jenkins job');
    });

    it('should have required properties', () => {
      const { inputSchema } = triggerJenkinsJobSchema;
      expect(inputSchema.required).toEqual(['jobName', 'parameters', 'callbackInfo']);
      expect(inputSchema.properties.jobName).toBeDefined();
      expect(inputSchema.properties.parameters).toBeDefined();
      expect(inputSchema.properties.callbackInfo).toBeDefined();
    });

    it('should have callbackInfo with required Slack properties', () => {
      const callbackInfo = triggerJenkinsJobSchema.inputSchema.properties.callbackInfo;
      expect(callbackInfo.required).toEqual(['slackChannel', 'slackThreadTs', 'slackUserId']);
      expect(callbackInfo.properties.slackChannel).toBeDefined();
      expect(callbackInfo.properties.slackThreadTs).toBeDefined();
      expect(callbackInfo.properties.slackUserId).toBeDefined();
    });

    it('should allow additional properties for parameters', () => {
      const parameters = triggerJenkinsJobSchema.inputSchema.properties.parameters;
      expect(parameters.additionalProperties).toBe(true);
    });
  });

  describe('getJobStatusSchema', () => {
    it('should have correct name and description', () => {
      expect(getJobStatusSchema.name).toBe('get_job_status');
      expect(getJobStatusSchema.description).toContain('Get the status and details');
    });

    it('should require jobName and buildNumber', () => {
      const { inputSchema } = getJobStatusSchema;
      expect(inputSchema.required).toEqual(['jobName', 'buildNumber']);
      expect(inputSchema.properties.jobName.type).toBe('string');
      expect(inputSchema.properties.buildNumber.type).toBe('number');
    });
  });

  describe('listJenkinsJobsSchema', () => {
    it('should have correct name and description', () => {
      expect(listJenkinsJobsSchema.name).toBe('list_jenkins_jobs');
      expect(listJenkinsJobsSchema.description).toContain('List available Jenkins jobs');
    });

    it('should have optional filter and includeDisabled properties', () => {
      const { inputSchema } = listJenkinsJobsSchema;
      expect(inputSchema.required).toBeUndefined();
      expect(inputSchema.properties.filter.type).toBe('string');
      expect(inputSchema.properties.includeDisabled.type).toBe('boolean');
    });

    it('should not allow additional properties', () => {
      expect(listJenkinsJobsSchema.inputSchema.additionalProperties).toBe(false);
    });
  });

  describe('getJobParametersSchema', () => {
    it('should have correct name and description', () => {
      expect(getJobParametersSchema.name).toBe('get_job_parameters');
      expect(getJobParametersSchema.description).toContain('Get the parameter definitions');
    });

    it('should require only jobName', () => {
      const { inputSchema } = getJobParametersSchema;
      expect(inputSchema.required).toEqual(['jobName']);
      expect(inputSchema.properties.jobName.type).toBe('string');
    });
  });

  describe('toolSchemas object', () => {
    it('should contain all four tools', () => {
      expect(toolSchemas.trigger_jenkins_job).toBe(triggerJenkinsJobSchema);
      expect(toolSchemas.get_job_status).toBe(getJobStatusSchema);
      expect(toolSchemas.list_jenkins_jobs).toBe(listJenkinsJobsSchema);
      expect(toolSchemas.get_job_parameters).toBe(getJobParametersSchema);
    });

    it('should have consistent naming', () => {
      Object.entries(toolSchemas).forEach(([key, schema]) => {
        expect(key).toBe(schema.name);
      });
    });
  });

  describe('allToolSchemas array', () => {
    it('should contain all schemas', () => {
      expect(allToolSchemas).toHaveLength(4);
      expect(allToolSchemas).toContain(triggerJenkinsJobSchema);
      expect(allToolSchemas).toContain(getJobStatusSchema);
      expect(allToolSchemas).toContain(listJenkinsJobsSchema);
      expect(allToolSchemas).toContain(getJobParametersSchema);
    });

    it('should have unique tool names', () => {
      const names = allToolSchemas.map(schema => schema.name);
      const uniqueNames = [...new Set(names)];
      expect(names.length).toBe(uniqueNames.length);
    });

    it('should all have valid schema structures', () => {
      allToolSchemas.forEach(schema => {
        expect(schema.name).toBeTruthy();
        expect(typeof schema.name).toBe('string');
        expect(schema.description).toBeTruthy();
        expect(typeof schema.description).toBe('string');
        expect(schema.inputSchema).toBeTruthy();
        expect(schema.inputSchema.type).toBe('object');
        expect(schema.inputSchema.properties).toBeTruthy();
      });
    });
  });

  describe('schema property descriptions', () => {
    it('should have meaningful descriptions for all properties', () => {
      allToolSchemas.forEach(schema => {
        Object.values(schema.inputSchema.properties).forEach((property: any) => {
          if (property.description) {
            expect(property.description.length).toBeGreaterThan(5);
          }
          
          // Check nested objects for descriptions
          if (property.properties) {
            Object.values(property.properties).forEach((nestedProp: any) => {
              if (nestedProp.description) {
                expect(nestedProp.description.length).toBeGreaterThan(5);
              }
            });
          }
        });
      });
    });
  });
});