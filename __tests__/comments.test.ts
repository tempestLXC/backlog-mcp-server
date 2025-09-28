import { ZodError } from 'zod';

import { BacklogClient } from '../src/backlogClient';
import {
  createAddCommentTool,
  createDeleteCommentTool,
  createListCommentsTool,
  createUpdateCommentTool,
  ListCommentsResult,
} from '../src/tools/comments';

type MockBacklogClient = Pick<
  BacklogClient,
  'listComments' | 'createComment' | 'patch' | 'delete'
>;

const createMockClient = (): MockBacklogClient => ({
  listComments: jest.fn(),
  createComment: jest.fn(),
  patch: jest.fn(),
  delete: jest.fn(),
});

describe('listComments tool', () => {
  it('normalizes pagination, maps comment fields, and calculates the next offset', async () => {
    const mockCommentsResponse = [
      {
        id: 101,
        content: 'First comment',
        createdUser: { id: 9001, name: 'Alice' },
        created: '2024-05-01T12:00:00Z',
        updated: '2024-05-02T08:30:00Z',
      },
      {
        id: 102,
        content: null,
        createdUser: null,
        created: null,
        updated: null,
      },
    ];

    const client = createMockClient();
    (client.listComments as jest.Mock).mockResolvedValue(mockCommentsResponse);

    const tool = createListCommentsTool(client as unknown as BacklogClient);

    const result = await tool.execute({ issueId: 42, offset: 1, limit: 2 });

    expect(client.listComments).toHaveBeenCalledWith(42, { offset: 1, limit: 2 });

    const expected: ListCommentsResult = {
      comments: [
        {
          id: 101,
          content: 'First comment',
          author: { id: 9001, name: 'Alice' },
          created: '2024-05-01T12:00:00Z',
          updated: '2024-05-02T08:30:00Z',
        },
        {
          id: 102,
          content: null,
          author: null,
          created: null,
          updated: null,
        },
      ],
      nextOffset: 3,
    };

    expect(result).toEqual(expected);
  });

  it('returns a null next offset when the requested limit is not reached', async () => {
    const client = createMockClient();
    (client.listComments as jest.Mock).mockResolvedValue([
      {
        id: 200,
        content: 'Only comment',
        createdUser: { id: 1, name: 'Bob' },
      },
    ]);

    const tool = createListCommentsTool(client as unknown as BacklogClient);

    const result = await tool.execute({ issueId: 9000, limit: 5 });

    expect(client.listComments).toHaveBeenCalledWith(9000, { limit: 5 });
    expect(result.nextOffset).toBeNull();
  });

  it('throws a validation error when Backlog returns malformed comments', async () => {
    const client = createMockClient();
    (client.listComments as jest.Mock).mockResolvedValue([
      {
        id: 'invalid-id',
      },
    ]);

    const tool = createListCommentsTool(client as unknown as BacklogClient);

    await expect(tool.execute({ issueId: 1 })).rejects.toBeInstanceOf(ZodError);
  });
});

describe('comment mutation tools', () => {
  it('creates comments and maps Backlog responses into the public shape', async () => {
    const client = createMockClient();
    (client.createComment as jest.Mock).mockResolvedValue({
      id: 10,
      content: 'Created comment',
      createdUser: { id: 77, name: 'Creator' },
      created: '2024-07-01T10:00:00Z',
      updated: '2024-07-01T11:00:00Z',
    });

    const tool = createAddCommentTool(client as unknown as BacklogClient);

    const result = await tool.execute({
      issueId: 55,
      comment: {
        content: 'Created comment',
        notifiedUserIds: [1, 2],
      },
    });

    expect(client.createComment).toHaveBeenCalledWith(55, {
      content: 'Created comment',
      notifiedUserIds: [1, 2],
    });
    expect(result).toEqual({
      id: 10,
      content: 'Created comment',
      author: { id: 77, name: 'Creator' },
      created: '2024-07-01T10:00:00Z',
      updated: '2024-07-01T11:00:00Z',
    });
  });

  it('sanitizes undefined values before patching comments and returns the normalized comment', async () => {
    const client = createMockClient();
    (client.patch as jest.Mock).mockResolvedValue({
      id: 99,
      content: 'Updated comment',
      createdUser: null,
      created: null,
      updated: '2024-07-04T12:34:56Z',
    });

    const tool = createUpdateCommentTool(client as unknown as BacklogClient);

    const result = await tool.execute({
      issueId: 88,
      commentId: 99,
      updates: {
        content: 'Updated comment',
        notifiedUserIds: undefined,
      },
    });

    expect(client.patch).toHaveBeenCalledWith(
      '/issues/88/comments/99',
      { content: 'Updated comment' },
    );
    expect(result).toEqual({
      id: 99,
      content: 'Updated comment',
      author: null,
      created: null,
      updated: '2024-07-04T12:34:56Z',
    });
  });

  it('requires at least one field when updating a comment', async () => {
    const client = createMockClient();
    const tool = createUpdateCommentTool(client as unknown as BacklogClient);

    await expect(
      tool.execute({ issueId: 1, commentId: 2, updates: {} }),
    ).rejects.toBeInstanceOf(ZodError);
  });

  it('deletes comments after validating the identifiers', async () => {
    const client = createMockClient();
    const tool = createDeleteCommentTool(client as unknown as BacklogClient);

    await expect(tool.execute({ issueId: 77, commentId: 33 })).resolves.toEqual({
      status: 'deleted',
      issueId: 77,
      commentId: 33,
    });
    expect(client.delete).toHaveBeenCalledWith('/issues/77/comments/33');
  });
});
