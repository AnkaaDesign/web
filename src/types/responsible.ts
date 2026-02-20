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
  role: ResponsibleRole;
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
  role: ResponsibleRole;
  isActive?: boolean;
}

export interface ResponsibleUpdateFormData {
  email?: string | null;
  phone?: string;
  name?: string;
  password?: string | null;
  role?: ResponsibleRole;
  isActive?: boolean;
}

export interface ResponsibleCreateInline {
  email?: string | null;
  phone: string;
  name: string;
  password?: string | null;
  role: ResponsibleRole;
  isActive?: boolean;
}

export interface ResponsibleRowData {
  id: string;
  email?: string | null;
  phone: string;
  name: string;
  role: ResponsibleRole;
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
  role?: ResponsibleRole;
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
  role: string;
  roleLabel: string;
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
