import { formatDate } from "../../../../utils";
import { DRIVER_STATUS, DRIVER_STATUS_LABELS, CNH_CATEGORY, CNH_CATEGORY_LABELS, LICENSE_TYPE, LICENSE_TYPE_LABELS } from "../../../../constants";

// Since driver schema might not be fully enabled yet, define the minimal type we need
type DriverGetManyFormData = {
  searchingFor?: string;
  where?: {
    status?: string | { equals?: string; in?: string[]; notIn?: string[] };
    cnhCategory?: string | { equals?: string; in?: string[]; notIn?: string[] };
    licenseType?: string | { equals?: string; in?: string[]; notIn?: string[] };
    cnhExpiryDate?: { gte?: Date; lte?: Date };
    birthDate?: { gte?: Date; lte?: Date };
    hireDate?: { gte?: Date; lte?: Date };
    medicalCertificateExpiry?: { gte?: Date; lte?: Date };
  };
  statusFilters?: DRIVER_STATUS[];
  cnhCategoryFilters?: CNH_CATEGORY[];
  licenseTypeFilters?: LICENSE_TYPE[];
  showInactive?: boolean;
  cnhExpired?: boolean;
  cnhExpiringSoon?: boolean;
  medicalCertificateExpired?: boolean;
  createdAt?: { gte?: Date; lte?: Date };
  updatedAt?: { gte?: Date; lte?: Date };
};

export interface FilterIndicator {
  key: string;
  label: string;
  value: string;
  onRemove: () => void;
  itemId?: string; // For individual array item removal
  iconType?: string;
}

interface FilterUtilsOptions {
  // Currently no additional options needed for drivers
}

export function extractActiveFilters(
  filters: Partial<DriverGetManyFormData>,
  onRemoveFilter: (key: string, itemId?: string) => void,
  options: FilterUtilsOptions = {},
): FilterIndicator[] {
  const activeFilters: FilterIndicator[] = [];

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

  // Boolean filters
  if (filters.showInactive) {
    activeFilters.push({
      key: "showInactive",
      label: "Status",
      value: "Incluindo inativos",
      iconType: "eye",
      onRemove: () => onRemoveFilter("showInactive"),
    });
  }

  if (filters.cnhExpired) {
    activeFilters.push({
      key: "cnhExpired",
      label: "CNH",
      value: "CNH Vencida",
      iconType: "alert-triangle",
      onRemove: () => onRemoveFilter("cnhExpired"),
    });
  }

  if (filters.cnhExpiringSoon) {
    activeFilters.push({
      key: "cnhExpiringSoon",
      label: "CNH",
      value: "CNH Vencendo em Breve",
      iconType: "calendar",
      onRemove: () => onRemoveFilter("cnhExpiringSoon"),
    });
  }

  if (filters.medicalCertificateExpired) {
    activeFilters.push({
      key: "medicalCertificateExpired",
      label: "Atestado Médico",
      value: "Atestado Vencido",
      iconType: "alert-triangle",
      onRemove: () => onRemoveFilter("medicalCertificateExpired"),
    });
  }

  // Status filters array - display individual badges for each status
  if (filters.statusFilters && filters.statusFilters.length > 0) {
    filters.statusFilters.forEach((status: DRIVER_STATUS) => {
      const label = DRIVER_STATUS_LABELS[status] || status;
      activeFilters.push({
        key: `statusFilters-${status}`,
        label: "Status",
        value: label,
        iconType: "user",
        itemId: status,
        onRemove: () => onRemoveFilter("statusFilters", status),
      });
    });
  }

  // CNH Category filters array - display individual badges for each category
  if (filters.cnhCategoryFilters && filters.cnhCategoryFilters.length > 0) {
    filters.cnhCategoryFilters.forEach((category: CNH_CATEGORY) => {
      const label = CNH_CATEGORY_LABELS[category] || category;
      activeFilters.push({
        key: `cnhCategoryFilters-${category}`,
        label: "Categoria CNH",
        value: label,
        iconType: "id",
        itemId: category,
        onRemove: () => onRemoveFilter("cnhCategoryFilters", category),
      });
    });
  }

  // License Type filters array - display individual badges for each type
  if (filters.licenseTypeFilters && filters.licenseTypeFilters.length > 0) {
    filters.licenseTypeFilters.forEach((type: LICENSE_TYPE) => {
      const label = LICENSE_TYPE_LABELS[type] || type;
      activeFilters.push({
        key: `licenseTypeFilters-${type}`,
        label: "Tipo de Licença",
        value: label,
        iconType: "id",
        itemId: type,
        onRemove: () => onRemoveFilter("licenseTypeFilters", type),
      });
    });
  }

  // Date filters
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
      label: "Data criação",
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
      label: "Data atualização",
      value,
      iconType: "calendar",
      onRemove: () => onRemoveFilter("updatedAt"),
    });
  }

  // CNH Expiry Date Range
  if (filters.where?.cnhExpiryDate?.gte || filters.where?.cnhExpiryDate?.lte) {
    const gte = filters.where.cnhExpiryDate.gte;
    const lte = filters.where.cnhExpiryDate.lte;
    let value = "";

    if (gte && lte) {
      value = `${formatDate(gte)} - ${formatDate(lte)}`;
    } else if (gte) {
      value = `≥ ${formatDate(gte)}`;
    } else if (lte) {
      value = `≤ ${formatDate(lte)}`;
    }

    activeFilters.push({
      key: "cnhExpiryDate",
      label: "Vencimento CNH",
      value,
      iconType: "calendar",
      onRemove: () => onRemoveFilter("cnhExpiryDate"),
    });
  }

  // Hire Date Range
  if (filters.where?.hireDate?.gte || filters.where?.hireDate?.lte) {
    const gte = filters.where.hireDate.gte;
    const lte = filters.where.hireDate.lte;
    let value = "";

    if (gte && lte) {
      value = `${formatDate(gte)} - ${formatDate(lte)}`;
    } else if (gte) {
      value = `≥ ${formatDate(gte)}`;
    } else if (lte) {
      value = `≤ ${formatDate(lte)}`;
    }

    activeFilters.push({
      key: "hireDate",
      label: "Data contratação",
      value,
      iconType: "calendar",
      onRemove: () => onRemoveFilter("hireDate"),
    });
  }

  return activeFilters;
}

