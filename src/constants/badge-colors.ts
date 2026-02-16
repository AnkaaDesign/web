/**
 * Centralized Badge Color Configuration System
 *
 * This file defines a comprehensive, consistent color mapping for all badges
 * across the Ankaa application, ensuring no color duplication for different
 * statuses and maintaining semantic meaning.
 *
 * Color Philosophy:
 * - Green: Success, completed, positive actions (entry, approved, active)
 * - Red: Failure, cancelled, negative actions (exit, rejected, lost)
 * - Orange/Amber: Warning states (overdue, pending, partially complete)
 * - Blue: Information, in-progress, neutral active states
 * - Gray: Inactive, muted, disabled states
 */

import {
  ORDER_STATUS,
  TASK_STATUS,
  MAINTENANCE_STATUS,
  USER_STATUS,
  EXTERNAL_WITHDRAWAL_STATUS,
  VACATION_STATUS,
  SERVICE_ORDER_STATUS,
  AIRBRUSHING_STATUS,
  CUT_STATUS,
  BORROW_STATUS,
  PPE_REQUEST_STATUS,
  PPE_DELIVERY_STATUS,
  MAINTENANCE_SCHEDULE_STATUS,
  SMS_VERIFICATION_STATUS,
  EMAIL_STATUS,
  VERIFICATION_STATUS,
  BATCH_OPERATION_STATUS,
  PRIORITY_TYPE,
  URGENCY_LEVEL,
  RISK_LEVEL,
  STOCK_LEVEL,
  HEALTH_STATUS,
  PERFORMANCE_LEVEL,
  NOTIFICATION_IMPORTANCE,
  WARNING_SEVERITY,
  WORKLOAD_LEVEL,
  EFFORT_LEVEL,
  CONFIDENCE_LEVEL,
  ACTIVITY_LEVEL,
  ACTIVITY_OPERATION,
  TREND_DIRECTION,
  TREND_TYPE,
  ABC_CATEGORY,
  XYZ_CATEGORY,
  VALIDATION_SEVERITY,
  VERIFICATION_ERROR_SEVERITY,
  SECTOR_PRIVILEGES,
  COMMISSION_STATUS,
} from "./enums";

/**
 * Badge Variant Types
 * Semantic variants that clearly express status meaning
 */
export type BadgeVariant =
  // Neutral variants
  | "default"
  | "secondary"
  | "muted"
  | "outline"
  | "inactive"
  // Core semantic variants (common across entities)
  | "completed"
  | "cancelled"
  | "pending"
  | "created"
  | "active"
  | "inProgress"
  | "processing"
  | "approved"
  | "rejected"
  | "received"
  | "delivered"
  | "sent"
  | "verified"
  | "expired"
  | "failed"
  | "preparation"
  | "blocked"
  | "suspended"
  | "returned"
  | "lost"
  | "bounced"
  // Color utilities (for entity-specific or non-status use)
  | "red"
  | "purple"
  | "teal"
  | "indigo"
  | "pink"
  | "yellow"
  | "amber"
  | "blue"
  | "orange"
  | "green"
  | "gray"
  | "cyan"
  // Deprecated (keep for backward compatibility)
  | "success"
  | "destructive"
  | "primary"
  | "error"
  | "info"
  | "warning";

/**
 * Badge Color Definitions
 * Maps variants to Tailwind CSS classes for consistent styling
 */
export const BADGE_COLORS: Record<
  BadgeVariant,
  {
    bg: string;
    text: string;
    hover: string;
    border?: string;
  }
