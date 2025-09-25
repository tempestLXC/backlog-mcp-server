import { ErrorCode, McpError } from '@modelcontextprotocol/sdk/types';
import { ZodError } from 'zod';

export interface BacklogErrorOptions {
  status?: number;
  cause?: unknown;
  details?: unknown;
}

export class BacklogError extends Error {
  public readonly status?: number;
  public readonly details?: unknown;

  constructor(message: string, options: BacklogErrorOptions = {}) {
    super(message);
    this.name = 'BacklogError';
    this.status = options.status;
    this.details = options.details;

    if (options.cause !== undefined) {
      (this as { cause?: unknown }).cause = options.cause;
    }
  }
}

export const isBacklogError = (error: unknown): error is BacklogError =>
  error instanceof BacklogError;

export const normalizeError = (
  error: unknown,
  fallback?: BacklogError,
): BacklogError => {
  if (isBacklogError(error)) {
    return error;
  }

  if (error instanceof Error) {
    return new BacklogError(error.message, { cause: error });
  }

  if (fallback) {
    return new BacklogError(fallback.message, {
      cause: fallback,
      details: error,
    });
  }

  return new BacklogError('Unknown Backlog client error', { details: error });
};

const MCP_CUSTOM_ERROR_CODES = {
  UNAUTHENTICATED: -32002,
  PERMISSION_DENIED: -32003,
  UNAVAILABLE: -32004,
} as const;

const RATE_LIMIT_TOKEN = 'RATE_LIMIT';

const buildErrorMessage = (message: string, toolName?: string) =>
  toolName ? `[${toolName}] ${message}` : message;

export interface HandleErrorOptions {
  /**
   * The name of the tool that encountered the error. When provided it will be
   * included as a prefix in the error message to aid debugging from MCP
   * clients.
   */
  toolName?: string;

  /**
   * Optional fallback message if the incoming error does not provide one.
   */
  fallbackMessage?: string;
}

export const handleError = (
  error: unknown,
  options: HandleErrorOptions = {},
): never => {
  const { toolName, fallbackMessage } = options;

  if (error instanceof McpError) {
    throw error;
  }

  if (error === RATE_LIMIT_TOKEN) {
    throw new McpError(
      MCP_CUSTOM_ERROR_CODES.UNAVAILABLE,
      buildErrorMessage('Backlog API rate limit exceeded.', toolName),
      { status: 429 },
    );
  }

  if (error instanceof ZodError) {
    throw new McpError(
      ErrorCode.InvalidParams,
      buildErrorMessage('Invalid parameters provided for Backlog tool.', toolName),
      { issues: error.issues },
    );
  }

  const fallbackError =
    fallbackMessage !== undefined ? new BacklogError(fallbackMessage) : undefined;
  const normalized = normalizeError(error, fallbackError);

  let status = normalized.status;

  if (status === undefined && typeof normalized.message === 'string') {
    const statusMatch = normalized.message.match(/status\s+(\d{3})/i);
    if (statusMatch) {
      status = Number(statusMatch[1]);
    }
  }

  const data: Record<string, unknown> = {};

  if (status !== undefined) {
    data.status = status;
  }

  if (normalized.details !== undefined) {
    data.details = normalized.details;
  }

  const cause = (normalized as { cause?: unknown }).cause;
  if (cause !== undefined) {
    data.cause = cause;
  }

  if (status === 401) {
    throw new McpError(
      MCP_CUSTOM_ERROR_CODES.UNAUTHENTICATED,
      buildErrorMessage('Backlog authentication failed.', toolName),
      data,
    );
  }

  if (status === 403) {
    throw new McpError(
      MCP_CUSTOM_ERROR_CODES.PERMISSION_DENIED,
      buildErrorMessage('Backlog permission denied.', toolName),
      data,
    );
  }

  if (status === 404) {
    throw new McpError(
      ErrorCode.InvalidParams,
      buildErrorMessage('Requested Backlog resource was not found.', toolName),
      data,
    );
  }

  if (status === 429) {
    throw new McpError(
      MCP_CUSTOM_ERROR_CODES.UNAVAILABLE,
      buildErrorMessage('Backlog API rate limit exceeded.', toolName),
      data,
    );
  }

  if (status !== undefined && status >= 400 && status < 500) {
    throw new McpError(
      ErrorCode.InvalidParams,
      buildErrorMessage(normalized.message, toolName),
      data,
    );
  }

  if (status !== undefined && status >= 500) {
    throw new McpError(
      ErrorCode.InternalError,
      buildErrorMessage('Backlog service encountered an internal error.', toolName),
      data,
    );
  }

  throw new McpError(
    ErrorCode.InternalError,
    buildErrorMessage(normalized.message, toolName),
    data,
  );
};
