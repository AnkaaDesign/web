// web/src/components/cliente/veiculo/veiculo-arte-card.tsx
//
// A ARTE DO IMPLEMENTO, COMO O CLIENTE A DECIDE.
//
// A arte é do IMPLEMENTO (cada veículo carrega a sua) e o servidor a projeta em
// `veiculo.artworks`: as que esperam a decisão do cliente, as aprovadas (com quem
// e quando) e as reprovadas (com o motivo), na ordem das versões. Rascunho e
// versão substituída nunca chegam aqui — são conversa interna da Ankaa.
//
// ⛔ QUEM PODE DECIDIR É O SERVIDOR (`canDecide`: pendente ∧ `APPROVE_ARTWORK`
// ∧ escopo comercial). A tela não recalcula: sem `canDecide` não há botão — o
// Compras do cliente vê a arte e não a aprova (DD5).
//
// ⚠️ REPROVAR EXIGE MOTIVO (≥ 3 caracteres). Reprovar sem dizer o quê devolve à
// Ankaa uma arte para refazer sem nada a corrigir.
import { useState } from "react";
import { IconCheck, IconExternalLink, IconPalette, IconX } from "@tabler/icons-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  usePortalApproveArtwork,
  usePortalReproveArtwork,
  type PortalArtwork,
} from "@/api-client/portal";
import { cn } from "@/lib/utils";
import { formatDate } from "@/utils";
import { PortalCard } from "../portal-detail";
import { PORTAL_DIALOG_FOOTER, PORTAL_SHEET_ON_MOBILE } from "../portal-dialog";
import { portalFileUrl, portalThumbnailUrl } from "./portal-file-url";

const STATUS_VARIANT: Record<PortalArtwork["status"], "pending" | "approved" | "rejected"> = {
  PENDING_APPROVAL: "pending",
  APPROVED: "approved",
  REPROVED: "rejected",
};

const STATUS_FALLBACK: Record<PortalArtwork["status"], string> = {
  PENDING_APPROVAL: "Aguardando sua aprovação",
  APPROVED: "Aprovada",
  REPROVED: "Reprovada",
};

export const MOTIVO_MINIMO = 3;

function ArteItem({
  taskId,
  arte,
  onReprove,
}: {
  taskId: string;
  arte: PortalArtwork;
  onReprove: (arte: PortalArtwork) => void;
}) {
  const approve = usePortalApproveArtwork();
  const url = portalFileUrl(arte.file);
  const thumb = portalThumbnailUrl(arte.file);
  const ehImagem = (arte.file?.mimetype ?? "").startsWith("image/") || !!arte.file?.thumbnailUrl;

  return (
    <li className="space-y-3 rounded-lg bg-muted/50 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium">
          {arte.version ? `Versão ${arte.version}` : "Arte"}
        </p>
        <Badge variant={STATUS_VARIANT[arte.status]}>
          {arte.statusLabel ?? STATUS_FALLBACK[arte.status]}
        </Badge>
      </div>

      {url ? (
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          className="block overflow-hidden rounded-md border border-border bg-background"
          aria-label="Abrir a arte em tamanho real"
        >
          {ehImagem ? (
            <img
              src={thumb}
              alt={arte.file?.originalName ?? "Arte do implemento"}
              loading="lazy"
              className="max-h-80 w-full object-contain"
            />
          ) : (
            <span className="flex min-h-11 items-center gap-2 px-3 py-2 text-sm">
              <IconExternalLink className="h-4 w-4 shrink-0" />
              <span className="truncate">{arte.file?.originalName ?? "Abrir o arquivo"}</span>
            </span>
          )}
        </a>
      ) : null}

      {arte.decidedAt ? (
        <p className="text-sm text-muted-foreground">
          {arte.status === "APPROVED" ? "Aprovada" : "Reprovada"}
          {arte.decidedBy?.name ? ` por ${arte.decidedBy.name}` : ""} em {formatDate(arte.decidedAt)}
          {arte.sourceLabel ? ` · ${arte.sourceLabel}` : ""}
        </p>
      ) : arte.sentAt ? (
        <p className="text-sm text-muted-foreground">Enviada em {formatDate(arte.sentAt)}</p>
      ) : null}

      {arte.note ? <p className="whitespace-pre-line text-sm">{arte.note}</p> : null}

      {arte.canDecide ? (
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button
            type="button"
            className="h-11 flex-1"
            disabled={approve.isPending}
            onClick={() => approve.mutate({ taskId, layoutId: arte.id })}
          >
            <IconCheck className="mr-2 h-4 w-4" />
            Aprovar a arte
          </Button>
          <Button
            type="button"
            variant="outline"
            className="h-11 flex-1"
            disabled={approve.isPending}
            onClick={() => onReprove(arte)}
          >
            <IconX className="mr-2 h-4 w-4" />
            Reprovar
          </Button>
        </div>
      ) : null}
    </li>
  );
}

