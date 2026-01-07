/**
 * Message Type Definitions
 *
 * Defines types for in-app messages that can be displayed to users
 */

export type MessageStatus = 'draft' | 'active' | 'archived';
export type MessagePriority = 'low' | 'normal' | 'high';
export type MessageTargetType = 'all' | 'specific' | 'roles';

export interface MessageTargeting {
  type: MessageTargetType;
  userIds?: string[];
  roleIds?: string[];
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
  priority: MessagePriority;
  targeting: MessageTargeting;
  scheduling: MessageScheduling;
  stats?: MessageStats;
  createdAt: string | Date;
  updatedAt: string | Date;
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

// API Response types
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

export interface MessageBatchDeleteResponse {
  data: {
    count: number;
    deleted: string[];
  };
}
