// web/src/components/cliente/orcamento/orcamento-arte-card.tsx
//
// A ARTE DO ORÇAMENTO, PELOS IMPLEMENTOS — o que o cliente decide.
//
// A arte é de cada veículo, mas o cliente pensa por ARTE: "esta imagem vai nos
// três baús". O servidor já entrega as artes agrupadas por ARQUIVO
// (`budget.artwork.groups`): um arquivo mandado aos N veículos é um grupo com N
// linhas, e `pendingLayoutIds` é exatamente o corpo do LOTE ATÔMICO
// (`PUT /cliente/me/artes/aprovar`) — "Aprovar para os N veículos".
//
// ⛔ CADA ARTE DIZ DE QUAL VEÍCULO É. Num orçamento com artes diferentes, a
// legenda (série/placa) ao lado de cada imagem é o que impede pintar o layout
// de um veículo no outro — a mesma regra do documento assinado.
//
// O "Reprovar" do grupo usa o LOTE ATÔMICO (`PUT /cliente/me/artes/reprovar`):
// os N veículos da arte são reprovados juntos, com o mesmo motivo, ou nenhum.
import { useState } from "react";
import { IconCheck, IconExternalLink, IconPalette, IconX } from "@tabler/icons-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
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
  usePortalApproveArtworks,
  usePortalReproveArtworks,
  type PortalBudget,
  type PortalBudgetArtwork,
} from "@/api-client/portal";
import { cn } from "@/lib/utils";
import { PortalCard } from "../portal-detail";
import { PORTAL_DIALOG_FOOTER, PORTAL_SHEET_ON_MOBILE } from "../portal-dialog";
import { portalFileUrl, portalThumbnailUrl } from "../veiculo/portal-file-url";
import { MOTIVO_MINIMO } from "../veiculo/veiculo-arte-card";
import { vehicleChipLabel } from "./vehicle-chips";

type Grupo = PortalBudgetArtwork["groups"][number];

const STATUS_VARIANT = {
  PENDING_APPROVAL: "pending",
  APPROVED: "approved",
  REPROVED: "rejected",
} as const;

/** O rótulo de cada veículo do orçamento, por `taskId` (série · placa, ou nome). */
export function rotulosDosVeiculos(budget: PortalBudget): Map<string, string> {
  const mapa = new Map<string, string>();
  (budget.vehicles ?? []).forEach((vehicle, index) => {
    mapa.set(vehicle.id, vehicleChipLabel(vehicle) || `Veículo ${index + 1}`);
  });
  for (const chip of budget.vehicleChips ?? []) {
    if (mapa.has(chip.taskId)) continue;
    const partes = [chip.serialNumber ? `Série ${chip.serialNumber}` : null, chip.plate].filter(Boolean);
    if (partes.length) mapa.set(chip.taskId, partes.join(" · "));
  }
  return mapa;
}

/** O resumo dos contadores, em uma frase. */
export function resumoDaArte(artwork: PortalBudgetArtwork): string {
  if (artwork.total === 0) return "Nenhum veículo neste orçamento.";
  if (artwork.approved === artwork.total) {
    return artwork.total === 1 ? "A arte está aprovada." : `Arte aprovada nos ${artwork.total} veículos.`;
  }
  const partes = [
    artwork.approved ? `${artwork.approved} de ${artwork.total} aprovadas` : null,
    artwork.awaitingMe
      ? `${artwork.awaitingMe} ${artwork.awaitingMe === 1 ? "espera" : "esperam"} a sua decisão`
      : artwork.awaitingCustomer
        ? `${artwork.awaitingCustomer} com o cliente`
        : null,
    artwork.atAnkaa ? `${artwork.atAnkaa} em preparação na Ankaa` : null,
  ].filter(Boolean);
  return partes.join(" · ");
}

