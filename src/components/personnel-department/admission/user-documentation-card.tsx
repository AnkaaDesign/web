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

import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { IconExternalLink, IconFileText, IconLoader2, IconPlus, IconUpload } from "@tabler/icons-react";

import { cn } from "@/lib/utils";
import {
  ADMISSION_DOCUMENT_STATUS,
  ADMISSION_DOCUMENT_STATUS_LABELS,
  ADMISSION_DOCUMENT_TYPE,
  ADMISSION_DOCUMENT_TYPE_LABELS,
  ADMISSION_STATUS,
  ADMISSION_STATUS_LABELS,
  SECTOR_PRIVILEGES,
  routes,
} from "../../../constants";
import type { Admission, AdmissionDocument } from "../../../types/admission";
import {
  useAdmissionByUser,
  useAdmissionDocumentUpdate,
  useAdmissionDocumentUploadByUser,
} from "../../../hooks/personnel-department/use-admissions";
import { usePrivileges } from "../../../hooks/common/use-privileges";
import { getFileUrl } from "../../../utils";
import { getDocumentProgress } from "./utils";

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

const ALL_TYPE_OPTIONS = Object.values(ADMISSION_DOCUMENT_TYPE).map((value) => ({
  value,
  label: ADMISSION_DOCUMENT_TYPE_LABELS[value] || value,
}));

interface UserDocumentationCardProps {
  userId: string;
  className?: string;
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
          {document.file && (
            <FileThumbnail file={document.file} size="sm" onClick={() => window.open(getFileUrl(document.file!), "_blank", "noopener,noreferrer")} />
          )}
          <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileSelected} />
          <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={isBusy}>
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

/** Seletor de tipo + upload para documentos ainda fora do checklist (ex.: CNH). */
function AddDocumentRow({ userId, existingTypes, emptyChecklist }: { userId: string; existingTypes: Set<string>; emptyChecklist: boolean }) {
  const uploadMutation = useAdmissionDocumentUploadByUser();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [type, setType] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  // OTHER allows multiple documents; every other type appears once.
  const options = ALL_TYPE_OPTIONS.filter((option) => option.value === ADMISSION_DOCUMENT_TYPE.OTHER || !existingTypes.has(option.value));

  if (options.length === 0) return null;

  const handleFileSelected = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !type) return;
    setIsBusy(true);
    try {
      await uploadMutation.mutateAsync({ userId, data: { type }, file });
      setType(null);
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
    <div className="rounded-md border border-border bg-muted/30 px-4 py-3">
      <div className="mb-3 flex items-center gap-2">
        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-muted text-muted-foreground">
          <IconPlus className="h-4 w-4" />
        </div>
        <span className="text-sm font-medium">{emptyChecklist ? "Enviar documento" : "Adicionar outro documento"}</span>
      </div>
      {/* Tipo de documento + Enviar on a SINGLE row, vertically aligned.
          The combobox grows (flex-1) and the button sits beside it. */}
      <div className="flex items-center gap-2">
        <Combobox
          value={type ?? undefined}
          onValueChange={(value) => setType(typeof value === "string" ? value : null)}
          options={options}
          searchable
          clearable={false}
          disabled={isBusy}
          placeholder="Tipo de documento"
          triggerClassName="h-9 flex-1 text-xs"
        />
        <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileSelected} />
        <Button type="button" variant="outline" size="sm" className="h-9 flex-shrink-0" onClick={() => fileInputRef.current?.click()} disabled={isBusy || !type}>
          {isBusy ? <IconLoader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <IconUpload className="h-4 w-4 mr-1.5" />}
          Enviar
        </Button>
      </div>
    </div>
  );
}

export function UserDocumentationCard({ userId, className }: UserDocumentationCardProps) {
  const { hasAnyPrivilegeAccess } = usePrivileges();
  const canView = hasAnyPrivilegeAccess([SECTOR_PRIVILEGES.ACCOUNTING, SECTOR_PRIVILEGES.HUMAN_RESOURCES, SECTOR_PRIVILEGES.ADMIN]);

  const { data, isLoading } = useAdmissionByUser(
    userId,
    { include: { documents: { include: { file: true }, orderBy: { type: "asc" } } } },
    { enabled: canView },
  );

  // Same gate as the admission endpoints (@Roles ACCOUNTING/HR/ADMIN)
  if (!canView) return null;

  const admission = (data?.data ?? null) as Admission | null;
  const documents = admission?.documents || [];
  const { done, total } = getDocumentProgress(documents);
  const existingTypes = new Set(documents.map((document) => document.type as string));

  return (
    <Card className={cn("shadow-sm border border-border flex flex-col", className)}>
      <CardHeader className="pb-4">
        <CardTitle className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <IconFileText className="h-5 w-5 text-muted-foreground" />
            Documentação
          </div>
          <div className="flex items-center gap-3">
            {admission && (
              <Badge variant="secondary" className="text-xs whitespace-nowrap">
                Admissão: {ADMISSION_STATUS_LABELS[admission.status as ADMISSION_STATUS] || admission.status}
              </Badge>
            )}
            {total > 0 && (
              <span className={cn("text-sm font-normal", done === total ? "text-green-700 dark:text-green-500" : "text-muted-foreground")}>
                {done}/{total} documentos recebidos
              </span>
            )}
            {admission && (
              <Button asChild variant="link" size="sm" className="h-auto p-0">
                <Link to={routes.personnelDepartment.admissions.details(admission.id)}>
                  Ver admissão
                  <IconExternalLink className="h-3.5 w-3.5 ml-1" />
                </Link>
              </Button>
            )}
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 space-y-3">
        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        ) : (
          <>
            {!admission && (
              <div className="flex flex-col items-center justify-center rounded-lg border border-border bg-muted/30 px-6 py-8 text-center">
                <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
                  <IconFileText className="h-6 w-6" />
                </div>
                <p className="text-sm font-medium">Nenhum documento enviado</p>
                <p className="mt-1 max-w-sm text-xs text-muted-foreground">
                  Ao enviar o primeiro documento, o processo de admissão é criado automaticamente com o checklist padrão.
                </p>
              </div>
            )}
            {documents.map((document) => (
              // Documents stay editable even after the admission completes —
              // expiring copies (e.g. CNH) can be replaced at any time.
              <DocumentationRow key={document.id} userId={userId} document={document} canEdit />
            ))}
            {/* Only the bootstrap upload (cria a admissão no primeiro envio) is
                kept; once o checklist existe, a linha "Adicionar outro documento"
                é omitida para manter o card enxuto. */}
            {documents.length === 0 && <AddDocumentRow userId={userId} existingTypes={existingTypes} emptyChecklist />}
          </>
        )}
      </CardContent>
    </Card>
  );
}
