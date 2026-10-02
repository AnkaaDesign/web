/**
 * O PAINEL DA ARTE DE UM IMPLEMENTO — um só, para a tarefa, o cartão do veículo
 * no orçamento e o faturamento.
 *
 * A arte é do implemento (Modelo C, P12) e anda sozinha:
 *
 *   rascunho ──enviar──▶ aguardando o cliente ──portal / em nome──▶ aprovada
 *        └──────────── aprovar em nome / reprovar ─────────────┘        │
 *   reprovada (ou aprovada que mudou) ──versão nova──▶ rascunho (a anterior vira substituída)
 *
 * Cada botão é um ATO com rota própria (`/implements/:id/layouts/*`), que vale
 * na hora — não passa pelo Salvar do formulário em volta. Aprovar em nome do
 * cliente e reprovar pedem o texto que fica na trilha.
 *
 * O que cada papel vê vem da API: fora dos papéis de arte, só a aprovada.
 */
import { useRef, useState } from "react";
import {
  IconCheck,
  IconHistory,
  IconPhoto,
  IconRefresh,
  IconSend,
  IconTrash,
  IconUpload,
  IconX,
} from "@tabler/icons-react";

import { FilePreviewModal, FileThumbnail } from "@/components/common/file";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LAYOUT_APPROVAL_SOURCE_LABELS, LAYOUT_STATUS_LABELS_FROM_CONTRACT } from "@/constants/budget-contract";
import { LAYOUT_STATUS } from "@/constants/enums";
import { useAuth } from "@/contexts/auth-context";
import {
  useApproveImplementArtOnBehalf,
  useDeleteImplementArt,
  useImplementArt,
  useNewImplementArtVersion,
  useReproveImplementArt,
  useSendImplementArt,
  useUploadImplementArt,
} from "@/hooks/production/use-implement-art";
import { cn } from "@/lib/utils";
import type { Layout } from "@/types/layout";
import { formatDateTime } from "@/utils/date";
import { canDecideImplementArt, canEditImplementArt } from "@/utils/permissions/implement-art-permissions";
import { ArtNoteDialog, type ArtNoteDialogConfig } from "./art-note-dialog";

const STATUS_VARIANT: Record<LAYOUT_STATUS, string> = {
  [LAYOUT_STATUS.DRAFT]: "secondary",
  [LAYOUT_STATUS.PENDING_APPROVAL]: "teal",
  [LAYOUT_STATUS.APPROVED]: "completed",
  [LAYOUT_STATUS.REPROVED]: "cancelled",
  [LAYOUT_STATUS.SUPERSEDED]: "outline",
};

const APPROVE_DIALOG: ArtNoteDialogConfig = {
  title: "Aprovar a arte em nome do cliente",
  description:
    'Escreva como o cliente aprovou — por onde, quem e quando (ex.: "aprovada por WhatsApp em 02/10, Fulano, Marketing"). Fica na trilha da arte.',
  placeholder: "Como o cliente aprovou",
  confirm: "Aprovar arte",
};

const REPROVE_DIALOG: ArtNoteDialogConfig = {
  title: "Reprovar a arte",
  description: "A arte reprovada só volta por versão nova. Diga o motivo — ele orienta a próxima versão.",
  placeholder: "Motivo da reprovação",
  confirm: "Reprovar",
  destructive: true,
};

const IMAGE_ACCEPT = "image/*";

type PendingDecision = { kind: "approve" | "reprove"; layoutId: string } | null;

export interface ImplementArtPanelProps {
  implementId: string | null | undefined;
  /** Como o operador reconhece o veículo ("Série 39088 · ABC1D23"). Ausente no detalhe de uma tarefa só. */
  vehicleLabel?: string;
  /** Só mostra (sem atos) — ex.: faturamento já aprovado. */
  readOnly?: boolean;
  className?: string;
}