function GrupoDeArte({
  grupo,
  index,
  total,
  rotulos,
  onReprove,
}: {
  grupo: Grupo;
  index: number;
  total: number;
  rotulos: Map<string, string>;
  onReprove: (grupo: Grupo) => void;
}) {
  const approve = usePortalApproveArtworks();
  const decidiveis = grupo.vehicles.filter((v) => v.canDecide);
  const url = portalFileUrl(grupo.file);
  const ehImagem = (grupo.file?.mimetype ?? "").startsWith("image/") || !!grupo.file?.thumbnailUrl;

  return (
    <li className="space-y-3 rounded-lg border border-border p-3">
      <p className="text-sm font-medium">
        {total > 1 ? `Arte ${index + 1}` : "Arte"}
        <span className="text-muted-foreground">
          {" · "}
          {grupo.vehicles.length === 1 ? "1 veículo" : `${grupo.vehicles.length} veículos`}
        </span>
      </p>

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
              src={portalThumbnailUrl(grupo.file)}
              alt={grupo.file?.originalName ?? "Arte"}
              loading="lazy"
              className="max-h-80 w-full object-contain"
            />
          ) : (
            <span className="flex min-h-11 items-center gap-2 px-3 py-2 text-sm">
              <IconExternalLink className="h-4 w-4 shrink-0" />
              <span className="truncate">{grupo.file?.originalName ?? "Abrir o arquivo"}</span>
            </span>
          )}
        </a>
      ) : null}

      {/* QUAL veículo leva esta arte — e em que pé está em cada um. */}
      <ul className="space-y-1.5">
        {grupo.vehicles.map((v) => (
          <li
            key={v.layoutId}
            className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded-md bg-muted/50 px-3 py-2"
          >
            <span className="text-sm font-medium">{rotulos.get(v.taskId) ?? "Veículo"}</span>
            <Badge variant={STATUS_VARIANT[v.status] ?? "pending"}>
              {v.statusLabel ?? v.status}
              {v.version ? ` · v${v.version}` : ""}
            </Badge>
          </li>
        ))}
      </ul>

      {decidiveis.length ? (
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button
            type="button"
            className="h-11 flex-1"
            disabled={approve.isPending}
            onClick={() => approve.mutate(grupo.pendingLayoutIds.length ? grupo.pendingLayoutIds : decidiveis.map((v) => v.layoutId))}
          >
            <IconCheck className="mr-2 h-4 w-4" />
            {decidiveis.length === 1 ? "Aprovar a arte" : `Aprovar para os ${decidiveis.length} veículos`}
          </Button>
          <Button
            type="button"
            variant="outline"
            className="h-11 flex-1"
            disabled={approve.isPending}
            onClick={() => onReprove(grupo)}
          >
            <IconX className="mr-2 h-4 w-4" />
            Reprovar
          </Button>
        </div>
      ) : null}
    </li>
  );
}

export function OrcamentoArteCard({ budget }: { budget: PortalBudget }) {
  const reprove = usePortalReproveArtworks();
  const [reprovando, setReprovando] = useState<Grupo | null>(null);
  const [motivo, setMotivo] = useState("");
  const [erro, setErro] = useState<string | null>(null);

  const artwork = budget.artwork;
  // Sem a seção LAYOUT o servidor não manda `artwork`: o card não existe.
  if (!artwork) return null;

  const rotulos = rotulosDosVeiculos(budget);
  const grupos = artwork.groups ?? [];

  const fechar = () => {
    setReprovando(null);
    setMotivo("");
    setErro(null);
  };

  const confirmar = async () => {
    if (!reprovando) return;
    const texto = motivo.trim();
    if (texto.length < MOTIVO_MINIMO) {
      setErro("Diga o motivo da reprovação.");
      return;
    }
    const layoutIds = reprovando.vehicles.filter((x) => x.canDecide).map((v) => v.layoutId);
    try {
      await reprove.mutateAsync({ layoutIds, motivo: texto });
      fechar();
    } catch {
      setErro("Não foi possível reprovar a arte. Nada foi alterado — recarregue para ver o estado de cada veículo.");
    }
  };

  return (
    <PortalCard icon={IconPalette} title="Arte dos veículos" description={resumoDaArte(artwork)}>
      {grupos.length ? (
        <div className="space-y-3">
          {grupos.length > 1 ? (
            <Alert>
              <AlertDescription className="text-sm">
                Este orçamento tem {grupos.length} artes diferentes. Confira em cada uma os veículos
                que a levam.
              </AlertDescription>
            </Alert>
          ) : null}
          <ul className="space-y-3">
            {grupos.map((grupo, index) => (
              <GrupoDeArte
                key={grupo.fileId}
                grupo={grupo}
                index={index}
                total={grupos.length}
                rotulos={rotulos}
                onReprove={setReprovando}
              />
            ))}
          </ul>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          A Ankaa está preparando a arte. Quando ela estiver pronta, aparece aqui para você aprovar.
        </p>
      )}

      <Dialog open={!!reprovando} onOpenChange={(open) => (!open ? fechar() : undefined)}>
        <DialogContent className={cn(PORTAL_SHEET_ON_MOBILE, "sm:max-w-md")}>
          <DialogHeader>
            <DialogTitle>Reprovar a arte</DialogTitle>
            <DialogDescription>
              {reprovando && reprovando.vehicles.filter((v) => v.canDecide).length > 1
                ? `A reprovação vale para os ${reprovando.vehicles.filter((v) => v.canDecide).length} veículos desta arte. `
                : ""}
              Diga o que precisa mudar; a Ankaa prepara uma nova versão.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="motivo-reprovacao-grupo">Motivo</Label>
            <Textarea
              id="motivo-reprovacao-grupo"
              rows={4}
              className="text-base"
              value={motivo}
              onChange={(event) => {
                setMotivo(event.target.value);
                setErro(null);
              }}
              placeholder="Ex.: o telefone na traseira está errado."
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
            <Button type="button" variant="destructive" onClick={() => void confirmar()} disabled={reprove.isPending}>
              Reprovar a arte
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PortalCard>
  );
}
