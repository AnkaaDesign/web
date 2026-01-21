// Types and constants for task copy functionality

export type CopyableTaskField =
  | 'all'
  | 'details'
  | 'entryDate'
  | 'term'
  | 'forecastDate'
  | 'priority'
  | 'customer'
  | 'invoiceTo'
  | 'sector'
  | 'generalPainting'
  | 'negotiatingWith'
  | 'budgets'
  | 'invoices'
  | 'receipts'
  | 'reimbursements'
  | 'reimbursementInvoices'
  | 'baseFiles'
  | 'artworks'
  | 'pricing'
  | 'serviceOrders'
  | 'logoPaints'
  | 'airbrushing'
  | 'cuts'
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
  'details',
  'entryDate',
  'term',
  'forecastDate',
  'priority',
  'customer',
  'invoiceTo',
  'sector',
  'generalPainting',
  'negotiatingWith',
  'budgets',
  'invoices',
  'receipts',
  'reimbursements',
  'reimbursementInvoices',
  'baseFiles',
  'artworks',
  'pricing',
  'serviceOrders',
  'logoPaints',
  'airbrushing',
  'cuts',
  'observation',
];

export const COPYABLE_FIELD_METADATA: Record<CopyableTaskField, CopyableFieldMetadata> = {
  all: {
    label: 'COPIAR TUDO',
    description: 'Copia todos os campos disponíveis (exceto nº série, placa e chassi)',
    category: 'Ações Rápidas',
    isShared: false,
    createNewInstances: false,
  },
  details: {
    label: 'Detalhes',
    description: 'Descrição e detalhes da tarefa',
    category: 'Básico',
    isShared: false,
    createNewInstances: false,
  },
  entryDate: {
    label: 'Data de Entrada',
    description: 'Data de entrada da tarefa',
    category: 'Básico',
    isShared: false,
    createNewInstances: false,
  },
  term: {
    label: 'Prazo',
    description: 'Data limite para conclusão',
    category: 'Básico',
    isShared: false,
    createNewInstances: false,
  },
  forecastDate: {
    label: 'Previsão',
    description: 'Data prevista para conclusão',
    category: 'Básico',
    isShared: false,
    createNewInstances: false,
  },
  priority: {
    label: 'Prioridade',
    description: 'Nível de prioridade da tarefa',
    category: 'Básico',
    isShared: false,
    createNewInstances: false,
  },
  customer: {
    label: 'Cliente',
    description: 'Cliente associado à tarefa',
    category: 'Referências',
    isShared: true,
    createNewInstances: false,
  },
  invoiceTo: {
    label: 'Faturar Para',
    description: 'Cliente para faturamento',
    category: 'Referências',
    isShared: true,
    createNewInstances: false,
  },
  sector: {
    label: 'Setor',
    description: 'Setor responsável pela tarefa',
    category: 'Referências',
    isShared: true,
    createNewInstances: false,
  },
  generalPainting: {
    label: 'Pintura Geral',
    description: 'Configuração de pintura geral',
    category: 'Referências',
    isShared: true,
    createNewInstances: false,
  },
  negotiatingWith: {
    label: 'Negociando Com',
    description: 'Informações de contato da negociação',
    category: 'Básico',
    isShared: false,
    createNewInstances: false,
  },
  budgets: {
    label: 'Orçamentos',
    description: 'Arquivos de orçamento',
    category: 'Arquivos',
    isShared: true,
    createNewInstances: false,
  },
  invoices: {
    label: 'Notas Fiscais',
    description: 'Arquivos de notas fiscais',
    category: 'Arquivos',
    isShared: true,
    createNewInstances: false,
  },
  receipts: {
    label: 'Recibos',
    description: 'Arquivos de recibos',
    category: 'Arquivos',
    isShared: true,
    createNewInstances: false,
  },
  reimbursements: {
    label: 'Reembolsos',
    description: 'Arquivos de reembolso',
    category: 'Arquivos',
    isShared: true,
    createNewInstances: false,
  },
  reimbursementInvoices: {
    label: 'Notas de Reembolso',
    description: 'Notas fiscais de reembolso',
    category: 'Arquivos',
    isShared: true,
    createNewInstances: false,
  },
  baseFiles: {
    label: 'Arquivos Base',
    description: 'Arquivos base para design',
    category: 'Arquivos',
    isShared: true,
    createNewInstances: false,
  },
  artworks: {
    label: 'Artes',
    description: 'Arquivos de arte',
    category: 'Arquivos',
    isShared: true,
    createNewInstances: false,
  },
  pricing: {
    label: 'Precificação',
    description: 'Tabela de preços e itens',
    category: 'Recursos Compartilhados',
    isShared: true,
    createNewInstances: false,
  },
  serviceOrders: {
    label: 'Ordens de Serviço',
    description: 'Ordens de serviço vinculadas',
    category: 'Recursos Compartilhados',
    isShared: true,
    createNewInstances: false,
  },
  logoPaints: {
    label: 'Pinturas de Logo',
    description: 'Configurações de pintura de logos',
    category: 'Recursos Compartilhados',
    isShared: true,
    createNewInstances: false,
  },
  airbrushing: {
    label: 'Aerografia',
    description: 'Trabalhos de aerografia',
    category: 'Recursos Individuais',
    isShared: false,
    createNewInstances: true,
  },
  cuts: {
    label: 'Recortes',
    description: 'Recortes de vinil/adesivo',
    category: 'Recursos Individuais',
    isShared: false,
    createNewInstances: true,
  },
  observation: {
    label: 'Observações',
    description: 'Observações e notas da tarefa',
    category: 'Observações',
    isShared: false,
    createNewInstances: true,
  },
};
