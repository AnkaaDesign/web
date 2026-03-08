import type { UserGetManyFormData } from "../../../../schemas";
import { formatDate, formatCurrency } from "../../../../utils";
import { USER_STATUS, USER_STATUS_LABELS } from "../../../../constants";

export interface FilterIndicator {
  key: string;
  label: string;
  value: string;
  onRemove: () => void;
  itemId?: string; // For individual array item removal
  iconType?: string;
}

interface FilterUtilsOptions {
  positions?: Array<{ id: string; name: string }>;
  sectors?: Array<{ id: string; name: string }>;
}

export function extractActiveFilters(
  filters: Partial<UserGetManyFormData>,
  onRemoveFilter: (key: string, itemId?: string) => void,
  options: FilterUtilsOptions = {},
): FilterIndicator[] {
  const activeFilters: FilterIndicator[] = [];
  const { positions = [], sectors = [] } = options;

  // Search filter
  if (filters.searchingFor) {
    activeFilters.push({
      key: "searchingFor",
      label: "Buscar",
      value: filters.searchingFor,
      iconType: "search",
      onRemove: () => onRemoveFilter("searchingFor"),
    });
  }

  // Status filters (individual badges for each status)
  if (filters.status && Array.isArray(filters.status) && filters.status.length > 0) {
    filters.status.forEach((status: string) => {
      const statusLabel = USER_STATUS_LABELS[status as USER_STATUS] || status;
      activeFilters.push({
        key: `status-${status}`,
        label: "Status",
        value: statusLabel,
        iconType: "user",
        itemId: status,
        onRemove: () => onRemoveFilter("status", status),
      });
    });
  } else if (filters.where?.status) {
    const statusLabel = USER_STATUS_LABELS[filters.where.status as USER_STATUS] || filters.where.status;
    activeFilters.push({
      key: "status",
      label: "Status",
      value: statusLabel,
      iconType: "user",
      onRemove: () => onRemoveFilter("status"),
    });
  }

  // Position filters (individual badges for each position)
  if (filters.positionId && Array.isArray(filters.positionId) && filters.positionId.length > 0) {
    const selectedPositions = positions.filter((pos) => filters.positionId?.includes(pos.id));

    selectedPositions.forEach((position) => {
      activeFilters.push({
        key: `positionId-${position.id}`,
        label: "Cargo",
        value: position.name,
        iconType: "briefcase",
        itemId: position.id,
        onRemove: () => onRemoveFilter("positionId", position.id),
      });
    });
  } else if (filters.where?.positionId) {
    const position = positions.find((pos) => pos.id === filters.where?.positionId);
    if (position) {
      activeFilters.push({
        key: "positionId",
        label: "Cargo",
        value: position.name,
        iconType: "briefcase",
        onRemove: () => onRemoveFilter("positionId"),
      });
    }
  }

  // Sector filters (individual badges for each sector)
  if (filters.sectorId && Array.isArray(filters.sectorId) && filters.sectorId.length > 0) {
    const selectedSectors = sectors.filter((sec) => filters.sectorId?.includes(sec.id));

    selectedSectors.forEach((sector) => {
      activeFilters.push({
        key: `sectorId-${sector.id}`,
        label: "Setor",
        value: sector.name,
        iconType: "building",
        itemId: sector.id,
        onRemove: () => onRemoveFilter("sectorId", sector.id),
      });
    });
  } else if (filters.where?.sectorId) {
    const sector = sectors.find((sec) => sec.id === filters.where?.sectorId);
    if (sector) {
      activeFilters.push({
        key: "sectorId",
        label: "Setor",
        value: sector.name,
        iconType: "building",
        onRemove: () => onRemoveFilter("sectorId"),
      });
    }
  }

  // Led Sector filters (individual badges for each sector)
  if (filters.ledSectorId && Array.isArray(filters.ledSectorId) && filters.ledSectorId.length > 0) {
    const selectedLedSectors = sectors.filter((sec) => filters.ledSectorId?.includes(sec.id));

    selectedLedSectors.forEach((sector) => {
      activeFilters.push({
        key: `ledSectorId-${sector.id}`,
        label: "Setor Liderado",
        value: sector.name,
        iconType: "shield",
        itemId: sector.id,
        onRemove: () => onRemoveFilter("ledSectorId", sector.id),
      });
    });
  } else if (filters.where?.ledSectorId) {
    const sector = sectors.find((sec) => sec.id === filters.where?.ledSectorId);
    if (sector) {
      activeFilters.push({
        key: "ledSectorId",
        label: "Setor Liderado",
        value: sector.name,
        iconType: "shield",
        onRemove: () => onRemoveFilter("ledSectorId"),
      });
    }
  }

  // Boolean filters
  if (filters.hasCommissions !== undefined) {
    activeFilters.push({
      key: "hasCommissions",
      label: "Comissões",
      value: filters.hasCommissions ? "Possui" : "Não possui",
      iconType: "currency-dollar",
      onRemove: () => onRemoveFilter("hasCommissions"),
    });
  }

  if (filters.hasLedSector !== undefined) {
    activeFilters.push({
      key: "hasLedSector",
      label: "Lidera Setor",
      value: filters.hasLedSector ? "Sim" : "Não",
      iconType: "shield",
      onRemove: () => onRemoveFilter("hasLedSector"),
    });
  }

  // Range filters
  if (filters.commissionEarnings?.min !== undefined || filters.commissionEarnings?.max !== undefined) {
    const min = filters.commissionEarnings.min;
    const max = filters.commissionEarnings.max;
    let value = "";

    if (min !== undefined && max !== undefined) {
      value = `${formatCurrency(min)} - ${formatCurrency(max)}`;
    } else if (min !== undefined) {
      value = `≥ ${formatCurrency(min)}`;
    } else if (max !== undefined) {
      value = `≤ ${formatCurrency(max)}`;
    }

    activeFilters.push({
      key: "commissionEarnings",
      label: "Ganhos Comissões",
      value,
      iconType: "currency-dollar",
      onRemove: () => onRemoveFilter("commissionEarnings"),
    });
  }

  if (filters.commissionsCount?.min !== undefined || filters.commissionsCount?.max !== undefined) {
    const min = filters.commissionsCount.min;
    const max = filters.commissionsCount.max;
    let value = "";

    if (min !== undefined && max !== undefined) {
      value = `${min} - ${max}`;
    } else if (min !== undefined) {
      value = `≥ ${min}`;
    } else if (max !== undefined) {
      value = `≤ ${max}`;
    }

    activeFilters.push({
      key: "commissionsCount",
      label: "Qtd. Comissões",
      value,
      iconType: "currency-dollar",
      onRemove: () => onRemoveFilter("commissionsCount"),
    });
  }

  // Date filters
  if (filters.birth?.gte || filters.birth?.lte) {
    const gte = filters.birth.gte;
    const lte = filters.birth.lte;
    let value = "";

    if (gte && lte) {
      value = `${formatDate(gte)} - ${formatDate(lte)}`;
    } else if (gte) {
      value = `≥ ${formatDate(gte)}`;
    } else if (lte) {
      value = `≤ ${formatDate(lte)}`;
    }

    activeFilters.push({
      key: "birth",
      label: "Data Nascimento",
      value,
      iconType: "calendar",
      onRemove: () => onRemoveFilter("birth"),
    });
  }

  if (filters.createdAt?.gte || filters.createdAt?.lte) {
    const gte = filters.createdAt.gte;
    const lte = filters.createdAt.lte;
    let value = "";

    if (gte && lte) {
      value = `${formatDate(gte)} - ${formatDate(lte)}`;
    } else if (gte) {
      value = `≥ ${formatDate(gte)}`;
    } else if (lte) {
      value = `≤ ${formatDate(lte)}`;
    }

    activeFilters.push({
      key: "createdAt",
      label: "Data Criação",
      value,
      iconType: "calendar",
      onRemove: () => onRemoveFilter("createdAt"),
    });
  }

  if (filters.updatedAt?.gte || filters.updatedAt?.lte) {
    const gte = filters.updatedAt.gte;
    const lte = filters.updatedAt.lte;
    let value = "";

    if (gte && lte) {
      value = `${formatDate(gte)} - ${formatDate(lte)}`;
    } else if (gte) {
      value = `≥ ${formatDate(gte)}`;
    } else if (lte) {
      value = `≤ ${formatDate(lte)}`;
    }

    activeFilters.push({
      key: "updatedAt",
      label: "Data Atualização",
      value,
      iconType: "calendar",
      onRemove: () => onRemoveFilter("updatedAt"),
    });
  }

  if (filters.lastLoginAt?.gte || filters.lastLoginAt?.lte) {
    const gte = filters.lastLoginAt.gte;
    const lte = filters.lastLoginAt.lte;
    let value = "";

    if (gte && lte) {
      value = `${formatDate(gte)} - ${formatDate(lte)}`;
    } else if (gte) {
      value = `≥ ${formatDate(gte)}`;
    } else if (lte) {
      value = `≤ ${formatDate(lte)}`;
    }

    activeFilters.push({
      key: "lastLoginAt",
      label: "Último Login",
      value,
      iconType: "calendar",
      onRemove: () => onRemoveFilter("lastLoginAt"),
    });
  }

  if (filters.dismissedAt?.gte || filters.dismissedAt?.lte) {
    const gte = filters.dismissedAt.gte;
    const lte = filters.dismissedAt.lte;
    let value = "";

    if (gte && lte) {
      value = `${formatDate(gte)} - ${formatDate(lte)}`;
    } else if (gte) {
      value = `≥ ${formatDate(gte)}`;
    } else if (lte) {
      value = `≤ ${formatDate(lte)}`;
    }

    activeFilters.push({
      key: "dismissedAt",
      label: "Data Demissão",
      value,
      iconType: "calendar",
      onRemove: () => onRemoveFilter("dismissedAt"),
    });
  }

  if (filters.exp1EndAt?.gte || filters.exp1EndAt?.lte) {
    const gte = filters.exp1EndAt.gte;
    const lte = filters.exp1EndAt.lte;
    let value = "";

    if (gte && lte) {
      value = `${formatDate(gte)} - ${formatDate(lte)}`;
    } else if (gte) {
      value = `≥ ${formatDate(gte)}`;
    } else if (lte) {
      value = `≤ ${formatDate(lte)}`;
    }

    activeFilters.push({
      key: "exp1EndAt",
      label: "Data de Contratação",
      value,
      iconType: "calendar",
      onRemove: () => onRemoveFilter("exp1EndAt"),
    });
  }

  return activeFilters;
}

