import { BacklogClient } from '../backlogClient';
import { PaginationOptions } from '../utils/pagination';
import type { Tool } from './issues';

export interface WikiToolInput extends PaginationOptions {
  projectKeyOrId: string;
}

export const createWikiTool = (
  client: BacklogClient,
): Tool<WikiToolInput, unknown> => ({
  name: 'wiki',
  description: 'Browse Backlog Wiki pages.',
  async execute(payload) {
    const { projectKeyOrId, ...pagination } = payload;
    return client.listWikiPages(projectKeyOrId, pagination as PaginationOptions);
  },
});
