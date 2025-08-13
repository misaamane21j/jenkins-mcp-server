import { logger } from '../utils/logger';
import { MCPToolSchema, MCPToolRegistration, MCPToolImplementation } from '../types/mcp';
import { handleError } from '../utils/error-handler';

export class MCPToolRegistry {
  private tools: Map<string, MCPToolRegistration> = new Map();

  /**
   * Register a tool with the registry
   */
  registerTool(toolName: string, schema: MCPToolSchema, implementation: MCPToolImplementation): void {
    try {
      // Validate schema structure first
      this.validateSchema(schema);
      
      // Then validate tool name consistency
      if (schema.name !== toolName) {
        throw new Error(`Tool name mismatch: schema name '${schema.name}' does not match registration name '${toolName}'`);
      }

      // Check for duplicate registration
      if (this.tools.has(toolName)) {
        logger.warn(`Tool '${toolName}' is already registered, overwriting previous registration`);
      }

      // Register the tool
      this.tools.set(toolName, {
        schema,
        implementation
      });

      logger.info(`Tool '${toolName}' registered successfully`);
    } catch (error) {
      const handledError = handleError(error, `tool registration for '${toolName}'`);
      logger.error(`Failed to register tool '${toolName}':`, handledError);
      throw handledError;
    }
  }

  /**
   * Get all registered tool schemas
   */
  getToolSchemas(): MCPToolSchema[] {
    return Array.from(this.tools.values()).map(registration => registration.schema);
  }

  /**
   * Get a specific tool implementation
   */
  getToolImplementation(toolName: string): MCPToolImplementation | undefined {
    const registration = this.tools.get(toolName);
    return registration?.implementation;
  }

  /**
   * Check if a tool is registered
   */
  isToolRegistered(toolName: string): boolean {
    return this.tools.has(toolName);
  }

  /**
   * Get list of all registered tool names
   */
  getRegisteredToolNames(): string[] {
    return Array.from(this.tools.keys());
  }

  /**
   * Unregister a tool
   */
  unregisterTool(toolName: string): boolean {
    const existed = this.tools.delete(toolName);
    if (existed) {
      logger.info(`Tool '${toolName}' unregistered successfully`);
    } else {
      logger.warn(`Attempted to unregister non-existent tool '${toolName}'`);
    }
    return existed;
  }

  /**
   * Clear all registered tools
   */
  clear(): void {
    const toolCount = this.tools.size;
    this.tools.clear();
    logger.info(`Cleared ${toolCount} registered tools`);
  }

  /**
   * Get registry statistics
   */
  getStats() {
    return {
      totalTools: this.tools.size,
      toolNames: this.getRegisteredToolNames()
    };
  }

  /**
   * Validate tool schema structure
   */
  private validateSchema(schema: MCPToolSchema): void {
    if (!schema.name || typeof schema.name !== 'string') {
      throw new Error('Tool schema must have a valid name');
    }

    if (!schema.description || typeof schema.description !== 'string') {
      throw new Error('Tool schema must have a valid description');
    }

    if (!schema.inputSchema || typeof schema.inputSchema !== 'object') {
      throw new Error('Tool schema must have a valid inputSchema');
    }

    if (schema.inputSchema.type !== 'object') {
      throw new Error('Tool inputSchema type must be "object"');
    }

    if (!schema.inputSchema.properties || typeof schema.inputSchema.properties !== 'object') {
      throw new Error('Tool inputSchema must have properties');
    }

    // Validate required fields if present
    if (schema.inputSchema.required && !Array.isArray(schema.inputSchema.required)) {
      throw new Error('Tool inputSchema.required must be an array');
    }

    // Validate required fields exist in properties
    if (schema.inputSchema.required) {
      for (const requiredField of schema.inputSchema.required) {
        if (!schema.inputSchema.properties[requiredField]) {
          throw new Error(`Required field '${requiredField}' is not defined in properties`);
        }
      }
    }
  }
}