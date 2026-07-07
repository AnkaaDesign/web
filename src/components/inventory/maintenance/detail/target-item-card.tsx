import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { IconBox, IconInfoCircle, IconExternalLink } from "@tabler/icons-react";
import type { Item } from "../../../../types";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";
import { routes } from "../../../../constants";
import { Button } from "@/components/ui/button";

interface TargetItemCardProps {
  item?: Item;
  className?: string;
}

export function TargetItemCard({ item, className }: TargetItemCardProps) {
  const navigate = useNavigate();
  if (!item) {
    return (
      <Card className={cn("shadow-sm border border-border", className)}>
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2">
          <IconBox className="h-5 w-5 text-muted-foreground" />
          Equipamento da Manutenção
        </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="text-center py-12">
            <IconInfoCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">Nenhum equipamento especificado para esta manutenção.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const handleViewItem = () => {
    navigate(routes.inventory.products.details(item.id));
  };

  return (
    <Card className={cn("shadow-sm border border-border flex flex-col", className)}>
      <CardHeader className="pb-6">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
          <IconBox className="h-5 w-5 text-muted-foreground" />
          Equipamento da Manutenção
        </CardTitle>
          <Button variant="ghost" size="sm" onClick={handleViewItem} className="text-xs">
            <IconExternalLink className="h-3 w-3 mr-1" />
            Ver detalhes
          </Button>
        </div>
      </CardHeader>
      <CardContent className="pt-0 flex-1">
        <div className="space-y-6">
          {/* Product Information Section */}
          <div>
            <h3 className="text-base font-semibold mb-4 text-foreground">Informações do Produto</h3>
            <div className="space-y-4">
              {/* Item Name */}
              <div className="bg-muted/30 rounded-lg p-4">
                <p className="text-base font-semibold text-foreground">
                  {item.uniCode && (
                    <>
                      <span className="font-mono text-sm text-muted-foreground">{item.uniCode}</span>
                      <span className="mx-2 text-muted-foreground">-</span>
                    </>
                  )}
                  {item.name}
                </p>
              </div>

              {/* Brand */}
              <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-3">
                <span className="text-sm font-medium text-muted-foreground">Marca</span>
                <span className="text-sm font-semibold text-foreground">{item.brands?.length ? item.brands.map((b) => b.name).join(", ") : <span className="text-muted-foreground italic">Não definida</span>}</span>
              </div>

              {/* Category */}
              <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-3">
                <span className="text-sm font-medium text-muted-foreground">Categoria</span>
                <span className="text-sm font-semibold text-foreground">
                  {item.category ? item.category.name : <span className="text-muted-foreground italic">Não definida</span>}
                </span>
              </div>

              {/* Supplier */}
              <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-3">
                <span className="text-sm font-medium text-muted-foreground">Fornecedor</span>
                <span className="text-sm font-semibold text-foreground">
                  {item.supplier ? item.supplier.fantasyName || item.supplier.corporateName : <span className="text-muted-foreground italic">Não definido</span>}
                </span>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
