import { useState, useCallback, useEffect, useRef, forwardRef, useImperativeHandle } from "react";
import { useController } from "react-hook-form";
import { IconPlus, IconTrash } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { FileSuggestions } from "@/components/common/file";
import type { FileWithPreview } from "@/components/common/file";
import { LayoutFileUploadField } from "./layout-file-upload-field";
import { AIRBRUSHING_STATUS, AIRBRUSHING_PAYMENT_STATUS, AIRBRUSHING_DUE_DATE_RULE } from "../../../../constants";
import { AirbrushingFields, type AirbrushingFieldValues } from "@/components/production/airbrushing/form/airbrushing-fields";

interface MultiAirbrushingSelectorProps {
  control: any;
  disabled?: boolean;
  isEditMode?: boolean;
  onAirbrushingsCountChange?: (count: number) => void;
  // Customer of the task — scopes the airbrushing-layout recommendations to files that
  // were previously used as AIRBRUSHING layouts for this customer (separate from task layouts).
  customerId?: string;
  /**
   * Se o usuário pode ver dinheiro. Este seletor vive FORA de DataTable/DetailPage, então
   * não herda nem o gate de privilégio nem o olho de `usePricingVisible` — o preço, o status
   * e a configuração de pagamento precisam ser gateados aqui, à mão.
   */
  canViewFinancials?: boolean;
  /**
   * Mostra Status / Status do Pagamento em cada linha. Por padrão só na edição (no cadastro
   * de tarefa a aerografia nasce em Preparação); o assistente de aerografia liga explicitamente
   * para que criar e editar ofereçam exatamente os mesmos campos.
   */
  showStatus?: boolean;
}

interface AirbrushingItem extends AirbrushingFieldValues {
  id: string;
  status: string;
  paymentStatus: string;
  // receiptFiles / invoiceFiles are NOT rendered here anymore (the airbrushing section is
  // layout-only per product), but they remain in the model so the edit-form reconciliation
  // preserves any existing receipts/invoices instead of dropping them on save.
  receiptFiles: FileWithPreview[];
  invoiceFiles: FileWithPreview[];
  layouts: FileWithPreview[];
  receiptIds?: string[];
  invoiceIds?: string[];
  layoutIds?: string[];
  /** fileId → LayoutStatus, para os layouts já enviados desta configuração. */
  layoutStatuses?: Record<string, string>;
  uploading?: boolean;
  error?: string;
}

export interface MultiAirbrushingSelectorRef {
  addAirbrushing: () => void;
  clearAll: () => void;
}

// Helper to convert File objects (API relation rows) to FileWithPreview.
const convertFilesToFileWithPreview = (files: any[]): FileWithPreview[] => {
  return (files || []).map(file => {
    const mockFile = new File([], file.filename || file.name || '', { type: file.mimetype || file.type || '' });
    // name/size/type are read-only getters on File.prototype — Object.assign on them throws
    // "Cannot set property name of #<File> which has only a getter". Shadow them with own
    // properties via defineProperty so we can carry the real size (the empty File ctor yields 0).
    Object.defineProperties(mockFile, {
      size: { value: file.size ?? 0, writable: false, configurable: true, enumerable: true },
      type: { value: file.mimetype || file.type || '', writable: false, configurable: true, enumerable: true },
    });
    return Object.assign(mockFile, {
      id: file.id,
      preview: file.url || '',
      uploaded: true,
      uploadedFileId: file.id,
      thumbnailUrl: file.thumbnailUrl || undefined,
      // Layouts vêm achatados do servidor com o status do Layout junto (recibos e notas
      // simplesmente não têm). Sem carregá-lo aqui, todo layout já aprovado reaparecia
      // como "Rascunho" no formulário e o mapa semeado em `layoutStatuses` nascia vazio.
      status: file.status || undefined,
    }) as FileWithPreview;
  });
};

