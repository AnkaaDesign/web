import { IconInfoCircle, IconCalendar } from "@tabler/icons-react";

import type { Position } from "../../../../types";
import { formatDateTime, formatCurrency } from "../../../../utils";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface SpecificationsCardProps {
  position: Position;
}

export function SpecificationsCard({ position }: SpecificationsCardProps) {
  // Use the virtual remuneration field (populated by backend)
  const currentRemuneration = position.remuneration ?? 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <IconInfoCircle className="h-5 w-5" />
          Especificações
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Basic Information */}
        <div>
          <h3 className="text-sm font-medium text-muted-foreground mb-3">Informações Básicas</h3>
          <div className="space-y-2">
            <div className="flex items-center justify-between py-1">
              <span className="text-sm text-muted-foreground">Nome</span>
              <span className="text-sm font-medium">{position.name}</span>
            </div>
            <div className="flex items-center justify-between py-1">
              <span className="text-sm text-muted-foreground">Hierarquia</span>
              {position.hierarchy !== null && position.hierarchy !== undefined ? <span className="text-sm font-medium">{position.hierarchy}</span> : <span className="text-sm text-muted-foreground">-</span>}
            </div>
            <div className="flex items-center justify-between py-1">
              <span className="text-sm text-muted-foreground">Remuneração Atual</span>
              {currentRemuneration ? <span className="text-sm font-medium">{formatCurrency(currentRemuneration)}</span> : <span className="text-sm text-muted-foreground">-</span>}
            </div>
            <div className="flex items-center justify-between py-1">
              <span className="text-sm text-muted-foreground">Funcionários</span>
              <span className="text-sm font-medium">
                {position._count?.users || 0} funcionário{(position._count?.users || 0) !== 1 ? "s" : ""}
              </span>
            </div>
            <div className="flex items-center justify-between py-1">
              <span className="text-sm text-muted-foreground">Histórico de Remunerações</span>
              <span className="text-sm font-medium">
                {position._count?.remunerations || 0} registro{(position._count?.remunerations || 0) !== 1 ? "s" : ""}
              </span>
            </div>
          </div>
        </div>

        {/* System Dates */}
        <div>
          <h3 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
            <IconCalendar className="h-4 w-4" />
            Datas do Sistema
          </h3>
          <div className="space-y-2">
            <div className="flex items-center justify-between py-1">
              <span className="text-sm text-muted-foreground">Criado em</span>
              <span className="text-sm">{position.createdAt ? formatDateTime(position.createdAt) : "-"}</span>
            </div>
            <div className="flex items-center justify-between py-1">
              <span className="text-sm text-muted-foreground">Atualizado em</span>
              <span className="text-sm">{position.updatedAt ? formatDateTime(position.updatedAt) : "-"}</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
