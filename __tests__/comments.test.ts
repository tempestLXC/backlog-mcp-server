import { ZodError } from 'zod';

import { BacklogClient } from '../src/backlogClient';
import {
  createListCommentsTool,
  ListCommentsResult,
} from '../src/tools/comments';

type MockBacklogClient = Pick<BacklogClient, 'listComments'>;

const createMockClient = () => ({
  listComments: jest.fn(),
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

    const client: MockBacklogClient = createMockClient();
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
    const client: MockBacklogClient = createMockClient();
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
    const client: MockBacklogClient = createMockClient();
    (client.listComments as jest.Mock).mockResolvedValue([
      {
        id: 'invalid-id',
      },
    ]);

    const tool = createListCommentsTool(client as unknown as BacklogClient);

    await expect(tool.execute({ issueId: 1 })).rejects.toBeInstanceOf(ZodError);
  });
});
