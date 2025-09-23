import { createAuthHeaders } from './utils/auth';
import { BacklogError, normalizeError } from './utils/errors';
import { PaginationOptions, buildPaginationParams } from './utils/pagination';

export interface BacklogConfig {
  baseUrl: string;
  apiKey: string;
}

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE';

type ClientRequestOptions = {
  method?: HttpMethod;
  payload?: unknown;
  query?: Record<string, string | number | undefined>;
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

export class BacklogClient {
  constructor(private readonly config: BacklogConfig) {}

  public async listIssues(projectKey: string, pagination?: PaginationOptions) {
    return this.request(`/projects/${projectKey}/issues`, {
      method: 'GET',
      query: buildPaginationParams(pagination),
    });
  }

  public async createIssue(projectKey: string, payload: IssuePayload) {
    return this.request(`/projects/${projectKey}/issues`, {
      method: 'POST',
      payload,
    });
  }

  public async listComments(issueId: number, pagination?: PaginationOptions) {
    return this.request(`/issues/${issueId}/comments`, {
      method: 'GET',
      query: buildPaginationParams(pagination),
    });
  }

  public async createComment(issueId: number, payload: CommentPayload) {
    return this.request(`/issues/${issueId}/comments`, {
      method: 'POST',
      payload,
    });
  }

  public async listWikiPages(projectIdOrKey: string, pagination?: PaginationOptions) {
    return this.request(`/projects/${projectIdOrKey}/wikis`, {
      method: 'GET',
      query: buildPaginationParams(pagination),
    });
  }

  public async listAttachments(issueId: number) {
    return this.request(`/issues/${issueId}/attachments`, {
      method: 'GET',
    });
  }

  public async uploadAttachment(issueId: number, payload: AttachmentPayload) {
    return this.request(`/issues/${issueId}/attachments`, {
      method: 'POST',
      payload,
    });
  }

  public async listActivities(projectKey: string, pagination?: PaginationOptions) {
    return this.request(`/projects/${projectKey}/activities`, {
      method: 'GET',
      query: buildPaginationParams(pagination),
    });
  }

  private buildUrl(path: string, query?: Record<string, string | number | undefined>): string {
    const url = new URL(path, this.config.baseUrl);

    if (query) {
      for (const [key, value] of Object.entries(query)) {
        if (value !== undefined && value !== null) {
          url.searchParams.set(key, String(value));
        }
      }
    }

    return url.toString();
  }

  private async request<T>(path: string, options: ClientRequestOptions = {}): Promise<T> {
    const url = this.buildUrl(path, options.query);
    const headers = {
      'Content-Type': 'application/json',
      ...createAuthHeaders(this.config),
    };

    try {
      const response = {
        url,
        method: options.method ?? 'GET',
        headers,
        payload: options.payload ?? null,
      };

      return response as T;
    } catch (error) {
      throw normalizeError(error, new BacklogError('Failed to execute Backlog request'));
    }
  }
}
