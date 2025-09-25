import { Server, StdioServerTransport } from '@modelcontextprotocol/sdk/server';

import { BacklogClient } from './backlogClient';
import { handleError } from './utils/errors';
import {
  createCreateIssueTool,
  createDeleteIssueTool,
  createGetIssueTool,
  createIssuesTool,
  createListIssuesTool,
  createTransitionIssueTool,
  createUpdateIssueTool,
  type Tool,
} from './tools/issues';
import {
  createAddCommentTool,
  createDeleteCommentTool,
  createListCommentsTool,
  createUpdateCommentTool,
} from './tools/comments';
import { createAttachmentsTool } from './tools/attachments';
import { createActivitiesTool } from './tools/activities';
import {
  createCreateWikiTool,
  createDeleteWikiTool,
  createGetWikiTool,
  createSearchWikiTool,
  createUpdateWikiTool,
  createWikiTool,
} from './tools/wiki';

/**
 * Ping tool input payload. The MCP tool interface allows arbitrary JSON; for
 * this smoke-test tool we keep it to a bare string value.
 */
type PingInput = string;

/**
 * Initialize the MCP server instance using stdio as the transport channel.
 *
 * The Model Context Protocol uses JSON-RPC over a transport layer. For CLI
 * integrations the stdio transport is the default because it works well with
 * processes that are spawned by a client such as the Codex CLI. The SDK takes
 * care of the encoding/decoding so our implementation only needs to provide
 * the business logic (tools) that the server exposes.
 */
const transport = new StdioServerTransport();
const server = new Server(
  {
    name: 'backlog-mcp',
    version: '0.1.0',
  },
  {
    transport,
  },
);

console.info('[Backlog MCP] Server initialized. Registering tools...');

/**
 * Register a very small "ping" tool that echoes back the caller's message.
 *
 * This is mainly used as a smoke test so that MCP clients can verify the
 * connectivity to the server while the real Backlog tools are being developed.
 */
const serverWithToolRegistry = server as unknown as {
  registerTool?: (definition: unknown) => void;
  tool?: (definition: unknown) => void;
  addTool?: (definition: unknown) => void;
};

const registerTool =
  serverWithToolRegistry.registerTool ??
  serverWithToolRegistry.tool ??
  serverWithToolRegistry.addTool;

const registeredToolNames: string[] = [];

if (!registerTool) {
  console.error('[Backlog MCP] Unable to locate the tool registration API on the SDK server instance.');
  throw new Error('MCP SDK Server does not expose a tool registration method.');
}

registerTool.call(server, {
  name: 'ping',
  description: 'Connectivity test tool that responds with "pong:<input>".',
  inputSchema: {
    type: 'string',
    description: 'Arbitrary text to echo back from the server.',
  },
  async execute(input: PingInput) {
    if (typeof input !== 'string') {
      console.warn(
        `[Backlog MCP] Invalid ping payload received: ${JSON.stringify(input)}`,
      );
      throw new Error('The ping tool expects a string input.');
    }

    console.debug(`[Backlog MCP] Received ping payload: ${input}`);

    const responseText = `pong:${input}`;
    console.debug(`[Backlog MCP] Responding with: ${responseText}`);

    return {
      content: [
        {
          type: 'text',
          text: responseText,
        },
      ],
    };
  },
});
registeredToolNames.push('ping');

const ensureEnv = (value: string | undefined, name: string): string => {
  if (!value) {
    throw new Error(
      `Missing required environment variable ${name} for Backlog MCP server.`,
    );
  }
  return value;
};

const backlogBaseUrl = ensureEnv(process.env.BACKLOG_BASE_URL, 'BACKLOG_BASE_URL');
const backlogApiKey = ensureEnv(process.env.BACKLOG_API_KEY, 'BACKLOG_API_KEY');

let backlogClient: BacklogClient;

try {
  backlogClient = new BacklogClient({
    baseUrl: backlogBaseUrl,
    apiKey: backlogApiKey,
  });
  console.info('[Backlog MCP] Backlog client initialized successfully.');
} catch (clientError) {
  console.error('[Backlog MCP] Failed to initialize Backlog client.', clientError);
  throw clientError;
}

type JsonSchema = Record<string, unknown>;

const positiveIntegerSchema: JsonSchema = {
  type: 'integer',
  minimum: 1,
};

