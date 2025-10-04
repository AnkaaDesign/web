import { useNavigate } from "react-router-dom";
import { IconExternalLink, IconAlertCircle, IconPackage, IconCurrencyDollar, IconBoxMultiple, IconShield, IconTag, IconCategory } from "@tabler/icons-react";
import type { PpeDelivery } from "../../../../../types";
import { formatCurrency } from "../../../../../utils";
import { routes, MEASURE_UNIT_LABELS, PPE_TYPE_LABELS } from "../../../../../constants";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface PpeDeliveryItemCardProps {
  ppeDelivery: PpeDelivery;
  className?: string;
}

export function PpeDeliveryItemCard({ ppeDelivery, className }: PpeDeliveryItemCardProps) {
  const navigate = useNavigate();

  if (!ppeDelivery.item) {
    return (
      <Card className={cn("shadow-sm border border-border flex flex-col", className)} level={1}>
        <CardHeader className="pb-6">
          <CardTitle className="flex items-center gap-3 text-xl">
            <div className="p-2 rounded-lg bg-primary/10">
              <IconPackage className="h-5 w-5 text-primary" />
            </div>
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

  // Get the most recent price from the prices array
  const currentPrice = item.prices && item.prices.length > 0 ? item.prices[0].value : null;

  const handleViewItem = () => {
    navigate(routes.inventory.ppe.details(item.id));
  };

  return (
    <Card className={cn("shadow-sm border border-border flex flex-col", className)} level={1}>
      <CardHeader className="pb-6">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-3 text-xl">
            <div className="p-2 rounded-lg bg-primary/10">
              <IconPackage className="h-5 w-5 text-primary" />
            </div>
            Informações do Item
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
                  <span className="text-sm font-medium text-muted-foreground">Tamanho</span>
                  <Badge variant="outline">{item.ppeSize}</Badge>
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
            </div>
          </div>

          {/* Quantity and Price Section */}
          <div className="pt-6 border-t border-border/50">
            <h3 className="text-base font-semibold mb-4 text-foreground">Quantidade e Preço</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-muted/30 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <IconBoxMultiple className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium text-muted-foreground">Quantidade Entregue</span>
                </div>
                <p className="text-2xl font-bold text-foreground">{ppeDelivery.quantity}</p>
                {item.measureUnit && <p className="text-sm text-muted-foreground mt-1">{MEASURE_UNIT_LABELS[item.measureUnit]}</p>}
              </div>
              <div className="bg-muted/30 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <IconCurrencyDollar className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium text-muted-foreground">Preço Unitário</span>
                </div>
                {currentPrice !== null && currentPrice !== undefined ? (
                  <p className="text-2xl font-bold text-foreground">{formatCurrency(currentPrice)}</p>
                ) : (
                  <p className="text-sm text-muted-foreground">Não definido</p>
                )}
              </div>
            </div>
          </div>

          {/* Stock Info */}
          {item.quantity !== undefined && (
            <div className="pt-6 border-t border-border/50">
              <h3 className="text-base font-semibold mb-4 text-foreground">Estoque</h3>
              <div className="bg-muted/30 rounded-lg p-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-muted-foreground">Estoque Atual do Item</span>
                  <p className="text-lg font-bold text-foreground">
                    {item.quantity % 1 === 0
                      ? item.quantity.toLocaleString("pt-BR")
                      : item.quantity.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    {item.measureUnit && <span className="text-sm font-normal text-muted-foreground ml-1">{MEASURE_UNIT_LABELS[item.measureUnit]}</span>}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