export function ImplementArtPanel({ implementId, vehicleLabel, readOnly, className }: ImplementArtPanelProps) {
  const { user } = useAuth();
  const canEdit = !readOnly && canEditImplementArt(user as any);
  const canDecide = !readOnly && canDecideImplementArt(user as any);

  const { data: layouts = [], isLoading } = useImplementArt(implementId);
  const upload = useUploadImplementArt();
  const send = useSendImplementArt();
  const approve = useApproveImplementArtOnBehalf();
  const reprove = useReproveImplementArt();
  const newVersion = useNewImplementArtVersion();
  const remove = useDeleteImplementArt();
  const busy =
    upload.isPending || send.isPending || approve.isPending || reprove.isPending || newVersion.isPending || remove.isPending;

  const [decision, setDecision] = useState<PendingDecision>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [preview, setPreview] = useState<{ files: NonNullable<Layout["file"]>[]; index: number } | null>(null);
  const uploadInput = useRef<HTMLInputElement>(null);
  const versionInput = useRef<HTMLInputElement>(null);
  const versionTarget = useRef<string | null>(null);

  if (!implementId) {
    return (
      <div className={cn("rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground", className)}>
        {vehicleLabel ? `${vehicleLabel}: ` : ""}sem implemento cadastrado. Cadastre o implemento do veículo para subir a
        arte.
      </div>
    );
  }

  const live = (layouts as Layout[]).filter((layout) => layout.status !== LAYOUT_STATUS.SUPERSEDED);
  const superseded = (layouts as Layout[]).filter((layout) => layout.status === LAYOUT_STATUS.SUPERSEDED);
  const shown = showHistory ? (layouts as Layout[]) : live;
  // A versão nova parte da arte que não tem sucessora; a API recusa a segunda.
  const hasSuccessor = new Set(
    (layouts as Layout[]).map((layout) => layout.supersedesId).filter((id): id is string => !!id),
  );

  const onUpload = (files: FileList | null) => {
    const list = Array.from(files ?? []);
    if (list.length === 0) return;
    void upload.mutateAsync({ implementId, files: list }).catch(() => undefined);
  };

  const onNewVersion = (files: FileList | null) => {
    const file = files?.[0];
    const layoutId = versionTarget.current;
    versionTarget.current = null;
    if (!file || !layoutId) return;
    void newVersion.mutateAsync({ implementId, layoutId, file }).catch(() => undefined);
  };

  const confirmDecision = (note: string) => {
    if (!decision) return;
    const args = { implementId, layoutId: decision.layoutId, note };
    const act = decision.kind === "approve" ? approve.mutateAsync(args) : reprove.mutateAsync(args);
    void act.then(() => setDecision(null)).catch(() => undefined);
  };

  const openPreview = (layout: Layout) => {
    const files = shown.map((item) => item.file).filter((file): file is NonNullable<Layout["file"]> => !!file);
    const index = files.findIndex((file) => file.id === layout.file?.id);
    if (index >= 0) setPreview({ files, index });
  };

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold">Arte do implemento</p>
          {vehicleLabel && <p className="truncate text-sm text-muted-foreground">{vehicleLabel}</p>}
        </div>
        <div className="flex flex-wrap gap-2">
          {superseded.length > 0 && (
            <Button type="button" variant="ghost" size="sm" className="gap-1.5" onClick={() => setShowHistory((v) => !v)}>
              <IconHistory className="h-4 w-4" />
              {showHistory ? "Esconder versões anteriores" : `Versões anteriores (${superseded.length})`}
            </Button>
          )}
          {canEdit && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1.5"
              disabled={busy}
              onClick={() => uploadInput.current?.click()}
            >
              <IconUpload className="h-4 w-4" />
              Subir arte
            </Button>
          )}
        </div>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando a arte…</p>
      ) : shown.length === 0 ? (
        <div className="flex items-center gap-3 rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
          <IconPhoto className="h-5 w-5 shrink-0" />
          {canEdit
            ? "Sem arte neste implemento. Suba a imagem: ela nasce como rascunho e vai ao cliente quando você enviar."
            : "Sem arte aprovada neste implemento."}
        </div>
      ) : (
        <ul className="divide-y divide-border rounded-lg border border-border">
          {shown.map((layout) => {
            const status = layout.status as LAYOUT_STATUS;
            const isDraft = status === LAYOUT_STATUS.DRAFT;
            const isPending = status === LAYOUT_STATUS.PENDING_APPROVAL;
            const canVersion =
              (status === LAYOUT_STATUS.REPROVED || status === LAYOUT_STATUS.APPROVED) && !hasSuccessor.has(layout.id);
            return (
              <li key={layout.id} className="flex flex-col gap-3 p-3 sm:flex-row sm:items-start">
                {layout.file ? (
                  <FileThumbnail
                    file={layout.file}
                    size="sm"
                    onClick={() => openPreview(layout)}
                    className="shrink-0 cursor-pointer"
                  />
                ) : (
                  <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded border border-dashed border-border text-muted-foreground">
                    <IconPhoto className="h-5 w-5" />
                  </div>
                )}

                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={STATUS_VARIANT[status] as any}>{LAYOUT_STATUS_LABELS_FROM_CONTRACT[status] ?? status}</Badge>
                    {(layout.version ?? 1) > 1 && <span className="text-sm text-muted-foreground">versão {layout.version}</span>}
                  </div>
                  <ArtTrail layout={layout} />
                </div>

                {(canEdit || canDecide) && status !== LAYOUT_STATUS.SUPERSEDED && (
                  <div className="flex flex-wrap gap-2 sm:justify-end">
                    {isDraft && canEdit && (
                      <Button
                        type="button"
                        size="sm"
                        className="gap-1.5"
                        disabled={busy}
                        onClick={() => void send.mutateAsync({ implementId, layoutId: layout.id }).catch(() => undefined)}
                      >
                        <IconSend className="h-4 w-4" />
                        Enviar ao cliente
                      </Button>
                    )}
                    {(isDraft || isPending) && canDecide && (
                      <>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="gap-1.5"
                          disabled={busy}
                          onClick={() => setDecision({ kind: "approve", layoutId: layout.id })}
                        >
                          <IconCheck className="h-4 w-4" />
                          Aprovar em nome do cliente
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="gap-1.5"
                          disabled={busy}
                          onClick={() => setDecision({ kind: "reprove", layoutId: layout.id })}
                        >
                          <IconX className="h-4 w-4" />
                          Reprovar
                        </Button>
                      </>
                    )}
                    {canVersion && canEdit && (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="gap-1.5"
                        disabled={busy}
                        onClick={() => {
                          versionTarget.current = layout.id;
                          versionInput.current?.click();
                        }}
                      >
                        <IconRefresh className="h-4 w-4" />
                        Versão nova
                      </Button>
                    )}
                    {isDraft && canEdit && (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="gap-1.5"
                        disabled={busy}
                        onClick={() => void remove.mutateAsync({ implementId, layoutId: layout.id }).catch(() => undefined)}
                      >
                        <IconTrash className="h-4 w-4" />
                        Excluir
                      </Button>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <input
        ref={uploadInput}
        type="file"
        accept={IMAGE_ACCEPT}
        multiple
        className="hidden"
        onChange={(event) => {
          onUpload(event.target.files);
          event.target.value = "";
        }}
      />
      <input
        ref={versionInput}
        type="file"
        accept={IMAGE_ACCEPT}
        className="hidden"
        onChange={(event) => {
          onNewVersion(event.target.files);
          event.target.value = "";
        }}
      />

      <ArtNoteDialog
        config={decision ? (decision.kind === "approve" ? APPROVE_DIALOG : REPROVE_DIALOG) : null}
        busy={approve.isPending || reprove.isPending}
        onCancel={() => setDecision(null)}
        onConfirm={confirmDecision}
      />

      {preview && (
        <FilePreviewModal
          files={preview.files as any}
          initialFileIndex={preview.index}
          open
          onOpenChange={(open) => !open && setPreview(null)}
        />
      )}
    </div>
  );
}

/** A trilha curta da arte: quando foi ao cliente, quem decidiu, como e por quê. */
function ArtTrail({ layout }: { layout: Layout }) {
  const lines: string[] = [];
  if (layout.sentAt) lines.push(`Enviada ao cliente em ${formatDateTime(layout.sentAt)}`);
  if (layout.decidedAt) {
    const source = layout.approvalSource ? LAYOUT_APPROVAL_SOURCE_LABELS[layout.approvalSource] : null;
    const verb =
      layout.status === LAYOUT_STATUS.REPROVED
        ? "Reprovada"
        : layout.status === LAYOUT_STATUS.APPROVED
          ? "Aprovada"
          : "Decidida";
    lines.push(`${verb} em ${formatDateTime(layout.decidedAt)}${source ? ` · ${source}` : ""}`);
  }
  if (lines.length === 0 && !layout.decisionNote) return null;
  return (
    <div className="space-y-0.5 text-sm text-muted-foreground">
      {lines.map((line) => (
        <p key={line}>{line}</p>
      ))}
      {layout.decisionNote && <p className="italic">"{layout.decisionNote}"</p>}
    </div>
  );
}
