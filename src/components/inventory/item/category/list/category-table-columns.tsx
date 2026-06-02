import React from "react";
import type { ItemCategory } from "../../../../../types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { IconPackage, IconCornerDownRight } from "@tabler/icons-react";
import { ITEM_CATEGORY_TYPE, ITEM_CATEGORY_TYPE_LABELS, ACCOUNTING_TYPE_LABELS } from "../../../../../constants";
import { useNavigate } from "react-router-dom";
import { routes } from "../../../../../constants";

export interface CategoryColumn {
  key: string;
  header: string;
  accessor: (category: ItemCategory) => React.ReactNode;
  sortable?: boolean;
  className?: string;
  align?: "left" | "center" | "right";
}

// Function to get default visible columns for categories
export function getDefaultVisibleColumns(): Set<string> {
  return new Set(["name", "type", "accountingType", "_count.items", "createdAt"]);
}

// Hook to get all available columns for categories
export function useCategoryTableColumns(): CategoryColumn[] {
  const navigate = useNavigate();

  return React.useMemo<CategoryColumn[]>(
    () => [
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
        className: "flex-1",
        align: "left",
      },
      {
        key: "accountingType",
        header: "TIPO CONTÁBIL",
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
        key: "type",
        header: "Tipo",
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
        className: "flex-1",
        align: "center",
      },
      {
        key: "actions",
        header: "Ações",
        accessor: (category: ItemCategory) => (
          <Button
            variant="outline"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              navigate(`${routes.inventory.products.list}?categories=${category.id}`);
            }}
            className="flex items-center gap-2"
          >
            <IconPackage className="h-4 w-4" />
            Ver Produtos
          </Button>
        ),
        sortable: false,
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
    ],
    [navigate],
  );
}
