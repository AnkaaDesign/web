import { useMemo, useState, useCallback, useRef, useEffect, forwardRef, useImperativeHandle } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { TimeClockEntry, SecullumTimeEntry } from "@/types/time-clock";
import { normalizeSecullumEntry } from "@/types/time-clock";
import type { TimeClockEntryBatchUpdateFormData } from "../../../schemas";
import { timeClockEntryBatchUpdateSchema } from "../../../schemas";
import { useTimeClockEntryBatchUpdateWithJustification, useSecullumJustifications } from "../../../hooks";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { formatDate } from "../../../utils";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem } from "@/components/ui/form";
import { TransparentTimeInput } from "@/components/ui/transparent-time-input";
import { Checkbox } from "@/components/ui/checkbox";
import { TimeClockJustificationDialog } from "./time-clock-justification-dialog";
import { AddJustificationDialog } from "./add-justification-dialog";
import { TimeClockEntryDetailModal } from "./time-clock-entry-detail-modal";
import { PhotoViewDialog } from "./photo-view-dialog";
import { LocationMapDialog } from "./location-map-dialog";
import { cn } from "@/lib/utils";
import {
  IconLoader2 as Loader2,
  IconChevronLeft as ChevronLeft,
  IconChevronRight as ChevronRight,
  IconCamera as Camera,
  IconMapPin as MapPin,
  IconTrash as Trash2,
  IconArrowUp as MoveUp,
  IconArrowDown as MoveDown,
  IconFileText as FileText,
  IconPencil as PencilIcon,
  IconUser as UserRequestIcon,
} from "@tabler/icons-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "../../ui/dropdown-menu";
import { secullumService } from "../../../api-client";
import { toast } from "@/components/ui/sonner";
import { useTimeClockStateManager } from "./state";
import type { LocationData, PendingJustification } from "./types";
import { useQueryClient } from "@tanstack/react-query";
import { secullumKeys } from "../../../hooks/integrations/use-secullum";

interface TimeClockEntryTableProps {
  entries: SecullumTimeEntry[];
  isLoading?: boolean;
  className?: string;
  onChangedRowsChange?: (count: number) => void;
  visibleColumns?: Set<string>;
}

export interface TimeClockEntryTableRef {
  handleSubmit: () => void;
  handleRestore: () => void;
  hasChanges: boolean;
  isPending: boolean;
}

// Map normalized field names to Secullum FonteDados field names
// FonteDadosEntradaX is an object: { Tipo: 0 = electronic, 1 = manual, Origem, Motivo, Geolocalizacao }
const FONTE_DADOS_FIELD_MAP: Record<string, string> = {
  entry1: "FonteDadosEntrada1",
  exit1: "FonteDadosSaida1",
  entry2: "FonteDadosEntrada2",
  exit2: "FonteDadosSaida2",
  entry3: "FonteDadosEntrada3",
  exit3: "FonteDadosSaida3",
  entry4: "FonteDadosEntrada4",
  exit4: "FonteDadosSaida4",
  entry5: "FonteDadosEntrada5",
  exit5: "FonteDadosSaida5",
};

/**
 * Determine the marker to render for a time-entry cell based on Secullum's
 * FonteDados<Field>.{Tipo, Origem}.
 *   - Tipo=0: electronic punch (device/app) → no marker.
 *   - Tipo=1, Origem=9: employee-requested adjustment → user icon ("Solicitado pelo colaborador").
 *   - Tipo=1, other Origem (e.g. 2 = HR web edit): manual pencil edit ("Inclusão manual").
 */
type ManualEntryMarker = { kind: "user-request" | "pencil"; motivo: string | null } | null;

function getManualEntryMarker(rawEntry: any, fieldName: string): ManualEntryMarker {
  if (!rawEntry) return null;
  const fdField = FONTE_DADOS_FIELD_MAP[fieldName];
  if (!fdField) return null;
  const fd = rawEntry[fdField];
  if (!fd || typeof fd !== "object") return null;
  if (fd.Tipo !== 1) return null;
  const motivo: string | null = fd.Motivo ? String(fd.Motivo) : null;
  if (fd.Origem === 9) {
    return { kind: "user-request", motivo };
  }
  return { kind: "pencil", motivo };
}

