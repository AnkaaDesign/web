import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { SimplePaginationAdvanced } from "@/components/ui/pagination-advanced";
import { IconPaint, IconCalendar, IconFlask } from "@tabler/icons-react";
import type { Paint, PaintProduction } from "../../../../types";
import { formatDate } from "../../../../utils";
import { cn } from "@/lib/utils";

interface PaintProductionHistoryCardProps {
  paint: Paint;
  className?: string;
  maxHeight?: string;
}

// Empty state
const EmptyState = () => (
  <div className="text-center py-12">
    <IconFlask className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
    <p className="text-muted-foreground mb-2">Nenhuma produção registrada</p>
    <p className="text-sm text-muted-foreground">As produções desta tinta aparecerão aqui quando forem realizadas</p>
  </div>
);

// Paint production item component
const PaintProductionItem = ({ production, formulaDescription }: { production: PaintProduction; formulaDescription: string }) => {
  return (
    <div className="p-4 rounded-lg border border-border hover:bg-muted/50 transition-colors">
      <div className="flex items-start justify-between mb-3">
        <div className="space-y-1 flex-1">
          <div className="flex items-center gap-2">
            <IconFlask className="h-4 w-4 text-muted-foreground" />
            <h4 className="font-medium">Produção de Tinta</h4>
          </div>
          <p className="text-sm text-muted-foreground">Fórmula: {formulaDescription}</p>
        </div>
        <Badge variant="default" className="bg-purple-500 text-white text-xs">
          {production.volumeLiters.toFixed(2)}L
        </Badge>
      </div>

      <div className="grid grid-cols-2 gap-3 text-sm">
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <IconCalendar className="h-3.5 w-3.5" />
          <span>Produzido em {formatDate(production.createdAt)}</span>
        </div>

        <div className="flex items-center gap-1.5 text-muted-foreground">
          <IconFlask className="h-3.5 w-3.5" />
          <span>Volume: {production.volumeLiters.toFixed(2)} litros</span>
        </div>
      </div>
    </div>
  );
};

export function PaintProductionHistoryCard({ paint, className, maxHeight = "400px" }: PaintProductionHistoryCardProps) {
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  // Get all paint production records from formulas
  const productionItems = useMemo(() => {
    const items: Array<{ production: PaintProduction; formulaDescription: string }> = [];

    // Add paint productions from formulas
    if (paint.formulas) {
      paint.formulas.forEach((formula) => {
        if (formula.paintProduction) {
          formula.paintProduction.forEach((production) => {
            items.push({
              production,
              formulaDescription: formula.description,
            });
          });
        }
      });
    }

    // Sort by creation date (newest first)
    return items.sort((a, b) => new Date(b.production.createdAt).getTime() - new Date(a.production.createdAt).getTime());
  }, [paint.formulas]);

  // Calculate statistics
  const stats = useMemo(() => {
    const total = productionItems.length;

    // Calculate total volume produced
    const totalVolume = productionItems.reduce((sum, item) => sum + item.production.volumeLiters, 0);

    // Get most recent production date
    const lastProduction = productionItems.length > 0 ? productionItems[0].production.createdAt : null;

    return { total, totalVolume, lastProduction };
  }, [productionItems]);

  // Paginate items
  const paginatedItems = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    return productionItems.slice(startIndex, endIndex);
  }, [productionItems, currentPage, pageSize]);

  // Calculate total pages
  const totalPages = Math.ceil(productionItems.length / pageSize);

  // Handle page change
  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  // Handle page size change
  const handlePageSizeChange = (size: number) => {
    setPageSize(size);
    setCurrentPage(1); // Reset to first page
  };

  return (
    <Card className={cn("shadow-sm border border-border flex flex-col", className)} level={1}>
      <CardHeader className="pb-4 flex-shrink-0">
        <CardTitle className="flex items-center gap-3 text-xl">
          <div className="p-2 rounded-lg bg-primary/10">
            <IconPaint className="h-5 w-5 text-primary" />
          </div>
          Histórico de Produção
        </CardTitle>

        {/* Statistics */}
        {stats.total > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4">
            <div className="bg-card-nested rounded-lg p-3 border border-border">
              <p className="text-xs text-muted-foreground mb-1">Total de Produções</p>
              <p className="text-lg font-semibold text-purple-600 dark:text-purple-400">{stats.total}</p>
            </div>
            <div className="bg-card-nested rounded-lg p-3 border border-border">
              <p className="text-xs text-muted-foreground mb-1">Volume Total</p>
              <p className="text-lg font-semibold text-blue-600 dark:text-blue-400">{stats.totalVolume.toFixed(2)}L</p>
            </div>
            <div className="bg-card-nested rounded-lg p-3 border border-border">
              <p className="text-xs text-muted-foreground mb-1">Última Produção</p>
              <p className="text-lg font-semibold text-green-600 dark:text-green-400">{stats.lastProduction ? formatDate(stats.lastProduction) : "N/A"}</p>
            </div>
          </div>
        )}
      </CardHeader>

      <CardContent className="pt-0 flex-grow flex flex-col min-h-0">
        {productionItems.length === 0 ? (
          <EmptyState />
        ) : (
          <>
            <ScrollArea className="pr-4 flex-grow" style={{ maxHeight }}>
              <div className="space-y-3">
                {paginatedItems.map((item, index) => (
                  <div key={item.production.id}>
                    <PaintProductionItem production={item.production} formulaDescription={item.formulaDescription} />
                    {index < paginatedItems.length - 1 && <Separator className="mt-3" />}
                  </div>
                ))}
              </div>
            </ScrollArea>

            {/* Pagination Footer */}
            {productionItems.length > pageSize && (
              <div className="pt-3 mt-3 border-t border-border">
                <SimplePaginationAdvanced
                  currentPage={currentPage}
                  totalPages={totalPages}
                  onPageChange={handlePageChange}
                  pageSize={pageSize}
                  totalItems={productionItems.length}
                  pageSizeOptions={[5, 10, 20, 50]}
                  onPageSizeChange={handlePageSizeChange}
                  showPageSizeSelector={true}
                  showGoToPage={false}
                  showPageInfo={true}
                />
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
