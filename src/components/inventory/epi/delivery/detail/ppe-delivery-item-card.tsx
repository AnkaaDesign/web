import { useNavigate } from "react-router-dom";
import { IconExternalLink, IconAlertCircle, IconPackage, IconBoxMultiple, IconShield, IconTag, IconCategory, IconRuler } from "@tabler/icons-react";
import type { PpeDelivery } from "../../../../../types";
import { routes, MEASURE_UNIT_LABELS, PPE_TYPE_LABELS } from "../../../../../constants";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { MeasureDisplayCompact } from "@/components/inventory/item/common/measure-display";

interface PpeDeliveryItemCardProps {
  ppeDelivery: PpeDelivery;
  className?: string;
}

export function PpeDeliveryItemCard({ ppeDelivery, className }: PpeDeliveryItemCardProps) {
  const navigate = useNavigate();

  if (!ppeDelivery.item) {
    return (
      <Card className={cn("shadow-sm border border-border flex flex-col", className)}>
        <CardHeader className="pb-6">
          <CardTitle className="flex items-center gap-2">
          <IconPackage className="h-5 w-5 text-muted-foreground" />
          Informações do Item
        </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 text-muted-foreground bg-muted/30 rounded-lg p-4">
            <IconAlertCircle className="h-4 w-4" />
            <p className="text-sm">Item não encontrado</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const { item } = ppeDelivery;

  const handleViewItem = () => {
    navigate(routes.inventory.ppe.details(item.id));
  };

  return (
    <Card className={cn("shadow-sm border border-border flex flex-col", className)}>
      <CardHeader className="pb-6">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
          <IconPackage className="h-5 w-5 text-muted-foreground" />
          Informações do Item
        </CardTitle>
          <Button variant="ghost" size="sm" onClick={handleViewItem} className="text-xs">
            <IconExternalLink className="h-3 w-3 mr-1" />
            Ver detalhes
          </Button>
        </div>
      </CardHeader>
      <CardContent className="pt-0 flex-1">
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

          {/* PPE Type */}
          {item.ppeType && (
            <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-3">
              <div className="flex items-center gap-2">
                <IconShield className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium text-muted-foreground">Tipo de EPI</span>
              </div>
              <Badge variant="secondary">{PPE_TYPE_LABELS[item.ppeType]}</Badge>
            </div>
          )}

          {/* PPE Size */}
          {item.ppeSize && (
            <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-3">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-muted-foreground">Tamanho</span>
              </div>
              <Badge variant="outline">{item.ppeSize}</Badge>
            </div>
          )}

          {/* Measures */}
          {item.measures && item.measures.length > 0 && (
            <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-3">
              <div className="flex items-center gap-2">
                <IconRuler className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium text-muted-foreground">Tamanho</span>
              </div>
              <MeasureDisplayCompact item={item} className="text-sm font-semibold text-foreground" />
            </div>
          )}

          {/* Brand */}
          <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-3">
            <div className="flex items-center gap-2">
              <IconTag className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium text-muted-foreground">Marca</span>
            </div>
            <span className="text-sm font-semibold text-foreground">{item.brand ? item.brand.name : <span className="text-muted-foreground italic">Não definida</span>}</span>
          </div>

          {/* Category */}
          <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-3">
            <div className="flex items-center gap-2">
              <IconCategory className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium text-muted-foreground">Categoria</span>
            </div>
            <span className="text-sm font-semibold text-foreground">
              {item.category ? item.category.name : <span className="text-muted-foreground italic">Não definida</span>}
            </span>
          </div>

          {/* Estoque Atual */}
          {item.quantity !== undefined && (
            <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-3">
              <div className="flex items-center gap-2">
                <IconBoxMultiple className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium text-muted-foreground">Estoque Atual</span>
              </div>
              <span className="text-sm font-semibold text-foreground">
                {item.quantity % 1 === 0
                  ? item.quantity.toLocaleString("pt-BR")
                  : item.quantity.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                {item.measureUnit && <span className="text-sm font-normal text-muted-foreground ml-1">{MEASURE_UNIT_LABELS[item.measureUnit]}</span>}
              </span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
