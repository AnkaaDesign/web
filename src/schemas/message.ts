/**
 * Message Schema Definitions
 *
 * Defines schema types for message API requests
 */

import type { MessageStatus } from '../types/message';

// Query parameters
export interface MessageGetManyFormData {
  page?: number;
  limit?: number;
  searchingFor?: string;
  status?: MessageStatus[];
  createdAt?: {
    gte?: Date | string;
    lte?: Date | string;
  };
  orderBy?: Record<string, 'asc' | 'desc'>;
  include?: any;
}

export interface MessageGetByIdFormData {
  id: string;
  include?: any;
}

export interface MessageQueryFormData {
  include?: any;
}

// CRUD operations - Aligned with backend CreateMessageDto
export interface MessageCreateFormData {
  title: string;
  contentBlocks: any[]; // Array of content blocks
  targets?: string[]; // Array of target user IDs (empty = all users)
  isActive?: boolean; // Whether message is active/published (default: true)
  startsAt?: string; // ISO date string for visibility start
  endsAt?: string; // ISO date string for visibility end
}

export interface MessageUpdateFormData {
  title?: string;
  contentBlocks?: any[]; // Array of content blocks
  targets?: string[]; // Array of target user IDs (empty = all users)
  isActive?: boolean;
  startsAt?: string;
  endsAt?: string;
}

// Batch operations
export interface MessageBatchDeleteFormData {
  ids: string[];
}

export interface MessageBatchUpdateFormData {
  ids: string[];
  data: MessageUpdateFormData;
}

export interface MessageBatchCreateFormData {
  messages: MessageCreateFormData[];
}

// ViewedMessage schemas
export interface ViewedMessageGetManyFormData {
  page?: number;
  limit?: number;
  take?: number;
  skip?: number;
  where?: any;
  userIds?: string[];
  messageIds?: string[];
}

export interface ViewedMessageGetByIdFormData {
  id: string;
  include?: any;
}

export interface ViewedMessageCreateFormData {
  messageId: string;
  userId: string;
  dismissed?: boolean;
}

export interface ViewedMessageUpdateFormData {
  dismissed?: boolean;
  dismissedAt?: Date | string;
}

export interface ViewedMessageQueryFormData {
  include?: any;
}

export interface ViewedMessageBatchCreateFormData {
  viewedMessages: ViewedMessageCreateFormData[];
}

export interface ViewedMessageBatchUpdateFormData {
  viewedMessages: {
    id: string;
    data: ViewedMessageUpdateFormData;
  }[];
}

export interface ViewedMessageBatchDeleteFormData {
  viewedMessageIds: string[];
}