export function VeiculoArteCard({
  taskId,
  artworks,
  className,
}: {
  taskId: string;
  artworks: PortalArtwork[] | undefined;
  className?: string;
}) {
  const reprove = usePortalReproveArtwork();
  const [reprovando, setReprovando] = useState<PortalArtwork | null>(null);
  const [motivo, setMotivo] = useState("");
  const [erro, setErro] = useState<string | null>(null);

  // `undefined` = a seção LAYOUT não está no recorte deste contato: não há card.
  if (!artworks) return null;

  // A mais recente primeiro: é ela que pede a decisão.
  const artes = [...artworks].sort((a, b) => (b.version ?? 0) - (a.version ?? 0));
  const pendentes = artes.filter((a) => a.canDecide).length;

  const fechar = () => {
    setReprovando(null);
    setMotivo("");
    setErro(null);
  };

  const confirmarReprovacao = async () => {
    if (!reprovando) return;
    const texto = motivo.trim();
    if (texto.length < MOTIVO_MINIMO) {
      setErro("Diga o motivo da reprovação.");
      return;
    }
    try {
      await reprove.mutateAsync({ taskId, layoutId: reprovando.id, motivo: texto });
      fechar();
    } catch {
      setErro("Não foi possível reprovar. Tente de novo.");
    }
  };

  return (
    <PortalCard
      icon={IconPalette}
      title="Arte do implemento"
      description={
        pendentes
          ? pendentes === 1
            ? "Uma arte espera a sua decisão."
            : `${pendentes} artes esperam a sua decisão.`
          : artes.length
            ? "A arte que será pintada neste veículo."
            : "A Ankaa está preparando a arte deste veículo."
      }
      className={className}
    >
      {artes.length ? (
        <ul className="space-y-3">
          {artes.map((arte) => (
            <ArteItem key={arte.id} taskId={taskId} arte={arte} onReprove={setReprovando} />
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">
          Quando a arte estiver pronta, ela aparece aqui para você aprovar.
        </p>
      )}

      <Dialog open={!!reprovando} onOpenChange={(open) => (!open ? fechar() : undefined)}>
        <DialogContent className={cn(PORTAL_SHEET_ON_MOBILE, "sm:max-w-md")}>
          <DialogHeader>
            <DialogTitle>Reprovar a arte</DialogTitle>
            <DialogDescription>
              Diga o que precisa mudar. A Ankaa recebe o motivo e prepara uma nova versão.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="motivo-reprovacao">Motivo</Label>
            <Textarea
              id="motivo-reprovacao"
              rows={4}
              className="text-base"
              value={motivo}
              onChange={(event) => {
                setMotivo(event.target.value);
                setErro(null);
              }}
              placeholder="Ex.: a logomarca precisa ficar maior na lateral do motorista."
            />
            {erro ? (
              <p className="text-sm text-destructive" role="alert">
                {erro}
              </p>
            ) : null}
          </div>
          <DialogFooter className={PORTAL_DIALOG_FOOTER}>
            <Button type="button" variant="outline" onClick={fechar} disabled={reprove.isPending}>
              Cancelar
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => void confirmarReprovacao()}
              disabled={reprove.isPending}
            >
              Reprovar a arte
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PortalCard>
  );
}