const nonNegativeIntegerSchema: JsonSchema = {
  type: 'integer',
  minimum: 0,
};

const backlogTools: Array<{
  tool: Tool<any, any>;
  inputSchema?: JsonSchema;
}> = [
  {
    tool: createListIssuesTool(backlogClient),
    inputSchema: {
      type: 'object',
      description: 'List issues for a Backlog project.',
      additionalProperties: false,
      required: ['projectKey'],
      properties: {
        projectKey: {
          type: 'string',
          description: 'Backlog project key.',
        },
        keyword: {
          type: 'string',
          description: 'Optional keyword used to filter issues.',
        },
        count: {
          ...positiveIntegerSchema,
          description: 'Maximum number of issues to return.',
        },
      },
    },
  },
  {
    tool: createGetIssueTool(backlogClient),
    inputSchema: {
      type: 'object',
      description: 'Retrieve detailed information about a Backlog issue.',
      additionalProperties: false,
      required: ['issueIdOrKey'],
      properties: {
        issueIdOrKey: {
          type: 'string',
          description: 'Issue ID or key (e.g. PROJECT-123).',
        },
      },
    },
  },
  {
    tool: createCreateIssueTool(backlogClient),
    inputSchema: {
      type: 'object',
      description: 'Create a new Backlog issue.',
      additionalProperties: false,
      required: ['projectKey', 'issue'],
      properties: {
        projectKey: {
          type: 'string',
          description: 'Backlog project key where the issue will be created.',
        },
        issue: {
          type: 'object',
          description: 'Issue payload accepted by Backlog.',
          required: ['summary'],
          properties: {
            summary: {
              type: 'string',
              description: 'Short summary for the issue.',
            },
            description: {
              type: 'string',
              description: 'Detailed description for the issue.',
            },
          },
          additionalProperties: true,
        },
      },
    },
  },
  {
    tool: createUpdateIssueTool(backlogClient),
    inputSchema: {
      type: 'object',
      description: 'Update fields of an existing Backlog issue.',
      additionalProperties: false,
      required: ['issueIdOrKey', 'updates'],
      properties: {
        issueIdOrKey: {
          type: 'string',
          description: 'Issue ID or key to update.',
        },
        updates: {
          type: 'object',
          description: 'Fields to update on the issue.',
          properties: {
            summary: { type: 'string' },
            description: { type: 'string' },
          },
          additionalProperties: true,
        },
      },
    },
  },
  {
    tool: createDeleteIssueTool(backlogClient),
    inputSchema: {
      type: 'object',
      description: 'Delete an existing Backlog issue.',
      additionalProperties: false,
      required: ['issueIdOrKey'],
      properties: {
        issueIdOrKey: {
          type: 'string',
          description: 'Issue ID or key to delete.',
        },
      },
    },
  },
  {
    tool: createTransitionIssueTool(backlogClient),
    inputSchema: {
      type: 'object',
      description: 'Transition a Backlog issue to a new status.',
      additionalProperties: false,
      required: ['issueIdOrKey', 'statusId'],
      properties: {
        issueIdOrKey: {
          type: 'string',
          description: 'Issue ID or key to transition.',
        },
        statusId: {
          ...positiveIntegerSchema,
          description: 'Identifier of the Backlog status to transition to.',
        },
        comment: {
          type: 'string',
          description: 'Optional comment to add while transitioning.',
        },
      },
    },
  },
  {
    tool: createIssuesTool(backlogClient),
    inputSchema: {
      type: 'object',
      description: 'List or create Backlog issues through a single interface.',
      additionalProperties: true,
      required: ['projectKey'],
      properties: {
        projectKey: {
          type: 'string',
          description: 'Backlog project key.',
        },
        action: {
          type: 'string',
          enum: ['list', 'create'],
          description: 'Operation to execute (defaults to list).',
        },
        issue: {
          type: 'object',
          description: 'Issue payload used when action is "create".',
          additionalProperties: true,
        },
        offset: nonNegativeIntegerSchema,
        limit: positiveIntegerSchema,
      },
    },
  },
  {
    tool: createListCommentsTool(backlogClient),
    inputSchema: {
      type: 'object',
      description: 'List comments for a Backlog issue.',
      additionalProperties: false,
      required: ['issueId'],
      properties: {
        issueId: {
          ...positiveIntegerSchema,
          description: 'Numeric issue identifier.',
        },
        offset: nonNegativeIntegerSchema,
        limit: positiveIntegerSchema,
      },
    },
  },
  {
    tool: createAddCommentTool(backlogClient),
    inputSchema: {
      type: 'object',
      description: 'Add a comment to a Backlog issue.',
      additionalProperties: false,
      required: ['issueId', 'comment'],
      properties: {
        issueId: {
          ...positiveIntegerSchema,
          description: 'Numeric issue identifier.',
        },
        comment: {
          type: 'object',
          required: ['content'],
          properties: {
            content: {
              type: 'string',
              description: 'Markdown content of the comment.',
            },
            notifiedUserIds: {
              type: 'array',
              items: positiveIntegerSchema,
              description: 'User identifiers to notify.',
            },
          },
          additionalProperties: true,
        },
      },
    },
  },
  {
    tool: createUpdateCommentTool(backlogClient),
    inputSchema: {
      type: 'object',
      description: 'Update a Backlog comment.',
      additionalProperties: false,
      required: ['issueId', 'commentId', 'updates'],
      properties: {
        issueId: {
          ...positiveIntegerSchema,
          description: 'Numeric issue identifier.',
        },
        commentId: {
          ...positiveIntegerSchema,
          description: 'Identifier of the comment to update.',
        },
        updates: {
          type: 'object',
          properties: {
            content: { type: 'string' },
            notifiedUserIds: {
              type: 'array',
              items: positiveIntegerSchema,
            },
          },
          additionalProperties: true,
        },
      },
    },
  },
  {
    tool: createDeleteCommentTool(backlogClient),
    inputSchema: {
      type: 'object',
      description: 'Delete a Backlog comment.',
      additionalProperties: false,
      required: ['issueId', 'commentId'],
      properties: {
        issueId: {
          ...positiveIntegerSchema,
          description: 'Numeric issue identifier.',
        },
        commentId: {
          ...positiveIntegerSchema,
          description: 'Identifier of the comment to delete.',
        },
      },
    },
  },
  {
    tool: createAttachmentsTool(backlogClient),
    inputSchema: {
      type: 'object',
      description: 'List, upload, or delete Backlog attachments.',
      additionalProperties: false,
      required: ['issueId'],
      properties: {
        issueId: {
          ...positiveIntegerSchema,
          description: 'Numeric issue identifier.',
        },
        action: {
          type: 'string',
          enum: ['list', 'upload', 'delete'],
          description: 'Attachment operation to execute.',
        },
        attachment: {
          type: 'object',
          description: 'Attachment payload used when uploading.',
          required: ['fileName', 'contentType', 'data'],
          properties: {
            fileName: { type: 'string' },
            contentType: { type: 'string' },
            data: {
              type: 'string',
              description: 'Base64 encoded file content.',
            },
          },
          additionalProperties: true,
        },
        attachmentId: {
          ...positiveIntegerSchema,
          description: 'Attachment identifier used for deletion.',
        },
      },
    },
  },
  {
    tool: createActivitiesTool(backlogClient),
    inputSchema: {
      type: 'object',
      description: 'List Backlog project activities.',
      additionalProperties: false,
      required: ['projectKey'],
      properties: {
        projectKey: {
          type: 'string',
          description: 'Backlog project key.',
        },
        offset: nonNegativeIntegerSchema,
        limit: positiveIntegerSchema,
      },
    },
  },
  {
    tool: createSearchWikiTool(backlogClient),
    inputSchema: {
      type: 'object',
      description: 'Search Backlog wiki pages within a project.',
      additionalProperties: false,
      required: ['projectKeyOrId'],
      properties: {
        projectKeyOrId: {
          description: 'Project key or identifier.',
          anyOf: [
            { type: 'string' },
            { ...positiveIntegerSchema },
          ],
        },
        keyword: {
          type: 'string',
          description: 'Keyword to match within wiki pages.',
        },
        offset: nonNegativeIntegerSchema,
        limit: positiveIntegerSchema,
      },
    },
  },
  {
    tool: createGetWikiTool(backlogClient),
    inputSchema: {
      type: 'object',
      description: 'Retrieve a Backlog wiki page by identifier.',
      additionalProperties: false,
      required: ['wikiId'],
      properties: {
        wikiId: {
          ...positiveIntegerSchema,
          description: 'Identifier of the wiki page.',
        },
      },
    },
  },
  {
    tool: createCreateWikiTool(backlogClient),
    inputSchema: {
      type: 'object',
      description: 'Create a Backlog wiki page.',
      additionalProperties: false,
      required: ['projectId', 'name'],
      properties: {
        projectId: {
          ...positiveIntegerSchema,
          description: 'Numeric identifier of the project.',
        },
        name: {
          type: 'string',
          description: 'Wiki page title.',
        },
        content: {
          type: 'string',
          description: 'Wiki page body.',
        },
        mailNotify: {
          type: 'boolean',
          description: 'Whether to send notification emails.',
        },
      },
    },
  },
  {
    tool: createUpdateWikiTool(backlogClient),
    inputSchema: {
      type: 'object',
      description: 'Update an existing Backlog wiki page.',
      additionalProperties: false,
      required: ['wikiId', 'updates'],
      properties: {
        wikiId: {
          ...positiveIntegerSchema,
          description: 'Identifier of the wiki page to update.',
        },
        updates: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            content: { type: 'string' },
            mailNotify: { type: 'boolean' },
          },
          additionalProperties: true,
        },
      },
    },
  },
  {
    tool: createDeleteWikiTool(backlogClient),
    inputSchema: {
      type: 'object',
      description: 'Delete a Backlog wiki page.',
      additionalProperties: false,
      required: ['wikiId'],
      properties: {
        wikiId: {
          ...positiveIntegerSchema,
          description: 'Identifier of the wiki page to delete.',
        },
      },
    },
  },
  {
    tool: createWikiTool(backlogClient),
    inputSchema: {
      type: 'object',
      description: 'List wiki pages for a Backlog project.',
      additionalProperties: true,
      required: ['projectKeyOrId'],
      properties: {
        projectKeyOrId: {
          type: 'string',
          description: 'Project key identifying the wiki collection.',
        },
        offset: nonNegativeIntegerSchema,
        limit: positiveIntegerSchema,
      },
    },
  },
];

