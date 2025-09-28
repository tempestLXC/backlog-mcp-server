import { ErrorCode, McpError } from '@modelcontextprotocol/sdk/types';
import { ZodError } from 'zod';

import { BacklogError, handleError, normalizeError } from '../src/utils/errors';

describe('BacklogError', () => {
  it('preserves status and details information', () => {
    const original = new BacklogError('Not found', {
      status: 404,
      details: { resource: 'issue' },
    });

    expect(original.status).toBe(404);
    expect(original.details).toEqual({ resource: 'issue' });
  });

  it('marks fallback errors as the cause when normalizing', () => {
    const fallback = new BacklogError('Fallback', { status: 400 });
    const normalized = normalizeError({ foo: 'bar' }, fallback);

    expect(normalized).toBeInstanceOf(BacklogError);
    expect(normalized.message).toBe('Fallback');
    expect((normalized as { cause?: unknown }).cause).toBe(fallback);
    expect(normalized.details).toEqual({ foo: 'bar' });
  });
});

describe('handleError', () => {
  it('converts Backlog authentication failures into MCP errors', () => {
    const error = new BacklogError('Auth failed', { status: 401 });

    try {
      handleError(error, { toolName: 'listIssues' });
      fail('handleError should throw');
    } catch (thrown) {
      expect(thrown).toBeInstanceOf(McpError);
      const mcpError = thrown as McpError;
      expect(mcpError.code).toBe(-32002);
      expect(mcpError.message).toContain('[listIssues] Backlog authentication failed.');
      expect(mcpError.data).toEqual({ status: 401 });
    }
  });

  it('wraps Zod validation errors', () => {
    const zodError = new ZodError([]);

    try {
      handleError(zodError, { toolName: 'createIssue' });
      fail('handleError should throw');
    } catch (thrown) {
      expect(thrown).toBeInstanceOf(McpError);
      const mcpError = thrown as McpError;
      expect(mcpError.code).toBe(ErrorCode.InvalidParams);
      expect(mcpError.message).toContain(
        '[createIssue] Invalid parameters provided for Backlog tool.',
      );
      expect(mcpError.data).toEqual({ issues: [] });
    }
  });

  it('extracts HTTP status codes from error messages', () => {
    const cause = new Error('Request failed with status 503');

    try {
      handleError(cause, { toolName: 'attachments' });
      fail('handleError should throw');
    } catch (thrown) {
      expect(thrown).toBeInstanceOf(McpError);
      const mcpError = thrown as McpError;
      expect(mcpError.code).toBe(ErrorCode.InternalError);
      expect(mcpError.message).toContain(
        '[attachments] Backlog service encountered an internal error.',
      );
      expect(mcpError.data).toMatchObject({ status: 503, cause });
    }
  });

  it('uses the fallback message when provided', () => {
    try {
      handleError('unexpected', {
        toolName: 'createWiki',
        fallbackMessage: 'Unable to complete the request.',
      });
      fail('handleError should throw');
    } catch (thrown) {
      expect(thrown).toBeInstanceOf(McpError);
      const mcpError = thrown as McpError;
      expect(mcpError.code).toBe(ErrorCode.InternalError);
      expect(mcpError.message).toContain('[createWiki] Unable to complete the request.');
    }
  });

  it('handles Backlog rate limit responses consistently', () => {
    try {
      handleError('RATE_LIMIT', { toolName: 'listComments' });
      fail('handleError should throw');
    } catch (thrown) {
      expect(thrown).toBeInstanceOf(McpError);
      const mcpError = thrown as McpError;
      expect(mcpError.code).toBe(-32004);
      expect(mcpError.message).toContain('[listComments] Backlog API rate limit exceeded.');
      expect(mcpError.data).toEqual({ status: 429 });
    }
  });
});
