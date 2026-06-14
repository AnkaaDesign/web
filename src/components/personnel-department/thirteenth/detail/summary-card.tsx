import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { IconGift } from "@tabler/icons-react";
import { cn } from "@/lib/utils";
import { routes, THIRTEENTH_STATUS_LABELS } from "../../../../constants";
import { formatCurrency } from "../../../../utils";
import type { Thirteenth } from "../../../../types/thirteenth";
import { THIRTEENTH_STATUS_BADGE_VARIANTS, fullEntitlement } from "../utils";

interface SummaryCardProps {
  thirteenth: Thirteenth;
  className?: string;
}

function SummaryRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-1.5">
      <span className="text-sm text-muted-foreground shrink-0">{label}</span>
      <span className="text-sm font-medium text-right">{children}</span>
    </div>
  );
}

export function SummaryCard({ thirteenth, className }: SummaryCardProps) {
  const full = fullEntitlement(thirteenth);

  return (
    <Card className={cn("shadow-sm border border-border", className)}>
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2">
          <IconGift className="h-5 w-5 text-muted-foreground" />
          Resumo
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0 divide-y divide-border/50">
        <SummaryRow label="Colaborador">
          {thirteenth.user ? (
            <Link to={routes.administration.collaborators.details(thirteenth.userId)} className="text-primary hover:underline" onClick={(e) => e.stopPropagation()}>
              {thirteenth.user.name}
            </Link>
          ) : (
            "-"
          )}
        </SummaryRow>

        {thirteenth.user?.position?.name && <SummaryRow label="Cargo">{thirteenth.user.position.name}</SummaryRow>}
        {thirteenth.user?.sector?.name && <SummaryRow label="Setor">{thirteenth.user.sector.name}</SummaryRow>}

        <SummaryRow label="Ano">{thirteenth.year}</SummaryRow>

        <SummaryRow label="Avos">
          <span className="tabular-nums">{thirteenth.avos}/12</span>
          <span className="text-xs text-muted-foreground ml-1">(≥ 15 dias = 1 avo)</span>
        </SummaryRow>

        <SummaryRow label="Base de Cálculo">
          {thirteenth.baseRemuneration != null ? formatCurrency(thirteenth.baseRemuneration) : "-"}
          <div className="text-xs text-muted-foreground font-normal">média de variáveis</div>
        </SummaryRow>

        <SummaryRow label="Valor Cheio (ano)">{full != null ? formatCurrency(full) : "-"}</SummaryRow>

        <SummaryRow label="Status">
          <Badge variant={THIRTEENTH_STATUS_BADGE_VARIANTS[thirteenth.status] || "secondary"} className="text-xs">
            {THIRTEENTH_STATUS_LABELS[thirteenth.status] || thirteenth.status}
          </Badge>
        </SummaryRow>

        {thirteenth.notes && (
          <div className="py-1.5">
            <span className="text-sm text-muted-foreground">Observações</span>
            <p className="text-sm font-medium mt-1 whitespace-pre-wrap">{thirteenth.notes}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
