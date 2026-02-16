import { useState, useEffect, useCallback } from "react";
import { useUsers } from "../../../../hooks";
import { getItems } from "../../../../api-client";
import { Combobox, type ComboboxOption } from "@/components/ui/combobox";
import { Checkbox } from "@/components/ui/checkbox";
import type { Item } from "../../../../types";
import { ITEM_CATEGORY_TYPE, PPE_TYPE, PPE_TYPE_ORDER, PPE_TYPE_LABELS, PPE_SIZE_LABELS, BOOT_SIZE_ORDER, PANTS_SIZE_ORDER, SHIRT_SIZE_ORDER, MASK_SIZE_ORDER } from "../../../../constants";
import { getPpeSizeFromMeasures } from "@/utils/ppe-size-helpers";

interface ItemSelectorDropdownProps {
  value?: string;
  onChange: (value: string | string[] | null | undefined) => void;
  placeholder?: string;
  userId?: string;
  disabled?: boolean;
}

interface UserPpeSizes {
  boots?: string;
  pants?: string;
  shirts?: string;
  sleeves?: string;
  mask?: string;
}

// Map PPE types to user size fields and their sort orders
const PPE_TYPE_TO_USER_SIZE_FIELD: Record<string, keyof UserPpeSizes> = {
  [PPE_TYPE.BOOTS]: "boots",
  [PPE_TYPE.PANTS]: "pants",
  [PPE_TYPE.SHIRT]: "shirts",
  [PPE_TYPE.SLEEVES]: "sleeves",
  [PPE_TYPE.MASK]: "mask",
};

// Get the correct sort order based on PPE type
const getSizeOrder = (ppeType: string | null, size: string | null): number => {
  if (!ppeType || !size) return 999;

  switch (ppeType) {
    case PPE_TYPE.BOOTS:
      return BOOT_SIZE_ORDER[size] || 999;
    case PPE_TYPE.PANTS:
      return PANTS_SIZE_ORDER[size] || 999;
    case PPE_TYPE.SHIRT:
      return SHIRT_SIZE_ORDER[size as keyof typeof SHIRT_SIZE_ORDER] || 999;
    case PPE_TYPE.MASK:
      return MASK_SIZE_ORDER[size] || 999;
    case PPE_TYPE.SLEEVES:
      // Sleeves use shirt sizes
      return SHIRT_SIZE_ORDER[size as keyof typeof SHIRT_SIZE_ORDER] || 999;
    default:
      return 999;
  }
};

