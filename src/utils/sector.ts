// packages/utils/src/sector.ts

import type { Sector } from "../types";
import { SECTOR_PRIVILEGES, TEAM_LEADER, SECTOR_PRIVILEGES_LABELS } from "../constants";
import { getSectorPrivilegeSortOrder, canAccessSector, canAccessAnyPrivilege, canAccessAllPrivileges } from "./privilege";

// =====================
// Display Formatters
// =====================

export const formatSectorName = (name: string): string => {
  return name.replace(/\b\w/g, (l) => l.toUpperCase());
};

export const getSectorDisplayName = (sector: Sector): string => {
  return sector.name;
};

export const getSectorFullDisplay = (sector: Sector): string => {
  const parts = [sector.name];
  if (sector.users && sector.users.length > 0) {
    parts.push(`(${sector.users.length} usuários)`);
  }
  return parts.join(" ");
};

// =====================
// Privilege Management (imported from constants)
// =====================
// Functions getSectorPrivilegeSortOrder, canAccessSector, canAccessAnyPrivilege, canAccessAllPrivileges
// are now imported from @ankaa/constants to maintain proper package dependency hierarchy

export const getSectorPrivilegeDescription = (privilege: SECTOR_PRIVILEGES): string => {
  const descriptions = {
    [SECTOR_PRIVILEGES.BASIC]: "Acesso básico ao sistema",
    [SECTOR_PRIVILEGES.MAINTENANCE]: "Acesso a funcionalidades de limpeza e manutenção",
    [SECTOR_PRIVILEGES.WAREHOUSE]: "Acesso completo ao almoxarifado",
    [SECTOR_PRIVILEGES.PRODUCTION]: "Acesso a funcionalidades de produção",
    [SECTOR_PRIVILEGES.HUMAN_RESOURCES]: "Acesso a recursos humanos",
    [SECTOR_PRIVILEGES.FINANCIAL]: "Acesso financeiro",
    [SECTOR_PRIVILEGES.DESIGNER]: "Acesso a funcionalidades de design",
    [SECTOR_PRIVILEGES.LOGISTIC]: "Acesso a funcionalidades de logística",
    [SECTOR_PRIVILEGES.PLOTTING]: "Acesso a funcionalidades de plotagem",
    [SECTOR_PRIVILEGES.COMMERCIAL]: "Acesso a funcionalidades comerciais",
    [SECTOR_PRIVILEGES.ADMIN]: "Acesso administrativo completo",
    [SECTOR_PRIVILEGES.EXTERNAL]: "Acesso externo limitado",
    [TEAM_LEADER]: "Acesso de líder de equipe (gestão do setor)",
  };
  return descriptions[privilege] || "Privilégio não definido";
};

export const getSectorPrivilegeColor = (privilege: SECTOR_PRIVILEGES): string => {
  const colors = {
    [SECTOR_PRIVILEGES.ADMIN]: "red",
    [SECTOR_PRIVILEGES.PRODUCTION]: "blue",
    [SECTOR_PRIVILEGES.HUMAN_RESOURCES]: "purple",
    [SECTOR_PRIVILEGES.FINANCIAL]: "purple",
    [SECTOR_PRIVILEGES.DESIGNER]: "purple",
    [SECTOR_PRIVILEGES.LOGISTIC]: "purple",
    [SECTOR_PRIVILEGES.PLOTTING]: "indigo",
    [SECTOR_PRIVILEGES.COMMERCIAL]: "cyan",
    [SECTOR_PRIVILEGES.MAINTENANCE]: "orange",
    [SECTOR_PRIVILEGES.BASIC]: "gray",
    [SECTOR_PRIVILEGES.EXTERNAL]: "gray",
    [SECTOR_PRIVILEGES.WAREHOUSE]: "green",
    [TEAM_LEADER]: "teal",
  };
  return colors[privilege] || "gray";
};

export const getSectorPrivilegeBadgeVariant = (privilege: SECTOR_PRIVILEGES): "default" | "secondary" | "destructive" | "outline" => {
  const variants = {
    [SECTOR_PRIVILEGES.BASIC]: "outline" as const,
    [SECTOR_PRIVILEGES.MAINTENANCE]: "secondary" as const,
    [SECTOR_PRIVILEGES.WAREHOUSE]: "secondary" as const,
    [SECTOR_PRIVILEGES.PRODUCTION]: "default" as const,
    [SECTOR_PRIVILEGES.HUMAN_RESOURCES]: "secondary" as const,
    [SECTOR_PRIVILEGES.FINANCIAL]: "secondary" as const,
    [SECTOR_PRIVILEGES.DESIGNER]: "secondary" as const,
    [SECTOR_PRIVILEGES.LOGISTIC]: "secondary" as const,
    [SECTOR_PRIVILEGES.PLOTTING]: "secondary" as const,
    [SECTOR_PRIVILEGES.COMMERCIAL]: "secondary" as const,
    [SECTOR_PRIVILEGES.ADMIN]: "destructive" as const,
    [SECTOR_PRIVILEGES.EXTERNAL]: "outline" as const,
    [TEAM_LEADER]: "default" as const,
  };
  return variants[privilege] || "outline";
};

/**
 * Get the display label for sector privileges
 * @param privileges - The sector privileges enum value
 * @returns The localized label for the privileges
 */
export function getSectorPrivilegesLabel(privileges: SECTOR_PRIVILEGES): string {
  return SECTOR_PRIVILEGES_LABELS[privileges] || privileges;
}

// =====================
// Export all utilities
// =====================

export const sectorUtils = {
  // Display
  formatSectorName,
  getSectorDisplayName,
  getSectorFullDisplay,

  // Privileges
  getSectorPrivilegeSortOrder,
  canAccessSector,
  canAccessAnyPrivilege,
  canAccessAllPrivileges,
  getSectorPrivilegeDescription,
  getSectorPrivilegeColor,
  getSectorPrivilegeBadgeVariant,
  getSectorPrivilegesLabel,
};