export function createFilterRemover(currentFilters: Partial<DriverGetManyFormData>, onFilterChange: (filters: Partial<DriverGetManyFormData>) => void) {
  return (key: string, itemId?: string) => {
    const newFilters = { ...currentFilters };
    const newWhere = { ...newFilters.where };

    switch (key) {
      case "searchingFor":
        delete newFilters.searchingFor;
        break;
      case "showInactive":
        delete newFilters.showInactive;
        break;
      case "cnhExpired":
        delete newFilters.cnhExpired;
        break;
      case "cnhExpiringSoon":
        delete newFilters.cnhExpiringSoon;
        break;
      case "medicalCertificateExpired":
        delete newFilters.medicalCertificateExpired;
        break;
      case "statusFilters":
        if (itemId && Array.isArray(newFilters.statusFilters)) {
          // Remove specific status from array
          const filteredStatuses = newFilters.statusFilters.filter((status) => status !== itemId);
          if (filteredStatuses.length > 0) {
            newFilters.statusFilters = filteredStatuses;
          } else {
            delete newFilters.statusFilters;
          }
        } else {
          // Remove all status filters
          delete newFilters.statusFilters;
        }
        break;
      case "cnhCategoryFilters":
        if (itemId && Array.isArray(newFilters.cnhCategoryFilters)) {
          // Remove specific category from array
          const filteredCategories = newFilters.cnhCategoryFilters.filter((category) => category !== itemId);
          if (filteredCategories.length > 0) {
            newFilters.cnhCategoryFilters = filteredCategories;
          } else {
            delete newFilters.cnhCategoryFilters;
          }
        } else {
          // Remove all category filters
          delete newFilters.cnhCategoryFilters;
        }
        break;
      case "licenseTypeFilters":
        if (itemId && Array.isArray(newFilters.licenseTypeFilters)) {
          // Remove specific type from array
          const filteredTypes = newFilters.licenseTypeFilters.filter((type) => type !== itemId);
          if (filteredTypes.length > 0) {
            newFilters.licenseTypeFilters = filteredTypes;
          } else {
            delete newFilters.licenseTypeFilters;
          }
        } else {
          // Remove all type filters
          delete newFilters.licenseTypeFilters;
        }
        break;
      case "createdAt":
        delete newFilters.createdAt;
        break;
      case "updatedAt":
        delete newFilters.updatedAt;
        break;
      case "cnhExpiryDate":
        delete newWhere.cnhExpiryDate;
        break;
      case "hireDate":
        delete newWhere.hireDate;
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
