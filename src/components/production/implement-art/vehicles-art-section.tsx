/**
 * A ARTE DOS VEÍCULOS de um orçamento (ou de um faturamento): um painel da arte
 * por veículo e, em cima, "uma imagem para todos".
 *
 * Um orçamento pode ter várias artes — cada veículo carrega a sua. O comum é
 * começar com UMA imagem para todos e depois ajustar veículo a veículo; o
 * documento de assinatura diz qual arte é de qual veículo.
 */
import { useRef, useState } from "react";
import { IconChevronDown, IconPhotoUp } from "@tabler/icons-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { LAYOUT_STATUS_LABELS_FROM_CONTRACT } from "@/constants/budget-contract";
import { LAYOUT_STATUS } from "@/constants/enums";
import { useAuth } from "@/contexts/auth-context";
import { useApplyArtToImplements } from "@/hooks/production/use-implement-art";
import { cn } from "@/lib/utils";
import { countApprovedArt } from "@/utils/budget-axes";
import { implementArtStateOf, type ImplementArtLayout, type ImplementArtState } from "@/utils/implement-art";
import { canEditImplementArt } from "@/utils/permissions/implement-art-permissions";
import { ImplementArtPanel } from "./implement-art-panel";


export interface ImplementArtVehicle {
  taskId: string;
  /** Como o operador reconhece o veículo ("Série 39088 · ABC1D23"). */
  label: string;
  implement?: { id?: string | null; layouts?: ImplementArtLayout[] | null } | null;
}

const STATE_LABEL: Record<ImplementArtState, string> = {
  APPROVED: LAYOUT_STATUS_LABELS_FROM_CONTRACT[LAYOUT_STATUS.APPROVED],
  PENDING_APPROVAL: LAYOUT_STATUS_LABELS_FROM_CONTRACT[LAYOUT_STATUS.PENDING_APPROVAL],
  DRAFT: LAYOUT_STATUS_LABELS_FROM_CONTRACT[LAYOUT_STATUS.DRAFT],
  REPROVED: LAYOUT_STATUS_LABELS_FROM_CONTRACT[LAYOUT_STATUS.REPROVED],
  NONE: "Sem arte",
};

const STATE_VARIANT: Record<ImplementArtState, string> = {
  APPROVED: "completed",
  PENDING_APPROVAL: "teal",
  DRAFT: "secondary",
  REPROVED: "cancelled",
  NONE: "outline",
};

interface VehiclesArtSectionProps {
  vehicles: ImplementArtVehicle[];
  /** O orçamento dos veículos: "uma imagem para todos" vira um lote atômico sobre ele. */
  budgetId?: string | null;
  /** Âncora para o atalho "arte pendente" da faixa dos eixos. */
  anchorId?: string;
  readOnly?: boolean;
  className?: string;
  /**
   * RESUMO: o estado de cada veículo e "uma imagem para todos", sem os painéis.
   * É o que o passo Tarefa do orçamento mostra; o painel de cada veículo mora no
   * cartão dele, no passo Veículos (`onOpenVehicle` leva até lá).
   */
  summary?: boolean;
  onOpenVehicle?: (taskId: string) => void;
}

export function VehiclesArtSection({
  vehicles,
  budgetId,
  anchorId,
  readOnly,
  className,
  summary,
  onOpenVehicle,
}: VehiclesArtSectionProps) {
  const { user } = useAuth();
  const canEdit = !readOnly && canEditImplementArt(user as any);
  const applyToAll = useApplyArtToImplements();
  const [pendingFiles, setPendingFiles] = useState<File[] | null>(null);
  const input = useRef<HTMLInputElement>(null);

  if (vehicles.length === 0) return null;

  const states = vehicles.map((vehicle) => implementArtStateOf(vehicle));
  const { approved, total } = countApprovedArt(states);
  const implementIds = vehicles.map((vehicle) => vehicle.implement?.id).filter((id): id is string => !!id);
  const single = vehicles.length === 1;

  const confirmApply = () => {
    if (!pendingFiles) return;
    void applyToAll
      .mutateAsync({ implementIds, files: pendingFiles, budgetId })
      .then(() => setPendingFiles(null))
      .catch(() => undefined);
  };

  return (
    <div id={anchorId} className={cn("space-y-3", className)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-semibold">Arte {single ? "do veículo" : "dos veículos"}</p>
          <p className="text-sm text-muted-foreground">
            {approved} de {total} {total === 1 ? "veículo" : "veículos"} com arte aprovada
          </p>
        </div>
        {canEdit && implementIds.length > 1 && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1.5"
            disabled={applyToAll.isPending}
            onClick={() => input.current?.click()}
          >
            <IconPhotoUp className="h-4 w-4" />
            Uma imagem para todos
          </Button>
        )}
      </div>

      {summary ? (
        <div className="flex flex-wrap gap-2">
          {vehicles.map((vehicle, index) => (
            <button
              key={vehicle.taskId}
              type="button"
              disabled={!onOpenVehicle}
              onClick={() => onOpenVehicle?.(vehicle.taskId)}
              className="flex items-center gap-2 rounded-md border border-border px-2.5 py-1.5 text-left text-sm hover:bg-muted/40 disabled:cursor-default disabled:hover:bg-transparent"
            >
              <span className="max-w-[14rem] truncate font-medium">{vehicle.label}</span>
              <Badge variant={STATE_VARIANT[states[index]] as any} className="shrink-0">
                {STATE_LABEL[states[index]]}
              </Badge>
            </button>
          ))}
        </div>
      ) : single ? (
        <ImplementArtPanel
          implementId={vehicles[0].implement?.id}
          vehicleLabel={vehicles[0].label}
          readOnly={readOnly}
          className="rounded-lg border border-border p-3"
        />
      ) : (
        <div className="divide-y divide-border rounded-lg border border-border">
          {vehicles.map((vehicle, index) => (
            <Collapsible key={vehicle.taskId}>
              <CollapsibleTrigger className="group flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-muted/40">
                <span className="min-w-0 flex-1 truncate text-sm font-medium">{vehicle.label}</span>
                <Badge variant={STATE_VARIANT[states[index]] as any} className="shrink-0">
                  {STATE_LABEL[states[index]]}
                </Badge>
                <IconChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
              </CollapsibleTrigger>
              <CollapsibleContent className="px-3 pb-3">
                <ImplementArtPanel implementId={vehicle.implement?.id} readOnly={readOnly} />
              </CollapsibleContent>
            </Collapsible>
          ))}
        </div>
      )}

      <p className="text-sm text-muted-foreground">
        Cada veículo carrega a sua arte, e o documento de assinatura mostra qual arte é de qual veículo.
        {summary && onOpenVehicle ? " Ajuste a arte de cada um no passo Veículos." : ""}
      </p>

      <input
        ref={input}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(event) => {
          const files = Array.from(event.target.files ?? []);
          event.target.value = "";
          if (files.length > 0) setPendingFiles(files);
        }}
      />

      <Dialog open={!!pendingFiles} onOpenChange={(open) => !open && setPendingFiles(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Uma imagem para todos os veículos</DialogTitle>
            <DialogDescription>
              {pendingFiles?.length === 1 ? "A imagem entra" : `As ${pendingFiles?.length} imagens entram`} como rascunho
              na arte de {implementIds.length} veículos. Depois, ajuste veículo a veículo e envie ao cliente.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setPendingFiles(null)} disabled={applyToAll.isPending}>
              Cancelar
            </Button>
            <Button type="button" onClick={confirmApply} disabled={applyToAll.isPending}>
              Aplicar a todos
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
