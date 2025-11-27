import React from "react";
import type { ItemBrand } from "../../../../../types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { IconPackage } from "@tabler/icons-react";
import { routes } from "../../../../../constants";

// Define column interface directly to avoid import issues
interface BrandColumn {
  key: string;
  header: string;
  accessor: (brand: ItemBrand, navigate: (path: string) => void) => React.ReactNode;
  sortable?: boolean;
  className?: string;
  align?: "left" | "center" | "right";
}

export const createBrandColumns = (): BrandColumn[] => {
  return [
    {
      key: "name",
      header: "NOME",
      accessor: (brand: ItemBrand) => <div className="font-medium truncate">{brand.name}</div>,
      sortable: true,
      className: "flex-1",
      align: "left",
    },
    {
      key: "_count.items",
      header: "QTD. PRODUTOS",
      accessor: (brand: ItemBrand) => (
        <Badge variant="default" className="w-10 justify-center">
          {(brand as any)._count?.items || 0}
        </Badge>
      ),
      sortable: true,
      className: "flex-1",
      align: "center",
    },
    {
      key: "actions",
      header: "AÇÕES",
      accessor: (brand: ItemBrand, navigate) => (
        <Button
          variant="outline"
          size="sm"
          onClick={(e) => {
            e.stopPropagation();
            navigate(`${routes.inventory.products.list}?brands=${brand.id}`);
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
      key: "updatedAt",
      header: "ATUALIZADO EM",
      accessor: (brand: ItemBrand) => <div className="text-sm text-muted-foreground truncate">{new Date(brand.updatedAt).toLocaleDateString("pt-BR")}</div>,
      sortable: true,
      className: "flex-1",
      align: "left",
    },
    {
      key: "createdAt",
      header: "CRIADO EM",
      accessor: (brand: ItemBrand) => <div className="text-sm text-muted-foreground truncate">{new Date(brand.createdAt).toLocaleDateString("pt-BR")}</div>,
      sortable: true,
      className: "flex-1",
      align: "left",
    },
  ];
};

// Default visible columns
export const getDefaultVisibleColumns = (): Set<string> => {
  return new Set(["name", "_count.items", "createdAt"]);
};
