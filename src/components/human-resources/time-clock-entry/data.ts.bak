import { z } from "zod";
import { formatDate, parseTime } from "../../../utils";
import type { SecullumTimeEntry } from "@/types/time-clock";
import type { TimeClockEntry } from "@/types/time-clock";
import type { LocationData } from "./types";

// =====================================
// VALIDATION SCHEMAS
// =====================================

export const secullumTimeEntrySchema = z.object({
  Id: z.number(),
  FuncionarioId: z.number(),
  FuncionarioNome: z.string().optional(),
  Data: z.string(),
  DataExibicao: z.string(),
  Entrada1: z.string().nullable().optional(),
  Saida1: z.string().nullable().optional(),
  Entrada2: z.string().nullable().optional(),
  Saida2: z.string().nullable().optional(),
  Entrada3: z.string().nullable().optional(),
  Saida3: z.string().nullable().optional(),
  Entrada4: z.string().nullable().optional(),
  Saida4: z.string().nullable().optional(),
  Entrada5: z.string().nullable().optional(),
  Saida5: z.string().nullable().optional(),
  Compensado: z.boolean().optional(),
  Neutro: z.boolean().optional(),
  Folga: z.boolean().optional(),
  AlmocoLivre: z.boolean().optional(),
  HorasTrabalhadas: z.string().optional(),
  HorasExtras: z.string().optional(),
  HorasFalta: z.string().optional(),
  Observacoes: z.string().optional(),
  Justificativa: z.string().optional(),
});

export const locationDataSchema = z.object({
  FonteDadosId: z.number(),
  DataHora: z.string(),
  Latitude: z.number(),
  Longitude: z.number(),
  Precisao: z.number(),
  Endereco: z.string(),
  PossuiFoto: z.boolean().optional(),
});

export const timeEntryUpdateSchema = z.object({
  id: z.string(),
  entry1: z.string().nullable(),
  exit1: z.string().nullable(),
  entry2: z.string().nullable(),
  exit2: z.string().nullable(),
  entry3: z.string().nullable(),
  exit3: z.string().nullable(),
  entry4: z.string().nullable(),
  exit4: z.string().nullable(),
  entry5: z.string().nullable(),
  exit5: z.string().nullable(),
  compensated: z.boolean(),
  neutral: z.boolean(),
  dayOff: z.boolean(),
  freeLunch: z.boolean(),
});

// =====================================
// TYPE DEFINITIONS
// =====================================

export type ValidatedSecullumEntry = z.infer<typeof secullumTimeEntrySchema>;
export type ValidatedLocationData = z.infer<typeof locationDataSchema>;
export type ValidatedTimeEntryUpdate = z.infer<typeof timeEntryUpdateSchema>;

export interface NormalizedTimeEntry {
  id: string;
  originalData: SecullumTimeEntry;
  normalized: TimeClockEntry;
  metadata: {
    hasLocationData: boolean;
    hasPhoto: boolean;
    lastSyncAt: Date;
    syncStatus: "success" | "error" | "pending";
    validationErrors: string[];
  };
}

export interface TimeEntryBatchUpdate {
  entries: Array<{
    id: string;
    changes: Partial<ValidatedTimeEntryUpdate>;
    justification?: {
      field: string;
      originalValue: string | null;
      newValue: string | null;
      reason: string;
    };
  }>;
  metadata: {
    totalEntries: number;
    changedEntries: number;
    timestamp: Date;
    userId: string;
  };
}

export interface PhotoMetadata {
  entryId: string;
  userId: number;
  fonteDadosId: number;
  hasPhoto: boolean;
  photoUrl?: string;
  uploadedAt?: string;
  fileSize?: number;
}

// =====================================
// DATA VALIDATION UTILITIES
// =====================================

/**
 * Validates a Secullum time entry against our schema
 */
export function validateSecullumEntry(entry: unknown): {
  isValid: boolean;
  data?: ValidatedSecullumEntry;
  errors: string[];
} {
  try {
    const validated = secullumTimeEntrySchema.parse(entry);
    return {
      isValid: true,
      data: validated,
      errors: [],
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        isValid: false,
        errors: error.errors.map((err: z.ZodIssue) => `${err.path.join(".")}: ${err.message}`),
      };
    }
    return {
      isValid: false,
      errors: ["Erro desconhecido de validação"],
    };
  }
}

/**
 * Validates location data
 */
