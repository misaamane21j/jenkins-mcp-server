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