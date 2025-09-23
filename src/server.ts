import { BacklogClient, BacklogConfig } from './backlogClient';
import { createIssuesTool } from './tools/issues';
import { createCommentsTool } from './tools/comments';
import { createWikiTool } from './tools/wiki';
import { createAttachmentsTool } from './tools/attachments';
import { createActivitiesTool } from './tools/activities';

type Tool = {
  name: string;
  description: string;
  execute: (payload: unknown) => Promise<unknown>;
};

export class BacklogMcpServer {
  private readonly client: BacklogClient;
  private readonly tools: Tool[];

  constructor(config: BacklogConfig) {
    this.client = new BacklogClient(config);
    this.tools = [
      createIssuesTool(this.client),
      createCommentsTool(this.client),
      createWikiTool(this.client),
      createAttachmentsTool(this.client),
      createActivitiesTool(this.client),
    ];
  }

  public listTools(): Tool[] {
    return this.tools;
  }

  public async start(): Promise<void> {
    if (process.env.NODE_ENV !== 'production') {
      console.log('Backlog MCP server initialized with the following tools:');
      for (const tool of this.tools) {
        console.log(`• ${tool.name} – ${tool.description}`);
      }
    }
  }
}

export const createServer = (config: BacklogConfig) => new BacklogMcpServer(config);
