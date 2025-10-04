import { useState, useEffect, useMemo } from "react";
import { useItems, useUsers } from "../../../../hooks";
import { Combobox } from "@/components/ui/combobox";
import { Checkbox } from "@/components/ui/checkbox";
import type { Item } from "../../../../types";
import { ITEM_CATEGORY_TYPE, PPE_TYPE, PPE_TYPE_ORDER, PPE_TYPE_LABELS, BOOT_SIZE_ORDER, PANTS_SIZE_ORDER, SHIRT_SIZE_ORDER, MASK_SIZE_ORDER } from "../../../../constants";
import { getPpeSizeFromMeasures } from "@/utils/ppe-size-helpers";

interface ItemSelectorDropdownProps {
  value?: string;
  onChange: (value: string | undefined) => void;
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

  // Build filters for PPE items - use simple query to avoid Zod validation issues
  // We'll filter for PPE and stock on client side
  const baseFilters = {
    take: 100, // Maximum allowed by API
    include: {
      category: true,
      measures: true,
    },
  };

  // If not showing all and user has sizes configured, filter by matching PPE type and size
  if (!showAllSizes && hasSizesConfigured) {
    // For now, we'll fetch all PPE items and filter on the client side
    // This is a workaround for the complex query serialization issue
    // TODO: Fix backend query parsing for complex nested OR conditions
    // Note: We're still fetching all items but will filter them in the sortedOptions
    // This ensures the user sees only their configured sizes unless they check "show all"
  }

  const itemFilters = baseFilters;

  // Fetch items with filters
  const { data: itemsResponse, isLoading } = useItems(itemFilters);

  const items = itemsResponse?.data || [];

  // Process and sort items
  const sortedOptions = useMemo(() => {
    // First, filter for PPE items only and items with stock
    const ppeItems = items.filter((item: Item) => {
      // Check if item is PPE type and has stock
      return item.category?.type === ITEM_CATEGORY_TYPE.PPE && item.quantity > 0;
    });

    // Filter items based on user sizes if not showing all
    let filteredItems = ppeItems;

    if (!showAllSizes && hasSizesConfigured) {
      filteredItems = ppeItems.filter((item: Item) => {
        if (!item.ppeType) return false;
        const sizeField = PPE_TYPE_TO_USER_SIZE_FIELD[item.ppeType];
        if (!sizeField) return false;
        const userSize = userSizes[sizeField];
        // Filter measures to only SIZE type on client side
        const sizeMeasures = (item.measures || []).filter((m: any) => m.measureType === "SIZE");
        const itemSize = getPpeSizeFromMeasures(sizeMeasures);
        return userSize && itemSize === userSize;
      });
    }

    const options = filteredItems.map((item: Item) => {
      // Check if this item matches user's size for its type
      // Filter measures to only SIZE type on client side
      const sizeMeasures = (item.measures || []).filter((m: any) => m.measureType === "SIZE");
      const itemSize = getPpeSizeFromMeasures(sizeMeasures);
      const isMatchingSize = item.ppeType && userSizes[PPE_TYPE_TO_USER_SIZE_FIELD[item.ppeType]] === itemSize;

      // Format label - we'll handle the display in renderOption
      const label = item.uniCode ? `${item.uniCode} - ${item.name}` : item.name;

      return {
        value: item.id,
        label: label,
        displayName: item.name,
        uniCode: item.uniCode || "",
        quantity: item.quantity,
        size: itemSize,
        ppeType: item.ppeType || null,
        categoryName: item.category?.name || null,
        isMatchingSize,
        typeOrder: item.ppeType ? PPE_TYPE_ORDER[item.ppeType as keyof typeof PPE_TYPE_ORDER] || 999 : 999,
        sizeOrder: getSizeOrder(item.ppeType, itemSize),
      };
    });

    // Sort by type order, then size order, then name
    return options.sort((a, b) => {
      if (a.typeOrder !== b.typeOrder) return a.typeOrder - b.typeOrder;
      if (a.sizeOrder !== b.sizeOrder) return a.sizeOrder - b.sizeOrder;
      return a.label.localeCompare(b.label);
    });
  }, [items, userSizes, showAllSizes, hasSizesConfigured]);

  return (
    <div className="space-y-1.5">
      <Combobox
        options={sortedOptions}
        value={value}
        onValueChange={onChange}
        placeholder={userId ? placeholder : "Selecione um funcionário primeiro"}
        searchPlaceholder="Buscar EPI..."
        emptyText={
          userId
            ? items.length === 0
              ? !showAllSizes && hasSizesConfigured
                ? "Nenhum EPI disponível no tamanho do funcionário"
                : "Nenhum EPI disponível"
              : "Nenhum EPI encontrado"
            : "Selecione um funcionário primeiro"
        }
        disabled={disabled || isLoading || !userId}
        searchable={true}
        clearable={true}
        renderOption={(option: any) => {
          const hasTypeOrSize = option.ppeType || option.size;

          return (
            <div className={`flex items-center justify-between w-full gap-2 min-h-[48px] ${!hasTypeOrSize ? "items-center" : ""}`}>
              {/* Left side with item info */}
              <div className={`flex flex-col flex-1 min-w-0 py-1 ${!hasTypeOrSize ? "justify-center" : ""}`}>
                {/* Main row with unicode (if available) and name */}
                <div className="flex items-center gap-2">
                  {option.uniCode && <span className="font-mono text-xs text-muted-foreground group-hover:text-white">{option.uniCode}</span>}
                  <span className="font-medium truncate">{option.displayName}</span>
                </div>
                {/* Secondary row with PPE type and size - only render if has type or size */}
                {hasTypeOrSize && (
                  <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400 group-hover:text-white mt-0.5 h-4">
                    {option.ppeType && <span className="font-medium">{PPE_TYPE_LABELS[option.ppeType as keyof typeof PPE_TYPE_LABELS] || option.ppeType}</span>}
                    {option.size && (
                      <>
                        {option.ppeType && <span>•</span>}
                        <span>Tamanho: {option.size}</span>
                      </>
                    )}
                  </div>
                )}
              </div>
              {/* Right side with stock quantity - fixed width with left alignment for "Estoque" */}
              <div className="flex items-center min-w-[110px]">
                <span className="text-sm font-semibold text-gray-900 dark:text-gray-300 group-hover:text-white whitespace-nowrap">Estoque: {option.quantity}</span>
              </div>
            </div>
          );
        }}
      />

      {/* Show checkbox and info for users with sizes configured */}
      {userId && hasSizesConfigured && (
        <div className="space-y-1.5">
          <div className="flex items-center space-x-2">
            <Checkbox id="show-all-sizes" checked={showAllSizes} onCheckedChange={(checked) => setShowAllSizes(Boolean(checked))} />
            <label
              htmlFor="show-all-sizes"
              className="text-sm text-muted-foreground leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer select-none"
            >
              Mostrar todos os tamanhos disponíveis
            </label>
          </div>

          {/* Info text showing current filter state */}
          <div className="text-xs text-muted-foreground pl-6">
            {!showAllSizes ? (
              <p>
                Filtrando por tamanhos configurados:
                {userSizes.shirts && ` Camisa ${userSizes.shirts}`}
                {userSizes.pants && ` • Calça ${userSizes.pants}`}
                {userSizes.boots && ` • Botas ${userSizes.boots}`}
                {userSizes.sleeves && ` • Mangas ${userSizes.sleeves}`}
                {userSizes.mask && ` • Máscara ${userSizes.mask}`}
              </p>
            ) : (
              <p>Exibindo todos os tamanhos (filtro desativado)</p>
            )}
          </div>
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