> = {
  // ===== NEUTRAL VARIANTS =====
  default: {
    bg: "bg-neutral-500",
    text: "text-white",
    hover: "hover:bg-neutral-600",
  },
  secondary: {
    bg: "bg-neutral-200 dark:bg-neutral-700",
    text: "text-neutral-900 dark:text-neutral-100",
    hover: "hover:bg-neutral-300 dark:hover:bg-neutral-600",
  },
  muted: {
    bg: "bg-gray-500",
    text: "text-white",
    hover: "hover:bg-gray-600",
  },
  outline: {
    bg: "bg-transparent",
    text: "text-neutral-900 dark:text-neutral-100",
    hover: "hover:bg-neutral-100 dark:hover:bg-neutral-800",
    border: "border border-border",
  },
  inactive: {
    bg: "bg-gray-500",
    text: "text-white",
    hover: "hover:bg-gray-600",
  },

  // ===== CORE SEMANTIC VARIANTS =====
  // Green status variants (use green-700)
  completed: {
    bg: "bg-green-700",
    text: "text-white",
    hover: "hover:bg-green-800",
  },
  received: {
    bg: "bg-green-700",
    text: "text-white",
    hover: "hover:bg-green-800",
  },
  approved: {
    bg: "bg-green-700",
    text: "text-white",
    hover: "hover:bg-green-800",
  },
  returned: {
    bg: "bg-green-700",
    text: "text-white",
    hover: "hover:bg-green-800",
  },
  delivered: {
    bg: "bg-green-700",
    text: "text-white",
    hover: "hover:bg-green-800",
  },
  active: {
    bg: "bg-green-700",
    text: "text-white",
    hover: "hover:bg-green-800",
  },
  verified: {
    bg: "bg-green-700",
    text: "text-white",
    hover: "hover:bg-green-800",
  },
  sent: {
    bg: "bg-green-700",
    text: "text-white",
    hover: "hover:bg-green-800",
  },

  // Red status variants (use red-700)
  cancelled: {
    bg: "bg-red-700",
    text: "text-white",
    hover: "hover:bg-red-800",
  },
  rejected: {
    bg: "bg-red-700",
    text: "text-white",
    hover: "hover:bg-red-800",
  },
  lost: {
    bg: "bg-red-700",
    text: "text-white",
    hover: "hover:bg-red-800",
  },
  failed: {
    bg: "bg-red-700",
    text: "text-white",
    hover: "hover:bg-red-800",
  },
  bounced: {
    bg: "bg-red-700",
    text: "text-white",
    hover: "hover:bg-red-800",
  },
  blocked: {
    bg: "bg-red-700",
    text: "text-white",
    hover: "hover:bg-red-800",
  },
  suspended: {
    bg: "bg-red-700",
    text: "text-white",
    hover: "hover:bg-red-800",
  },

  // Blue status variants (use blue-700)
  created: {
    bg: "bg-blue-700",
    text: "text-white",
    hover: "hover:bg-blue-800",
  },
  inProgress: {
    bg: "bg-blue-700",
    text: "text-white",
    hover: "hover:bg-blue-800",
  },
  processing: {
    bg: "bg-blue-700",
    text: "text-white",
    hover: "hover:bg-blue-800",
  },

  // Amber status variants (use amber-600)
  pending: {
    bg: "bg-amber-600",
    text: "text-white",
    hover: "hover:bg-amber-700",
  },
  expired: {
    bg: "bg-amber-600",
    text: "text-white",
    hover: "hover:bg-amber-700",
  },

  // Orange status variants (use orange-600)
  preparation: {
    bg: "bg-orange-600",
    text: "text-white",
    hover: "hover:bg-orange-700",
  },

  // ===== COLOR UTILITIES =====
  red: {
    bg: "bg-red-700",
    text: "text-white",
    hover: "hover:bg-red-800",
  },
  purple: {
    bg: "bg-purple-600",
    text: "text-white",
    hover: "hover:bg-purple-700",
  },
  teal: {
    bg: "bg-teal-500",
    text: "text-white",
    hover: "hover:bg-teal-600",
  },
  indigo: {
    bg: "bg-indigo-600",
    text: "text-white",
    hover: "hover:bg-indigo-700",
  },
  pink: {
    bg: "bg-pink-600",
    text: "text-white",
    hover: "hover:bg-pink-700",
  },
  yellow: {
    bg: "bg-yellow-500",
    text: "text-white",
    hover: "hover:bg-yellow-600",
  },
  amber: {
    bg: "bg-amber-500",
    text: "text-white",
    hover: "hover:bg-amber-600",
  },
  blue: {
    bg: "bg-blue-600",
    text: "text-white",
    hover: "hover:bg-blue-700",
  },
  orange: {
    bg: "bg-orange-500",
    text: "text-white",
    hover: "hover:bg-orange-600",
  },
  green: {
    bg: "bg-green-700",
    text: "text-white",
    hover: "hover:bg-green-800",
  },
  gray: {
    bg: "bg-neutral-500",
    text: "text-white",
    hover: "hover:bg-neutral-600",
  },
  cyan: {
    bg: "bg-cyan-500",
    text: "text-white",
    hover: "hover:bg-cyan-600",
  },

  // ===== DEPRECATED - Keep for backward compatibility =====
  success: {
    bg: "bg-green-700", // Standardized to green-700
    text: "text-white",
    hover: "hover:bg-green-800",
  },
  destructive: {
    bg: "bg-red-700", // Standardized to red-700
    text: "text-white",
    hover: "hover:bg-red-800",
  },
  primary: {
    bg: "bg-blue-700", // Standardized to blue-700
    text: "text-white",
    hover: "hover:bg-blue-800",
  },
  error: {
    bg: "bg-red-700", // Standardized to red-700
    text: "text-white",
    hover: "hover:bg-red-800",
  },
  info: {
    bg: "bg-blue-700", // Standardized to blue-700
    text: "text-white",
    hover: "hover:bg-blue-800",
  },
  warning: {
    bg: "bg-orange-600", // Standardized to orange-600
    text: "text-white",
    hover: "hover:bg-orange-700",
  },
};

