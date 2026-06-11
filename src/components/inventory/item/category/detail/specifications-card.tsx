import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { IconInfoCircle, IconBox } from "@tabler/icons-react";
import type { ItemCategory } from "../../../../../types";
import { cn } from "@/lib/utils";

interface SpecificationsCardProps {
  category: ItemCategory;
  itemCount?: number;
  className?: string;
}

export function SpecificationsCard({ category, itemCount = 0, className }: SpecificationsCardProps) {
  return (
    <Card className={cn("shadow-sm border border-border flex flex-col", className)}>
      <CardHeader className="pb-6">
        <CardTitle className="flex items-center gap-2">
          <IconInfoCircle className="h-5 w-5 text-muted-foreground" />
          Informações da Categoria
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0 flex-1">
        <div className="space-y-6">
          {/* Category Information Section */}
          <div>
            <h3 className="text-base font-semibold mb-4 text-foreground">Informações Básicas</h3>
            <div className="space-y-4">
              <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-3">
                <span className="text-sm font-medium text-muted-foreground">Nome da Categoria</span>
                <span className="text-sm font-semibold text-foreground">{category.name}</span>
              </div>
              <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-3">
                <span className="text-sm font-medium text-muted-foreground">Produtos Cadastrados</span>
                <div className="flex items-center gap-2">
                  <IconBox className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm font-semibold text-foreground">
                    {itemCount} {itemCount === 1 ? "produto" : "produtos"}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
