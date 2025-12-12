import type { SCHEDULE_FREQUENCY, WEEK_DAY, MONTH, MONTH_OCCURRENCE } from "../../constants";

// Base schedule configuration interface
export interface BaseScheduleConfig {
  frequency: SCHEDULE_FREQUENCY;
  frequencyCount?: number;
  isActive?: boolean;
}

// Weekly schedule configuration
export interface WeeklyScheduleConfig {
  monday: boolean;
  tuesday: boolean;
  wednesday: boolean;
  thursday: boolean;
  friday: boolean;
  saturday: boolean;
  sunday: boolean;
}

// Monthly schedule configuration
export interface MonthlyScheduleConfig {
  dayOfMonth?: number | null;
  occurrence?: MONTH_OCCURRENCE | null;
  dayOfWeek?: WEEK_DAY | null;
}

// Yearly schedule configuration
export interface YearlyScheduleConfig {
  month: MONTH;
  dayOfMonth?: number | null;
  occurrence?: MONTH_OCCURRENCE | null;
  dayOfWeek?: WEEK_DAY | null;
}

// Order schedule form data (complex nested structure)
export interface OrderScheduleFormData extends BaseScheduleConfig {
  supplierId?: string;
  categoryId?: string;
  items?: string[];
  weeklySchedule?: WeeklyScheduleConfig;
  monthlySchedule?: MonthlyScheduleConfig;
  yearlySchedule?: YearlyScheduleConfig;
}

// PPE schedule form data (flat structure with optional config relations)
export interface PPEScheduleFormData extends BaseScheduleConfig {
  itemId: string;
  userId?: string | null;
  categoryId?: string | null;
  quantity: number;
  specificDate?: Date | null;
  dayOfMonth?: number | null;
  dayOfWeek?: WEEK_DAY | null;
  month?: MONTH | null;
  customMonths?: MONTH[];
  weeklyConfigId?: string | null;
  monthlyConfigId?: string | null;
  yearlyConfigId?: string | null;
}

// Maintenance schedule form data (simple structure)
export interface MaintenanceScheduleFormData extends BaseScheduleConfig {
  name: string;
  description?: string;
  itemId: string;
  nextRun: Date;
  lastRun?: Date | null;
  itemsNeeded?: Array<{
    itemId: string;
    quantity: number;
  }>;
}

// Generic schedule form data for reusable component
export interface ScheduleFormData extends BaseScheduleConfig {
  // Optional complex configurations
  weeklySchedule?: WeeklyScheduleConfig;
  monthlySchedule?: MonthlyScheduleConfig;
  yearlySchedule?: YearlyScheduleConfig;

  // Simple configuration fields
  nextRun?: Date;
  specificDate?: Date | null;
  dayOfMonth?: number | null;
  dayOfWeek?: WEEK_DAY | null;
  month?: MONTH | null;
  customMonths?: MONTH[];

  // Entity relationships
  itemId?: string;
  supplierId?: string;
  categoryId?: string;
  userId?: string | null;

  // Additional fields
  quantity?: number;
  items?: string[];
  name?: string;
  description?: string;
}

// Configuration options for the schedule form component
export interface ScheduleFormConfig {
  type: "order" | "ppe" | "maintenance";
  showNextRun?: boolean;
  showSpecificDate?: boolean;
  showFrequencyCount?: boolean;
  showIsActive?: boolean;
  requiredFields?: string[];
  complexScheduling?: boolean; // Whether to use nested schedule objects
}

// Validation helpers for different schedule types
export interface ScheduleValidationRules {
  requiresWeeklyConfig: boolean;
  requiresMonthlyConfig: boolean;
  requiresYearlyConfig: boolean;
  requiresSimpleFields: boolean;
  requiredSimpleFields?: Array<"dayOfMonth" | "dayOfWeek" | "month" | "specificDate">;
}

// Factory function return type for creating schedule validation rules
export type ScheduleValidationFactory = (frequency: SCHEDULE_FREQUENCY, type: "order" | "ppe" | "maintenance") => ScheduleValidationRules;
