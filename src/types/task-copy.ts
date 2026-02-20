// Types and constants for task copy functionality

// CopyableTaskField uses API schema field names (e.g., baseFileIds, artworkIds)
// to match the backend validation schema for the copy-from endpoint
export type CopyableTaskField =
  | 'all'
  | 'name'
  | 'details'
  | 'entryDate'
  | 'term'
  | 'forecastDate'
  | 'commission'
  | 'responsibles'
  | 'customerId'
  | 'pricingId'
  | 'paintId'
  | 'artworkIds'
  | 'baseFileIds'
  | 'logoPaintIds'
  | 'cuts'
  | 'airbrushings'
  | 'serviceOrders'
  | 'implementType'
  | 'category'
  | 'layouts'
  | 'observation';

export interface CopyableFieldMetadata {
  label: string;
  description: string;
  category: string;
  isShared: boolean;
  createNewInstances: boolean;
}

export const COPYABLE_TASK_FIELDS: CopyableTaskField[] = [
  'all',
  'name',
  'details',
  'entryDate',
  'term',
  'forecastDate',
  'commission',
  'responsibles',
  'customerId',
  'pricingId',
  'paintId',
  'artworkIds',
  'baseFileIds',
  'logoPaintIds',
  'cuts',
  'airbrushings',
  'serviceOrders',
  'implementType',
  'category',
  'layouts',
  'observation',
];

/**
 * Maps each copyable field to the sector privileges that can edit that field.
 * Based on the field-level disabled checks in task-edit-form.tsx.
 * When user selects "copy ALL", only fields they have permission to edit will be copied.
 */
export const COPYABLE_FIELD_PERMISSIONS: Record<Exclude<CopyableTaskField, 'all'>, string[]> = {
  // Basic fields - disabled for Financial, Warehouse, Designer
  name: ['ADMIN', 'COMMERCIAL', 'LOGISTIC', 'PLOTTING', 'PRODUCTION', 'MAINTENANCE'],
  details: ['ADMIN', 'COMMERCIAL', 'LOGISTIC', 'PLOTTING', 'PRODUCTION', 'MAINTENANCE'],
  entryDate: ['ADMIN', 'COMMERCIAL', 'LOGISTIC', 'PLOTTING', 'PRODUCTION', 'MAINTENANCE'],
  term: ['ADMIN', 'COMMERCIAL', 'LOGISTIC', 'PLOTTING', 'PRODUCTION', 'MAINTENANCE'],
  forecastDate: ['ADMIN', 'COMMERCIAL', 'LOGISTIC', 'PLOTTING', 'PRODUCTION', 'MAINTENANCE'],
  responsibles: ['ADMIN', 'COMMERCIAL', 'LOGISTIC', 'PLOTTING', 'PRODUCTION', 'MAINTENANCE'],
  customerId: ['ADMIN', 'COMMERCIAL', 'LOGISTIC', 'PLOTTING', 'PRODUCTION', 'MAINTENANCE'],

  // Commission - disabled for Financial, Designer, Logistic, Warehouse
  commission: ['ADMIN', 'COMMERCIAL', 'PLOTTING', 'PRODUCTION', 'MAINTENANCE'],

  // Pricing - only visible to ADMIN, FINANCIAL, COMMERCIAL (canViewPricingSections)
  pricingId: ['ADMIN', 'FINANCIAL', 'COMMERCIAL'],

  // Paint/Artworks - hidden for Warehouse, Financial, Logistic (different rules)
  paintId: ['ADMIN', 'COMMERCIAL', 'DESIGNER', 'PLOTTING', 'PRODUCTION', 'MAINTENANCE'],
  artworkIds: ['ADMIN', 'COMMERCIAL', 'DESIGNER', 'PLOTTING', 'PRODUCTION', 'MAINTENANCE'],
  baseFileIds: ['ADMIN', 'COMMERCIAL', 'LOGISTIC', 'DESIGNER', 'PLOTTING', 'PRODUCTION', 'MAINTENANCE'],

  // Logo paints - hidden for Commercial users
  logoPaintIds: ['ADMIN', 'DESIGNER', 'PLOTTING', 'PRODUCTION', 'MAINTENANCE'],

  // Cuts - hidden for Financial, Logistic, Commercial
  cuts: ['ADMIN', 'DESIGNER', 'WAREHOUSE', 'PLOTTING', 'PRODUCTION', 'MAINTENANCE'],

  // Airbrushings - hidden for Warehouse, Financial, Designer, Logistic, Commercial
  airbrushings: ['ADMIN', 'PLOTTING', 'PRODUCTION', 'MAINTENANCE'],

  // Service orders - hidden for Warehouse and Plotting
  serviceOrders: ['ADMIN', 'COMMERCIAL', 'LOGISTIC', 'FINANCIAL', 'DESIGNER', 'PRODUCTION', 'MAINTENANCE'],

  // Vehicle fields - disabled for Warehouse, Designer, Financial
  implementType: ['ADMIN', 'COMMERCIAL', 'LOGISTIC', 'PLOTTING', 'PRODUCTION', 'MAINTENANCE'],
  category: ['ADMIN', 'COMMERCIAL', 'LOGISTIC', 'PLOTTING', 'PRODUCTION', 'MAINTENANCE'],

  // Layouts - hidden for Warehouse, Financial, Designer, Commercial
  layouts: ['ADMIN', 'LOGISTIC', 'PLOTTING', 'PRODUCTION', 'MAINTENANCE'],

  // Observation - hidden for Warehouse, Financial, Designer, Logistic, Commercial
  observation: ['ADMIN', 'PLOTTING', 'PRODUCTION', 'MAINTENANCE'],
};

