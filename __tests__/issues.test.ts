import { ZodError } from 'zod';

import { BacklogClient } from '../src/backlogClient';
import {
  createCreateIssueTool,
  createDeleteIssueTool,
  createGetIssueTool,
  createIssuesTool,
  createListIssuesTool,
  createTransitionIssueTool,
  createUpdateIssueTool,
  IssueDetails,
  IssueListItem,
} from '../src/tools/issues';

type MockBacklogClient = Pick<
  BacklogClient,
  'get' | 'post' | 'patch' | 'delete' | 'createIssue' | 'listIssues'
>;

const createMockClient = (): MockBacklogClient => ({
  get: jest.fn(),
  post: jest.fn(),
  patch: jest.fn(),
  delete: jest.fn(),
  createIssue: jest.fn(),
  listIssues: jest.fn(),
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

    const client = createMockClient();
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
    const client = createMockClient();
    (client.get as jest.Mock).mockResolvedValue([]);

    const tool = createListIssuesTool(client as unknown as BacklogClient);

    await tool.execute({ projectKey: 'SAMPLE', keyword: '   ' });

    expect(client.get).toHaveBeenCalledWith('/projects/SAMPLE/issues', {});
  });

  it('throws a validation error when the Backlog response shape is unexpected', async () => {
    const client = createMockClient();
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

    const client = createMockClient();
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
    const client = createMockClient();
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
    const client = createMockClient();
    (client.get as jest.Mock).mockResolvedValue({
      id: 99,
      // issueKey is missing which violates the schema
      summary: 'Incomplete issue',
    });

    const tool = createGetIssueTool(client as unknown as BacklogClient);

    await expect(tool.execute({ issueIdOrKey: 'BUG-99' })).rejects.toBeInstanceOf(ZodError);
  });
});

describe('issue mutation tools', () => {
  it('creates issues with sanitized payloads and returns their keys', async () => {
    const client = createMockClient();
    (client.post as jest.Mock).mockResolvedValue({
      id: 101,
      issueKey: 'PROJ-101',
      summary: 'Created issue',
    });

    const tool = createCreateIssueTool(client as unknown as BacklogClient);

    const result = await tool.execute({
      projectKey: 'PROJ',
      issue: {
        summary: 'Created issue',
        description: undefined,
      },
    });

    expect(client.post).toHaveBeenCalledWith('/projects/PROJ/issues', {
      summary: 'Created issue',
    });
    expect(result).toEqual({ issueKey: 'PROJ-101' });
  });

  it('sanitizes update payloads and returns the updated issue key', async () => {
    const client = createMockClient();
    (client.patch as jest.Mock).mockResolvedValue({
      id: 202,
      issueKey: 'PROJ-202',
      summary: 'Updated issue',
    });

    const tool = createUpdateIssueTool(client as unknown as BacklogClient);

    const result = await tool.execute({
      issueIdOrKey: 'PROJ-202',
      updates: { summary: 'Updated issue', description: undefined },
    });

    expect(client.patch).toHaveBeenCalledWith('/issues/PROJ-202', {
      summary: 'Updated issue',
    });
    expect(result).toEqual({ issueKey: 'PROJ-202' });
  });

  it('requires at least one field when updating an issue', async () => {
    const client = createMockClient();
    const tool = createUpdateIssueTool(client as unknown as BacklogClient);

    await expect(
      tool.execute({ issueIdOrKey: 'PROJ-1', updates: {} }),
    ).rejects.toBeInstanceOf(ZodError);
  });

  it('deletes issues using encoded identifiers and returns confirmation payloads', async () => {
    const client = createMockClient();
    const tool = createDeleteIssueTool(client as unknown as BacklogClient);

    await expect(
      tool.execute({ issueIdOrKey: 'PROJ KEY 5' }),
    ).resolves.toEqual({ status: 'deleted', issueKey: 'PROJ KEY 5' });

    expect(client.delete).toHaveBeenCalledWith('/issues/PROJ%20KEY%205');
  });

  it('transitions issues and returns the resulting status', async () => {
    const client = createMockClient();
    (client.post as jest.Mock).mockResolvedValue({
      id: 5,
      issueKey: 'PROJ-5',
      summary: 'Transitional issue',
      status: { id: 1, name: 'Closed' },
    });

    const tool = createTransitionIssueTool(client as unknown as BacklogClient);

    const result = await tool.execute({
      issueIdOrKey: 'PROJ-5',
      statusId: 4001,
      comment: undefined,
    });

    expect(client.post).toHaveBeenCalledWith('/issues/PROJ-5/status', {
      statusId: 4001,
    });
    expect(result).toEqual({ issueKey: 'PROJ-5', status: 'Closed' });
  });
});

describe('issues aggregate tool', () => {
  it('delegates to listIssues by default with pagination options', async () => {
    const client = createMockClient();
    (client.listIssues as jest.Mock).mockResolvedValue(['listed']);

    const tool = createIssuesTool(client as unknown as BacklogClient);

    const result = await tool.execute({
      projectKey: 'PROJ',
      offset: 10,
      limit: 5,
    });

    expect(client.listIssues).toHaveBeenCalledWith('PROJ', { offset: 10, limit: 5 });
    expect(result).toEqual(['listed']);
  });

  it('delegates to createIssue when action is create and an issue payload is provided', async () => {
    const client = createMockClient();
    (client.createIssue as jest.Mock).mockResolvedValue({ issueKey: 'PROJ-9' });

    const tool = createIssuesTool(client as unknown as BacklogClient);

    const result = await tool.execute({
      action: 'create',
      projectKey: 'PROJ',
      issue: { summary: 'New issue' },
    });

    expect(client.createIssue).toHaveBeenCalledWith('PROJ', { summary: 'New issue' });
    expect(result).toEqual({ issueKey: 'PROJ-9' });
  });

  it('throws an error when attempting to create an issue without a payload', async () => {
    const client = createMockClient();
    const tool = createIssuesTool(client as unknown as BacklogClient);

    await expect(
      tool.execute({ action: 'create', projectKey: 'PROJ' }),
    ).rejects.toThrow('Issue payload is required when creating a Backlog issue.');
  });
});
