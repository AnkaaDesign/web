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
  | 'quoteId'
  | 'paintId'
  | 'artworkIds'
  | 'baseFileIds'
  | 'projectFileIds'
  | 'logoPaintIds'
  | 'cuts'
  | 'airbrushings'
  | 'serviceOrders:PRODUCTION'
  | 'serviceOrders:COMMERCIAL'
  | 'serviceOrders:LOGISTIC'
  | 'serviceOrders:ARTWORK'
  | 'implementType'
  | 'category'
  | 'layouts'
  | 'observation';

export interface CopyableFieldMetadata {
  label: string;
  description: string;
  category: string;
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
  'quoteId',
  'paintId',
  'artworkIds',
  'baseFileIds',
  'projectFileIds',
  'logoPaintIds',
  'cuts',
  'airbrushings',
  'serviceOrders:PRODUCTION',
  'serviceOrders:COMMERCIAL',
  'serviceOrders:LOGISTIC',
  'serviceOrders:ARTWORK',
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
  name: ['ADMIN', 'COMMERCIAL', 'LOGISTIC', 'PRODUCTION_MANAGER', 'PLOTTING', 'PRODUCTION', 'MAINTENANCE'],
  details: ['ADMIN', 'COMMERCIAL', 'LOGISTIC', 'PRODUCTION_MANAGER', 'PLOTTING', 'PRODUCTION', 'MAINTENANCE'],
  entryDate: ['ADMIN', 'COMMERCIAL', 'LOGISTIC', 'PRODUCTION_MANAGER', 'PLOTTING', 'PRODUCTION', 'MAINTENANCE'],
  term: ['ADMIN', 'COMMERCIAL', 'LOGISTIC', 'PRODUCTION_MANAGER', 'PLOTTING', 'PRODUCTION', 'MAINTENANCE'],
  forecastDate: ['ADMIN', 'COMMERCIAL', 'LOGISTIC', 'PRODUCTION_MANAGER', 'PLOTTING', 'PRODUCTION', 'MAINTENANCE'],
  responsibles: ['ADMIN', 'COMMERCIAL', 'LOGISTIC', 'PRODUCTION_MANAGER', 'PLOTTING', 'PRODUCTION', 'MAINTENANCE'],
  customerId: ['ADMIN', 'COMMERCIAL', 'LOGISTIC', 'PRODUCTION_MANAGER', 'PLOTTING', 'PRODUCTION', 'MAINTENANCE'],

  // Commission - disabled for Financial, Designer, Logistic, Warehouse
  commission: ['ADMIN', 'COMMERCIAL', 'PLOTTING', 'PRODUCTION', 'MAINTENANCE'],

  // Quote - only visible to ADMIN, FINANCIAL, COMMERCIAL (canViewQuoteSections)
  quoteId: ['ADMIN', 'FINANCIAL', 'COMMERCIAL'],

  // Paint - editable by most sectors except Warehouse, Financial, Logistic
  paintId: ['ADMIN', 'COMMERCIAL', 'DESIGNER', 'PLOTTING', 'PRODUCTION', 'MAINTENANCE'],

  // Logo paints (Cores da Logomarca) - hidden for Commercial users
  logoPaintIds: ['ADMIN', 'DESIGNER', 'PLOTTING', 'PRODUCTION', 'MAINTENANCE'],

  // Artworks (Layouts files) - hidden for Warehouse, Financial, Logistic
  artworkIds: ['ADMIN', 'COMMERCIAL', 'DESIGNER', 'PLOTTING', 'PRODUCTION', 'MAINTENANCE'],

  // Base files - accessible by most sectors
  baseFileIds: ['ADMIN', 'COMMERCIAL', 'LOGISTIC', 'PRODUCTION_MANAGER', 'DESIGNER', 'PLOTTING', 'PRODUCTION', 'MAINTENANCE'],

  // Project files (Projetos) - editable by ADMIN, COMMERCIAL, LOGISTIC, PRODUCTION_MANAGER
  projectFileIds: ['ADMIN', 'COMMERCIAL', 'LOGISTIC', 'PRODUCTION_MANAGER'],

  // Cuts - hidden for Financial, Logistic, Commercial
  cuts: ['ADMIN', 'DESIGNER', 'WAREHOUSE', 'PLOTTING', 'PRODUCTION', 'MAINTENANCE'],

  // Airbrushings - hidden for Warehouse, Financial, Designer, Logistic, Commercial
  airbrushings: ['ADMIN', 'PLOTTING', 'PRODUCTION', 'MAINTENANCE'],

