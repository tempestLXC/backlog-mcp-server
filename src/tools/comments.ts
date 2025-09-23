import { BacklogClient, CommentPayload } from '../backlogClient';
import { PaginationOptions } from '../utils/pagination';
import type { Tool } from './issues';

export interface CommentsToolInput extends PaginationOptions {
  issueId: number;
  action?: 'list' | 'create';
  comment?: CommentPayload;
}

export const createCommentsTool = (
  client: BacklogClient,
): Tool<CommentsToolInput, unknown> => ({
  name: 'comments',
  description: 'List or create comments for a Backlog issue.',
  async execute(payload) {
    const { action = 'list', issueId, comment, ...pagination } = payload;

    if (action === 'create') {
      if (!comment) {
        throw new Error('Comment payload is required when creating a Backlog comment.');
      }

      return client.createComment(issueId, comment);
    }

    return client.listComments(issueId, pagination as PaginationOptions);
  },
});
