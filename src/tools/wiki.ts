import { z } from 'zod';

import { BacklogClient } from '../backlogClient';
import {
  PaginationOptions,
  buildPaginationParams,
  normalizePagination,
} from '../utils/pagination';
import type { Tool } from './issues';

const paginationSchema = z.object({
  offset: z
    .number()
    .int('offset must be an integer value')
    .min(0, 'offset cannot be negative')
    .optional(),
  limit: z
    .number()
    .int('limit must be an integer value')
    .positive('limit must be greater than zero')
    .optional(),
});

const projectKeyOrIdSchema = z.union([
  z.string().trim().min(1, 'projectKeyOrId is required'),
  z
    .number()
    .int('projectKeyOrId must be an integer value')
    .positive('projectKeyOrId must be greater than zero'),
]);

const wikiIdSchema = z
  .number()
  .int('wikiId must be an integer value')
  .positive('wikiId must be greater than zero');

const projectIdSchema = z
  .number()
  .int('projectId must be an integer value')
  .positive('projectId must be greater than zero');

const wikiCreatePayloadSchema = z
  .object({
    projectId: projectIdSchema,
    name: z.string().trim().min(1, 'name is required'),
    content: z.string().optional(),
    mailNotify: z.boolean().optional(),
  })
  .passthrough();

const wikiUpdatePayloadSchema = z
  .object({
    name: z.string().trim().min(1).optional(),
    content: z.string().optional(),
    mailNotify: z.boolean().optional(),
  })
  .passthrough()
  .refine((data) => Object.values(data).some((value) => value !== undefined), {
    message: 'At least one field must be provided to update the wiki.',
  });

const backlogUserSchema = z
  .object({
    id: z.number().optional(),
    userId: z.string().optional(),
    name: z.string().optional(),
  })
  .passthrough();

const backlogWikiTagSchema = z
  .object({
    id: z.number().optional(),
    name: z.string().optional(),
  })
  .passthrough();

const backlogWikiSchema = z
  .object({
    id: z.number(),
    projectId: z.number().optional(),
    name: z.string(),
    content: z.string().nullable().optional(),
    createdUser: backlogUserSchema.nullish(),
    updatedUser: backlogUserSchema.nullish(),
    created: z.string().nullable().optional(),
    updated: z.string().nullable().optional(),
    tags: z.array(backlogWikiTagSchema).optional(),
  })
  .passthrough();

type BacklogWiki = z.infer<typeof backlogWikiSchema>;

const backlogWikiListSchema = z.array(backlogWikiSchema);

const toTagNames = (wiki: BacklogWiki): string[] =>
  (wiki.tags ?? [])
    .map((tag) => tag?.name?.trim())
    .filter((tagName): tagName is string => Boolean(tagName && tagName.length > 0));

const toUserInfo = (
  user: z.infer<typeof backlogUserSchema> | null | undefined,
): { id: number | null; name: string | null } | null =>
  user
    ? {
        id: typeof user.id === 'number' ? user.id : null,
        name: user.name ?? null,
      }
    : null;

export interface WikiSummary {
  id: number;
  projectId: number | null;
  name: string;
  updated: string | null;
  tags: string[];
}

const toWikiSummary = (wiki: BacklogWiki): WikiSummary => ({
  id: wiki.id,
  projectId: typeof wiki.projectId === 'number' ? wiki.projectId : null,
  name: wiki.name,
  updated: wiki.updated ?? null,
  tags: toTagNames(wiki),
});

export interface WikiDetails {
  id: number;
  projectId: number | null;
  name: string;
  content: string | null;
  created: string | null;
  updated: string | null;
  createdBy: { id: number | null; name: string | null } | null;
  updatedBy: { id: number | null; name: string | null } | null;
  tags: string[];
}

const toWikiDetails = (wiki: BacklogWiki): WikiDetails => ({
  id: wiki.id,
  projectId: typeof wiki.projectId === 'number' ? wiki.projectId : null,
  name: wiki.name,
  content: wiki.content ?? null,
  created: wiki.created ?? null,
  updated: wiki.updated ?? null,
  createdBy: toUserInfo(wiki.createdUser ?? null),
  updatedBy: toUserInfo(wiki.updatedUser ?? null),
  tags: toTagNames(wiki),
});

const removeUndefinedValues = <T extends Record<string, unknown>>(payload: T) =>
  Object.entries(payload).reduce<Record<string, unknown>>((acc, [key, value]) => {
    if (value !== undefined) {
      acc[key] = value;
    }
    return acc;
  }, {});

const searchWikiInputSchema = z
  .object({
    projectKeyOrId: projectKeyOrIdSchema,
    keyword: z.string().trim().min(1, 'keyword cannot be empty').optional(),
  })
  .merge(paginationSchema);

export type SearchWikiToolInput = z.infer<typeof searchWikiInputSchema>;

