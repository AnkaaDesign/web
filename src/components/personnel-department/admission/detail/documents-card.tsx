import { useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { IconFileText, IconUpload, IconLoader2, IconWriting, IconExternalLink, IconShieldCheck } from "@tabler/icons-react";
import { cn } from "@/lib/utils";
import {
  ADMISSION_DOCUMENT_STATUS,
  ADMISSION_DOCUMENT_STATUS_LABELS,
  ADMISSION_DOCUMENT_TYPE,
  ADMISSION_DOCUMENT_TYPE_LABELS,
} from "../../../../constants";
import type { Admission, AdmissionDocument } from "../../../../types/admission";
import { formatDateTime, getFileUrl } from "../../../../utils";
import { useAdmissionDocumentUpdate, useAdmissionDocumentUpload } from "../../../../hooks/personnel-department/use-admissions";
import { Button } from "@/components/ui/button";
import { Combobox } from "@/components/ui/combobox";
import { FileThumbnail } from "@/components/common/file";
import { getDocumentProgress, getAdmissionChecklistDocuments } from "../utils";

interface DocumentsCardProps {
  admission: Admission;
  className?: string;
}

const STATUS_OPTIONS = Object.entries(ADMISSION_DOCUMENT_STATUS_LABELS).map(([value, label]) => ({ value, label }));

// Cores do "badge" do status (gatilho do Combobox), no mesmo padrão dos status
// badge-dropdown da página de detalhe da tarefa (ordem de serviço).
const getDocStatusTriggerClass = (status: string): string => {
  switch (status) {
    case ADMISSION_DOCUMENT_STATUS.RECEIVED:
      return "bg-green-700 text-white hover:bg-green-800 border-green-800";
    case ADMISSION_DOCUMENT_STATUS.SIGNED:
      return "bg-blue-700 text-white hover:bg-blue-800 border-blue-800";
    case ADMISSION_DOCUMENT_STATUS.WAIVED:
      return "bg-neutral-500 text-white hover:bg-neutral-600 border-neutral-600";
    case ADMISSION_DOCUMENT_STATUS.PENDING:
    default:
      return "bg-amber-600 text-white hover:bg-amber-700 border-amber-700";
  }
};

// The signature-evidence banner is shown ONLY when the document carries REAL
// in-app signature data (signedAt / signedFile) — e.g. the Termo LGPD signed via
// the mobile/biometric flow. Manually picking the "Assinado" status from the
// dropdown does NOT carry evidence and must not render the banner (the status
// badge alone already reflects it), otherwise the row breaks visually.
function isDocumentSigned(document: AdmissionDocument): boolean {
  return !!document.signedAt || !!document.signedFileId;
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
    <div className="flex flex-col gap-3 rounded-lg bg-muted/50 px-4 py-2.5 sm:flex-row sm:items-center sm:justify-between">
      {/* Type + file */}
      <div className="min-w-0 flex-1 space-y-2">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-muted-foreground truncate">{typeLabel}</span>
        </div>
        {document.note && <p className="text-xs text-muted-foreground whitespace-pre-wrap break-words">{document.note}</p>}

        {/* Assinatura eletrônica in-app (mobile/biometria). Apenas leitura — a
            assinatura é feita no aplicativo, aqui só exibimos o status + visualização. */}
        {isDocumentSigned(document) && (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md border border-green-600/30 bg-green-600/5 px-3 py-2 text-xs">
            <span className="flex items-center gap-1.5 font-medium text-green-700 dark:text-green-500">
              <IconWriting className="h-4 w-4" />
              Assinado
              {document.signedAt ? ` em ${formatDateTime(new Date(document.signedAt))}` : ""}
              {document.signedBy?.name ? ` por ${document.signedBy.name}` : ""}
            </span>
            {document.padesSealed && (
              <span className="flex items-center gap-1 text-muted-foreground" title="Selo PAdES (ICP-Brasil) aplicado">
                <IconShieldCheck className="h-3.5 w-3.5" />
                PAdES
              </span>
            )}
            {document.signedFile && (
              <a
                href={getFileUrl(document.signedFile)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-green-700 hover:text-green-800 dark:text-green-500 dark:hover:text-green-400 hover:underline"
              >
                Ver documento assinado
                <IconExternalLink className="h-3.5 w-3.5" />
              </a>
            )}
          </div>
        )}
      </div>

      {/* Controls — status combobox + file preview + upload on a single row. */}
      <div className="flex flex-nowrap items-center gap-2 sm:flex-shrink-0">
        {/* Status — the combobox IS the status control (no redundant badge). */}
        <Combobox
          value={document.status}
          onValueChange={handleStatusChange}
          options={STATUS_OPTIONS}
          searchable={false}
          clearable={false}
          disabled={isBusy}
          placeholder="Status"
          triggerClassName={cn("h-8 w-40 text-xs font-medium", getDocStatusTriggerClass(document.status))}
        />

        {/* File preview (when an arquivo is anexado) — clica para abrir. */}
        {document.file && (
          <FileThumbnail
            file={document.file}
            size="sm"
            onClick={() => window.open(getFileUrl(document.file!), "_blank", "noopener,noreferrer")}
          />
        )}

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
  // Only the admission checklist types are shown (CPF, RG, CNH, CTPS, comprovante,
  // certidão, foto). Legacy/unrelated docs (LGPD, contrato, vale-transporte,
  // reservista, título de eleitor, PIS, ASO…) are hidden — they belong to the
  // collaborator, not the admission.
  const documents = getAdmissionChecklistDocuments(admission.documents);
  const { done, total } = getDocumentProgress(admission.documents);

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
          <div className="py-8 text-center text-sm text-muted-foreground">Nenhum documento no checklist desta admissão.</div>
        ) : (
          <div className="space-y-2">
            {documents.map((document) => (
              <DocumentRow key={document.id} admissionId={admission.id} document={document} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
