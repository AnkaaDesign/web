import * as React from "react";

import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export interface FinancialKpiCardProps {
  /** Short caption (e.g. "Em Aberto", "Pedidos em aberto"). */
  label: string;
  /** Pre-formatted value (e.g. currency). `null` renders a loading skeleton. */
  value: string | null;
  /** Optional record count shown as a muted "· N" suffix. */
  count?: number | null;
  /** Tabler icon component. */
  Icon: React.ComponentType<{ className?: string }>;
  /** Tone classes for the icon chip, e.g. "text-amber-600 bg-amber-500/10". */
  tone: string;
  /** Optional tooltip on hover. */
  hint?: string;
  /** When `onClick` is set the card becomes a toggle button; `active` styles it selected. */
  active?: boolean;
  onClick?: () => void;
}

/**
 * Shared financial summary/KPI card used across Conciliação, Previsão de Saídas
 * and Contas a Pagar. Static by default; pass `onClick` to turn it into a
 * clickable filter bucket (active = selected, dimmed = unselected), mirroring
 * the Conciliação saídas/entradas clickable-card → table-filter pattern.
 */
export function FinancialKpiCard({ label, value, count, Icon, tone, hint, active, onClick }: FinancialKpiCardProps) {
  const card = (
    <Card
      title={hint}
      className={cn(
        "h-full",
        onClick && "transition-all cursor-pointer",
        onClick &&
          (active
            ? // Selected: solid primary border + tinted fill + lift. The border
              // is the Card's own edge, so it follows the rounded-xl corners exactly.
              "border-primary bg-primary/5 shadow-md hover:shadow-lg"
            : // Unselected: recessed — neutral gray border, dimmed + desaturated.
              "border-border opacity-50 grayscale hover:opacity-100 hover:grayscale-0 hover:shadow-md"),
      )}
    >
      <CardContent className="flex items-center gap-3 p-4">
        <div className={cn("p-2 rounded-lg", tone)}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs text-muted-foreground truncate">{label}</p>
          {value === null ? (
            <Skeleton className="h-6 w-24 mt-1" />
          ) : (
            <p className="text-lg font-semibold truncate" title={value}>
              {value}
              {count != null && <span className="ml-1.5 text-xs font-normal text-muted-foreground">· {count}</span>}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );

  if (!onClick) return card;

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      // rounded-xl matches the Card so the keyboard focus ring hugs the same
      // corners. focus-visible (not focus) so a mouse click to DESELECT doesn't
      // leave a lingering green ring on the now-unselected card.
      className="text-left w-full rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
    >
      {card}
    </button>
  );
}
