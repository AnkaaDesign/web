import { IconTruck } from "@tabler/icons-react";
import { cn } from "@/lib/utils";

export interface BudgetVehicleTab {
  taskId: string;
  /** Como o operador identifica o caminhão: série, senão placa, senão "Veículo N". */
  label: string;
  /** Segunda linha discreta — a placa quando o rótulo é a série. */
  detail?: string | null;
  /** A pintura geral do veículo, para distinguir os caminhões num relance. */
  paintName?: string | null;
  paintHex?: string | null;
  /** Há alteração não salva neste veículo. */
  dirty?: boolean;
}

interface BudgetVehicleTabsProps {
  vehicles: BudgetVehicleTab[];
  activeTaskId: string;
  onSelect: (taskId: string) => void;
  className?: string;
}

/**
 * A ESCOLHA DO VEÍCULO no passo 1 de um orçamento de N caminhões.
 *
 * O passo 1 tem duas metades: o que é COMUM a todos (logomarca, cliente, categoria,
 * implemento, tamanho, responsáveis, arquivos base) e o que é DE CADA caminhão (série,
 * placa, chassi, plaqueta, pedido, previsão, detalhes, pintura geral, aerografia). Estas
 * abas escolhem qual caminhão a segunda metade mostra; a primeira não muda.
 *
 * Trocar de aba não descarta nada: os valores de todos os veículos vivem no mesmo
 * formulário, e um "Salvar" grava todos.
 */
export function BudgetVehicleTabs({ vehicles, activeTaskId, onSelect, className }: BudgetVehicleTabsProps) {
  return (
    <div
      role="tablist"
      aria-label="Veículos do orçamento"
      className={cn("flex gap-2 overflow-x-auto pb-1", className)}
    >
      {vehicles.map((v, index) => {
        const active = v.taskId === activeTaskId;
        return (
          <button
            key={v.taskId}
            type="button"
            role="tab"
            aria-selected={active}
            data-testid={`budget-vehicle-tab-${index + 1}`}
            onClick={() => onSelect(v.taskId)}
            title={v.paintName ? `${v.label} · ${v.paintName}` : v.label}
            className={cn(
              "flex min-w-[9rem] shrink-0 items-center gap-2.5 rounded-lg border px-3 py-2 text-left transition-colors",
              active
                ? "border-primary bg-primary/10 text-foreground"
                : "border-border bg-card text-muted-foreground hover:bg-muted/60 hover:text-foreground",
            )}
          >
            <span
              className={cn(
                "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[0.7rem] font-semibold tabular-nums",
                active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
              )}
            >
              {index + 1}
            </span>
            <span className="flex min-w-0 flex-col">
              <span className="flex items-center gap-1.5 text-sm font-medium">
                <IconTruck className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{v.label}</span>
                {v.dirty && (
                  <span
                    className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500"
                    aria-label="alterado, não salvo"
                  />
                )}
              </span>
              {(v.paintName || v.detail) && (
                <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  {v.paintHex && (
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full border border-border"
                      style={{ backgroundColor: v.paintHex }}
                    />
                  )}
                  <span className="truncate">{v.paintName || v.detail}</span>
                </span>
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
}
