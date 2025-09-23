import { z } from 'zod';

import { BacklogClient, IssuePayload } from '../backlogClient';
import { PaginationOptions } from '../utils/pagination';

export interface Tool<Payload, Result> {
  name: string;
  description: string;
  execute: (payload: Payload) => Promise<Result>;
}

const backlogIssueStatusSchema = z
  .object({
    id: z.number().optional(),
    name: z.string().optional(),
  })
  .partial();

const backlogUserSchema = z
  .object({
    id: z.number().optional(),
    userId: z.string().optional(),
    name: z.string().optional(),
  })
  .partial();

const backlogIssueSchema = z.object({
  id: z.number(),
  issueKey: z.string(),
  summary: z.string(),
  description: z.string().nullable().optional(),
  status: backlogIssueStatusSchema.nullish(),
  assignee: backlogUserSchema.nullish(),
  updated: z.string().nullable().optional(),
});

type BacklogIssue = z.infer<typeof backlogIssueSchema>;

const backlogIssueListSchema = z.array(backlogIssueSchema);

const listIssuesInputSchema = z.object({
  projectKey: z.string().trim().min(1, 'projectKey is required'),
  keyword: z.string().trim().optional(),
  count: z
    .number()
    .int('count must be an integer value')
    .positive('count must be greater than zero')
    .optional(),
});

export type ListIssuesToolInput = z.infer<typeof listIssuesInputSchema>;

export interface IssueListItem {
  id: number;
  issueKey: string;
  summary: string;
  status: string | null;
  assignee: string | null;
  updated: string | null;
}

const toIssueListItem = (issue: BacklogIssue): IssueListItem => ({
  id: issue.id,
  issueKey: issue.issueKey,
  summary: issue.summary,
  status: issue.status?.name ?? null,
  assignee: issue.assignee?.name ?? null,
  updated: issue.updated ?? null,
});

const getIssueInputSchema = z.object({
  issueIdOrKey: z.string().trim().min(1, 'issueIdOrKey is required'),
});

export type GetIssueToolInput = z.infer<typeof getIssueInputSchema>;

export interface IssueDetails {
  id: number;
  issueKey: string;
  summary: string;
  description: string | null;
  status: string | null;
  assignee: string | null;
}

const toIssueDetails = (issue: BacklogIssue): IssueDetails => ({
  id: issue.id,
  issueKey: issue.issueKey,
  summary: issue.summary,
  description: issue.description ?? null,
  status: issue.status?.name ?? null,
  assignee: issue.assignee?.name ?? null,
});

export const createListIssuesTool = (
  client: BacklogClient,
): Tool<ListIssuesToolInput, IssueListItem[]> => ({
  name: 'listIssues',
  description: 'List Backlog issues for a specific project.',
  async execute(payload) {
    const { projectKey, keyword, count } = listIssuesInputSchema.parse(payload);

    const sanitizedKeyword = keyword && keyword.length > 0 ? keyword : undefined;

    const query: Record<string, string | number | boolean | undefined> = {};

    if (sanitizedKeyword) {
      query.keyword = sanitizedKeyword;
    }

    if (typeof count === 'number') {
      query.count = count;
    }

    const issuesResponse = await client.get<unknown>(
      `/projects/${encodeURIComponent(projectKey)}/issues`,
      query,
    );

    const issues = backlogIssueListSchema.parse(issuesResponse);

    return issues.map(toIssueListItem);
  },
});

export const createGetIssueTool = (
  client: BacklogClient,
): Tool<GetIssueToolInput, IssueDetails> => ({
  name: 'getIssue',
  description: 'Fetch detailed information for a Backlog issue.',
  async execute(payload) {
    const { issueIdOrKey } = getIssueInputSchema.parse(payload);

    const issueResponse = await client.get<unknown>(
      `/issues/${encodeURIComponent(issueIdOrKey)}`,
    );

    const issue = backlogIssueSchema.parse(issueResponse);

    return toIssueDetails(issue);
  },
});

export interface IssuesToolInput extends PaginationOptions {
  projectKey: string;
  action?: 'list' | 'create';
  issue?: IssuePayload;
}

export const createIssuesTool = (
  client: BacklogClient,
): Tool<IssuesToolInput, unknown> => ({
  name: 'issues',
  description: 'List or create Backlog issues.',
  async execute(payload) {
    const { action = 'list', projectKey, issue, ...pagination } = payload;

    if (action === 'create') {
      if (!issue) {
        throw new Error('Issue payload is required when creating a Backlog issue.');
      }

      return client.createIssue(projectKey, issue);
    }

    return client.listIssues(projectKey, pagination as PaginationOptions);
  },
});
