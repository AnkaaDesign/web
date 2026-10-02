/**
 * A ARTE DE CADA VEÍCULO, SÓ LEITURA.
 *
 * O orçamento e a tarefa não escolhem nem gravam arte (Modelo C, P12): a arte é
 * do IMPLEMENTO, com estado próprio, e o documento de assinatura leva a
 * APROVADA de cada veículo. Este quadro mostra, por veículo, em que pé ela
 * está — para o operador saber o que falta antes de emitir.
 *
 * Subir, enviar ao cliente, aprovar em nome dele, reprovar e versionar são ATOS
 * com rotas próprias (`/implements/:id/layouts/*`); a tela deles é o painel da
 * arte do implemento.
 */
import { IconPhoto } from "@tabler/icons-react";

import { Badge } from "@/components/ui/badge";
import { getApiBaseUrl } from "@/config/api";
import { LAYOUT_STATUS_LABELS } from "@/constants/enum-labels";
import { LAYOUT_STATUS } from "@/constants/enums";
import { cn } from "@/lib/utils";
import {
  approvedArtFilesOf,
  implementArtOf,
  implementArtStateOf,
  type ImplementArtLayout,
  type ImplementArtState,
} from "@/utils/implement-art";

export interface ImplementArtVehicle {
  taskId: string;
  /** Como o operador reconhece o veículo ("Série 39088 · ABC1D23"). */
  label: string;
  implement?: { id?: string | null; layouts?: ImplementArtLayout[] | null } | null;
}

const STATE_LABEL: Record<ImplementArtState, string> = {
  APPROVED: LAYOUT_STATUS_LABELS[LAYOUT_STATUS.APPROVED],
  PENDING_APPROVAL: LAYOUT_STATUS_LABELS[LAYOUT_STATUS.PENDING_APPROVAL],
  DRAFT: LAYOUT_STATUS_LABELS[LAYOUT_STATUS.DRAFT],
  REPROVED: LAYOUT_STATUS_LABELS[LAYOUT_STATUS.REPROVED],
  NONE: "Sem arte",
};

const STATE_VARIANT: Record<ImplementArtState, string> = {
  APPROVED: "completed",
  PENDING_APPROVAL: "teal",
  DRAFT: "secondary",
  REPROVED: "cancelled",
  NONE: "outline",
};

interface ImplementArtSummaryProps {
  vehicles: ImplementArtVehicle[];
  /** Âncora para o atalho "arte pendente" do checklist de emissão. */
  anchorId?: string;
  className?: string;
}

export function ImplementArtSummary({ vehicles, anchorId, className }: ImplementArtSummaryProps) {
  if (vehicles.length === 0) return null;
  const approvedCount = vehicles.filter((v) => implementArtStateOf(v) === "APPROVED").length;

  return (
    <div id={anchorId} className={cn("space-y-3", className)}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm font-semibold">Arte do implemento</p>
        <p className="text-sm text-muted-foreground">
          {approvedCount} de {vehicles.length} {vehicles.length === 1 ? "veículo" : "veículos"} com arte aprovada
        </p>
      </div>
      <ul className="divide-y divide-border rounded-lg border border-border">
        {vehicles.map((vehicle) => {
          const state = implementArtStateOf(vehicle);
          const approved = approvedArtFilesOf(vehicle);
          const versions = implementArtOf(vehicle).length;
          return (
            <li key={vehicle.taskId} className="flex items-center gap-3 px-3 py-2">
              <div className="flex shrink-0 gap-1">
                {approved.length > 0 ? (
                  approved.slice(0, 2).map((file) => (
                    <img
                      key={file.id}
                      src={file.thumbnailUrl || `${getApiBaseUrl()}/files/thumbnail/${file.id}`}
                      alt={file.originalName || file.filename || "Arte aprovada"}
                      className="h-10 w-14 rounded border border-border object-cover"
                    />
                  ))
                ) : (
                  <div className="flex h-10 w-14 items-center justify-center rounded border border-dashed border-border text-muted-foreground">
                    <IconPhoto className="h-4 w-4" />
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{vehicle.label}</p>
                {!vehicle.implement?.id ? (
                  <p className="text-sm text-muted-foreground">Sem implemento cadastrado.</p>
                ) : versions > 1 ? (
                  <p className="text-sm text-muted-foreground">{versions} artes no implemento</p>
                ) : null}
              </div>
              <Badge variant={STATE_VARIANT[state] as any} className="shrink-0">
                {STATE_LABEL[state]}
              </Badge>
            </li>
          );
        })}
      </ul>
      <p className="text-sm text-muted-foreground">
        A arte é do implemento: o documento de assinatura leva a aprovada de cada veículo. Subir, enviar ao
        cliente e decidir em nome dele ficam no painel da arte do implemento.
      </p>
    </div>
  );
}