/**
 * Entity-specific badge configurations
 * Maps specific entity status enums to badge variants
 */
export const ENTITY_BADGE_CONFIG = {
  // Order Status
  ORDER: {
    [ORDER_STATUS.CREATED]: "gray" as BadgeVariant,                // Gray - initial state
    [ORDER_STATUS.PARTIALLY_FULFILLED]: "cyan" as BadgeVariant,    // Cyan - partially done
    [ORDER_STATUS.FULFILLED]: "blue" as BadgeVariant,              // Blue - done/fulfilled
    [ORDER_STATUS.OVERDUE]: "purple" as BadgeVariant,              // Purple - overdue
    [ORDER_STATUS.PARTIALLY_RECEIVED]: "teal" as BadgeVariant,     // Teal - partially received
    [ORDER_STATUS.RECEIVED]: "received" as BadgeVariant,           // Green - received
    [ORDER_STATUS.CANCELLED]: "cancelled" as BadgeVariant,         // Red - cancelled
  },

  // Task Status
  TASK: {
    [TASK_STATUS.PREPARATION]: "orange" as BadgeVariant,            // Orange - in preparation
    [TASK_STATUS.WAITING_PRODUCTION]: "gray" as BadgeVariant,       // Gray - waiting for production
    [TASK_STATUS.IN_PRODUCTION]: "blue" as BadgeVariant,            // Blue - in progress
    [TASK_STATUS.COMPLETED]: "green" as BadgeVariant,               // Green - finished
    [TASK_STATUS.CANCELLED]: "red" as BadgeVariant,                 // Red - cancelled
  },

  // Maintenance Status
  MAINTENANCE: {
    [MAINTENANCE_STATUS.PENDING]: "pending" as BadgeVariant,
    [MAINTENANCE_STATUS.IN_PROGRESS]: "inProgress" as BadgeVariant,
    [MAINTENANCE_STATUS.COMPLETED]: "completed" as BadgeVariant,
    [MAINTENANCE_STATUS.CANCELLED]: "cancelled" as BadgeVariant,
    [MAINTENANCE_STATUS.OVERDUE]: "purple" as BadgeVariant,
  },

  // User Status
  USER: {
    [USER_STATUS.EXPERIENCE_PERIOD_1]: "pending" as BadgeVariant,  // Amber - first trial period
    [USER_STATUS.EXPERIENCE_PERIOD_2]: "created" as BadgeVariant,  // Blue - second trial period
    [USER_STATUS.EFFECTED]: "green" as BadgeVariant,               // Entity-specific: use green
    [USER_STATUS.DISMISSED]: "red" as BadgeVariant,                // Entity-specific: use red
  },

  // External Withdrawal Status
  EXTERNAL_WITHDRAWAL: {
    [EXTERNAL_WITHDRAWAL_STATUS.PENDING]: "pending" as BadgeVariant,
    [EXTERNAL_WITHDRAWAL_STATUS.PARTIALLY_RETURNED]: "orange" as BadgeVariant,  // Entity-specific: use orange
    [EXTERNAL_WITHDRAWAL_STATUS.FULLY_RETURNED]: "green" as BadgeVariant,       // Entity-specific: use green
    [EXTERNAL_WITHDRAWAL_STATUS.CHARGED]: "blue" as BadgeVariant,               // Entity-specific: use blue
    [EXTERNAL_WITHDRAWAL_STATUS.LIQUIDATED]: "green" as BadgeVariant,           // Entity-specific: use green
    [EXTERNAL_WITHDRAWAL_STATUS.DELIVERED]: "delivered" as BadgeVariant,
    [EXTERNAL_WITHDRAWAL_STATUS.CANCELLED]: "cancelled" as BadgeVariant,
  },

  // Vacation Status
  VACATION: {
    [VACATION_STATUS.PENDING]: "pending" as BadgeVariant,
    [VACATION_STATUS.APPROVED]: "approved" as BadgeVariant,
    [VACATION_STATUS.REJECTED]: "rejected" as BadgeVariant,
    [VACATION_STATUS.CANCELLED]: "cancelled" as BadgeVariant,
    [VACATION_STATUS.IN_PROGRESS]: "inProgress" as BadgeVariant,
    [VACATION_STATUS.COMPLETED]: "completed" as BadgeVariant,
  },


  // Service Order Status
  SERVICE_ORDER: {
    [SERVICE_ORDER_STATUS.PENDING]: "gray" as BadgeVariant,           // Gray - not started
    [SERVICE_ORDER_STATUS.IN_PROGRESS]: "blue" as BadgeVariant,       // Blue - in progress
    [SERVICE_ORDER_STATUS.WAITING_APPROVE]: "purple" as BadgeVariant, // Purple - awaiting approval
    [SERVICE_ORDER_STATUS.COMPLETED]: "green" as BadgeVariant,        // Green - completed
    [SERVICE_ORDER_STATUS.CANCELLED]: "red" as BadgeVariant,          // Red - cancelled
  },

  // Airbrushing Status
  AIRBRUSHING: {
    [AIRBRUSHING_STATUS.PENDING]: "gray" as BadgeVariant,          // Gray - not started (consistent with other entities)
    [AIRBRUSHING_STATUS.IN_PRODUCTION]: "blue" as BadgeVariant,    // Blue - in progress
    [AIRBRUSHING_STATUS.COMPLETED]: "completed" as BadgeVariant,   // Green - completed
    [AIRBRUSHING_STATUS.CANCELLED]: "cancelled" as BadgeVariant,   // Red - cancelled
  },

  // Cut Status
  CUT: {
    [CUT_STATUS.PENDING]: "gray" as BadgeVariant,
    [CUT_STATUS.CUTTING]: "blue" as BadgeVariant,
    [CUT_STATUS.COMPLETED]: "green" as BadgeVariant,
  },

  // Borrow Status
  BORROW: {
    [BORROW_STATUS.ACTIVE]: "blue" as BadgeVariant,    // Blue for active borrows
    [BORROW_STATUS.RETURNED]: "green" as BadgeVariant, // Green for returned
    [BORROW_STATUS.LOST]: "red" as BadgeVariant,       // Red for lost
  },

  // PPE Request Status
  PPE_REQUEST: {
    [PPE_REQUEST_STATUS.PENDING]: "pending" as BadgeVariant,
    [PPE_REQUEST_STATUS.APPROVED]: "approved" as BadgeVariant,
    [PPE_REQUEST_STATUS.REJECTED]: "rejected" as BadgeVariant,
    [PPE_REQUEST_STATUS.DELIVERED]: "delivered" as BadgeVariant,
    [PPE_REQUEST_STATUS.CANCELLED]: "cancelled" as BadgeVariant,
  },

  // PPE Delivery Status
  PPE_DELIVERY: {
    [PPE_DELIVERY_STATUS.PENDING]: "gray" as BadgeVariant,
    [PPE_DELIVERY_STATUS.APPROVED]: "blue" as BadgeVariant,
    [PPE_DELIVERY_STATUS.DELIVERED]: "delivered" as BadgeVariant,
    [PPE_DELIVERY_STATUS.WAITING_SIGNATURE]: "amber" as BadgeVariant,
    [PPE_DELIVERY_STATUS.COMPLETED]: "green" as BadgeVariant,
    [PPE_DELIVERY_STATUS.REPROVED]: "red" as BadgeVariant,
    [PPE_DELIVERY_STATUS.SIGNATURE_REJECTED]: "red" as BadgeVariant,
    [PPE_DELIVERY_STATUS.CANCELLED]: "cancelled" as BadgeVariant,
  },

  // Maintenance Schedule Status
  MAINTENANCE_SCHEDULE: {
    [MAINTENANCE_SCHEDULE_STATUS.PENDING]: "pending" as BadgeVariant,
    [MAINTENANCE_SCHEDULE_STATUS.FINISHED]: "green" as BadgeVariant,
    [MAINTENANCE_SCHEDULE_STATUS.CANCELLED]: "cancelled" as BadgeVariant,
  },

  // Activity Operation (Entrada/Saída)
  ACTIVITY: {
    [ACTIVITY_OPERATION.INBOUND]: "received" as BadgeVariant, // Green for entry
    [ACTIVITY_OPERATION.OUTBOUND]: "cancelled" as BadgeVariant, // Red for exit
  },

  // Priority Type
  PRIORITY: {
    [PRIORITY_TYPE.LOW]: "muted" as BadgeVariant,
    [PRIORITY_TYPE.MEDIUM]: "pending" as BadgeVariant,
    [PRIORITY_TYPE.HIGH]: "warning" as BadgeVariant,
    [PRIORITY_TYPE.CRITICAL]: "destructive" as BadgeVariant,
  },

  // Urgency Level
  URGENCY: {
    [URGENCY_LEVEL.LOW]: "muted" as BadgeVariant,
    [URGENCY_LEVEL.MEDIUM]: "pending" as BadgeVariant,
    [URGENCY_LEVEL.HIGH]: "warning" as BadgeVariant,
    [URGENCY_LEVEL.CRITICAL]: "destructive" as BadgeVariant,
  },

  // Risk Level
  RISK: {
    [RISK_LEVEL.LOW]: "success" as BadgeVariant,
    [RISK_LEVEL.MEDIUM]: "pending" as BadgeVariant,
    [RISK_LEVEL.HIGH]: "warning" as BadgeVariant,
    [RISK_LEVEL.CRITICAL]: "destructive" as BadgeVariant,
  },

  // Stock Level
  STOCK: {
    [STOCK_LEVEL.NEGATIVE_STOCK]: "destructive" as BadgeVariant,
    [STOCK_LEVEL.OUT_OF_STOCK]: "error" as BadgeVariant,
    [STOCK_LEVEL.CRITICAL]: "warning" as BadgeVariant,
    [STOCK_LEVEL.LOW]: "pending" as BadgeVariant,
    [STOCK_LEVEL.OPTIMAL]: "success" as BadgeVariant,
    [STOCK_LEVEL.OVERSTOCKED]: "info" as BadgeVariant,
  },

  // Health Status
  HEALTH: {
    [HEALTH_STATUS.EXCELLENT]: "success" as BadgeVariant,
    [HEALTH_STATUS.GOOD]: "active" as BadgeVariant,
    [HEALTH_STATUS.FAIR]: "pending" as BadgeVariant,
    [HEALTH_STATUS.POOR]: "warning" as BadgeVariant,
    [HEALTH_STATUS.CRITICAL]: "destructive" as BadgeVariant,
  },

  // Performance Level
  PERFORMANCE: {
    [PERFORMANCE_LEVEL.EXCELLENT]: "success" as BadgeVariant,
    [PERFORMANCE_LEVEL.GOOD]: "active" as BadgeVariant,
    [PERFORMANCE_LEVEL.FAIR]: "pending" as BadgeVariant,
    [PERFORMANCE_LEVEL.POOR]: "warning" as BadgeVariant,
  },

  // Notification Importance
  NOTIFICATION: {
    [NOTIFICATION_IMPORTANCE.LOW]: "muted" as BadgeVariant,
    [NOTIFICATION_IMPORTANCE.NORMAL]: "default" as BadgeVariant,
    [NOTIFICATION_IMPORTANCE.HIGH]: "warning" as BadgeVariant,
    [NOTIFICATION_IMPORTANCE.URGENT]: "destructive" as BadgeVariant,
  },

  // Warning Severity
  WARNING: {
    [WARNING_SEVERITY.VERBAL]: "info" as BadgeVariant,
    [WARNING_SEVERITY.WRITTEN]: "pending" as BadgeVariant,
    [WARNING_SEVERITY.SUSPENSION]: "warning" as BadgeVariant,
    [WARNING_SEVERITY.FINAL_WARNING]: "destructive" as BadgeVariant,
  },

  // SMS Verification Status
  SMS_VERIFICATION: {
    [SMS_VERIFICATION_STATUS.PENDING]: "pending" as BadgeVariant,
    [SMS_VERIFICATION_STATUS.SENT]: "sent" as BadgeVariant,
    [SMS_VERIFICATION_STATUS.VERIFIED]: "verified" as BadgeVariant,
    [SMS_VERIFICATION_STATUS.EXPIRED]: "expired" as BadgeVariant,
    [SMS_VERIFICATION_STATUS.FAILED]: "failed" as BadgeVariant,
    [SMS_VERIFICATION_STATUS.CANCELLED]: "cancelled" as BadgeVariant,
    [SMS_VERIFICATION_STATUS.RATE_LIMITED]: "onHold" as BadgeVariant,
    [SMS_VERIFICATION_STATUS.BLOCKED]: "blocked" as BadgeVariant,
  },

  // Email Status
  EMAIL: {
    [EMAIL_STATUS.PENDING]: "pending" as BadgeVariant,
    [EMAIL_STATUS.SENT]: "sent" as BadgeVariant,
    [EMAIL_STATUS.DELIVERED]: "delivered" as BadgeVariant,
    [EMAIL_STATUS.FAILED]: "failed" as BadgeVariant,
    [EMAIL_STATUS.BOUNCED]: "bounced" as BadgeVariant,
    [EMAIL_STATUS.CANCELLED]: "cancelled" as BadgeVariant,
  },

  // Verification Status
  VERIFICATION: {
    [VERIFICATION_STATUS.PENDING]: "pending" as BadgeVariant,
    [VERIFICATION_STATUS.SENT]: "sent" as BadgeVariant,
    [VERIFICATION_STATUS.VERIFIED]: "verified" as BadgeVariant,
    [VERIFICATION_STATUS.EXPIRED]: "expired" as BadgeVariant,
    [VERIFICATION_STATUS.FAILED]: "failed" as BadgeVariant,
    [VERIFICATION_STATUS.CANCELLED]: "cancelled" as BadgeVariant,
  },

  // Batch Operation Status
  BATCH_OPERATION: {
    [BATCH_OPERATION_STATUS.PENDING]: "pending" as BadgeVariant,
    [BATCH_OPERATION_STATUS.PROCESSING]: "processing" as BadgeVariant,
    [BATCH_OPERATION_STATUS.COMPLETED]: "completed" as BadgeVariant,
    [BATCH_OPERATION_STATUS.FAILED]: "failed" as BadgeVariant,
    [BATCH_OPERATION_STATUS.PARTIAL]: "orange" as BadgeVariant,
  },

  // Workload Level
  WORKLOAD: {
    [WORKLOAD_LEVEL.LOW]: "success" as BadgeVariant,
    [WORKLOAD_LEVEL.NORMAL]: "default" as BadgeVariant,
    [WORKLOAD_LEVEL.HIGH]: "warning" as BadgeVariant,
    [WORKLOAD_LEVEL.CRITICAL]: "destructive" as BadgeVariant,
  },

  // Effort Level
  EFFORT: {
    [EFFORT_LEVEL.LOW]: "success" as BadgeVariant,
    [EFFORT_LEVEL.MEDIUM]: "pending" as BadgeVariant,
    [EFFORT_LEVEL.HIGH]: "warning" as BadgeVariant,
  },

  // Confidence Level
  CONFIDENCE: {
    [CONFIDENCE_LEVEL.LOW]: "warning" as BadgeVariant,
    [CONFIDENCE_LEVEL.MEDIUM]: "pending" as BadgeVariant,
    [CONFIDENCE_LEVEL.HIGH]: "success" as BadgeVariant,
  },

  // Activity Level
  ACTIVITY_LEVEL: {
    [ACTIVITY_LEVEL.VERY_ACTIVE]: "active" as BadgeVariant,
    [ACTIVITY_LEVEL.ACTIVE]: "active" as BadgeVariant,
    [ACTIVITY_LEVEL.OCCASIONAL]: "pending" as BadgeVariant,
    [ACTIVITY_LEVEL.DORMANT]: "inactive" as BadgeVariant,
    [ACTIVITY_LEVEL.LOST]: "lost" as BadgeVariant,
  },

  // Trend Direction
  TREND: {
    [TREND_DIRECTION.UP]: "success" as BadgeVariant,
    [TREND_DIRECTION.DOWN]: "error" as BadgeVariant,
    [TREND_DIRECTION.STABLE]: "default" as BadgeVariant,
  },

  // Trend Type
  TREND_TYPE: {
    [TREND_TYPE.POSITIVE]: "success" as BadgeVariant,
    [TREND_TYPE.NEGATIVE]: "error" as BadgeVariant,
    [TREND_TYPE.NEUTRAL]: "default" as BadgeVariant,
    [TREND_TYPE.VOLATILE]: "warning" as BadgeVariant,
    [TREND_TYPE.SEASONAL]: "info" as BadgeVariant,
  },

  // Validation Severity
  VALIDATION: {
    [VALIDATION_SEVERITY.ERROR]: "error" as BadgeVariant,
    [VALIDATION_SEVERITY.WARNING]: "warning" as BadgeVariant,
    [VALIDATION_SEVERITY.INFO]: "info" as BadgeVariant,
  },

  // Verification Error Severity
  VERIFICATION_ERROR: {
    [VERIFICATION_ERROR_SEVERITY.LOW]: "info" as BadgeVariant,
    [VERIFICATION_ERROR_SEVERITY.MEDIUM]: "pending" as BadgeVariant,
    [VERIFICATION_ERROR_SEVERITY.HIGH]: "warning" as BadgeVariant,
    [VERIFICATION_ERROR_SEVERITY.CRITICAL]: "destructive" as BadgeVariant,
  },

  // Sector Privileges
  SECTOR_PRIVILEGES: {
    [SECTOR_PRIVILEGES.ADMIN]: "red" as BadgeVariant,              // Red - admin privileges
    [SECTOR_PRIVILEGES.PRODUCTION]: "blue" as BadgeVariant,        // Blue - production role
    [SECTOR_PRIVILEGES.HUMAN_RESOURCES]: "purple" as BadgeVariant, // Purple - HR specific
    [SECTOR_PRIVILEGES.FINANCIAL]: "purple" as BadgeVariant,       // Purple - financial role (same as HR)
    [SECTOR_PRIVILEGES.DESIGNER]: "purple" as BadgeVariant,        // Purple - designer role (same as HR)
    [SECTOR_PRIVILEGES.LOGISTIC]: "purple" as BadgeVariant,        // Purple - logistics role (same as HR)
    [SECTOR_PRIVILEGES.PLOTTING]: "purple" as BadgeVariant,        // Purple - plotting role (same as HR)
    [SECTOR_PRIVILEGES.MAINTENANCE]: "orange" as BadgeVariant,     // Orange - maintenance role
    [SECTOR_PRIVILEGES.BASIC]: "gray" as BadgeVariant,             // Gray - basic access
    [SECTOR_PRIVILEGES.EXTERNAL]: "gray" as BadgeVariant,          // Gray - external access
    [SECTOR_PRIVILEGES.WAREHOUSE]: "green" as BadgeVariant,        // Green - warehouse role
  },

  // Commission Status
  // green = integral, blue = parcial, orange = sem comissão, red = suspensa
  COMMISSION_STATUS: {
    [COMMISSION_STATUS.FULL_COMMISSION]: "green" as BadgeVariant,      // Green - full commission
    [COMMISSION_STATUS.PARTIAL_COMMISSION]: "blue" as BadgeVariant,    // Blue - partial commission
    [COMMISSION_STATUS.NO_COMMISSION]: "orange" as BadgeVariant,       // Orange - no commission
    [COMMISSION_STATUS.SUSPENDED_COMMISSION]: "suspended" as BadgeVariant, // Red - suspended
  },
};

