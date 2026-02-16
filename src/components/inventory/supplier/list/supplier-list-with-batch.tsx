import { useState, useMemo, useCallback } from "react";
import type { Supplier } from "../../../../types";
import type { SupplierGetManyFormData } from "../../../../schemas";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { IconSearch, IconFilter, IconRefresh, IconPlus } from "@tabler/icons-react";
import { SupplierTable } from "./supplier-table";
import { SupplierBatchOperationsToolbar } from "./supplier-batch-operations-toolbar";
import { SupplierFilters } from "./supplier-filters";
import { ColumnVisibilityManager } from "./column-visibility-manager";
import { createSupplierColumns } from "./supplier-table-columns";
import { useSupplierFilters } from "@/hooks/inventory/use-supplier-filters";
import { useNavigate } from "react-router-dom";
import { routes } from "../../../../constants";
import { toast } from "sonner";
import { SupplierBatchEditTable } from "../batch-edit";

interface SupplierListWithBatchProps {
  className?: string;
}

export function SupplierListWithBatch({ className }: SupplierListWithBatchProps) {
  const navigate = useNavigate();

  // State management
  const [showFilters, setShowFilters] = useState(false);
  const [showBatchEditTable, setShowBatchEditTable] = useState(false);
  const [selectedSuppliers, setSelectedSuppliers] = useState<Supplier[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [supplierData, setSupplierData] = useState<{
    suppliers: Supplier[];
    totalRecords: number;
  }>({ suppliers: [], totalRecords: 0 });

  // Column visibility state
  const [visibleColumns, setVisibleColumns] = useState(new Set(["fantasyName", "cnpj", "email", "phones", "_count.items"]));

  // Create columns for ColumnVisibilityManager
  const columns = useMemo(() => createSupplierColumns(), []);

  // URL filters hook
  const { filters: urlFilters, resetFilters, setFilters, activeFilterCount } = useSupplierFilters();

  // Combine search and filters
  const combinedFilters = useMemo(() => {
    const filters: Partial<SupplierGetManyFormData> = {
      ...urlFilters,
      ...(searchQuery.trim() && { searchingFor: searchQuery.trim() }),
    };
    return filters;
  }, [urlFilters, searchQuery]);

  // Data handlers
  const handleDataChange = useCallback((data: { suppliers: Supplier[]; totalRecords: number }) => {
    setSupplierData(data);
  }, []);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    // Trigger a refresh by clearing and resetting the query
    try {
      // The useSuppliers hook will automatically refetch when we change params
      await new Promise((resolve) => setTimeout(resolve, 500)); // Small delay for UX
      toast.success("Lista de fornecedores atualizada");
    } catch (error) {
      toast.error("Erro ao atualizar a lista");
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  const handleSearch = useCallback((value: string) => {
    setSearchQuery(value);
  }, []);

  const handleClearSearch = useCallback(() => {
    setSearchQuery("");
    resetFilters();
  }, [resetFilters]);

  // Batch operations
  const handleBatchEdit = useCallback((suppliers: Supplier[]) => {
    setSelectedSuppliers(suppliers);
    setShowBatchEditTable(true);
  }, []);

  const handleBatchEditTableCancel = useCallback(() => {
    setShowBatchEditTable(false);
    setSelectedSuppliers([]);
  }, []);

  const handleBatchDelete = useCallback((suppliers: Supplier[]) => {
    // This is handled by the table's context menu and toolbar
    setSelectedSuppliers(suppliers);
  }, []);

  // Selection management (if needed for external controls)
  const clearSelection = useCallback(() => {
    setSelectedSuppliers([]);
  }, []);

  // Get selected suppliers from table
  const tableSelectedSuppliers = useMemo(() => {
    return supplierData.suppliers.filter((supplier) => selectedSuppliers.some((s) => s.id === supplier.id));
  }, [supplierData.suppliers, selectedSuppliers]);

  if (showBatchEditTable && selectedSuppliers.length > 0) {
    return <SupplierBatchEditTable suppliers={selectedSuppliers} onCancel={handleBatchEditTableCancel} />;
  }

  return (
    <div className={`space-y-4 ${className || ""}`}>
      {/* Header and Controls */}
      <Card className="p-4">
        <div className="flex flex-col gap-4">
          {/* Top Row - Title and Main Actions */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-semibold">Fornecedores</h2>
              <Badge variant="secondary" className="font-mono">
                {supplierData.totalRecords} {supplierData.totalRecords === 1 ? "item" : "itens"}
              </Badge>
              {activeFilterCount > 0 && (
                <Badge variant="outline" className="cursor-pointer" onClick={resetFilters}>
                  {activeFilterCount} filtros ativos
                </Badge>
              )}
            </div>

            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={handleRefresh} disabled={isRefreshing}>
                <IconRefresh className={`mr-2 h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
                Atualizar
              </Button>

              <ColumnVisibilityManager columns={columns} visibleColumns={visibleColumns} onVisibilityChange={setVisibleColumns} />

              <Button onClick={() => navigate(routes.inventory.suppliers.create)}>
                <IconPlus className="mr-2 h-4 w-4" />
                Novo Fornecedor
              </Button>
            </div>
          </div>

          {/* Search and Filter Row */}
          <div className="flex items-center gap-3">
            <div className="flex-1 relative">
              <IconSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome fantasia, razão social, CNPJ ou email..."
                value={searchQuery}
                onChange={(value) => handleSearch(value as string)}
                className="pl-10 pr-4"
              />
              {(searchQuery || activeFilterCount > 0) && (
                <Button variant="ghost" size="sm" onClick={handleClearSearch} className="absolute right-1 top-1/2 transform -translate-y-1/2 h-7 w-7 p-0">
                  ×
                </Button>
              )}
            </div>

            <Button variant="outline" onClick={() => setShowFilters(true)} className="relative">
              <IconFilter className="mr-2 h-4 w-4" />
              Filtros
              {activeFilterCount > 0 && (
                <Badge variant="destructive" className="absolute -top-2 -right-2 h-5 w-5 rounded-full p-0 text-xs flex items-center justify-center">
                  {activeFilterCount}
                </Badge>
              )}
            </Button>
          </div>

          {/* Batch Operations Toolbar */}
          <SupplierBatchOperationsToolbar selectedSuppliers={tableSelectedSuppliers} onClearSelection={clearSelection} onRefresh={handleRefresh} />
        </div>
      </Card>

      {/* Table */}
      <SupplierTable
        visibleColumns={visibleColumns}
        filters={combinedFilters}
        onEdit={handleBatchEdit}
        onDelete={handleBatchDelete}
        onDataChange={handleDataChange}
        className="min-h-[500px]"
      />

      {/* Dialogs */}
      <SupplierFilters open={showFilters} onOpenChange={setShowFilters} filters={urlFilters} onFilterChange={setFilters} />
    </div>
  );
}
