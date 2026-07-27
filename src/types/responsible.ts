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
  /**
   * CPF em dígitos puros (11 caracteres), sem pontuação — é assim que a API
   * grava e devolve.
   *
   * Opcional de propósito e SEM unicidade: a identidade do contato vem do
   * telefone. O CPF também é gravado durante a cerimônia de assinatura
   * eletrônica, e tê-lo no cadastro é o que permite pedir ao signatário apenas
   * os dígitos que a máscara esconde — a conferência parcial só existe se
   * houver um número cadastrado para conferir.
   */
  cpf?: string | null;
  password?: string | null;
  companyId?: string | null;
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
  /** Dígitos puros; a API valida mod-11 e recusa CPF inválido. */
  cpf?: string | null;
  password?: string | null;
  companyId?: string | null;
  roles: ResponsibleRole[];
  isActive?: boolean;
}

export interface ResponsibleUpdateFormData {
  email?: string | null;
  phone?: string;
  name?: string;
  /** Dígitos puros; a API valida mod-11 e recusa CPF inválido. */
  cpf?: string | null;
  password?: string | null;
  roles?: ResponsibleRole[];
  isActive?: boolean;
}

export interface ResponsibleCreateInline {
  email?: string | null;
  phone: string;
  name: string;
  cpf?: string | null;
  password?: string | null;
  roles: ResponsibleRole[];
  isActive?: boolean;
}

export interface ResponsibleRowData {
  id: string;
  email?: string | null;
  phone: string;
  name: string;
  /** Dígitos puros. Vazio/ausente é válido — o CPF não é obrigatório. */
  cpf?: string | null;
  roles: ResponsibleRole[];
  /**
   * Papéis que o contato tinha quando entrou na linha.
   *
   * Só para distinguir uma edição inline de uma linha intocada: sem isto,
   * `syncResponsibleRoles` daria PUT em TODO contato já cadastrado do formulário
   * e escreveria uma entrada de changelog para cada um.
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
  // Any-of: the API maps this to Prisma `hasSome` over the roles array.
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

/** Enum declaration order — the canonical order the API sorts `roles` by. */
const ROLE_DECLARATION_ORDER = Object.values(ResponsibleRole);

/**
 * A contact's roles, always as an array.
 *
 * Tolerates the pre-2026-07-26 scalar `role` so anything still holding a cached
 * payload (React Query cache, a persisted table layout, an older mobile build)
 * keeps rendering instead of showing an empty badge.
 */
export const getResponsibleRoles = (
  responsible: { roles?: ResponsibleRole[] | null; role?: ResponsibleRole | null } | null | undefined,
): ResponsibleRole[] => {
  if (!responsible) return [];
  if (Array.isArray(responsible.roles)) return responsible.roles;
  return responsible.role ? [responsible.role] : [];
};

/** De-duplicated and put back in enum order, matching the API's normalization. */
export const normalizeResponsibleRoles = (roles: ResponsibleRole[]): ResponsibleRole[] =>
  [...new Set(roles)].sort(
    (a, b) => ROLE_DECLARATION_ORDER.indexOf(a) - ROLE_DECLARATION_ORDER.indexOf(b),
  );

/** Human-readable label for a set of roles, e.g. "Comercial, Financeiro". */
export const formatResponsibleRoles = (
  roles: readonly ResponsibleRole[] | null | undefined,
): string => (roles ?? []).map(role => RESPONSIBLE_ROLE_LABELS[role] ?? role).join(', ');
