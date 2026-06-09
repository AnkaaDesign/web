import { IconInfoCircle, IconId, IconStairs } from "@tabler/icons-react";

import type { Position } from "../../../../types";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface SpecificationsCardProps {
  position: Position;
  className?: string;
}

export function SpecificationsCard({ position, className }: SpecificationsCardProps) {
  return (
    <Card className={`shadow-sm border border-border flex flex-col ${className ?? ""}`}>
      <CardHeader className="pb-6">
        <CardTitle className="flex items-center gap-2">
          <IconInfoCircle className="h-5 w-5 text-muted-foreground" />
          Especificações
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0 flex-1">
        <div>
          <h3 className="text-base font-semibold mb-4 text-foreground">Informações Básicas</h3>
          <div className="space-y-4">
            <div className="flex justify-between items-center gap-4 bg-muted/50 rounded-lg px-4 py-3">
              <span className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <IconId className="h-4 w-4" />
                Nome
              </span>
              <span className="text-sm font-semibold text-foreground text-right">{position.name}</span>
            </div>

            <div className="flex justify-between items-center gap-4 bg-muted/50 rounded-lg px-4 py-3">
              <span className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <IconStairs className="h-4 w-4" />
                Hierarquia
              </span>
              <span className="text-sm font-semibold text-foreground text-right">
                {position.hierarchy !== null && position.hierarchy !== undefined ? position.hierarchy : "-"}
              </span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
