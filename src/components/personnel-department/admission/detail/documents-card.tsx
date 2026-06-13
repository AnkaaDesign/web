import { useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { IconFileText, IconUpload, IconLoader2, IconPlus } from "@tabler/icons-react";
import { cn } from "@/lib/utils";
import {
  ADMISSION_DOCUMENT_STATUS,
  ADMISSION_DOCUMENT_STATUS_LABELS,
  ADMISSION_DOCUMENT_TYPE,
  ADMISSION_DOCUMENT_TYPE_LABELS,
} from "../../../../constants";
import type { Admission, AdmissionDocument } from "../../../../types/admission";
import { useAdmissionDocumentUpdate, useAdmissionDocumentUpload } from "../../../../hooks/personnel-department/use-admissions";
import { Badge } from "@/components/ui/badge";
import type { BadgeProps } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Combobox } from "@/components/ui/combobox";
import { FileItem } from "@/components/common/file";
import { getDocumentProgress } from "../utils";

interface DocumentsCardProps {
  admission: Admission;
  className?: string;
}

const DOCUMENT_STATUS_BADGE: Record<string, BadgeProps["variant"]> = {
  [ADMISSION_DOCUMENT_STATUS.PENDING]: "pending",
  [ADMISSION_DOCUMENT_STATUS.RECEIVED]: "blue",
  [ADMISSION_DOCUMENT_STATUS.SIGNED]: "completed",
  [ADMISSION_DOCUMENT_STATUS.WAIVED]: "secondary",
};

const STATUS_OPTIONS = Object.entries(ADMISSION_DOCUMENT_STATUS_LABELS).map(([value, label]) => ({ value, label }));

// Optional documents NOT in the default checklist (mirrors the server's
// OPTIONAL_DOCUMENT_TYPES): they can be added on demand. CNH and Acordo de
// Banco de Horas are single-row (hidden once present); Outro allows many.
const OPTIONAL_DOCUMENT_TYPES: ADMISSION_DOCUMENT_TYPE[] = [
  ADMISSION_DOCUMENT_TYPE.DRIVER_LICENSE,
  ADMISSION_DOCUMENT_TYPE.TIME_BANK_AGREEMENT,
  ADMISSION_DOCUMENT_TYPE.OTHER,
];

/**
 * "Adicionar documento" — adds an optional document (CNH etc.) to the
 * checklist by uploading its file (the server creates the row, marked
 * required=false, on POST /admissions/:id/documents).
 */
function AddOptionalDocument({ admissionId, documents }: { admissionId: string; documents: AdmissionDocument[] }) {
  const uploadMutation = useAdmissionDocumentUpload();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [type, setType] = useState<string | null>(null);

  const existingTypes = new Set(documents.map((doc) => doc.type));
  const options = OPTIONAL_DOCUMENT_TYPES.filter((docType) => docType === ADMISSION_DOCUMENT_TYPE.OTHER || !existingTypes.has(docType)).map((docType) => ({
    value: docType,
    label: ADMISSION_DOCUMENT_TYPE_LABELS[docType] || docType,
  }));

  if (options.length === 0) return null;

  const handleFileSelected = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !type) return;
    try {
      await uploadMutation.mutateAsync({ id: admissionId, data: { type: type as ADMISSION_DOCUMENT_TYPE }, file });
      setType(null);
    } catch (error) {
      // Error is handled by the API client with detailed message
      if (process.env.NODE_ENV !== "production") {
        console.error("Error adding optional admission document:", error);
      }
    }
  };

  return (
    <div className="flex flex-col gap-3 rounded-md border border-dashed border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <IconPlus className="h-4 w-4" />
        Adicionar documento opcional (CNH etc.)
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Combobox
          value={type ?? undefined}
          onValueChange={(value) => setType(typeof value === "string" ? value : null)}
          options={options}
          searchable={false}
          clearable={false}
          disabled={uploadMutation.isPending}
          placeholder="Tipo de documento"
          triggerClassName="h-8 w-52 text-xs"
        />
        <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileSelected} />
        <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={!type || uploadMutation.isPending}>
          {uploadMutation.isPending ? <IconLoader2 className="h-4 w-4 mr-1 animate-spin" /> : <IconUpload className="h-4 w-4 mr-1" />}
          Anexar arquivo
        </Button>
      </div>
    </div>
  );
}

interface DocumentRowProps {
  admissionId: string;
  document: AdmissionDocument;
}

