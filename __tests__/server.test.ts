import type { Tool } from '../src/tools/issues';

type ToolKey =
  | 'listIssues'
  | 'getIssue'
  | 'createIssue'
  | 'updateIssue'
  | 'deleteIssue'
  | 'transitionIssue'
  | 'issues'
  | 'listComments'
  | 'addComment'
  | 'updateComment'
  | 'deleteComment'
  | 'attachments'
  | 'activities'
  | 'searchWiki'
  | 'getWiki'
  | 'createWiki'
  | 'updateWiki'
  | 'deleteWiki'
  | 'wiki';

type ToolMock = Tool<unknown, unknown> & { execute: jest.Mock };

type ActiveContext = {
  toolInstances: Record<ToolKey, ToolMock>;
  registerToolMock: jest.Mock;
  connectMock: jest.Mock;
  serverInstance: { registerTool: jest.Mock; connect: jest.Mock };
  transportInstance: Record<string, unknown>;
  backlogClientInstance: Record<string, unknown>;
  handleErrorMock: jest.Mock;
  moduleExports?: typeof import('../src/server');
};

let activeContext: ActiveContext;

const createMockTool = (name: ToolKey): ToolMock => ({
  name,
  description: `${name} tool`,
  execute: jest.fn(),
});

jest.mock('@modelcontextprotocol/sdk/server', () => ({
  Server: jest.fn(() => activeContext.serverInstance),
}));

jest.mock('@modelcontextprotocol/sdk/server/stdio', () => ({
  StdioServerTransport: jest.fn(() => activeContext.transportInstance),
}));

jest.mock('../src/backlogClient', () => ({
  BacklogClient: jest.fn(() => activeContext.backlogClientInstance),
}));

jest.mock('../src/utils/errors', () => ({
  handleError: jest.fn((...args) => activeContext.handleErrorMock(...args)),
}));

jest.mock('../src/tools/issues', () => ({
  createListIssuesTool: jest.fn(() => activeContext.toolInstances.listIssues),
  createGetIssueTool: jest.fn(() => activeContext.toolInstances.getIssue),
  createCreateIssueTool: jest.fn(() => activeContext.toolInstances.createIssue),
  createUpdateIssueTool: jest.fn(() => activeContext.toolInstances.updateIssue),
  createDeleteIssueTool: jest.fn(() => activeContext.toolInstances.deleteIssue),
  createTransitionIssueTool: jest.fn(() => activeContext.toolInstances.transitionIssue),
  createIssuesTool: jest.fn(() => activeContext.toolInstances.issues),
}));

jest.mock('../src/tools/comments', () => ({
  createListCommentsTool: jest.fn(() => activeContext.toolInstances.listComments),
  createAddCommentTool: jest.fn(() => activeContext.toolInstances.addComment),
  createUpdateCommentTool: jest.fn(() => activeContext.toolInstances.updateComment),
  createDeleteCommentTool: jest.fn(() => activeContext.toolInstances.deleteComment),
}));

jest.mock('../src/tools/attachments', () => ({
  createAttachmentsTool: jest.fn(() => activeContext.toolInstances.attachments),
}));

jest.mock('../src/tools/activities', () => ({
  createActivitiesTool: jest.fn(() => activeContext.toolInstances.activities),
}));

jest.mock('../src/tools/wiki', () => ({
  createSearchWikiTool: jest.fn(() => activeContext.toolInstances.searchWiki),
  createGetWikiTool: jest.fn(() => activeContext.toolInstances.getWiki),
  createCreateWikiTool: jest.fn(() => activeContext.toolInstances.createWiki),
  createUpdateWikiTool: jest.fn(() => activeContext.toolInstances.updateWiki),
  createDeleteWikiTool: jest.fn(() => activeContext.toolInstances.deleteWiki),
  createWikiTool: jest.fn(() => activeContext.toolInstances.wiki),
}));

const allToolKeys: ToolKey[] = [
  'listIssues',
  'getIssue',
  'createIssue',
  'updateIssue',
  'deleteIssue',
  'transitionIssue',
  'issues',
  'listComments',
  'addComment',
  'updateComment',
  'deleteComment',
  'attachments',
  'activities',
  'searchWiki',
  'getWiki',
  'createWiki',
  'updateWiki',
  'deleteWiki',
  'wiki',
];

