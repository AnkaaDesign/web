import type { PaintGetManyFormData } from "../../../../schemas";
import type { PaintType, PaintBrand } from "../../../../types";
import { PAINT_FINISH_LABELS, TRUCK_MANUFACTURER_LABELS, PAINT_FINISH, TRUCK_MANUFACTURER } from "../../../../constants";
import { IconSearch, IconPaint, IconBrush, IconTags, IconTruck, IconHash, IconFlask, IconCalendar, IconPalette } from "@tabler/icons-react";
import React from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface EntityData {
  paintTypes: PaintType[];
  paintBrands: PaintBrand[];
}

export function extractActiveFilters(filters: Partial<PaintGetManyFormData>, onRemoveFilter: (key: string, value?: string) => void, entityData: EntityData) {
  const activeFilters: Array<{
    key: string;
    label: string;
    value: string;
    onRemove: () => void;
    icon?: React.ReactNode;
  }> = [];

  // Search filter
  if (filters.searchingFor) {
    activeFilters.push({
      key: "searchingFor",
      label: "Buscar",
      value: filters.searchingFor,
      icon: <IconSearch className="h-3 w-3" />,
      onRemove: () => onRemoveFilter("searchingFor"),
    });
  }

  // Paint type filter
  if (filters.paintTypeIds && filters.paintTypeIds.length > 0) {
    filters.paintTypeIds.forEach((typeId: string) => {
      const paintType = entityData.paintTypes.find((t) => t.id === typeId);
      if (paintType) {
        activeFilters.push({
          key: `paintType-${typeId}`,
          label: "Tipo",
          value: paintType.name,
          icon: <IconPaint className="h-3 w-3" />,
          onRemove: () => onRemoveFilter("paintTypeIds", typeId),
        });
      }
    });
  }

  // Finish filters
  if (filters.finishes && filters.finishes.length > 0) {
    filters.finishes.forEach((finish: PAINT_FINISH) => {
      activeFilters.push({
        key: `finish-${finish}`,
        label: "Acabamento",
        value: PAINT_FINISH_LABELS[finish] || finish,
        icon: <IconBrush className="h-3 w-3" />,
        onRemove: () => onRemoveFilter("finishes", finish),
      });
    });
  }

  // Paint brand filters
  if (filters.paintBrandIds && filters.paintBrandIds.length > 0) {
    filters.paintBrandIds.forEach((brandId: string) => {
      const paintBrand = entityData.paintBrands.find((b) => b.id === brandId);
      if (paintBrand) {
        activeFilters.push({
          key: `paintBrand-${brandId}`,
          label: "Marca",
          value: paintBrand.name,
          icon: <IconTags className="h-3 w-3" />,
          onRemove: () => onRemoveFilter("paintBrandIds", brandId),
        });
      }
    });
  }

  // Manufacturer filters
  if (filters.manufacturers && filters.manufacturers.length > 0) {
    filters.manufacturers.forEach((manufacturer: TRUCK_MANUFACTURER) => {
      activeFilters.push({
        key: `manufacturer-${manufacturer}`,
        label: "Montadora",
        value: TRUCK_MANUFACTURER_LABELS[manufacturer] || manufacturer,
        icon: <IconTruck className="h-3 w-3" />,
        onRemove: () => onRemoveFilter("manufacturers", manufacturer),
      });
    });
  }

  // Tag filters
  if (filters.tags && filters.tags.length > 0) {
    filters.tags.forEach((tag: string) => {
      activeFilters.push({
        key: `tag-${tag}`,
        label: "Tag",
        value: tag,
        icon: <IconHash className="h-3 w-3" />,
        onRemove: () => onRemoveFilter("tags", tag),
      });
    });
  }

  // Has formulas filter
  if (filters.hasFormulas === true) {
    activeFilters.push({
      key: "hasFormulas",
      label: "Fórmulas",
      value: "Com fórmulas",
      icon: <IconFlask className="h-3 w-3" />,
      onRemove: () => onRemoveFilter("hasFormulas"),
    });
  }

  // Color similarity filter
  if (filters.similarColor && filters.similarColor.trim() !== "" && filters.similarColor !== "#000000") {
    activeFilters.push({
      key: "similarColor",
      label: "Cor similar",
      value: filters.similarColor,
      icon: <IconPalette className="h-3 w-3" />,
      onRemove: () => onRemoveFilter("similarColor"),
    });
  }

  // Date filters
  if (filters.createdAt?.gte || filters.createdAt?.lte) {
    let dateLabel = "Criado";
    if (filters.createdAt.gte && filters.createdAt.lte) {
      dateLabel += ` entre ${format(filters.createdAt.gte, "dd/MM/yyyy", { locale: ptBR })} e ${format(filters.createdAt.lte, "dd/MM/yyyy", { locale: ptBR })}`;
    } else if (filters.createdAt.gte) {
      dateLabel += ` após ${format(filters.createdAt.gte, "dd/MM/yyyy", { locale: ptBR })}`;
    } else if (filters.createdAt.lte) {
      dateLabel += ` antes de ${format(filters.createdAt.lte, "dd/MM/yyyy", { locale: ptBR })}`;
    }

    activeFilters.push({
      key: "createdAt",
      label: "Data",
      value: dateLabel,
      icon: <IconCalendar className="h-3 w-3" />,
      onRemove: () => onRemoveFilter("createdAt"),
    });
  }

  return activeFilters;
}

