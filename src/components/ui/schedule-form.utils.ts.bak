import { SCHEDULE_FREQUENCY } from "../../constants";
import type {
  ScheduleValidationRules,
  ScheduleValidationFactory,
  ScheduleFormConfig,
  ScheduleFormData,
  WeeklyScheduleConfig,
  MonthlyScheduleConfig,
  YearlyScheduleConfig,
} from "./schedule-form.types";

/**
 * Factory function to create validation rules based on frequency and type
 */
export const createScheduleValidationRules: ScheduleValidationFactory = (frequency: SCHEDULE_FREQUENCY, type: "order" | "ppe" | "maintenance"): ScheduleValidationRules => {
  const baseRules: ScheduleValidationRules = {
    requiresWeeklyConfig: false,
    requiresMonthlyConfig: false,
    requiresYearlyConfig: false,
    requiresSimpleFields: false,
  };

  switch (frequency) {
    case SCHEDULE_FREQUENCY.WEEKLY:
    case SCHEDULE_FREQUENCY.BIWEEKLY:
      baseRules.requiresWeeklyConfig = type === "order";
      baseRules.requiresSimpleFields = type !== "order";
      if (type !== "order") {
        baseRules.requiredSimpleFields = ["dayOfWeek"];
      }
      break;

    case SCHEDULE_FREQUENCY.MONTHLY:
    case SCHEDULE_FREQUENCY.BIMONTHLY:
    case SCHEDULE_FREQUENCY.QUARTERLY:
    case SCHEDULE_FREQUENCY.QUADRIMESTRAL:
    case SCHEDULE_FREQUENCY.SEMI_ANNUAL:
      baseRules.requiresMonthlyConfig = type === "order";
      baseRules.requiresSimpleFields = type !== "order";
      if (type !== "order") {
        baseRules.requiredSimpleFields = ["dayOfMonth"];
      }
      break;

    case SCHEDULE_FREQUENCY.ANNUAL:
    case SCHEDULE_FREQUENCY.TRIANNUAL:
      baseRules.requiresYearlyConfig = type === "order";
      baseRules.requiresSimpleFields = type !== "order";
      if (type !== "order") {
        baseRules.requiredSimpleFields = ["month", "dayOfMonth"];
      }
      break;

    case SCHEDULE_FREQUENCY.ONCE:
      baseRules.requiresSimpleFields = true;
      baseRules.requiredSimpleFields = ["specificDate"];
      break;

    case SCHEDULE_FREQUENCY.DAILY:
    case SCHEDULE_FREQUENCY.CUSTOM:
    default:
      // No specific configuration required for daily schedules
      baseRules.requiresSimpleFields = false;
      break;
  }

  return baseRules;
};

/**
 * Validates weekly schedule configuration
 */
export const validateWeeklySchedule = (weeklySchedule?: WeeklyScheduleConfig): boolean => {
  if (!weeklySchedule) return false;

  // At least one day must be selected
  return Object.values(weeklySchedule).some((day) => day === true);
};

/**
 * Validates monthly schedule configuration
 */
export const validateMonthlySchedule = (monthlySchedule?: MonthlyScheduleConfig): boolean => {
  if (!monthlySchedule) return false;

  // Either dayOfMonth OR (occurrence + dayOfWeek) must be set
  const hasDayOfMonth = monthlySchedule.dayOfMonth !== null && monthlySchedule.dayOfMonth !== undefined;
  const hasOccurrencePattern =
    monthlySchedule.occurrence !== null && monthlySchedule.occurrence !== undefined && monthlySchedule.dayOfWeek !== null && monthlySchedule.dayOfWeek !== undefined;

  return hasDayOfMonth || hasOccurrencePattern;
};

/**
 * Validates yearly schedule configuration
 */
export const validateYearlySchedule = (yearlySchedule?: YearlyScheduleConfig): boolean => {
  if (!yearlySchedule) return false;

  // Month is required
  if (!yearlySchedule.month) return false;

  // Either dayOfMonth OR (occurrence + dayOfWeek) must be set
  const hasDayOfMonth = yearlySchedule.dayOfMonth !== null && yearlySchedule.dayOfMonth !== undefined;
  const hasOccurrencePattern =
    yearlySchedule.occurrence !== null && yearlySchedule.occurrence !== undefined && yearlySchedule.dayOfWeek !== null && yearlySchedule.dayOfWeek !== undefined;

  return hasDayOfMonth || hasOccurrencePattern;
};

/**
 * Main validation function for schedule form data
 */
