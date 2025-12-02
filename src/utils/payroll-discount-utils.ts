import type { PayrollDiscountType } from "../types/payroll";

export interface DiscountTypeInfo {
  label: string;
  icon: string;
  color: string;
  category: 'tax' | 'absence' | 'benefit' | 'legal' | 'loan' | 'custom';
}

export const DISCOUNT_TYPE_INFO: Record<PayrollDiscountType, DiscountTypeInfo> = {
  INSS: {
    label: 'INSS - Contribuição Previdenciária',
    icon: '🏛️',
    color: 'blue',
    category: 'tax',
  },
  IRRF: {
    label: 'IRRF - Imposto de Renda',
    icon: '💰',
    color: 'yellow',
    category: 'tax',
  },
  FGTS: {
    label: 'FGTS',
    icon: '🏦',
    color: 'green',
    category: 'tax',
  },
  ABSENCE: {
    label: 'Faltas Injustificadas',
    icon: '⏰',
    color: 'red',
    category: 'absence',
  },
  LATE_ARRIVAL: {
    label: 'Atrasos',
    icon: '⏱️',
    color: 'orange',
    category: 'absence',
  },
  MEAL_VOUCHER: {
    label: 'Vale Refeição',
    icon: '🍽️',
    color: 'green',
    category: 'benefit',
  },
  TRANSPORT_VOUCHER: {
    label: 'Vale Transporte',
    icon: '🚌',
    color: 'green',
    category: 'benefit',
  },
  HEALTH_INSURANCE: {
    label: 'Plano de Saúde',
    icon: '🏥',
    color: 'cyan',
    category: 'benefit',
  },
  DENTAL_INSURANCE: {
    label: 'Plano Odontológico',
    icon: '🦷',
    color: 'cyan',
    category: 'benefit',
  },
  UNION_CONTRIBUTION: {
    label: 'Contribuição Sindical',
    icon: '🤝',
    color: 'purple',
    category: 'legal',
  },
  ALIMONY: {
    label: 'Pensão Alimentícia',
    icon: '⚖️',
    color: 'gray',
    category: 'legal',
  },
  GARNISHMENT: {
    label: 'Penhora Judicial',
    icon: '⚖️',
    color: 'gray',
    category: 'legal',
  },
  LOAN: {
    label: 'Empréstimo Consignado',
    icon: '💳',
    color: 'brown',
    category: 'loan',
  },
  ADVANCE: {
    label: 'Adiantamento Salarial',
    icon: '💸',
    color: 'brown',
    category: 'loan',
  },
  CUSTOM: {
    label: 'Desconto Personalizado',
    icon: '📝',
    color: 'gray',
    category: 'custom',
  },
};

export function getDiscountTypeInfo(type?: PayrollDiscountType): DiscountTypeInfo {
  if (!type || !DISCOUNT_TYPE_INFO[type]) {
    return DISCOUNT_TYPE_INFO.CUSTOM;
  }
  return DISCOUNT_TYPE_INFO[type];
}

export function formatDiscountLabel(type?: PayrollDiscountType, reference?: string): string {
  if (reference) return reference;
  return getDiscountTypeInfo(type).label;
}
