import React from "react";
import type { ItemCategory } from "../../../../../types";
import { Badge } from "@/components/ui/badge";
import { IconCornerDownRight } from "@tabler/icons-react";
import { ITEM_CATEGORY_TYPE, ITEM_CATEGORY_TYPE_LABELS, ACCOUNTING_TYPE_LABELS } from "../../../../../constants";
import { usePrivileges } from "@/hooks/common/use-privileges";

export interface CategoryColumn {
  key: string;
  header: string;
  accessor: (category: ItemCategory) => React.ReactNode;
  sortable?: boolean;
  className?: string;
  align?: "left" | "center" | "right";
}

// Function to get default visible columns for categories.
// "Grupo Contábil" (accountingType) is the headline type users care about; the
// physical ItemCategoryType ("Natureza") is secondary and hidden by default.
export function getDefaultVisibleColumns(): Set<string> {
  return new Set(["name", "accountingType", "_count.items", "createdAt"]);
}

// Hook to get all available columns for categories
export function useCategoryTableColumns(): CategoryColumn[] {
  // "Grupo Contábil" (accountingType) is the chart-of-accounts rollup — ADMIN-only.
  // Warehouse and other non-admin sectors must not see it.
  const { isAdmin } = usePrivileges();

  return React.useMemo<CategoryColumn[]>(() => {
    const columns: CategoryColumn[] = [
      {
        key: "name",
        header: "NOME",
        // Subcategorias (level 2) are indented under their parent Categoria to show the tree.
        accessor: (category: ItemCategory) => (
          <div className={`font-medium truncate flex items-center gap-1 ${category.categoryLevel === 2 ? "pl-5 text-muted-foreground" : ""}`}>
            {category.categoryLevel === 2 && <IconCornerDownRight className="h-3.5 w-3.5 shrink-0 opacity-60" />}
            {category.name}
          </div>
        ),
        sortable: true,
        // Name is the dominant column (long nested subcategory names). The table is
        // `table-fixed`, which ignores flex — so an explicit width is required to widen it.
        className: "w-[48%] min-w-[300px]",
        align: "left",
      },
      {
        // Accounting/contábil group — the headline type users care about.
        key: "accountingType",
        header: "Grupo Contábil",
        accessor: (category: ItemCategory) =>
          category.accountingType ? (
            <Badge variant="secondary" className="text-xs">
              {ACCOUNTING_TYPE_LABELS[category.accountingType] || category.accountingType}
            </Badge>
          ) : (
            <span className="text-muted-foreground">-</span>
          ),
        sortable: true,
        className: "flex-1",
        align: "left",
      },
      {
        // The physical ItemCategoryType (REGULAR/TOOL/PPE) — the item's nature.
        key: "type",
        header: "Natureza",
        accessor: (category: ItemCategory) => (
          <div className="truncate">
            <Badge variant={category.type === ITEM_CATEGORY_TYPE.PPE ? "default" : category.type === ITEM_CATEGORY_TYPE.TOOL ? "destructive" : "secondary"} className="text-xs">
              {ITEM_CATEGORY_TYPE_LABELS[category.type as ITEM_CATEGORY_TYPE] || category.type}
            </Badge>
          </div>
        ),
        sortable: true,
        className: "flex-1",
        align: "left",
      },
      {
        key: "_count.items",
        header: "QTD. PRODUTOS",
        accessor: (category: ItemCategory) => (
          <Badge variant="default" className="w-10 justify-center">
            {(category as any)._count?.items || 0}
          </Badge>
        ),
        sortable: true,
        // No explicit width → table-fixed splits the space left by NOME equally with the
        // other non-name columns. Left-aligned like the rest.
        className: "flex-1",
        align: "left",
      },
      {
        key: "createdAt",
        header: "CRIADO EM",
        accessor: (category: ItemCategory) => <div className="text-sm text-muted-foreground truncate">{new Date(category.createdAt).toLocaleDateString("pt-BR")}</div>,
        sortable: true,
        className: "flex-1",
        align: "left",
      },
      {
        key: "updatedAt",
        header: "ATUALIZADO EM",
        accessor: (category: ItemCategory) => <div className="text-sm text-muted-foreground truncate">{new Date(category.updatedAt).toLocaleDateString("pt-BR")}</div>,
        sortable: true,
        className: "flex-1",
        align: "left",
      },
    ];

    // Restrict the accounting/contábil column to admins only.
    return isAdmin ? columns : columns.filter((column) => column.key !== "accountingType");
  }, [isAdmin]);
}
