// user-documentation-card.tsx
// "Documentação" do colaborador — card autocontido para a página de detalhes
// do colaborador. Exibe o checklist de documentos da Admissão do usuário
// (CPF, RG, CNH, CTPS, comprovante de residência, etc.) com badge de status,
// upload multipart e visualização click-to-open via FileViewer unificado.
//
// Quando o colaborador ainda não possui processo de admissão, o primeiro
// upload o cria preguiçosamente no servidor (POST /admissions/by-user/:userId/documents).
//
// Autogateado: renderiza somente para ACCOUNTING / HUMAN_RESOURCES / ADMIN
// (mesmo @Roles dos endpoints de admissão).

import { useEffect, useRef, useState } from "react";
import { IconFileText, IconLoader2, IconUpload } from "@tabler/icons-react";

import { cn } from "@/lib/utils";
import {
  ADMISSION_DOCUMENT_STATUS,
  ADMISSION_DOCUMENT_STATUS_LABELS,
  ADMISSION_DOCUMENT_TYPE,
  ADMISSION_DOCUMENT_TYPE_LABELS,
  ADMISSION_STATUS,
  ADMISSION_STATUS_LABELS,
  SECTOR_PRIVILEGES,
} from "../../../constants";
import type { Admission, AdmissionDocument } from "../../../types/admission";
import {
  useAdmissionByUser,
  useAdmissionDocumentUpdate,
  useAdmissionDocumentUploadByUser,
} from "../../../hooks/personnel-department/use-admissions";
import { usePrivileges } from "../../../hooks/common/use-privileges";
import { getFileUrl } from "../../../utils";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Combobox } from "@/components/ui/combobox";
import { Skeleton } from "@/components/ui/skeleton";
import { FileThumbnail } from "@/components/common/file";

const DOCUMENT_STATUS_BADGE: Record<string, BadgeProps["variant"]> = {
  [ADMISSION_DOCUMENT_STATUS.PENDING]: "pending",
  [ADMISSION_DOCUMENT_STATUS.RECEIVED]: "blue",
  [ADMISSION_DOCUMENT_STATUS.SIGNED]: "completed",
  [ADMISSION_DOCUMENT_STATUS.WAIVED]: "secondary",
};

const STATUS_OPTIONS = Object.entries(ADMISSION_DOCUMENT_STATUS_LABELS).map(([value, label]) => ({ value, label }));

interface UserDocumentationCardProps {
  userId: string;
  className?: string;
  /**
   * When true, render ONLY the inner body (no outer `<Card>`, `<CardHeader>`
   * or `<CardTitle>`). The surrounding detail-page section supplies the single
   * card chrome + "Documentação" title. Default false → unchanged.
   */
  embedded?: boolean;
  /**
   * Reports how many admission documents this collaborator has so the parent can
   * hide the whole section when there are none. `null` while loading (or before
   * access is resolved), `0` when empty / not viewable. Fires in BOTH embedded
   * and standalone mode.
   */
  onCount?: (count: number | null) => void;
}

interface DocumentationRowProps {
  userId: string;
  document: AdmissionDocument;
  canEdit: boolean;
}

