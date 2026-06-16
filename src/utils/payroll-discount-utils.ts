import type { PayrollDiscountType } from "../types/payroll";

export interface DiscountTypeInfo {
  label: string;
  icon: string;
  color: string;
  category: 'tax' | 'absence' | 'benefit' | 'legal' | 'loan' | 'custom' | 'earning';
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
  PARTIAL_ABSENCE: {
    label: 'Falta Parcial',
    icon: '⏰',
    color: 'red',
    category: 'absence',
  },
  DSR_ABSENCE: {
    label: 'DSR sobre Faltas',
    icon: '📅',
    color: 'red',
    category: 'absence',
  },
  LATE_ARRIVAL: {
    label: 'Atrasos',
    icon: '⏱️',
    color: 'orange',
    category: 'absence',
  },
  SICK_LEAVE: {
    label: 'Afastamento por Doença',
    icon: '🏥',
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
  UNION: {
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
  AUTHORIZED_DISCOUNT: {
    label: 'Desconto Autorizado',
    icon: '✅',
    color: 'gray',
    category: 'custom',
  },
  CUSTOM: {
    label: 'Desconto Personalizado',
    icon: '📝',
    color: 'gray',
    category: 'custom',
  },
  // Proventos (earnings)
  FAMILY_ALLOWANCE: {
    label: 'Salário-Família',
    icon: '👨‍👩‍👧',
    color: 'green',
    category: 'earning',
  },
  INSALUBRIDADE: {
    label: 'Adicional de Insalubridade',
    icon: '⚗️',
    color: 'green',
    category: 'earning',
  },
  PERICULOSIDADE: {
    label: 'Adicional de Periculosidade',
    icon: '⚠️',
    color: 'green',
    category: 'earning',
  },
  HABITUAL_GRATIFICATION: {
    label: 'Gratificação Habitual',
    icon: '🎁',
    color: 'green',
    category: 'earning',
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
