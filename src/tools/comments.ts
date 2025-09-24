import { z } from 'zod';

import { BacklogClient } from '../backlogClient';
import { normalizePagination } from '../utils/pagination';
import type { Tool } from './issues';

const backlogUserSchema = z
  .object({
    id: z.number().optional(),
    userId: z.string().optional(),
    name: z.string().optional(),
  })
  .passthrough();

const backlogCommentSchema = z
  .object({
    id: z.number(),
    content: z.string().nullable().optional(),
    createdUser: backlogUserSchema.nullish(),
    created: z.string().nullable().optional(),
    updated: z.string().nullable().optional(),
  })
  .passthrough();

type BacklogComment = z.infer<typeof backlogCommentSchema>;

export interface CommentInfo {
  id: number;
  content: string | null;
  author: {
    id: number | null;
    name: string | null;
  } | null;
  created: string | null;
  updated: string | null;
}

const toCommentInfo = (comment: BacklogComment): CommentInfo => ({
  id: comment.id,
  content: comment.content ?? null,
  author: comment.createdUser
    ? {
        id: comment.createdUser.id ?? null,
        name: comment.createdUser.name ?? null,
      }
    : null,
  created: comment.created ?? null,
  updated: comment.updated ?? null,
});

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

const issueIdSchema = z
  .number({ invalid_type_error: 'issueId must be a number' })
  .int('issueId must be an integer value')
  .positive('issueId must be greater than zero');

const commentPayloadSchema = z
  .object({
    content: z.string().trim().min(1, 'comment content is required'),
    notifiedUserIds: z
      .array(
        z
          .number({ invalid_type_error: 'notifiedUserIds must contain numbers' })
          .int('notified user ids must be integers')
          .positive('notified user ids must be greater than zero'),
      )
      .optional(),
  })
  .passthrough();

const commentUpdatePayloadSchema = commentPayloadSchema
  .partial()
  .refine((data) => Object.values(data).some((value) => value !== undefined), {
    message: 'At least one field must be provided to update the comment.',
  });

const addCommentInputSchema = z.object({
  issueId: issueIdSchema,
  comment: commentPayloadSchema,
});

const removeUndefinedValues = <T extends Record<string, unknown>>(payload: T) =>
  Object.entries(payload).reduce<Record<string, unknown>>((acc, [key, value]) => {
    if (value !== undefined) {
      acc[key] = value;
    }
    return acc;
  }, {});

const commentIdSchema = z
  .number({ invalid_type_error: 'commentId must be a number' })
  .int('commentId must be an integer value')
  .positive('commentId must be greater than zero');

const updateCommentInputSchema = z.object({
  issueId: issueIdSchema,
  commentId: commentIdSchema,
  updates: commentUpdatePayloadSchema,
});

const deleteCommentInputSchema = z.object({
  issueId: issueIdSchema,
  commentId: commentIdSchema,
});

const commentListSchema = z.array(backlogCommentSchema);

const listCommentsInputSchema = z
  .object({
    issueId: issueIdSchema,
  })
  .merge(paginationSchema);

export type ListCommentsToolInput = z.infer<typeof listCommentsInputSchema>;

export interface ListCommentsResult {
  comments: CommentInfo[];
  nextOffset: number | null;
}

export const createListCommentsTool = (
  client: BacklogClient,
): Tool<ListCommentsToolInput, ListCommentsResult> => ({
  name: 'listComments',
  description: 'Retrieve comments for a Backlog issue.',
  async execute(payload) {
    const { issueId, offset, limit } = listCommentsInputSchema.parse(payload);

    const normalizedPagination = normalizePagination({ offset, limit });

    const commentsResponse = await client.listComments(issueId, normalizedPagination);

    const comments = commentListSchema.parse(commentsResponse);
    const mappedComments = comments.map(toCommentInfo);

    const effectiveOffset = normalizedPagination?.offset ?? 0;
    const effectiveLimit = normalizedPagination?.limit;

    const nextOffset =
      typeof effectiveLimit === 'number' && comments.length === effectiveLimit
        ? effectiveOffset + effectiveLimit
        : null;

    return { comments: mappedComments, nextOffset };
  },
});

export type AddCommentToolInput = z.infer<typeof addCommentInputSchema>;

export type AddCommentResult = CommentInfo;

export const createAddCommentTool = (
  client: BacklogClient,
): Tool<AddCommentToolInput, AddCommentResult> => ({
  name: 'addComment',
  description: 'Add a new comment to a Backlog issue.',
  async execute(payload) {
    const { issueId, comment } = addCommentInputSchema.parse(payload);

    const createdCommentResponse = await client.createComment(issueId, comment);
    const createdComment = backlogCommentSchema.parse(createdCommentResponse);

    return toCommentInfo(createdComment);
  },
});

export type UpdateCommentToolInput = z.infer<typeof updateCommentInputSchema>;

export type UpdateCommentResult = CommentInfo;

export const createUpdateCommentTool = (
  client: BacklogClient,
): Tool<UpdateCommentToolInput, UpdateCommentResult> => ({
  name: 'updateComment',
  description: 'Update an existing Backlog comment.',
  async execute(payload) {
    const { issueId, commentId, updates } = updateCommentInputSchema.parse(payload);

    const sanitizedUpdates = removeUndefinedValues(updates);

    const updatedCommentResponse = await client.patch<unknown>(
      `/issues/${encodeURIComponent(String(issueId))}/comments/${encodeURIComponent(String(commentId))}`,
      sanitizedUpdates,
    );

    const updatedComment = backlogCommentSchema.parse(updatedCommentResponse);

    return toCommentInfo(updatedComment);
  },
});

export type DeleteCommentToolInput = z.infer<typeof deleteCommentInputSchema>;

export interface DeleteCommentResult {
  status: 'deleted';
  issueId: number;
  commentId: number;
}

export const createDeleteCommentTool = (
  client: BacklogClient,
): Tool<DeleteCommentToolInput, DeleteCommentResult> => ({
  name: 'deleteComment',
  description: 'Delete a comment from a Backlog issue.',
  async execute(payload) {
    const { issueId, commentId } = deleteCommentInputSchema.parse(payload);

    await client.delete(
      `/issues/${encodeURIComponent(String(issueId))}/comments/${encodeURIComponent(String(commentId))}`,
    );

    return { status: 'deleted', issueId, commentId };
  },
});
