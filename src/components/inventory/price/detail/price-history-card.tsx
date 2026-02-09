import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { usePriceHistory } from "../../../../hooks";
import { IconCurrencyReal, IconLoader, IconHistory, IconArrowUp, IconArrowDown, IconMinus } from "@tabler/icons-react";
import { formatDate, formatCurrency } from "../../../../utils";
import type { Price } from "../../../../types";

interface PriceHistoryCardProps {
  itemId: string;
  itemName?: string;
  limit?: number;
  showViewMore?: boolean;
  onViewMore?: () => void;
}

export function PriceHistoryCard({ itemId, itemName, limit = 10, showViewMore = true, onViewMore }: PriceHistoryCardProps) {
  const { data: historyResponse, isLoading, error } = usePriceHistory(itemId, limit);

  const prices = historyResponse?.data || [];

  const getPriceChangeIcon = (currentPrice: number, previousPrice: number) => {
    if (currentPrice > previousPrice) {
      return <IconArrowUp className="h-3 w-3 text-red-500" />;
    } else if (currentPrice < previousPrice) {
      return <IconArrowDown className="h-3 w-3 text-green-500" />;
    } else {
      return <IconMinus className="h-3 w-3 text-muted-foreground" />;
    }
  };

  const getPriceChangePercentage = (currentPrice: number, previousPrice: number): string => {
    if (previousPrice === 0) return "";
    const change = ((currentPrice - previousPrice) / previousPrice) * 100;
    return change > 0 ? `+${change.toFixed(1)}%` : `${change.toFixed(1)}%`;
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <IconHistory className="h-5 w-5" />
            Histórico de Preços
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center py-8">
          <IconLoader className="h-6 w-6 animate-spin" />
          <span className="ml-2">Carregando histórico...</span>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <IconHistory className="h-5 w-5" />
            Histórico de Preços
          </CardTitle>
        </CardHeader>
        <CardContent className="text-center py-8">
          <p className="text-muted-foreground">Erro ao carregar histórico de preços</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <IconHistory className="h-5 w-5" />
          Histórico de Preços
        </CardTitle>
        {itemName && <CardDescription>Evolução dos preços para {itemName}</CardDescription>}
      </CardHeader>
      <CardContent>
        {prices.length === 0 ? (
          <div className="text-center py-8">
            <IconCurrencyReal className="h-12 w-12 text-muted-foreground mx-auto mb-2" />
            <p className="text-muted-foreground">Nenhum preço encontrado</p>
          </div>
        ) : (
          <div className="space-y-4">
            {prices.map((price: Price, index: number) => {
              const previousPrice = prices[index + 1];
              const isLatest = index === 0;

              return (
                <div key={price.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1">
                      <IconCurrencyReal className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">{formatCurrency(price.value)}</span>
                      {previousPrice && getPriceChangeIcon(price.value, previousPrice.value)}
                    </div>

                    {isLatest && (
                      <Badge variant="default" className="text-xs">
                        Atual
                      </Badge>
                    )}
                  </div>

                  <div className="text-right space-y-1">
                    <p className="text-sm text-muted-foreground">{formatDate(price.createdAt)}</p>
                    {previousPrice && (
                      <p
                        className={`text-xs ${price.value > previousPrice.value ? "text-red-500" : price.value < previousPrice.value ? "text-green-500" : "text-muted-foreground"}`}
                      >
                        {getPriceChangePercentage(price.value, previousPrice.value)}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}

            {showViewMore && prices.length === limit && (
              <div className="text-center pt-4">
                <Button variant="outline" size="sm" onClick={onViewMore}>
                  Ver mais histórico
                </Button>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
