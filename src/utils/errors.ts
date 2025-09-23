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
