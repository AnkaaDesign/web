import { z } from "zod";

// Secullum time entry interface (based on actual API response structure)
export interface SecullumTimeEntry {
  Id: number;
  FuncionarioId: number;
  FuncionarioNome?: string;
  Data: string; // "2024-12-01T03:00:00.000Z"
  DataExibicao: string; // "01/12/2024"
  Entrada1?: string | null;
  Saida1?: string | null;
  Entrada2?: string | null;
  Saida2?: string | null;
  Entrada3?: string | null;
  Saida3?: string | null;
  Entrada4?: string | null;
  Saida4?: string | null;
  Entrada5?: string | null;
  Saida5?: string | null;
  Compensado?: boolean;
  Neutro?: boolean;
  Folga?: boolean;
  AlmocoLivre?: boolean;
  HorasTrabalhadas?: string;
  HorasExtras?: string;
  HorasFalta?: string;
  Observacoes?: string;
  Justificativa?: string;
}

// Normalized interface for use in the form
export interface TimeClockEntry {
  id: string;
  userId?: string;
  date: Date;
  entry1?: string | null;
  exit1?: string | null;
  entry2?: string | null;
  exit2?: string | null;
  entry3?: string | null;
  exit3?: string | null;
  entry4?: string | null;
  exit4?: string | null;
  entry5?: string | null;
  exit5?: string | null;
  compensated: boolean;
  neutral: boolean;
  dayOff: boolean;
  freeLunch: boolean;
  workedHours?: string;
  extraHours?: string;
  missingHours?: string;
  observations?: string;
  justification?: string;
  user?: {
    name?: string;
  };
  // Additional fields for compatibility with older code
  source: string;
  hasPhoto: boolean;
  createdAt: Date;
  updatedAt: Date;
  // Location fields
  latitude?: number | null;
  longitude?: number | null;
  accuracy?: number | null;
  address?: string | null;
  deviceId?: string | null;
  secullumRecordId?: string | null;
  syncAttempts?: number;
  lastSyncError?: string;
  secullumSyncStatus?: string | null;
}

export const timeClockEntryBatchUpdateSchema = z.object({
  entries: z.array(
    z.object({
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
    }),
  ),
});

export type TimeClockEntryBatchUpdateFormData = z.infer<typeof timeClockEntryBatchUpdateSchema>;

export const timeClockJustificationSchema = z.object({
  originalTime: z.string(),
  newTime: z.string().nullable(),
  field: z.string(),
  reason: z.string().min(1, "Motivo é obrigatório"),
});

export type TimeClockJustificationFormData = z.infer<typeof timeClockJustificationSchema>;

// Helper function to convert Secullum entry to our normalized format
export function normalizeSecullumEntry(entry: SecullumTimeEntry): TimeClockEntry {
  const date = new Date(entry.Data);

  return {
    id: entry.Id.toString(),
    date: date,
    entry1: entry.Entrada1 || null,
    exit1: entry.Saida1 || null,
    entry2: entry.Entrada2 || null,
    exit2: entry.Saida2 || null,
    entry3: entry.Entrada3 || null,
    exit3: entry.Saida3 || null,
    entry4: entry.Entrada4 || null,
    exit4: entry.Saida4 || null,
    entry5: entry.Entrada5 || null,
    exit5: entry.Saida5 || null,
    compensated: entry.Compensado || false,
    neutral: entry.Neutro || false,
    dayOff: entry.Folga || false,
    freeLunch: entry.AlmocoLivre || false,
    workedHours: entry.HorasTrabalhadas,
    extraHours: entry.HorasExtras,
    missingHours: entry.HorasFalta,
    observations: entry.Observacoes,
    justification: entry.Justificativa,
    user: entry.FuncionarioNome ? { name: entry.FuncionarioNome } : undefined,
    // Default values for compatibility
    source: "SECULLUM",
    hasPhoto: false,
    createdAt: date,
    updatedAt: date,
    secullumRecordId: entry.Id.toString(),
  };
}