  // Service orders by type - hidden for Warehouse and Plotting
  'serviceOrders:PRODUCTION': ['ADMIN', 'COMMERCIAL', 'LOGISTIC', 'PRODUCTION_MANAGER', 'FINANCIAL', 'DESIGNER', 'PRODUCTION', 'MAINTENANCE'],
  'serviceOrders:COMMERCIAL': ['ADMIN', 'COMMERCIAL', 'LOGISTIC', 'PRODUCTION_MANAGER', 'FINANCIAL', 'DESIGNER', 'PRODUCTION', 'MAINTENANCE'],
  'serviceOrders:LOGISTIC': ['ADMIN', 'COMMERCIAL', 'LOGISTIC', 'PRODUCTION_MANAGER', 'FINANCIAL', 'DESIGNER', 'PRODUCTION', 'MAINTENANCE'],
  'serviceOrders:ARTWORK': ['ADMIN', 'COMMERCIAL', 'LOGISTIC', 'PRODUCTION_MANAGER', 'FINANCIAL', 'DESIGNER', 'PRODUCTION', 'MAINTENANCE'],

  // Vehicle fields - disabled for Warehouse, Designer, Financial
  implementType: ['ADMIN', 'COMMERCIAL', 'LOGISTIC', 'PRODUCTION_MANAGER', 'PLOTTING', 'PRODUCTION', 'MAINTENANCE'],
  category: ['ADMIN', 'COMMERCIAL', 'LOGISTIC', 'PRODUCTION_MANAGER', 'PLOTTING', 'PRODUCTION', 'MAINTENANCE'],

  // Medidas do Caminhão - hidden for Warehouse, Financial, Designer, Commercial
  layouts: ['ADMIN', 'LOGISTIC', 'PRODUCTION_MANAGER', 'PLOTTING', 'PRODUCTION', 'MAINTENANCE'],

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
  },
  name: {
    label: 'Nome',
    description: 'Nome da tarefa',
    category: 'Informações Gerais',
  },
  details: {
    label: 'Detalhes',
    description: 'Descrição e detalhes da tarefa',
    category: 'Informações Gerais',
  },
  entryDate: {
    label: 'Data de Entrada',
    description: 'Data de entrada da tarefa',
    category: 'Datas',
  },
  term: {
    label: 'Prazo',
    description: 'Data limite para conclusão',
    category: 'Datas',
  },
  forecastDate: {
    label: 'Previsão de Liberação',
    description: 'Data de previsão de liberação',
    category: 'Datas',
  },
  commission: {
    label: 'Comissão',
    description: 'Informações de comissão',
    category: 'Comercial',
  },
  responsibles: {
    label: 'Responsáveis',
    description: 'Responsáveis associados à tarefa',
    category: 'Comercial',
  },
  customerId: {
    label: 'Cliente',
    description: 'Cliente associado à tarefa',
    category: 'Comercial',
  },
  quoteId: {
    label: 'Orçamento',
    description: 'Cópia independente do orçamento e itens',
    category: 'Comercial',
  },
  paintId: {
    label: 'Pintura Geral',
    description: 'Configuração de pintura geral',
    category: 'Pintura',
  },
  logoPaintIds: {
    label: 'Cores da Logomarca',
    description: 'Configurações de cores da logomarca',
    category: 'Pintura',
  },
  artworkIds: {
    label: 'Layouts',
    description: 'Arquivos de layout',
    category: 'Arquivos',
  },
  baseFileIds: {
    label: 'Arquivos Base',
    description: 'Arquivos base para criação de layouts',
    category: 'Arquivos',
  },
  projectFileIds: {
    label: 'Projetos',
    description: 'Arquivos de projetos anexados à tarefa',
    category: 'Arquivos',
  },
  cuts: {
    label: 'Recortes',
    description: 'Recortes de vinil/adesivo',
    category: 'Produção',
  },
  airbrushings: {
    label: 'Aerografias',
    description: 'Trabalhos de aerografia',
    category: 'Produção',
  },
  'serviceOrders:PRODUCTION': {
    label: 'Ordem de Serviço - Produção',
    description: 'Ordens de serviço de produção',
    category: 'Ordens de Serviço',
  },
  'serviceOrders:COMMERCIAL': {
    label: 'Ordem de Serviço - Comercial',
    description: 'Ordens de serviço comerciais',
    category: 'Ordens de Serviço',
  },
  'serviceOrders:LOGISTIC': {
    label: 'Ordem de Serviço - Logística',
    description: 'Ordens de serviço de logística',
    category: 'Ordens de Serviço',
  },
  'serviceOrders:ARTWORK': {
    label: 'Ordem de Serviço - Arte',
    description: 'Ordens de serviço de arte',
    category: 'Ordens de Serviço',
  },
  implementType: {
    label: 'Implemento',
    description: 'Tipo de implemento do veículo',
    category: 'Veículo',
  },
  category: {
    label: 'Categoria',
    description: 'Categoria do veículo',
    category: 'Veículo',
  },
  layouts: {
    label: 'Medidas',
    description: 'Medidas do caminhão (esquerdo, direito, traseiro)',
    category: 'Veículo',
  },
  observation: {
    label: 'Observações',
    description: 'Observações e notas da tarefa',
    category: 'Informações Gerais',
  },
};
