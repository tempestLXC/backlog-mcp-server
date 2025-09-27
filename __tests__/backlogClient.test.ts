import { BacklogClient } from '../src/backlogClient';
import { createAuthHeaders } from '../src/utils/auth';

jest.mock('../src/utils/auth', () => ({
  createAuthHeaders: jest.fn(),
}));

describe('BacklogClient', () => {
  const originalFetch = globalThis.fetch;
  const fetchMock = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (createAuthHeaders as jest.Mock).mockReturnValue({ 'X-API-Key': 'mock-header' });
    fetchMock.mockReset();
    globalThis.fetch = fetchMock as unknown as typeof fetch;
  });

  afterAll(() => {
    globalThis.fetch = originalFetch;
  });

  it('performs GET requests with normalized URL, query parameters, and headers', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      json: jest.fn().mockResolvedValue({ id: 1 }),
    });

    const client = new BacklogClient({
      baseUrl: 'https://example.com/api',
      apiKey: 'secret',
    });

    await client.get('/projects', { status: 'open', includeClosed: false, optional: undefined });

    expect(createAuthHeaders).toHaveBeenCalledWith({ apiKey: 'secret' });
    expect(fetchMock).toHaveBeenCalledWith(
      'https://example.com/api/projects?status=open&includeClosed=false&apiKey=secret',
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({
          Accept: 'application/json',
          'Content-Type': 'application/json',
          'X-API-Key': 'mock-header',
        }),
        body: undefined,
      }),
    );
  });

  it('serializes payloads for POST requests and returns parsed JSON responses', async () => {
    const payload = { summary: 'Test issue' };
    const responseBody = { id: 42 };

    fetchMock.mockResolvedValue({
      ok: true,
      status: 201,
      statusText: 'Created',
      json: jest.fn().mockResolvedValue(responseBody),
    });

    const client = new BacklogClient('https://backlog.test/', 'api-key');
    const result = await client.post('/issues', payload);

    expect(fetchMock).toHaveBeenCalledWith(
      'https://backlog.test/issues?apiKey=api-key',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    );
    expect(result).toEqual(responseBody);
  });

  it('propagates rate limit responses as a special token', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 429,
      statusText: 'Too Many Requests',
      json: jest.fn(),
    });

    const client = new BacklogClient('https://backlog.test/', 'key');

    await expect(client.get('/issues')).rejects.toBe('RATE_LIMIT');
  });

  it('throws descriptive errors for failed requests and preserves response details', async () => {
    const errorText = 'Something went wrong';
    fetchMock.mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Server Error',
      text: jest.fn().mockResolvedValue(`  ${errorText}  `),
      json: jest.fn(),
    });

    const client = new BacklogClient('https://backlog.test/', 'key');

    await expect(client.delete('/issues/1')).rejects.toThrow('Backlog request failed with status 500');
  });

  it('returns undefined for 204 responses and rethrows JSON parsing errors', async () => {
    const client = new BacklogClient('https://backlog.test/', 'key');

    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 204,
      statusText: 'No Content',
      json: jest.fn(),
    });

    const noContent = await client.delete('/issues/1');
    expect(noContent).toBeUndefined();

    const parseError = new Error('Invalid JSON');
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      statusText: 'OK',
      json: jest.fn().mockRejectedValue(parseError),
    });

    await expect(client.get('/issues/2')).rejects.toThrow(parseError);
  });
});
