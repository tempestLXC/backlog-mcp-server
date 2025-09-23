import { BacklogClient } from '../backlogClient';
import { PaginationOptions } from '../utils/pagination';
import type { Tool } from './issues';

export interface ActivitiesToolInput extends PaginationOptions {
  projectKey: string;
}

export const createActivitiesTool = (
  client: BacklogClient,
): Tool<ActivitiesToolInput, unknown> => ({
  name: 'activities',
  description: 'Inspect Backlog project activities.',
  async execute(payload) {
    const { projectKey, ...pagination } = payload;
    return client.listActivities(projectKey, pagination as PaginationOptions);
  },
});