export function createFilterRemover(filters: Partial<PaintGetManyFormData>, handleFilterChange: (filters: Partial<PaintGetManyFormData>) => void) {
  return (key: string, value?: string) => {
    const newFilters = { ...filters };

    switch (key) {
      case "searchingFor":
        delete newFilters.searchingFor;
        break;

      case "paintTypeIds":
        if (value && newFilters.paintTypeIds) {
          newFilters.paintTypeIds = newFilters.paintTypeIds.filter((id: string) => id !== value);
          if (newFilters.paintTypeIds.length === 0) {
            delete newFilters.paintTypeIds;
          }
        } else {
          delete newFilters.paintTypeIds;
        }
        break;

      case "finishes":
        if (value && newFilters.finishes) {
          newFilters.finishes = newFilters.finishes.filter((f: PAINT_FINISH) => f !== value);
          if (newFilters.finishes.length === 0) {
            delete newFilters.finishes;
          }
        } else {
          delete newFilters.finishes;
        }
        break;

      case "paintBrandIds":
        if (value && newFilters.paintBrandIds) {
          newFilters.paintBrandIds = newFilters.paintBrandIds.filter((id: string) => id !== value);
          if (newFilters.paintBrandIds.length === 0) {
            delete newFilters.paintBrandIds;
          }
        } else {
          delete newFilters.paintBrandIds;
        }
        break;

      case "manufacturers":
        if (value && newFilters.manufacturers) {
          newFilters.manufacturers = newFilters.manufacturers.filter((m: TRUCK_MANUFACTURER) => m !== value);
          if (newFilters.manufacturers.length === 0) {
            delete newFilters.manufacturers;
          }
        } else {
          delete newFilters.manufacturers;
        }
        break;

      case "tags":
        if (value && newFilters.tags) {
          newFilters.tags = newFilters.tags.filter((t: string) => t !== value);
          if (newFilters.tags.length === 0) {
            delete newFilters.tags;
          }
        } else {
          delete newFilters.tags;
        }
        break;

      case "hasFormulas":
        delete newFilters.hasFormulas;
        break;

      case "similarColor":
        delete newFilters.similarColor;
        delete newFilters.similarColorThreshold;
        break;

      case "createdAt":
        delete newFilters.createdAt;
        break;
    }

    handleFilterChange(newFilters);
  };
}