// Rehydrate a layouts array from form state. Already-hydrated FileWithPreview / new File
// instances are kept as-is; raw API rows are converted. Avoids the old double-spread that
// duplicated every existing layout and re-marked new files as uploaded.
const mapLayouts = (arr: any[]): FileWithPreview[] =>
  (arr || []).map((f: any) => {
    if (f instanceof File) return f as FileWithPreview;
    if (f && (f.uploaded || f.uploadedFileId)) return f as FileWithPreview;
    return convertFilesToFileWithPreview([f])[0];
  });

/** File ids of the already-persisted entries in a hydrated file list. */
const uploadedIds = (files: FileWithPreview[]): string[] =>
  files
    .filter((f) => (f as any).uploaded)
    .map((f) => (f as any).uploadedFileId || (f as any).id)
    .filter(Boolean) as string[];

const mapFieldValueToItem = (airbrushing: any, index: number): AirbrushingItem => {
  const receiptFiles = [
    ...convertFilesToFileWithPreview(airbrushing.receipts || []),
    ...(airbrushing.receiptFiles || []),
  ];
  const invoiceFiles = [
    ...convertFilesToFileWithPreview(airbrushing.invoices || []),
    ...(airbrushing.invoiceFiles || []),
  ];
  const layouts = mapLayouts(airbrushing.layouts || []);

  return {
    id: airbrushing.id || `airbrushing-${Date.now()}-${index}`,
    paymentMethod: airbrushing.paymentMethod ?? null,
    dueDateRule: airbrushing.dueDateRule ?? AIRBRUSHING_DUE_DATE_RULE.DAYS_AFTER_FINISH,
    paymentTermDays: airbrushing.paymentTermDays ?? null,
    dueDayOfMonth: airbrushing.dueDayOfMonth ?? null,
    dueDate: airbrushing.dueDate ?? null,
    status: airbrushing.status || AIRBRUSHING_STATUS.PREPARATION,
    paymentStatus: airbrushing.paymentStatus || AIRBRUSHING_PAYMENT_STATUS.PENDING,
    price: airbrushing.price || null,
    description: airbrushing.description ?? null,
    startDate: airbrushing.startDate || null,
    finishDate: airbrushing.finishDate || null,
    startedAt: airbrushing.startedAt || null,
    finishedAt: airbrushing.finishedAt || null,
    painterId: airbrushing.painterId || null,
    painter: airbrushing.painter || null,
    receiptFiles,
    invoiceFiles,
    layouts,
    // Derive the *Ids from the hydrated relations. The API returns the RELATIONS
    // (receipts/invoices/layouts) — there is no receiptIds/invoiceIds/layoutIds scalar on
    // Airbrushing — so reading airbrushing.receiptIds always yielded []. The task update
    // then submitted that [] and TaskService turned it into `receipts: { set: [] }`,
    // silently detaching every receipt/invoice/layout on an unrelated task edit.
    // These must be FILE ids, not Layout entity ids (see the ID DOMAIN note in
    // airbrushing.service.ts) — uploadedIds reads uploadedFileId, which mapLayouts sets
    // to the Layout's fileId.
    receiptIds: airbrushing.receiptIds || uploadedIds(receiptFiles),
    invoiceIds: airbrushing.invoiceIds || uploadedIds(invoiceFiles),
    layoutIds: airbrushing.layoutIds || uploadedIds(layouts),
    // Semeia o mapa com o status que veio do servidor. Sem isto, um save que não
    // mexeu em layout nenhum reenviaria o mapa vazio e todo layout voltaria a Rascunho.
    layoutStatuses:
      airbrushing.layoutStatuses ??
      Object.fromEntries(
        layouts
          .filter((f: any) => (f.uploadedFileId || f.id) && f.status)
          .map((f: any) => [f.uploadedFileId || f.id, f.status as string]),
      ),
  };
};

