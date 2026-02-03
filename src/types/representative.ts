import type { Customer } from './customer';
import type { Task } from './task';

export enum RepresentativeRole {
  COMMERCIAL = 'COMMERCIAL',
  MARKETING = 'MARKETING',
  COORDINATOR = 'COORDINATOR',
  FINANCIAL = 'FINANCIAL',
  FLEET_MANAGER = 'FLEET_MANAGER',
}

export interface Representative {
  id: string;
  email?: string | null;
  phone: string;
  name: string;
  password?: string | null;
  customerId?: string | null;
  role: RepresentativeRole;
  isActive: boolean;
  lastLogin?: Date | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date | null;
  customer?: Customer | null;
  tasks?: Task[];
}

export interface RepresentativeCreateFormData {
  email?: string;
  phone: string;
  name: string;
  password?: string;
  customerId?: string | null;
  role: RepresentativeRole;
  isActive?: boolean;
}

export interface RepresentativeUpdateFormData {
  email?: string;
  phone?: string;
  name?: string;
  password?: string;
  role?: RepresentativeRole;
  isActive?: boolean;
}

export interface RepresentativeCreateInline {
  email?: string;
  phone: string;
  name: string;
  password?: string;
  role: RepresentativeRole;
  isActive?: boolean;
}

export interface RepresentativeRowData {
  id: string;
  email?: string | null;
  phone: string;
  name: string;
  role: RepresentativeRole;
  isActive: boolean;
  isEditing?: boolean;
  isNew?: boolean;
  isSaving?: boolean;
  error?: string | null;
  customerId?: string | null; // Which customer this representative belongs to (for new representatives)
}

export interface RepresentativeGetManyFormData {
  page?: number;
  pageSize?: number;
  search?: string;
  customerId?: string;
  role?: RepresentativeRole;
  isActive?: boolean;
  include?: string[];
}

export interface RepresentativeGetManyResponse {
  data: Representative[];
  meta: {
    total: number;
    page: number;
    pageSize: number;
    pageCount: number;
  };
}

export interface RepresentativeLoginFormData {
  email: string;
  password: string;
}

export interface AuthResponse {
  token: string;
  representative: Representative;
}

// Formatted representative display
export interface RepresentativeDisplay {
  id: string;
  name: string;
  role: string;
  roleLabel: string;
  phone: string;
  email?: string;
  customerName: string;
  isActive: boolean;
  hasSystemAccess: boolean;
}

// Representative role labels for display
export const REPRESENTATIVE_ROLE_LABELS: Record<RepresentativeRole, string> = {
  [RepresentativeRole.COMMERCIAL]: 'Comercial',
  [RepresentativeRole.MARKETING]: 'Marketing',
  [RepresentativeRole.COORDINATOR]: 'Coordenador',
  [RepresentativeRole.FINANCIAL]: 'Financeiro',
  [RepresentativeRole.FLEET_MANAGER]: 'Gestor de Frota',
};

// Representative role colors for UI
export const REPRESENTATIVE_ROLE_COLORS: Record<RepresentativeRole, string> = {
  [RepresentativeRole.COMMERCIAL]: 'blue',
  [RepresentativeRole.MARKETING]: 'purple',
  [RepresentativeRole.COORDINATOR]: 'green',
  [RepresentativeRole.FINANCIAL]: 'orange',
  [RepresentativeRole.FLEET_MANAGER]: 'gray',
};