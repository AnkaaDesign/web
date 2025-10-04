import { useItemBrands, useItemCategories, useSuppliers } from "../../../../../hooks";
import { ITEM_CATEGORY_TYPE } from "../../../../../constants";
import { Label } from "@/components/ui/label";
import { Combobox } from "@/components/ui/combobox";
import { IconCategory, IconBrandAsana, IconTruck } from "@tabler/icons-react";

interface EntitySelectorsProps {
  categoryIds?: string[];
  onCategoryIdsChange: (ids: string[]) => void;
  brandIds?: string[];
  onBrandIdsChange: (ids: string[]) => void;
  supplierIds?: string[];
  onSupplierIdsChange: (ids: string[]) => void;
}

export function EntitySelectors({ categoryIds = [], onCategoryIdsChange, brandIds = [], onBrandIdsChange, supplierIds = [], onSupplierIdsChange }: EntitySelectorsProps) {
  // Load entity data
  const { data: categories, isLoading: loadingCategories } = useItemCategories({
    orderBy: { name: "asc" },
  });
  const { data: brands, isLoading: loadingBrands } = useItemBrands({
    orderBy: { name: "asc" },
  });
  const { data: suppliers, isLoading: loadingSuppliers } = useSuppliers({
    orderBy: { fantasyName: "asc" },
  });

  // Transform data for combobox
  const categoryOptions = [
    // Add "Sem categoria" option first
    { value: "null", label: "Sem categoria" },
    ...(categories?.data?.map((category) => ({
      value: category.id,
      label: `${category.name}${(category as any).type === ITEM_CATEGORY_TYPE.PPE ? " (EPI)" : ""}`,
    })) || []),
  ];

  const brandOptions = [
    // Add "Sem marca" option first
    { value: "null", label: "Sem marca" },
    ...(brands?.data?.map((brand) => ({
      value: brand.id,
      label: brand.name,
    })) || []),
  ];

  const supplierOptions = [
    // Add "Sem fornecedor" option first
    { value: "null", label: "Sem fornecedor" },
    ...(suppliers?.data?.map((supplier) => ({
      value: supplier.id,
      label: supplier.fantasyName,
    })) || []),
  ];

  return (
    <div className="space-y-4">
      {/* Categories */}
      <div className="space-y-2">
        <Label className="flex items-center gap-2">
          <IconCategory className="h-4 w-4" />
          Categorias
        </Label>
        <Combobox
          options={categoryOptions}
          value={categoryIds}
          onValueChange={onCategoryIdsChange}
          placeholder="Selecione categorias..."
          emptyText="Nenhuma categoria encontrada"
          searchPlaceholder="Buscar categorias..."
          mode="multiple"
          disabled={loadingCategories}
        />
        {categoryIds.length > 0 && (
          <div className="text-xs text-muted-foreground">
            {categoryIds.length} categoria{categoryIds.length !== 1 ? "s" : ""} selecionada{categoryIds.length !== 1 ? "s" : ""}
          </div>
        )}
      </div>

      {/* Brands */}
      <div className="space-y-2">
        <Label className="flex items-center gap-2">
          <IconBrandAsana className="h-4 w-4" />
          Marcas
        </Label>
        <Combobox
          options={brandOptions}
          value={brandIds}
          onValueChange={onBrandIdsChange}
          placeholder="Selecione marcas..."
          emptyText="Nenhuma marca encontrada"
          searchPlaceholder="Buscar marcas..."
          mode="multiple"
          disabled={loadingBrands}
        />
        {brandIds.length > 0 && (
          <div className="text-xs text-muted-foreground">
            {brandIds.length} marca{brandIds.length !== 1 ? "s" : ""} selecionada{brandIds.length !== 1 ? "s" : ""}
          </div>
        )}
      </div>

      {/* Suppliers */}
      <div className="space-y-2">
        <Label className="flex items-center gap-2">
          <IconTruck className="h-4 w-4" />
          Fornecedores
        </Label>
        <Combobox
          options={supplierOptions}
          value={supplierIds}
          onValueChange={onSupplierIdsChange}
          placeholder="Selecione fornecedores..."
          emptyText="Nenhum fornecedor encontrado"
          searchPlaceholder="Buscar fornecedores..."
          mode="multiple"
          disabled={loadingSuppliers}
        />
        {supplierIds.length > 0 && (
          <div className="text-xs text-muted-foreground">
            {supplierIds.length} fornecedor{supplierIds.length !== 1 ? "es" : ""} selecionado{supplierIds.length !== 1 ? "s" : ""}
          </div>
        )}
      </div>
    </div>
  );
}