const formatToolResult = (toolName: string, result: unknown): string => {
  if (result === undefined || result === null) {
    return `${toolName} executed successfully.`;
  }

  if (typeof result === 'string') {
    return result;
  }

  try {
    return JSON.stringify(result, null, 2);
  } catch (stringifyError) {
    console.debug(
      `[Backlog MCP] Unable to stringify result for tool ${toolName}.`,
      stringifyError,
    );
    return String(result);
  }
};

for (const { tool, inputSchema } of backlogTools) {
  registerTool.call(server, {
    name: tool.name,
    description: tool.description,
    inputSchema,
    async execute(payload: unknown) {
      try {
        const result = await tool.execute(payload as never);

        const formatted = formatToolResult(tool.name, result);
        const response: {
          content: { type: 'text'; text: string }[];
          structuredContent?: unknown;
        } = {
          content: [
            {
              type: 'text',
              text: formatted,
            },
          ],
        };

        if (result !== undefined) {
          response.structuredContent = result;
        }

        return response;
      } catch (toolError) {
        handleError(toolError, { toolName: tool.name });
      }
    },
  });

  registeredToolNames.push(tool.name);
}

console.info(`[Backlog MCP] Registered tools: ${registeredToolNames.join(', ')}`);

console.info('[Backlog MCP] Starting server using stdio transport...');

// Different SDK versions accept the transport either through the constructor or
// as a parameter for `start`. We bind the method so we can dynamically detect
// the supported signature at runtime while keeping the implementation concise.
const startServer = server.start.bind(server) as
  | (() => Promise<void>)
  | ((transport: StdioServerTransport) => Promise<void>);

if (typeof startServer !== 'function') {
  throw new Error('MCP SDK Server start method is not callable.');
}

const startResult =
  startServer.length > 0
    ? (startServer as (transport: StdioServerTransport) => unknown)(transport)
    : (startServer as () => unknown)();

// Normalize the result into a promise so that both sync and async signatures are
// handled uniformly.
Promise.resolve(startResult)
  .then(() => {
    console.info('[Backlog MCP] Server is ready to accept MCP requests.');
  })
  .catch((error: unknown) => {
    console.error('[Backlog MCP] Failed to start the MCP server.', error);
    process.exitCode = 1;
  });

export { server, transport };