/**
 * Generic status mapping for common patterns
 * These are fallbacks when entity-specific mapping is not found
 */
export const GENERIC_STATUS_CONFIG: Record<string, BadgeVariant> = {
  // Common status values
  PENDING: "pending",
  IN_PROGRESS: "inProgress",
  IN_PRODUCTION: "inProgress",
  COMPLETED: "completed",
  CANCELLED: "cancelled",
  ACTIVE: "active",
  INACTIVE: "inactive",
  APPROVED: "approved",
  REJECTED: "rejected",
  DELIVERED: "delivered",
  FAILED: "failed",
  EXPIRED: "expired",
  VERIFIED: "verified",
  RETURNED: "returned",
  LOST: "lost",
  OVERDUE: "purple",
  CREATED: "created",
  FULFILLED: "amber",
  RECEIVED: "received",
  SENT: "sent",
  PREPARATION: "preparation",
  SUSPENDED: "suspended",
  BLOCKED: "blocked",
  PROCESSING: "processing",
  PARTIAL: "orange",
  CUTTING: "processing",
  FINISHED: "completed",
  CHARGED: "blue",
  RATE_LIMITED: "pending",
  BOUNCED: "bounced",
  DISMISSED: "cancelled",
  EFFECTED: "active",
  REPROVED: "rejected",

  // Operations
  INBOUND: "active", // Green for entry
  OUTBOUND: "cancelled", // Red for exit
  "1": "active", // Numeric inbound
  "-1": "cancelled", // Numeric outbound

  // Performance/Health levels
  EXCELLENT: "green",
  GOOD: "active",
  FAIR: "pending",
  POOR: "warning",
  CRITICAL: "failed",

  // Priority/Urgency levels
  LOW: "muted",
  MEDIUM: "pending",
  HIGH: "warning",
  NORMAL: "default",
  URGENT: "failed",

  // Trends
  UP: "active",
  DOWN: "failed",
  STABLE: "default",
  POSITIVE: "active",
  NEGATIVE: "failed",
  NEUTRAL: "default",
  VOLATILE: "warning",
  SEASONAL: "created",

  // Activity levels
  VERY_ACTIVE: "active",
  OCCASIONAL: "pending",
  DORMANT: "inactive",

  // Validation
  ERROR: "failed",
  WARNING: "warning",
  INFO: "created",

  // Special
  VERBAL: "created",
  WRITTEN: "pending",
  SUSPENSION: "suspended",
  FINAL_WARNING: "failed",
  PENDING_JUSTIFICATION: "pending",
  JUSTIFICATION_SUBMITTED: "sent",
  PARTIALLY_FULFILLED: "yellow",
  PARTIALLY_RECEIVED: "teal",
  PARTIALLY_RETURNED: "orange",
  FULLY_RETURNED: "green",

  // Commission Status fallback
  FULL_COMMISSION: "green",
  PARTIAL_COMMISSION: "blue",
  NO_COMMISSION: "orange",
  SUSPENDED_COMMISSION: "suspended",
};

