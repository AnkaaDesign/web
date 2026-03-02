import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { IconPackage, IconAlertTriangleFilled } from "@tabler/icons-react";
import { DashboardCardList, DashboardPagination } from "./dashboard-card-list";
import { determineStockLevel, getStockLevelTextColor } from "../../utils/stock-level";
import { STOCK_LEVEL, STOCK_LEVEL_LABELS } from "../../constants";
import type { HomeDashboardLowStockItem } from "../../types";

const PAGE_SIZE = 20;

function getFilterUrl() {
  const levels = JSON.stringify([
    STOCK_LEVEL.NEGATIVE_STOCK,
    STOCK_LEVEL.OUT_OF_STOCK,
    STOCK_LEVEL.CRITICAL,
    STOCK_LEVEL.LOW,
  ]);
  return `/estoque/produtos?isActive=true&stockLevels=${encodeURIComponent(levels)}`;
}

interface LowStockListProps {
  items: HomeDashboardLowStockItem[];
  totalCount?: number;
}

export function LowStockList({ items, totalCount }: LowStockListProps) {
  const navigate = useNavigate();
  const [page, setPage] = useState(0);

  const totalPages = Math.ceil(items.length / PAGE_SIZE);
  const pagedItems = items.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  return (
    <DashboardCardList
      title="Estoque Baixo"
      icon={<IconPackage className="h-4 w-4 text-yellow-500" />}
      viewAllLink={getFilterUrl()}
      emptyMessage="Nenhum item com estoque baixo"
      isEmpty={items.length === 0}
      footer={
        <DashboardPagination
          totalItems={items.length}
          page={page}
          pageSize={PAGE_SIZE}
          onPageChange={setPage}
        />
      }
    >
      {/* Table header */}
      <div className="sticky top-0 z-10 grid grid-cols-[1.5fr_minmax(0,0.8fr)_minmax(0,0.5fr)_minmax(0,0.8fr)] gap-x-3 px-4 py-2 bg-secondary border-b border-border text-[10px] font-semibold uppercase tracking-wider text-muted-foreground whitespace-nowrap">
        <span>Item</span>
        <span>Marca</span>
        <span>Qnt</span>
        <span>Consumo Mensal</span>
      </div>
      {/* Table rows */}
      {pagedItems.map((item, index) => {
        const stockLevel = determineStockLevel(
          item.quantity,
          item.reorderPoint || null,
          item.maxQuantity,
          false,
        );
        const textColor = getStockLevelTextColor(stockLevel);
        const stockLabel = STOCK_LEVEL_LABELS[stockLevel] || "";

        return (
          <div
            key={item.id}
            className={`grid grid-cols-[1.5fr_minmax(0,0.8fr)_minmax(0,0.5fr)_minmax(0,0.8fr)] gap-x-3 items-center px-4 py-2 hover:bg-secondary/50 cursor-pointer border-b border-border last:border-b-0 transition-colors ${index % 2 === 1 ? "bg-muted/30" : ""}`}
            onClick={() => navigate(`/estoque/itens/${item.id}`)}
          >
            <span className="text-sm text-foreground truncate">{item.name}</span>
            <span className="text-sm text-foreground truncate">
              {item.brandName || "—"}
            </span>
            <div className="flex items-center gap-1.5" title={stockLabel}>
              <IconAlertTriangleFilled className={`w-3.5 h-3.5 flex-shrink-0 ${textColor}`} />
              <span className={`text-sm tabular-nums ${textColor}`}>
                {item.quantity % 1 === 0 ? item.quantity.toLocaleString("pt-BR") : item.quantity.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
            <span className="text-sm text-foreground tabular-nums">
              {item.monthlyConsumption > 0
                ? item.monthlyConsumption.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })
                : "—"}
            </span>
          </div>
        );
      })}
    </DashboardCardList>
  );
}
