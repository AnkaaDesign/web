import { useRef, useCallback } from "react";
import { Label } from "@/components/ui/label";
import { Combobox } from "@/components/ui/combobox";
import { getItems } from "../../../../../api-client";

interface MaintenanceEntitySelectorsProps {
  itemIds: string[];
  onItemIdsChange: (ids: string[]) => void;
}

export function MaintenanceEntitySelectors({ itemIds, onItemIdsChange }: MaintenanceEntitySelectorsProps) {
  // Create a stable cache for fetched items
  const cacheRef = useRef<Map<string, { label: string; value: string; description?: string }>>(new Map());

  // Async query function for items
  const queryItems = useCallback(async (searchTerm: string, page = 1) => {
    try {
      const pageSize = 50;
      const response = await getItems({
        orderBy: { name: "asc" },
        page: page,
        take: pageSize,
        where: {
          isActive: true,
          ...(searchTerm ? {
            OR: [
              { name: { contains: searchTerm, mode: "insensitive" } },
              { uniCode: { contains: searchTerm, mode: "insensitive" } },
            ],
          } : {}),
        },
      });

      const items = response.data || [];
      const hasMore = response.meta?.hasNextPage || false;

      const options = items.map((item) => {
        const option = {
          label: item.name,
          value: item.id,
          description: item.uniCode ? `Código: ${item.uniCode}` : undefined,
        };
        cacheRef.current.set(item.id, option);
        return option;
      });

      return {
        data: options,
        hasMore: hasMore,
      };
    } catch (error) {
      if (process.env.NODE_ENV !== 'production') {
        console.error("Error fetching items:", error);
      }
      return {
        data: [],
        hasMore: false,
      };
    }
  }, []);

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label className="text-sm font-medium">Itens de Manutenção</Label>
        <Combobox
          async
          queryKey={["items", "maintenance-filters"]}
          queryFn={queryItems}
          initialOptions={[]}
          minSearchLength={0}
          pageSize={50}
          debounceMs={300}
          mode="multiple"
          value={itemIds}
          onValueChange={onItemIdsChange}
          placeholder="Selecione os itens..."
          searchPlaceholder="Buscar itens..."
          searchable={true}
          className="w-full"
        />
        <p className="text-xs text-muted-foreground">Filtra manutenções dos itens selecionados</p>
      </div>
    </div>
  );
}