/**
 * ABC Category Badge Colors
 * Special color scheme for inventory analysis badges
 */
export const ABC_BADGE_COLORS: Record<
  ABC_CATEGORY,
  {
    bg: string;
    text: string;
    hover: string;
  }
> = {
  [ABC_CATEGORY.A]: {
    bg: "bg-red-100 dark:bg-red-900/20",
    text: "text-red-700 dark:text-red-400",
    hover: "hover:bg-red-200 dark:hover:bg-red-900/30",
  },
  [ABC_CATEGORY.B]: {
    bg: "bg-yellow-100 dark:bg-yellow-900/20",
    text: "text-yellow-700 dark:text-yellow-400",
    hover: "hover:bg-yellow-200 dark:hover:bg-yellow-900/30",
  },
  [ABC_CATEGORY.C]: {
    bg: "bg-green-100 dark:bg-green-900/20",
    text: "text-green-700 dark:text-green-400",
    hover: "hover:bg-green-200 dark:hover:bg-green-900/30",
  },
};

/**
 * XYZ Category Badge Colors
 * Special color scheme for inventory analysis badges
 */
export const XYZ_BADGE_COLORS: Record<
  XYZ_CATEGORY,
  {
    bg: string;
    text: string;
    hover: string;
  }
> = {
  [XYZ_CATEGORY.X]: {
    bg: "bg-blue-100 dark:bg-blue-900/20",
    text: "text-blue-700 dark:text-blue-400",
    hover: "hover:bg-blue-200 dark:hover:bg-blue-900/30",
  },
  [XYZ_CATEGORY.Y]: {
    bg: "bg-purple-100 dark:bg-purple-900/20",
    text: "text-purple-700 dark:text-purple-400",
    hover: "hover:bg-purple-200 dark:hover:bg-purple-900/30",
  },
  [XYZ_CATEGORY.Z]: {
    bg: "bg-orange-100 dark:bg-orange-900/20",
    text: "text-orange-700 dark:text-orange-400",
    hover: "hover:bg-orange-200 dark:hover:bg-orange-900/30",
  },
};