const originalEnv = process.env;

beforeEach(() => {
  jest.resetModules();
  jest.clearAllMocks();
  process.env = { ...originalEnv };
});

afterAll(() => {
  process.env = originalEnv;
});

const createContext = (): ActiveContext => {
  const toolInstances = Object.fromEntries(
    allToolKeys.map((key) => [key, createMockTool(key)]),
  ) as Record<ToolKey, ToolMock>;

  const registerToolMock = jest.fn();
  const connectMock = jest.fn().mockResolvedValue(undefined);

  return {
    toolInstances,
    registerToolMock,
    connectMock,
    serverInstance: { registerTool: registerToolMock, connect: connectMock },
    transportInstance: { kind: 'transport' },
    backlogClientInstance: {},
    handleErrorMock: jest.fn(),
  };
};

const loadServerModule = (context: ActiveContext) => {
  activeContext = context;
  context.moduleExports = require('../src/server');
  return context.moduleExports!;
};

const getRegisteredTool = (context: ActiveContext, name: string) =>
  context.registerToolMock.mock.calls.find(([definition]) => definition.name === name)?.[0];

describe('server initialization', () => {
  it('registers ping and Backlog tools and exports the server and transport instances', async () => {
    process.env.BACKLOG_BASE_URL = 'https://example.backlog';
    process.env.BACKLOG_API_KEY = 'test-key';

    const context = createContext();
    const moduleExports = loadServerModule(context);

    const { Server } = require('@modelcontextprotocol/sdk/server');
    const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio');
    const { BacklogClient } = require('../src/backlogClient');

    expect(Server).toHaveBeenCalledTimes(1);
    expect(StdioServerTransport).toHaveBeenCalledTimes(1);
    expect(BacklogClient).toHaveBeenCalledWith({
      baseUrl: 'https://example.backlog',
      apiKey: 'test-key',
    });

    expect(context.registerToolMock).toHaveBeenCalledTimes(1 + allToolKeys.length);

    const pingRegistration = getRegisteredTool(context, 'ping');
    expect(pingRegistration).toBeDefined();
    const pingResult = await pingRegistration!.execute('hello');
    expect(pingResult).toEqual({
      content: [
        {
          type: 'text',
          text: 'pong:hello',
        },
      ],
    });

    const listIssuesRegistration = getRegisteredTool(context, 'listIssues');
    expect(listIssuesRegistration).toBeDefined();
    context.toolInstances.listIssues.execute.mockResolvedValueOnce({ success: true });
    const wrappedResult = await listIssuesRegistration!.execute({ projectKey: 'EXAMPLE' });
    expect(context.toolInstances.listIssues.execute).toHaveBeenCalledWith({ projectKey: 'EXAMPLE' });
    expect(wrappedResult).toEqual({
      content: [
        {
          type: 'text',
          text: JSON.stringify({ success: true }, null, 2),
        },
      ],
      structuredContent: { success: true },
    });

    expect(moduleExports.server).toBe(context.serverInstance);
    expect(moduleExports.transport).toBe(context.transportInstance);
  });

  it('delegates tool failures to the shared error handler', async () => {
    process.env.BACKLOG_BASE_URL = 'https://example.backlog';
    process.env.BACKLOG_API_KEY = 'test-key';

    const context = createContext();
    const moduleExports = loadServerModule(context);
    expect(moduleExports).toBeDefined();

    const failingRegistration = getRegisteredTool(context, 'listIssues');
    expect(failingRegistration).toBeDefined();

    const failure = new Error('boom');
    context.toolInstances.listIssues.execute.mockRejectedValueOnce(failure);
    context.handleErrorMock.mockImplementationOnce(() => {
      throw new Error('handled');
    });

    await expect(failingRegistration!.execute({})).rejects.toThrow('handled');
    expect(context.handleErrorMock).toHaveBeenCalledWith(failure, { toolName: 'listIssues' });
  });

  it('throws a descriptive error when required environment variables are missing', () => {
    delete process.env.BACKLOG_BASE_URL;
    process.env.BACKLOG_API_KEY = 'present';

    const context = createContext();

    expect(() => loadServerModule(context)).toThrow(
      'Missing required environment variable BACKLOG_BASE_URL for Backlog MCP server.',
    );
  });
});
