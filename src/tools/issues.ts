import { BacklogClient, IssuePayload } from '../backlogClient';
import { PaginationOptions } from '../utils/pagination';

export interface Tool<Payload, Result> {
  name: string;
  description: string;
  execute: (payload: Payload) => Promise<Result>;
}

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