export const MultiAirbrushingSelector = forwardRef<MultiAirbrushingSelectorRef, MultiAirbrushingSelectorProps>(
  ({ control, disabled, isEditMode = false, onAirbrushingsCountChange, customerId, canViewFinancials = true, showStatus }, ref) => {
    const statusVisible = showStatus ?? isEditMode;

    // Use controller to properly manage form field
    const { field } = useController({
      name: "airbrushings" as any,
      control,
    });

    // Initialize airbrushings from form field value
    // Defaults are now set in mapDataToForm, so field.value should always have data
    const [airbrushings, setAirbrushings] = useState<AirbrushingItem[]>(() => {
      const data = field.value && Array.isArray(field.value) ? field.value : [];
      return data.map((a: any, index: number) => mapFieldValueToItem(a, index));
    });

    // Track if initial sync has been done to prevent marking form dirty on mount
    const hasInitialSynced = useRef(false);

    // Track if we're syncing to prevent infinite loops
    const isSyncingToForm = useRef<boolean>(false);
    const lastFieldValueRef = useRef<string>("");

    // Sync FROM form field TO local state when form resets (form → local)
    useEffect(() => {
      // Skip if we're currently syncing to form
      if (isSyncingToForm.current) {
        return;
      }

      const fieldValueStr = JSON.stringify(field.value);

      // Skip if value hasn't changed
      if (fieldValueStr === lastFieldValueRef.current) {
        return;
      }

      lastFieldValueRef.current = fieldValueStr;

      // Always map from field.value - mapDataToForm now provides defaults
      if (field.value && Array.isArray(field.value) && field.value.length > 0) {
        setAirbrushings(field.value.map((a: any, index: number) => mapFieldValueToItem(a, index)));
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [field.value]);

    // Sync FROM local state TO form field when airbrushings change (local → form)
    useEffect(() => {
      // Skip initial sync to avoid marking form dirty on mount
      // The form already has the correct initial value from mapDataToForm
      if (!hasInitialSynced.current) {
        hasInitialSynced.current = true;
        // Still notify parent about count on initial render
        if (onAirbrushingsCountChange) {
          onAirbrushingsCountChange(airbrushings.length);
        }
        return;
      }

      // Mark that we're syncing
      isSyncingToForm.current = true;

      const formValue = airbrushings.map((airbrushing) => {
        return {
          id: airbrushing.id, // Preserve ID for sync back
          status: airbrushing.status,
          paymentStatus: airbrushing.paymentStatus,
          paymentMethod: airbrushing.paymentMethod ?? null,
          dueDateRule: airbrushing.dueDateRule ?? AIRBRUSHING_DUE_DATE_RULE.DAYS_AFTER_FINISH,
          paymentTermDays: airbrushing.paymentTermDays ?? null,
          dueDayOfMonth: airbrushing.dueDayOfMonth ?? null,
          dueDate: airbrushing.dueDate ?? null,
          price: airbrushing.price,
          description: airbrushing.description,
          startDate: airbrushing.startDate,
          finishDate: airbrushing.finishDate,
          startedAt: airbrushing.startedAt,
          finishedAt: airbrushing.finishedAt,
          painterId: airbrushing.painterId,
          painter: airbrushing.painter,
          receiptIds: airbrushing.receiptIds || [],
          invoiceIds: airbrushing.invoiceIds || [],
          layoutIds: airbrushing.layoutIds || [],
          layoutStatuses: airbrushing.layoutStatuses || {},
          // Include the actual files for submission with the form
          receiptFiles: airbrushing.receiptFiles,
          invoiceFiles: airbrushing.invoiceFiles,
          layouts: airbrushing.layouts,
        };
      });
      field.onChange(formValue);

      // Notify parent about count change
      if (onAirbrushingsCountChange) {
        onAirbrushingsCountChange(airbrushings.length);
      }

      // Clear sync flag after next tick
      setTimeout(() => {
        isSyncingToForm.current = false;
      }, 0);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [airbrushings]); // Only depend on airbrushings state

    const addAirbrushing = useCallback(() => {
      const newAirbrushing: AirbrushingItem = {
        // crypto.randomUUID, not Date.now(): two rows added within the same millisecond would share
        // an id, and `updateAirbrushing` matches on id — editing one would silently write into both.
        id: `airbrushing-${crypto.randomUUID()}`,
        status: AIRBRUSHING_STATUS.PREPARATION,
        paymentStatus: AIRBRUSHING_PAYMENT_STATUS.PENDING,
        paymentMethod: null,
        dueDateRule: AIRBRUSHING_DUE_DATE_RULE.DAYS_AFTER_FINISH,
        paymentTermDays: null,
        dueDayOfMonth: null,
        dueDate: null,
        price: null,
        description: null,
        startDate: null,
        finishDate: null,
        startedAt: null,
        finishedAt: null,
        painterId: null,
        painter: null,
        receiptFiles: [],
        invoiceFiles: [],
        layouts: [],
        receiptIds: [],
        invoiceIds: [],
        layoutIds: [],
        layoutStatuses: {},
      };
      setAirbrushings((prev) => [...prev, newAirbrushing]);
    }, []);

    const removeAirbrushing = useCallback((id: string) => {
      setAirbrushings((prev) => prev.filter((airbrushing) => airbrushing.id !== id));
    }, []);

    // Clear all airbrushings
    const clearAll = useCallback(() => {
      setAirbrushings([]);
    }, []);

    const updateAirbrushing = useCallback((id: string, updates: Partial<AirbrushingItem>) => {
      setAirbrushings((prev) => {
        const updated = prev.map((airbrushing) => {
          if (airbrushing.id === id) {
            const merged = { ...airbrushing, ...updates };
            return merged;
          }
          return airbrushing;
        });
        return updated;
      });
    }, []);

    const handleLayoutsChange = useCallback(
      (airbrushingId: string, files: FileWithPreview[]) => {
        // Store files without uploading - they ride along as multipart on submit.
        updateAirbrushing(airbrushingId, {
          layouts: files,
          layoutIds: files.filter((f) => f.uploaded).map((f) => (f as any).uploadedFileId!).filter(Boolean),
        });
      },
      [updateAirbrushing],
    );

    /**
     * Status por layout, chaveado por File ID — o mesmo formato que a API espera em
     * `layoutStatuses`. Arquivos AINDA NÃO enviados também chegam aqui, mas sob o id
     * temporário do card: no submit, `airbrushingNewLayoutStatuses` os converte no array
     * `newLayoutStatuses`, alinhado por índice aos blobs, que é como o servidor casa cada
     * status com o File ID que ele acabou de criar.
     */
    const handleLayoutStatusChange = useCallback((airbrushingId: string, fileId: string, status: string) => {
      // Merge, não replace: `updateAirbrushing` só aceita um patch pronto, e aqui é
      // preciso ler o mapa anterior para não perder o status dos outros layouts.
      setAirbrushings((prev) =>
        prev.map((airbrushing) =>
          airbrushing.id === airbrushingId ? { ...airbrushing, layoutStatuses: { ...(airbrushing.layoutStatuses ?? {}), [fileId]: status } } : airbrushing,
        ),
      );
    }, []);

    // Expose methods via ref
    useImperativeHandle(
      ref,
      () => ({
        addAirbrushing,
        clearAll,
      }),
      [addAirbrushing, clearAll],
    );

    return (
      <div className="space-y-4">
        {/* Airbrushings List */}
        <div className="space-y-3">
          {airbrushings.map((airbrushing, index) => (
              <div key={airbrushing.id} className="border border-border rounded-lg p-4 space-y-4">
                {/* Cabeçalho da linha: identificação + remover. A lixeira mora aqui (e não
                    grudada num campo) para que a ordem dos campos seja idêntica à da edição. */}
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-foreground">Aerografia {index + 1}</p>
                  <Button
                    type="button"
                    onClick={() => removeAirbrushing(airbrushing.id)}
                    disabled={disabled}
                    size="icon"
                    variant="ghost"
                    className="h-9 w-9 flex-shrink-0"
                    title="Remover aerografia"
                  >
                    <IconTrash className="h-4 w-4 text-destructive" />
                  </Button>
                </div>

                {/* MESMO bloco de campos da edição — layout, ordem e regras vêm de um lugar só. */}
                <AirbrushingFields
                  value={airbrushing}
                  // As linhas vivem em estado local (não em react-hook-form), então o patch
                  // parcial cai direto no reducer da lista.
                  onChange={(patch) => updateAirbrushing(airbrushing.id, patch as Partial<AirbrushingItem>)}
                  disabled={disabled}
                  canViewFinancials={canViewFinancials}
                  showStatus={statusVisible}
                  initialPainter={airbrushing.painter ?? undefined}
                  idPrefix={`airbrushing-${airbrushing.id}`}
                  /* Layouts — same uploader as the main task layout (card look, PDF/EPS/AI
                     accepted), COM o seletor de status: um layout de aerografia carrega o
                     mesmo fluxo Rascunho/Aprovado/Reprovado do layout de tarefa, e é ele que
                     decide o que chega ao aerografista. Recibos/NFs ficam de fora daqui.
                     O seletor fica ativo já no arquivo recém-solto (ver LayoutFileUploadField).
                     Vai como SLOT para que o rótulo e a posição saiam de `AirbrushingFields` —
                     é o que mantém cadastro e edição idênticos. */
                  layoutsSlot={
                    <LayoutFileUploadField
                      onFilesChange={(files) => handleLayoutsChange(airbrushing.id, files)}
                      onStatusChange={(fileId, status) => handleLayoutStatusChange(airbrushing.id, fileId, status)}
                      showStatus
                      existingFiles={airbrushing.layouts}
                      maxFiles={20}
                      showPreview={true}
                      placeholder="Adicione layouts da aerografia"
                      variant="card"
                      disabled={disabled || airbrushing.uploading}
                    >
                      {/* Recommend files previously used as AIRBRUSHING layouts for this customer
                          (separate pool from the task-layout recommendations). */}
                      {customerId && (
                        <FileSuggestions
                          customerId={customerId}
                          fileContext="airbrushingLayouts"
                          excludeFileIds={airbrushing.layouts.map((f) => (f as any).uploadedFileId || f.id).filter(Boolean)}
                          onSelect={(newFile) => {
                            const fileWithPreview = {
                              id: newFile.id,
                              name: newFile.filename || newFile.originalName || "layout",
                              size: newFile.size || 0,
                              type: newFile.mimetype || "application/octet-stream",
                              lastModified: Date.now(),
                              uploaded: true,
                              uploadProgress: 100,
                              uploadedFileId: newFile.id,
                              thumbnailUrl: newFile.thumbnailUrl || undefined,
                            } as FileWithPreview;
                            handleLayoutsChange(airbrushing.id, [...airbrushing.layouts, fileWithPreview]);
                          }}
                          disabled={disabled || airbrushing.uploading}
                        />
                      )}
                    </LayoutFileUploadField>
                  }
                />

                {/* Error Message */}
                {airbrushing.error && (
                  <Alert variant="destructive">
                    <AlertDescription>{airbrushing.error}</AlertDescription>
                  </Alert>
                )}
              </div>
            ))}
        </div>

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={addAirbrushing}
          disabled={disabled || airbrushings.length >= 10}
          className="w-full"
        >
          <IconPlus className="h-4 w-4 mr-2" />
          Adicionar Aerografia
        </Button>
      </div>
    );
  },
);

MultiAirbrushingSelector.displayName = "MultiAirbrushingSelector";