export function validateLocationData(data: unknown): {
  isValid: boolean;
  data?: ValidatedLocationData;
  errors: string[];
} {
  try {
    const validated = locationDataSchema.parse(data);
    return {
      isValid: true,
      data: validated,
      errors: [],
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        isValid: false,
        errors: error.errors.map((err: z.ZodIssue) => `${err.path.join(".")}: ${err.message}`),
      };
    }
    return {
      isValid: false,
      errors: ["Erro desconhecido de validação de localização"],
    };
  }
}

// =====================================
// DATA TRANSFORMATION UTILITIES
// =====================================

/**
 * Normalizes a Secullum time entry to our internal format
 */
export function normalizeSecullumEntry(entry: SecullumTimeEntry, locationData?: LocationData, photoMetadata?: PhotoMetadata): NormalizedTimeEntry {
  const validation = validateSecullumEntry(entry);

  // Parse the date safely
  let parsedDate: Date;
  try {
    parsedDate = new Date(entry.Data);
    if (isNaN(parsedDate.getTime())) {
      throw new Error("Invalid date");
    }
  } catch {
    parsedDate = new Date();
    validation.errors.push("Data inválida, usando data atual");
  }

  // Normalize the entry
  const normalized: TimeClockEntry = {
    id: entry.Id.toString(),
    date: parsedDate,
    entry1: cleanTimeValue(entry.Entrada1),
    exit1: cleanTimeValue(entry.Saida1),
    entry2: cleanTimeValue(entry.Entrada2),
    exit2: cleanTimeValue(entry.Saida2),
    entry3: cleanTimeValue(entry.Entrada3),
    exit3: cleanTimeValue(entry.Saida3),
    entry4: cleanTimeValue(entry.Entrada4),
    exit4: cleanTimeValue(entry.Saida4),
    entry5: cleanTimeValue(entry.Entrada5),
    exit5: cleanTimeValue(entry.Saida5),
    compensated: entry.Compensado ?? false,
    neutral: entry.Neutro ?? false,
    dayOff: entry.Folga ?? false,
    freeLunch: entry.AlmocoLivre ?? false,
    workedHours: entry.HorasTrabalhadas || undefined,
    extraHours: entry.HorasExtras || undefined,
    missingHours: entry.HorasFalta || undefined,
    observations: entry.Observacoes || undefined,
    justification: entry.Justificativa || undefined,
    user: undefined, // User info handled separately
    userId: entry.FuncionarioId?.toString(),

    // Default/computed values
    source: "SECULLUM",
    hasPhoto: photoMetadata?.hasPhoto ?? false,
    createdAt: parsedDate,
    updatedAt: new Date(),
    secullumRecordId: entry.Id.toString(),

    // Location data
    latitude: locationData?.Latitude ?? null,
    longitude: locationData?.Longitude ?? null,
    accuracy: locationData?.Precisao ?? null,
    address: locationData?.Endereco ?? null,
    deviceId: locationData?.FonteDadosId?.toString() ?? null,

    // Sync status
    syncAttempts: 0,
    lastSyncError: validation.errors.length > 0 ? validation.errors.join("; ") : undefined,
    secullumSyncStatus: validation.errors.length > 0 ? "error" : "success",
  };

  return {
    id: normalized.id,
    originalData: entry,
    normalized,
    metadata: {
      hasLocationData: !!locationData,
      hasPhoto: photoMetadata?.hasPhoto ?? false,
      lastSyncAt: new Date(),
      syncStatus: validation.errors.length > 0 ? "error" : "success",
      validationErrors: validation.errors,
    },
  };
}

/**
 * Converts normalized entries back to Secullum format for API updates
 */
export function denormalizeToSecullum(entry: TimeClockEntry): Partial<SecullumTimeEntry> {
  return {
    Id: parseInt(entry.id),
    FuncionarioId: entry.userId ? parseInt(entry.userId) : 0,
    Data: entry.date.toISOString(),
    Entrada1: entry.entry1 || null,
    Saida1: entry.exit1 || null,
    Entrada2: entry.entry2 || null,
    Saida2: entry.exit2 || null,
    Entrada3: entry.entry3 || null,
    Saida3: entry.exit3 || null,
    Entrada4: entry.entry4 || null,
    Saida4: entry.exit4 || null,
    Entrada5: entry.entry5 || null,
    Saida5: entry.exit5 || null,
    Compensado: entry.compensated,
    Neutro: entry.neutral,
    Folga: entry.dayOff,
    AlmocoLivre: entry.freeLunch,
    Observacoes: entry.observations || undefined,
    Justificativa: entry.justification || undefined,
  };
}

