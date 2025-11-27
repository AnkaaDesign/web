import React from "react";
import type { ItemCategory } from "../../../../../types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { IconPackage } from "@tabler/icons-react";
import { ITEM_CATEGORY_TYPE, ITEM_CATEGORY_TYPE_LABELS } from "../../../../../constants";
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
  return new Set(["name", "type", "_count.items", "createdAt"]);
}

// Hook to get all available columns for categories
export function useCategoryTableColumns(): CategoryColumn[] {
  const navigate = useNavigate();

  return React.useMemo<CategoryColumn[]>(
    () => [
      {
        key: "name",
        header: "NOME",
        accessor: (category: ItemCategory) => <div className="font-medium truncate">{category.name}</div>,
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