/**
 * Filters copyable fields based on user's sector privilege.
 * Returns only fields the user has permission to edit.
 */
export function getFieldsUserCanCopy(userPrivilege: string | undefined): CopyableTaskField[] {
  if (!userPrivilege) return [];

  // ADMIN can copy everything
  if (userPrivilege === 'ADMIN') {
    return COPYABLE_TASK_FIELDS;
  }

  // Filter fields based on user privilege
  const allowedFields: CopyableTaskField[] = ['all']; // Always include 'all' option

  for (const [field, allowedPrivileges] of Object.entries(COPYABLE_FIELD_PERMISSIONS)) {
    if (allowedPrivileges.includes(userPrivilege)) {
      allowedFields.push(field as CopyableTaskField);
    }
  }

  return allowedFields;
}

/**
 * Expands 'all' to only the fields the user has permission to copy.
 * Used when user selects "COPIAR TUDO" to filter to allowed fields only.
 */
export function expandAllFieldsForUser(
  selectedFields: CopyableTaskField[],
  userPrivilege: string | undefined
): CopyableTaskField[] {
  if (!selectedFields.includes('all')) {
    return selectedFields;
  }

  // Get all fields user can copy (excluding 'all')
  const allowedFields = getFieldsUserCanCopy(userPrivilege);
  return allowedFields.filter(f => f !== 'all');
}

export const COPYABLE_FIELD_METADATA: Record<CopyableTaskField, CopyableFieldMetadata> = {
  all: {
    label: 'COPIAR TUDO',
    description: 'Copia todos os campos que você tem permissão para editar',
    category: 'Ações Rápidas',
    isShared: false,
    createNewInstances: false,
  },
  name: {
    label: 'Nome',
    description: 'Nome da tarefa',
    category: 'Informações Gerais',
    isShared: false,
    createNewInstances: false,
  },
  details: {
    label: 'Detalhes',
    description: 'Descrição e detalhes da tarefa',
    category: 'Informações Gerais',
    isShared: false,
    createNewInstances: false,
  },
  entryDate: {
    label: 'Data de Entrada',
    description: 'Data de entrada da tarefa',
    category: 'Datas',
    isShared: false,
    createNewInstances: false,
  },
  term: {
    label: 'Prazo',
    description: 'Data limite para conclusão',
    category: 'Datas',
    isShared: false,
    createNewInstances: false,
  },
  forecastDate: {
    label: 'Previsão',
    description: 'Data prevista para conclusão',
    category: 'Datas',
    isShared: false,
    createNewInstances: false,
  },
  commission: {
    label: 'Comissão',
    description: 'Informações de comissão',
    category: 'Comercial',
    isShared: false,
    createNewInstances: false,
  },
  responsibles: {
    label: 'Responsáveis',
    description: 'Responsáveis associados à tarefa',
    category: 'Comercial',
    isShared: true,
    createNewInstances: false,
  },
  customerId: {
    label: 'Cliente',
    description: 'Cliente associado à tarefa',
    category: 'Comercial',
    isShared: true,
    createNewInstances: false,
  },
  pricingId: {
    label: 'Precificação',
    description: 'Cópia independente da tabela de preços e itens',
    category: 'Comercial',
    isShared: false,
    createNewInstances: true,
  },
  paintId: {
    label: 'Pintura Geral',
    description: 'Configuração de pintura geral',
    category: 'Pintura e Artes',
    isShared: true,
    createNewInstances: false,
  },
  artworkIds: {
    label: 'Artes',
    description: 'Arquivos de arte',
    category: 'Pintura e Artes',
    isShared: true,
    createNewInstances: false,
  },
  baseFileIds: {
    label: 'Arquivos Base',
    description: 'Arquivos base para criação de artes',
    category: 'Pintura e Artes',
    isShared: true,
    createNewInstances: false,
  },
  logoPaintIds: {
    label: 'Pinturas de Logo',
    description: 'Configurações de pintura de logos',
    category: 'Pintura e Artes',
    isShared: true,
    createNewInstances: false,
  },
  cuts: {
    label: 'Recortes',
    description: 'Recortes de vinil/adesivo',
    category: 'Produção',
    isShared: false,
    createNewInstances: true,
  },
  airbrushings: {
    label: 'Aerografias',
    description: 'Trabalhos de aerografia',
    category: 'Produção',
    isShared: false,
    createNewInstances: true,
  },
  serviceOrders: {
    label: 'Ordens de Serviço',
    description: 'Ordens de serviço vinculadas',
    category: 'Produção',
    isShared: false,
    createNewInstances: true,
  },
  implementType: {
    label: 'Implemento',
    description: 'Tipo de implemento do veículo',
    category: 'Veículo',
    isShared: true,
    createNewInstances: false,
  },
  category: {
    label: 'Categoria',
    description: 'Categoria do veículo',
    category: 'Veículo',
    isShared: true,
    createNewInstances: false,
  },
  layouts: {
    label: 'Layouts',
    description: 'Layouts do veículo (esquerdo, direito, traseiro)',
    category: 'Veículo',
    isShared: true,
    createNewInstances: false,
  },
  observation: {
    label: 'Observações',
    description: 'Observações e notas da tarefa',
    category: 'Informações Gerais',
    isShared: false,
    createNewInstances: true,
  },
};