/**
 * Boolean Badge Configurations
 * For fields like willReturn, isActive, etc.
 */
export const BOOLEAN_BADGE_CONFIG = {
  willReturn: {
    true: "green" as BadgeVariant,     // Green - will return items (positive)
    false: "cancelled" as BadgeVariant, // Red - won't return items (negative)
  },
  isActive: {
    true: "active" as BadgeVariant,
    false: "inactive" as BadgeVariant,
  },
  isUrgent: {
    true: "failed" as BadgeVariant,
    false: "default" as BadgeVariant,
  },
  isCompleted: {
    true: "completed" as BadgeVariant,
    false: "pending" as BadgeVariant,
  },
  isApproved: {
    true: "approved" as BadgeVariant,
    false: "pending" as BadgeVariant,
  },
  isVerified: {
    true: "verified" as BadgeVariant,
    false: "pending" as BadgeVariant,
  },
  isDelivered: {
    true: "delivered" as BadgeVariant,
    false: "pending" as BadgeVariant,
  },
  isOverdue: {
    true: "overdue" as BadgeVariant,
    false: "default" as BadgeVariant,
  },
};

/**
 * Helper function to get badge variant from any enum value
 * First checks entity-specific mappings, then falls back to generic mappings
 */
export function getBadgeVariant(value: string, entity?: keyof typeof ENTITY_BADGE_CONFIG | string): BadgeVariant {
  // If entity is specified, check entity-specific config first (case-insensitive)
  if (entity) {
    const entityKey = entity.toUpperCase() as keyof typeof ENTITY_BADGE_CONFIG;
    if (ENTITY_BADGE_CONFIG[entityKey]) {
      const entityConfig = ENTITY_BADGE_CONFIG[entityKey] as Record<string, BadgeVariant>;
      if (entityConfig[value]) {
        return entityConfig[value];
      }
    }
  }

  // Fall back to generic status config
  return GENERIC_STATUS_CONFIG[value] || "default";
}

