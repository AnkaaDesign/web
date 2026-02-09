import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate } from "../../../../utils";
import type { PaintBrand } from "../../../../types";
import { IconCalendar, IconSettings } from "@tabler/icons-react";

interface PaintBrandSpecificationsCardProps {
  paintBrand: PaintBrand;
}

export function PaintBrandSpecificationsCard({ paintBrand }: PaintBrandSpecificationsCardProps) {
  return (
    <Card className="h-full flex flex-col shadow-sm border border-border">
      <CardHeader className="pb-6">
        <CardTitle className="flex items-center gap-2">
          <IconSettings className="h-5 w-5 text-muted-foreground" />
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
                <span className="text-sm font-medium text-muted-foreground">Nome da Marca</span>
                <span className="text-sm font-semibold text-foreground">{paintBrand.name}</span>
              </div>

              <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-3">
                <span className="text-sm font-medium text-muted-foreground">Código</span>
                <span className="text-sm font-semibold text-foreground">{paintBrand.code || "-"}</span>
              </div>

              <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-3">
                <span className="text-sm font-medium text-muted-foreground">Componentes Disponíveis</span>
                <span className="text-sm font-semibold text-foreground">{paintBrand._count?.componentItems || 0} componente(s)</span>
              </div>

              <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-3">
                <span className="text-sm font-medium text-muted-foreground">Tintas Cadastradas</span>
                <span className="text-sm font-semibold text-foreground">{paintBrand._count?.paints || 0} tinta(s)</span>
              </div>

              <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-3">
                <span className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <IconCalendar className="h-4 w-4" />
                  Data de Criação
                </span>
                <span className="text-sm font-semibold text-foreground">{formatDate(paintBrand.createdAt)}</span>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
