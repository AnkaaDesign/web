import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { IconUser, IconBuilding } from "@tabler/icons-react";
import type { Representative } from "@/types/representative";
import { REPRESENTATIVE_ROLE_LABELS, REPRESENTATIVE_ROLE_COLORS } from "@/types/representative";
import { cn } from "@/lib/utils";

interface BasicInfoCardProps {
  representative: Representative;
  className?: string;
}

export function BasicInfoCard({ representative, className }: BasicInfoCardProps) {
  return (
    <Card className={cn("shadow-sm border border-border flex flex-col", className)}>
      <CardHeader className="pb-6">
        <CardTitle className="flex items-center gap-2">
          <IconUser className="h-5 w-5 text-muted-foreground" />
          Informações Básicas
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0 flex-1">
        <div className="space-y-6">
          {/* Avatar Section */}
          <div className="flex justify-center mb-6">
            <div className="flex h-24 w-24 items-center justify-center rounded-full bg-muted border-2 border-border">
              <IconUser className="h-12 w-12 text-muted-foreground" />
            </div>
          </div>

          {/* Basic Information Section */}
          <div>
            <h3 className="text-base font-semibold mb-4 text-foreground">Identificação</h3>
            <div className="space-y-4">
              <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-3">
                <span className="text-sm font-medium text-muted-foreground">Nome</span>
                <span className="text-sm font-semibold text-foreground">{representative.name}</span>
              </div>

              <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-3">
                <span className="text-sm font-medium text-muted-foreground">Função</span>
                <Badge
                  variant={REPRESENTATIVE_ROLE_COLORS[representative.role] as any}
                  className="text-xs"
                >
                  {REPRESENTATIVE_ROLE_LABELS[representative.role]}
                </Badge>
              </div>

              <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-3">
                <span className="text-sm font-medium text-muted-foreground">Status</span>
                <Badge
                  variant={representative.isActive ? "success" : "secondary"}
                  className="text-xs"
                >
                  {representative.isActive ? "Ativo" : "Inativo"}
                </Badge>
              </div>
            </div>
          </div>

          {/* Customer Section */}
          {representative.customer && (
            <div className="pt-6 border-t border-border">
              <h3 className="text-base font-semibold mb-4 text-foreground">Cliente</h3>
              <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-3">
                <span className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <IconBuilding className="h-4 w-4" />
                  Cliente
                </span>
                <span className="text-sm font-semibold text-foreground">
                  {representative.customer.fantasyName || ""}
                </span>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
