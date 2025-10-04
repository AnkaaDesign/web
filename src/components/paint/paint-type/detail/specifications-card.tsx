import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "../../../../utils";
import type { PaintType } from "../../../../types";
import { IconCalendar, IconSettings } from "@tabler/icons-react";

interface PaintTypeSpecificationsCardProps {
  paintType: PaintType;
}

export function PaintTypeSpecificationsCard({ paintType }: PaintTypeSpecificationsCardProps) {
  return (
    <Card className="h-full flex flex-col shadow-sm border border-border">
      <CardHeader className="pb-6">
        <CardTitle className="flex items-center gap-3 text-xl">
          <div className="p-2 rounded-lg bg-primary/10">
            <IconSettings className="h-5 w-5 text-primary" />
          </div>
          Especificações
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0 flex-1">
        <div className="space-y-6">
          {/* Basic Information Section */}
          <div>
            <h3 className="text-base font-semibold mb-4 text-foreground">Informações Técnicas</h3>
            <div className="space-y-4">
              <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-3">
                <span className="text-sm font-medium text-muted-foreground">Nome do Tipo</span>
                <span className="text-sm font-semibold text-foreground">{paintType.name}</span>
              </div>

              <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-3">
                <span className="text-sm font-medium text-muted-foreground">Requer Fundo</span>
                <Badge variant={paintType.needGround ? "default" : "secondary"}>{paintType.needGround ? "Sim" : "Não"}</Badge>
              </div>

              <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-3">
                <span className="text-sm font-medium text-muted-foreground">Componentes Disponíveis</span>
                <span className="text-sm font-semibold text-foreground">{paintType._count?.componentItems || 0} componente(s)</span>
              </div>

              <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-3">
                <span className="text-sm font-medium text-muted-foreground">Tintas Cadastradas</span>
                <span className="text-sm font-semibold text-foreground">{paintType._count?.paints || 0} tinta(s)</span>
              </div>

              <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-3">
                <span className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <IconCalendar className="h-4 w-4" />
                  Data de Criação
                </span>
                <span className="text-sm font-semibold text-foreground">{formatDate(paintType.createdAt)}</span>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