/**
 * Helper function to get badge colors from variant
 */
export function getBadgeColors(variant: BadgeVariant) {
  return BADGE_COLORS[variant];
}

/**
 * Helper function to get badge variant for boolean fields
 */
export function getBooleanBadgeVariant(field: keyof typeof BOOLEAN_BADGE_CONFIG, value: boolean): BadgeVariant {
  return BOOLEAN_BADGE_CONFIG[field]?.[String(value) as "true" | "false"] || "default";
}

/**
 * Helper function to get ABC category badge colors
 */
export function getABCBadgeColors(category: ABC_CATEGORY) {
  return ABC_BADGE_COLORS[category];
}

/**
 * Helper function to get XYZ category badge colors
 */
export function getXYZBadgeColors(category: XYZ_CATEGORY) {
  return XYZ_BADGE_COLORS[category];
}

/**
 * Export all badge configurations for use across the application
 */
export default {
  BADGE_COLORS,
  ENTITY_BADGE_CONFIG,
  GENERIC_STATUS_CONFIG,
  ABC_BADGE_COLORS,
  XYZ_BADGE_COLORS,
  BOOLEAN_BADGE_CONFIG,
  getBadgeVariant,
  getBadgeColors,
  getBooleanBadgeVariant,
  getABCBadgeColors,
  getXYZBadgeColors,
};