/**
 * Prepares batch update data for API submission
 */
export function prepareBatchUpdate(entries: TimeClockEntry[], modifications: Map<string, any>): TimeEntryBatchUpdate {
  const updatedEntries = entries
    .filter((entry: TimeClockEntry) => modifications.has(entry.id))
    .map((entry: TimeClockEntry) => {
      const changes = modifications.get(entry.id) || {};

      return {
        id: entry.id,
        changes: {
          ...changes,
          id: entry.id,
        },
        justification: changes.justification
          ? {
              field: changes.justification.field,
              originalValue: changes.justification.originalValue,
              newValue: changes.justification.newValue,
              reason: changes.justification.reason,
            }
          : undefined,
      };
    });

  return {
    entries: updatedEntries,
    metadata: {
      totalEntries: entries.length,
      changedEntries: updatedEntries.length,
      timestamp: new Date(),
      userId: "current-user", // Should be injected from context
    },
  };
}

// =====================================
// DATA COMPARISON UTILITIES
// =====================================

/**
 * Compares two time entries and returns the differences
 */
export function compareTimeEntries(original: TimeClockEntry, modified: TimeClockEntry): Array<{ field: string; originalValue: any; newValue: any }> {
  const differences: Array<{ field: string; originalValue: any; newValue: any }> = [];

  const timeFields = ["entry1", "exit1", "entry2", "exit2", "entry3", "exit3", "entry4", "exit4", "entry5", "exit5"];

  const booleanFields = ["compensated", "neutral", "dayOff", "freeLunch"];

  const stringFields = ["observations", "justification"];

  [...timeFields, ...booleanFields, ...stringFields].forEach((field: string) => {
    const originalValue = (original as any)[field];
    const modifiedValue = (modified as any)[field];

    if (originalValue !== modifiedValue) {
      differences.push({
        field,
        originalValue,
        newValue: modifiedValue,
      });
    }
  });

  return differences;
}

/**
 * Checks if an entry has been modified compared to its original state
 */
export function isEntryModified(original: SecullumTimeEntry, current: TimeClockEntry): boolean {
  const normalizedOriginal = normalizeSecullumEntry(original).normalized;
  const differences = compareTimeEntries(normalizedOriginal, current);
  return differences.length > 0;
}

/**
 * Gets all modifications for a set of entries
 */
export function getModifications(originalEntries: SecullumTimeEntry[], currentEntries: TimeClockEntry[]): Map<string, Array<{ field: string; originalValue: any; newValue: any }>> {
  const modifications = new Map();

  currentEntries.forEach((current: TimeClockEntry) => {
    const original = originalEntries.find((orig: SecullumTimeEntry) => orig.Id.toString() === current.id);
    if (original) {
      const normalizedOriginal = normalizeSecullumEntry(original).normalized;
      const differences = compareTimeEntries(normalizedOriginal, current);

      if (differences.length > 0) {
        modifications.set(current.id, differences);
      }
    }
  });

  return modifications;
}

// =====================================
// PHOTO AND LOCATION UTILITIES
// =====================================

/**
 * Extracts photo metadata from location data
 */
export function extractPhotoMetadata(locationData: LocationData, entryId: string, userId: number): PhotoMetadata {
  return {
    entryId,
    userId,
    fonteDadosId: locationData.FonteDadosId,
    hasPhoto: locationData.PossuiFoto ?? false,
    uploadedAt: locationData.DataHora,
  };
}

/**
 * Formats location data for display
 */
export function formatLocationData(locationData: LocationData): {
  coordinates: string;
  accuracy: string;
  address: string;
  timestamp: string;
} {
  return {
    coordinates: `${locationData.Latitude.toFixed(6)}, ${locationData.Longitude.toFixed(6)}`,
    accuracy: `${locationData.Precisao}m`,
    address: locationData.Endereco || "Endereço não disponível",
    timestamp: formatDate(new Date(locationData.DataHora)),
  };
}

/**
 * Checks if location data is valid and accurate
 */
export function isLocationDataValid(locationData: LocationData): {
  isValid: boolean;
  issues: string[];
} {
  const issues: string[] = [];

  if (Math.abs(locationData.Latitude) > 90) {
    issues.push("Latitude inválida");
  }

  if (Math.abs(locationData.Longitude) > 180) {
    issues.push("Longitude inválida");
  }

  if (locationData.Precisao > 100) {
    issues.push("Precisão baixa (>100m)");
  }

  if (locationData.Precisao < 0) {
    issues.push("Precisão inválida");
  }

  if (!locationData.Endereco || locationData.Endereco.trim().length === 0) {
    issues.push("Endereço não disponível");
  }

  return {
    isValid: issues.length === 0,
    issues,
  };
}

