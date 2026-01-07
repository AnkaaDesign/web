/**
 * Message Schema Definitions
 *
 * Defines schema types for message API requests
 */

import type { MessageStatus, MessagePriority, MessageTargeting, MessageScheduling } from '../types/message';

// Query parameters
export interface MessageGetManyFormData {
  page?: number;
  limit?: number;
  searchingFor?: string;
  status?: MessageStatus[];
  priority?: MessagePriority[];
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

// CRUD operations
export interface MessageCreateFormData {
  title: string;
  content: any; // JSON blocks
  status: MessageStatus;
  priority: MessagePriority;
  targeting: MessageTargeting;
  scheduling?: MessageScheduling;
}

export interface MessageUpdateFormData {
  title?: string;
  content?: any;
  status?: MessageStatus;
  priority?: MessagePriority;
  targeting?: MessageTargeting;
  scheduling?: MessageScheduling;
}

// Batch operations
export interface MessageBatchDeleteFormData {
  ids: string[];
}

export interface MessageBatchUpdateFormData {
  ids: string[];
  data: MessageUpdateFormData;
}
