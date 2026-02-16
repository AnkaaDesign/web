/**
 * Message Type Definitions
 *
 * Defines types for in-app messages that can be displayed to users
 */

export type MessageStatus = 'draft' | 'active' | 'archived';
export type MessageTargetType = 'all' | 'specific' | 'sector' | 'position';

export interface MessageTargeting {
  type: MessageTargetType;
  userIds?: string[];
  sectorIds?: string[];
  positionIds?: string[];
}

export interface MessageScheduling {
  startDate?: Date | string;
  endDate?: Date | string;
}

export interface MessageStats {
  views: number;
  uniqueViews: number;
  targetUsers: number;
  dismissals: number;
}

export interface Message {
  id: string;
  title: string;
  content: any; // JSON blocks from editor
  status: MessageStatus;
  targeting?: MessageTargeting; // Only present in form/editor context, not in API responses
  scheduling?: MessageScheduling;
  stats?: MessageStats;
  targets?: Array<{ id: string; userId: string; user?: { id: string; name: string } }>; // From findOne (detail)
  targetCount?: number; // From findAll (list) - 0 means all users
  createdAt: string | Date;
  updatedAt: string | Date;
  publishedAt?: string | Date | null;
  startDate?: string | Date | null;
  endDate?: string | Date | null;
  actionUrl?: string;
  actionType?: string;
  createdBy?: {
    id: string;
    name: string;
  };
}

export interface MessageView {
  id: string;
  messageId: string;
  userId: string;
  viewedAt: Date | string;
  dismissed: boolean;
  dismissedAt?: Date | string;
}

export interface ViewedMessage {
  id: string;
  messageId: string;
  userId: string;
  viewedAt: Date | string;
  dismissed: boolean;
  dismissedAt?: Date | string;
}

// =====================
// Form Data Types
// =====================

export interface MessageGetManyFormData {
  page?: number;
  limit?: number;
  take?: number;
  skip?: number;
  where?: any;
  searchingFor?: string;
  recipientIds?: string[];
  senderIds?: string[];
}

export interface MessageGetByIdFormData {
  id: string;
  include?: any;
}

export interface MessageCreateFormData {
  title: string;
  content: any;
  status?: MessageStatus;
  targeting?: MessageTargeting;
  scheduling?: MessageScheduling;
}

export interface MessageUpdateFormData {
  title?: string;
  content?: any;
  status?: MessageStatus;
  targeting?: MessageTargeting;
  scheduling?: MessageScheduling;
}

export interface MessageQueryFormData {
  include?: any;
}

export interface MessageBatchCreateFormData {
  messages: MessageCreateFormData[];
}

export interface MessageBatchUpdateFormData {
  messages: {
    id: string;
    data: MessageUpdateFormData;
  }[];
}

export interface MessageBatchDeleteFormData {
  messageIds: string[];
}

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

// =====================
// API Response types
// =====================

export interface MessageGetManyResponse {
  data: Message[];
  meta: {
    totalRecords: number;
    page: number;
    limit: number;
  };
}

export interface MessageGetUniqueResponse {
  data: Message;
}

export interface MessageCreateResponse {
  data: Message;
}

export interface MessageUpdateResponse {
  data: Message;
}

export interface MessageDeleteResponse {
  data: Message;
}

export interface MessageBatchCreateResponse<T> {
  data: T[];
  meta?: {
    count: number;
  };
}

export interface MessageBatchUpdateResponse<T> {
  data: T[];
  meta?: {
    count: number;
  };
}

export interface MessageBatchDeleteResponse {
  data: {
    count: number;
    deleted: string[];
  };
}

export interface ViewedMessageGetManyResponse {
  data: ViewedMessage[];
  meta: {
    totalRecords: number;
    page: number;
    limit: number;
  };
}

export interface ViewedMessageGetUniqueResponse {
  data: ViewedMessage;
}

export interface ViewedMessageCreateResponse {
  data: ViewedMessage;
}

export interface ViewedMessageUpdateResponse {
  data: ViewedMessage;
}

export interface ViewedMessageDeleteResponse {
  data: ViewedMessage;
}

export interface ViewedMessageBatchCreateResponse<T> {
  data: T[];
  meta?: {
    count: number;
  };
}

export interface ViewedMessageBatchUpdateResponse<T> {
  data: T[];
  meta?: {
    count: number;
  };
}

export interface ViewedMessageBatchDeleteResponse {
  data: {
    count: number;
    deleted: string[];
  };
}
