// Filter utilities for bonus list - extracting active filters for badge display

export interface FilterIndicator {
  key: string;
  label: string;
  value: string;
  onRemove: () => void;
  itemId?: string;
  iconType?: string;
}

interface BonusFiltersData {
  year?: number;
  months?: string[];
  sectorIds?: string[];
  positionIds?: string[];
  userIds?: string[];
}

interface FilterUtilsOptions {
  sectors?: Array<{ id: string; name: string }>;
  positions?: Array<{ id: string; name: string }>;
  users?: Array<{ id: string; name: string }>;
}

const MONTH_NAMES: Record<string, string> = {
  "01": "Janeiro",
  "02": "Fevereiro",
  "03": "Março",
  "04": "Abril",
  "05": "Maio",
  "06": "Junho",
  "07": "Julho",
  "08": "Agosto",
  "09": "Setembro",
  "10": "Outubro",
  "11": "Novembro",
  "12": "Dezembro",
};

export function extractActiveFilters(
  filters: BonusFiltersData,
  defaultFilters: BonusFiltersData,
  onRemoveFilter: (key: string, itemId?: string) => void,
  options: FilterUtilsOptions = {}
): FilterIndicator[] {
  const activeFilters: FilterIndicator[] = [];
  const { sectors = [], positions = [], users = [] } = options;

  // Year filter (only if different from default)
  if (filters.year && filters.year !== defaultFilters.year) {
    activeFilters.push({
      key: "year",
      label: "Ano",
      value: filters.year.toString(),
      iconType: "calendar",
      onRemove: () => onRemoveFilter("year"),
    });
  }

  // Month filters (individual badges for each month)
  if (filters.months && filters.months.length > 0) {
    const defaultMonthsStr = JSON.stringify(defaultFilters.months || []);
    const currentMonthsStr = JSON.stringify(filters.months);

    if (currentMonthsStr !== defaultMonthsStr) {
      // Show individual badge for each month
      filters.months.forEach((month) => {
        const monthName = MONTH_NAMES[month] || month;
        activeFilters.push({
          key: `months-${month}`,
          label: "Mês",
          value: monthName,
          iconType: "calendar",
          itemId: month,
          onRemove: () => onRemoveFilter("months", month),
        });
      });
    }
  }

  // Sector filters (individual badges)
  if (filters.sectorIds && filters.sectorIds.length > 0) {
    const selectedSectors = sectors.filter((sec) => filters.sectorIds?.includes(sec.id));
    selectedSectors.forEach((sector) => {
      activeFilters.push({
        key: `sectorIds-${sector.id}`,
        label: "Setor",
        value: sector.name,
        iconType: "building",
        itemId: sector.id,
        onRemove: () => onRemoveFilter("sectorIds", sector.id),
      });
    });
  }

  // Position filters (individual badges)
  if (filters.positionIds && filters.positionIds.length > 0) {
    const selectedPositions = positions.filter((pos) => filters.positionIds?.includes(pos.id));
    selectedPositions.forEach((position) => {
      activeFilters.push({
        key: `positionIds-${position.id}`,
        label: "Cargo",
        value: position.name,
        iconType: "briefcase",
        itemId: position.id,
        onRemove: () => onRemoveFilter("positionIds", position.id),
      });
    });
  }

  // User filters (individual badges)
  if (filters.userIds && filters.userIds.length > 0) {
    const selectedUsers = users.filter((user) => filters.userIds?.includes(user.id));
    selectedUsers.forEach((user) => {
      activeFilters.push({
        key: `userIds-${user.id}`,
        label: "Colaborador",
        value: user.name,
        iconType: "user",
        itemId: user.id,
        onRemove: () => onRemoveFilter("userIds", user.id),
      });
    });
  }

  return activeFilters;
}

export function createFilterRemover(
  currentFilters: BonusFiltersData,
  defaultFilters: BonusFiltersData,
  onFilterChange: (filters: BonusFiltersData) => void
) {
  return (key: string, itemId?: string) => {
    const newFilters = { ...currentFilters };

    switch (key) {
      case "year":
        newFilters.year = defaultFilters.year;
        break;
      case "months":
        if (itemId && Array.isArray(newFilters.months)) {
          const filtered = newFilters.months.filter((m) => m !== itemId);
          newFilters.months = filtered.length > 0 ? filtered : defaultFilters.months;
        } else {
          newFilters.months = defaultFilters.months;
        }
        break;
      case "sectorIds":
        if (itemId && Array.isArray(newFilters.sectorIds)) {
          const filtered = newFilters.sectorIds.filter((id) => id !== itemId);
          newFilters.sectorIds = filtered.length > 0 ? filtered : undefined;
        } else {
          newFilters.sectorIds = undefined;
        }
        break;
      case "positionIds":
        if (itemId && Array.isArray(newFilters.positionIds)) {
          const filtered = newFilters.positionIds.filter((id) => id !== itemId);
          newFilters.positionIds = filtered.length > 0 ? filtered : undefined;
        } else {
          newFilters.positionIds = undefined;
        }
        break;
      case "userIds":
        if (itemId && Array.isArray(newFilters.userIds)) {
          const filtered = newFilters.userIds.filter((id) => id !== itemId);
          newFilters.userIds = filtered.length > 0 ? filtered : undefined;
        } else {
          newFilters.userIds = undefined;
        }
        break;
    }

    onFilterChange(newFilters);
  };
}
