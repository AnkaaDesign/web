import type { Customer } from './customer';
import type { Task } from './task';

export enum ResponsibleRole {
  COMMERCIAL = 'COMMERCIAL',
  OWNER = 'OWNER',
  SELLER = 'SELLER',
  REPRESENTATIVE = 'REPRESENTATIVE',
  COORDINATOR = 'COORDINATOR',
  MARKETING = 'MARKETING',
  FINANCIAL = 'FINANCIAL',
  FLEET_MANAGER = 'FLEET_MANAGER',
  DRIVER = 'DRIVER',
}

export interface Responsible {
  id: string;
  email?: string | null;
  phone: string;
  name: string;
  password?: string | null;
  companyId?: string | null;
  /** Non-empty. A contact may handle several areas at once. */
  roles: ResponsibleRole[];
  isActive: boolean;
  lastLogin?: Date | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date | null;
  company?: Customer | null;
  tasks?: Task[];
}

export interface ResponsibleCreateFormData {
  email?: string | null;
  phone: string;
  name: string;
  password?: string | null;
  companyId?: string | null;
  roles: ResponsibleRole[];
  isActive?: boolean;
}

export interface ResponsibleUpdateFormData {
  email?: string | null;
  phone?: string;
  name?: string;
  password?: string | null;
  roles?: ResponsibleRole[];
  isActive?: boolean;
}

export interface ResponsibleCreateInline {
  email?: string | null;
  phone: string;
  name: string;
  password?: string | null;
  roles: ResponsibleRole[];
  isActive?: boolean;
}

export interface ResponsibleRowData {
  id: string;
  email?: string | null;
  phone: string;
  name: string;
  roles: ResponsibleRole[];
  /**
   * The roles this contact had when it was loaded from the API.
   *
   * Only set for already-registered contacts, and only so the form can tell an
   * inline role edit apart from an untouched row -- without it every save would
   * PUT every contact and write a changelog entry for each.
   */
  originalRoles?: ResponsibleRole[];
  isActive: boolean;
  isEditing?: boolean;
  isNew?: boolean;
  isSaving?: boolean;
  error?: string | null;
  companyId?: string | null; // Which company this responsible belongs to (for new responsibles)
}

export interface ResponsibleGetManyFormData {
  page?: number;
  pageSize?: number;
  search?: string;
  companyId?: string;
  roles?: ResponsibleRole[];
  isActive?: boolean;
  include?: string[];
}

export interface ResponsibleGetManyResponse {
  data: Responsible[];
  meta: {
    total: number;
    page: number;
    pageSize: number;
    pageCount: number;
  };
}

export interface ResponsibleLoginFormData {
  email: string;
  password: string;
}

export interface AuthResponse {
  token: string;
  responsible: Responsible;
}

// Formatted responsible display
export interface ResponsibleDisplay {
  id: string;
  name: string;
  roles: string[];
  rolesLabel: string;
  phone: string;
  email?: string;
  companyName: string;
  isActive: boolean;
  hasSystemAccess: boolean;
}

// Responsible role labels for display
export const RESPONSIBLE_ROLE_LABELS: Record<ResponsibleRole, string> = {
  [ResponsibleRole.COMMERCIAL]: 'Comercial',
  [ResponsibleRole.OWNER]: 'Proprietário',
  [ResponsibleRole.SELLER]: 'Vendedor',
  [ResponsibleRole.REPRESENTATIVE]: 'Representante',
  [ResponsibleRole.COORDINATOR]: 'Coordenador',
  [ResponsibleRole.MARKETING]: 'Marketing',
  [ResponsibleRole.FINANCIAL]: 'Financeiro',
  [ResponsibleRole.FLEET_MANAGER]: 'Gestor de Frota',
  [ResponsibleRole.DRIVER]: 'Motorista',
};

// Responsible role colors for UI
export const RESPONSIBLE_ROLE_COLORS: Record<ResponsibleRole, string> = {
  [ResponsibleRole.COMMERCIAL]: 'blue',
  [ResponsibleRole.OWNER]: 'cyan',
  [ResponsibleRole.SELLER]: 'teal',
  [ResponsibleRole.REPRESENTATIVE]: 'indigo',
  [ResponsibleRole.COORDINATOR]: 'green',
  [ResponsibleRole.MARKETING]: 'purple',
  [ResponsibleRole.FINANCIAL]: 'orange',
  [ResponsibleRole.FLEET_MANAGER]: 'gray',
  [ResponsibleRole.DRIVER]: 'yellow',
};

/**
 * Human-readable label for a contact's set of roles, e.g. "Comercial, Financeiro".
 *
 * Use this everywhere a single string is needed (exports, PDFs, filter chips,
 * tooltips); render badges directly from `roles` where the UI has room.
 */
export const formatResponsibleRoles = (roles: readonly ResponsibleRole[] | undefined | null): string =>
  (roles ?? []).map(role => RESPONSIBLE_ROLE_LABELS[role] ?? role).join(', ');