export function ItemSelectorDropdown({ value, onChange, placeholder = "Selecione um EPI", userId, disabled = false }: ItemSelectorDropdownProps) {
  const [showAllSizes, setShowAllSizes] = useState(false);
  const [userSizes, setUserSizes] = useState<UserPpeSizes>({});
  const [queryKey, setQueryKey] = useState(0);

  // Fetch user with PPE sizes if userId is provided
  const { data: userResponse } = useUsers({
    where: { id: userId },
    include: { ppeSize: true },
    take: 1,
  });

  useEffect(() => {
    if (userResponse?.data?.[0]?.ppeSize) {
      // Get user's PPE size configuration
      const userPpeSize = userResponse.data[0].ppeSize;
      const sizes = {
        boots: userPpeSize.boots || undefined,
        pants: userPpeSize.pants || undefined,
        shirts: userPpeSize.shirts || undefined,
        sleeves: userPpeSize.sleeves || undefined,
        mask: userPpeSize.mask || undefined,
      };
      setUserSizes(sizes);
      // Don't automatically show all sizes if user has sizes configured
      setShowAllSizes(false);
    } else {
      // User has no PPE sizes configured
      setUserSizes({});
      setShowAllSizes(true); // Automatically show all sizes if user has no configuration
    }
  }, [userResponse]);

  // Check if user has any sizes configured
  const hasSizesConfigured = Object.keys(userSizes).length > 0 && Object.values(userSizes).some((size) => size);

  // Trigger refresh when showAllSizes changes
  useEffect(() => {
    setQueryKey((prev) => prev + 1);
  }, [showAllSizes]);

  // Async query function for the combobox
  const queryItems = useCallback(
    async (searchTerm: string, page = 1) => {
      if (!userId) {
        return {
          data: [],
          hasMore: false,
        };
      }

      try {
        const queryParams: any = {
          orderBy: { name: "asc" },
          page: page,
          take: 50,
          where: {
            category: {
              type: ITEM_CATEGORY_TYPE.PPE,
            },
            quantity: {
              gt: 0,
            },
          },
          include: {
            category: true,
            measures: true,
            brand: true,
          },
        };

        // Only add searchingFor if there's a search term
        if (searchTerm && searchTerm.trim()) {
          queryParams.searchingFor = searchTerm.trim();
        }

        const response = await getItems(queryParams);
        const items = response.data || [];
        const hasMore = response.meta?.hasNextPage || false;

        // Filter items based on user sizes if not showing all
        let filteredItems = items;

        if (!showAllSizes && hasSizesConfigured) {
          filteredItems = items.filter((item: Item) => {
            // If item doesn't have a ppeType, include it
            if (!item.ppeType) return true;

            // For OUTROS type, sizes are optional - always include these items
            if (item.ppeType === PPE_TYPE.OTHERS) return true;

            // Get the size field mapping for this PPE type
            const sizeField = PPE_TYPE_TO_USER_SIZE_FIELD[item.ppeType];

            // If no size field mapping exists for this type, include the item
            if (!sizeField) return true;

            // Check if the item's size matches the user's size
            const userSize = userSizes[sizeField];
            // Filter measures to only SIZE type
            const sizeMeasures = (item.measures || []).filter((m: any) => m.measureType === "SIZE");
            const itemSize = getPpeSizeFromMeasures(sizeMeasures);

            // Include items without size measures (size is optional)
            if (!itemSize) return true;

            // Match user's size with item's size
            return userSize && itemSize === userSize;
          });
        }

        // Convert items to options format
        const options: ComboboxOption[] = filteredItems.map((item: Item) => {
          // Check if this item matches user's size for its type
          // Filter measures to only SIZE type
          const sizeMeasures = (item.measures || []).filter((m: any) => m.measureType === "SIZE");
          const itemSize = getPpeSizeFromMeasures(sizeMeasures);
          const isMatchingSize = item.ppeType && userSizes[PPE_TYPE_TO_USER_SIZE_FIELD[item.ppeType]] === itemSize;

          // Format label
          const label = item.uniCode ? `${item.uniCode} - ${item.name}` : item.name;

          const typeOrder = item.ppeType ? PPE_TYPE_ORDER[item.ppeType as keyof typeof PPE_TYPE_ORDER] || 999 : 999;
          const sizeOrder = getSizeOrder(item.ppeType, itemSize);

          return {
            value: item.id,
            label: label,
            metadata: {
              displayName: item.name,
              uniCode: item.uniCode || "",
              quantity: item.quantity,
              size: itemSize,
              ppeType: item.ppeType || null,
              categoryName: item.category?.name || null,
              brandName: item.brand?.name || null,
              isMatchingSize,
              typeOrder,
              sizeOrder,
            },
          };
        });

        // Sort by name first, then by size order
        options.sort((a, b) => {
          // Compare names first (case-insensitive)
          const nameComparison = a.metadata.displayName.localeCompare(b.metadata.displayName, undefined, { sensitivity: 'base' });
          if (nameComparison !== 0) return nameComparison;

          // If names are the same, sort by size order
          return a.metadata.sizeOrder - b.metadata.sizeOrder;
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
    },
    [userId, userSizes, showAllSizes, hasSizesConfigured]
  );

  const handleValueChange = (value: string | string[] | null | undefined) => {
    if (Array.isArray(value) || value === null) return;
    onChange(value);
  };

  return (
    <div className="space-y-1.5">
      <Combobox
        async={true}
        queryKey={["item-selector", userId, queryKey]}
        queryFn={queryItems}
        value={value}
        onValueChange={handleValueChange}
        placeholder={userId ? placeholder : "Selecione um funcionário primeiro"}
        searchPlaceholder="Buscar EPI..."
        emptyText={userId ? "Nenhum EPI encontrado" : "Selecione um funcionário primeiro"}
        disabled={disabled || !userId}
        searchable={true}
        clearable={true}
        minSearchLength={0}
        pageSize={50}
        debounceMs={300}
        renderOption={(option: ComboboxOption) => {
          const meta = option.metadata as any;

          // Build the label: unicode - name - type • size
          let label = '';

          // Add unicode if available
          if (meta.uniCode) {
            label += meta.uniCode;
          }

          // Add name
          if (meta.displayName) {
            label += (label ? ' - ' : '') + meta.displayName;
          }

          // Add type
          if (meta.ppeType) {
            const typeLabel = PPE_TYPE_LABELS[meta.ppeType as keyof typeof PPE_TYPE_LABELS] || meta.ppeType;
            label += (label ? ' - ' : '') + typeLabel;
          }

          // Add size (or brand for OUTROS type) with bullet separator
          // Only add if it's different from unicode to avoid duplication
          if (meta.ppeType === PPE_TYPE.OTHERS) {
            if (meta.brandName && meta.brandName !== meta.uniCode) {
              label += (label ? ' • ' : '') + meta.brandName;
            }
          } else if (meta.size) {
            const sizeLabel = PPE_SIZE_LABELS[meta.size as keyof typeof PPE_SIZE_LABELS] || meta.size;
            // Only add size if it's different from unicode (to avoid showing "46" twice)
            if (sizeLabel !== meta.uniCode) {
              label += (label ? ' • ' : '') + sizeLabel;
            }
          }

          return (
            <div className="flex items-center justify-between w-full gap-2">
              {/* Left side with item info in single row */}
              <div className="flex items-center gap-1 flex-1 min-w-0">
                <span className="font-medium truncate">{label}</span>
              </div>
              {/* Right side with stock quantity */}
              <div className="flex items-center min-w-[110px]">
                <span className="text-sm font-semibold whitespace-nowrap">Estoque: {meta.quantity}</span>
              </div>
            </div>
          );
        }}
      />

      {/* Show checkbox for users with sizes configured */}
      {userId && hasSizesConfigured && (
        <div className="flex items-center space-x-2">
          <Checkbox id="show-all-sizes" checked={showAllSizes} onCheckedChange={(checked) => setShowAllSizes(Boolean(checked))} />
          <label
            htmlFor="show-all-sizes"
            className="text-sm text-muted-foreground leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer select-none"
          >
            Mostrar todos os tamanhos
          </label>
        </div>
      )}

      {/* Helper text when no sizes configured */}
      {userId && !hasSizesConfigured && (
        <p className="text-xs text-muted-foreground mt-1">
          <span className="font-enhanced-unicode">ℹ</span> O funcionário não tem tamanhos de EPI configurados. Mostrando todos os tamanhos.
        </p>
      )}
    </div>
  );
}
