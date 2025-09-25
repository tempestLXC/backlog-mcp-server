import { z } from 'zod';

import { BacklogClient } from '../backlogClient';
import { normalizePagination } from '../utils/pagination';
import type { Tool } from './issues';

const paginationSchema = z.object({
  offset: z
    .number({ invalid_type_error: 'offset must be a number' })
    .int('offset must be an integer value')
    .min(0, 'offset cannot be negative')
    .optional(),
  limit: z
    .number({ invalid_type_error: 'limit must be a number' })
    .int('limit must be an integer value')
    .positive('limit must be greater than zero')
    .optional(),
});

const activitiesInputSchema = z
  .object({
    projectKey: z.string().trim().min(1, 'projectKey is required'),
  })
  .merge(paginationSchema);

export type ActivitiesToolInput = z.infer<typeof activitiesInputSchema>;

const backlogUserSchema = z
  .object({
    id: z.number().optional(),
    userId: z.string().optional(),
    name: z.string().optional(),
  })
  .passthrough();

const backlogProjectSchema = z
  .object({
    id: z.number().optional(),
    projectKey: z.string().optional(),
    name: z.string().optional(),
  })
  .passthrough();

const backlogActivitySchema = z
  .object({
    id: z.number(),
    type: z.number().optional(),
    project: backlogProjectSchema.nullish(),
    content: z.unknown().optional(),
    createdUser: backlogUserSchema.nullish(),
    created: z.string().nullable().optional(),
  })
  .passthrough();

type BacklogActivity = z.infer<typeof backlogActivitySchema>;

const backlogActivityListSchema = z.array(backlogActivitySchema);

const toUserInfo = (
  user: z.infer<typeof backlogUserSchema> | null | undefined,
): { id: number | null; name: string | null } | null =>
  user
    ? {
        id: typeof user.id === 'number' ? user.id : null,
        name: user.name ?? null,
      }
    : null;

const toProjectInfo = (
  project: z.infer<typeof backlogProjectSchema> | null | undefined,
): { id: number | null; key: string | null; name: string | null } | null =>
  project
    ? {
        id: typeof project.id === 'number' ? project.id : null,
        key: project.projectKey ?? null,
        name: project.name ?? null,
      }
    : null;

const toDetails = (content: unknown): Record<string, unknown> => {
  if (!content || typeof content !== 'object' || Array.isArray(content)) {
    return {};
  }

  return { ...(content as Record<string, unknown>) };
};

export interface ActivityInfo {
  id: number;
  type: number | null;
  project: { id: number | null; key: string | null; name: string | null } | null;
  created: string | null;
  createdBy: { id: number | null; name: string | null } | null;
  details: Record<string, unknown>;
}

const toActivityInfo = (activity: BacklogActivity): ActivityInfo => ({
  id: activity.id,
  type: typeof activity.type === 'number' ? activity.type : null,
  project: toProjectInfo(activity.project ?? null),
  created: activity.created ?? null,
  createdBy: toUserInfo(activity.createdUser ?? null),
  details: toDetails(activity.content),
});

export interface GetActivitiesResult {
  activities: ActivityInfo[];
  nextOffset: number | null;
}

const getActivities = async (
  client: BacklogClient,
  payload: ActivitiesToolInput,
): Promise<GetActivitiesResult> => {
  const { projectKey, offset, limit } = activitiesInputSchema.parse(payload);

  const normalizedPagination = normalizePagination({ offset, limit });
  const response = await client.listActivities(projectKey, normalizedPagination);
  const activities = backlogActivityListSchema.parse(response);

  const mapped = activities.map(toActivityInfo);

  const effectiveOffset = normalizedPagination?.offset ?? 0;
  const effectiveLimit = normalizedPagination?.limit;

  const nextOffset =
    typeof effectiveLimit === 'number' && activities.length === effectiveLimit
      ? effectiveOffset + effectiveLimit
      : null;

  return { activities: mapped, nextOffset };
};

export const createActivitiesTool = (
  client: BacklogClient,
): Tool<ActivitiesToolInput, GetActivitiesResult> => ({
  name: 'activities',
  description: 'Inspect Backlog project activities.',
  async execute(payload) {
    return getActivities(client, payload);
  },
});
