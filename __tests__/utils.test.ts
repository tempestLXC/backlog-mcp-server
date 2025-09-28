import { createAuthHeaders } from '../src/utils/auth';
import { BacklogError, isBacklogError, normalizeError } from '../src/utils/errors';

describe('createAuthHeaders', () => {
  it('returns an API key header when provided', () => {
    const headers = createAuthHeaders({ apiKey: 'test-key' });

    expect(headers).toEqual({ 'X-API-Key': 'test-key' });
  });

  it('throws when no API key is configured', () => {
    expect(() => createAuthHeaders({ apiKey: '' })).toThrow(
      'Backlog API key is required to authenticate requests.',
    );
  });
});

describe('Backlog utility helpers', () => {
  it('identifies BacklogError instances', () => {
    const error = new BacklogError('oops');

    expect(isBacklogError(error)).toBe(true);
    expect(isBacklogError(new Error('nope'))).toBe(false);
  });

  it('normalizes unknown values into BacklogError instances', () => {
    const normalized = normalizeError({ unexpected: true });

    expect(normalized).toBeInstanceOf(BacklogError);
    expect(normalized.message).toBe('Unknown Backlog client error');
    expect(normalized.details).toEqual({ unexpected: true });
  });
});
