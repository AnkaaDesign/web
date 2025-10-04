import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { routes } from "../../../constants";
import { useItemsInfinite } from "../../../hooks";
import type { Item } from "../../../types";
import { VirtualizedTable } from "@/components/ui/virtualized-table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { IconPlus, IconAlertTriangle } from "@tabler/icons-react";
import { createItemColumns } from "@/components/inventory/item/list/item-table-columns";
import { ItemListSkeleton } from "@/components/inventory/item/list/item-list-skeleton";
import { useVirtualizedInfiniteList } from "@/components/ui/virtualized-list";

export default function ProductListInfinite() {
  const navigate = useNavigate();

  // Selection state
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());

  // Use infinite query for items
  const infiniteQuery = useItemsInfinite({
    limit: 100, // Items per page
    include: {
      brand: true,
      category: true,
      supplier: true,
      measures: true,
      prices: {
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  });

  // Flatten pages data
  const items = useMemo(() => {
    return infiniteQuery.data?.pages?.flatMap((page: any) => page.data || []) || [];
  }, [infiniteQuery.data]);

  // Setup infinite scrolling
  const { onEndReached } = useVirtualizedInfiniteList(infiniteQuery.fetchNextPage, infiniteQuery.hasNextPage ?? false, infiniteQuery.isFetchingNextPage);

  // Get all columns
  const allColumns = createItemColumns();

  // For demo, show a subset of columns
  const visibleColumns = useMemo(() => new Set(["uniCode", "name", "brand.name", "quantity", "price", "totalPrice", "isActive"]), []);

  const columns = useMemo(() => {
    return allColumns.filter((col) => visibleColumns.has(col.key));
  }, [visibleColumns, allColumns]);

  // Selection handlers
  const isAllSelected = items.length > 0 && items.every((item: any) => selectedItems.has(item.id));
  const isPartiallySelected = items.some((item: any) => selectedItems.has(item.id)) && !isAllSelected;

  const handleSelectAll = () => {
    if (isAllSelected) {
      setSelectedItems(new Set());
    } else {
      setSelectedItems(new Set(items.map((item: any) => item.id)));
    }
  };

  const handleSelectItem = (itemId: string) => {
    const newSelection = new Set(selectedItems);
    if (newSelection.has(itemId)) {
      newSelection.delete(itemId);
    } else {
      newSelection.add(itemId);
    }
    setSelectedItems(newSelection);
  };

  const handleRowClick = (item: Item) => {
    navigate(routes.inventory.products.details(item.id));
  };

  if (infiniteQuery.isError) {
    return (
      <Card className="h-full flex flex-col">
        <CardHeader className="px-8 py-6 border-b">
          <CardTitle>Produtos (Lista Infinita)</CardTitle>
        </CardHeader>
        <CardContent className="flex-1 flex items-center justify-center">
          <div className="text-center text-destructive">
            <IconAlertTriangle className="h-8 w-8 mx-auto mb-4" />
            <div className="text-lg font-medium mb-2">Erro ao carregar produtos</div>
            <div className="text-sm">Tente novamente mais tarde.</div>
            <Button variant="outline" className="mt-4" onClick={() => infiniteQuery.refetch()}>
              Tentar Novamente
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  const emptyComponent = (
    <div className="flex items-center justify-center h-64 text-muted-foreground">
      <div className="text-center">
        <div className="text-lg font-medium mb-2">Nenhum produto encontrado</div>
        <Button onClick={() => navigate(routes.inventory.products.create)}>
          <IconPlus className="h-4 w-4 mr-2" />
          Criar Primeiro Produto
        </Button>
      </div>
    </div>
  );

  // Custom row renderer with loading indicator for infinite scroll
  const renderCustomRow = (_item: Item, index: number, _virtualRow: any) => {
    const isLastItem = index === items.length - 1;
    const showLoadingIndicator = isLastItem && infiniteQuery.hasNextPage && !infiniteQuery.isFetchingNextPage;

    if (showLoadingIndicator) {
      // Trigger load more when last item becomes visible
      onEndReached();
    }

    return null; // Use default row rendering
  };

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="px-8 py-6 border-b flex-shrink-0">
        <div className="flex items-start justify-between">
          <div className="flex flex-col gap-2">
            <CardTitle className="text-2xl font-bold">Produtos (Lista Infinita)</CardTitle>
            <Breadcrumb />
            <div className="text-sm text-muted-foreground">
              {items.length} produtos carregados
              {infiniteQuery.hasNextPage && " • Role para carregar mais"}
            </div>
          </div>
          <Button onClick={() => navigate(routes.inventory.products.create)}>
            <IconPlus className="h-4 w-4 mr-2" />
            Novo Produto
          </Button>
        </div>
      </CardHeader>

      <CardContent className="flex-1 p-0 overflow-hidden">
        <VirtualizedTable
          data={items}
          columns={columns}
          getRowId={(item) => item.id}
          rowHeight={48}
          overscan={10}
          className="h-full"
          onRowClick={handleRowClick}
          renderRow={renderCustomRow}
          isLoading={infiniteQuery.isLoading}
          loadingComponent={<ItemListSkeleton />}
          emptyComponent={emptyComponent}
          // Selection props
          selectedItems={selectedItems}
          onSelectItem={handleSelectItem}
          onSelectAll={handleSelectAll}
          isAllSelected={isAllSelected}
          isPartiallySelected={isPartiallySelected}
          showSelection={true}
        />

        {/* Loading indicator for next page */}
        {infiniteQuery.isFetchingNextPage && (
          <div className="absolute bottom-0 left-0 right-0 p-4 bg-background/80 backdrop-blur-sm border-t">
            <div className="text-center text-sm text-muted-foreground">Carregando mais produtos...</div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
