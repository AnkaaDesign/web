import { cn } from "@/lib/utils";

/**
 * Utility functions for time clock entry UI components
 */

// Animation utilities
export const triggerFlashAnimation = (element: HTMLElement, type: "highlight" | "error" | "success" = "highlight") => {
  const className = `${type}-flash`;
  element.classList.add(className);

  // Remove the class after animation completes
  setTimeout(() => {
    element.classList.remove(className);
  }, 800);
};

export const triggerCellFlash = (entryId: string, field: string, type: "highlight" | "error" | "success" = "highlight") => {
  const cellElement = document.querySelector(`[data-entry-id="${entryId}"][data-field="${field}"]`);
  if (cellElement instanceof HTMLElement) {
    triggerFlashAnimation(cellElement, type);
  }
};

export const triggerRowFlash = (entryId: string, type: "highlight" | "error" | "success" = "highlight") => {
  const rowElement = document.querySelector(`[data-entry-id="${entryId}"]`);
  if (rowElement instanceof HTMLElement) {
    triggerFlashAnimation(rowElement, type);
  }
};

// Class name builders
export const buildTableRowClasses = (params: { isModified?: boolean; isWeekend?: boolean; isEven?: boolean; isSelected?: boolean; className?: string }) => {
  const { isModified, isWeekend, isEven, isSelected, className } = params;

  return cn(
    "border-b border-neutral-400 dark:border-border transition-colors",
    isModified && "bg-yellow-50 dark:bg-yellow-900/20",
    isWeekend && "bg-red-50 dark:bg-red-900/10",
    !isModified && !isWeekend && isEven && "bg-muted/50",
    isSelected && "bg-blue-50 dark:bg-blue-900/20 ring-2 ring-blue-200 dark:ring-blue-800/50",
    "hover:bg-muted/70",
    className,
  );
};

export const buildTableCellClasses = (params: { isModified?: boolean; isSticky?: boolean; isCenter?: boolean; width?: string; className?: string }) => {
  const { isModified, isSticky, isCenter, width, className } = params;

  return cn(
    "p-1 border-r border-neutral-400 dark:border-border",
    isCenter && "text-center",
    isSticky && "sticky left-0 bg-background z-10",
    isModified && "bg-yellow-100 dark:bg-yellow-900/30",
    width,
    "hover:bg-muted/50",
    "focus-within:ring-2 focus-within:ring-blue-500/20",
    className,
  );
};

// Status utilities
export const getStatusVariant = (status: string): "success" | "error" | "warning" | "info" | "neutral" => {
  const statusMap: Record<string, "success" | "error" | "warning" | "info" | "neutral"> = {
    ACTIVE: "success",
    COMPLETED: "success",
    APPROVED: "success",
    ELECTRONIC: "success",

    INACTIVE: "error",
    CANCELLED: "error",
    REJECTED: "error",
    ERROR: "error",

    PENDING: "warning",
    IN_PROGRESS: "warning",
    MANUAL: "warning",

    INFO: "info",
    DEFAULT: "neutral",
  };

  return statusMap[status.toUpperCase()] || "neutral";
};

export const getSourceDisplayText = (source: "ELECTRONIC" | "MANUAL"): string => {
  return source === "ELECTRONIC" ? "Eletrônico" : "Manual";
};

// Time utilities
export const formatTimeForDisplay = (time: string | null): string => {
  if (!time) return "--:--";
  return time;
};

export const isValidTime = (time: string): boolean => {
  const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
  return timeRegex.test(time);
};

export const compareTimeStrings = (time1: string | null, time2: string | null): boolean => {
  if (!time1 && !time2) return true;
  return time1 === time2;
};

// Date utilities
export const formatDateForTable = (date: Date | string): string => {
  const dateObj = typeof date === "string" ? new Date(date) : date;
  return dateObj.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
};

export const getDayOfWeek = (date: Date | string): string => {
  const days = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
  const dateObj = typeof date === "string" ? new Date(date) : date;
  return days[dateObj.getDay()];
};

