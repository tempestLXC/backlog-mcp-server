export interface PaginationOptions {
  offset?: number;
  limit?: number;
}

export const normalizePagination = (
  options?: PaginationOptions,
): PaginationOptions | undefined => {
  if (!options) {
    return undefined;
  }

  const normalized: PaginationOptions = {};

  if (typeof options.offset === 'number' && Number.isFinite(options.offset)) {
    normalized.offset = Math.max(0, Math.floor(options.offset));
  }

  if (typeof options.limit === 'number' && Number.isFinite(options.limit)) {
    normalized.limit = Math.max(1, Math.floor(options.limit));
  }

  return normalized;
};

export const buildPaginationParams = (
  options?: PaginationOptions,
): Record<string, number> | undefined => {
  const normalized = normalizePagination(options);

  if (!normalized) {
    return undefined;
  }

  const params: Record<string, number> = {};

  if (normalized.offset !== undefined) {
    params.offset = normalized.offset;
  }

  if (normalized.limit !== undefined) {
    params.count = normalized.limit;
  }

  return Object.keys(params).length > 0 ? params : undefined;
};
