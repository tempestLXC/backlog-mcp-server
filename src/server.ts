import { Server, StdioServerTransport } from '@modelcontextprotocol/sdk/server';

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

console.info('[Backlog MCP] Registered tools: ping');

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