export const isWeekend = (date: Date | string): boolean => {
  const dateObj = typeof date === "string" ? new Date(date) : date;
  const day = dateObj.getDay();
  return day === 0 || day === 6; // Sunday or Saturday
};

// Field modification utilities
export const getFieldDisplayName = (field: string): string => {
  const fieldNames: Record<string, string> = {
    entry1: "Entrada 1",
    exit1: "Saída 1",
    entry2: "Entrada 2",
    exit2: "Saída 2",
    entry3: "Entrada 3",
    exit3: "Saída 3",
    entry4: "Entrada 4",
    exit4: "Saída 4",
    entry5: "Entrada 5",
    exit5: "Saída 5",
    compensated: "Compensado",
    neutral: "Neutro",
    dayOff: "Folga",
    freeLunch: "Almoço Livre",
  };

  return fieldNames[field] || field;
};

export const isTimeField = (field: string): boolean => {
  return /^(entry|exit)\d+$/.test(field);
};

export const isBooleanField = (field: string): boolean => {
  return ["compensated", "neutral", "dayOff", "freeLunch"].includes(field);
};

// Validation utilities
export const validateFieldValue = (field: string, value: any): { isValid: boolean; error?: string } => {
  if (isTimeField(field)) {
    if (value && !isValidTime(value)) {
      return { isValid: false, error: "Formato de hora inválido" };
    }
  }

  if (isBooleanField(field)) {
    if (typeof value !== "boolean") {
      return { isValid: false, error: "Valor deve ser verdadeiro ou falso" };
    }
  }

  return { isValid: true };
};

// Scroll utilities
export const scrollToElement = (selector: string, behavior: ScrollBehavior = "smooth") => {
  const element = document.querySelector(selector);
  if (element) {
    element.scrollIntoView({ behavior, block: "center" });
  }
};

export const scrollToRow = (entryId: string) => {
  scrollToElement(`[data-entry-id="${entryId}"]`);
};

export const scrollToCell = (entryId: string, field: string) => {
  scrollToElement(`[data-entry-id="${entryId}"][data-field="${field}"]`);
};

// Toast message utilities
export const getChangeMessage = (field: string, oldValue: any, newValue: any): string => {
  const fieldName = getFieldDisplayName(field);

  if (isTimeField(field)) {
    const oldTime = formatTimeForDisplay(oldValue);
    const newTime = formatTimeForDisplay(newValue);
    return `${fieldName} alterado de ${oldTime} para ${newTime}`;
  }

  if (isBooleanField(field)) {
    const oldText = oldValue ? "Sim" : "Não";
    const newText = newValue ? "Sim" : "Não";
    return `${fieldName} alterado de ${oldText} para ${newText}`;
  }

  return `${fieldName} alterado`;
};

export const getMoveMessage = (field: string, direction: "previous" | "next"): string => {
  const fieldName = getFieldDisplayName(field);
  const directionText = direction === "previous" ? "anterior" : "próximo";
  return `${fieldName} movido para o dia ${directionText}`;
};

// Accessibility utilities
export const announceChange = (message: string) => {
  // Create a temporary element for screen readers
  const announcement = document.createElement("div");
  announcement.setAttribute("aria-live", "polite");
  announcement.setAttribute("aria-atomic", "true");
  announcement.className = "sr-only";
  announcement.textContent = message;

  document.body.appendChild(announcement);

  // Remove after announcement
  setTimeout(() => {
    document.body.removeChild(announcement);
  }, 1000);
};

// Export all utilities as a single object for convenience
export const timeClockUIUtils = {
  triggerFlashAnimation,
  triggerCellFlash,
  triggerRowFlash,
  buildTableRowClasses,
  buildTableCellClasses,
  getStatusVariant,
  getSourceDisplayText,
  formatTimeForDisplay,
  isValidTime,
  compareTimeStrings,
  formatDateForTable,
  getDayOfWeek,
  isWeekend,
  getFieldDisplayName,
  isTimeField,
  isBooleanField,
  validateFieldValue,
  scrollToElement,
  scrollToRow,
  scrollToCell,
  getChangeMessage,
  getMoveMessage,
  announceChange,
};