const TimeClockEntryTableComponent = (props: TimeClockEntryTableProps, ref: React.Ref<TimeClockEntryTableRef>) => {
  const { entries, isLoading, className, onChangedRowsChange, visibleColumns } = props;
  const isVisible = (key: string) => !visibleColumns || visibleColumns.has(key);
  const [pendingJustification, setPendingJustification] = useState<PendingJustification | null>(null);
  // Reasons captured from the justification dialog, keyed by `${entryId}:${field}`.
  // Persisted into FonteDados<Field>.Motivo when the batch save fires so that
  // Secullum classifies the cell as Tipo:1 (manual) on the next read.
  const [pendingReasons, setPendingReasons] = useState<Record<string, string>>({});
  const [selectedEntry, setSelectedEntry] = useState<TimeClockEntry | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; entry: TimeClockEntry; field?: string } | null>(null);
  const [photoDialog, setPhotoDialog] = useState<{ userId: number; fonteDadosId: number } | null>(null);
  const [locationDialog, setLocationDialog] = useState<LocationData | null>(null);
  const [addJustificationTarget, setAddJustificationTarget] = useState<{ entry: TimeClockEntry; field?: string } | null>(null);
  const tableRef = useRef<HTMLDivElement>(null);

  const { isPending } = useTimeClockEntryBatchUpdateWithJustification();
  const queryClient = useQueryClient();

  // Justification short-name → long-name lookup, used to render the tooltip on
  // cells that hold an absence code (e.g. "ATESTAD" → "ATESTADO MÉDICO").
  const { data: justificationsResp } = useSecullumJustifications();
  const justificationFullNameMap = useMemo(() => {
    const list = (justificationsResp?.data?.data ?? []) as Array<{ NomeAbreviado: string; NomeCompleto: string | null }>;
    const map = new Map<string, string>();
    for (const j of list) {
      if (j.NomeCompleto) map.set(j.NomeAbreviado.trim(), j.NomeCompleto);
    }
    return map;
  }, [justificationsResp]);

  // Keep original entries for comparison
  const originalNormalizedEntries = useMemo(() => {
    if (!entries || !Array.isArray(entries) || entries.length === 0) {
      return [];
    }

    return entries.map((entry) => {
      const normalized = normalizeSecullumEntry(entry);

      // Check if entry has electronic source (FonteDados)
      if ((entry as any).FonteDados) {
        normalized.source = (entry as any).FonteDados.Origem === 1 ? "ELECTRONIC" : "MANUAL";
        normalized.hasPhoto = (entry as any).FonteDados.PossuiFoto || false;
      }
      return normalized;
    });
  }, [entries]);

  // Use original entries for display and form
  const normalizedEntries = originalNormalizedEntries;

  // Initialize state manager
  const stateManager = useTimeClockStateManager(onChangedRowsChange);

  const defaultFormData = useMemo(() => {
    const formData = {
      entries: normalizedEntries.map((entry) => ({
        id: entry.id,
        entry1: entry.entry1 ?? null,
        exit1: entry.exit1 ?? null,
        entry2: entry.entry2 ?? null,
        exit2: entry.exit2 ?? null,
        entry3: entry.entry3 ?? null,
        exit3: entry.exit3 ?? null,
        entry4: entry.entry4 ?? null,
        exit4: entry.exit4 ?? null,
        entry5: entry.entry5 ?? null,
        exit5: entry.exit5 ?? null,
        compensated: entry.compensated,
        neutral: entry.neutral,
        dayOff: entry.dayOff,
        freeLunch: entry.freeLunch,
      })),
    };

    // Debug log to see data format
    if (formData.entries.length > 0) {
      console.log("Sample entry data:", formData.entries[0]);
    }

    return formData;
  }, [normalizedEntries]);

  const form = useForm<TimeClockEntryBatchUpdateFormData>({
    resolver: zodResolver(timeClockEntryBatchUpdateSchema),
    defaultValues: defaultFormData,
  });

  const { fields } = useFieldArray({
    control: form.control,
    name: "entries",
  });

  // Compute a stable signature that changes whenever the underlying entries
  // change — i.e. user switches, period changes, or a refetch returns updated
  // rows. We include each row's Versao so an upstream save (which bumps Versao)
  // also triggers a reset of any stale local form state.
  const entriesSignature = useMemo(() => {
    if (!entries || entries.length === 0) return "";
    return entries.map((e: any) => `${e.Id}:${e.Versao ?? ""}`).join("|");
  }, [entries]);

  // Reset the form AND the modification tracker whenever the dataset changes.
  // Previously a `hasInitializedForm` ref guarded this and was never reset, so
  // switching users kept the previous user's values cached until a hard reload.
  useEffect(() => {
    form.reset(defaultFormData);
    stateManager.actions.restoreAll();
    // defaultFormData is derived from entries, but we depend on the signature
    // (stable string) instead of the object identity to avoid loops.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entriesSignature]);

  // Handle field change
  const handleFieldChange = useCallback(
    (formFieldId: string, field: string, value: any) => {
      // Update form
      const entryIndex = fields.findIndex((f) => f.id === formFieldId);

      if (entryIndex === -1) {
        console.error("Entry not found in fields array");
        return;
      }

      // Get the actual entry ID
      const actualEntry = normalizedEntries[entryIndex];
      if (!actualEntry) {
        console.error("Actual entry not found at index:", entryIndex);
        return;
      }

      const actualEntryId = actualEntry.id;

      // Update form value
      const fieldName = `entries.${entryIndex}.${field}` as any;
      form.setValue(fieldName, value, {
        shouldValidate: false,
        shouldDirty: true,
        shouldTouch: true,
      });

      // Track the change using state manager - use original entries for comparison
      const originalEntry = originalNormalizedEntries.find((e) => e.id === actualEntryId);
      if (originalEntry) {
        const originalValue = originalEntry[field as keyof typeof originalEntry];
        stateManager.actions.updateField(actualEntryId, field, value, originalValue);
      }
    },
    [fields, form, normalizedEntries, originalNormalizedEntries, stateManager.actions],
  );

  // Handle time shift with arrows - move to next/previous available column
  const handleTimeShift = useCallback(
    (formFieldId: string, field: string, direction: "left" | "right") => {
      // Use FIELDS array for correct indexing
      const currentEntryIndex = fields.findIndex((f) => f.id === formFieldId);
      const timeFields = ["entry1", "exit1", "entry2", "exit2", "entry3", "exit3", "entry4", "exit4", "entry5", "exit5"];
      const currentFieldIndex = timeFields.indexOf(field);

      if (currentFieldIndex === -1 || currentEntryIndex === -1) {
        return;
      }

      // Get the actual entry from the normalized entries using the index
      const actualEntry = normalizedEntries[currentEntryIndex];
      if (!actualEntry) {
        return;
      }

      const actualEntryId = actualEntry.id;
      const currentValue = form.getValues(`entries.${currentEntryIndex}.${field}` as any);

      if (!currentValue) {
        return;
      }

      // Find the next field to move to (empty or filled)
      let targetFieldIndex = currentFieldIndex;

      if (direction === "right") {
        // Move to next field (skip if it's the same field)
        if (currentFieldIndex + 1 < timeFields.length) {
          targetFieldIndex = currentFieldIndex + 1;
        }
      } else {
        // Move to previous field (skip if it's the same field)
        if (currentFieldIndex - 1 >= 0) {
          targetFieldIndex = currentFieldIndex - 1;
        }
      }

      // If found a different field, move or swap the time
      if (targetFieldIndex !== currentFieldIndex) {
        const targetField = timeFields[targetFieldIndex];
        const originalEntry = originalNormalizedEntries.find((e) => e.id === actualEntryId);
        const targetValue = form.getValues(`entries.${currentEntryIndex}.${targetField}` as any);

        if (!originalEntry) {
          console.error("Original entry not found for ID:", actualEntryId);
          return;
        }

        // Get the original values for both fields
        const originalFieldValue = originalEntry[field as keyof typeof originalEntry];
        const originalTargetValue = originalEntry[targetField as keyof typeof originalEntry];

        if (targetValue) {
          // SWAP: Target field has value, so swap them
          // Update form values first
          form.setValue(`entries.${currentEntryIndex}.${field}` as any, targetValue, { shouldValidate: false, shouldDirty: true, shouldTouch: true });
          form.setValue(`entries.${currentEntryIndex}.${targetField}` as any, currentValue, { shouldValidate: false, shouldDirty: true, shouldTouch: true });

          // Update state manager with actual entry ID and original values
          stateManager.actions.updateField(actualEntryId, field, targetValue, originalFieldValue);
          stateManager.actions.updateField(actualEntryId, targetField, currentValue, originalTargetValue);

          toast.success(`Trocado com ${targetField.replace("entry", "Entrada ").replace("exit", "Saída ")}`);
        } else {
          // MOVE: Target field is empty, so move there
          // Update form values first
          form.setValue(`entries.${currentEntryIndex}.${field}` as any, null, { shouldValidate: false, shouldDirty: true, shouldTouch: true });
          form.setValue(`entries.${currentEntryIndex}.${targetField}` as any, currentValue, { shouldValidate: false, shouldDirty: true, shouldTouch: true });

          // Update state manager with actual entry ID and original values
          stateManager.actions.updateField(actualEntryId, field, null, originalFieldValue);
          stateManager.actions.updateField(actualEntryId, targetField, currentValue, originalTargetValue);

          toast.success(`Movido para ${targetField.replace("entry", "Entrada ").replace("exit", "Saída ")}`);
        }
      } else {
        toast.warning("Nenhuma coluna disponível");
      }
    },
    [fields, form, normalizedEntries, originalNormalizedEntries, stateManager.actions],
  );

  // Handle time change - just update value, justification will be on blur
  const handleTimeChange = useCallback(
    (formFieldId: string, field: string, value: string | null) => {
      handleFieldChange(formFieldId, field, value);
    },
    [handleFieldChange],
  );

  // Handle time blur - show justification if value changed
  const handleTimeBlur = useCallback(
    (formFieldId: string, field: string, fieldLabel: string, originalValue: string | null, currentValue: string | null) => {
      // Get the actual entry ID for the justification dialog
      const entryIndex = fields.findIndex((f) => f.id === formFieldId);
      if (entryIndex === -1) return;

      const actualEntry = normalizedEntries[entryIndex];
      if (!actualEntry) return;

      const actualEntryId = actualEntry.id;

      const norm = (v: string | null | undefined) => (v ?? "").trim();
      const orig = norm(originalValue);
      const curr = norm(currentValue);

      // Three cases that need a justification (matches Secullum's "Justification
      // of point change" modal):
      //   - Modification: orig and curr both set, different
      //   - Inclusion:    orig empty, curr set
      //   - Deletion:     orig set, curr empty
      const isModification = orig !== "" && curr !== "" && orig !== curr;
      const isInclusion = orig === "" && curr !== "";
      const isDeletion = orig !== "" && curr === "";

      if (isModification || isInclusion || isDeletion) {
        setPendingJustification({
          entryId: actualEntryId,
          field,
          originalTime: originalValue,
          newTime: currentValue,
          fieldLabel,
        });
      }
    },
    [fields, normalizedEntries],
  );

  const handleJustificationConfirm = useCallback(
    (data?: { reason?: string }) => {
      if (pendingJustification) {
        // pendingJustification.entryId is the actual entry ID, need to find the form field ID
        const entryIndex = normalizedEntries.findIndex((e) => e.id === pendingJustification.entryId);
        if (entryIndex !== -1) {
          const formFieldId = fields[entryIndex]?.id;
          if (formFieldId) {
            handleFieldChange(formFieldId, pendingJustification.field, pendingJustification.newTime);
          }
        }
        // Stash the reason so the save payload can put it on FonteDados<Field>.Motivo.
        const reason = data?.reason?.trim();
        if (reason) {
          const key = `${pendingJustification.entryId}:${pendingJustification.field}`;
          setPendingReasons((prev) => ({ ...prev, [key]: reason }));
        }
      }
      setPendingJustification(null);
    },
    [handleFieldChange, pendingJustification, normalizedEntries, fields],
  );

  const handleSubmit = useCallback(
    async (data: TimeClockEntryBatchUpdateFormData) => {
      // Filter only changed entries
      const changedCount = stateManager.actions.getChangedEntryCount();
      const modifications = stateManager.actions.getAllModifications();

      if (changedCount === 0) return;

      // Form-field name → Secullum-native column triple (value, FonteDados object, FonteDadosId).
      // Matching the upstream Batidas row schema (verified via HAR).
      const FORM_TO_SECULLUM_COL: Record<string, string> = {
        entry1: "Entrada1", exit1: "Saida1",
        entry2: "Entrada2", exit2: "Saida2",
        entry3: "Entrada3", exit3: "Saida3",
        entry4: "Entrada4", exit4: "Saida4",
        entry5: "Entrada5", exit5: "Saida5",
      };
      const FORM_TO_FONTE_DADOS: Record<string, string> = {
        entry1: "FonteDadosEntrada1", exit1: "FonteDadosSaida1",
        entry2: "FonteDadosEntrada2", exit2: "FonteDadosSaida2",
        entry3: "FonteDadosEntrada3", exit3: "FonteDadosSaida3",
        entry4: "FonteDadosEntrada4", exit4: "FonteDadosSaida4",
        entry5: "FonteDadosEntrada5", exit5: "FonteDadosSaida5",
      };
      const FORM_TO_FONTE_DADOS_ID: Record<string, string> = {
        entry1: "FonteDadosIdEntrada1", exit1: "FonteDadosIdSaida1",
        entry2: "FonteDadosIdEntrada2", exit2: "FonteDadosIdSaida2",
        entry3: "FonteDadosIdEntrada3", exit3: "FonteDadosIdSaida3",
        entry4: "FonteDadosIdEntrada4", exit4: "FonteDadosIdSaida4",
        entry5: "FonteDadosIdEntrada5", exit5: "FonteDadosIdSaida5",
      };
      const TIME_FIELDS = ["entry1","exit1","entry2","exit2","entry3","exit3","entry4","exit4","entry5","exit5"] as const;

      try {
        // Build the changed-entry payload set from modification metadata.
        const changedEntriesMap = new Map<string, any>();
        const changedEntryIds = new Set(modifications.map((m) => m.entryId));

        changedEntryIds.forEach((entryId) => {
          const originalEntry = entries.find((e: any) => String(e.Id) === entryId || String(e.id) === entryId) as any;
          const formEntry = data.entries.find((e) => e.id === entryId);
          if (!originalEntry || !formEntry) return;

          // Detect moves so we can swap the FonteDados* metadata along with the
          // visible time. Per HAR (SAVE-5): moving Saida1→Entrada1 sends
          // Saida1:"" + Entrada1:"11:30" + FonteDadosEntrada1=<previous Saida1 metadata>
          // + FonteDadosIdEntrada1=<previous Saida1 id> + null on the source side.
          // Without this swap, Secullum receives orphan metadata and inconsistent rows.
          const cleared: { field: string; value: string }[] = [];
          const filled: { field: string; value: string }[] = [];
          for (const f of TIME_FIELDS) {
            const orig = ((originalEntry as any)[FORM_TO_SECULLUM_COL[f]] ?? null) as string | null;
            const cur = ((formEntry as any)[f] ?? null) as string | null;
            const origNorm = orig === null || orig === undefined || orig === "" ? "" : orig;
            const curNorm = cur === null || cur === undefined || cur === "" ? "" : cur;
            if (origNorm && !curNorm) cleared.push({ field: f, value: origNorm });
            else if (!origNorm && curNorm) filled.push({ field: f, value: curNorm });
          }

          // Pair cleared cells with filled cells that share the same value — those
          // are moves. Whatever remains in `cleared` is a true delete, and whatever
          // remains in `filled` is a fresh manual addition.
          const moves: { from: string; to: string; value: string }[] = [];
          const usedFilled = new Set<number>();
          for (const c of cleared) {
            const idx = filled.findIndex((f, i) => !usedFilled.has(i) && f.value === c.value);
            if (idx !== -1) {
              moves.push({ from: c.field, to: filled[idx].field, value: c.value });
              usedFilled.add(idx);
            }
          }
          const trueClears = cleared.filter((c) => !moves.some((m) => m.from === c.field));
          // Build the merged row starting from a deep-ish copy of the upstream row.
          const merged: any = { ...originalEntry };

          // 1) Apply form values to Entrada/Saida columns.
          for (const f of TIME_FIELDS) {
            merged[FORM_TO_SECULLUM_COL[f]] = (formEntry as any)[f];
          }
          // 2) Cleared cells must be explicitly "" (not null) — Secullum
          //    distinguishes never-touched (null) from cleared ("").
          for (const c of trueClears) {
            merged[FORM_TO_SECULLUM_COL[c.field]] = "";
          }
          // 3) For each move, also relocate the FonteDados object + id from the
          //    source slot to the destination slot, leaving the source nulled out.
          for (const m of moves) {
            merged[FORM_TO_SECULLUM_COL[m.from]] = "";
            const srcFD = FORM_TO_FONTE_DADOS[m.from];
            const dstFD = FORM_TO_FONTE_DADOS[m.to];
            const srcFDId = FORM_TO_FONTE_DADOS_ID[m.from];
            const dstFDId = FORM_TO_FONTE_DADOS_ID[m.to];
            const fdObj = (originalEntry as any)[srcFD] ?? null;
            const fdId = (originalEntry as any)[srcFDId] ?? null;
            merged[dstFD] = fdObj;
            merged[dstFDId] = fdId;
            merged[srcFD] = null;
            merged[srcFDId] = null;
          }
          // 4) Checkbox / scalar columns.
          merged.Compensado = formEntry.compensated;
          merged.Neutro = formEntry.neutral;
          merged.Folga = formEntry.dayOff;
          merged.AlmocoLivre = formEntry.freeLunch;
          merged.Id = parseInt(formEntry.id, 10);

          // 5) Build the ListaFonteDados array — Secullum's actual mechanism
          //    for marking new manual edits. Verified via manual.har: the
          //    request sends `ListaFonteDados: [{data, funcionarioId, coluna,
          //    tipo:1, valor, motivo, usaGeolocalizacao}]`, and the next list
          //    response returns the cell as FonteDados<Field>.{Tipo:1, Origem:2,
          //    Motivo}. The existing FonteDados<Field> objects on the row stay
          //    as-is (they reflect prior server state); only ListaFonteDados
          //    drives the new manual classification.
          const movedFroms = new Set(moves.map((m) => m.from));
          const movedTos = new Set(moves.map((m) => m.to));
          const listaFonteDados: any[] = [];
          for (const f of TIME_FIELDS) {
            // Skip move pairs — Secullum handles those via the FonteDados swap above.
            if (movedFroms.has(f) || movedTos.has(f)) continue;

            const orig = ((originalEntry as any)[FORM_TO_SECULLUM_COL[f]] ?? null) as string | null;
            const cur = ((formEntry as any)[f] ?? null) as string | null;
            const origNorm = orig === null || orig === undefined || orig === "" ? "" : orig;
            const curNorm = cur === null || cur === undefined || cur === "" ? "" : cur;
            if (origNorm === curNorm) continue; // unchanged

            const reasonKey = `${entryId}:${f}`;
            const motivo = pendingReasons[reasonKey] || "";
            listaFonteDados.push({
              data: merged.Data || (originalEntry as any).Data || null,
              funcionarioId:
                merged.FuncionarioId ?? (originalEntry as any).FuncionarioId ?? null,
              coluna: FORM_TO_SECULLUM_COL[f],
              tipo: 1, // 1 = manual (red pencil)
              valor: curNorm, // empty string for clears
              motivo,
              usaGeolocalizacao: false,
            });
          }
          if (listaFonteDados.length > 0) {
            merged.ListaFonteDados = listaFonteDados;
          }

          changedEntriesMap.set(entryId, merged);
        });

        const changedEntries = Array.from(changedEntriesMap.values());
        if (changedEntries.length === 0) return;

        const response = await secullumService.batchUpdateTimeEntries(changedEntries);

        if (response.data?.success) {
          toast.success(response.data.message || `${changedEntries.length} registros salvos com sucesso`);
          // Clear modification highlights. The form already shows the saved values,
          // so do NOT reset to defaultFormData — that's still derived from the stale
          // `entries` prop and would snap cells back to their pre-move column.
          // Invalidate the time-entries query so the refetched data updates `entries`,
          // and the `entriesSignature` effect will reset the form to fresh values.
          stateManager.actions.restoreAll();
          // Clear cached justification reasons — the next save starts fresh.
          setPendingReasons({});
          // Use the bare prefix instead of secullumKeys.timeEntries() — calling
          // it with no args produces ['secullum','time-entries',undefined], and
          // React Query's partialMatchKey rejects matches against
          // ['secullum','time-entries',{params}] because typeof undefined
          // !== typeof object. Prefix-only matches all parameterised variants.
          await queryClient.invalidateQueries({ queryKey: [...secullumKeys.all, "time-entries"] });
        } else {
          toast.error(response.data?.message || "Erro ao salvar alterações");
        }
      } catch (error: any) {
        const errorMessage = error.response?.data?.message || error.message || "Erro ao salvar alterações";
        toast.error(errorMessage);
        console.error("Save error:", error);
      }
    },
    [stateManager.actions, form, defaultFormData, entries, queryClient, pendingReasons],
  );

  const handleRestore = useCallback(() => {
    stateManager.actions.restoreAll();
    form.reset(defaultFormData);
    toast.info("Alterações restauradas");
  }, [stateManager.actions, form, defaultFormData]);

  // Context menu actions
  const handleContextMenu = useCallback((e: React.MouseEvent, entry: TimeClockEntry, field?: string) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, entry, field });
  }, []);

  const handleMoveToPreviousDay = useCallback(
    (entry: TimeClockEntry, specificField?: string) => {
      const currentEntryIndex = originalNormalizedEntries.findIndex((e) => e.id === entry.id);

      if (currentEntryIndex <= 0) {
        toast.warning("Já está no primeiro dia");
        setContextMenu(null);
        return;
      }

      const timeFields = ["entry1", "exit1", "entry2", "exit2", "entry3", "exit3", "entry4", "exit4", "entry5", "exit5"];
      const previousEntryId = originalNormalizedEntries[currentEntryIndex - 1].id;

      if (specificField) {
        const currentValue = form.getValues(`entries.${currentEntryIndex}.${specificField}` as any);

        if (!currentValue) {
          toast.warning("Campo vazio, nada para mover");
          setContextMenu(null);
          return;
        }

        // Find first available slot in previous day
        let moved = false;

        // Try same column first
        const previousValue = form.getValues(`entries.${currentEntryIndex - 1}.${specificField}` as any);
        const originalCurrentEntry = originalNormalizedEntries[currentEntryIndex];
        const originalPreviousEntry = originalNormalizedEntries[currentEntryIndex - 1];

        if (!previousValue) {
          // Update form
          form.setValue(`entries.${currentEntryIndex}.${specificField}` as any, null, { shouldValidate: false, shouldDirty: true, shouldTouch: true });
          form.setValue(`entries.${currentEntryIndex - 1}.${specificField}` as any, currentValue, { shouldValidate: false, shouldDirty: true, shouldTouch: true });

          // Update state manager
          stateManager.actions.updateField(entry.id, specificField, null, originalCurrentEntry[specificField as keyof typeof originalCurrentEntry]);
          stateManager.actions.updateField(previousEntryId, specificField, currentValue, originalPreviousEntry[specificField as keyof typeof originalPreviousEntry]);

          moved = true;
          toast.success("Movido para o dia anterior");
        } else {
          // Find any available slot
          for (const field of timeFields) {
            const value = form.getValues(`entries.${currentEntryIndex - 1}.${field}` as any);
            if (!value) {
              // Update form
              form.setValue(`entries.${currentEntryIndex}.${specificField}` as any, null, { shouldValidate: false, shouldDirty: true, shouldTouch: true });
              form.setValue(`entries.${currentEntryIndex - 1}.${field}` as any, currentValue, { shouldValidate: false, shouldDirty: true, shouldTouch: true });

              // Update state manager
              stateManager.actions.updateField(entry.id, specificField, null, originalCurrentEntry[specificField as keyof typeof originalCurrentEntry]);
              stateManager.actions.updateField(previousEntryId, field, currentValue, originalPreviousEntry[field as keyof typeof originalPreviousEntry]);

              moved = true;
              toast.success(`Movido para ${field.replace("entry", "Entrada ").replace("exit", "Saída ")} do dia anterior`);
              break;
            }
          }
        }

        if (!moved) {
          toast.warning("Dia anterior não tem campos disponíveis");
        }
      }

      setContextMenu(null);
    },
    [originalNormalizedEntries, form, stateManager.actions],
  );

  const handleMoveToNextDay = useCallback(
    (entry: TimeClockEntry, specificField?: string) => {
      const currentEntryIndex = originalNormalizedEntries.findIndex((e) => e.id === entry.id);

      if (currentEntryIndex >= originalNormalizedEntries.length - 1) {
        toast.warning("Já está no último dia");
        setContextMenu(null);
        return;
      }

      const timeFields = ["entry1", "exit1", "entry2", "exit2", "entry3", "exit3", "entry4", "exit4", "entry5", "exit5"];
      const nextEntryId = originalNormalizedEntries[currentEntryIndex + 1].id;

      if (specificField) {
        const currentValue = form.getValues(`entries.${currentEntryIndex}.${specificField}` as any);

        if (!currentValue) {
          toast.warning("Campo vazio, nada para mover");
          setContextMenu(null);
          return;
        }

        // Find first available slot in next day
        let moved = false;

        // Try same column first
        const nextValue = form.getValues(`entries.${currentEntryIndex + 1}.${specificField}` as any);
        const originalCurrentEntry = originalNormalizedEntries[currentEntryIndex];
        const originalNextEntry = originalNormalizedEntries[currentEntryIndex + 1];

        if (!nextValue) {
          // Update form
          form.setValue(`entries.${currentEntryIndex}.${specificField}` as any, null, { shouldValidate: false, shouldDirty: true, shouldTouch: true });
          form.setValue(`entries.${currentEntryIndex + 1}.${specificField}` as any, currentValue, { shouldValidate: false, shouldDirty: true, shouldTouch: true });

          // Update state manager
          stateManager.actions.updateField(entry.id, specificField, null, originalCurrentEntry[specificField as keyof typeof originalCurrentEntry]);
          stateManager.actions.updateField(nextEntryId, specificField, currentValue, originalNextEntry[specificField as keyof typeof originalNextEntry]);

          moved = true;
          toast.success("Movido para o próximo dia");
        } else {
          // Find any available slot
          for (const field of timeFields) {
            const value = form.getValues(`entries.${currentEntryIndex + 1}.${field}` as any);
            if (!value) {
              // Update form
              form.setValue(`entries.${currentEntryIndex}.${specificField}` as any, null, { shouldValidate: false, shouldDirty: true, shouldTouch: true });
              form.setValue(`entries.${currentEntryIndex + 1}.${field}` as any, currentValue, { shouldValidate: false, shouldDirty: true, shouldTouch: true });

              // Update state manager
              stateManager.actions.updateField(entry.id, specificField, null, originalCurrentEntry[specificField as keyof typeof originalCurrentEntry]);
              stateManager.actions.updateField(nextEntryId, field, currentValue, originalNextEntry[field as keyof typeof originalNextEntry]);

              moved = true;
              toast.success(`Movido para ${field.replace("entry", "Entrada ").replace("exit", "Saída ")} do próximo dia`);
              break;
            }
          }
        }

        if (!moved) {
          toast.warning("Próximo dia não tem campos disponíveis");
        }
      }

      setContextMenu(null);
    },
    [originalNormalizedEntries, form, stateManager.actions],
  );

  // Open the "Adicionar Justificativa" dialog for the right-clicked cell. The
  // pair (entry/exit) is preserved on the target so we know what to fill on
  // confirm — Secullum stores absences across the entry+exit pair (HAR shows
  // both Entrada2 and Saida2 set to "ATESTAD" when adding a single justification).
  const handleOpenAddJustification = useCallback(() => {
    if (!contextMenu) return;
    setAddJustificationTarget({ entry: contextMenu.entry, field: contextMenu.field });
    setContextMenu(null);
  }, [contextMenu]);

  // Resolve the paired field for a given time field — entry1↔exit1, entry2↔exit2, etc.
  const getPairedField = useCallback((field: string): string | null => {
    if (field.startsWith("entry")) return "exit" + field.slice("entry".length);
    if (field.startsWith("exit")) return "entry" + field.slice("exit".length);
    return null;
  }, []);

  const handleConfirmAddJustification = useCallback(
    (nomeAbreviado: string) => {
      if (!addJustificationTarget) return;
      const { entry, field } = addJustificationTarget;
      const entryIndex = originalNormalizedEntries.findIndex((e) => e.id === entry.id);
      if (entryIndex === -1) {
        toast.error("Registro não encontrado");
        setAddJustificationTarget(null);
        return;
      }

      const targets: string[] = [];
      if (field) {
        targets.push(field);
        const paired = getPairedField(field);
        if (paired) targets.push(paired);
      } else {
        // Row-level: fill the first empty entry/exit pair.
        const ALL = ["entry1", "exit1", "entry2", "exit2", "entry3", "exit3", "entry4", "exit4", "entry5", "exit5"];
        const firstEmpty = ALL.find((f) => !form.getValues(`entries.${entryIndex}.${f}` as any));
        if (firstEmpty) {
          targets.push(firstEmpty);
          const paired = getPairedField(firstEmpty);
          if (paired) targets.push(paired);
        }
      }

      if (targets.length === 0) {
        toast.warning("Nenhum campo disponível para a justificativa");
        setAddJustificationTarget(null);
        return;
      }

      const originalEntry = originalNormalizedEntries[entryIndex];
      for (const t of targets) {
        form.setValue(`entries.${entryIndex}.${t}` as any, nomeAbreviado, {
          shouldValidate: false,
          shouldDirty: true,
          shouldTouch: true,
        });
        const originalValue = originalEntry[t as keyof typeof originalEntry];
        stateManager.actions.updateField(entry.id, t, nomeAbreviado, originalValue);
      }

      toast.success(`Justificativa "${nomeAbreviado.trim()}" adicionada — clique em salvar para enviar`);
      setAddJustificationTarget(null);
    },
    [addJustificationTarget, originalNormalizedEntries, form, stateManager.actions, getPairedField],
  );

  // Clear the targeted cell. Per delete_value.har, Secullum receives the cleared
  // cell as "" (the existing handleSubmit converts null → "" for fields that
  // were originally filled). When the value is a justification (non-time text),
  // clear the paired entry/exit slot too — that's how Secullum's UI behaves and
  // how the HAR was captured.
  const handleDeleteEntry = useCallback(() => {
    if (!contextMenu) return;
    const { entry, field } = contextMenu;
    if (!field) {
      setContextMenu(null);
      return;
    }
    const entryIndex = originalNormalizedEntries.findIndex((e) => e.id === entry.id);
    if (entryIndex === -1) {
      setContextMenu(null);
      return;
    }

    const currentValue = form.getValues(`entries.${entryIndex}.${field}` as any) as string | null;
    if (!currentValue) {
      setContextMenu(null);
      return;
    }

    const isTimeValue = /^\d{1,2}:\d{2}$/.test(currentValue);
    const targets: string[] = [field];
    if (!isTimeValue) {
      const paired = getPairedField(field);
      if (paired) {
        const pairedValue = form.getValues(`entries.${entryIndex}.${paired}` as any) as string | null;
        if (pairedValue) targets.push(paired);
      }
    }

    const originalEntry = originalNormalizedEntries[entryIndex];
    for (const t of targets) {
      form.setValue(`entries.${entryIndex}.${t}` as any, null, {
        shouldValidate: false,
        shouldDirty: true,
        shouldTouch: true,
      });
      const originalValue = originalEntry[t as keyof typeof originalEntry];
      stateManager.actions.updateField(entry.id, t, null, originalValue);
    }

    toast.success(targets.length > 1 ? "Justificativa removida — clique em salvar para enviar" : "Valor removido — clique em salvar para enviar");
    setContextMenu(null);
  }, [contextMenu, originalNormalizedEntries, form, stateManager.actions, getPairedField]);

  const handleViewLocation = useCallback((entry: TimeClockEntry, field?: string) => {
    // Prefer the per-field source for the cell that was right-clicked. If no
    // specific field is available, fall back to the first slot with a location.
    const fieldSource = field ? entry.fieldSources?.[field as keyof NonNullable<TimeClockEntry["fieldSources"]>] : undefined;
    const dayFallback = Object.values(entry.fieldSources ?? {}).find((s) => s?.latitude != null && s?.longitude != null);
    const source = fieldSource?.latitude != null ? fieldSource : dayFallback;

    if (!source || source.latitude == null || source.longitude == null) {
      toast.error("Este registro não possui localização salva.");
      setContextMenu(null);
      return;
    }
    const locationData: LocationData = {
      FonteDadosId: source.fonteDadosId ?? parseInt(entry.id),
      DataHora: source.dataHora || entry.date.toISOString(),
      Latitude: source.latitude,
      Longitude: source.longitude,
      Precisao: source.accuracy ?? 0,
      Endereco: source.address ?? "",
      PossuiFoto: source.hasPhoto,
    };
    setLocationDialog(locationData);
    setContextMenu(null);
  }, []);

  const handleViewPhoto = useCallback((entry: TimeClockEntry, field?: string) => {
    const fieldSource = field ? entry.fieldSources?.[field as keyof NonNullable<TimeClockEntry["fieldSources"]>] : undefined;
    const dayFallback = Object.values(entry.fieldSources ?? {}).find((s) => s?.hasPhoto);
    const source = fieldSource?.hasPhoto ? fieldSource : dayFallback;

    if (!source || !source.hasPhoto || source.fonteDadosId == null) {
      toast.error("Este registro não possui foto.");
      setContextMenu(null);
      return;
    }
    setPhotoDialog({
      userId: parseInt(entry.userId || "0"),
      fonteDadosId: source.fonteDadosId,
    });
    setContextMenu(null);
  }, []);

  const getDayOfWeek = (date: Date): string => {
    const days = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
    return days[new Date(date).getDay()];
  };

  // Check if a field is modified
  const isFieldModified = useCallback(
    (formFieldId: string, field: string): boolean => {
      // Convert form field ID to actual entry ID
      const entryIndex = fields.findIndex((f) => f.id === formFieldId);
      if (entryIndex === -1) return false;

      const actualEntry = normalizedEntries[entryIndex];
      if (!actualEntry) return false;

      const actualEntryId = actualEntry.id;
      const result = stateManager.actions.isFieldModified(actualEntryId, field);
      return result;
    },
    [fields, normalizedEntries, stateManager.actions],
  );

  // Expose methods to parent component
  useImperativeHandle(
    ref,
    () => ({
      handleSubmit: () => form.handleSubmit(handleSubmit, (errors) => {
        // react-hook-form swallows invalid submits silently otherwise — surface
        // a toast so cells that fail schema validation (e.g. malformed time)
        // don't look like a no-op save.
        console.warn("Time-clock form validation errors", errors);
        toast.error("Há campos com formato inválido. Verifique os horários e justificativas.");
      })(),
      handleRestore: () => handleRestore(),
      hasChanges: stateManager.actions.getChangedEntryCount() > 0,
      isPending,
    }),
    [form, handleSubmit, handleRestore, stateManager.actions, isPending],
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (normalizedEntries.length === 0) {
    return (
      <div className="flex items-center justify-center h-96 text-muted-foreground">
        <div className="text-center">
          <div className="text-lg font-medium">Nenhum registro encontrado</div>
          <div className="text-sm">Tente ajustar os filtros ou selecionar um período diferente</div>
        </div>
      </div>
    );
  }

  // Debug overall state at render
  return (
    <div className={cn("flex flex-col h-full overflow-hidden", className)} ref={tableRef}>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(handleSubmit, (errors) => {
        // react-hook-form swallows invalid submits silently otherwise — surface
        // a toast so cells that fail schema validation (e.g. malformed time)
        // don't look like a no-op save.
        console.warn("Time-clock form validation errors", errors);
        toast.error("Há campos com formato inválido. Verifique os horários e justificativas.");
      })} className="flex-1 overflow-hidden flex flex-col">
          <div className="flex-1 overflow-auto border border-neutral-400 dark:border-border rounded-md">
            <table className="w-full border-collapse">
              <thead className="sticky top-0 z-20 bg-background">
                <tr className="border-b border-neutral-400 dark:border-border">
                  <th className="text-left p-2 font-medium text-sm sticky left-0 bg-background z-30 w-[150px] min-w-[150px] max-w-[150px] border-r border-neutral-400 dark:border-border">
                    Data
                  </th>
                  {isVisible("entry1") && <th className="text-center p-2 font-medium text-sm w-32 min-w-32 max-w-32 border-r border-neutral-400 dark:border-border">Entrada 1</th>}
                  {isVisible("exit1") && <th className="text-center p-2 font-medium text-sm w-32 min-w-32 max-w-32 border-r border-neutral-400 dark:border-border">Saída 1</th>}
                  {isVisible("entry2") && <th className="text-center p-2 font-medium text-sm w-32 min-w-32 max-w-32 border-r border-neutral-400 dark:border-border">Entrada 2</th>}
                  {isVisible("exit2") && <th className="text-center p-2 font-medium text-sm w-32 min-w-32 max-w-32 border-r border-neutral-400 dark:border-border">Saída 2</th>}
                  {isVisible("entry3") && <th className="text-center p-2 font-medium text-sm w-32 min-w-32 max-w-32 border-r border-neutral-400 dark:border-border">Entrada 3</th>}
                  {isVisible("exit3") && <th className="text-center p-2 font-medium text-sm w-32 min-w-32 max-w-32 border-r border-neutral-400 dark:border-border">Saída 3</th>}
                  {isVisible("entry4") && <th className="text-center p-2 font-medium text-sm w-32 min-w-32 max-w-32 border-r border-neutral-400 dark:border-border">Entrada 4</th>}
                  {isVisible("exit4") && <th className="text-center p-2 font-medium text-sm w-32 min-w-32 max-w-32 border-r border-neutral-400 dark:border-border">Saída 4</th>}
                  {isVisible("entry5") && <th className="text-center p-2 font-medium text-sm w-32 min-w-32 max-w-32 border-r border-neutral-400 dark:border-border">Entrada 5</th>}
                  {isVisible("exit5") && <th className="text-center p-2 font-medium text-sm w-32 min-w-32 max-w-32 border-r border-neutral-400 dark:border-border">Saída 5</th>}
                  {isVisible("compensated") && <th className="text-center p-2 font-medium text-sm w-28 min-w-28 max-w-28 border-r border-neutral-400 dark:border-border">Compensado</th>}
                  {isVisible("neutral") && <th className="text-center p-2 font-medium text-sm w-28 min-w-28 max-w-28 border-r border-neutral-400 dark:border-border">Neutro</th>}
                  {isVisible("dayOff") && <th className="text-center p-2 font-medium text-sm w-28 min-w-28 max-w-28 border-r border-neutral-400 dark:border-border">Folga</th>}
                  {isVisible("freeLunch") && <th className="text-center p-2 font-medium text-sm w-28 min-w-28 max-w-28 border-neutral-400 dark:border-border">Almoço</th>}
                </tr>
              </thead>
              <tbody>
                {fields.map((field, index) => {
                  const entry = normalizedEntries[index];
                  if (!entry) {
                    return null;
                  }
                  const isWeekend = new Date(entry.date).getDay() === 0 || new Date(entry.date).getDay() === 6;

                  return (
                    <tr
                      key={field.id}
                      className={cn(
                        "border-b border-neutral-400 dark:border-border transition-colors",
                        isWeekend && "bg-red-50 dark:bg-red-900/10",
                      )}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        // Don't open context menu on the whole row
                      }}
                    >
                      <td
                        className="p-2 sticky left-0 bg-background z-10 w-[150px] min-w-[150px] max-w-[150px] border-r border-neutral-400 dark:border-border"
                        onContextMenu={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleContextMenu(e, entry); // No specific field - moves all
                        }}
                      >
                        <div className="flex flex-col">
                          <span className="text-sm font-medium">
                            {formatDate(entry.date)} - {getDayOfWeek(entry.date)}
                          </span>
                          <span className="text-xs text-muted-foreground">{entry.user?.name}</span>
                        </div>
                      </td>

                      {/* Time inputs */}
                      {["entry1", "exit1", "entry2", "exit2", "entry3", "exit3", "entry4", "exit4", "entry5", "exit5"].filter(isVisible).map((timeField) => {
                        const isModified = isFieldModified(field.id, timeField);
                        // The original value (from server) for comparing live form value below.
                        // Captured in outer scope; never changes for this render of the row.
                        const originalCellValue = (entry[timeField as keyof TimeClockEntry] ?? null) as string | null;
                        // `field.id` is react-hook-form's auto-generated key, not
                        // Secullum's numeric Id — match by the normalized entry id
                        // (which is `String(secullumEntry.Id)`) so we actually find
                        // the row carrying the FonteDados metadata.
                        const rawEntry = entries.find((e: any) => String(e.Id) === entry.id || String(e.id) === entry.id);
                        const serverMarker = getManualEntryMarker(rawEntry, timeField);
                        // The move arrows must respect the absolute column index
                        // (entry1=0 ... exit5=9), not just whether the cell has a
                        // value. Otherwise entry1 shows a left chevron with no slot
                        // to swap into, and exit5 shows a right chevron with the
                        // same problem.
                        const ALL_TIME_FIELDS = ["entry1","exit1","entry2","exit2","entry3","exit3","entry4","exit4","entry5","exit5"];
                        const absoluteIndex = ALL_TIME_FIELDS.indexOf(timeField);
                        const canMoveLeft = absoluteIndex > 0;
                        const canMoveRight = absoluteIndex < ALL_TIME_FIELDS.length - 1;
                        return (
                          <td
                            key={timeField}
                            className={cn("p-1 w-32 min-w-32 max-w-32 border-r border-neutral-400 dark:border-border", isModified && "bg-yellow-100 dark:bg-yellow-900/30")}
                            onContextMenu={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              // Open the context menu regardless of whether the
                              // cell has a value — empty cells still need access
                              // to "Liberar justificativa" so the user can record
                              // an absence reason. Move/delete/photo/location
                              // options are gated below.
                              handleContextMenu(e, entry, timeField);
                            }}
                          >
                            <FormField
                              control={form.control}
                              name={`entries.${index}.${timeField}` as any}
                              render={({ field: formField }) => {
                                const cellValue = formField.value as string | null;
                                const isJustification = !!cellValue && !/^\d{1,2}:\d{2}$/.test(cellValue);
                                const justificationFullName = isJustification ? justificationFullNameMap.get((cellValue || "").trim()) : null;
                                // Compute the manual marker INSIDE the render prop so it
                                // sees the live value as the user types (FormField re-renders
                                // on every change). If the value differs from the original
                                // server value, treat it as a local edit → pencil.
                                const norm = (v: string | null | undefined) => (v ?? "").trim();
                                const isLocallyModified = norm(cellValue) !== norm(originalCellValue);
                                const manualMarker = isLocallyModified
                                  ? { kind: "pencil" as const, motivo: serverMarker?.motivo ?? null }
                                  : serverMarker;
                                const manualMotivo = manualMarker?.motivo ?? null;
                                return (
                                <FormItem>
                                  <FormControl>
                                    <div className="relative flex items-center gap-0.5 justify-center min-w-[100px]">
                                      <div className="w-6 flex justify-center">
                                        {formField.value && canMoveLeft && (
                                          <Button type="button" variant="ghost" size="icon" className="h-6 w-6 p-0" onClick={() => handleTimeShift(field.id, timeField, "left")}>
                                            <ChevronLeft className="h-3 w-3" />
                                          </Button>
                                        )}
                                      </div>
                                      {isJustification ? (
                                        <Tooltip delayDuration={500}>
                                          <TooltipTrigger asChild>
                                            <div className="h-8 px-2 flex items-center justify-center text-xs font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-400 cursor-default whitespace-nowrap select-none">
                                              {cellValue?.trim()}
                                            </div>
                                          </TooltipTrigger>
                                          <TooltipContent side="top" className="max-w-[280px]">
                                            <div className="space-y-0.5">
                                              <div className="font-semibold">{cellValue?.trim()}</div>
                                              {justificationFullName && <div className="text-xs opacity-90">{justificationFullName}</div>}
                                            </div>
                                          </TooltipContent>
                                        </Tooltip>
                                      ) : (
                                        <TransparentTimeInput
                                          value={cellValue}
                                          onChange={(value) => {
                                            formField.onChange(value);
                                            handleTimeChange(field.id, timeField, value);
                                          }}
                                          onBlur={() =>
                                            handleTimeBlur(
                                              field.id,
                                              timeField,
                                              timeField.replace("entry", "Entrada ").replace("exit", "Saída "),
                                              entry[timeField as keyof TimeClockEntry] as string | null,
                                              cellValue,
                                            )
                                          }
                                          className="h-8 w-14 text-center px-1 flex-shrink-0"
                                        />
                                      )}
                                      <div className="w-6 flex justify-center">
                                        {formField.value && canMoveRight && (
                                          <Button type="button" variant="ghost" size="icon" className="h-6 w-6 p-0" onClick={() => handleTimeShift(field.id, timeField, "right")}>
                                            <ChevronRight className="h-3 w-3" />
                                          </Button>
                                        )}
                                      </div>
                                      {manualMarker && formField.value && (
                                        <Tooltip delayDuration={500}>
                                          <TooltipTrigger asChild>
                                            {manualMarker.kind === "user-request" ? (
                                              <UserRequestIcon className="absolute right-1 top-1/2 -translate-y-1/2 h-4 w-4 text-blue-500 dark:text-blue-400 cursor-default pointer-events-auto" strokeWidth={2.5} />
                                            ) : (
                                              <PencilIcon className="absolute right-1 top-1/2 -translate-y-1/2 h-4 w-4 text-rose-500 dark:text-rose-400 cursor-default pointer-events-auto" strokeWidth={2.5} />
                                            )}
                                          </TooltipTrigger>
                                          <TooltipContent side="top" className="max-w-[280px]">
                                            <div className="space-y-0.5">
                                              <div className="font-semibold">
                                                {manualMarker.kind === "user-request" ? "Solicitado pelo colaborador" : "Inclusão manual"}
                                              </div>
                                              {manualMotivo && <div className="text-xs opacity-90 whitespace-pre-wrap">{manualMotivo}</div>}
                                            </div>
                                          </TooltipContent>
                                        </Tooltip>
                                      )}
                                    </div>
                                  </FormControl>
                                </FormItem>
                                );
                              }}
                            />
                          </td>
                        );
                      })}

                      {/* Checkboxes */}
                      {isVisible("compensated") && (
                        <td className={cn("p-1 text-center w-28 min-w-28 max-w-28 border-r border-neutral-400 dark:border-border", isFieldModified(field.id, "compensated") && "bg-yellow-100 dark:bg-yellow-900/30")}>
                          <FormField control={form.control} name={`entries.${index}.compensated`} render={({ field: formField }) => (
                            <FormItem className="flex justify-center"><FormControl>
                              <Checkbox checked={formField.value} onCheckedChange={(checked) => { formField.onChange(checked); handleFieldChange(field.id, "compensated", checked); }} />
                            </FormControl></FormItem>
                          )} />
                        </td>
                      )}

                      {isVisible("neutral") && (
                        <td className={cn("p-1 text-center w-28 min-w-28 max-w-28 border-r border-neutral-400 dark:border-border", isFieldModified(field.id, "neutral") && "bg-yellow-100 dark:bg-yellow-900/30")}>
                          <FormField control={form.control} name={`entries.${index}.neutral`} render={({ field: formField }) => (
                            <FormItem className="flex justify-center"><FormControl>
                              <Checkbox checked={formField.value} onCheckedChange={(checked) => { formField.onChange(checked); handleFieldChange(field.id, "neutral", checked); }} />
                            </FormControl></FormItem>
                          )} />
                        </td>
                      )}

                      {isVisible("dayOff") && (
                        <td className={cn("p-1 text-center w-28 min-w-28 max-w-28 border-r border-neutral-400 dark:border-border", isFieldModified(field.id, "dayOff") && "bg-yellow-100 dark:bg-yellow-900/30")}>
                          <FormField control={form.control} name={`entries.${index}.dayOff`} render={({ field: formField }) => (
                            <FormItem className="flex justify-center"><FormControl>
                              <Checkbox checked={formField.value} onCheckedChange={(checked) => { formField.onChange(checked); handleFieldChange(field.id, "dayOff", checked); }} />
                            </FormControl></FormItem>
                          )} />
                        </td>
                      )}

                      {isVisible("freeLunch") && (
                        <td className={cn("p-1 text-center w-28 min-w-28 max-w-28 border-neutral-400 dark:border-border", isFieldModified(field.id, "freeLunch") && "bg-yellow-100 dark:bg-yellow-900/30")}>
                          <FormField control={form.control} name={`entries.${index}.freeLunch`} render={({ field: formField }) => (
                            <FormItem className="flex justify-center"><FormControl>
                              <Checkbox checked={formField.value} onCheckedChange={(checked) => { formField.onChange(checked); handleFieldChange(field.id, "freeLunch", checked); }} />
                            </FormControl></FormItem>
                          )} />
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </form>
      </Form>

      {/* Context Menu */}
      {contextMenu && (() => {
        // Determine whether the targeted cell has a value. Field-level right-click
        // → check that specific cell. Row-level right-click (date column, no field)
        // → treat as having content if any time slot in the row is filled.
        const ctxIndex = originalNormalizedEntries.findIndex((e) => e.id === contextMenu.entry.id);
        const ALL_TIME_FIELDS = ["entry1", "exit1", "entry2", "exit2", "entry3", "exit3", "entry4", "exit4", "entry5", "exit5"] as const;
        const hasValue = contextMenu.field
          ? Boolean(form.getValues(`entries.${ctxIndex}.${contextMenu.field}` as any))
          : ctxIndex !== -1 && ALL_TIME_FIELDS.some((f) => Boolean(form.getValues(`entries.${ctxIndex}.${f}` as any)));
        return (
        <div
          className="fixed z-50"
          style={{
            left: contextMenu.x,
            top: contextMenu.y,
          }}
        >
          <DropdownMenu
            open={!!contextMenu}
            onOpenChange={(open) => {
              if (!open) setContextMenu(null);
            }}
            modal={false}
          >
            <DropdownMenuTrigger asChild>
              <div className="opacity-0 pointer-events-none w-1 h-1" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" side="bottom" className="min-w-56">
              <DropdownMenuItem onClick={handleOpenAddJustification}>
                <FileText className="h-4 w-4 mr-2" />
                Adicionar Justificativa
              </DropdownMenuItem>
              {hasValue && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleDeleteEntry}>
                    <Trash2 className="h-4 w-4 mr-2" />
                    Excluir
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleMoveToPreviousDay(contextMenu.entry, contextMenu.field)}>
                    <MoveUp className="h-4 w-4 mr-2" />
                    Mover para dia anterior
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleMoveToNextDay(contextMenu.entry, contextMenu.field)}>
                    <MoveDown className="h-4 w-4 mr-2" />
                    Mover para próximo dia
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => handleViewLocation(contextMenu.entry, contextMenu.field)}>
                    <MapPin className="h-4 w-4 mr-2" />
                    Ver localização no mapa
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleViewPhoto(contextMenu.entry, contextMenu.field)}>
                    <Camera className="h-4 w-4 mr-2" />
                    Ver foto
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        );
      })()}

      <TimeClockJustificationDialog
        open={!!pendingJustification}
        onOpenChange={(open) => !open && setPendingJustification(null)}
        onConfirm={handleJustificationConfirm}
        originalTime={pendingJustification?.originalTime ?? null}
        newTime={pendingJustification?.newTime ?? null}
        field={pendingJustification?.field || ""}
        fieldLabel={pendingJustification?.fieldLabel || ""}
        isLoading={isPending}
      />

      <TimeClockEntryDetailModal open={!!selectedEntry} onOpenChange={(open) => !open && setSelectedEntry(null)} entry={selectedEntry} />

      {photoDialog && <PhotoViewDialog isOpen={!!photoDialog} onClose={() => setPhotoDialog(null)} userId={photoDialog.userId} fonteDadosId={photoDialog.fonteDadosId} />}

      {locationDialog && <LocationMapDialog isOpen={!!locationDialog} onClose={() => setLocationDialog(null)} location={locationDialog} />}

      <AddJustificationDialog
        open={!!addJustificationTarget}
        onOpenChange={(open) => !open && setAddJustificationTarget(null)}
        onConfirm={handleConfirmAddJustification}
        fieldLabel={
          addJustificationTarget?.field
            ? addJustificationTarget.field.replace("entry", "Entrada ").replace("exit", "Saída ")
            : "do dia"
        }
      />
    </div>
  );
};

export const TimeClockEntryTable = forwardRef(TimeClockEntryTableComponent);

TimeClockEntryTable.displayName = "TimeClockEntryTable";
