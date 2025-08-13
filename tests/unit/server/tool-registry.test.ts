import { MCPToolRegistry } from '../../../src/server/tool-registry';
import { MCPToolSchema, MCPToolImplementation } from '../../../src/types/mcp';

describe('MCPToolRegistry', () => {
  let registry: MCPToolRegistry;

  beforeEach(() => {
    registry = new MCPToolRegistry();
  });

  describe('registerTool', () => {
    it('should register a tool successfully', () => {
      const schema: MCPToolSchema = {
        name: 'test-tool',
        description: 'A test tool',
        inputSchema: {
          type: 'object',
          properties: {
            param1: { type: 'string' }
          },
          required: ['param1']
        }
      };

      const implementation: MCPToolImplementation = {
        execute: jest.fn().mockResolvedValue({ content: [{ type: 'text', text: 'result' }] })
      };

      expect(() => registry.registerTool('test-tool', schema, implementation)).not.toThrow();
      expect(registry.isToolRegistered('test-tool')).toBe(true);
    });

    it('should validate tool name consistency', () => {
      const schema: MCPToolSchema = {
        name: 'schema-name',
        description: 'A test tool',
        inputSchema: {
          type: 'object',
          properties: {}
        }
      };

      const implementation: MCPToolImplementation = {
        execute: jest.fn()
      };

      expect(() => registry.registerTool('different-name', schema, implementation))
        .toThrow("Tool name mismatch: schema name 'schema-name' does not match registration name 'different-name'");
    });

    it('should validate schema structure', () => {
      const invalidSchema = {
        name: '',
        description: '',
        inputSchema: {}
      } as MCPToolSchema;

      const implementation: MCPToolImplementation = {
        execute: jest.fn()
      };

      expect(() => registry.registerTool('test-tool', invalidSchema, implementation))
        .toThrow('Tool schema must have a valid name');
    });

    it('should warn when overwriting existing tool', () => {
      const schema: MCPToolSchema = {
        name: 'test-tool',
        description: 'A test tool',
        inputSchema: {
          type: 'object',
          properties: {}
        }
      };

      const implementation: MCPToolImplementation = {
        execute: jest.fn()
      };

      // Register first time
      registry.registerTool('test-tool', schema, implementation);

      // Register again - should warn but not throw
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      expect(() => registry.registerTool('test-tool', schema, implementation)).not.toThrow();
      consoleSpy.mockRestore();
    });
  });

  describe('schema validation', () => {
    it('should validate required inputSchema properties', () => {
      const schema: MCPToolSchema = {
        name: 'test-tool',
        description: 'A test tool',
        inputSchema: {
          type: 'object',
          properties: {
            param1: { type: 'string' }
          },
          required: ['param2'] // param2 doesn't exist in properties
        }
      };

      const implementation: MCPToolImplementation = {
        execute: jest.fn()
      };

      expect(() => registry.registerTool('test-tool', schema, implementation))
        .toThrow("Required field 'param2' is not defined in properties");
    });

    it('should validate inputSchema type is object', () => {
      const schema = {
        name: 'test-tool',
        description: 'A test tool',
        inputSchema: {
          type: 'string', // should be 'object'
          properties: {}
        }
      } as any as MCPToolSchema;

      const implementation: MCPToolImplementation = {
        execute: jest.fn()
      };

      expect(() => registry.registerTool('test-tool', schema, implementation))
        .toThrow('Tool inputSchema type must be "object"');
    });

    it('should validate required field is an array if present', () => {
      const schema = {
        name: 'test-tool',
        description: 'A test tool',
        inputSchema: {
          type: 'object',
          properties: {},
          required: 'not-an-array' // should be array
        }
      } as any as MCPToolSchema;

      const implementation: MCPToolImplementation = {
        execute: jest.fn()
      };

      expect(() => registry.registerTool('test-tool', schema, implementation))
        .toThrow('Tool inputSchema.required must be an array');
    });
  });

  describe('getToolSchemas', () => {
    it('should return all registered tool schemas', () => {
      const schema1: MCPToolSchema = {
        name: 'tool1',
        description: 'First tool',
        inputSchema: {
          type: 'object',
          properties: {}
        }
      };

      const schema2: MCPToolSchema = {
        name: 'tool2',
        description: 'Second tool',
        inputSchema: {
          type: 'object',
          properties: {}
        }
      };

      const implementation: MCPToolImplementation = {
        execute: jest.fn()
      };

      registry.registerTool('tool1', schema1, implementation);
      registry.registerTool('tool2', schema2, implementation);

      const schemas = registry.getToolSchemas();
      expect(schemas).toHaveLength(2);
      expect(schemas.map(s => s.name)).toContain('tool1');
      expect(schemas.map(s => s.name)).toContain('tool2');
    });

    it('should return empty array when no tools registered', () => {
      expect(registry.getToolSchemas()).toEqual([]);
    });
  });

  describe('getToolImplementation', () => {
    it('should return tool implementation when tool exists', () => {
      const schema: MCPToolSchema = {
        name: 'test-tool',
        description: 'A test tool',
        inputSchema: {
          type: 'object',
          properties: {}
        }
      };

      const implementation: MCPToolImplementation = {
        execute: jest.fn()
      };

      registry.registerTool('test-tool', schema, implementation);

      const retrieved = registry.getToolImplementation('test-tool');
      expect(retrieved).toBe(implementation);
    });

    it('should return undefined when tool does not exist', () => {
      expect(registry.getToolImplementation('non-existent')).toBeUndefined();
    });
  });

  describe('isToolRegistered', () => {
    it('should return true for registered tools', () => {
      const schema: MCPToolSchema = {
        name: 'test-tool',
        description: 'A test tool',
        inputSchema: {
          type: 'object',
          properties: {}
        }
      };

      const implementation: MCPToolImplementation = {
        execute: jest.fn()
      };

      registry.registerTool('test-tool', schema, implementation);
      expect(registry.isToolRegistered('test-tool')).toBe(true);
    });

    it('should return false for unregistered tools', () => {
      expect(registry.isToolRegistered('non-existent')).toBe(false);
    });
  });

  describe('getRegisteredToolNames', () => {
    it('should return list of registered tool names', () => {
      const schema1: MCPToolSchema = {
        name: 'tool1',
        description: 'First tool',
        inputSchema: {
          type: 'object',
          properties: {}
        }
      };

      const schema2: MCPToolSchema = {
        name: 'tool2',
        description: 'Second tool',
        inputSchema: {
          type: 'object',
          properties: {}
        }
      };

      const implementation: MCPToolImplementation = {
        execute: jest.fn()
      };

      registry.registerTool('tool1', schema1, implementation);
      registry.registerTool('tool2', schema2, implementation);

      const names = registry.getRegisteredToolNames();
      expect(names).toHaveLength(2);
      expect(names).toContain('tool1');
      expect(names).toContain('tool2');
    });
  });

  describe('unregisterTool', () => {
    it('should unregister existing tool and return true', () => {
      const schema: MCPToolSchema = {
        name: 'test-tool',
        description: 'A test tool',
        inputSchema: {
          type: 'object',
          properties: {}
        }
      };

      const implementation: MCPToolImplementation = {
        execute: jest.fn()
      };

      registry.registerTool('test-tool', schema, implementation);
      expect(registry.isToolRegistered('test-tool')).toBe(true);

      const result = registry.unregisterTool('test-tool');
      expect(result).toBe(true);
      expect(registry.isToolRegistered('test-tool')).toBe(false);
    });

    it('should return false for non-existent tool', () => {
      const result = registry.unregisterTool('non-existent');
      expect(result).toBe(false);
    });
  });

  describe('clear', () => {
    it('should clear all registered tools', () => {
      const schema: MCPToolSchema = {
        name: 'test-tool',
        description: 'A test tool',
        inputSchema: {
          type: 'object',
          properties: {}
        }
      };

      const implementation: MCPToolImplementation = {
        execute: jest.fn()
      };

      registry.registerTool('test-tool', schema, implementation);
      expect(registry.getStats().totalTools).toBe(1);

      registry.clear();
      expect(registry.getStats().totalTools).toBe(0);
      expect(registry.isToolRegistered('test-tool')).toBe(false);
    });
  });

  describe('getStats', () => {
    it('should return correct statistics', () => {
      const schema1: MCPToolSchema = {
        name: 'tool1',
        description: 'First tool',
        inputSchema: {
          type: 'object',
          properties: {}
        }
      };

      const schema2: MCPToolSchema = {
        name: 'tool2',
        description: 'Second tool',
        inputSchema: {
          type: 'object',
          properties: {}
        }
      };

      const implementation: MCPToolImplementation = {
        execute: jest.fn()
      };

      registry.registerTool('tool1', schema1, implementation);
      registry.registerTool('tool2', schema2, implementation);

      const stats = registry.getStats();
      expect(stats.totalTools).toBe(2);
      expect(stats.toolNames).toEqual(expect.arrayContaining(['tool1', 'tool2']));
    });

    it('should return zero stats for empty registry', () => {
      const stats = registry.getStats();
      expect(stats.totalTools).toBe(0);
      expect(stats.toolNames).toEqual([]);
    });
  });
});