function DocumentRow({ admissionId, document }: DocumentRowProps) {
  const updateMutation = useAdmissionDocumentUpdate();
  const uploadMutation = useAdmissionDocumentUpload();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isBusy, setIsBusy] = useState(false);

  const typeLabel = ADMISSION_DOCUMENT_TYPE_LABELS[document.type as ADMISSION_DOCUMENT_TYPE] || document.type;

  const handleStatusChange = async (status: string | string[] | null | undefined) => {
    if (typeof status !== "string" || status === document.status) return;
    setIsBusy(true);
    try {
      await updateMutation.mutateAsync({ documentId: document.id, data: { status } });
    } catch (error) {
      // Error is handled by the API client with detailed message
      if (process.env.NODE_ENV !== "production") {
        console.error("Error updating admission document status:", error);
      }
    } finally {
      setIsBusy(false);
    }
  };

  const handleRequiredChange = async (required: boolean | undefined) => {
    if (typeof required !== "boolean" || required === document.required) return;
    setIsBusy(true);
    try {
      await updateMutation.mutateAsync({ documentId: document.id, data: { required } });
    } catch (error) {
      // Error is handled by the API client with detailed message
      if (process.env.NODE_ENV !== "production") {
        console.error("Error updating admission document required flag:", error);
      }
    } finally {
      setIsBusy(false);
    }
  };

  const handleFileSelected = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    // Reset so the same file can be re-selected later
    event.target.value = "";
    if (!file) return;
    setIsBusy(true);
    try {
      await uploadMutation.mutateAsync({ id: admissionId, data: { type: document.type }, file });
    } catch (error) {
      // Error is handled by the API client with detailed message
      if (process.env.NODE_ENV !== "production") {
        console.error("Error uploading admission document:", error);
      }
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-3 rounded-md border border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      {/* Type + file */}
      <div className="min-w-0 flex-1 space-y-2">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium truncate">{typeLabel}</span>
          {document.required && (
            <Badge variant="outline" className="text-[10px] uppercase">
              Obrigatório
            </Badge>
          )}
        </div>
        {document.file ? (
          <FileItem file={document.file} viewMode="list" showActions={false} className="max-w-md" />
        ) : (
          <p className="text-xs text-muted-foreground">Nenhum arquivo anexado</p>
        )}
        {document.note && <p className="text-xs text-muted-foreground whitespace-pre-wrap break-words">{document.note}</p>}
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3 sm:flex-shrink-0">
        {/* Status */}
        <div className="flex items-center gap-2">
          <Badge variant={DOCUMENT_STATUS_BADGE[document.status] || "secondary"} className="text-xs whitespace-nowrap">
            {ADMISSION_DOCUMENT_STATUS_LABELS[document.status] || document.status}
          </Badge>
          <Combobox
            value={document.status}
            onValueChange={handleStatusChange}
            options={STATUS_OPTIONS}
            searchable={false}
            clearable={false}
            disabled={isBusy}
            placeholder="Status"
            triggerClassName="h-8 w-32 text-xs"
          />
        </div>

        {/* Required switch */}
        <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
          Obrigatório
          <Switch checked={document.required} onCheckedChange={handleRequiredChange} disabled={isBusy} />
        </label>

        {/* Upload */}
        <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileSelected} />
        <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={isBusy}>
          {isBusy ? <IconLoader2 className="h-4 w-4 mr-1 animate-spin" /> : <IconUpload className="h-4 w-4 mr-1" />}
          {document.fileId ? "Substituir" : "Enviar"}
        </Button>
      </div>
    </div>
  );
}

export function DocumentsCard({ admission, className }: DocumentsCardProps) {
  const documents = admission.documents || [];
  const { done, total } = getDocumentProgress(documents);

  return (
    <Card className={cn("shadow-sm border border-border flex flex-col", className)}>
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <IconFileText className="h-5 w-5 text-muted-foreground" />
            Checklist de Documentos
          </div>
          {total > 0 && (
            <span className={cn("text-sm font-normal", done === total ? "text-green-700 dark:text-green-500" : "text-muted-foreground")}>
              {done}/{total} documentos recebidos
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1">
        {documents.length === 0 ? (
          <div className="space-y-3">
            <div className="py-8 text-center text-sm text-muted-foreground">Nenhum documento no checklist desta admissão.</div>
            <AddOptionalDocument admissionId={admission.id} documents={documents} />
          </div>
        ) : (
          <div className="space-y-3">
            {documents.map((document) => (
              <DocumentRow key={document.id} admissionId={admission.id} document={document} />
            ))}
            <AddOptionalDocument admissionId={admission.id} documents={documents} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
