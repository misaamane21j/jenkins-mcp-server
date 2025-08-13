export interface MCPToolRequest {
  name: string;
  arguments: any;
}

export interface MCPToolResponse {
  content: Array<{
    type: string;
    text: string;
  }>;
}

export interface MCPServerCapabilities {
  tools?: {};
  resources?: {};
  prompts?: {};
}

export interface MCPToolSchema {
  name: string;
  description: string;
  inputSchema: {
    type: string;
    properties: Record<string, any>;
    required?: string[];
    additionalProperties?: boolean;
  };
}

export interface MCPToolImplementation {
  execute(args: any): Promise<any>;
}

export interface MCPToolRegistration {
  schema: MCPToolSchema;
  implementation: MCPToolImplementation;
}