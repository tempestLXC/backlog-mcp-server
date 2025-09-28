import { buildPaginationParams, normalizePagination } from '../src/utils/pagination';

describe('normalizePagination', () => {
  it('returns undefined when no options provided', () => {
    expect(normalizePagination()).toBeUndefined();
  });

  it('sanitizes offset and limit values', () => {
    expect(
      normalizePagination({
        offset: -5.7,
        limit: 0,
      }),
    ).toEqual({ offset: 0, limit: 1 });
  });

  it('discards invalid pagination values', () => {
    expect(
      normalizePagination({
        offset: Number.NaN,
        limit: Number.POSITIVE_INFINITY,
      }),
    ).toEqual({});
  });
});

describe('buildPaginationParams', () => {
  it('returns undefined when no normalized values exist', () => {
    expect(buildPaginationParams(undefined)).toBeUndefined();
    expect(
      buildPaginationParams({
        offset: Number.NaN,
        limit: Number.NaN,
      }),
    ).toBeUndefined();
  });

  it('maps normalized fields to Backlog query parameters', () => {
    expect(
      buildPaginationParams({
        offset: 12.9,
      }),
    ).toEqual({ offset: 12 });

    expect(
      buildPaginationParams({
        limit: 25.2,
      }),
    ).toEqual({ count: 25 });

    expect(
      buildPaginationParams({
        offset: 5.8,
        limit: 10.1,
      }),
    ).toEqual({ offset: 5, count: 10 });
  });
});