export interface SearchWikiResult {
  wikis: WikiSummary[];
  nextOffset: number | null;
}

export const createSearchWikiTool = (
  client: BacklogClient,
): Tool<SearchWikiToolInput, SearchWikiResult> => ({
  name: 'searchWiki',
  description: 'Search Backlog wiki pages within a project.',
  async execute(payload) {
    const { projectKeyOrId, keyword, offset, limit } = searchWikiInputSchema.parse(payload);

    const normalizedPagination = normalizePagination({ offset, limit });
    const paginationParams = buildPaginationParams(normalizedPagination);

    const query: Record<string, string | number | boolean | undefined> = {};

    if (paginationParams?.offset !== undefined) {
      query.offset = paginationParams.offset;
    }

    if (paginationParams?.count !== undefined) {
      query.count = paginationParams.count;
    }

    if (keyword) {
      query.keyword = keyword;
    }

    const wikiResponse = await client.get<unknown>(
      `/projects/${encodeURIComponent(String(projectKeyOrId))}/wikis`,
      query,
    );

    const wikis = backlogWikiListSchema.parse(wikiResponse);
    const summaries = wikis.map(toWikiSummary);

    const effectiveOffset = normalizedPagination?.offset ?? 0;
    const effectiveLimit = normalizedPagination?.limit;

    const nextOffset =
      typeof effectiveLimit === 'number' && wikis.length === effectiveLimit
        ? effectiveOffset + effectiveLimit
        : null;

    return { wikis: summaries, nextOffset };
  },
});

const getWikiInputSchema = z.object({
  wikiId: wikiIdSchema,
});

export type GetWikiToolInput = z.infer<typeof getWikiInputSchema>;

export type GetWikiResult = WikiDetails;

export const createGetWikiTool = (
  client: BacklogClient,
): Tool<GetWikiToolInput, GetWikiResult> => ({
  name: 'getWiki',
  description: 'Retrieve detailed information for a Backlog wiki page.',
  async execute(payload) {
    const { wikiId } = getWikiInputSchema.parse(payload);

    const wikiResponse = await client.get<unknown>(
      `/wikis/${encodeURIComponent(String(wikiId))}`,
    );

    const wiki = backlogWikiSchema.parse(wikiResponse);
    return toWikiDetails(wiki);
  },
});

export type CreateWikiToolInput = z.infer<typeof wikiCreatePayloadSchema>;

export type CreateWikiResult = WikiDetails;

export const createCreateWikiTool = (
  client: BacklogClient,
): Tool<CreateWikiToolInput, CreateWikiResult> => ({
  name: 'createWiki',
  description: 'Create a new Backlog wiki page.',
  async execute(payload) {
    const wikiPayload = wikiCreatePayloadSchema.parse(payload);

    const sanitizedPayload = removeUndefinedValues(wikiPayload);

    const createdWikiResponse = await client.post<unknown>(
      '/wikis',
      sanitizedPayload,
    );

    const createdWiki = backlogWikiSchema.parse(createdWikiResponse);
    return toWikiDetails(createdWiki);
  },
});

const updateWikiInputSchema = z.object({
  wikiId: wikiIdSchema,
  updates: wikiUpdatePayloadSchema,
});

export type UpdateWikiToolInput = z.infer<typeof updateWikiInputSchema>;

export type UpdateWikiResult = WikiDetails;

export const createUpdateWikiTool = (
  client: BacklogClient,
): Tool<UpdateWikiToolInput, UpdateWikiResult> => ({
  name: 'updateWiki',
  description: 'Update an existing Backlog wiki page.',
  async execute(payload) {
    const { wikiId, updates } = updateWikiInputSchema.parse(payload);

    const sanitizedUpdates = removeUndefinedValues(updates);

    const updatedWikiResponse = await client.patch<unknown>(
      `/wikis/${encodeURIComponent(String(wikiId))}`,
      sanitizedUpdates,
    );

    const updatedWiki = backlogWikiSchema.parse(updatedWikiResponse);
    return toWikiDetails(updatedWiki);
  },
});

const deleteWikiInputSchema = z.object({
  wikiId: wikiIdSchema,
});

export type DeleteWikiToolInput = z.infer<typeof deleteWikiInputSchema>;

export interface DeleteWikiResult {
  status: 'deleted';
  wikiId: number;
}

export const createDeleteWikiTool = (
  client: BacklogClient,
): Tool<DeleteWikiToolInput, DeleteWikiResult> => ({
  name: 'deleteWiki',
  description: 'Delete a Backlog wiki page.',
  async execute(payload) {
    const { wikiId } = deleteWikiInputSchema.parse(payload);

    await client.delete(`/wikis/${encodeURIComponent(String(wikiId))}`);

    return { status: 'deleted', wikiId };
  },
});

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
