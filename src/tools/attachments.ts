import { AttachmentPayload, BacklogClient } from '../backlogClient';
import type { Tool } from './issues';

export interface AttachmentsToolInput {
  issueId: number;
  action?: 'list' | 'upload';
  attachment?: AttachmentPayload;
}

export const createAttachmentsTool = (
  client: BacklogClient,
): Tool<AttachmentsToolInput, unknown> => ({
  name: 'attachments',
  description: 'Manage Backlog issue attachments.',
  async execute(payload) {
    const { action = 'list', issueId, attachment } = payload;

    if (action === 'upload') {
      if (!attachment) {
        throw new Error('Attachment payload is required when uploading to Backlog.');
      }

      return client.uploadAttachment(issueId, attachment);
    }

    return client.listAttachments(issueId);
  },
});