export const validateScheduleForm = (data: ScheduleFormData, config: ScheduleFormConfig): { isValid: boolean; errors: string[] } => {
  const errors: string[] = [];

  // Check if frequency is selected
  if (!data.frequency) {
    errors.push("Frequência é obrigatória");
  }

  if (!data.frequency) {
    return { isValid: false, errors };
  }

  const validationRules = createScheduleValidationRules(data.frequency, config.type);

  // Validate based on rules
  if (validationRules.requiresWeeklyConfig) {
    if (!validateWeeklySchedule(data.weeklySchedule)) {
      errors.push("Pelo menos um dia da semana deve ser selecionado");
    }
  }

  if (validationRules.requiresMonthlyConfig) {
    if (!validateMonthlySchedule(data.monthlySchedule)) {
      errors.push("Deve especificar o dia do mês OU o padrão de ocorrência");
    }
  }

  if (validationRules.requiresYearlyConfig) {
    if (!validateYearlySchedule(data.yearlySchedule)) {
      errors.push("Configuração anual inválida - mês é obrigatório e deve especificar dia ou padrão");
    }
  }

  if (validationRules.requiresSimpleFields && validationRules.requiredSimpleFields) {
    validationRules.requiredSimpleFields.forEach((field) => {
      switch (field) {
        case "specificDate":
          if (!data.specificDate) {
            errors.push("Data específica é obrigatória para execução única");
          }
          break;
        case "dayOfMonth":
          if (!data.dayOfMonth) {
            errors.push("Dia do mês é obrigatório para esta frequência");
          }
          break;
        case "dayOfWeek":
          if (!data.dayOfWeek) {
            errors.push("Dia da semana é obrigatório para esta frequência");
          }
          break;
        case "month":
          if (!data.month) {
            errors.push("Mês é obrigatório para esta frequência");
          }
          break;
      }
    });
  }

  // Additional validations based on type
  if (config.type === "maintenance" && config.showNextRun && !data.nextRun) {
    errors.push("Data da próxima execução é obrigatória");
  }

  return { isValid: errors.length === 0, errors };
};

/**
 * Gets the appropriate default config for different schedule types
 */
export const getDefaultScheduleConfig = (type: "order" | "ppe" | "maintenance"): ScheduleFormConfig => {
  const baseConfig: ScheduleFormConfig = {
    type,
    showNextRun: false,
    showSpecificDate: false,
    showFrequencyCount: true,
    showIsActive: true,
    complexScheduling: false,
  };

  switch (type) {
    case "order":
      return {
        ...baseConfig,
        complexScheduling: true,
        requiredFields: ["frequency", "supplierId", "categoryId", "items"],
      };

    case "ppe":
      return {
        ...baseConfig,
        showSpecificDate: true,
        requiredFields: ["frequency", "itemId", "quantity"],
      };

    case "maintenance":
      return {
        ...baseConfig,
        showNextRun: true,
        showSpecificDate: true,
        requiredFields: ["frequency", "name", "itemId", "nextRun"],
      };

    default:
      return baseConfig;
  }
};

/**
 * Helper function to initialize form data with proper defaults
 */
export const initializeScheduleFormData = (type: "order" | "ppe" | "maintenance"): Partial<ScheduleFormData> => {
  const baseData: Partial<ScheduleFormData> = {
    frequency: undefined,
    frequencyCount: 1,
    isActive: true,
  };

  switch (type) {
    case "order":
      return {
        ...baseData,
        items: [],
        weeklySchedule: {
          monday: false,
          tuesday: false,
          wednesday: false,
          thursday: false,
          friday: false,
          saturday: false,
          sunday: false,
        },
        monthlySchedule: {
          dayOfMonth: null,
          occurrence: null,
          dayOfWeek: null,
        },
        yearlySchedule: undefined, // Will be initialized when yearly frequency is selected
      };

    case "ppe":
      return {
        ...baseData,
        quantity: 1,
        customMonths: [],
      };

    case "maintenance":
      return {
        ...baseData,
        nextRun: undefined,
        // itemsNeeded is not part of ScheduleFormData, it's maintenance-specific
      };

    default:
      return baseData;
  }
};

/**
 * Converts schedule form data to the appropriate schema format
 */
export const transformScheduleDataForSubmission = (data: ScheduleFormData, type: "order" | "ppe" | "maintenance"): any => {
  const baseData = {
    frequency: data.frequency,
    frequencyCount: data.frequencyCount || 1,
    isActive: data.isActive !== false,
  };

  switch (type) {
    case "order":
      return {
        ...baseData,
        supplierId: data.supplierId || undefined,
        categoryId: data.categoryId || undefined,
        items: data.items || [],
        weeklySchedule: data.weeklySchedule,
        monthlySchedule: data.monthlySchedule,
        yearlySchedule: data.yearlySchedule,
      };

    case "ppe":
      return {
        ...baseData,
        itemId: data.itemId,
        userId: data.userId || null,
        categoryId: data.categoryId || null,
        quantity: data.quantity || 1,
        specificDate: data.specificDate || null,
        dayOfMonth: data.dayOfMonth || null,
        dayOfWeek: data.dayOfWeek || null,
        month: data.month || null,
        customMonths: data.customMonths || [],
      };

    case "maintenance":
      return {
        ...baseData,
        name: data.name,
        description: data.description || undefined,
        itemId: data.itemId,
        nextRun: data.nextRun,
        // lastRun and itemsNeeded are not part of ScheduleFormData
        // They should be handled separately in the maintenance-specific form
      };

    default:
      return baseData;
  }
};
