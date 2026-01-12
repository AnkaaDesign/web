import type { BaseEntity } from './common';

export type TASK_PRICING_STATUS = 'DRAFT' | 'APPROVED' | 'REJECTED' | 'CANCELLED';

export interface TaskPricingItem extends BaseEntity {
  description: string;
  amount: number;
  pricingId: string;
  pricing?: TaskPricing;
}

export interface TaskPricing extends BaseEntity {
  total: number;
  expiresAt: Date;
  status: TASK_PRICING_STATUS;
  taskId: string;
  task?: any;  // Task type
  items?: TaskPricingItem[];
}
