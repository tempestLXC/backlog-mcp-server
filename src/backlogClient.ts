import { createAuthHeaders } from './utils/auth';
import { BacklogError, normalizeError } from './utils/errors';
import { PaginationOptions, buildPaginationParams } from './utils/pagination';

export interface BacklogConfig {
  baseUrl: string;
  apiKey: string;
}

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

type QueryParameters = Record<string, string | number | boolean | undefined>;

type ClientRequestOptions = {
  payload?: unknown;
  query?: QueryParameters;
};

export type IssuePayload = {
  summary: string;
  description?: string;
  [key: string]: unknown;
};

export type CommentPayload = {
  content: string;
  notifiedUserIds?: number[];
  [key: string]: unknown;
};

export type AttachmentPayload = {
  fileName: string;
  contentType: string;
  data: string;
};

const RATE_LIMIT_ERROR = 'RATE_LIMIT' as const;

export class BacklogClient {
  private readonly baseUrl: string;
  private readonly apiKey: string;

  constructor(config: BacklogConfig);
  constructor(baseUrl: string, apiKey: string);
  constructor(baseUrlOrConfig: string | BacklogConfig, apiKey?: string) {
    if (typeof baseUrlOrConfig === 'string') {
      this.baseUrl = this.normalizeBaseUrl(baseUrlOrConfig);
      this.apiKey = apiKey ?? '';
    } else {
      this.baseUrl = this.normalizeBaseUrl(baseUrlOrConfig.baseUrl);
      this.apiKey = baseUrlOrConfig.apiKey ?? '';
    }

    if (!this.baseUrl) {
      throw new Error('Backlog base URL is required.');
    }

    if (!this.apiKey) {
      throw new Error('Backlog API key is required.');
    }
  }

  /**
   * Execute a HTTP GET request against the Backlog REST API.
   */
  public get<T>(path: string, query?: QueryParameters): Promise<T> {
    return this.request<T>('GET', path, { query });
  }

  /**
   * Execute a HTTP POST request against the Backlog REST API.
   */
  public post<T>(path: string, payload?: unknown, query?: QueryParameters): Promise<T> {
    return this.request<T>('POST', path, { payload, query });
  }

  /**
   * Execute a HTTP PATCH request against the Backlog REST API.
   */
  public patch<T>(path: string, payload?: unknown, query?: QueryParameters): Promise<T> {
    return this.request<T>('PATCH', path, { payload, query });
  }

  /**
   * Execute a HTTP DELETE request against the Backlog REST API.
   */
  public delete<T>(path: string, query?: QueryParameters): Promise<T> {
    return this.request<T>('DELETE', path, { query });
  }

  public async listIssues(projectKey: string, pagination?: PaginationOptions) {
    return this.get(`/projects/${projectKey}/issues`, buildPaginationParams(pagination));
  }

  public async createIssue(projectKey: string, payload: IssuePayload) {
    return this.post(`/projects/${projectKey}/issues`, payload);
  }

  public async listComments(issueId: number, pagination?: PaginationOptions) {
    return this.get(`/issues/${issueId}/comments`, buildPaginationParams(pagination));
  }

  public async createComment(issueId: number, payload: CommentPayload) {
    return this.post(`/issues/${issueId}/comments`, payload);
  }

  public async listWikiPages(projectIdOrKey: string, pagination?: PaginationOptions) {
    return this.get(`/projects/${projectIdOrKey}/wikis`, buildPaginationParams(pagination));
  }

  public async listAttachments(issueId: number) {
    return this.get(`/issues/${issueId}/attachments`);
  }

  public async uploadAttachment(issueId: number, payload: AttachmentPayload) {
    return this.post(`/issues/${issueId}/attachments`, payload);
  }

  public async listActivities(projectKey: string, pagination?: PaginationOptions) {
    return this.get(`/projects/${projectKey}/activities`, buildPaginationParams(pagination));
  }

  private buildUrl(path: string, query?: QueryParameters): string {
    const sanitizedPath = path.startsWith('/') ? path.slice(1) : path;
    const url = new URL(sanitizedPath, this.baseUrl);

    if (query) {
      for (const [key, value] of Object.entries(query)) {
        if (value !== undefined && value !== null) {
          url.searchParams.set(key, String(value));
        }
      }
    }

    // Always append the API key to satisfy Backlog authentication.
    url.searchParams.set('apiKey', this.apiKey);

    return url.toString();
  }

  private normalizeBaseUrl(baseUrl: string): string {
    const trimmed = baseUrl.trim();
    if (!trimmed) {
      return trimmed;
    }

    return trimmed.endsWith('/') ? trimmed : `${trimmed}/`;
  }

  private async request<T>(
    method: HttpMethod,
    path: string,
    options: ClientRequestOptions = {},
  ): Promise<T> {
    const url = this.buildUrl(path, options.query);
    const headers: Record<string, string> = {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...createAuthHeaders({ apiKey: this.apiKey }),
    };

    const fetchOptions = {
      method,
      headers,
      body:
        options.payload === undefined ? undefined : JSON.stringify(options.payload),
    };

    try {
      console.debug(`[BacklogClient] ${method} ${url}`);
      const response = await fetch(url, fetchOptions as Parameters<typeof fetch>[1]);

      console.debug(`[BacklogClient] ${method} ${url} -> ${response.status}`);

      if (response.status === 429) {
        console.warn(`[BacklogClient] Rate limit reached for ${method} ${url}`);
        throw RATE_LIMIT_ERROR;
      }

      if (!response.ok) {
        const errorText = await this.safeReadError(response);
        const errorMessage =
          `[BacklogClient] Request failed ${method} ${url}: ${response.status} ${response.statusText}` +
          (errorText ? ` - ${errorText}` : '');

        console.error(errorMessage);
        throw new Error(`Backlog request failed with status ${response.status}`);
      }

      if (response.status === 204 || response.status === 205) {
        console.debug(`[BacklogClient] ${method} ${url} returned no content.`);
        return undefined as T;
      }

      try {
        const json = (await response.json()) as T;
        return json;
      } catch (parseError) {
        console.error(
          `[BacklogClient] Failed to parse JSON response for ${method} ${url}.`,
          parseError,
        );

        if (parseError instanceof Error) {
          throw parseError;
        }

        throw new Error('Failed to parse Backlog response as JSON.');
      }
    } catch (error) {
      if (error === RATE_LIMIT_ERROR) {
        // Rate limit errors are propagated as-is so callers can implement retries.
        throw error;
      }

      if (error instanceof Error) {
        console.error(
          `[BacklogClient] Error while executing ${method} ${url}: ${error.message}`,
        );
        throw error;
      }

      console.error(
        `[BacklogClient] Unexpected non-error thrown while executing ${method} ${url}.`,
        error,
      );
      throw normalizeError(error, new BacklogError('Failed to execute Backlog request'));
    }
  }

  private async safeReadError(response: Awaited<ReturnType<typeof fetch>>): Promise<string | undefined> {
    try {
      const text = await response.text();
      const trimmed = text.trim();
      return trimmed.length > 0 ? trimmed : undefined;
    } catch (readError) {
      console.debug('[BacklogClient] Unable to read error response body.', readError);
      return undefined;
    }
  }
}
