import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { IconMapPin } from "@tabler/icons-react";
import type { WarehouseLocation } from "../../../../types";
import { cn } from "@/lib/utils";

interface BasicInfoCardProps {
  warehouseLocation: WarehouseLocation;
  className?: string;
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-3">
      <span className="text-sm font-medium text-muted-foreground">{label}</span>
      <span className="text-sm font-semibold text-foreground text-right">{value}</span>
    </div>
  );
}

export function BasicInfoCard({ warehouseLocation, className }: BasicInfoCardProps) {
  return (
    <Card className={cn("shadow-sm border border-border flex flex-col", className)}>
      <CardHeader className="pb-6">
        <CardTitle className="flex items-center gap-2">
          <IconMapPin className="h-5 w-5 text-muted-foreground" />
          Informações Básicas
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0 flex-1">
        <div className="space-y-4">
          <InfoRow label="Nome" value={warehouseLocation.name} />
          <InfoRow label="Setor" value={warehouseLocation.section || "-"} />
          <InfoRow label="Código" value={warehouseLocation.code || "-"} />
          <InfoRow
            label="Ativo"
            value={
              <Badge variant={warehouseLocation.isActive ? "default" : "secondary"}>{warehouseLocation.isActive ? "Ativo" : "Inativo"}</Badge>
            }
          />
          {warehouseLocation.description && (
            <div className="bg-muted/50 rounded-lg px-4 py-3">
              <span className="text-sm font-medium text-muted-foreground block mb-1">Descrição</span>
              <span className="text-sm text-foreground whitespace-pre-wrap">{warehouseLocation.description}</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
