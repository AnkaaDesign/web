import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { IconChartBar, IconPackage, IconShoppingCart, IconTrendingUp } from "@tabler/icons-react";
import type { Supplier } from "../../../../types";
import { cn } from "@/lib/utils";
import { formatCurrency } from "../../../../utils";

interface MetricsCardProps {
  supplier: Supplier;
  className?: string;
}

export function MetricsCard({ supplier, className }: MetricsCardProps) {
  // Calculate statistics from relationships - prioritize _count over array length
  const itemsCount = supplier._count?.items ?? supplier.items?.length ?? 0;
  const ordersCount = supplier._count?.orders ?? supplier.orders?.length ?? 0;
  const orderRulesCount = supplier._count?.orderRules ?? supplier.orderRules?.length ?? 0;

  // Calculate order totals if orders are included with their items
  const totalOrderValue =
    supplier.orders?.reduce((sum, order) => {
      const orderTotal =
        order.items?.reduce((orderSum, orderItem) => {
          return orderSum + orderItem.orderedQuantity * orderItem.price;
        }, 0) || 0;
      return sum + orderTotal;
    }, 0) || 0;

  // Get recent activity (most recent order)
  const mostRecentOrder = supplier.orders?.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())?.[0];

  return (
    <Card className={cn("shadow-sm border border-border flex flex-col", className)}>
      <CardHeader className="pb-6">
        <CardTitle className="flex items-center gap-2">
          <IconChartBar className="h-5 w-5 text-muted-foreground" />
          Estatísticas e Métricas
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0 flex-1">
        <div className="space-y-6">
          {/* Key Metrics */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 rounded-lg p-4 text-center border border-blue-200/50 dark:border-blue-700/50">
              <IconPackage className="h-8 w-8 text-blue-600 dark:text-blue-400 mx-auto mb-2" />
              <p className="text-2xl font-bold text-blue-700 dark:text-blue-300">{itemsCount}</p>
              <p className="text-sm font-medium text-blue-600 dark:text-blue-400">Produtos</p>
            </div>

            <div className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20 rounded-lg p-4 text-center border border-green-200/50 dark:border-green-700/50">
              <IconShoppingCart className="h-8 w-8 text-green-700 dark:text-green-300 mx-auto mb-2" />
              <p className="text-2xl font-bold text-green-700 dark:text-green-300">{ordersCount}</p>
              <p className="text-sm font-medium text-green-700 dark:text-green-300">Pedidos</p>
            </div>

            <div className="bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-900/20 dark:to-orange-800/20 rounded-lg p-4 text-center border border-orange-200/50 dark:border-orange-700/50">
              <IconTrendingUp className="h-8 w-8 text-orange-600 dark:text-orange-400 mx-auto mb-2" />
              <p className="text-2xl font-bold text-orange-700 dark:text-orange-300">{orderRulesCount}</p>
              <p className="text-sm font-medium text-orange-600 dark:text-orange-400">Regras Auto.</p>
            </div>
          </div>

          {/* Financial Information */}
          {totalOrderValue > 0 && (
            <div className="pt-6 border-t border-border/50">
              <h3 className="text-base font-semibold mb-4 text-foreground">Informações Financeiras</h3>
              <div className="bg-muted/50 rounded-lg px-4 py-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-muted-foreground">Total em Pedidos</span>
                  <span className="text-lg font-bold text-green-700 dark:text-green-300">{formatCurrency(totalOrderValue)}</span>
                </div>
              </div>
            </div>
          )}

          {/* Recent Activity */}
          {mostRecentOrder && (
            <div className="pt-6 border-t border-border/50">
              <h3 className="text-base font-semibold mb-4 text-foreground">Atividade Recente</h3>
              <div className="bg-muted/50 rounded-lg px-4 py-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-muted-foreground">Último Pedido</span>
                  <span className="text-sm font-semibold text-foreground">{new Date(mostRecentOrder.createdAt).toLocaleDateString("pt-BR")}</span>
                </div>
              </div>
            </div>
          )}

          {/* Empty State */}
          {itemsCount === 0 && ordersCount === 0 && (
            <div className="text-center py-8">
              <div className="p-4 bg-muted/30 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                <IconChartBar className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold mb-2 text-foreground">Nenhuma atividade</h3>
              <p className="text-sm text-muted-foreground">Este fornecedor ainda não possui produtos ou pedidos associados.</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
