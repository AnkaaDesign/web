import { useCallback, useEffect, useMemo, useRef } from "react";
import { useQuery } from "@tanstack/react-query";

import { Combobox } from "@/components/ui/combobox";

import { getItems, getItemById } from "@/api-client";
import type { Item } from "@/types";

const ITEM_INCLUDE = {
  prices: true,
  measures: true,
  brand: true,
  category: true,
} as const;

interface CategoryItemSelectorProps {
  value: string | null;
  onValueChange: (value: string | null, item: Item | null) => void;
  /** Resolved category IDs to filter by (already looked up by name). */
  categoryIds: string[];
  /** Whether the parent is still resolving categoryIds. */
  categoriesLoading?: boolean;
  disabled?: boolean;
  placeholder?: string;
  /** Plural-cased label, e.g. "endurecedores", used in empty state copy. */
  emptyLabel?: string;
}

export function CategoryItemSelector({
  value,
  onValueChange,
  categoryIds,
  categoriesLoading,
  disabled,
  placeholder,
  emptyLabel,
}: CategoryItemSelectorProps) {
  const itemsCache = useRef<Map<string, Item>>(new Map());

  const { data: selectedItemData } = useQuery({
    queryKey: ["paint-mix", "item-detail", value],
    queryFn: async () => {
      if (!value) return null;
      const response = await getItemById(value, { include: ITEM_INCLUDE });
      return response.data || null;
    },
    enabled: !!value,
    staleTime: 5 * 60 * 1000,
  });

  // Notify parent whenever full item details load. Without this the math/cost
  // can't be computed on first paint after the user selects.
  useEffect(() => {
    if (selectedItemData) {
      itemsCache.current.set(selectedItemData.id, selectedItemData);
      onValueChange(selectedItemData.id, selectedItemData);
    }
    // We intentionally only react when fetched data arrives; onValueChange
    // identity is stable for our usage.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedItemData?.id]);

  const initialOptions = useMemo(
    () => (selectedItemData ? [selectedItemData] : []),
    [selectedItemData],
  );

  const getOptionLabel = useCallback((item: Item) => item.name, []);
  const getOptionValue = useCallback((item: Item) => item.id, []);

  const searchItems = useCallback(
    async (search: string, page: number = 1) => {
      if (categoryIds.length === 0) {
        return { data: [] as Item[], hasMore: false };
      }
      const params: any = {
        orderBy: { name: "asc" },
        page,
        take: 20,
        isActive: true,
        where: {
          categoryId: { in: categoryIds },
        },
        include: ITEM_INCLUDE,
      };
      if (search && search.trim()) {
        params.searchingFor = search.trim();
      }
      try {
        const response = await getItems(params);
        const items = response.data || [];
        items.forEach((it: Item) => itemsCache.current.set(it.id, it));
        return {
          data: items,
          hasMore: response.meta?.hasNextPage || false,
        };
      } catch {
        return { data: [] as Item[], hasMore: false };
      }
    },
    [categoryIds],
  );

  const renderItem = useCallback((item: Item) => {
    const brand = item.brand?.name;
    const code = item.uniCode;
    const parts: string[] = [];
    if (code) parts.push(code);
    parts.push(item.name);
    const main = parts.join(" ");
    return (
      <div className="flex items-center gap-1 w-full text-sm truncate">
        <span className="truncate">{main}</span>
        {brand && (
          <span className="text-muted-foreground whitespace-nowrap">
            {" "}- {brand}
          </span>
        )}
      </div>
    );
  }, []);

  const isDisabled =
    disabled || categoriesLoading || categoryIds.length === 0;

  const resolvedPlaceholder = useMemo(() => {
    if (categoriesLoading) return "Carregando categoria...";
    if (categoryIds.length === 0)
      return emptyLabel
        ? `Categoria "${emptyLabel}" não cadastrada`
        : "Categoria não cadastrada";
    return placeholder ?? "Selecione um item...";
  }, [categoriesLoading, categoryIds.length, placeholder, emptyLabel]);

  return (
    <Combobox<Item>
      value={value ?? undefined}
      onValueChange={(v) => {
        if (typeof v === "string") {
          const cached = itemsCache.current.get(v) ?? null;
          onValueChange(v, cached);
        } else {
          onValueChange(null, null);
        }
      }}
      mode="single"
      async={true}
      queryKey={[
        "paint-mix",
        "item-search",
        ...(categoryIds.length ? categoryIds : ["empty"]),
      ]}
      queryFn={searchItems}
      getOptionLabel={getOptionLabel}
      getOptionValue={getOptionValue}
      renderOption={renderItem}
      initialOptions={initialOptions}
      minSearchLength={0}
      pageSize={20}
      debounceMs={500}
      clearable={true}
      disabled={isDisabled}
      placeholder={resolvedPlaceholder}
      searchPlaceholder="Pesquisar..."
      emptyText="Nenhum item encontrado."
    />
  );
}