export function createFilterRemover(currentFilters: Partial<UserGetManyFormData>, onFilterChange: (filters: Partial<UserGetManyFormData>) => void) {
  return (key: string, itemId?: string) => {
    const newFilters = { ...currentFilters };
    const newWhere = { ...newFilters.where };

    switch (key) {
      case "searchingFor":
        delete newFilters.searchingFor;
        break;
      case "status":
        if (itemId && Array.isArray(newFilters.status)) {
          // Remove specific status from array
          const filteredStatuses = newFilters.status.filter((status) => status !== itemId);
          if (filteredStatuses.length > 0) {
            newFilters.status = filteredStatuses;
          } else {
            delete newFilters.status;
          }
        } else if (newWhere.status) {
          // Remove status from where clause
          delete newWhere.status;
        } else {
          // Remove all statuses
          delete newFilters.status;
        }
        break;
      case "positionId":
        if (itemId && Array.isArray(newFilters.positionId)) {
          // Remove specific position from array
          const filteredPositions = newFilters.positionId.filter((id) => id !== itemId);
          if (filteredPositions.length > 0) {
            newFilters.positionId = filteredPositions;
          } else {
            delete newFilters.positionId;
          }
        } else if (newWhere.positionId) {
          // Remove position from where clause
          delete newWhere.positionId;
        } else {
          // Remove all positions
          delete newFilters.positionId;
        }
        break;
      case "sectorId":
        if (itemId && Array.isArray(newFilters.sectorId)) {
          // Remove specific sector from array
          const filteredSectors = newFilters.sectorId.filter((id) => id !== itemId);
          if (filteredSectors.length > 0) {
            newFilters.sectorId = filteredSectors;
          } else {
            delete newFilters.sectorId;
          }
        } else if (newWhere.sectorId) {
          // Remove sector from where clause
          delete newWhere.sectorId;
        } else {
          // Remove all sectors
          delete newFilters.sectorId;
        }
        break;
      case "ledSectorId":
        if (itemId && Array.isArray(newFilters.ledSectorId)) {
          // Remove specific led sector from array
          const filteredLedSectors = newFilters.ledSectorId.filter((id) => id !== itemId);
          if (filteredLedSectors.length > 0) {
            newFilters.ledSectorId = filteredLedSectors;
          } else {
            delete newFilters.ledSectorId;
          }
        } else if (newWhere.ledSectorId) {
          // Remove led sector from where clause
          delete newWhere.ledSectorId;
        } else {
          // Remove all led sectors
          delete newFilters.ledSectorId;
        }
        break;
      case "hasCommissions":
        delete newFilters.hasCommissions;
        break;
      case "hasLedSector":
        delete newFilters.hasLedSector;
        break;
      case "commissionEarnings":
        delete newFilters.commissionEarnings;
        break;
      case "commissionsCount":
        delete newFilters.commissionsCount;
        break;
      case "birth":
        delete newFilters.birth;
        break;
      case "createdAt":
        delete newFilters.createdAt;
        break;
      case "updatedAt":
        delete newFilters.updatedAt;
        break;
      case "lastLoginAt":
        delete newFilters.lastLoginAt;
        break;
      case "dismissedAt":
        delete newFilters.dismissedAt;
        break;
      case "exp1EndAt":
        delete newFilters.exp1EndAt;
        break;
    }

    // Update where clause
    if (Object.keys(newWhere).length === 0) {
      delete newFilters.where;
    } else {
      newFilters.where = newWhere;
    }

    onFilterChange(newFilters);
  };
}
