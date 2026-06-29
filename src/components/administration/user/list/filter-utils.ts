import type { UserGetManyFormData } from "../../../../schemas";
import { formatDate, formatCurrency } from "../../../../utils";
import { CONTRACT_TYPE, CONTRACT_TYPE_LABELS, CONTRACT_STATUS, CONTRACT_STATUS_LABELS, EMPLOYEE_TYPE, EMPLOYEE_TYPE_LABELS } from "../../../../constants";

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

  // Contract type filters (individual badges for each type)
  if (filters.contractTypes && Array.isArray(filters.contractTypes) && filters.contractTypes.length > 0) {
    filters.contractTypes.forEach((contractType: string) => {
      const contractTypeLabel = CONTRACT_TYPE_LABELS[contractType as CONTRACT_TYPE] || contractType;
      activeFilters.push({
        key: `contractTypes-${contractType}`,
        label: "Tipo de Contrato",
        value: contractTypeLabel,
        iconType: "user",
        itemId: contractType,
        onRemove: () => onRemoveFilter("contractTypes", contractType),
      });
    });
  } else if (filters.where?.currentContractType) {
    const value = filters.where.currentContractType as any;
    const contractType = (typeof value === "object" && value !== null ? value.equals ?? value.in?.[0] : value) as string;
    const contractTypeLabel = CONTRACT_TYPE_LABELS[contractType as CONTRACT_TYPE] || contractType;
    activeFilters.push({
      key: "contractTypes",
      label: "Tipo de Contrato",
      value: contractTypeLabel,
      iconType: "user",
      onRemove: () => onRemoveFilter("contractTypes"),
    });
  }

  // Exibir tri-state (only show a badge when explicitly Ativos/Desligados; Todos = omitted)
  if (filters.statuses?.length === 1) {
    activeFilters.push({
      key: "statuses",
      label: "Exibir",
      value: filters.statuses[0] === CONTRACT_STATUS.ACTIVE ? "Ativos" : "Desligados",
      iconType: "eye",
      onRemove: () => onRemoveFilter("statuses"),
    });
  }

  // Situação filters (current vínculo lifecycle status)
  if (filters.contractStatuses && Array.isArray(filters.contractStatuses) && filters.contractStatuses.length > 0) {
    filters.contractStatuses.forEach((status: string) => {
      const statusLabel = CONTRACT_STATUS_LABELS[status as CONTRACT_STATUS] || status;
      activeFilters.push({
        key: `contractStatuses-${status}`,
        label: "Situação",
        value: statusLabel,
        iconType: "activity",
        itemId: status,
        onRemove: () => onRemoveFilter("contractStatuses", status),
      });
    });
  }

  // Categoria filters (worker category)
  if (filters.employeeTypes && Array.isArray(filters.employeeTypes) && filters.employeeTypes.length > 0) {
    filters.employeeTypes.forEach((employeeType: string) => {
      const employeeTypeLabel = EMPLOYEE_TYPE_LABELS[employeeType as EMPLOYEE_TYPE] || employeeType;
      activeFilters.push({
        key: `employeeTypes-${employeeType}`,
        label: "Categoria",
        value: employeeTypeLabel,
        iconType: "id",
        itemId: employeeType,
        onRemove: () => onRemoveFilter("employeeTypes", employeeType),
      });
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
  if (filters.hasBonifications !== undefined) {
    activeFilters.push({
      key: "hasBonifications",
      label: "Bonificações",
      value: filters.hasBonifications ? "Possui" : "Não possui",
      iconType: "currency-dollar",
      onRemove: () => onRemoveFilter("hasBonifications"),
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
  if (filters.bonificationEarnings?.min !== undefined || filters.bonificationEarnings?.max !== undefined) {
    const min = filters.bonificationEarnings.min;
    const max = filters.bonificationEarnings.max;
    let value = "";

    if (min !== undefined && max !== undefined) {
      value = `${formatCurrency(min)} - ${formatCurrency(max)}`;
    } else if (min !== undefined) {
      value = `≥ ${formatCurrency(min)}`;
    } else if (max !== undefined) {
      value = `≤ ${formatCurrency(max)}`;
    }

    activeFilters.push({
      key: "bonificationEarnings",
      label: "Ganhos Bonificações",
      value,
      iconType: "currency-dollar",
      onRemove: () => onRemoveFilter("bonificationEarnings"),
    });
  }

  if (filters.bonificationsCount?.min !== undefined || filters.bonificationsCount?.max !== undefined) {
    const min = filters.bonificationsCount.min;
    const max = filters.bonificationsCount.max;
    let value = "";

    if (min !== undefined && max !== undefined) {
      value = `${min} - ${max}`;
    } else if (min !== undefined) {
      value = `≥ ${min}`;
    } else if (max !== undefined) {
      value = `≤ ${max}`;
    }

    activeFilters.push({
      key: "bonificationsCount",
      label: "Qtd. Bonificações",
      value,
      iconType: "currency-dollar",
      onRemove: () => onRemoveFilter("bonificationsCount"),
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

  // Dismissal/admission date ranges now live on the related current
  // EmploymentContract, read via where.currentContract.is.{terminationDate,exp1EndAt}.
  const currentContractIs = (filters.where as any)?.currentContract?.is as
    | { terminationDate?: { gte?: Date; lte?: Date }; exp1EndAt?: { gte?: Date; lte?: Date } }
    | undefined;

  if (currentContractIs?.terminationDate?.gte || currentContractIs?.terminationDate?.lte) {
    const gte = currentContractIs.terminationDate.gte;
    const lte = currentContractIs.terminationDate.lte;
    let value = "";

    if (gte && lte) {
      value = `${formatDate(gte)} - ${formatDate(lte)}`;
    } else if (gte) {
      value = `≥ ${formatDate(gte)}`;
    } else if (lte) {
      value = `≤ ${formatDate(lte)}`;
    }

    activeFilters.push({
      key: "currentContract.terminationDate",
      label: "Data Demissão",
      value,
      iconType: "calendar",
      onRemove: () => onRemoveFilter("currentContract.terminationDate"),
    });
  }

  if (currentContractIs?.exp1EndAt?.gte || currentContractIs?.exp1EndAt?.lte) {
    const gte = currentContractIs.exp1EndAt.gte;
    const lte = currentContractIs.exp1EndAt.lte;
    let value = "";

    if (gte && lte) {
      value = `${formatDate(gte)} - ${formatDate(lte)}`;
    } else if (gte) {
      value = `≥ ${formatDate(gte)}`;
    } else if (lte) {
      value = `≤ ${formatDate(lte)}`;
    }

    activeFilters.push({
      key: "currentContract.exp1EndAt",
      label: "Data de Contratação",
      value,
      iconType: "calendar",
      onRemove: () => onRemoveFilter("currentContract.exp1EndAt"),
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
      case "contractTypes":
        if (itemId && Array.isArray(newFilters.contractTypes)) {
          // Remove specific contract type from array
          const filteredContractTypes = newFilters.contractTypes.filter((contractType) => contractType !== itemId);
          if (filteredContractTypes.length > 0) {
            newFilters.contractTypes = filteredContractTypes;
          } else {
            delete newFilters.contractTypes;
          }
        } else if ((newWhere as any).currentContractType) {
          // Remove contract type from where clause
          delete (newWhere as any).currentContractType;
        } else {
          // Remove all contract types
          delete newFilters.contractTypes;
        }
        break;
      case "statuses":
        delete newFilters.statuses;
        break;
      case "contractStatuses":
        if (itemId && Array.isArray(newFilters.contractStatuses)) {
          const filtered = newFilters.contractStatuses.filter((status) => status !== itemId);
          if (filtered.length > 0) {
            newFilters.contractStatuses = filtered;
          } else {
            delete newFilters.contractStatuses;
          }
        } else {
          delete newFilters.contractStatuses;
        }
        break;
      case "employeeTypes":
        if (itemId && Array.isArray(newFilters.employeeTypes)) {
          const filtered = newFilters.employeeTypes.filter((employeeType) => employeeType !== itemId);
          if (filtered.length > 0) {
            newFilters.employeeTypes = filtered;
          } else {
            delete newFilters.employeeTypes;
          }
        } else {
          delete newFilters.employeeTypes;
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
      case "hasBonifications":
        delete newFilters.hasBonifications;
        break;
      case "hasLedSector":
        delete newFilters.hasLedSector;
        break;
      case "bonificationEarnings":
        delete newFilters.bonificationEarnings;
        break;
      case "bonificationsCount":
        delete newFilters.bonificationsCount;
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
      case "currentContract.terminationDate":
      case "currentContract.exp1EndAt": {
        // Dismissal/admission ranges live on where.currentContract.is.{...}
        const field = key === "currentContract.terminationDate" ? "terminationDate" : "exp1EndAt";
        const relIs = { ...((newWhere as any).currentContract?.is ?? {}) };
        delete relIs[field];
        if (Object.keys(relIs).length > 0) {
          (newWhere as any).currentContract = { is: relIs };
        } else {
          delete (newWhere as any).currentContract;
        }
        break;
      }
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
