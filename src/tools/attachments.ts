import { z } from 'zod';

import { AttachmentPayload, BacklogClient } from '../backlogClient';
import type { Tool } from './issues';

const issueIdSchema = z
  .number()
  .int('issueId must be an integer value')
  .positive('issueId must be greater than zero');

const attachmentIdSchema = z
  .number()
  .int('attachmentId must be an integer value')
  .positive('attachmentId must be greater than zero');

const attachmentPayloadSchema = z
  .object({
    fileName: z.string().trim().min(1, 'fileName is required'),
    contentType: z.string().trim().min(1, 'contentType is required'),
    data: z.string().trim().min(1, 'data is required'),
  })
  .passthrough();

const backlogUserSchema = z
  .object({
    id: z.number().optional(),
    name: z.string().optional(),
  })
  .passthrough();

const backlogAttachmentSchema = z
  .object({
    id: z.number(),
    name: z.string(),
    size: z.number().optional(),
    createdUser: backlogUserSchema.nullish(),
    created: z.string().nullable().optional(),
  })
  .passthrough();

type BacklogAttachment = z.infer<typeof backlogAttachmentSchema>;

const backlogAttachmentListSchema = z.array(backlogAttachmentSchema);

const attachmentsToolInputSchema = z.object({
  issueId: issueIdSchema,
  action: z.enum(['list', 'upload', 'delete']).optional(),
  attachment: attachmentPayloadSchema.optional(),
  attachmentId: attachmentIdSchema.optional(),
});

export interface AttachmentInfo {
  id: number;
  name: string;
  size: number | null;
  created: string | null;
  createdBy: { id: number | null; name: string | null } | null;
}

const toAttachmentInfo = (attachment: BacklogAttachment): AttachmentInfo => ({
  id: attachment.id,
  name: attachment.name,
  size: typeof attachment.size === 'number' ? attachment.size : null,
  created: attachment.created ?? null,
  createdBy: attachment.createdUser
    ? {
        id:
          typeof attachment.createdUser.id === 'number'
            ? attachment.createdUser.id
            : null,
        name: attachment.createdUser.name ?? null,
      }
    : null,
});

export interface ListAttachmentsResult {
  attachments: AttachmentInfo[];
}

export interface UploadAttachmentResult {
  attachment: AttachmentInfo;
}

export interface DeleteAttachmentResult {
  status: 'deleted';
  issueId: number;
  attachmentId: number;
}

export type AttachmentToolResult =
  | ListAttachmentsResult
  | UploadAttachmentResult
  | DeleteAttachmentResult;

export type AttachmentsToolInput = z.infer<typeof attachmentsToolInputSchema>;

const listAttachments = async (
  client: BacklogClient,
  issueId: number,
): Promise<ListAttachmentsResult> => {
  const validatedIssueId = issueIdSchema.parse(issueId);
  const response = await client.listAttachments(validatedIssueId);
  const attachments = backlogAttachmentListSchema.parse(response);

  return {
    attachments: attachments.map(toAttachmentInfo),
  };
};

const uploadAttachment = async (
  client: BacklogClient,
  issueId: number,
  payload: AttachmentPayload,
): Promise<UploadAttachmentResult> => {
  const validatedIssueId = issueIdSchema.parse(issueId);
  const sanitizedPayload = attachmentPayloadSchema.parse(payload);

  const response = await client.uploadAttachment(validatedIssueId, sanitizedPayload);
  const attachment = backlogAttachmentSchema.parse(response);

  return { attachment: toAttachmentInfo(attachment) };
};

const deleteAttachment = async (
  client: BacklogClient,
  issueId: number,
  attachmentId: number,
): Promise<DeleteAttachmentResult> => {
  const validatedIssueId = issueIdSchema.parse(issueId);
  const validatedAttachmentId = attachmentIdSchema.parse(attachmentId);

  await client.delete(
    `/issues/${encodeURIComponent(String(validatedIssueId))}/attachments/${encodeURIComponent(String(validatedAttachmentId))}`,
  );

  return {
    status: 'deleted',
    issueId: validatedIssueId,
    attachmentId: validatedAttachmentId,
  };
};

export const createAttachmentsTool = (
  client: BacklogClient,
): Tool<AttachmentsToolInput, AttachmentToolResult> => ({
  name: 'attachments',
  description: 'Manage Backlog issue attachments.',
  async execute(payload) {
    const { issueId, action = 'list', attachment, attachmentId } =
      attachmentsToolInputSchema.parse(payload);

    if (action === 'upload') {
      if (!attachment) {
        throw new Error('Attachment payload is required when uploading to Backlog.');
      }

      return uploadAttachment(client, issueId, attachment);
    }

    if (action === 'delete') {
      if (typeof attachmentId !== 'number') {
        throw new Error('Attachment ID is required when deleting a Backlog attachment.');
      }

      return deleteAttachment(client, issueId, attachmentId);
    }

    return listAttachments(client, issueId);
  },
});
