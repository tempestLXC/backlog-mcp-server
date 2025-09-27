import { ZodError } from 'zod';

import { BacklogClient } from '../src/backlogClient';
import {
  createGetIssueTool,
  createListIssuesTool,
  IssueDetails,
  IssueListItem,
} from '../src/tools/issues';

type MockBacklogClient = Pick<BacklogClient, 'get'>;

const createMockClient = () => ({
  get: jest.fn(),
});

describe('listIssues tool', () => {
  it('fetches issues for the given project and maps them into list items', async () => {
    const mockIssuesResponse = [
      {
        id: 1,
        issueKey: 'PROJ-1',
        summary: 'First issue',
        description: 'Details',
        status: { id: 100, name: 'Open' },
        assignee: { id: 200, name: 'Alice' },
        updated: '2024-04-01T10:00:00Z',
      },
      {
        id: 2,
        issueKey: 'PROJ-2',
        summary: 'Second issue',
        description: null,
        status: null,
        assignee: null,
        updated: null,
      },
    ];

    const client: MockBacklogClient = createMockClient();
    (client.get as jest.Mock).mockResolvedValue(mockIssuesResponse);

    const tool = createListIssuesTool(client as unknown as BacklogClient);

    const input = { projectKey: 'PROJ KEY', keyword: 'bug', count: 25 } as const;
    const result = await tool.execute(input);

    expect(client.get).toHaveBeenCalledWith('/projects/PROJ%20KEY/issues', {
      keyword: 'bug',
      count: 25,
    });

    const expected: IssueListItem[] = [
      {
        id: 1,
        issueKey: 'PROJ-1',
        summary: 'First issue',
        status: 'Open',
        assignee: 'Alice',
        updated: '2024-04-01T10:00:00Z',
      },
      {
        id: 2,
        issueKey: 'PROJ-2',
        summary: 'Second issue',
        status: null,
        assignee: null,
        updated: null,
      },
    ];

    expect(result).toEqual(expected);
  });

  it('omits empty optional filters when building the query string', async () => {
    const client: MockBacklogClient = createMockClient();
    (client.get as jest.Mock).mockResolvedValue([]);

    const tool = createListIssuesTool(client as unknown as BacklogClient);

    await tool.execute({ projectKey: 'SAMPLE', keyword: '   ' });

    expect(client.get).toHaveBeenCalledWith('/projects/SAMPLE/issues', {});
  });

  it('throws a validation error when the Backlog response shape is unexpected', async () => {
    const client: MockBacklogClient = createMockClient();
    (client.get as jest.Mock).mockResolvedValue([
      {
        id: 'not-a-number',
        issueKey: 'INVALID',
        summary: 'Invalid issue',
      },
    ]);

    const tool = createListIssuesTool(client as unknown as BacklogClient);

    await expect(tool.execute({ projectKey: 'INVALID' })).rejects.toBeInstanceOf(ZodError);
  });
});

describe('getIssue tool', () => {
  it('fetches the issue details and normalizes optional fields', async () => {
    const mockIssueResponse = {
      id: 11,
      issueKey: 'BUG-11',
      summary: 'Fix failing build',
      description: undefined,
      status: undefined,
      assignee: undefined,
    };

    const client: MockBacklogClient = createMockClient();
    (client.get as jest.Mock).mockResolvedValue(mockIssueResponse);

    const tool = createGetIssueTool(client as unknown as BacklogClient);

    const result = await tool.execute({ issueIdOrKey: 'BUG-11' });

    expect(client.get).toHaveBeenCalledWith('/issues/BUG-11');

    const expected: IssueDetails = {
      id: 11,
      issueKey: 'BUG-11',
      summary: 'Fix failing build',
      description: null,
      status: null,
      assignee: null,
    };

    expect(result).toEqual(expected);
  });

  it('encodes the issue identifier when performing the request', async () => {
    const client: MockBacklogClient = createMockClient();
    (client.get as jest.Mock).mockResolvedValue({
      id: 42,
      issueKey: 'ISSUE KEY 42',
      summary: 'Complex issue',
    });

    const tool = createGetIssueTool(client as unknown as BacklogClient);

    await tool.execute({ issueIdOrKey: 'ISSUE KEY 42' });

    expect(client.get).toHaveBeenCalledWith('/issues/ISSUE%20KEY%2042');
  });

  it('throws a validation error when the returned issue does not match the schema', async () => {
    const client: MockBacklogClient = createMockClient();
    (client.get as jest.Mock).mockResolvedValue({
      id: 99,
      // issueKey is missing which violates the schema
      summary: 'Incomplete issue',
    });

    const tool = createGetIssueTool(client as unknown as BacklogClient);

    await expect(tool.execute({ issueIdOrKey: 'BUG-99' })).rejects.toBeInstanceOf(ZodError);
  });
});