// =====================================
// HELPER FUNCTIONS
// =====================================

/**
 * Cleans and validates time values
 */
function cleanTimeValue(time: string | null | undefined): string | null {
  if (!time) return null;

  const cleaned = time.trim();
  if (cleaned === "" || cleaned === "--:--") return null;

  // Validate time format (HH:MM)
  if (!/^\d{2}:\d{2}$/.test(cleaned)) {
    return null;
  }

  const [hours, minutes] = cleaned.split(":").map(Number);
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
    return null;
  }

  return cleaned;
}

/**
 * Formats time for display
 */
export function formatTimeForDisplay(time: string | null): string {
  if (!time) return "--:--";
  return time;
}

/**
 * Validates that entry times are in logical order
 */
export function validateTimeSequence(entry: TimeClockEntry): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  const times = [
    { field: "entry1", value: entry.entry1 },
    { field: "exit1", value: entry.exit1 },
    { field: "entry2", value: entry.entry2 },
    { field: "exit2", value: entry.exit2 },
    { field: "entry3", value: entry.entry3 },
    { field: "exit3", value: entry.exit3 },
    { field: "entry4", value: entry.entry4 },
    { field: "exit4", value: entry.exit4 },
    { field: "entry5", value: entry.exit5 },
  ].filter((t) => t.value !== null);

  // Check if times are in chronological order
  for (let i = 1; i < times.length; i++) {
    const prevTime = parseTime(times[i - 1].value!);
    const currentTime = parseTime(times[i].value!);

    if (prevTime && currentTime && currentTime <= prevTime) {
      errors.push(`${times[i].field} deve ser posterior a ${times[i - 1].field}`);
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Calculates worked hours based on time entries
 */
export function calculateWorkedHours(entry: TimeClockEntry): {
  totalMinutes: number;
  formattedHours: string;
} {
  let totalMinutes = 0;

  const pairs: Array<[string | null, string | null]> = [
    [entry.entry1 ?? null, entry.exit1 ?? null],
    [entry.entry2 ?? null, entry.exit2 ?? null],
    [entry.entry3 ?? null, entry.exit3 ?? null],
    [entry.entry4 ?? null, entry.exit4 ?? null],
    [entry.entry5 ?? null, entry.exit5 ?? null],
  ];

  pairs.forEach(([entryTime, exitTime]: [string | null, string | null]) => {
    if (entryTime && exitTime) {
      const entry = parseTime(entryTime);
      const exit = parseTime(exitTime);

      if (entry && exit && exit > entry) {
        totalMinutes += (exit.getTime() - entry.getTime()) / (1000 * 60);
      }
    }
  });

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  return {
    totalMinutes,
    formattedHours: `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}`,
  };
}

/**
 * Gets human-readable field labels for display
 */
export function getFieldLabel(fieldName: string): string {
  const labels: Record<string, string> = {
    entry1: "1ª Entrada",
    exit1: "1ª Saída",
    entry2: "2ª Entrada",
    exit2: "2ª Saída",
    entry3: "3ª Entrada",
    exit3: "3ª Saída",
    entry4: "4ª Entrada",
    exit4: "4ª Saída",
    entry5: "5ª Entrada",
    exit5: "5ª Saída",
    compensated: "Compensado",
    neutral: "Neutro",
    dayOff: "Folga",
    freeLunch: "Almoço Livre",
    observations: "Observações",
    justification: "Justificativa",
  };

  return labels[fieldName] || fieldName;
}

// =====================================
// ERROR HANDLING
// =====================================

/**
 * Custom error class for data transformation errors
 */
export class DataTransformationError extends Error {
  public readonly field?: string;
  public readonly originalData?: unknown;

  constructor(message: string, field?: string, originalData?: unknown) {
    super(message);
    this.name = "DataTransformationError";
    this.field = field;
    this.originalData = originalData;
  }
}

/**
 * Safe data transformation with error handling
 */
export function safeTransform<T, R>(data: T, transformer: (data: T) => R, fallback: R): { result: R; error?: Error } {
  try {
    const result = transformer(data);
    return { result };
  } catch (error) {
    console.error("Data transformation failed:", error);
    return {
      result: fallback,
      error: error instanceof Error ? error : new Error("Unknown transformation error"),
    };
  }
}