function DocumentationRow({ userId, document, canEdit }: DocumentationRowProps) {
  const updateMutation = useAdmissionDocumentUpdate();
  const uploadMutation = useAdmissionDocumentUploadByUser();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isBusy, setIsBusy] = useState(false);

  const typeLabel = ADMISSION_DOCUMENT_TYPE_LABELS[document.type as ADMISSION_DOCUMENT_TYPE] || document.type;

  const handleStatusChange = async (status: string | string[] | null | undefined) => {
    if (typeof status !== "string" || status === document.status) return;
    setIsBusy(true);
    try {
      await updateMutation.mutateAsync({ documentId: document.id, data: { status } });
    } catch (error) {
      // Error toast is handled by the API client
      if (process.env.NODE_ENV !== "production") {
        console.error("Error updating user document status:", error);
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
      await uploadMutation.mutateAsync({ userId, data: { type: document.type }, file });
    } catch (error) {
      // Error toast is handled by the API client
      if (process.env.NODE_ENV !== "production") {
        console.error("Error uploading user document:", error);
      }
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-3 rounded-md border border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      {/* Type + note. No "Obrigatório" badge: required only means the document
          is part of the standard checklist — HR can still legitimately waive
          (Dispensar) it. The status control below is the single source of
          truth, mirroring the admission Checklist de Documentos. */}
      <div className="min-w-0 flex-1 space-y-2">
        <span className="block text-sm font-medium truncate">{typeLabel}</span>
        {document.note && <p className="text-xs text-muted-foreground whitespace-pre-wrap break-words">{document.note}</p>}
      </div>

      {/* Controls — status combobox IS the status (no redundant badge), file
          thumbnail (click-to-open) + upload, all on a single compact row. */}
      {canEdit ? (
        // Fixed-width slots so status / preview / upload line up as columns across
        // every row (received rows have a thumbnail, pending rows don't).
        <div className="flex flex-nowrap items-center gap-2 sm:flex-shrink-0">
          <Combobox
            value={document.status}
            onValueChange={handleStatusChange}
            options={STATUS_OPTIONS}
            searchable={false}
            clearable={false}
            disabled={isBusy}
            placeholder="Status"
            triggerClassName="h-8 w-44 text-xs"
          />
          {/* Preview — reserved 48px slot so rows without a file keep the columns aligned. */}
          {document.file ? (
            <FileThumbnail file={document.file} size="sm" className="shrink-0" onClick={() => window.open(getFileUrl(document.file!), "_blank", "noopener,noreferrer")} />
          ) : (
            <div className="h-12 w-12 shrink-0" aria-hidden />
          )}
          <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileSelected} />
          <Button type="button" variant="outline" size="sm" className="w-32 shrink-0" onClick={() => fileInputRef.current?.click()} disabled={isBusy}>
            {isBusy ? <IconLoader2 className="h-4 w-4 mr-1 animate-spin" /> : <IconUpload className="h-4 w-4 mr-1" />}
            {document.fileId ? "Substituir" : "Enviar"}
          </Button>
        </div>
      ) : (
        <Badge variant={DOCUMENT_STATUS_BADGE[document.status] || "secondary"} className="text-xs whitespace-nowrap sm:flex-shrink-0">
          {ADMISSION_DOCUMENT_STATUS_LABELS[document.status] || document.status}
        </Badge>
      )}
    </div>
  );
}

export function UserDocumentationCard({ userId, className, embedded = false, onCount }: UserDocumentationCardProps) {
  const { hasAnyPrivilegeAccess } = usePrivileges();
  const canView = hasAnyPrivilegeAccess([SECTOR_PRIVILEGES.ACCOUNTING, SECTOR_PRIVILEGES.HUMAN_RESOURCES, SECTOR_PRIVILEGES.ADMIN]);

  const { data, isLoading } = useAdmissionByUser(
    userId,
    { include: { documents: { include: { file: true }, orderBy: { type: "asc" } } } },
    { enabled: canView },
  );

  const admission = (data?.data ?? null) as Admission | null;
  const documents = admission?.documents || [];

  // Surface the document count so the parent can hide the section when empty.
  useEffect(() => {
    if (!canView) {
      onCount?.(0);
      return;
    }
    onCount?.(isLoading ? null : documents.length);
  }, [canView, isLoading, documents.length, onCount]);

  // Same gate as the admission endpoints (@Roles ACCOUNTING/HR/ADMIN)
  if (!canView) return null;

  // Documentos seguem a pessoa: o card só aparece quando o colaborador realmente
  // possui documentos. Prestadores (terceirizado/PJ) e cadastros sem documentação
  // simplesmente não exibem o card.
  if (!isLoading && documents.length === 0) return null;

  const body = (
    <>
      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      ) : (
        documents.map((document) => (
          // Documents stay editable even after the admission completes —
          // expiring copies (e.g. CNH) can be replaced at any time.
          <DocumentationRow key={document.id} userId={userId} document={document} canEdit />
        ))
      )}
    </>
  );

  // Embedded: render only the inner body — the detail-page section provides the
  // single card chrome + "Documentação" title.
  if (embedded) {
    return <div className={cn("flex-1 space-y-3", className)}>{body}</div>;
  }

  return (
    <Card className={cn("shadow-sm border border-border flex flex-col", className)}>
      <CardHeader className="pb-4">
        <CardTitle className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <IconFileText className="h-5 w-5 text-muted-foreground" />
            Documentação
          </div>
          {admission && (
            <Badge variant="secondary" className="text-xs whitespace-nowrap">
              Admissão: {ADMISSION_STATUS_LABELS[admission.status as ADMISSION_STATUS] || admission.status}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 space-y-3">{body}</CardContent>
    </Card>
  );
}
