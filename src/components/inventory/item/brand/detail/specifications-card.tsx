import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { IconInfoCircle, IconCalendar, IconHash, IconCircleCheck } from "@tabler/icons-react";
import type { ItemBrand } from "../../../../../types";
import { formatDate } from "../../../../../utils";
import { cn } from "@/lib/utils";

interface SpecificationsCardProps {
  brand: ItemBrand;
  itemCount?: number;
  className?: string;
}

export function SpecificationsCard({ brand, itemCount = 0, className }: SpecificationsCardProps) {
  return (
    <Card className={cn("shadow-sm border border-border flex flex-col", className)}>
      <CardHeader className="pb-6">
        <CardTitle className="flex items-center gap-2">
          <IconInfoCircle className="h-5 w-5 text-muted-foreground" />
          Informações da Marca
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0 flex-1">
        <div className="space-y-6">
          {/* Brand Information Section */}
          <div>
            <h3 className="text-base font-semibold mb-4 text-foreground">Informações Básicas</h3>
            <div className="space-y-4">
              <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-3">
                <span className="text-sm font-medium text-muted-foreground">Nome da Marca</span>
                <span className="text-sm font-semibold text-foreground">{brand.name}</span>
              </div>
              <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-3">
                <span className="text-sm font-medium text-muted-foreground">Status</span>
                <div className="flex items-center gap-2">
                  <IconCircleCheck className="w-4 h-4 text-green-600" />
                  <span className="text-sm font-semibold text-green-600">Ativa</span>
                </div>
              </div>
              <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-3">
                <span className="text-sm font-medium text-muted-foreground">Produtos Cadastrados</span>
                <span className="text-sm font-semibold text-foreground">
                  {itemCount} {itemCount === 1 ? "produto" : "produtos"}
                </span>
              </div>
            </div>
          </div>

          {/* Identification Section */}
          <div className="pt-6 border-t border-border">
            <h3 className="text-base font-semibold mb-4 text-foreground">Identificação</h3>
            <div className="grid grid-cols-1 gap-6">
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-2">
                  <IconHash className="h-4 w-4" />
                  ID da Marca
                </p>
                <p className="font-mono text-base bg-muted/50 rounded px-3 py-2 w-fit text-foreground">{brand.id}</p>
              </div>
            </div>
          </div>

          {/* Timestamps Section */}
          <div className="pt-6 border-t border-border">
            <h3 className="text-base font-semibold mb-4 text-foreground">Histórico</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-2">
                  <IconCalendar className="h-4 w-4" />
                  Data de Criação
                </p>
                <p className="text-base font-medium text-foreground">{formatDate(brand.createdAt)}</p>
              </div>

              <div>
                <p className="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-2">
                  <IconCalendar className="h-4 w-4" />
                  Última Atualização
                </p>
                <p className="text-base font-medium text-foreground">{formatDate(brand.updatedAt)}</p>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
