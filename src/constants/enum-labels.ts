// packages/constants/src/enum-labels.ts

import {
  GHS_PICTOGRAM,
  GHS_SIGNAL_WORD,
  FISPQ_STATUS,
  ORDER_STATUS,
  PAYMENT_METHOD,
  ASSIGNMENT_TYPE,
  TASK_STATUS,
  GOAL_METRIC,
  GOAL_UNIT,
  GOAL_DIRECTION,
  SERVICE_ORDER_STATUS,
  SERVICE_ORDER_TYPE,
  AIRBRUSHING_STATUS,
  AIRBRUSHING_PAYMENT_STATUS,
  LAYOUT_STATUS,
  CUT_TYPE,
  CUT_STATUS,
  CUT_ORIGIN,
  CUT_REQUEST_REASON,
  MAINTENANCE_STATUS,
  MAINTENANCE_SCHEDULE_STATUS,
  PAINT_BRAND,
  PAINT_FINISH,
  PAINT_TYPE_ENUM,
  TRUCK_MANUFACTURER,
  TRUCK_CATEGORY,
  IMPLEMENT_TYPE,
  WARNING_SEVERITY,
  WARNING_CATEGORY,
  NOTIFICATION_TYPE,
  NOTIFICATION_IMPORTANCE,
  NOTIFICATION_CHANNEL,
  COLOR_SCHEMA,
  VERIFICATION_TYPE,
  VERIFICATION_ERROR_CODE,
  VERIFICATION_ERROR_SEVERITY,
  VERIFICATION_ERROR_CATEGORY,
  HOLIDAY_TYPE,
  MEASURE_UNIT,
  MEASURE_TYPE,
  BORROW_STATUS,
  EXTERNAL_OPERATION_STATUS,
  EXTERNAL_OPERATION_TYPE,
  PPE_REQUEST_STATUS,
  PPE_DELIVERY_STATUS,
  SECTOR_PRIVILEGES,
  TREND_DIRECTION,
  TREND_TYPE,
  PERIOD_TYPE,
  CHART_TYPE,
  PRIORITY_TYPE,
  RISK_LEVEL,
  STOCK_LEVEL,
  ABC_CATEGORY,
  XYZ_CATEGORY,
  HEALTH_STATUS,
  PERFORMANCE_LEVEL,
  URGENCY_LEVEL,
  EFFORT_LEVEL,
  CONFIDENCE_LEVEL,
  PERCENTAGE_ADJUST_TYPE,
  EXPORT_FORMAT,
  BATCH_OPERATION_STATUS,
  VALIDATION_SEVERITY,
  WEEK_DAY,
  MONTH,
  MONTH_OCCURRENCE,
  SCHEDULE_FREQUENCY,
  PANTS_SIZE,
  SHIRT_SIZE,
  BOOT_SIZE,
  SLEEVES_SIZE,
  MASK_SIZE,
  GLOVES_SIZE,
  RAIN_BOOTS_SIZE,
  PPE_TYPE,
  PPE_SIZE_TYPE,
  PPE_SIZE,
  ACTIVITY_OPERATION,
  AUDIT_ACTION,
  ENTITY_TYPE,
  PPE_DELIVERY_MODE,
  ORDER_TRIGGER_TYPE,
  FILE_ENTITY_TYPE,
  ACTIVITY_REASON,
  WORKLOAD_LEVEL,
  FILE_FORMAT,
  ACTIVITY_LEVEL,
  CHANGE_ACTION,
  CHANGE_TRIGGERED_BY,
  EVENT_TYPE,
  TIMELINE_EVENT_TYPE,
  MERGE_STRATEGY,
  GROUP_BY,
  ALERT_TYPE,
  TASK_OBSERVATION_TYPE,
  ITEM_ISSUE_TYPE,
  ITEM_CATEGORY_TYPE,
  ITEM_CATEGORY_LEVEL,
  STOCK_MODEL,
  WAREHOUSE_LOCATION_TYPE,
  ACCOUNTING_TYPE,
  TIME_RANGE,
  DASHBOARD_TIME_PERIOD,
  CHANGE_LOG_ENTITY_TYPE,
  CHANGE_LOG_ACTION,
  NOTIFICATION_ACTION_TYPE,
  SMS_VERIFICATION_STATUS,
  SMS_VERIFICATION_TYPE,
  RATE_LIMIT_TYPE,
  LOCKOUT_REASON,
  CAPTCHA_REQUIREMENT_LEVEL,
  VERIFICATION_ABUSE_LEVEL,
  PROGRESSIVE_DELAY_TIER,
  VERIFICATION_SECURITY_ACTION,
  EMAIL_TYPE,
  EMAIL_STATUS,
  VERIFICATION_STATUS,
  VERIFICATION_METHOD,
  VERIFICATION_PURPOSE,
  NOTE_CATEGORY,
  DOCUMENT_CATEGORY,
  LINK_TYPE,
  FAVORITE_PAGES,
  MEASURE_SIDE,
  BONUS_DISCOUNT_REASON,
  BONUS_STATUS,
  DISCOUNT_TYPE,
  REGISTRATION_STATUS,
  RESPONSIBLE_ROLE,
  PAYMENT_CONDITION,
  PAYROLL_STATUS,
  PAYROLL_MONTH,
  BONIFICATION_STATUS,
  STATISTICS_GROUP_BY,
  STATISTICS_METRIC,
  STATISTICS_PERIOD,
  TASK_QUOTE_STATUS,
  RESCHEDULE_REASON,
  INVOICE_STATUS,
  INSTALLMENT_STATUS,
  BANK_SLIP_STATUS,
  NFSE_STATUS,
  SALARY_ADJUSTMENT_TYPE,
  POSITION_CHANGE_REASON,
  BENEFIT_KIND,
  BENEFIT_ENROLLMENT_STATUS,
  CONTRACT_TYPE,
  CONTRACT_STATUS,
  EMPLOYEE_TYPE,
  ADMISSION_STATUS,
  ADMISSION_DOCUMENT_TYPE,
  ADMISSION_DOCUMENT_STATUS,
  TERMINATION_TYPE,
  TERMINATION_STATUS,
  NOTICE_TYPE,
  NOTICE_REDUCTION,
  TERMINATION_ITEM_TYPE,
  TERMINATION_DOCUMENT_TYPE,
  TERMINATION_DOCUMENT_STATUS,
  MEDICAL_EXAM_TYPE,
  MEDICAL_EXAM_STATUS,
  MEDICAL_EXAM_RESULT,
  LEAVE_TYPE,
  LEAVE_STATUS,
  DEPENDENT_RELATIONSHIP,
  ORDER_PAYMENT_STATUS,
  ORDER_INSTALLMENT_STATUS,
  INSALUBRITY_DEGREE,
  STABILITY_TYPE,
  INSS_BENEFIT_SPECIES,
  VACATION_STATUS,
  VACATION_GROUP_TYPE,
  THIRTEENTH_STATUS,
  WORK_ACCIDENT_REPORT_TYPE,
  PAYROLL_DISCOUNT_TYPE,
} from "./enums";

// =====================
// Status Labels
// =====================

export const ORDER_STATUS_LABELS: Record<ORDER_STATUS, string> = {
  [ORDER_STATUS.CREATED]: "Criado",
  [ORDER_STATUS.PARTIALLY_FULFILLED]: "Parcialmente Feito",
  [ORDER_STATUS.FULFILLED]: "Feito",
  [ORDER_STATUS.OVERDUE]: "Atrasado",
  [ORDER_STATUS.PARTIALLY_RECEIVED]: "Parcialmente Recebido",
  [ORDER_STATUS.RECEIVED]: "Recebido",
  [ORDER_STATUS.CANCELLED]: "Cancelado",
};

export const PAYMENT_METHOD_LABELS: Record<PAYMENT_METHOD, string> = {
  [PAYMENT_METHOD.PIX]: "Pix",
  [PAYMENT_METHOD.BANK_SLIP]: "Boleto",
  [PAYMENT_METHOD.CREDIT_CARD]: "Cartão de Crédito",
};

export const CONTRACT_TYPE_LABELS: Record<CONTRACT_TYPE, string> = {
  [CONTRACT_TYPE.EXPERIENCE_PERIOD_1]: "Experiência 1",
  [CONTRACT_TYPE.EXPERIENCE_PERIOD_2]: "Experiência 2",
  [CONTRACT_TYPE.INDETERMINATE]: "Prazo indeterminado",
  [CONTRACT_TYPE.FIXED_TERM]: "Prazo determinado",
  [CONTRACT_TYPE.INTERMITTENT]: "Intermitente",
  [CONTRACT_TYPE.APPRENTICE]: "Aprendiz",
  [CONTRACT_TYPE.TEMPORARY]: "Temporário",
};

export const CONTRACT_STATUS_LABELS: Record<CONTRACT_STATUS, string> = {
  [CONTRACT_STATUS.ACTIVE]: "Ativo",
  [CONTRACT_STATUS.TERMINATED]: "Desligado",
};

export const EMPLOYEE_TYPE_LABELS: Record<EMPLOYEE_TYPE, string> = {
  [EMPLOYEE_TYPE.CLT]: "CLT",
  [EMPLOYEE_TYPE.INTERN]: "Estagiário",
  [EMPLOYEE_TYPE.PJ]: "Pessoa Jurídica (PJ)",
  [EMPLOYEE_TYPE.AUTONOMOUS]: "Autônomo",
};

export const REGISTRATION_STATUS_LABELS: Record<REGISTRATION_STATUS, string> = {
  [REGISTRATION_STATUS.ACTIVE]: "Ativa",
  [REGISTRATION_STATUS.SUSPENDED]: "Suspensa",
  [REGISTRATION_STATUS.UNFIT]: "Inapta",
  [REGISTRATION_STATUS.ACTIVE_NOT_REGULAR]: "Ativa Não Regular",
  [REGISTRATION_STATUS.DEREGISTERED]: "Baixada",
};

export const TASK_STATUS_LABELS: Record<TASK_STATUS, string> = {
  [TASK_STATUS.PREPARATION]: "Em Preparação",
  [TASK_STATUS.WAITING_PRODUCTION]: "Aguardando Produção",
  [TASK_STATUS.IN_PRODUCTION]: "Em Produção",
  [TASK_STATUS.COMPLETED]: "Concluído",
  [TASK_STATUS.CANCELLED]: "Cancelado",
};

export const GOAL_METRIC_LABELS: Record<GOAL_METRIC, string> = {
  [GOAL_METRIC.TASKS_COMPLETED]: "Tarefas concluídas",
  [GOAL_METRIC.TASKS_PER_ACTIVE_USER]: "Tarefas por colaborador ativo",
  [GOAL_METRIC.PRODUCTION_AVG_PERFORMANCE]: "Tarefas por colaborador (desempenho)",
  [GOAL_METRIC.COLLABORATORS_PER_SECTOR]: "Colaboradores por setor",
  [GOAL_METRIC.HR_HIRES_PER_MONTH]: "Admissões no mês",
  [GOAL_METRIC.HR_DISMISSALS_PER_MONTH]: "Desligamentos no mês",
  [GOAL_METRIC.HR_TURNOVER_RATE]: "Taxa de rotatividade",
  [GOAL_METRIC.HR_EXPERIENCE_FAILURE_RATE]: "Reprovação em experiência",
  [GOAL_METRIC.HR_ABSENTEEISM_RATE]: "Taxa de Faltas",
  [GOAL_METRIC.HR_PAYROLL_GROSS]: "Folha",
  [GOAL_METRIC.HR_PAYROLL_BONUSES_TOTAL]: "Bônus pagos",
  [GOAL_METRIC.INVOICES_PAID]: "Faturamento (pago)",
  [GOAL_METRIC.FINANCE_DSO_DAYS]: "Prazo médio de recebimento (DSO)",
  [GOAL_METRIC.FINANCE_OVERDUE_AMOUNT]: "Valor em atraso",
  [GOAL_METRIC.FINANCE_COLLECTION_RATE]: "Taxa de cobrança",
  [GOAL_METRIC.FINANCE_QUOTES_PER_PERIOD]: "Orçamentos no período",
  [GOAL_METRIC.FINANCE_CONVERSION_RATE]: "Taxa de conversão",
  [GOAL_METRIC.ORDER_COUNT_PER_PERIOD]: "Pedidos no período",
  [GOAL_METRIC.ORDER_TOTAL_VALUE]: "Valor total de pedidos",
  [GOAL_METRIC.INVENTORY_CONSUMPTION_VALUE]: "Consumo de estoque (valor)",
  [GOAL_METRIC.INVENTORY_OUTBOUND_VALUE]: "Saídas de estoque (valor)",
};

export const GOAL_METRIC_DESCRIPTIONS: Record<GOAL_METRIC, string> = {
  [GOAL_METRIC.TASKS_COMPLETED]: "Quantidade de tarefas finalizadas no período (status concluído)",
  [GOAL_METRIC.TASKS_PER_ACTIVE_USER]: "Tarefas concluídas dividido pelo número de colaboradores ativos da produção",
  [GOAL_METRIC.PRODUCTION_AVG_PERFORMANCE]: "Tarefas concluídas por colaborador (média ponderada por cargo)",
  [GOAL_METRIC.COLLABORATORS_PER_SECTOR]: "Quantidade de colaboradores ativos no setor ao final do período",
  [GOAL_METRIC.HR_HIRES_PER_MONTH]: "Quantidade de admissões esperadas no período",
  [GOAL_METRIC.HR_DISMISSALS_PER_MONTH]: "Limite de desligamentos no período",
  [GOAL_METRIC.HR_TURNOVER_RATE]: "Percentual de rotatividade no período (saídas / efetivo médio)",
  [GOAL_METRIC.HR_EXPERIENCE_FAILURE_RATE]: "Percentual de não-efetivações ao final do período de experiência",
  [GOAL_METRIC.HR_ABSENTEEISM_RATE]: "Percentual de horas faltadas sobre horas previstas",
  [GOAL_METRIC.HR_PAYROLL_GROSS]: "Limite orçamentário da folha de pagamento do setor",
  [GOAL_METRIC.HR_PAYROLL_BONUSES_TOTAL]: "Total esperado de bônus pagos ao setor",
  [GOAL_METRIC.INVOICES_PAID]: "Soma dos valores pagos de faturas no período",
  [GOAL_METRIC.FINANCE_DSO_DAYS]: "Dias médios entre faturamento e recebimento",
  [GOAL_METRIC.FINANCE_OVERDUE_AMOUNT]: "Limite máximo de valores em atraso ao final do período",
  [GOAL_METRIC.FINANCE_COLLECTION_RATE]: "Percentual recebido sobre o total a receber",
  [GOAL_METRIC.FINANCE_QUOTES_PER_PERIOD]: "Quantidade de orçamentos esperados no período",
  [GOAL_METRIC.FINANCE_CONVERSION_RATE]: "Percentual de orçamentos aprovados sobre criados",
  [GOAL_METRIC.ORDER_COUNT_PER_PERIOD]: "Quantidade de pedidos esperados no período",
  [GOAL_METRIC.ORDER_TOTAL_VALUE]: "Valor total esperado em pedidos no período",
  [GOAL_METRIC.INVENTORY_CONSUMPTION_VALUE]: "Limite orçamentário de consumo de estoque",
  [GOAL_METRIC.INVENTORY_OUTBOUND_VALUE]: "Limite orçamentário de saídas de estoque",
};

/** Unit of measure for each goal metric — drives axis labels, input masks, and chart formatting. */
export const GOAL_METRIC_UNIT: Record<GOAL_METRIC, GOAL_UNIT> = {
  [GOAL_METRIC.TASKS_COMPLETED]: GOAL_UNIT.COUNT,
  [GOAL_METRIC.TASKS_PER_ACTIVE_USER]: GOAL_UNIT.DECIMAL,
  [GOAL_METRIC.PRODUCTION_AVG_PERFORMANCE]: GOAL_UNIT.DECIMAL,
  [GOAL_METRIC.COLLABORATORS_PER_SECTOR]: GOAL_UNIT.COUNT,
  [GOAL_METRIC.HR_HIRES_PER_MONTH]: GOAL_UNIT.COUNT,
  [GOAL_METRIC.HR_DISMISSALS_PER_MONTH]: GOAL_UNIT.COUNT,
  [GOAL_METRIC.HR_TURNOVER_RATE]: GOAL_UNIT.PERCENTAGE,
  [GOAL_METRIC.HR_EXPERIENCE_FAILURE_RATE]: GOAL_UNIT.PERCENTAGE,
  [GOAL_METRIC.HR_ABSENTEEISM_RATE]: GOAL_UNIT.PERCENTAGE,
  [GOAL_METRIC.HR_PAYROLL_GROSS]: GOAL_UNIT.CURRENCY,
  [GOAL_METRIC.HR_PAYROLL_BONUSES_TOTAL]: GOAL_UNIT.CURRENCY,
  [GOAL_METRIC.INVOICES_PAID]: GOAL_UNIT.CURRENCY,
  [GOAL_METRIC.FINANCE_DSO_DAYS]: GOAL_UNIT.DAYS,
  [GOAL_METRIC.FINANCE_OVERDUE_AMOUNT]: GOAL_UNIT.CURRENCY,
  [GOAL_METRIC.FINANCE_COLLECTION_RATE]: GOAL_UNIT.PERCENTAGE,
  [GOAL_METRIC.FINANCE_QUOTES_PER_PERIOD]: GOAL_UNIT.COUNT,
  [GOAL_METRIC.FINANCE_CONVERSION_RATE]: GOAL_UNIT.PERCENTAGE,
  [GOAL_METRIC.ORDER_COUNT_PER_PERIOD]: GOAL_UNIT.COUNT,
  [GOAL_METRIC.ORDER_TOTAL_VALUE]: GOAL_UNIT.CURRENCY,
  [GOAL_METRIC.INVENTORY_CONSUMPTION_VALUE]: GOAL_UNIT.CURRENCY,
  [GOAL_METRIC.INVENTORY_OUTBOUND_VALUE]: GOAL_UNIT.CURRENCY,
};

/** Whether reaching the target is good (MAXIMIZE) or staying below it is good (MINIMIZE). */
export const GOAL_METRIC_DIRECTION: Record<GOAL_METRIC, GOAL_DIRECTION> = {
  [GOAL_METRIC.TASKS_COMPLETED]: GOAL_DIRECTION.MAXIMIZE,
  [GOAL_METRIC.TASKS_PER_ACTIVE_USER]: GOAL_DIRECTION.MAXIMIZE,
  [GOAL_METRIC.PRODUCTION_AVG_PERFORMANCE]: GOAL_DIRECTION.MAXIMIZE,
  [GOAL_METRIC.COLLABORATORS_PER_SECTOR]: GOAL_DIRECTION.MAXIMIZE,
  [GOAL_METRIC.HR_HIRES_PER_MONTH]: GOAL_DIRECTION.MAXIMIZE,
  [GOAL_METRIC.HR_DISMISSALS_PER_MONTH]: GOAL_DIRECTION.MINIMIZE,
  [GOAL_METRIC.HR_TURNOVER_RATE]: GOAL_DIRECTION.MINIMIZE,
  [GOAL_METRIC.HR_EXPERIENCE_FAILURE_RATE]: GOAL_DIRECTION.MINIMIZE,
  [GOAL_METRIC.HR_ABSENTEEISM_RATE]: GOAL_DIRECTION.MINIMIZE,
  [GOAL_METRIC.HR_PAYROLL_GROSS]: GOAL_DIRECTION.MINIMIZE,
  [GOAL_METRIC.HR_PAYROLL_BONUSES_TOTAL]: GOAL_DIRECTION.MAXIMIZE,
  [GOAL_METRIC.INVOICES_PAID]: GOAL_DIRECTION.MAXIMIZE,
  [GOAL_METRIC.FINANCE_DSO_DAYS]: GOAL_DIRECTION.MINIMIZE,
  [GOAL_METRIC.FINANCE_OVERDUE_AMOUNT]: GOAL_DIRECTION.MINIMIZE,
  [GOAL_METRIC.FINANCE_COLLECTION_RATE]: GOAL_DIRECTION.MAXIMIZE,
  [GOAL_METRIC.FINANCE_QUOTES_PER_PERIOD]: GOAL_DIRECTION.MAXIMIZE,
  [GOAL_METRIC.FINANCE_CONVERSION_RATE]: GOAL_DIRECTION.MAXIMIZE,
  [GOAL_METRIC.ORDER_COUNT_PER_PERIOD]: GOAL_DIRECTION.MAXIMIZE,
  [GOAL_METRIC.ORDER_TOTAL_VALUE]: GOAL_DIRECTION.MAXIMIZE,
  [GOAL_METRIC.INVENTORY_CONSUMPTION_VALUE]: GOAL_DIRECTION.MINIMIZE,
  [GOAL_METRIC.INVENTORY_OUTBOUND_VALUE]: GOAL_DIRECTION.MINIMIZE,
};

/**
 * Backwards-compatibility shim — kept so existing code keeps working until it
 * migrates to `GOAL_METRIC_UNIT`. New code should read the unit directly.
 */
export const GOAL_METRIC_IS_CURRENCY: Record<GOAL_METRIC, boolean> = Object.fromEntries(
  Object.values(GOAL_METRIC).map(m => [m, GOAL_METRIC_UNIT[m] === GOAL_UNIT.CURRENCY]),
) as Record<GOAL_METRIC, boolean>;

export const SERVICE_ORDER_STATUS_LABELS: Record<SERVICE_ORDER_STATUS, string> = {
  [SERVICE_ORDER_STATUS.PENDING]: "Pendente",
  [SERVICE_ORDER_STATUS.IN_PROGRESS]: "Em Andamento",
  [SERVICE_ORDER_STATUS.WAITING_ARTWORK]: "Aguardando Arte",
  [SERVICE_ORDER_STATUS.PAUSED]: "Pausado",
  [SERVICE_ORDER_STATUS.WAITING_APPROVE]: "Aguardando Aprovação",
  [SERVICE_ORDER_STATUS.COMPLETED]: "Concluído",
  [SERVICE_ORDER_STATUS.CANCELLED]: "Cancelado",
};

// Form labels (camelCase for better readability in dropdowns)
export const SERVICE_ORDER_TYPE_LABELS: Record<SERVICE_ORDER_TYPE, string> = {
  [SERVICE_ORDER_TYPE.PRODUCTION]: "Produção",
  [SERVICE_ORDER_TYPE.COMMERCIAL]: "Comercial",
  [SERVICE_ORDER_TYPE.LOGISTIC]: "Logística",
  [SERVICE_ORDER_TYPE.ARTWORK]: "Arte",
};

// Column labels (UPPERCASE for table headers and column visibility)
export const SERVICE_ORDER_TYPE_COLUMN_LABELS: Record<SERVICE_ORDER_TYPE, string> = {
  [SERVICE_ORDER_TYPE.PRODUCTION]: "PRODUÇÃO",
  [SERVICE_ORDER_TYPE.COMMERCIAL]: "COMERCIAL",
  [SERVICE_ORDER_TYPE.LOGISTIC]: "LOGÍSTICA",
  [SERVICE_ORDER_TYPE.ARTWORK]: "ARTE",
};

export const AIRBRUSHING_STATUS_LABELS: Record<AIRBRUSHING_STATUS, string> = {
  [AIRBRUSHING_STATUS.PENDING]: "Pendente",
  [AIRBRUSHING_STATUS.IN_PRODUCTION]: "Em Produção",
  [AIRBRUSHING_STATUS.COMPLETED]: "Concluído",
  [AIRBRUSHING_STATUS.CANCELLED]: "Cancelado",
};

export const AIRBRUSHING_PAYMENT_STATUS_LABELS: Record<AIRBRUSHING_PAYMENT_STATUS, string> = {
  [AIRBRUSHING_PAYMENT_STATUS.PENDING]: "Pendente",
  [AIRBRUSHING_PAYMENT_STATUS.PAID]: "Pago",
};

export const LAYOUT_STATUS_LABELS: Record<LAYOUT_STATUS, string> = {
  [LAYOUT_STATUS.DRAFT]: "Rascunho",
  [LAYOUT_STATUS.APPROVED]: "Aprovado",
  [LAYOUT_STATUS.REPROVED]: "Reprovado",
};

export const CUT_TYPE_LABELS: Record<CUT_TYPE, string> = {
  [CUT_TYPE.VINYL]: "Vinil",
  [CUT_TYPE.STENCIL]: "Espovo",
};

export const CUT_STATUS_LABELS: Record<CUT_STATUS, string> = {
  [CUT_STATUS.PENDING]: "Pendente",
  [CUT_STATUS.CUTTING]: "Cortando",
  [CUT_STATUS.COMPLETED]: "Concluído",
};

export const CUT_ORIGIN_LABELS: Record<CUT_ORIGIN, string> = {
  [CUT_ORIGIN.PLAN]: "Plano",
  [CUT_ORIGIN.REQUEST]: "Solicitação",
};

export const CUT_REQUEST_REASON_LABELS: Record<CUT_REQUEST_REASON, string> = {
  [CUT_REQUEST_REASON.WRONG_APPLY]: "Aplicação Errada",
  [CUT_REQUEST_REASON.LOST]: "Perdido",
  [CUT_REQUEST_REASON.WRONG]: "Errado",
};


export const MAINTENANCE_STATUS_LABELS: Record<MAINTENANCE_STATUS, string> = {
  [MAINTENANCE_STATUS.PENDING]: "Pendente",
  [MAINTENANCE_STATUS.IN_PROGRESS]: "Em Andamento",
  [MAINTENANCE_STATUS.COMPLETED]: "Concluído",
  [MAINTENANCE_STATUS.CANCELLED]: "Cancelado",
  [MAINTENANCE_STATUS.OVERDUE]: "Atrasado",
};

export const MAINTENANCE_SCHEDULE_STATUS_LABELS: Record<MAINTENANCE_SCHEDULE_STATUS, string> = {
  [MAINTENANCE_SCHEDULE_STATUS.PENDING]: "Pendente",
  [MAINTENANCE_SCHEDULE_STATUS.FINISHED]: "Finalizado",
  [MAINTENANCE_SCHEDULE_STATUS.CANCELLED]: "Cancelado",
};

export const BORROW_STATUS_LABELS: Record<BORROW_STATUS, string> = {
  [BORROW_STATUS.ACTIVE]: "Ativo",
  [BORROW_STATUS.RETURNED]: "Devolvido",
  [BORROW_STATUS.LOST]: "Perdido",
};

export const EXTERNAL_OPERATION_STATUS_LABELS: Record<EXTERNAL_OPERATION_STATUS, string> = {
  [EXTERNAL_OPERATION_STATUS.PENDING]: "Pendente",
  [EXTERNAL_OPERATION_STATUS.CANCELLED]: "Cancelado",
  [EXTERNAL_OPERATION_STATUS.PARTIALLY_RETURNED]: "Parcialmente Devolvido",
  [EXTERNAL_OPERATION_STATUS.FULLY_RETURNED]: "Totalmente Devolvido",
  [EXTERNAL_OPERATION_STATUS.CHARGED]: "Cobrado",
  [EXTERNAL_OPERATION_STATUS.LIQUIDATED]: "Liquidado",
  [EXTERNAL_OPERATION_STATUS.DELIVERED]: "Entregue",
};

export const EXTERNAL_OPERATION_TYPE_LABELS: Record<EXTERNAL_OPERATION_TYPE, string> = {
  [EXTERNAL_OPERATION_TYPE.RETURNABLE]: "Retornável",
  [EXTERNAL_OPERATION_TYPE.CHARGEABLE]: "Cobrável",
  [EXTERNAL_OPERATION_TYPE.COMPLIMENTARY]: "Cortesia",
};

export const PPE_REQUEST_STATUS_LABELS: Record<PPE_REQUEST_STATUS, string> = {
  [PPE_REQUEST_STATUS.PENDING]: "Pendente",
  [PPE_REQUEST_STATUS.APPROVED]: "Aprovado",
  [PPE_REQUEST_STATUS.REJECTED]: "Rejeitado",
  [PPE_REQUEST_STATUS.DELIVERED]: "Entregue",
  [PPE_REQUEST_STATUS.CANCELLED]: "Cancelado",
};

export const PPE_DELIVERY_STATUS_LABELS: Record<PPE_DELIVERY_STATUS, string> = {
  [PPE_DELIVERY_STATUS.PENDING]: "Pendente",
  [PPE_DELIVERY_STATUS.APPROVED]: "Aprovado",
  [PPE_DELIVERY_STATUS.DELIVERED]: "Entregue",
  [PPE_DELIVERY_STATUS.WAITING_SIGNATURE]: "Aguardando Assinatura",
  [PPE_DELIVERY_STATUS.COMPLETED]: "Concluído",
  [PPE_DELIVERY_STATUS.REPROVED]: "Reprovado",
  [PPE_DELIVERY_STATUS.SIGNATURE_REJECTED]: "Assinatura Rejeitada",
  [PPE_DELIVERY_STATUS.CANCELLED]: "Cancelado",
};

export const ASSIGNMENT_TYPE_LABELS: Record<ASSIGNMENT_TYPE, string> = {
  [ASSIGNMENT_TYPE.ALL]: "Todos",
  [ASSIGNMENT_TYPE.ALL_EXCEPT]: "Todos Exceto",
  [ASSIGNMENT_TYPE.SPECIFIC]: "Específicos",
};

// =====================
// Paint Labels
// =====================

// PAINT_TYPE is now a model instead of enum
// Paint types are managed dynamically in the database

export const PAINT_BRAND_LABELS: Record<PAINT_BRAND, string> = {
  [PAINT_BRAND.PPG]: "PPG",
  [PAINT_BRAND.FARBEN]: "Farben",
  [PAINT_BRAND.LAZZURIL]: "Lazzuril",
};

export const PAINT_FINISH_LABELS: Record<PAINT_FINISH, string> = {
  [PAINT_FINISH.SOLID]: "Lisa",
  [PAINT_FINISH.METALLIC]: "Metálico",
  [PAINT_FINISH.PEARL]: "Perolizado",
  [PAINT_FINISH.MATTE]: "Fosco",
  [PAINT_FINISH.SATIN]: "Semi Brilho",
};

export const PAINT_TYPE_ENUM_LABELS: Record<PAINT_TYPE_ENUM, string> = {
  [PAINT_TYPE_ENUM.POLYESTER]: "Poliéster",
  [PAINT_TYPE_ENUM.ACRYLIC]: "Acrílica",
  [PAINT_TYPE_ENUM.LACQUER]: "Laca",
  [PAINT_TYPE_ENUM.POLYURETHANE]: "Poliuretano",
  [PAINT_TYPE_ENUM.EPOXY]: "Epóxi",
};



// =====================
// Truck Labels
// =====================

export const TRUCK_MANUFACTURER_LABELS: Record<TRUCK_MANUFACTURER, string> = {
  [TRUCK_MANUFACTURER.VOLKSWAGEN]: "Volkswagen",
  [TRUCK_MANUFACTURER.MERCEDES_BENZ]: "Mercedes-Benz",
  [TRUCK_MANUFACTURER.SCANIA]: "Scania",
  [TRUCK_MANUFACTURER.VOLVO]: "Volvo",
  [TRUCK_MANUFACTURER.DAF]: "DAF",
  [TRUCK_MANUFACTURER.IVECO]: "Iveco",
};

export const TRUCK_CATEGORY_LABELS: Record<TRUCK_CATEGORY, string> = {
  [TRUCK_CATEGORY.MINI]: 'Mini',
  [TRUCK_CATEGORY.VUC]: 'VUC',
  [TRUCK_CATEGORY.THREE_QUARTER]: '3/4',
  [TRUCK_CATEGORY.RIGID]: 'Toco',
  [TRUCK_CATEGORY.TRUCK]: 'Truck',
  [TRUCK_CATEGORY.SEMI_TRAILER]: 'Semirreboque',
  [TRUCK_CATEGORY.SEMI_TRAILER_2_AXLES]: 'Semirreboque 2 Eixos',
  [TRUCK_CATEGORY.B_DOUBLE_FRONT]: 'Bitrem Compartimento Frontal',
  [TRUCK_CATEGORY.B_DOUBLE_REAR]: 'Bitrem Compartimento Traseiro',
  [TRUCK_CATEGORY.BITRUCK]: 'Bitruck',
};

export const IMPLEMENT_TYPE_LABELS: Record<IMPLEMENT_TYPE, string> = {
  [IMPLEMENT_TYPE.DRY_CARGO]: 'Carga Seca',
  [IMPLEMENT_TYPE.REFRIGERATED]: 'Refrigerado',
  [IMPLEMENT_TYPE.INSULATED]: 'Isoplastic',
  [IMPLEMENT_TYPE.CURTAIN_SIDE]: 'Sider',
  [IMPLEMENT_TYPE.TANK]: 'Tanque',
  [IMPLEMENT_TYPE.FLATBED]: 'Carroceria',
};

// =====================
// Warning Labels
// =====================

export const WARNING_SEVERITY_LABELS: Record<WARNING_SEVERITY, string> = {
  [WARNING_SEVERITY.VERBAL]: "Verbal",
  [WARNING_SEVERITY.WRITTEN]: "Escrita",
  [WARNING_SEVERITY.SUSPENSION]: "Suspensão",
  [WARNING_SEVERITY.FINAL_WARNING]: "Advertência Final",
};

export const WARNING_CATEGORY_LABELS: Record<WARNING_CATEGORY, string> = {
  [WARNING_CATEGORY.SAFETY]: "Segurança",
  [WARNING_CATEGORY.MISCONDUCT]: "Má Conduta",
  [WARNING_CATEGORY.INSUBORDINATION]: "Insubordinação",
  [WARNING_CATEGORY.POLICY_VIOLATION]: "Violação de Política",
  [WARNING_CATEGORY.ATTENDANCE]: "Assiduidade",
  [WARNING_CATEGORY.PERFORMANCE]: "Desempenho",
  [WARNING_CATEGORY.BEHAVIOR]: "Comportamento",
  [WARNING_CATEGORY.OTHER]: "Outro",
};

// =====================
// Notification Labels
// =====================

export const NOTIFICATION_TYPE_LABELS: Record<NOTIFICATION_TYPE, string> = {
  [NOTIFICATION_TYPE.SYSTEM]: "Sistema",
  [NOTIFICATION_TYPE.PRODUCTION]: "Produção",
  [NOTIFICATION_TYPE.STOCK]: "Estoque",
  [NOTIFICATION_TYPE.USER]: "Usuário",
  [NOTIFICATION_TYPE.GENERAL]: "Geral",
};

export const NOTIFICATION_ACTION_TYPE_LABELS: Record<NOTIFICATION_ACTION_TYPE, string> = {
  [NOTIFICATION_ACTION_TYPE.VIEW_DETAILS]: "Ver Detalhes",
  [NOTIFICATION_ACTION_TYPE.APPROVE_REQUEST]: "Aprovar Solicitação",
  [NOTIFICATION_ACTION_TYPE.REJECT_REQUEST]: "Rejeitar Solicitação",
  [NOTIFICATION_ACTION_TYPE.COMPLETE_TASK]: "Concluir Tarefa",
  [NOTIFICATION_ACTION_TYPE.TASK_CREATED]: "Tarefa Criada",
  [NOTIFICATION_ACTION_TYPE.TASK_UPDATED]: "Tarefa Atualizada",
  [NOTIFICATION_ACTION_TYPE.VIEW_ORDER]: "Ver Pedido",
  [NOTIFICATION_ACTION_TYPE.VIEW_SERVICE_ORDER]: "Ver Ordem de Serviço",
  [NOTIFICATION_ACTION_TYPE.VIEW_REPORT]: "Ver Relatório",
  [NOTIFICATION_ACTION_TYPE.ACKNOWLEDGE]: "Confirmar",
  [NOTIFICATION_ACTION_TYPE.DISMISS]: "Dispensar",
};

export const NOTIFICATION_IMPORTANCE_LABELS: Record<NOTIFICATION_IMPORTANCE, string> = {
  [NOTIFICATION_IMPORTANCE.LOW]: "Baixa",
  [NOTIFICATION_IMPORTANCE.NORMAL]: "Normal",
  [NOTIFICATION_IMPORTANCE.HIGH]: "Alta",
  [NOTIFICATION_IMPORTANCE.URGENT]: "Urgente",
};

export const NOTIFICATION_CHANNEL_LABELS: Record<NOTIFICATION_CHANNEL, string> = {
  [NOTIFICATION_CHANNEL.IN_APP]: "No Aplicativo",
  [NOTIFICATION_CHANNEL.PUSH]: "Push",
  [NOTIFICATION_CHANNEL.EMAIL]: "E-mail",
  [NOTIFICATION_CHANNEL.WHATSAPP]: "WhatsApp",
};

// =====================
// Other Labels
// =====================

export const COLOR_SCHEMA_LABELS: Record<COLOR_SCHEMA, string> = {
  [COLOR_SCHEMA.LIGHT]: "Claro",
  [COLOR_SCHEMA.DARK]: "Escuro",
  [COLOR_SCHEMA.SYSTEM]: "Automático",
};

export const VERIFICATION_TYPE_LABELS: Record<VERIFICATION_TYPE, string> = {
  [VERIFICATION_TYPE.EMAIL]: "E-mail",
  [VERIFICATION_TYPE.PHONE]: "Telefone",
  [VERIFICATION_TYPE.PASSWORD_RESET]: "Redefinição de Senha",
};

export const VERIFICATION_ERROR_CODE_LABELS: Record<VERIFICATION_ERROR_CODE, string> = {
  // Request validation errors
  [VERIFICATION_ERROR_CODE.INVALID_CONTACT]: "Contato inválido",
  [VERIFICATION_ERROR_CODE.CONTACT_REQUIRED]: "Contato é obrigatório",
  [VERIFICATION_ERROR_CODE.CODE_REQUIRED]: "Código é obrigatório",
  [VERIFICATION_ERROR_CODE.INVALID_CONTACT_FORMAT]: "Formato de contato inválido",

  // User-related errors
  [VERIFICATION_ERROR_CODE.USER_NOT_FOUND]: "Usuário não encontrado",
  [VERIFICATION_ERROR_CODE.USER_ALREADY_VERIFIED]: "Conta já verificada",
  [VERIFICATION_ERROR_CODE.USER_INACTIVE]: "Usuário inativo",

  // Code validation errors
  [VERIFICATION_ERROR_CODE.INVALID_CODE]: "Código de verificação inválido",
  [VERIFICATION_ERROR_CODE.CODE_EXPIRED]: "Código de verificação expirado",
  [VERIFICATION_ERROR_CODE.NO_CODE_SENT]: "No code was sent",
  [VERIFICATION_ERROR_CODE.CODE_MISMATCH]: "Código não confere",

  // Rate limiting errors
  [VERIFICATION_ERROR_CODE.TOO_MANY_ATTEMPTS]: "Muitas tentativas de verificação",
  [VERIFICATION_ERROR_CODE.TOO_MANY_REQUESTS]: "Muitas solicitações",
  [VERIFICATION_ERROR_CODE.CONTACT_COOLDOWN]: "Aguarde antes de tentar novamente",
  [VERIFICATION_ERROR_CODE.IP_RATE_LIMITED]: "Limite de tentativas por IP excedido",
  [VERIFICATION_ERROR_CODE.PROGRESSIVE_DELAY]: "Aguarde antes da próxima tentativa",

  // Service errors
  [VERIFICATION_ERROR_CODE.SMS_SEND_FAILED]: "Failed to send SMS",
  [VERIFICATION_ERROR_CODE.EMAIL_SEND_FAILED]: "Failed to send email",
  [VERIFICATION_ERROR_CODE.NOTIFICATION_FAILED]: "Failed to send notification",
  [VERIFICATION_ERROR_CODE.EXTERNAL_SERVICE_ERROR]: "External service error",

  // System errors
  [VERIFICATION_ERROR_CODE.DATABASE_ERROR]: "Database error",
  [VERIFICATION_ERROR_CODE.CACHE_ERROR]: "Cache error",
  [VERIFICATION_ERROR_CODE.CONFIGURATION_ERROR]: "Configuration error",
  [VERIFICATION_ERROR_CODE.INTERNAL_ERROR]: "Internal system error",

  // Security errors
  [VERIFICATION_ERROR_CODE.SUSPICIOUS_ACTIVITY]: "Atividade suspeita detectada",
  [VERIFICATION_ERROR_CODE.BLOCKED_IP]: "IP bloqueado",
  [VERIFICATION_ERROR_CODE.BLACKLISTED_CONTACT]: "Contato na lista de bloqueio",
  [VERIFICATION_ERROR_CODE.SECURITY_VIOLATION]: "Violação de segurança",
};

export const VERIFICATION_ERROR_SEVERITY_LABELS: Record<VERIFICATION_ERROR_SEVERITY, string> = {
  [VERIFICATION_ERROR_SEVERITY.LOW]: "Low",
  [VERIFICATION_ERROR_SEVERITY.MEDIUM]: "Medium",
  [VERIFICATION_ERROR_SEVERITY.HIGH]: "High",
  [VERIFICATION_ERROR_SEVERITY.CRITICAL]: "Crítica",
};

export const VERIFICATION_ERROR_CATEGORY_LABELS: Record<VERIFICATION_ERROR_CATEGORY, string> = {
  [VERIFICATION_ERROR_CATEGORY.VALIDATION]: "Validação",
  [VERIFICATION_ERROR_CATEGORY.RATE_LIMITING]: "Limite de Taxa",
  [VERIFICATION_ERROR_CATEGORY.AUTHENTICATION]: "Autenticação",
  [VERIFICATION_ERROR_CATEGORY.EXTERNAL_SERVICE]: "Serviço Externo",
  [VERIFICATION_ERROR_CATEGORY.SYSTEM]: "Sistema",
  [VERIFICATION_ERROR_CATEGORY.SECURITY]: "Segurança",
};

export const HOLIDAY_TYPE_LABELS: Record<HOLIDAY_TYPE, string> = {
  [HOLIDAY_TYPE.NATIONAL]: "Nacional",
  [HOLIDAY_TYPE.STATE]: "Estadual",
  [HOLIDAY_TYPE.MUNICIPAL]: "Municipal",
  [HOLIDAY_TYPE.OPTIONAL]: "Facultativo",
};

export const MEASURE_UNIT_LABELS: Record<MEASURE_UNIT, string> = {
  // Weight units
  [MEASURE_UNIT.KILOGRAM]: "kg",
  [MEASURE_UNIT.GRAM]: "g",

  // Volume units
  [MEASURE_UNIT.MILLILITER]: "ml",
  [MEASURE_UNIT.LITER]: "l",
  [MEASURE_UNIT.CUBIC_METER]: "m³",
  [MEASURE_UNIT.CUBIC_CENTIMETER]: "cm³",

  // Length units
  [MEASURE_UNIT.MILLIMETER]: "mm",
  [MEASURE_UNIT.CENTIMETER]: "cm",
  [MEASURE_UNIT.METER]: "m",
  [MEASURE_UNIT.INCHES]: "pol",

  // Diameter units (fractional inches)
  [MEASURE_UNIT.INCH_1_8]: '1/8"',
  [MEASURE_UNIT.INCH_1_4]: '1/4"',
  [MEASURE_UNIT.INCH_3_8]: '3/8"',
  [MEASURE_UNIT.INCH_1_2]: '1/2"',
  [MEASURE_UNIT.INCH_5_8]: '5/8"',
  [MEASURE_UNIT.INCH_3_4]: '3/4"',
  [MEASURE_UNIT.INCH_7_8]: '7/8"',
  [MEASURE_UNIT.INCH_1]: '1"',
  [MEASURE_UNIT.INCH_1_1_4]: '1.1/4"',
  [MEASURE_UNIT.INCH_1_1_2]: '1.1/2"',
  [MEASURE_UNIT.INCH_2]: '2"',

  // Thread pitch units
  [MEASURE_UNIT.THREAD_MM]: "mm (passo)",
  [MEASURE_UNIT.THREAD_TPI]: "TPI",

  // Electrical units
  [MEASURE_UNIT.WATT]: "W",
  [MEASURE_UNIT.VOLT]: "V",
  [MEASURE_UNIT.AMPERE]: "A",

  // Area units
  [MEASURE_UNIT.SQUARE_CENTIMETER]: "cm²",
  [MEASURE_UNIT.SQUARE_METER]: "m²",

  // Count and packaging units
  [MEASURE_UNIT.UNIT]: "un",
  [MEASURE_UNIT.PAIR]: "pr",
  [MEASURE_UNIT.DOZEN]: "dz",
  [MEASURE_UNIT.HUNDRED]: "ct",
  [MEASURE_UNIT.THOUSAND]: "mil",

  // Container and packaging units
  [MEASURE_UNIT.PACKAGE]: "pc",
  [MEASURE_UNIT.BOX]: "cx",
  [MEASURE_UNIT.ROLL]: "rl",
  [MEASURE_UNIT.SHEET]: "fl",
  [MEASURE_UNIT.SET]: "cj",
  [MEASURE_UNIT.SACK]: "sc",

  // PPE Size units (letter sizes)
  [MEASURE_UNIT.P]: "P",
  [MEASURE_UNIT.M]: "M",
  [MEASURE_UNIT.G]: "G",
  [MEASURE_UNIT.GG]: "GG",
  [MEASURE_UNIT.XG]: "XG",
};

export const MEASURE_TYPE_LABELS: Record<MEASURE_TYPE, string> = {
  [MEASURE_TYPE.WEIGHT]: "Peso",
  [MEASURE_TYPE.VOLUME]: "Volume",
  [MEASURE_TYPE.LENGTH]: "Comprimento",
  [MEASURE_TYPE.WIDTH]: "Largura",
  [MEASURE_TYPE.THICKNESS]: "Espessura",
  [MEASURE_TYPE.AREA]: "Área",
  [MEASURE_TYPE.COUNT]: "Contagem",
  [MEASURE_TYPE.DIAMETER]: "Diâmetro",
  [MEASURE_TYPE.THREAD]: "Rosca/Passo",
  [MEASURE_TYPE.ELECTRICAL]: "Elétrico",
  [MEASURE_TYPE.SIZE]: "Tamanho",
};

// =====================
// Additional Labels
// =====================

export const SECTOR_PRIVILEGES_LABELS: Record<SECTOR_PRIVILEGES, string> = {
  [SECTOR_PRIVILEGES.BASIC]: "Básico",
  [SECTOR_PRIVILEGES.MAINTENANCE]: "Manutenção",
  [SECTOR_PRIVILEGES.WAREHOUSE]: "Almoxarifado",
  [SECTOR_PRIVILEGES.DESIGNER]: "Designer",
  [SECTOR_PRIVILEGES.LOGISTIC]: "Logística",
  [SECTOR_PRIVILEGES.FINANCIAL]: "Financeiro",
  [SECTOR_PRIVILEGES.ADMIN]: "Administrador",
  [SECTOR_PRIVILEGES.PRODUCTION]: "Produção",
  [SECTOR_PRIVILEGES.HUMAN_RESOURCES]: "Departamento Pessoal",
  [SECTOR_PRIVILEGES.EXTERNAL]: "Externo",
  [SECTOR_PRIVILEGES.PLOTTING]: "Plotagem",
  [SECTOR_PRIVILEGES.COMMERCIAL]: "Comercial",
  [SECTOR_PRIVILEGES.PRODUCTION_MANAGER]: "Gerente de Produção",
  [SECTOR_PRIVILEGES.AIRBRUSHING]: "Aerografia",
  [SECTOR_PRIVILEGES.ACCOUNTING]: "Contabilidade",
};

export const TREND_DIRECTION_LABELS: Record<TREND_DIRECTION, string> = {
  [TREND_DIRECTION.UP]: "Crescente",
  [TREND_DIRECTION.DOWN]: "Decrescente",
  [TREND_DIRECTION.STABLE]: "Estável",
};

export const TREND_TYPE_LABELS: Record<TREND_TYPE, string> = {
  [TREND_TYPE.POSITIVE]: "Positivo",
  [TREND_TYPE.NEGATIVE]: "Negativo",
  [TREND_TYPE.NEUTRAL]: "Neutro",
  [TREND_TYPE.VOLATILE]: "Volátil",
  [TREND_TYPE.SEASONAL]: "Sazonal",
};

export const PERIOD_TYPE_LABELS: Record<PERIOD_TYPE, string> = {
  [PERIOD_TYPE.DAILY]: "Diário",
  [PERIOD_TYPE.WEEKLY]: "Semanal",
  [PERIOD_TYPE.MONTHLY]: "Mensal",
  [PERIOD_TYPE.QUARTERLY]: "Trimestral",
  [PERIOD_TYPE.YEARLY]: "Anual",
};

export const CHART_TYPE_LABELS: Record<CHART_TYPE, string> = {
  [CHART_TYPE.PIE]: "Pizza",
  [CHART_TYPE.DONUT]: "Rosca",
  [CHART_TYPE.AREA]: "Área",
  [CHART_TYPE.BAR]: "Barras",
  [CHART_TYPE.LINE]: "Linhas",
  [CHART_TYPE.STACKED]: "Empilhado",
};

export const PRIORITY_TYPE_LABELS: Record<PRIORITY_TYPE, string> = {
  [PRIORITY_TYPE.LOW]: "Low",
  [PRIORITY_TYPE.MEDIUM]: "Medium",
  [PRIORITY_TYPE.HIGH]: "High",
  [PRIORITY_TYPE.CRITICAL]: "Crítica",
};

export const RISK_LEVEL_LABELS: Record<RISK_LEVEL, string> = {
  [RISK_LEVEL.LOW]: "Baixo",
  [RISK_LEVEL.MEDIUM]: "Médio",
  [RISK_LEVEL.HIGH]: "Alto",
  [RISK_LEVEL.CRITICAL]: "Crítico",
};

export const STOCK_LEVEL_LABELS: Record<STOCK_LEVEL, string> = {
  [STOCK_LEVEL.NEGATIVE_STOCK]: "Estoque Negativo",
  [STOCK_LEVEL.OUT_OF_STOCK]: "Sem Estoque",
  [STOCK_LEVEL.CRITICAL]: "Crítico",
  [STOCK_LEVEL.LOW]: "Baixo",
  [STOCK_LEVEL.OPTIMAL]: "Ótimo",
  [STOCK_LEVEL.OVERSTOCKED]: "Excesso de Estoque",
};

export const ABC_CATEGORY_LABELS: Record<ABC_CATEGORY, string> = {
  [ABC_CATEGORY.A]: "Categoria A - Alto Valor",
  [ABC_CATEGORY.B]: "Categoria B - Médio Valor",
  [ABC_CATEGORY.C]: "Categoria C - Baixo Valor",
};

export const XYZ_CATEGORY_LABELS: Record<XYZ_CATEGORY, string> = {
  [XYZ_CATEGORY.X]: "Categoria X - Demanda Estável",
  [XYZ_CATEGORY.Y]: "Categoria Y - Demanda Variável",
  [XYZ_CATEGORY.Z]: "Categoria Z - Demanda Irregular",
};

export const HEALTH_STATUS_LABELS: Record<HEALTH_STATUS, string> = {
  [HEALTH_STATUS.EXCELLENT]: "Excelente",
  [HEALTH_STATUS.GOOD]: "Bom",
  [HEALTH_STATUS.FAIR]: "Regular",
  [HEALTH_STATUS.POOR]: "Ruim",
  [HEALTH_STATUS.CRITICAL]: "Crítico",
};

export const PERFORMANCE_LEVEL_LABELS: Record<PERFORMANCE_LEVEL, string> = {
  [PERFORMANCE_LEVEL.EXCELLENT]: "Excelente",
  [PERFORMANCE_LEVEL.GOOD]: "Bom",
  [PERFORMANCE_LEVEL.FAIR]: "Regular",
  [PERFORMANCE_LEVEL.POOR]: "Ruim",
};

export const URGENCY_LEVEL_LABELS: Record<URGENCY_LEVEL, string> = {
  [URGENCY_LEVEL.LOW]: "Low",
  [URGENCY_LEVEL.MEDIUM]: "Medium",
  [URGENCY_LEVEL.HIGH]: "High",
  [URGENCY_LEVEL.CRITICAL]: "Crítica",
};

export const EFFORT_LEVEL_LABELS: Record<EFFORT_LEVEL, string> = {
  [EFFORT_LEVEL.LOW]: "Baixo",
  [EFFORT_LEVEL.MEDIUM]: "Médio",
  [EFFORT_LEVEL.HIGH]: "Alto",
};

export const CONFIDENCE_LEVEL_LABELS: Record<CONFIDENCE_LEVEL, string> = {
  [CONFIDENCE_LEVEL.LOW]: "Low",
  [CONFIDENCE_LEVEL.MEDIUM]: "Medium",
  [CONFIDENCE_LEVEL.HIGH]: "High",
};

export const PERCENTAGE_ADJUST_TYPE_LABELS: Record<PERCENTAGE_ADJUST_TYPE, string> = {
  [PERCENTAGE_ADJUST_TYPE.INCREASE]: "Aumento",
  [PERCENTAGE_ADJUST_TYPE.DECREASE]: "Redução",
};

export const EXPORT_FORMAT_LABELS: Record<EXPORT_FORMAT, string> = {
  [EXPORT_FORMAT.CSV]: "CSV",
  [EXPORT_FORMAT.EXCEL]: "Excel",
  [EXPORT_FORMAT.PDF]: "PDF",
  [EXPORT_FORMAT.JSON]: "JSON",
};

export const BATCH_OPERATION_STATUS_LABELS: Record<BATCH_OPERATION_STATUS, string> = {
  [BATCH_OPERATION_STATUS.PENDING]: "Pending",
  [BATCH_OPERATION_STATUS.PROCESSING]: "Processing",
  [BATCH_OPERATION_STATUS.COMPLETED]: "Concluído",
  [BATCH_OPERATION_STATUS.FAILED]: "Falhou",
  [BATCH_OPERATION_STATUS.PARTIAL]: "Parcial",
};

export const VALIDATION_SEVERITY_LABELS: Record<VALIDATION_SEVERITY, string> = {
  [VALIDATION_SEVERITY.ERROR]: "Error",
  [VALIDATION_SEVERITY.WARNING]: "Warning",
  [VALIDATION_SEVERITY.INFO]: "Info",
};

export const WEEK_DAY_LABELS: Record<WEEK_DAY, string> = {
  [WEEK_DAY.MONDAY]: "Segunda-feira",
  [WEEK_DAY.TUESDAY]: "Terça-feira",
  [WEEK_DAY.WEDNESDAY]: "Quarta-feira",
  [WEEK_DAY.THURSDAY]: "Quinta-feira",
  [WEEK_DAY.FRIDAY]: "Sexta-feira",
  [WEEK_DAY.SATURDAY]: "Sábado",
  [WEEK_DAY.SUNDAY]: "Domingo",
};

export const MONTH_LABELS: Record<MONTH, string> = {
  [MONTH.JANUARY]: "Janeiro",
  [MONTH.FEBRUARY]: "Fevereiro",
  [MONTH.MARCH]: "Março",
  [MONTH.APRIL]: "Abril",
  [MONTH.MAY]: "Maio",
  [MONTH.JUNE]: "Junho",
  [MONTH.JULY]: "Julho",
  [MONTH.AUGUST]: "Agosto",
  [MONTH.SEPTEMBER]: "Setembro",
  [MONTH.OCTOBER]: "Outubro",
  [MONTH.NOVEMBER]: "Novembro",
  [MONTH.DECEMBER]: "Dezembro",
};

export const MONTH_OCCURRENCE_LABELS: Record<MONTH_OCCURRENCE, string> = {
  [MONTH_OCCURRENCE.FIRST]: "Primeira",
  [MONTH_OCCURRENCE.SECOND]: "Segunda",
  [MONTH_OCCURRENCE.THIRD]: "Terceira",
  [MONTH_OCCURRENCE.FOURTH]: "Quarta",
  [MONTH_OCCURRENCE.LAST]: "Última",
};

export const SCHEDULE_FREQUENCY_LABELS: Record<SCHEDULE_FREQUENCY, string> = {
  [SCHEDULE_FREQUENCY.ONCE]: "Uma Vez",
  [SCHEDULE_FREQUENCY.DAILY]: "Diário",
  [SCHEDULE_FREQUENCY.WEEKLY]: "Semanal",
  [SCHEDULE_FREQUENCY.BIWEEKLY]: "Quinzenal",
  [SCHEDULE_FREQUENCY.MONTHLY]: "Mensal",
  [SCHEDULE_FREQUENCY.BIMONTHLY]: "Bimestral",
  [SCHEDULE_FREQUENCY.QUARTERLY]: "Trimestral",
  [SCHEDULE_FREQUENCY.TRIANNUAL]: "Quadrimestral",
  [SCHEDULE_FREQUENCY.QUADRIMESTRAL]: "Quadrimestral",
  [SCHEDULE_FREQUENCY.SEMI_ANNUAL]: "Semestral",
  [SCHEDULE_FREQUENCY.ANNUAL]: "Anual",
  [SCHEDULE_FREQUENCY.CUSTOM]: "Personalizado",
};

/**
 * Generate dynamic frequency label based on frequency + interval
 * @param frequency Base frequency
 * @param interval Frequency interval/count (default: 1)
 * @returns Localized frequency label
 */
export function getDynamicFrequencyLabel(frequency: SCHEDULE_FREQUENCY, interval: number = 1): string {
  if (!interval || interval === 1) {
    return SCHEDULE_FREQUENCY_LABELS[frequency] || frequency;
  }

  switch (frequency) {
    case SCHEDULE_FREQUENCY.DAILY:
      return interval === 1 ? "Diário" : `A cada ${interval} dias`;

    case SCHEDULE_FREQUENCY.WEEKLY:
      if (interval === 2) return "Quinzenal";
      return interval === 1 ? "Semanal" : `A cada ${interval} semanas`;

    case SCHEDULE_FREQUENCY.MONTHLY:
      if (interval === 2) return "Bimestral";
      if (interval === 3) return "Trimestral";
      if (interval === 4) return "Quadrimestral";
      if (interval === 6) return "Semestral";
      return interval === 1 ? "Mensal" : `A cada ${interval} meses`;

    case SCHEDULE_FREQUENCY.ANNUAL:
      return interval === 1 ? "Anual" : `A cada ${interval} anos`;

    default:
      return SCHEDULE_FREQUENCY_LABELS[frequency] || frequency;
  }
}

/**
 * Returns the human-readable cadence detail suffix for a schedule.
 * Examples:
 *   - "Mensal — toda primeira quinta-feira"   (monthlyConfig.occurrence + dayOfWeek)
 *   - "Bimestral — dia 10"                    (monthlyConfig.dayOfMonth or flat dayOfMonth)
 *   - "Semanal — terça-feira"                 (weekly + dayOfWeek)
 *   - "Anual — 15 de março"                   (annual + month + dayOfMonth)
 *   - "Anual — primeira segunda-feira de Maio" (annual + yearlyConfig.occurrence)
 * Composes with `getDynamicFrequencyLabel`. Returns the base label alone when
 * no detail can be derived (e.g., schedule has no config attached yet).
 */
export function getScheduleCadenceLabel(
  frequency: SCHEDULE_FREQUENCY,
  frequencyCount: number = 1,
  opts: {
    dayOfMonth?: number | null;
    dayOfWeek?: WEEK_DAY | string | null;
    month?: MONTH | string | null;
    monthlyConfig?: {
      dayOfMonth?: number | null;
      occurrence?: MONTH_OCCURRENCE | string | null;
      dayOfWeek?: WEEK_DAY | string | null;
    } | null;
    weeklyConfig?: {
      monday?: boolean; tuesday?: boolean; wednesday?: boolean;
      thursday?: boolean; friday?: boolean; saturday?: boolean; sunday?: boolean;
    } | null;
    yearlyConfig?: {
      month?: MONTH | string | null;
      dayOfMonth?: number | null;
      occurrence?: MONTH_OCCURRENCE | string | null;
      dayOfWeek?: WEEK_DAY | string | null;
    } | null;
  } = {},
): string {
  const base = getDynamicFrequencyLabel(frequency, frequencyCount);
  const detail = describeCadenceDetail(frequency, opts);
  return detail ? `${base} — ${detail}` : base;
}

function describeCadenceDetail(
  frequency: SCHEDULE_FREQUENCY,
  opts: Parameters<typeof getScheduleCadenceLabel>[2],
): string | null {
  const wd = (v: any) => v ? (WEEK_DAY_LABELS as any)[v]?.toLowerCase() ?? null : null;
  const occ = (v: any) => v ? (MONTH_OCCURRENCE_LABELS as any)[v]?.toLowerCase() ?? null : null;
  const mo = (v: any) => v ? (MONTH_LABELS as any)[v] ?? null : null;

  if (frequency === SCHEDULE_FREQUENCY.WEEKLY || frequency === SCHEDULE_FREQUENCY.BIWEEKLY) {
    if (opts?.weeklyConfig) {
      const w = opts.weeklyConfig;
      // Use the full WEEK_DAY_LABELS (which already include "-feira" where
      // applicable, and correctly omit it for Sábado/Domingo).
      const days = [
        w.monday && wd(WEEK_DAY.MONDAY),
        w.tuesday && wd(WEEK_DAY.TUESDAY),
        w.wednesday && wd(WEEK_DAY.WEDNESDAY),
        w.thursday && wd(WEEK_DAY.THURSDAY),
        w.friday && wd(WEEK_DAY.FRIDAY),
        w.saturday && wd(WEEK_DAY.SATURDAY),
        w.sunday && wd(WEEK_DAY.SUNDAY),
      ].filter(Boolean) as string[];
      if (days.length) return days.join(", ");
    }
    if (opts?.dayOfWeek) return wd(opts.dayOfWeek);
    return null;
  }

  const isMonthlyish =
    frequency === SCHEDULE_FREQUENCY.MONTHLY ||
    frequency === SCHEDULE_FREQUENCY.BIMONTHLY ||
    frequency === SCHEDULE_FREQUENCY.QUARTERLY ||
    frequency === SCHEDULE_FREQUENCY.TRIANNUAL ||
    frequency === SCHEDULE_FREQUENCY.QUADRIMESTRAL ||
    frequency === SCHEDULE_FREQUENCY.SEMI_ANNUAL;

  if (isMonthlyish) {
    const mc = opts?.monthlyConfig;
    if (mc?.occurrence && mc?.dayOfWeek) {
      // e.g. "primeira semana, quinta-feira" / "última semana, terça-feira".
      // wd() already yields the full label (incl. "-feira"), so don't append it.
      return `${occ(mc.occurrence)} semana, ${wd(mc.dayOfWeek)}`;
    }
    const dom = mc?.dayOfMonth ?? opts?.dayOfMonth ?? null;
    if (dom != null) return `dia ${dom}`;
    return null;
  }

  if (frequency === SCHEDULE_FREQUENCY.ANNUAL) {
    const yc = opts?.yearlyConfig;
    if (yc?.month && yc?.occurrence && yc?.dayOfWeek) {
      return `${occ(yc.occurrence)} semana, ${wd(yc.dayOfWeek)} de ${mo(yc.month)}`;
    }
    if (yc?.month && yc?.dayOfMonth) return `${yc.dayOfMonth} de ${mo(yc.month)}`;
    if (opts?.month && opts?.dayOfMonth) return `${opts.dayOfMonth} de ${mo(opts.month)}`;
    return null;
  }

  return null;
}

export const PANTS_SIZE_LABELS: Record<PANTS_SIZE, string> = {
  [PANTS_SIZE.SIZE_36]: "36",
  [PANTS_SIZE.SIZE_38]: "38",
  [PANTS_SIZE.SIZE_40]: "40",
  [PANTS_SIZE.SIZE_42]: "42",
  [PANTS_SIZE.SIZE_44]: "44",
  [PANTS_SIZE.SIZE_46]: "46",
  [PANTS_SIZE.SIZE_48]: "48",
  [PANTS_SIZE.SIZE_50]: "50",
};

export const SHIRT_SIZE_LABELS: Record<SHIRT_SIZE, string> = {
  [SHIRT_SIZE.P]: "P",
  [SHIRT_SIZE.M]: "M",
  [SHIRT_SIZE.G]: "G",
  [SHIRT_SIZE.GG]: "GG",
  [SHIRT_SIZE.XG]: "XG",
};

export const BOOT_SIZE_LABELS: Record<BOOT_SIZE, string> = {
  [BOOT_SIZE.SIZE_35]: "35",
  [BOOT_SIZE.SIZE_36]: "36",
  [BOOT_SIZE.SIZE_37]: "37",
  [BOOT_SIZE.SIZE_38]: "38",
  [BOOT_SIZE.SIZE_39]: "39",
  [BOOT_SIZE.SIZE_40]: "40",
  [BOOT_SIZE.SIZE_41]: "41",
  [BOOT_SIZE.SIZE_42]: "42",
  [BOOT_SIZE.SIZE_43]: "43",
  [BOOT_SIZE.SIZE_44]: "44",
  [BOOT_SIZE.SIZE_45]: "45",
  [BOOT_SIZE.SIZE_46]: "46",
  [BOOT_SIZE.SIZE_47]: "47",
  [BOOT_SIZE.SIZE_48]: "48",
};

export const SLEEVES_SIZE_LABELS: Record<SLEEVES_SIZE, string> = {
  [SLEEVES_SIZE.P]: "P",
  [SLEEVES_SIZE.M]: "M",
  [SLEEVES_SIZE.G]: "G",
  [SLEEVES_SIZE.GG]: "GG",
  [SLEEVES_SIZE.XG]: "XG",
};

export const MASK_SIZE_LABELS: Record<MASK_SIZE, string> = {
  [MASK_SIZE.P]: "Pequeno",
  [MASK_SIZE.M]: "Médio",
};

export const GLOVES_SIZE_LABELS: Record<GLOVES_SIZE, string> = {
  [GLOVES_SIZE.P]: "Pequeno",
  [GLOVES_SIZE.M]: "Médio",
  [GLOVES_SIZE.G]: "Grande",
};

export const RAIN_BOOTS_SIZE_LABELS: Record<RAIN_BOOTS_SIZE, string> = {
  [RAIN_BOOTS_SIZE.SIZE_35]: "35",
  [RAIN_BOOTS_SIZE.SIZE_36]: "36",
  [RAIN_BOOTS_SIZE.SIZE_37]: "37",
  [RAIN_BOOTS_SIZE.SIZE_38]: "38",
  [RAIN_BOOTS_SIZE.SIZE_39]: "39",
  [RAIN_BOOTS_SIZE.SIZE_40]: "40",
  [RAIN_BOOTS_SIZE.SIZE_41]: "41",
  [RAIN_BOOTS_SIZE.SIZE_42]: "42",
  [RAIN_BOOTS_SIZE.SIZE_43]: "43",
  [RAIN_BOOTS_SIZE.SIZE_44]: "44",
  [RAIN_BOOTS_SIZE.SIZE_45]: "45",
  [RAIN_BOOTS_SIZE.SIZE_46]: "46",
  [RAIN_BOOTS_SIZE.SIZE_47]: "47",
  [RAIN_BOOTS_SIZE.SIZE_48]: "48",
};

export const PPE_TYPE_LABELS: Record<PPE_TYPE, string> = {
  [PPE_TYPE.SHIRT]: "Camisa",
  [PPE_TYPE.PANTS]: "Calça",
  [PPE_TYPE.SHORT]: "Bermuda",
  [PPE_TYPE.BOOTS]: "Botas",
  [PPE_TYPE.SLEEVES]: "Manguito",
  [PPE_TYPE.MASK]: "Máscara",
  [PPE_TYPE.GLOVES]: "Luvas",
  [PPE_TYPE.RAIN_BOOTS]: "Galocha",
  [PPE_TYPE.OVERALL]: "Macacão",
  [PPE_TYPE.OTHERS]: "Outros",
};

export const PPE_SIZE_TYPE_LABELS: Record<PPE_SIZE_TYPE, string> = {
  [PPE_SIZE_TYPE.SHIRT]: "Camisa",
  [PPE_SIZE_TYPE.PANTS]: "Calça",
  [PPE_SIZE_TYPE.BOOT]: "Bota",
  [PPE_SIZE_TYPE.GLOVE]: "Luva",
  [PPE_SIZE_TYPE.MASK]: "Máscara",
  [PPE_SIZE_TYPE.OVERALL]: "Macacão",
  [PPE_SIZE_TYPE.HELMET]: "Capacete",
  [PPE_SIZE_TYPE.UNIFORM]: "Uniforme",
};

export const PPE_SIZE_LABELS: Record<PPE_SIZE, string> = {
  // Shirt, Sleeves, and Mask sizes
  [PPE_SIZE.P]: "P",
  [PPE_SIZE.M]: "M",
  [PPE_SIZE.G]: "G",
  [PPE_SIZE.GG]: "GG",
  [PPE_SIZE.XG]: "XG",

  // Pants and Boots sizes (all sizes from 35 to 48)
  [PPE_SIZE.SIZE_35]: "35",
  [PPE_SIZE.SIZE_36]: "36",
  [PPE_SIZE.SIZE_37]: "37",
  [PPE_SIZE.SIZE_38]: "38",
  [PPE_SIZE.SIZE_39]: "39",
  [PPE_SIZE.SIZE_40]: "40",
  [PPE_SIZE.SIZE_41]: "41",
  [PPE_SIZE.SIZE_42]: "42",
  [PPE_SIZE.SIZE_43]: "43",
  [PPE_SIZE.SIZE_44]: "44",
  [PPE_SIZE.SIZE_45]: "45",
  [PPE_SIZE.SIZE_46]: "46",
  [PPE_SIZE.SIZE_47]: "47",
  [PPE_SIZE.SIZE_48]: "48",
  [PPE_SIZE.SIZE_50]: "50",
};

export const PPE_DELIVERY_MODE_LABELS: Record<PPE_DELIVERY_MODE, string> = {
  [PPE_DELIVERY_MODE.SCHEDULED]: "Programada",
  [PPE_DELIVERY_MODE.ON_DEMAND]: "Sob Demanda",
  [PPE_DELIVERY_MODE.BOTH]: "Ambas",
};

export const ACTIVITY_OPERATION_LABELS: Record<ACTIVITY_OPERATION, string> = {
  [ACTIVITY_OPERATION.INBOUND]: "Entrada",
  [ACTIVITY_OPERATION.OUTBOUND]: "Saída",
};

export const AUDIT_ACTION_LABELS: Record<AUDIT_ACTION, string> = {
  [AUDIT_ACTION.CREATE]: "Criar",
  [AUDIT_ACTION.UPDATE]: "Atualizar",
  [AUDIT_ACTION.DELETE]: "Excluir",
};

export const ENTITY_TYPE_LABELS: Record<ENTITY_TYPE, string> = {
  [ENTITY_TYPE.ACTIVITY]: "Atividade",
  [ENTITY_TYPE.AIRBRUSHING]: "Aerografia",
  [ENTITY_TYPE.BONUS]: "Bônus",
  [ENTITY_TYPE.BORROW]: "Empréstimo",
  [ENTITY_TYPE.CATEGORY]: "Categoria",
  [ENTITY_TYPE.COLLECTION]: "Coleção",
  [ENTITY_TYPE.BONIFICATION]: "Bonificação",
  [ENTITY_TYPE.CUT]: "Corte",
  [ENTITY_TYPE.CUT_ITEM]: "Item de Corte",
  [ENTITY_TYPE.CUT_PLAN]: "Plano de Corte",
  [ENTITY_TYPE.CUT_REQUEST]: "Solicitação de Corte",
  [ENTITY_TYPE.CUSTOMER]: "Cliente",
  [ENTITY_TYPE.DASHBOARD]: "Dashboard",
  [ENTITY_TYPE.DEPLOYMENT]: "Implantação",
  [ENTITY_TYPE.DELIVERY]: "Entrega",
  [ENTITY_TYPE.DISCOUNT]: "Desconto",
  [ENTITY_TYPE.PPE_CONFIG]: "Configuração de EPI",
  [ENTITY_TYPE.PPE_DELIVERY]: "Entrega de EPI",
  [ENTITY_TYPE.PPE_REQUEST]: "Solicitação de EPI",
  [ENTITY_TYPE.PPE_DELIVERY_SCHEDULE]: "Agendamento de EPI",
  [ENTITY_TYPE.PPE_SIZE]: "Tamanho de EPI",
  [ENTITY_TYPE.EXTERNAL_OPERATION]: "Operação Externa",
  [ENTITY_TYPE.EXTERNAL_OPERATION_ITEM]: "Item de Operação Externa",
  [ENTITY_TYPE.FILE]: "Arquivo",
  [ENTITY_TYPE.HOLIDAY]: "Feriado",
  [ENTITY_TYPE.ITEM]: "Item",
  [ENTITY_TYPE.ITEM_BRAND]: "Marca do Item",
  [ENTITY_TYPE.ITEM_CATEGORY]: "Categoria do Item",
  [ENTITY_TYPE.IMPLEMENT_MEASURE]: "Medidas do Implemento",
  [ENTITY_TYPE.MAINTENANCE]: "Manutenção",
  [ENTITY_TYPE.MAINTENANCE_ITEM]: "Item de Manutenção",
  [ENTITY_TYPE.MAINTENANCE_SCHEDULE]: "Agendamento de Manutenção",
  [ENTITY_TYPE.MEASURE]: "Medida",
  [ENTITY_TYPE.NOTIFICATION]: "Notificação",
  [ENTITY_TYPE.NOTIFICATION_PREFERENCE]: "Preferência de Notificação",
  [ENTITY_TYPE.OBSERVATION]: "Observação",
  [ENTITY_TYPE.ORDER]: "Pedido",
  [ENTITY_TYPE.ORDER_ITEM]: "Item do Pedido",
  [ENTITY_TYPE.ORDER_RULE]: "Regra de Pedido",
  [ENTITY_TYPE.ORDER_SCHEDULE]: "Agendamento de Pedido",
  [ENTITY_TYPE.PAINT]: "Tinta",
  [ENTITY_TYPE.PAINT_BRAND]: "Marca de Tinta",
  [ENTITY_TYPE.PAINT_TYPE]: "Tipo de Tinta",
  [ENTITY_TYPE.PAINT_GROUND]: "Fundo de Tinta",
  [ENTITY_TYPE.PAINT_FORMULA]: "Fórmula de Tinta",
  [ENTITY_TYPE.PAINT_FORMULA_COMPONENT]: "Componente de Fórmula",
  [ENTITY_TYPE.PAINT_PRODUCTION]: "Produção de Tinta",
  [ENTITY_TYPE.PARKING_SPOT]: "Vaga de Estacionamento",
  [ENTITY_TYPE.PAYROLL]: "Folha de Pagamento",
  [ENTITY_TYPE.PIECE]: "Peça",
  [ENTITY_TYPE.POSITION]: "Cargo",
  [ENTITY_TYPE.POSITION_REMUNERATION]: "Remuneração do Cargo",
  [ENTITY_TYPE.PREFERENCES]: "Preferências",
  [ENTITY_TYPE.PRICE]: "Preço",
  [ENTITY_TYPE.PRODUCTION]: "Produção",
  [ENTITY_TYPE.PURCHASE]: "Compra",
  [ENTITY_TYPE.WARNING]: "Advertência",
  [ENTITY_TYPE.SECTOR]: "Setor",
  [ENTITY_TYPE.SEEN_NOTIFICATION]: "Notificação Vista",
  [ENTITY_TYPE.SERVICE]: "Serviço",
  [ENTITY_TYPE.SERVICE_ORDER]: "Ordem de Serviço",
  [ENTITY_TYPE.SUPPLIER]: "Fornecedor",
  [ENTITY_TYPE.TASK]: "Tarefa",
  [ENTITY_TYPE.TIME_CLOCK_ENTRY]: "Registro de Ponto",
  [ENTITY_TYPE.TRUCK]: "Caminhão",
  [ENTITY_TYPE.USER]: "Usuário",
  [ENTITY_TYPE.VACATION]: "Férias",
  [ENTITY_TYPE.THIRTEENTH]: "Décimo Terceiro",
  [ENTITY_TYPE.VERIFICATION]: "Verificação",
  [ENTITY_TYPE.SALARY_ADJUSTMENT]: "Reajuste Salarial",
  [ENTITY_TYPE.USER_POSITION_HISTORY]: "Histórico de Cargo",
  [ENTITY_TYPE.BENEFIT]: "Benefício",
  [ENTITY_TYPE.USER_BENEFIT]: "Adesão de Benefício",
  [ENTITY_TYPE.ADMISSION]: "Admissão",
  [ENTITY_TYPE.TERMINATION]: "Rescisão",
  [ENTITY_TYPE.MEDICAL_EXAM]: "Exame Médico",
  [ENTITY_TYPE.LEAVE]: "Afastamento",
  [ENTITY_TYPE.DEPENDENT]: "Dependente",
  [ENTITY_TYPE.AGENDA_EVENT]: "Evento de Agenda",
  [ENTITY_TYPE.NOTE]: "Nota",
  [ENTITY_TYPE.FISPQ]: "FISPQ",
  [ENTITY_TYPE.RESPONSIBLE]: "Responsável",
  [ENTITY_TYPE.WAREHOUSE_LOCATION]: "Localização no Almoxarifado",
  [ENTITY_TYPE.TASK_QUOTE]: "Orçamento de Tarefa",
  [ENTITY_TYPE.TASK_QUOTE_ITEM]: "Item de Orçamento",
  [ENTITY_TYPE.TASK_QUOTE_SERVICE]: "Serviço de Orçamento",
  [ENTITY_TYPE.TASK_QUOTE_CUSTOMER_CONFIG]: "Configuração de Orçamento do Cliente",
  [ENTITY_TYPE.VACATION_GROUP]: "Grupo de Férias",
};

export const FILE_ENTITY_TYPE_LABELS: Record<FILE_ENTITY_TYPE, string> = {
  [FILE_ENTITY_TYPE.TASK]: "Tarefa",
  [FILE_ENTITY_TYPE.CUSTOMER_LOGO]: "Logo do Cliente",
  [FILE_ENTITY_TYPE.SUPPLIER_LOGO]: "Logo do Fornecedor",
  [FILE_ENTITY_TYPE.OBSERVATION]: "Observação",
  [FILE_ENTITY_TYPE.WARNING]: "Advertência",
  [FILE_ENTITY_TYPE.ORDER_BUDGET]: "Orçamento do Pedido",
  [FILE_ENTITY_TYPE.ORDER_NFE]: "NFe do Pedido",
  [FILE_ENTITY_TYPE.ORDER_RECEIPT]: "Recibo do Pedido",
  [FILE_ENTITY_TYPE.TASK_BUDGET]: "Orçamento da Tarefa",
  [FILE_ENTITY_TYPE.TASK_NFE]: "NFe da Tarefa",
  [FILE_ENTITY_TYPE.TASK_RECEIPT]: "Recibo da Tarefa",
  [FILE_ENTITY_TYPE.AIRBRUSHING_RECEIPT]: "Recibo de Aerografia",
  [FILE_ENTITY_TYPE.AIRBRUSHING_NFE]: "NFe de Aerografia",
  [FILE_ENTITY_TYPE.EXTERNAL_OPERATION_BUDGET]: "Orçamento de Operação Externa",
  [FILE_ENTITY_TYPE.EXTERNAL_OPERATION_NFE]: "NFe de Operação Externa",
  [FILE_ENTITY_TYPE.EXTERNAL_OPERATION_RECEIPT]: "Recibo de Operação Externa",
  [FILE_ENTITY_TYPE.EXPENSE]: "Despesa",
};

export const DELIVERY_MODE_LABELS: Record<PPE_DELIVERY_MODE, string> = {
  [PPE_DELIVERY_MODE.SCHEDULED]: "Programada",
  [PPE_DELIVERY_MODE.ON_DEMAND]: "Sob Demanda",
  [PPE_DELIVERY_MODE.BOTH]: "Ambos",
};

export const ORDER_TRIGGER_TYPE_LABELS: Record<ORDER_TRIGGER_TYPE, string> = {
  [ORDER_TRIGGER_TYPE.STOCK_LEVEL]: "Nível de Estoque",
  [ORDER_TRIGGER_TYPE.CONSUMPTION_RATE]: "Taxa de Consumo",
  [ORDER_TRIGGER_TYPE.SCHEDULED]: "Programado",
};

export const ACTIVITY_REASON_LABELS: Record<ACTIVITY_REASON, string> = {
  [ACTIVITY_REASON.ORDER_RECEIVED]: "Pedido Recebido",
  [ACTIVITY_REASON.PRODUCTION_USAGE]: "Uso em Produção",
  [ACTIVITY_REASON.PPE_DELIVERY]: "Entrega de EPI",
  [ACTIVITY_REASON.RETURN]: "Devolução",
  [ACTIVITY_REASON.EXTERNAL_OPERATION]: "Operação Externa",
  [ACTIVITY_REASON.INVENTORY_COUNT]: "Contagem de Inventário",
  [ACTIVITY_REASON.MANUAL_ADJUSTMENT]: "Ajuste Manual",
  [ACTIVITY_REASON.MAINTENANCE]: "Manutenção",
  [ACTIVITY_REASON.DAMAGE]: "Dano",
  [ACTIVITY_REASON.LOSS]: "Perda",
  [ACTIVITY_REASON.PAINT_PRODUCTION]: "Produção de Tinta",
  [ACTIVITY_REASON.EXTERNAL_OPERATION_RETURN]: "Retorno de Operação Externa",
  [ACTIVITY_REASON.OTHER]: "Outro",
};

export const WORKLOAD_LEVEL_LABELS: Record<WORKLOAD_LEVEL, string> = {
  [WORKLOAD_LEVEL.LOW]: "Baixo",
  [WORKLOAD_LEVEL.NORMAL]: "Normal",
  [WORKLOAD_LEVEL.HIGH]: "Alto",
  [WORKLOAD_LEVEL.CRITICAL]: "Crítico",
};

export const FILE_FORMAT_LABELS: Record<FILE_FORMAT, string> = {
  [FILE_FORMAT.JSON]: "JSON",
  [FILE_FORMAT.YAML]: "YAML",
  [FILE_FORMAT.CSV]: "CSV",
  [FILE_FORMAT.EXCEL]: "Excel",
  [FILE_FORMAT.PDF]: "PDF",
};

export const ACTIVITY_LEVEL_LABELS: Record<ACTIVITY_LEVEL, string> = {
  [ACTIVITY_LEVEL.VERY_ACTIVE]: "Muito Ativo",
  [ACTIVITY_LEVEL.ACTIVE]: "Ativo",
  [ACTIVITY_LEVEL.OCCASIONAL]: "Ocasional",
  [ACTIVITY_LEVEL.DORMANT]: "Inativo",
  [ACTIVITY_LEVEL.LOST]: "Lost",
};

export const CHANGE_ACTION_LABELS: Record<CHANGE_ACTION, string> = {
  [CHANGE_ACTION.CREATE]: "Criado",
  [CHANGE_ACTION.UPDATE]: "Atualizado",
  [CHANGE_ACTION.DELETE]: "Excluído",
  [CHANGE_ACTION.RESTORE]: "Restaurado",
  [CHANGE_ACTION.ROLLBACK]: "Revertido",
  [CHANGE_ACTION.ARCHIVE]: "Arquivado",
  [CHANGE_ACTION.UNARCHIVE]: "Desarquivado",
  [CHANGE_ACTION.ACTIVATE]: "Ativado",
  [CHANGE_ACTION.DEACTIVATE]: "Desativado",
  [CHANGE_ACTION.APPROVE]: "Aprovado",
  [CHANGE_ACTION.REJECT]: "Rejeitado",
  [CHANGE_ACTION.CANCEL]: "Cancelado",
  [CHANGE_ACTION.COMPLETE]: "Concluído",
  [CHANGE_ACTION.RESCHEDULE]: "Reagendado",
  [CHANGE_ACTION.BATCH_CREATE]: "Criado em Lote",
  [CHANGE_ACTION.BATCH_UPDATE]: "Atualizado em Lote",
  [CHANGE_ACTION.BATCH_DELETE]: "Excluído em Lote",
  [CHANGE_ACTION.VIEW]: "Visualizado",
};

export const CHANGE_TRIGGERED_BY_LABELS: Record<CHANGE_TRIGGERED_BY, string> = {
  [CHANGE_TRIGGERED_BY.TASK_CREATE]: "Criação de Tarefa",
  [CHANGE_TRIGGERED_BY.TASK_UPDATE]: "Atualização de Tarefa",
  [CHANGE_TRIGGERED_BY.TASK_COPY_FROM_TASK]: "Copiado de Outra Tarefa",
  [CHANGE_TRIGGERED_BY.ITEM_UPDATE]: "Atualização de Item",
  [CHANGE_TRIGGERED_BY.USER_ACTION]: "Ação do Usuário",
  [CHANGE_TRIGGERED_BY.BATCH_CREATE]: "Criação em Lote",
  [CHANGE_TRIGGERED_BY.BATCH_UPDATE]: "Atualização em Lote",
  [CHANGE_TRIGGERED_BY.BATCH_DELETE]: "Exclusão em Lote",
  [CHANGE_TRIGGERED_BY.BATCH_OPERATION]: "Operação em Lote",
  [CHANGE_TRIGGERED_BY.SYSTEM]: "Sistema",
  [CHANGE_TRIGGERED_BY.SYSTEM_GENERATED]: "Gerado pelo Sistema",
  [CHANGE_TRIGGERED_BY.USER]: "Usuário",
  [CHANGE_TRIGGERED_BY.EXTERNAL_OPERATION]: "Operação Externa",
  [CHANGE_TRIGGERED_BY.EXTERNAL_OPERATION_DELETE]: "Exclusão de Operação Externa",
  [CHANGE_TRIGGERED_BY.EXTERNAL_OPERATION_RETURN]: "Retorno de Operação Externa",
  [CHANGE_TRIGGERED_BY.EXTERNAL_OPERATION_SYNC]: "Sincronização de Operação Externa",
  [CHANGE_TRIGGERED_BY.EXTERNAL_OPERATION_ITEM]: "Item de Operação Externa",
  [CHANGE_TRIGGERED_BY.EXTERNAL_OPERATION_ITEM_UPDATE]: "Atualização de Item de Operação Externa",
  [CHANGE_TRIGGERED_BY.EXTERNAL_OPERATION_ITEM_DELETE]: "Exclusão de Item de Operação Externa",
  [CHANGE_TRIGGERED_BY.PAINT_FORMULA_COMPONENT_CREATE]: "Criação de Componente de Fórmula",
  [CHANGE_TRIGGERED_BY.PAINT_FORMULA_COMPONENT_UPDATE]: "Atualização de Componente de Fórmula",
  [CHANGE_TRIGGERED_BY.PAINT_FORMULA_COMPONENT_DELETE]: "Exclusão de Componente de Fórmula",
  [CHANGE_TRIGGERED_BY.PAINT_FORMULA_COMPONENT_BATCH_CREATE]: "Criação em Lote de Componente de Fórmula",
  [CHANGE_TRIGGERED_BY.PAINT_FORMULA_COMPONENT_BATCH_UPDATE]: "Atualização em Lote de Componente de Fórmula",
  [CHANGE_TRIGGERED_BY.PAINT_FORMULA_COMPONENT_BATCH_DELETE]: "Exclusão em Lote de Componente de Fórmula",
  [CHANGE_TRIGGERED_BY.PAINT_PRODUCTION_CREATE]: "Criação de Produção de Tinta",
  [CHANGE_TRIGGERED_BY.PAINT_PRODUCTION_UPDATE]: "Atualização de Produção de Tinta",
  [CHANGE_TRIGGERED_BY.PAINT_PRODUCTION_DELETE]: "Exclusão de Produção de Tinta",
  [CHANGE_TRIGGERED_BY.PAINT_PRODUCTION_BATCH_CREATE]: "Criação de Produção de Tinta em Lote",
  [CHANGE_TRIGGERED_BY.PAINT_PRODUCTION_BATCH_UPDATE]: "Atualização de Produção de Tinta em Lote",
  [CHANGE_TRIGGERED_BY.PAINT_PRODUCTION_BATCH_DELETE]: "Exclusão de Produção de Tinta em Lote",
  [CHANGE_TRIGGERED_BY.PAINT_CREATE]: "Criação de Tinta",
  [CHANGE_TRIGGERED_BY.PAINT_UPDATE]: "Atualização de Tinta",
  [CHANGE_TRIGGERED_BY.PAINT_DELETE]: "Exclusão de Tinta",
  [CHANGE_TRIGGERED_BY.PAINT_BATCH_CREATE]: "Criação em Lote de Tinta",
  [CHANGE_TRIGGERED_BY.PAINT_BATCH_UPDATE]: "Atualização em Lote de Tinta",
  [CHANGE_TRIGGERED_BY.PAINT_BATCH_DELETE]: "Exclusão em Lote de Tinta",
  [CHANGE_TRIGGERED_BY.PAINT_FORMULA_CREATE]: "Criação de Fórmula de Tinta",
  [CHANGE_TRIGGERED_BY.PAINT_FORMULA_UPDATE]: "Atualização de Fórmula de Tinta",
  [CHANGE_TRIGGERED_BY.PAINT_FORMULA_DELETE]: "Exclusão de Fórmula de Tinta",
  [CHANGE_TRIGGERED_BY.PAINT_FORMULA_BATCH_CREATE]: "Criação em Lote de Fórmula de Tinta",
  [CHANGE_TRIGGERED_BY.PAINT_FORMULA_BATCH_UPDATE]: "Atualização em Lote de Fórmula de Tinta",
  [CHANGE_TRIGGERED_BY.PAINT_FORMULA_BATCH_DELETE]: "Exclusão em Lote de Fórmula de Tinta",
  [CHANGE_TRIGGERED_BY.ORDER_UPDATE]: "Atualização de Pedido",
  [CHANGE_TRIGGERED_BY.ORDER_CREATE]: "Criação de Pedido",
  [CHANGE_TRIGGERED_BY.ORDER_STATUS_CHANGE]: "Alteração de Status do Pedido",
  [CHANGE_TRIGGERED_BY.ORDER_CANCEL]: "Cancelamento de Pedido",
  [CHANGE_TRIGGERED_BY.ORDER_ITEM_UPDATE]: "Atualização de Item do Pedido",
  [CHANGE_TRIGGERED_BY.ORDER_ITEM_RECEIVED]: "Recebimento de Item do Pedido",
  [CHANGE_TRIGGERED_BY.ORDER_ITEM_SYNC]: "Sincronização de Item do Pedido",
  [CHANGE_TRIGGERED_BY.SCHEDULE]: "Agendamento",
  [CHANGE_TRIGGERED_BY.ACTIVITY_CREATE]: "Criação de Atividade",
  [CHANGE_TRIGGERED_BY.ACTIVITY_UPDATE]: "Atualização de Atividade",
  [CHANGE_TRIGGERED_BY.ACTIVITY_DELETE]: "Exclusão de Atividade",
  [CHANGE_TRIGGERED_BY.PPE_DELIVERY]: "Entrega de EPI",
  [CHANGE_TRIGGERED_BY.ACTIVITY_SYNC]: "Sincronização de Atividade",
  [CHANGE_TRIGGERED_BY.INVENTORY_ADJUSTMENT]: "Ajuste de Inventário",
  [CHANGE_TRIGGERED_BY.INVENTORY_COUNT]: "Contagem de Inventário",
  [CHANGE_TRIGGERED_BY.ITEM_MONTHLY_CONSUMPTION_UPDATE]: "Atualização de Consumo Mensal do Item",
  [CHANGE_TRIGGERED_BY.AUTOMATIC_MIN_MAX_UPDATE]: "Atualização Automática de Mín/Máx",
  [CHANGE_TRIGGERED_BY.PAINT_TYPE_CREATE]: "Criação de tipo de tinta",
  [CHANGE_TRIGGERED_BY.PAINT_TYPE_UPDATE]: "Atualização de tipo de tinta",
  [CHANGE_TRIGGERED_BY.PAINT_TYPE_DELETE]: "Remoção de tipo de tinta",
  [CHANGE_TRIGGERED_BY.PAINT_TYPE_BATCH_CREATE]: "Criação em Lote de Tipo de Tinta",
  [CHANGE_TRIGGERED_BY.PAINT_TYPE_BATCH_UPDATE]: "Atualização em Lote de Tipo de Tinta",
  [CHANGE_TRIGGERED_BY.PAINT_TYPE_BATCH_DELETE]: "Exclusão em Lote de Tipo de Tinta",
  [CHANGE_TRIGGERED_BY.PAINT_BRAND_CREATE]: "Criação de marca de tinta",
  [CHANGE_TRIGGERED_BY.PAINT_BRAND_UPDATE]: "Atualização de marca de tinta",
  [CHANGE_TRIGGERED_BY.PAINT_BRAND_DELETE]: "Remoção de marca de tinta",
  [CHANGE_TRIGGERED_BY.PAINT_BRAND_BATCH_CREATE]: "Criação em Lote de Marca de Tinta",
  [CHANGE_TRIGGERED_BY.PAINT_BRAND_BATCH_UPDATE]: "Atualização em Lote de Marca de Tinta",
  [CHANGE_TRIGGERED_BY.PAINT_BRAND_BATCH_DELETE]: "Exclusão em Lote de Marca de Tinta",
  [CHANGE_TRIGGERED_BY.PAINT_GROUND_CREATE]: "Criação de Base de Tinta",
  [CHANGE_TRIGGERED_BY.PAINT_GROUND_UPDATE]: "Atualização de Base de Tinta",
  [CHANGE_TRIGGERED_BY.PAINT_GROUND_DELETE]: "Exclusão de Base de Tinta",
  [CHANGE_TRIGGERED_BY.PAINT_GROUND_BATCH_CREATE]: "Criação em Lote de Base de Tinta",
  [CHANGE_TRIGGERED_BY.PAINT_GROUND_BATCH_UPDATE]: "Atualização em Lote de Base de Tinta",
  [CHANGE_TRIGGERED_BY.PAINT_GROUND_BATCH_DELETE]: "Exclusão em Lote de Base de Tinta",
  [CHANGE_TRIGGERED_BY.SMS_VERIFICATION_CREATE]: "Criação de Verificação SMS",
  [CHANGE_TRIGGERED_BY.SMS_VERIFICATION_SEND]: "Envio de Verificação SMS",
  [CHANGE_TRIGGERED_BY.SMS_VERIFICATION_VERIFY]: "Verificação SMS",
  [CHANGE_TRIGGERED_BY.SMS_VERIFICATION_EXPIRE]: "Expiração de Verificação SMS",
  [CHANGE_TRIGGERED_BY.SMS_VERIFICATION_CANCEL]: "Cancelamento de Verificação SMS",
  [CHANGE_TRIGGERED_BY.EMAIL_SERVICE]: "Serviço de Email",
  [CHANGE_TRIGGERED_BY.VERIFICATION_CREATE]: "Criação de Verificação",
  [CHANGE_TRIGGERED_BY.VERIFICATION_SEND]: "Envio de Verificação",
  [CHANGE_TRIGGERED_BY.VERIFICATION_VERIFY]: "Verificação Concluída",
  [CHANGE_TRIGGERED_BY.VERIFICATION_EXPIRE]: "Expiração de Verificação",
  [CHANGE_TRIGGERED_BY.VERIFICATION_CANCEL]: "Cancelamento de Verificação",
  [CHANGE_TRIGGERED_BY.VERIFICATION_RESEND]: "Reenvio de Verificação",
  [CHANGE_TRIGGERED_BY.VEHICLE_MOVEMENT]: "Movimentação de veículo",
  [CHANGE_TRIGGERED_BY.PARKING_ASSIGNMENT]: "Atribuição de estacionamento",
  [CHANGE_TRIGGERED_BY.OBSERVATION_CREATE]: "Criação de observação",
  [CHANGE_TRIGGERED_BY.OBSERVATION_DELETE]: "Exclusão de observação",
  [CHANGE_TRIGGERED_BY.SCHEDULED_JOB]: "Tarefa Agendada",
  [CHANGE_TRIGGERED_BY.API]: "API",
  [CHANGE_TRIGGERED_BY.WEBHOOK]: "Webhook",
  [CHANGE_TRIGGERED_BY.ADMIN]: "Administrador",
};

export const EVENT_TYPE_LABELS: Record<EVENT_TYPE, string> = {
  [EVENT_TYPE.CREATED]: "Criado",
  [EVENT_TYPE.STARTED]: "Iniciado",
  [EVENT_TYPE.PAUSED]: "Pausado",
  [EVENT_TYPE.RESUMED]: "Retomado",
  [EVENT_TYPE.COMPLETED]: "Concluído",
  [EVENT_TYPE.CANCELLED]: "Cancelado",
};

export const TIMELINE_EVENT_TYPE_LABELS: Record<TIMELINE_EVENT_TYPE, string> = {
  [TIMELINE_EVENT_TYPE.CREATED]: "Criado",
  [TIMELINE_EVENT_TYPE.UPDATED]: "Atualizado",
  [TIMELINE_EVENT_TYPE.STATUS_CHANGED]: "Status Alterado",
  [TIMELINE_EVENT_TYPE.FILE_ADDED]: "Arquivo Adicionado",
  [TIMELINE_EVENT_TYPE.FILE_REMOVED]: "Arquivo Removido",
  [TIMELINE_EVENT_TYPE.NOTE_ADDED]: "Nota Adicionada",
  [TIMELINE_EVENT_TYPE.ASSIGNED]: "Atribuído",
  [TIMELINE_EVENT_TYPE.COMPLETED]: "Concluído",
};

export const MERGE_STRATEGY_LABELS: Record<MERGE_STRATEGY, string> = {
  [MERGE_STRATEGY.KEEP_PRIMARY]: "Manter Principal",
  [MERGE_STRATEGY.KEEP_NEWEST]: "Manter Mais Recente",
  [MERGE_STRATEGY.MANUAL]: "Manual",
};

export const GROUP_BY_LABELS: Record<GROUP_BY, string> = {
  [GROUP_BY.DAY]: "Dia",
  [GROUP_BY.WEEK]: "Semana",
  [GROUP_BY.MONTH]: "Mês",
  [GROUP_BY.YEAR]: "Ano",
  [GROUP_BY.ITEM]: "Item",
  [GROUP_BY.USER]: "Usuário",
};

export const ALERT_TYPE_LABELS: Record<ALERT_TYPE, string> = {
  // Activity Alerts
  [ALERT_TYPE.HIGH_SPENDING]: "Alto Gasto",
  [ALERT_TYPE.UNUSUAL_PATTERN]: "Padrão Incomum",
  [ALERT_TYPE.DISCREPANCY]: "Discrepância",
  [ALERT_TYPE.LOW_STOCK]: "Estoque Baixo",

  // Item Alerts
  [ALERT_TYPE.STOCK_OUT]: "Sem Estoque",
  [ALERT_TYPE.OVERSTOCK]: "Excesso de Estoque",
  [ALERT_TYPE.SLOW_MOVING]: "Movimento Lento",
  [ALERT_TYPE.REORDER_NEEDED]: "Reposição Necessária",

  // User Alerts
  [ALERT_TYPE.HIGH_TURNOVER]: "Alta Rotatividade",
  [ALERT_TYPE.ATTENDANCE_ISSUE]: "Problema de Assiduidade",

  // Order Alerts
  [ALERT_TYPE.DELIVERY_DELAY]: "Atraso na Entrega",

  // Customer Alerts
  [ALERT_TYPE.SERVICE_ISSUE]: "Problema de Serviço",
  [ALERT_TYPE.PAYMENT_DELAY]: "Atraso no Pagamento",

  // Task Alerts
  [ALERT_TYPE.OVERDUE]: "Atrasado",
  [ALERT_TYPE.CUSTOMER_COMPLAINT]: "Reclamação do Cliente",

  // Borrow Alerts
  [ALERT_TYPE.HIGH_DEMAND]: "Alta Demanda",
  [ALERT_TYPE.USER_VIOLATION]: "Violação do Usuário",

  // Warning Alerts
  [ALERT_TYPE.REPEAT_OFFENDER]: "Reincidente",
  [ALERT_TYPE.ESCALATION_NEEDED]: "Escalonamento Necessário",
  [ALERT_TYPE.PATTERN_DETECTED]: "Padrão Detectado",

  // PPE Alerts
  [ALERT_TYPE.STOCK_SHORTAGE]: "Falta de Estoque",
  [ALERT_TYPE.MISSING_DELIVERY]: "Entrega Faltante",

  // Supplier Alerts
  [ALERT_TYPE.DELIVERY_DELAYS]: "Atrasos na Entrega",
};

export const TASK_OBSERVATION_TYPE_LABELS: Record<TASK_OBSERVATION_TYPE, string> = {
  [TASK_OBSERVATION_TYPE.DAMAGE]: "Dano Causado",
  [TASK_OBSERVATION_TYPE.OVERDUE]: "Atrasado",
  [TASK_OBSERVATION_TYPE.QUALITY]: "Qualidade",
};

export const ITEM_ISSUE_TYPE_LABELS: Record<ITEM_ISSUE_TYPE, string> = {
  [ITEM_ISSUE_TYPE.OVERAGE]: "Excesso",
  [ITEM_ISSUE_TYPE.SHORTAGE]: "Falta",
  [ITEM_ISSUE_TYPE.DAMAGE]: "Dano",
  [ITEM_ISSUE_TYPE.MISMATCH]: "Divergência",
};

export const ITEM_CATEGORY_TYPE_LABELS: Record<ITEM_CATEGORY_TYPE, string> = {
  [ITEM_CATEGORY_TYPE.REGULAR]: "Regular",
  [ITEM_CATEGORY_TYPE.TOOL]: "Ferramenta",
  [ITEM_CATEGORY_TYPE.PPE]: "EPI",
};

export const STOCK_MODEL_LABELS: Record<STOCK_MODEL, string> = {
  [STOCK_MODEL.CONSUMPTION]: "Consumo",
  [STOCK_MODEL.FIXED_TARGET]: "Alvo fixo",
};

export const WAREHOUSE_LOCATION_TYPE_LABELS: Record<WAREHOUSE_LOCATION_TYPE, string> = {
  [WAREHOUSE_LOCATION_TYPE.ESTANTE]: "Estante",
  [WAREHOUSE_LOCATION_TYPE.ESTANTE_DUPLA]: "Estante Dupla",
  [WAREHOUSE_LOCATION_TYPE.ESTANTE_KANBAN]: "Estante com Kanban",
  [WAREHOUSE_LOCATION_TYPE.PAINEL]: "Painel",
  [WAREHOUSE_LOCATION_TYPE.PALETE]: "Palete",
};

export const ITEM_CATEGORY_LEVEL_LABELS: Record<ITEM_CATEGORY_LEVEL, string> = {
  [ITEM_CATEGORY_LEVEL.CATEGORY]: "Categoria",
  [ITEM_CATEGORY_LEVEL.SUBCATEGORY]: "Subcategoria",
};

// pt-BR labels for the accounting (DRE) classification.
export const ACCOUNTING_TYPE_LABELS: Record<ACCOUNTING_TYPE, string> = {
  [ACCOUNTING_TYPE.SALARIOS]: "Salários",
  [ACCOUNTING_TYPE.DESPESAS_FIXAS]: "Despesas Fixas",
  [ACCOUNTING_TYPE.PRODUTIVO]: "Produtivo",
  [ACCOUNTING_TYPE.IMPOSTO_TARIFAS]: "Imposto / Tarifas",
  [ACCOUNTING_TYPE.MATERIA_PRIMA]: "Matéria-Prima",
  [ACCOUNTING_TYPE.INVESTIMENTO]: "Investimento",
  [ACCOUNTING_TYPE.MANUTENCAO]: "Manutenção",
  [ACCOUNTING_TYPE.PRESTACAO_SERVICO]: "Prestação de Serviço",
  [ACCOUNTING_TYPE.COZINHA_ALIMENTACAO]: "Cozinha / Alimentação",
  [ACCOUNTING_TYPE.EPI]: "EPI",
  [ACCOUNTING_TYPE.ESCRITORIO]: "Escritório",
  [ACCOUNTING_TYPE.APLICACAO_FINANCEIRA]: "Aplicação Financeira",
  [ACCOUNTING_TYPE.ESTORNO]: "Estorno",
  [ACCOUNTING_TYPE.LUCRO_DISTRIBUIDO]: "Lucro Distribuído",
  [ACCOUNTING_TYPE.RECEITA_SERVICOS]: "Receita de Serviços",
  [ACCOUNTING_TYPE.EXTRAORDINARIO]: "Extraordinário",
};

// Canonical display order for the accounting (DRE) classification.
export const ACCOUNTING_TYPE_ORDER: ACCOUNTING_TYPE[] = [
  ACCOUNTING_TYPE.RECEITA_SERVICOS,
  ACCOUNTING_TYPE.SALARIOS,
  ACCOUNTING_TYPE.DESPESAS_FIXAS,
  ACCOUNTING_TYPE.PRODUTIVO,
  ACCOUNTING_TYPE.IMPOSTO_TARIFAS,
  ACCOUNTING_TYPE.MATERIA_PRIMA,
  ACCOUNTING_TYPE.INVESTIMENTO,
  ACCOUNTING_TYPE.MANUTENCAO,
  ACCOUNTING_TYPE.PRESTACAO_SERVICO,
  ACCOUNTING_TYPE.COZINHA_ALIMENTACAO,
  ACCOUNTING_TYPE.EPI,
  ACCOUNTING_TYPE.ESCRITORIO,
  ACCOUNTING_TYPE.APLICACAO_FINANCEIRA,
  ACCOUNTING_TYPE.ESTORNO,
  ACCOUNTING_TYPE.LUCRO_DISTRIBUIDO,
  ACCOUNTING_TYPE.EXTRAORDINARIO,
];

export const TIME_RANGE_LABELS: Record<TIME_RANGE, string> = {
  [TIME_RANGE.LAST_7_DAYS]: "Últimos 7 Dias",
  [TIME_RANGE.LAST_30_DAYS]: "Últimos 30 Dias",
  [TIME_RANGE.LAST_90_DAYS]: "Últimos 90 Dias",
  [TIME_RANGE.LAST_YEAR]: "Último Ano",
  [TIME_RANGE.CUSTOM]: "Personalizado",
};

export const DASHBOARD_TIME_PERIOD_LABELS: Record<DASHBOARD_TIME_PERIOD, string> = {
  [DASHBOARD_TIME_PERIOD.TODAY]: "Hoje",
  [DASHBOARD_TIME_PERIOD.THIS_WEEK]: "Esta Semana",
  [DASHBOARD_TIME_PERIOD.THIS_MONTH]: "Este Mês",
  [DASHBOARD_TIME_PERIOD.THIS_YEAR]: "Este Ano",
  [DASHBOARD_TIME_PERIOD.TOTAL]: "Total",
  [DASHBOARD_TIME_PERIOD.ALL_TIME]: "Todo Período",
};


export const CHANGE_LOG_ENTITY_TYPE_LABELS: Record<CHANGE_LOG_ENTITY_TYPE, string> = {
  [CHANGE_LOG_ENTITY_TYPE.ABSENCE]: "Ausência",
  [CHANGE_LOG_ENTITY_TYPE.ACTIVITY]: "Atividade",
  [CHANGE_LOG_ENTITY_TYPE.AIRBRUSHING]: "Aerografia",
  [CHANGE_LOG_ENTITY_TYPE.BONUS]: "Bônus",
  [CHANGE_LOG_ENTITY_TYPE.BORROW]: "Empréstimo",
  [CHANGE_LOG_ENTITY_TYPE.CALCULATION]: "Cálculo",
  [CHANGE_LOG_ENTITY_TYPE.CALCULATION_DETAIL]: "Detalhe de Cálculo",
  [CHANGE_LOG_ENTITY_TYPE.CALCULATION_DECOMPOSITION]: "Decomposição de Cálculo",
  [CHANGE_LOG_ENTITY_TYPE.CATEGORY]: "Categoria",
  [CHANGE_LOG_ENTITY_TYPE.COLLECTION]: "Coleção",
  [CHANGE_LOG_ENTITY_TYPE.BONIFICATION]: "Bonificação",
  [CHANGE_LOG_ENTITY_TYPE.CUT]: "Corte",
  [CHANGE_LOG_ENTITY_TYPE.CUT_ITEM]: "Item de Corte",
  [CHANGE_LOG_ENTITY_TYPE.CUT_PLAN]: "Plano de Corte",
  [CHANGE_LOG_ENTITY_TYPE.CUT_REQUEST]: "Solicitação de Corte",
  [CHANGE_LOG_ENTITY_TYPE.CUSTOMER]: "Cliente",
  [CHANGE_LOG_ENTITY_TYPE.DEPLOYMENT]: "Implantação",
  [CHANGE_LOG_ENTITY_TYPE.DELIVERY]: "Entrega",
  [CHANGE_LOG_ENTITY_TYPE.DISCOUNT]: "Desconto",
  [CHANGE_LOG_ENTITY_TYPE.ECONOMIC_ACTIVITY]: "Atividade Econômica",
  [CHANGE_LOG_ENTITY_TYPE.EXPENSE]: "Despesa",
  [CHANGE_LOG_ENTITY_TYPE.EXTERNAL_OPERATION]: "Operação Externa",
  [CHANGE_LOG_ENTITY_TYPE.EXTERNAL_OPERATION_ITEM]: "Item de Operação Externa",
  [CHANGE_LOG_ENTITY_TYPE.FILE]: "Arquivo",
  [CHANGE_LOG_ENTITY_TYPE.HOLIDAY]: "Feriado",
  [CHANGE_LOG_ENTITY_TYPE.ITEM]: "Item",
  [CHANGE_LOG_ENTITY_TYPE.ITEM_BRAND]: "Marca de Item",
  [CHANGE_LOG_ENTITY_TYPE.ITEM_CATEGORY]: "Categoria de Item",
  [CHANGE_LOG_ENTITY_TYPE.IMPLEMENT_MEASURE]: "Medidas do Implemento",
  [CHANGE_LOG_ENTITY_TYPE.MAINTENANCE]: "Manutenção",
  [CHANGE_LOG_ENTITY_TYPE.MAINTENANCE_ITEM]: "Item de Manutenção",
  [CHANGE_LOG_ENTITY_TYPE.MAINTENANCE_SCHEDULE]: "Agendamento de Manutenção",
  [CHANGE_LOG_ENTITY_TYPE.NOTIFICATION]: "Notificação",
  [CHANGE_LOG_ENTITY_TYPE.NOTIFICATION_PREFERENCE]: "Preferência de Notificação",
  [CHANGE_LOG_ENTITY_TYPE.OBSERVATION]: "Observação",
  [CHANGE_LOG_ENTITY_TYPE.ORDER]: "Pedido",
  [CHANGE_LOG_ENTITY_TYPE.ORDER_ITEM]: "Item do Pedido",
  [CHANGE_LOG_ENTITY_TYPE.ORDER_RULE]: "Regra de Pedido",
  [CHANGE_LOG_ENTITY_TYPE.ORDER_SCHEDULE]: "Agendamento de Pedido",
  [CHANGE_LOG_ENTITY_TYPE.PAINT]: "Tinta",
  [CHANGE_LOG_ENTITY_TYPE.PAINT_FORMULA]: "Fórmula de Tinta",
  [CHANGE_LOG_ENTITY_TYPE.PAINT_FORMULA_COMPONENT]: "Componente de Fórmula",
  [CHANGE_LOG_ENTITY_TYPE.PAINT_GROUND]: "Base de Tinta",
  [CHANGE_LOG_ENTITY_TYPE.PAINT_PRODUCTION]: "Produção de Pintura",
  [CHANGE_LOG_ENTITY_TYPE.PAINT_TYPE]: "Tipo de Tinta",
  [CHANGE_LOG_ENTITY_TYPE.PARKING_SPOT]: "Vaga de Estacionamento",
  [CHANGE_LOG_ENTITY_TYPE.PAYROLL]: "Folha de Pagamento",
  [CHANGE_LOG_ENTITY_TYPE.PIECE]: "Peça",
  [CHANGE_LOG_ENTITY_TYPE.POSITION]: "Cargo",
  [CHANGE_LOG_ENTITY_TYPE.PPE_CONFIG]: "Configuração de EPI",
  [CHANGE_LOG_ENTITY_TYPE.PPE_DELIVERY]: "Entrega EPI",
  [CHANGE_LOG_ENTITY_TYPE.PPE_DELIVERY_ITEM]: "Item Entrega EPI",
  [CHANGE_LOG_ENTITY_TYPE.PPE_DELIVERY_SCHEDULE]: "Agendamento EPI",
  [CHANGE_LOG_ENTITY_TYPE.PPE_REQUEST]: "Solicitação de EPI",
  [CHANGE_LOG_ENTITY_TYPE.PPE_SIZE]: "Tamanho EPI",
  [CHANGE_LOG_ENTITY_TYPE.PRICE]: "Preço",
  [CHANGE_LOG_ENTITY_TYPE.PRODUCTION]: "Produção",
  [CHANGE_LOG_ENTITY_TYPE.PURCHASE]: "Compra",
  [CHANGE_LOG_ENTITY_TYPE.REPRESENTATIVE]: "Responsável",
  [CHANGE_LOG_ENTITY_TYPE.SECTOR]: "Setor",
  [CHANGE_LOG_ENTITY_TYPE.SEEN_NOTIFICATION]: "Notificação Visualizada",
  [CHANGE_LOG_ENTITY_TYPE.SERVICE]: "Serviço",
  [CHANGE_LOG_ENTITY_TYPE.SERVICE_ORDER]: "Ordem de Serviço",
  [CHANGE_LOG_ENTITY_TYPE.SUPPLIER]: "Fornecedor",
  [CHANGE_LOG_ENTITY_TYPE.TASK]: "Tarefa",
  [CHANGE_LOG_ENTITY_TYPE.TASK_QUOTE]: "Faturamento da Tarefa",
  [CHANGE_LOG_ENTITY_TYPE.TASK_QUOTE_ITEM]: "Item do Faturamento",
  [CHANGE_LOG_ENTITY_TYPE.TIME_CLOCK_ENTRY]: "Registro de Ponto",
  [CHANGE_LOG_ENTITY_TYPE.TRUCK]: "Caminhão",
  [CHANGE_LOG_ENTITY_TYPE.USER]: "Usuário",
  [CHANGE_LOG_ENTITY_TYPE.VACATION]: "Férias",
  [CHANGE_LOG_ENTITY_TYPE.THIRTEENTH]: "Décimo Terceiro",
  [CHANGE_LOG_ENTITY_TYPE.VERIFICATION]: "Verificação",
  [CHANGE_LOG_ENTITY_TYPE.WARNING]: "Advertência",
  [CHANGE_LOG_ENTITY_TYPE.SALARY_ADJUSTMENT]: "Reajuste Salarial",
  [CHANGE_LOG_ENTITY_TYPE.USER_POSITION_HISTORY]: "Histórico de Cargo",
  [CHANGE_LOG_ENTITY_TYPE.BENEFIT]: "Benefício",
  [CHANGE_LOG_ENTITY_TYPE.USER_BENEFIT]: "Adesão de Benefício",
  [CHANGE_LOG_ENTITY_TYPE.ADMISSION]: "Admissão",
  [CHANGE_LOG_ENTITY_TYPE.TERMINATION]: "Rescisão",
  [CHANGE_LOG_ENTITY_TYPE.MEDICAL_EXAM]: "Exame Médico",
  [CHANGE_LOG_ENTITY_TYPE.LEAVE]: "Afastamento",
  [CHANGE_LOG_ENTITY_TYPE.DEPENDENT]: "Dependente",
  [CHANGE_LOG_ENTITY_TYPE.AGENDA_EVENT]: "Evento de Agenda",
  [CHANGE_LOG_ENTITY_TYPE.NOTE]: "Nota",
  [CHANGE_LOG_ENTITY_TYPE.FISPQ]: "FISPQ",
  [CHANGE_LOG_ENTITY_TYPE.PREFERENCES]: "Preferências",
  [CHANGE_LOG_ENTITY_TYPE.RESPONSIBLE]: "Responsável",
  [CHANGE_LOG_ENTITY_TYPE.WAREHOUSE_LOCATION]: "Localização no Almoxarifado",
  [CHANGE_LOG_ENTITY_TYPE.TASK_QUOTE_SERVICE]: "Serviço de Orçamento",
  [CHANGE_LOG_ENTITY_TYPE.TASK_QUOTE_CUSTOMER_CONFIG]: "Configuração de Orçamento do Cliente",
  [CHANGE_LOG_ENTITY_TYPE.VACATION_GROUP]: "Grupo de Férias",
};

export const CHANGE_LOG_ACTION_LABELS: Record<CHANGE_LOG_ACTION, string> = {
  [CHANGE_LOG_ACTION.CREATE]: "Criar",
  [CHANGE_LOG_ACTION.UPDATE]: "Atualizar",
  [CHANGE_LOG_ACTION.DELETE]: "Excluir",
  [CHANGE_LOG_ACTION.RESTORE]: "Restaurar",
  [CHANGE_LOG_ACTION.ROLLBACK]: "Reverter",
  [CHANGE_LOG_ACTION.ARCHIVE]: "Arquivar",
  [CHANGE_LOG_ACTION.UNARCHIVE]: "Desarquivar",
  [CHANGE_LOG_ACTION.ACTIVATE]: "Ativar",
  [CHANGE_LOG_ACTION.DEACTIVATE]: "Desativar",
  [CHANGE_LOG_ACTION.APPROVE]: "Aprovar",
  [CHANGE_LOG_ACTION.REJECT]: "Rejeitar",
  [CHANGE_LOG_ACTION.CANCEL]: "Cancelar",
  [CHANGE_LOG_ACTION.COMPLETE]: "Concluir",
  [CHANGE_LOG_ACTION.RESCHEDULE]: "Reagendar",
  [CHANGE_LOG_ACTION.BATCH_CREATE]: "Criar em Lote",
  [CHANGE_LOG_ACTION.BATCH_UPDATE]: "Atualizar em Lote",
  [CHANGE_LOG_ACTION.BATCH_DELETE]: "Excluir em Lote",
  [CHANGE_LOG_ACTION.VIEW]: "Visualizar",
};

// =====================
// SMS Verification Labels
// =====================

export const SMS_VERIFICATION_STATUS_LABELS: Record<SMS_VERIFICATION_STATUS, string> = {
  [SMS_VERIFICATION_STATUS.PENDING]: "Pending",
  [SMS_VERIFICATION_STATUS.SENT]: "Sent",
  [SMS_VERIFICATION_STATUS.VERIFIED]: "Verificado",
  [SMS_VERIFICATION_STATUS.EXPIRED]: "Expirado",
  [SMS_VERIFICATION_STATUS.FAILED]: "Falhou",
  [SMS_VERIFICATION_STATUS.CANCELLED]: "Cancelado",
  [SMS_VERIFICATION_STATUS.RATE_LIMITED]: "Limitado por Taxa",
  [SMS_VERIFICATION_STATUS.BLOCKED]: "Bloqueado",
};

export const SMS_VERIFICATION_TYPE_LABELS: Record<SMS_VERIFICATION_TYPE, string> = {
  [SMS_VERIFICATION_TYPE.PHONE_VERIFICATION]: "Verificação de Telefone",
  [SMS_VERIFICATION_TYPE.EMAIL_VERIFICATION]: "Verificação de Email",
  [SMS_VERIFICATION_TYPE.PASSWORD_RESET]: "Redefinição de Senha",
  [SMS_VERIFICATION_TYPE.TWO_FACTOR_AUTH]: "Autenticação de Dois Fatores",
  [SMS_VERIFICATION_TYPE.ACCOUNT_CONFIRMATION]: "Confirmação de Conta",
};

// =====================
// Rate Limiting Labels
// =====================

export const RATE_LIMIT_TYPE_LABELS: Record<RATE_LIMIT_TYPE, string> = {
  [RATE_LIMIT_TYPE.PER_CODE_ATTEMPT]: "Tentativas por Código",
  [RATE_LIMIT_TYPE.IP_VERIFICATION]: "Verificação por IP",
  [RATE_LIMIT_TYPE.CODE_SEND_CONTACT]: "Envio por Contato",
  [RATE_LIMIT_TYPE.CODE_SEND_IP]: "Envio por IP",
  [RATE_LIMIT_TYPE.ACCOUNT_LOCKOUT]: "Bloqueio de Conta",
  [RATE_LIMIT_TYPE.GLOBAL_RATE_LIMIT]: "Limite Global",
};

export const LOCKOUT_REASON_LABELS: Record<LOCKOUT_REASON, string> = {
  [LOCKOUT_REASON.EXCESSIVE_FAILED_ATTEMPTS]: "Excessive Failed Attempts",
  [LOCKOUT_REASON.IP_ABUSE_DETECTED]: "Abuso de IP Detectado",
  [LOCKOUT_REASON.PATTERN_ABUSE]: "Padrão de Abuso",
  [LOCKOUT_REASON.CAPTCHA_FAILURES]: "CAPTCHA Failures",
  [LOCKOUT_REASON.MANUAL_ADMIN_LOCK]: "Bloqueio Manual do Admin",
  [LOCKOUT_REASON.SECURITY_VIOLATION]: "Violação de Segurança",
};

export const CAPTCHA_REQUIREMENT_LEVEL_LABELS: Record<CAPTCHA_REQUIREMENT_LEVEL, string> = {
  [CAPTCHA_REQUIREMENT_LEVEL.NONE]: "Nenhum",
  [CAPTCHA_REQUIREMENT_LEVEL.BASIC]: "Básico",
  [CAPTCHA_REQUIREMENT_LEVEL.INTERMEDIATE]: "Intermediário",
  [CAPTCHA_REQUIREMENT_LEVEL.ADVANCED]: "Avançado",
  [CAPTCHA_REQUIREMENT_LEVEL.MAXIMUM]: "Máximo",
};

export const VERIFICATION_ABUSE_LEVEL_LABELS: Record<VERIFICATION_ABUSE_LEVEL, string> = {
  [VERIFICATION_ABUSE_LEVEL.LOW]: "Baixo",
  [VERIFICATION_ABUSE_LEVEL.MEDIUM]: "Médio",
  [VERIFICATION_ABUSE_LEVEL.HIGH]: "Alto",
  [VERIFICATION_ABUSE_LEVEL.CRITICAL]: "Crítico",
  [VERIFICATION_ABUSE_LEVEL.SEVERE]: "Severo",
};

export const PROGRESSIVE_DELAY_TIER_LABELS: Record<PROGRESSIVE_DELAY_TIER, string> = {
  [PROGRESSIVE_DELAY_TIER.TIER_1]: "5 segundos",
  [PROGRESSIVE_DELAY_TIER.TIER_2]: "15 segundos",
  [PROGRESSIVE_DELAY_TIER.TIER_3]: "30 segundos",
  [PROGRESSIVE_DELAY_TIER.TIER_4]: "1 minuto",
  [PROGRESSIVE_DELAY_TIER.TIER_5]: "5 minutos",
  [PROGRESSIVE_DELAY_TIER.TIER_6]: "15 minutos",
  [PROGRESSIVE_DELAY_TIER.TIER_7]: "30 minutos",
  [PROGRESSIVE_DELAY_TIER.TIER_8]: "1 hora",
};

export const VERIFICATION_SECURITY_ACTION_LABELS: Record<VERIFICATION_SECURITY_ACTION, string> = {
  [VERIFICATION_SECURITY_ACTION.LOG_ATTEMPT]: "Registrar Tentativa",
  [VERIFICATION_SECURITY_ACTION.DELAY_RESPONSE]: "Atrasar Resposta",
  [VERIFICATION_SECURITY_ACTION.REQUIRE_CAPTCHA]: "Requerer CAPTCHA",
  [VERIFICATION_SECURITY_ACTION.TEMPORARY_BLOCK]: "Bloqueio Temporário",
  [VERIFICATION_SECURITY_ACTION.ESCALATE_SECURITY]: "Escalar Segurança",
  [VERIFICATION_SECURITY_ACTION.NOTIFY_ADMIN]: "Notificar Admin",
  [VERIFICATION_SECURITY_ACTION.PERMANENT_BLOCK]: "Bloqueio Permanente",
};

// =====================
// Email Labels
// =====================

export const EMAIL_TYPE_LABELS: Record<EMAIL_TYPE, string> = {
  [EMAIL_TYPE.PASSWORD_RESET]: "Redefinição de Senha",
  [EMAIL_TYPE.TEMPORARY_PASSWORD]: "Senha Temporária",
  [EMAIL_TYPE.ACCOUNT_VERIFICATION]: "Verificação de Conta",
  [EMAIL_TYPE.PASSWORD_CHANGED]: "Senha Alterada",
  [EMAIL_TYPE.ACCOUNT_STATUS_CHANGE]: "Alteração de Status da Conta",
  [EMAIL_TYPE.WELCOME]: "Bem-vindo",
  [EMAIL_TYPE.NOTIFICATION]: "Notificação",
};

export const EMAIL_STATUS_LABELS: Record<EMAIL_STATUS, string> = {
  [EMAIL_STATUS.PENDING]: "Pending",
  [EMAIL_STATUS.SENT]: "Sent",
  [EMAIL_STATUS.DELIVERED]: "Delivered",
  [EMAIL_STATUS.FAILED]: "Falhou",
  [EMAIL_STATUS.BOUNCED]: "Rejeitado",
  [EMAIL_STATUS.CANCELLED]: "Cancelado",
};

// =====================
// Unified Verification Labels
// =====================

export const VERIFICATION_STATUS_LABELS: Record<VERIFICATION_STATUS, string> = {
  [VERIFICATION_STATUS.PENDING]: "Pending",
  [VERIFICATION_STATUS.SENT]: "Sent",
  [VERIFICATION_STATUS.VERIFIED]: "Verificado",
  [VERIFICATION_STATUS.EXPIRED]: "Expirado",
  [VERIFICATION_STATUS.FAILED]: "Falhou",
  [VERIFICATION_STATUS.CANCELLED]: "Cancelado",
};

export const VERIFICATION_METHOD_LABELS: Record<VERIFICATION_METHOD, string> = {
  [VERIFICATION_METHOD.EMAIL]: "E-mail",
  [VERIFICATION_METHOD.PHONE]: "Telefone",
  [VERIFICATION_METHOD.EMAIL_AND_PHONE]: "E-mail e Telefone",
};

export const VERIFICATION_PURPOSE_LABELS: Record<VERIFICATION_PURPOSE, string> = {
  [VERIFICATION_PURPOSE.ACCOUNT_VERIFICATION]: "Verificação de Conta",
  [VERIFICATION_PURPOSE.PASSWORD_RESET]: "Redefinição de Senha",
  [VERIFICATION_PURPOSE.PHONE_VERIFICATION]: "Verificação de Telefone",
  [VERIFICATION_PURPOSE.EMAIL_VERIFICATION]: "Verificação de E-mail",
  [VERIFICATION_PURPOSE.TWO_FACTOR_AUTH]: "Autenticação de Dois Fatores",
  [VERIFICATION_PURPOSE.LOGIN_VERIFICATION]: "Verificação de Login",
};

// =====================
// Item Notes & Documents Labels
// =====================

export const NOTE_CATEGORY_LABELS: Record<NOTE_CATEGORY, string> = {
  [NOTE_CATEGORY.GENERAL]: "Geral",
  [NOTE_CATEGORY.QUALITY]: "Qualidade",
  [NOTE_CATEGORY.MAINTENANCE]: "Manutenção",
  [NOTE_CATEGORY.COMPLIANCE]: "Conformidade",
  [NOTE_CATEGORY.SPECIFICATION]: "Especificação",
  [NOTE_CATEGORY.USAGE]: "Uso",
  [NOTE_CATEGORY.SUPPLIER]: "Fornecedor",
  [NOTE_CATEGORY.SAFETY]: "Segurança",
  [NOTE_CATEGORY.OTHER]: "Outro",
};

export const DOCUMENT_CATEGORY_LABELS: Record<DOCUMENT_CATEGORY, string> = {
  [DOCUMENT_CATEGORY.TECHNICAL_SPEC]: "Especificação Técnica",
  [DOCUMENT_CATEGORY.CERTIFICATE]: "Certificado",
  [DOCUMENT_CATEGORY.MANUAL]: "Manual",
  [DOCUMENT_CATEGORY.SAFETY_DATA]: "Dados de Segurança",
  [DOCUMENT_CATEGORY.WARRANTY]: "Garantia",
  [DOCUMENT_CATEGORY.INVOICE]: "Nota Fiscal",
  [DOCUMENT_CATEGORY.CONTRACT]: "Contrato",
  [DOCUMENT_CATEGORY.COMPLIANCE]: "Conformidade",
  [DOCUMENT_CATEGORY.PHOTO]: "Foto",
  [DOCUMENT_CATEGORY.OTHER]: "Outro",
};

export const LINK_TYPE_LABELS: Record<LINK_TYPE, string> = {
  [LINK_TYPE.MANUFACTURER]: "Site do Fabricante",
  [LINK_TYPE.DOCUMENTATION]: "Documentação",
  [LINK_TYPE.TUTORIAL]: "Tutorial",
  [LINK_TYPE.SUPPLIER]: "Fornecedor",
  [LINK_TYPE.INTERNAL]: "Recurso Interno",
  [LINK_TYPE.OTHER]: "Outro",
};

// =====================
// Favorite Pages Labels
// =====================

export const FAVORITE_PAGES_LABELS: Record<FAVORITE_PAGES, string> = {
  // Production - List Pages
  [FAVORITE_PAGES.PRODUCAO_AGENDA_LISTAR]: "Agenda de Produção",
  [FAVORITE_PAGES.PRODUCAO_CRONOGRAMA_LISTAR]: "Cronograma de Produção",
  [FAVORITE_PAGES.PRODUCAO_RECORTE_LISTAR]: "Lista de Recortes",
  [FAVORITE_PAGES.PRODUCAO_SERVICOS_LISTAR]: "Lista de Serviços",
  [FAVORITE_PAGES.PRODUCAO_OBSERVACOES_LISTAR]: "Lista de Observações",
  [FAVORITE_PAGES.PRODUCAO_AEROGRAFIA_LISTAR]: "Lista de Aerografias",
  [FAVORITE_PAGES.PRODUCAO_GARAGENS_LISTAR]: "Barracões",
  [FAVORITE_PAGES.PRODUCAO_ORDENS_SERVICO_LISTAR]: "Lista de Ordens de Serviço",
  [FAVORITE_PAGES.PRODUCAO_HISTORICO_LISTAR]: "Histórico de Produção",

  // Production - Create Pages
  [FAVORITE_PAGES.PRODUCAO_AGENDA_CADASTRAR]: "Cadastrar Agenda",
  [FAVORITE_PAGES.PRODUCAO_CRONOGRAMA_CADASTRAR]: "Cadastrar Cronograma",
  [FAVORITE_PAGES.PRODUCAO_RECORTE_CADASTRAR]: "Cadastrar Recorte",
  [FAVORITE_PAGES.PRODUCAO_SERVICOS_CADASTRAR]: "Cadastrar Serviço",
  [FAVORITE_PAGES.PRODUCAO_OBSERVACOES_CADASTRAR]: "Cadastrar Observação",
  [FAVORITE_PAGES.PRODUCAO_AEROGRAFIA_CADASTRAR]: "Cadastrar Aerografia",
  [FAVORITE_PAGES.PRODUCAO_GARAGENS_CADASTRAR]: "Cadastrar Garagem",
  [FAVORITE_PAGES.PRODUCAO_ORDENS_SERVICO_CADASTRAR]: "Cadastrar Ordem de Serviço",

  // Inventory - List Pages
  [FAVORITE_PAGES.ESTOQUE_MOVIMENTACOES_LISTAR]: "Movimentações de Estoque",
  [FAVORITE_PAGES.ESTOQUE_PRODUTOS_LISTAR]: "Lista de Produtos",
  [FAVORITE_PAGES.ESTOQUE_PRODUTOS_CATEGORIAS_LISTAR]: "Lista de Categorias",
  [FAVORITE_PAGES.ESTOQUE_PRODUTOS_MARCAS_LISTAR]: "Lista de Marcas",
  [FAVORITE_PAGES.ESTOQUE_PEDIDOS_LISTAR]: "Lista de Pedidos",
  [FAVORITE_PAGES.ESTOQUE_PEDIDOS_AGENDAMENTOS_LISTAR]: "Agendamentos de Pedidos",
  [FAVORITE_PAGES.ESTOQUE_PEDIDOS_AUTOMATICOS_LISTAR]: "Pedidos Automáticos",
  [FAVORITE_PAGES.ESTOQUE_MANUTENCAO_LISTAR]: "Lista de Manutenções",
  [FAVORITE_PAGES.ESTOQUE_MANUTENCAO_AGENDAMENTOS_LISTAR]: "Agendamentos de Manutenção",
  [FAVORITE_PAGES.ESTOQUE_RETIRADAS_EXTERNAS_LISTAR]: "Lista de Operações Externas",
  [FAVORITE_PAGES.ESTOQUE_FORNECEDORES_LISTAR]: "Lista de Fornecedores",
  [FAVORITE_PAGES.ESTOQUE_EPI_LISTAR]: "Lista de EPIs",
  [FAVORITE_PAGES.ESTOQUE_EPI_ENTREGAS_LISTAR]: "Entregas de EPIs",
  [FAVORITE_PAGES.ESTOQUE_EPI_AGENDAMENTOS_LISTAR]: "Agendamentos de EPIs",
  [FAVORITE_PAGES.ESTOQUE_EMPRESTIMOS_LISTAR]: "Lista de Empréstimos",
  // Statistics Pages
  [FAVORITE_PAGES.ESTATISTICAS]: "Estatísticas",
  // Entity-Specific Statistics
  [FAVORITE_PAGES.ESTATISTICAS_ESTOQUE]: "Estatísticas do Estoque",
  [FAVORITE_PAGES.ESTOQUE_ESTATISTICAS_MOVIMENTACAO]: "Estatísticas de Movimentação",
  [FAVORITE_PAGES.STATISTICS_CONSUMPTION]: "Análise de Consumo",
  [FAVORITE_PAGES.ESTATISTICAS_PRODUCAO]: "Estatísticas de Produção",
  [FAVORITE_PAGES.ESTATISTICAS_PEDIDOS]: "Estatísticas de Pedidos",
  [FAVORITE_PAGES.ESTATISTICAS_DEPARTAMENTO_PESSOAL]: "Estatísticas de RH",
  [FAVORITE_PAGES.ESTATISTICAS_FINANCEIRO]: "Estatísticas Financeiras",
  [FAVORITE_PAGES.ESTATISTICAS_FINANCEIRO_COBRANCAS]: "Estatísticas - Visão Financeira",
  [FAVORITE_PAGES.ESTATISTICAS_FINANCEIRO_BOLETOS]: "Estatísticas - Boletos",
  [FAVORITE_PAGES.ESTATISTICAS_FINANCEIRO_RECEITA]: "Estatísticas - Visão Financeira",
  [FAVORITE_PAGES.ESTATISTICAS_FINANCEIRO_NFSE]: "Estatísticas - NFS-e",
  [FAVORITE_PAGES.ESTATISTICAS_FINANCEIRO_CONCILIACAO]: "Estatísticas - Conciliação Bancária",
  // Advanced Analytics
  [FAVORITE_PAGES.ESTATISTICAS_ANALYTICS_PREDITIVA]: "Analytics Preditiva",
  [FAVORITE_PAGES.ESTATISTICAS_ANALYTICS_COMPARATIVA]: "Análise Comparativa",
  [FAVORITE_PAGES.ESTATISTICAS_ANALYTICS_CORRELACAO]: "Análise de Correlação",
  [FAVORITE_PAGES.ESTATISTICAS_ANALYTICS_COHORT]: "Análise de Cohort",
  // Dashboards
  [FAVORITE_PAGES.ESTATISTICAS_DASHBOARD_EXECUTIVO]: "Dashboard Executivo",
  [FAVORITE_PAGES.ESTATISTICAS_DASHBOARD_METAS]: "Acompanhamento de Metas",
  [FAVORITE_PAGES.ESTATISTICAS_DASHBOARD_TEMPO_REAL]: "Monitoramento em Tempo Real",
  [FAVORITE_PAGES.ESTATISTICAS_DASHBOARD_EXPLORADOR]: "Explorador de Dados",
  // Reports
  [FAVORITE_PAGES.ESTATISTICAS_RELATORIOS_CONSTRUTOR]: "Construtor de Relatórios",

  // Inventory - Create Pages
  [FAVORITE_PAGES.ESTOQUE_MOVIMENTACOES_CADASTRAR]: "Cadastrar Movimentação",
  [FAVORITE_PAGES.ESTOQUE_PRODUTOS_CADASTRAR]: "Cadastrar Produto",
  [FAVORITE_PAGES.ESTOQUE_PRODUTOS_CATEGORIAS_CADASTRAR]: "Cadastrar Categoria",
  [FAVORITE_PAGES.ESTOQUE_PRODUTOS_MARCAS_CADASTRAR]: "Cadastrar Marca",
  [FAVORITE_PAGES.ESTOQUE_PEDIDOS_CADASTRAR]: "Cadastrar Pedido",
  [FAVORITE_PAGES.ESTOQUE_PEDIDOS_AGENDAMENTOS_CADASTRAR]: "Cadastrar Agendamento de Pedido",
  [FAVORITE_PAGES.ESTOQUE_MANUTENCAO_CADASTRAR]: "Cadastrar Manutenção",
  [FAVORITE_PAGES.ESTOQUE_MANUTENCAO_AGENDAMENTOS_CADASTRAR]: "Cadastrar Agendamento de Manutenção",
  [FAVORITE_PAGES.ESTOQUE_RETIRADAS_EXTERNAS_CADASTRAR]: "Cadastrar Operação Externa",
  [FAVORITE_PAGES.ESTOQUE_FORNECEDORES_CADASTRAR]: "Cadastrar Fornecedor",
  [FAVORITE_PAGES.ESTOQUE_EPI_CADASTRAR]: "Cadastrar EPI",
  [FAVORITE_PAGES.ESTOQUE_EPI_ENTREGAS_CADASTRAR]: "Cadastrar Entrega de EPI",
  [FAVORITE_PAGES.ESTOQUE_EPI_AGENDAMENTOS_CADASTRAR]: "Cadastrar Agendamento de EPI",
  [FAVORITE_PAGES.ESTOQUE_EMPRESTIMOS_CADASTRAR]: "Cadastrar Empréstimo",

  // Inventory - Edit Pages
  [FAVORITE_PAGES.ESTOQUE_MANUTENCAO_AGENDAMENTOS_EDITAR]: "Editar Agendamento de Manutenção",

  // Painting - List Pages
  [FAVORITE_PAGES.PINTURA_CATALOGO_LISTAR]: "Catálogo de Tintas",
  [FAVORITE_PAGES.PINTURA_PRODUCOES_LISTAR]: "Lista de Produções",
  [FAVORITE_PAGES.PINTURA_TIPOS_TINTA_LISTAR]: "Lista de Tipos de Tinta",
  [FAVORITE_PAGES.PINTURA_FORMULAS_LISTAR]: "Lista de Fórmulas",
  [FAVORITE_PAGES.PINTURA_FORMULACOES_LISTAR]: "Lista de Formulações",
  [FAVORITE_PAGES.PINTURA_COMPONENTES_LISTAR]: "Lista de Componentes",
  [FAVORITE_PAGES.PINTURA_MARCAS_TINTA_LISTAR]: "Lista de Marcas de Tinta",

  // Painting - Create Pages
  [FAVORITE_PAGES.PINTURA_CATALOGO_CADASTRAR]: "Cadastrar Tinta",
  [FAVORITE_PAGES.PINTURA_PRODUCOES_CADASTRAR]: "Cadastrar Produção",
  [FAVORITE_PAGES.PINTURA_TIPOS_TINTA_CADASTRAR]: "Cadastrar Tipo de Tinta",
  [FAVORITE_PAGES.PINTURA_FORMULAS_CADASTRAR]: "Cadastrar Fórmula",
  [FAVORITE_PAGES.PINTURA_FORMULACOES_CADASTRAR]: "Cadastrar Formulação",
  [FAVORITE_PAGES.PINTURA_COMPONENTES_CADASTRAR]: "Cadastrar Componente",
  [FAVORITE_PAGES.PINTURA_MARCAS_TINTA_CADASTRAR]: "Cadastrar Marca de Tinta",

  // Painting - Edit Pages
  [FAVORITE_PAGES.PINTURA_TIPOS_TINTA_EDITAR]: "Editar Tipo de Tinta",
  [FAVORITE_PAGES.PINTURA_MARCAS_TINTA_EDITAR]: "Editar Marca de Tinta",

  // Administration - List Pages
  [FAVORITE_PAGES.ADMINISTRACAO_CLIENTES_LISTAR]: "Lista de Clientes",
  [FAVORITE_PAGES.ADMINISTRACAO_RESPONSAVEIS_LISTAR]: "Lista de Responsáveis",
  [FAVORITE_PAGES.ADMINISTRACAO_COLABORADORES_LISTAR]: "Lista de Colaboradores",
  [FAVORITE_PAGES.ADMINISTRACAO_ORCAMENTOS_LISTAR]: "Lista de Orçamentos",
  [FAVORITE_PAGES.ADMINISTRACAO_REGISTROS_ALTERACOES_LISTAR]: "Registros de Alterações",
  [FAVORITE_PAGES.ADMINISTRACAO_ARQUIVOS_LISTAR]: "Lista de Arquivos",
  [FAVORITE_PAGES.ADMINISTRACAO_SETORES_LISTAR]: "Lista de Setores",
  [FAVORITE_PAGES.ADMINISTRACAO_METAS_LISTAR]: "Metas",
  [FAVORITE_PAGES.ADMINISTRACAO_NOTIFICACOES_LISTAR]: "Lista de Notificações",
  [FAVORITE_PAGES.ADMINISTRACAO_MENSAGENS_LISTAR]: "Lista de Mensagens",
  [FAVORITE_PAGES.ADMINISTRACAO_FOLHA_DE_PAGAMENTO]: "Folha de Pagamento",

  // Administration - Create Pages
  [FAVORITE_PAGES.ADMINISTRACAO_CLIENTES_CADASTRAR]: "Cadastrar Cliente",
  [FAVORITE_PAGES.ADMINISTRACAO_COLABORADORES_CADASTRAR]: "Cadastrar Colaborador",
  [FAVORITE_PAGES.ADMINISTRACAO_ORCAMENTOS_CADASTRAR]: "Cadastrar Orçamento",
  [FAVORITE_PAGES.ADMINISTRACAO_ARQUIVOS_CADASTRAR]: "Upload de Arquivo",
  [FAVORITE_PAGES.ADMINISTRACAO_SETORES_CADASTRAR]: "Cadastrar Setor",
  [FAVORITE_PAGES.ADMINISTRACAO_NOTIFICACOES_CADASTRAR]: "Enviar Notificação",
  [FAVORITE_PAGES.ADMINISTRACAO_NOTIFICACOES_EDITAR]: "Editar Notificação",
  [FAVORITE_PAGES.ADMINISTRACAO_MENSAGENS_CRIAR]: "Criar Mensagem",
  [FAVORITE_PAGES.ADMINISTRACAO_MENSAGENS_EDITAR]: "Editar Mensagem",

  // Personnel Department - List Pages
  [FAVORITE_PAGES.DEPARTAMENTO_PESSOAL_CARGOS_LISTAR]: "Lista de Cargos",
  [FAVORITE_PAGES.DEPARTAMENTO_PESSOAL_FERIAS_LISTAR]: "Lista de Férias",
  [FAVORITE_PAGES.DEPARTAMENTO_PESSOAL_CALENDARIO]: "Calendário",
  [FAVORITE_PAGES.DEPARTAMENTO_PESSOAL_FERIADOS_LISTAR]: "Lista de Feriados",
  [FAVORITE_PAGES.DEPARTAMENTO_PESSOAL_AVISOS_LISTAR]: "Warnings List",
  [FAVORITE_PAGES.DEPARTAMENTO_PESSOAL_CALCULOS]: "Cálculos de Ponto",
  [FAVORITE_PAGES.DEPARTAMENTO_PESSOAL_CONTROLE_PONTO_LISTAR]: "Controle de Ponto",
  [FAVORITE_PAGES.DEPARTAMENTO_PESSOAL_CONTROLE_PONTO_ASSINATURA_DIGITAL_LISTAR]: "Assinatura Digital de Cartão Ponto",
  [FAVORITE_PAGES.DEPARTAMENTO_PESSOAL_EPI_ENTREGAS_LISTAR]: "Entregas de EPIs (Medicina do Trabalho)",
  [FAVORITE_PAGES.DEPARTAMENTO_PESSOAL_EPI_AGENDAMENTOS_LISTAR]: "Agendamentos de EPIs (Medicina do Trabalho)",
  [FAVORITE_PAGES.DEPARTAMENTO_PESSOAL_SETORES_LISTAR]: "Lista de Setores (RH)",
  [FAVORITE_PAGES.DEPARTAMENTO_PESSOAL_BONUS_LISTAR]: "Bônus",
  [FAVORITE_PAGES.DEPARTAMENTO_PESSOAL_NIVEIS_DESEMPENHO_LISTAR]: "Níveis de Desempenho",

  // Personnel Department - Create Pages
  [FAVORITE_PAGES.DEPARTAMENTO_PESSOAL_CARGOS_CADASTRAR]: "Cadastrar Cargo",
  [FAVORITE_PAGES.DEPARTAMENTO_PESSOAL_FERIAS_CADASTRAR]: "Cadastrar Férias",
  [FAVORITE_PAGES.DEPARTAMENTO_PESSOAL_FERIADOS_CADASTRAR]: "Cadastrar Feriado",
  [FAVORITE_PAGES.DEPARTAMENTO_PESSOAL_AVISOS_CADASTRAR]: "Register Warning",
  [FAVORITE_PAGES.DEPARTAMENTO_PESSOAL_EPI_ENTREGAS_CADASTRAR]: "Cadastrar Entrega de EPI (Medicina do Trabalho)",
  [FAVORITE_PAGES.DEPARTAMENTO_PESSOAL_EPI_AGENDAMENTOS_CADASTRAR]: "Cadastrar Agendamento de EPI (Medicina do Trabalho)",
  [FAVORITE_PAGES.DEPARTAMENTO_PESSOAL_SETORES_CADASTRAR]: "Cadastrar Setor (RH)",

  // Financeiro - Pages
  [FAVORITE_PAGES.FINANCEIRO_DASHBOARD]: "Financeiro",
  [FAVORITE_PAGES.FINANCEIRO_FATURAMENTO]: "Faturamento",
  [FAVORITE_PAGES.FINANCEIRO_ORCAMENTO]: "Orçamentos",
  [FAVORITE_PAGES.FINANCEIRO_ORCAMENTO_CADASTRAR]: "Cadastrar Orçamento",
  [FAVORITE_PAGES.FINANCEIRO_CONCILIACAO_TRANSACOES]: "Transações Bancárias",
  [FAVORITE_PAGES.FINANCEIRO_CONCILIACAO_NOTAS]: "Notas Fiscais",

  // Personal - List Pages
  [FAVORITE_PAGES.PESSOAL_FERIADOS_LISTAR]: "Feriados",
  [FAVORITE_PAGES.PESSOAL_MEUS_EPIS_LISTAR]: "Meus EPIs",
  [FAVORITE_PAGES.PESSOAL_MEUS_EMPRESTIMOS_LISTAR]: "Meus Empréstimos",
  [FAVORITE_PAGES.PESSOAL_MINHAS_ATIVIDADES_LISTAR]: "Minhas Atividades",
  [FAVORITE_PAGES.PESSOAL_MINHAS_ADVERTENCIAS_LISTAR]: "Minhas Advertências",
  [FAVORITE_PAGES.PESSOAL_MEUS_PONTOS]: "Meus Pontos",

  // Catalog Basic - List Pages
  [FAVORITE_PAGES.CATALOGO_BASICO_LISTAR]: "Catálogo Básico",

  // Server - List Pages
  [FAVORITE_PAGES.SERVIDOR_USUARIOS]: "Usuários do Sistema",

  // Personnel Department - Edit Pages
  [FAVORITE_PAGES.DEPARTAMENTO_PESSOAL_CARGOS_EDITAR]: "Editar Cargo",
  [FAVORITE_PAGES.DEPARTAMENTO_PESSOAL_FERIAS_EDITAR]: "Editar Férias",
  [FAVORITE_PAGES.DEPARTAMENTO_PESSOAL_FERIADOS_EDITAR]: "Editar Feriado",
  [FAVORITE_PAGES.DEPARTAMENTO_PESSOAL_AVISOS_EDITAR]: "Edit Warning",
  [FAVORITE_PAGES.DEPARTAMENTO_PESSOAL_SETORES_EDITAR]: "Editar Setor",

  // Personnel Department - Details Pages
  [FAVORITE_PAGES.DEPARTAMENTO_PESSOAL_CARGOS_DETALHES]: "Detalhes do Cargo",
  [FAVORITE_PAGES.DEPARTAMENTO_PESSOAL_FERIAS_DETALHES]: "Detalhes das Férias",
  [FAVORITE_PAGES.DEPARTAMENTO_PESSOAL_FERIADOS_DETALHES]: "Detalhes do Feriado",
  [FAVORITE_PAGES.DEPARTAMENTO_PESSOAL_AVISOS_DETALHES]: "Warning Details",

  // Personnel Department - Batch Edit Pages
  [FAVORITE_PAGES.DEPARTAMENTO_PESSOAL_CARGOS_EDITAR_LOTE]: "Editar Cargos em Lote",
  [FAVORITE_PAGES.DEPARTAMENTO_PESSOAL_FERIADOS_EDITAR_LOTE]: "Editar Feriados em Lote",
  [FAVORITE_PAGES.DEPARTAMENTO_PESSOAL_AVISOS_EDITAR_LOTE]: "Batch Edit Warnings",

  // Personnel Department - Calendar Pages
  [FAVORITE_PAGES.DEPARTAMENTO_PESSOAL_FERIADOS_CALENDARIO]: "Calendário de Feriados",

  // Personnel Department - Additional Pages
  [FAVORITE_PAGES.DEPARTAMENTO_PESSOAL_CARGOS_REMUNERACOES]: "Remunerações do Cargo",

  // Administration - Edit Pages
  [FAVORITE_PAGES.ADMINISTRACAO_SETORES_EDITAR]: "Editar Setor",

  // Administration - Details Pages
  [FAVORITE_PAGES.ADMINISTRACAO_SETORES_DETALHES]: "Detalhes do Setor",

  // Administration - Batch Edit Pages
  [FAVORITE_PAGES.ADMINISTRACAO_SETORES_EDITAR_LOTE]: "Editar Setores em Lote",

  // Personnel Department (Departamento Pessoal) - List Pages
  [FAVORITE_PAGES.DEPARTAMENTO_PESSOAL_ADMISSOES_LISTAR]: "Admissões",
  [FAVORITE_PAGES.DEPARTAMENTO_PESSOAL_RESCISOES_LISTAR]: "Rescisões",
  [FAVORITE_PAGES.DEPARTAMENTO_PESSOAL_REAJUSTES_LISTAR]: "Reajustes",
  [FAVORITE_PAGES.DEPARTAMENTO_PESSOAL_PROMOCOES_LISTAR]: "Promoções",
  [FAVORITE_PAGES.DEPARTAMENTO_PESSOAL_PROMOCOES_SIMULACAO]: "Simulação de Promoções",
  [FAVORITE_PAGES.DEPARTAMENTO_PESSOAL_BENEFICIOS_LISTAR]: "Benefícios",
  [FAVORITE_PAGES.DEPARTAMENTO_PESSOAL_BENEFICIOS_ADESOES_LISTAR]: "Adesões de Benefícios",

  // Occupational Health (Medicina do Trabalho) - List Pages
  [FAVORITE_PAGES.MEDICINA_DO_TRABALHO_ASO_LISTAR]: "ASO",
  [FAVORITE_PAGES.MEDICINA_DO_TRABALHO_EXAMES_PERIODICOS_LISTAR]: "Exames Periódicos",
  [FAVORITE_PAGES.MEDICINA_DO_TRABALHO_AFASTAMENTOS_LISTAR]: "Afastamentos",
  [FAVORITE_PAGES.MEDICINA_DO_TRABALHO_FISPQ_LISTAR]: "FISPQ/FDS",

  // Financeiro - Contas a Pagar
  [FAVORITE_PAGES.FINANCEIRO_CONTAS_A_PAGAR_LISTAR]: "Contas a Pagar",

  // Ferramentas
  [FAVORITE_PAGES.FERRAMENTAS_CUSTO_DE_FUNCIONARIO]: "Custo de Funcionário",
  [FAVORITE_PAGES.FERRAMENTAS_NOTAS]: "Notas",

  // Favorites coverage — list/index pages wired for the favorites button
  [FAVORITE_PAGES.ADMINISTRACAO_NOTIFICACOES_CONFIGURACOES_LISTAR]: "Configurações de Notificação",
  [FAVORITE_PAGES.ADMINISTRACAO_QUESTIONARIOS_LISTAR]: "Questionários",
  [FAVORITE_PAGES.ADMINISTRACAO_QUESTIONARIOS_PERGUNTAS_LISTAR]: "Perguntas",
  [FAVORITE_PAGES.ADMINISTRACAO_QUESTIONARIOS_TEMAS_LISTAR]: "Temas",
  [FAVORITE_PAGES.ADMINISTRACAO_AVALIACAO_COMPETENCIAS_LISTAR]: "Avaliação de Competências",
  [FAVORITE_PAGES.ADMINISTRACAO_COMPETENCIAS_LISTAR]: "Competências",
  [FAVORITE_PAGES.ADMINISTRACAO_TOPICOS_LISTAR]: "Tópicos",
  [FAVORITE_PAGES.FINANCEIRO_NOTAS_FISCAIS_LISTAR]: "Notas Fiscais",
  [FAVORITE_PAGES.FINANCEIRO_CONTAS_A_RECEBER_LISTAR]: "Contas a Receber",
  [FAVORITE_PAGES.FINANCEIRO_CONTAS_RECORRENTES_LISTAR]: "Recorrentes",
  [FAVORITE_PAGES.DEPARTAMENTO_PESSOAL_REQUISICOES_LISTAR]: "Ajustes de Ponto",
  [FAVORITE_PAGES.DEPARTAMENTO_PESSOAL_HORARIOS_LISTAR]: "Horários",
  [FAVORITE_PAGES.DEPARTAMENTO_PESSOAL_EMPRESTIMOS_LISTAR]: "Empréstimos",
  [FAVORITE_PAGES.ESTOQUE_LOCALIZACOES_LISTAR]: "Localizações",
  [FAVORITE_PAGES.MINHA_EQUIPE]: "Minha Equipe",
  [FAVORITE_PAGES.PRODUCAO_AVALIACAO_COMPETENCIAS_LISTAR]: "Avaliações de Competências",
  [FAVORITE_PAGES.MEDICINA_DO_TRABALHO_CAT_LISTAR]: "CAT - Acidentes de Trabalho",
  [FAVORITE_PAGES.PERFIL]: "Meu Perfil",
  [FAVORITE_PAGES.SERVIDOR_IMPLANTACOES_LISTAR]: "Implantações",
  [FAVORITE_PAGES.FERRAMENTAS_PALETA]: "Paleta de Cores",
  [FAVORITE_PAGES.FERRAMENTAS]: "Ferramentas",

  // ===== Favorites coverage batch 2 =====
  // Controle de Ponto
  [FAVORITE_PAGES.DEPARTAMENTO_PESSOAL_CONTROLE_PONTO_COLABORADOR_LISTAR]: "Espelho de Ponto",
  [FAVORITE_PAGES.DEPARTAMENTO_PESSOAL_CONTROLE_PONTO_DIA_LISTAR]: "Resumo do Dia",
  [FAVORITE_PAGES.DEPARTAMENTO_PESSOAL_CONTROLE_PONTO_EDICAO_LISTAR]: "Edição de Ponto",
  [FAVORITE_PAGES.DEPARTAMENTO_PESSOAL_CONTROLE_PONTO_AUSENCIAS_LISTAR]: "Ausências",
  [FAVORITE_PAGES.DEPARTAMENTO_PESSOAL_CONTROLE_PONTO_FECHAMENTO_LISTAR]: "Fechamento de Cartão Ponto",
  // Roots
  [FAVORITE_PAGES.ESTOQUE_RAIZ]: "Estoque",
  [FAVORITE_PAGES.ADMINISTRACAO_DASHBOARD]: "Administração",
  [FAVORITE_PAGES.PINTURA_DASHBOARD]: "Pintura",
  [FAVORITE_PAGES.DEPARTAMENTO_PESSOAL_RAIZ]: "Departamento Pessoal",
  [FAVORITE_PAGES.PESSOAL_INICIO]: "Área Pessoal",
  [FAVORITE_PAGES.SERVIDOR_INICIO]: "Servidor",
  // Produção
  [FAVORITE_PAGES.PRODUCAO_CALENDARIO]: "Calendário de Produção",
  [FAVORITE_PAGES.ESTATISTICAS_PRODUCAO_PRODUTIVIDADE]: "Produtividade",
  [FAVORITE_PAGES.ESTATISTICAS_PRODUCAO_DESEMPENHO]: "Desempenho de Produção",
  [FAVORITE_PAGES.ESTATISTICAS_PRODUCAO_GARGALOS]: "Gargalos",
  [FAVORITE_PAGES.ESTATISTICAS_PRODUCAO_VALOR_BONUS]: "Relação de Bônus",
  // Departamento Pessoal
  [FAVORITE_PAGES.DEPARTAMENTO_PESSOAL_BONUS_SIMULACAO]: "Simulação de Bônus",
  [FAVORITE_PAGES.DEPARTAMENTO_PESSOAL_CARGOS_HIERARQUIA]: "Hierarquia de Cargos",
  [FAVORITE_PAGES.DEPARTAMENTO_PESSOAL_INTEGRACAO_SECULLUM]: "Integração Secullum",
  [FAVORITE_PAGES.DEPARTAMENTO_PESSOAL_RESCISOES_CADASTRAR]: "Cadastrar Rescisão",
  [FAVORITE_PAGES.DEPARTAMENTO_PESSOAL_BENEFICIOS_CADASTRAR]: "Cadastrar Benefício",
  [FAVORITE_PAGES.DEPARTAMENTO_PESSOAL_BENEFICIOS_ADESOES_CADASTRAR]: "Cadastrar Adesão",
  [FAVORITE_PAGES.ESTATISTICAS_DP_FOLHA]: "Estatísticas - Folha",
  [FAVORITE_PAGES.ESTATISTICAS_DP_CUSTO_FOLHA]: "Estatísticas - Custo de Folha",
  [FAVORITE_PAGES.ESTATISTICAS_DP_EQUIPE]: "Estatísticas - Equipe",
  [FAVORITE_PAGES.ESTATISTICAS_DP_FALTAS]: "Estatísticas - Faltas",
  [FAVORITE_PAGES.ESTATISTICAS_DP_COMPETENCIAS]: "Estatísticas - Competências",
  // Financeiro
  [FAVORITE_PAGES.FINANCEIRO_CONCILIACAO_EXTRATO]: "Extrato Bancário",
  [FAVORITE_PAGES.FINANCEIRO_CONCILIACAO_CATEGORIAS]: "Categorias de Conciliação",
  [FAVORITE_PAGES.FINANCEIRO_CONTAS_RECORRENTES_CADASTRAR]: "Cadastrar Conta Recorrente",
  // Medicina do Trabalho
  [FAVORITE_PAGES.MEDICINA_DO_TRABALHO_ASO_CADASTRAR]: "Novo Exame (ASO)",
  [FAVORITE_PAGES.MEDICINA_DO_TRABALHO_AFASTAMENTOS_CADASTRAR]: "Novo Afastamento",
  [FAVORITE_PAGES.MEDICINA_DO_TRABALHO_FISPQ_CADASTRAR]: "Nova FISPQ",
  [FAVORITE_PAGES.MEDICINA_DO_TRABALHO_CAT_CADASTRAR]: "Nova CAT",
  // Pessoal
  [FAVORITE_PAGES.PESSOAL_MENSAGENS_LISTAR]: "Minhas Mensagens",
  [FAVORITE_PAGES.PESSOAL_ADVERTENCIAS_LISTAR]: "Advertências",
  // Minha Equipe
  [FAVORITE_PAGES.MINHA_EQUIPE_MEMBROS_LISTAR]: "Membros da Equipe",
  [FAVORITE_PAGES.MINHA_EQUIPE_EMPRESTIMOS_LISTAR]: "Empréstimos da Equipe",
  [FAVORITE_PAGES.MINHA_EQUIPE_ADVERTENCIAS_LISTAR]: "Advertências da Equipe",
  [FAVORITE_PAGES.MINHA_EQUIPE_EPIS_LISTAR]: "EPIs da Equipe",
  [FAVORITE_PAGES.MINHA_EQUIPE_MOVIMENTACOES_LISTAR]: "Movimentações da Equipe",
  [FAVORITE_PAGES.MINHA_EQUIPE_CONTROLE_PONTO_LISTAR]: "Controle de Ponto da Equipe",
  // Ferramentas
  [FAVORITE_PAGES.FERRAMENTAS_QR_CODE]: "Gerador de QR Code",
  [FAVORITE_PAGES.FERRAMENTAS_CALCULADORA_MISTURA]: "Calculadora de Mistura",
  [FAVORITE_PAGES.FERRAMENTAS_CALCULADORA_HORAS]: "Calculadora de Horas",
  [FAVORITE_PAGES.FERRAMENTAS_CUSTO_HORAS_EXTRAS]: "Custo de Horas Extras",
  [FAVORITE_PAGES.FERRAMENTAS_CERTIFICADO_RESIDUOS]: "Certificado de Resíduos",
  // Servidor
  [FAVORITE_PAGES.SERVIDOR_BACKUP]: "Backup do Sistema",
  [FAVORITE_PAGES.SERVIDOR_SINCRONIZACAO_BD]: "Sincronização de Banco",
  [FAVORITE_PAGES.SERVIDOR_GERENCIADOR_ARQUIVOS]: "Gerenciador de Arquivos",
  [FAVORITE_PAGES.SERVIDOR_LOGS]: "Logs do Sistema",
  [FAVORITE_PAGES.SERVIDOR_METRICAS]: "Métricas do Sistema",
  [FAVORITE_PAGES.SERVIDOR_SERVICOS]: "Serviços do Sistema",
  [FAVORITE_PAGES.SERVIDOR_REGISTROS_ALTERACOES_LISTAR]: "Registros de Alterações",
  // Perfil
  [FAVORITE_PAGES.PERFIL_NOTIFICACOES]: "Preferências de Notificação",
  // Administração
  [FAVORITE_PAGES.ADMINISTRACAO_APLICATIVOS_LISTAR]: "Aplicativos Móveis",
};

export const MEASURE_SIDE_LABELS: Record<MEASURE_SIDE, string> = {
  [MEASURE_SIDE.LEFT]: "Lateral Esquerda",
  [MEASURE_SIDE.RIGHT]: "Lateral Direita",
  [MEASURE_SIDE.BACK]: "Traseira",
};

// =====================
// Bonus & Payroll Labels
// =====================

export const BONUS_DISCOUNT_REASON_LABELS: Record<BONUS_DISCOUNT_REASON, string> = {
  [BONUS_DISCOUNT_REASON.ABSENCE]: "Ausência",
  [BONUS_DISCOUNT_REASON.LATE_DELIVERY]: "Entrega Atrasada",
  [BONUS_DISCOUNT_REASON.QUALITY_ISSUE]: "Problema de Qualidade",
  [BONUS_DISCOUNT_REASON.DISCIPLINARY]: "Disciplinar",
  [BONUS_DISCOUNT_REASON.OTHER]: "Outro",
};

export const BONUS_STATUS_LABELS: Record<BONUS_STATUS, string> = {
  [BONUS_STATUS.DRAFT]: "Rascunho",
  [BONUS_STATUS.CONFIRMED]: "Confirmado",
};

export const DISCOUNT_TYPE_LABELS: Record<DISCOUNT_TYPE, string> = {
  [DISCOUNT_TYPE.NONE]: "Nenhum",
  [DISCOUNT_TYPE.PERCENTAGE]: "Porcentagem",
  [DISCOUNT_TYPE.FIXED_VALUE]: "Valor Fixo",
};

export const RESPONSIBLE_ROLE_LABELS: Record<RESPONSIBLE_ROLE, string> = {
  [RESPONSIBLE_ROLE.COMMERCIAL]: "Comercial",
  [RESPONSIBLE_ROLE.OWNER]: "Proprietário",
  [RESPONSIBLE_ROLE.SELLER]: "Vendedor",
  [RESPONSIBLE_ROLE.REPRESENTATIVE]: "Representante",
  [RESPONSIBLE_ROLE.COORDINATOR]: "Coordenador",
  [RESPONSIBLE_ROLE.MARKETING]: "Marketing",
  [RESPONSIBLE_ROLE.FINANCIAL]: "Financeiro",
  [RESPONSIBLE_ROLE.FLEET_MANAGER]: "Gestor de Frota",
  [RESPONSIBLE_ROLE.DRIVER]: "Motorista",
};

export const PAYMENT_CONDITION_LABELS: Record<PAYMENT_CONDITION, string> = {
  [PAYMENT_CONDITION.CASH_5]: "À vista (5 dias)",
  [PAYMENT_CONDITION.CASH_40]: "À vista (40 dias)",
  [PAYMENT_CONDITION.INSTALLMENTS_2]: "Entrada + 20",
  [PAYMENT_CONDITION.INSTALLMENTS_3]: "Entrada + 20/40",
  [PAYMENT_CONDITION.INSTALLMENTS_4]: "Entrada + 20/40/60",
  [PAYMENT_CONDITION.INSTALLMENTS_5]: "Entrada + 20/40/60/80",
  [PAYMENT_CONDITION.INSTALLMENTS_6]: "Entrada + 20/40/60/80/100",
  [PAYMENT_CONDITION.INSTALLMENTS_7]: "Entrada + 20/40/60/80/100/120",
  [PAYMENT_CONDITION.CUSTOM]: "Personalizado",
};

export const PAYROLL_STATUS_LABELS: Record<PAYROLL_STATUS, string> = {
  [PAYROLL_STATUS.DRAFT]: "Rascunho",
  [PAYROLL_STATUS.FINALIZED]: "Finished",
};

export const PAYROLL_MONTH_LABELS: Record<PAYROLL_MONTH, string> = {
  [PAYROLL_MONTH.JANUARY]: "January",
  [PAYROLL_MONTH.FEBRUARY]: "February",
  [PAYROLL_MONTH.MARCH]: "March",
  [PAYROLL_MONTH.APRIL]: "April",
  [PAYROLL_MONTH.MAY]: "May",
  [PAYROLL_MONTH.JUNE]: "June",
  [PAYROLL_MONTH.JULY]: "July",
  [PAYROLL_MONTH.AUGUST]: "August",
  [PAYROLL_MONTH.SEPTEMBER]: "September",
  [PAYROLL_MONTH.OCTOBER]: "October",
  [PAYROLL_MONTH.NOVEMBER]: "November",
  [PAYROLL_MONTH.DECEMBER]: "December",
};

export const BONIFICATION_STATUS_LABELS: Record<BONIFICATION_STATUS, string> = {
  [BONIFICATION_STATUS.NO_BONIFICATION]: "Sem Bonificação",
  [BONIFICATION_STATUS.PARTIAL_BONIFICATION]: "Bonificação Parcial",
  [BONIFICATION_STATUS.FULL_BONIFICATION]: "Bonificação Integral",
  [BONIFICATION_STATUS.SUSPENDED_BONIFICATION]: "Bonificação Suspensa",
};

// =====================
// Statistics Labels
// =====================

export const STATISTICS_GROUP_BY_LABELS: Record<STATISTICS_GROUP_BY, string> = {
  [STATISTICS_GROUP_BY.SECTOR]: "Setor",
  [STATISTICS_GROUP_BY.USER]: "Usuário",
  [STATISTICS_GROUP_BY.CATEGORY]: "Categoria",
  [STATISTICS_GROUP_BY.BRAND]: "Marca",
  [STATISTICS_GROUP_BY.SUPPLIER]: "Fornecedor",
  [STATISTICS_GROUP_BY.ITEM]: "Item",
  [STATISTICS_GROUP_BY.DATE]: "Data",
  [STATISTICS_GROUP_BY.ACTIVITY_REASON]: "Motivo da Atividade",
  [STATISTICS_GROUP_BY.ACTIVITY_OPERATION]: "Operação da Atividade",
};

export const STATISTICS_METRIC_LABELS: Record<STATISTICS_METRIC, string> = {
  [STATISTICS_METRIC.QUANTITY]: "Quantidade",
  [STATISTICS_METRIC.TOTAL_PRICE]: "Preço Total",
  [STATISTICS_METRIC.UNIT_PRICE]: "Preço Unitário",
  [STATISTICS_METRIC.COUNT]: "Contagem",
  [STATISTICS_METRIC.FREQUENCY]: "Frequência",
  [STATISTICS_METRIC.PERCENTAGE]: "Percentual",
  [STATISTICS_METRIC.AVERAGE]: "Medium",
  [STATISTICS_METRIC.SUM]: "Soma",
  [STATISTICS_METRIC.MIN]: "Mínimo",
  [STATISTICS_METRIC.MAX]: "Máximo",
};

export const STATISTICS_PERIOD_LABELS: Record<STATISTICS_PERIOD, string> = {
  [STATISTICS_PERIOD.DAILY]: "Diário",
  [STATISTICS_PERIOD.WEEKLY]: "Semanal",
  [STATISTICS_PERIOD.MONTHLY]: "Mensal",
  [STATISTICS_PERIOD.QUARTERLY]: "Trimestral",
  [STATISTICS_PERIOD.YEARLY]: "Anual",
  [STATISTICS_PERIOD.CUSTOM]: "Personalizado",
  [STATISTICS_PERIOD.LAST_7_DAYS]: "Últimos 7 Dias",
  [STATISTICS_PERIOD.LAST_30_DAYS]: "Últimos 30 Dias",
  [STATISTICS_PERIOD.LAST_90_DAYS]: "Últimos 90 Dias",
  [STATISTICS_PERIOD.LAST_YEAR]: "Último Ano",
  [STATISTICS_PERIOD.THIS_WEEK]: "Esta Semana",
  [STATISTICS_PERIOD.THIS_MONTH]: "Este Mês",
  [STATISTICS_PERIOD.THIS_QUARTER]: "Este Trimestre",
  [STATISTICS_PERIOD.THIS_YEAR]: "Este Ano",
};

// =====================
// Task Quote Labels
// =====================

export const TASK_QUOTE_STATUS_LABELS: Record<TASK_QUOTE_STATUS, string> = {
  [TASK_QUOTE_STATUS.PENDING]: "Pendente",
  [TASK_QUOTE_STATUS.BUDGET_APPROVED]: "Orçamento Aprovado",
  [TASK_QUOTE_STATUS.BILLING_APPROVED]: "Faturamento Aprovado",
  [TASK_QUOTE_STATUS.UPCOMING]: "A Vencer",
  [TASK_QUOTE_STATUS.DUE]: "Vencido",
  [TASK_QUOTE_STATUS.PARTIAL]: "Parcial",
  [TASK_QUOTE_STATUS.SETTLED]: "Liquidado",
  [TASK_QUOTE_STATUS.CANCELLED]: "Cancelado",
};

/**
 * Returns the display label for a task quote based on its status.
 * Before BUDGET_APPROVED → "Orçamento" (budget phase)
 * BUDGET_APPROVED or later → "Faturamento" (billing/invoicing phase)
 */
export function getTaskQuoteDisplayLabel(status?: TASK_QUOTE_STATUS | string | null): string {
  if (!status || status === TASK_QUOTE_STATUS.PENDING) {
    return 'Orçamento';
  }
  return 'Faturamento';
}

/**
 * Returns whether the task quote is in the billing phase (past budget).
 * PENDING or no status → false (budget/orçamento phase)
 * BUDGET_APPROVED or later → true (billing/faturamento phase)
 */
export function isTaskQuoteBillingPhase(status?: TASK_QUOTE_STATUS | string | null): boolean {
  return !!status && status !== TASK_QUOTE_STATUS.PENDING;
}

// =====================
// Reschedule Reason Labels
// =====================

export const RESCHEDULE_REASON_LABELS: Record<RESCHEDULE_REASON, string> = {
  [RESCHEDULE_REASON.CUSTOMER_REQUEST]: "Solicitação do Cliente",
  [RESCHEDULE_REASON.RESOURCE_UNAVAILABLE]: "Recurso Indisponível",
  [RESCHEDULE_REASON.MATERIAL_SHORTAGE]: "Falta de Material",
  [RESCHEDULE_REASON.EQUIPMENT_FAILURE]: "Falha de Equipamento",
  [RESCHEDULE_REASON.WEATHER_CONDITIONS]: "Condições Climáticas",
  [RESCHEDULE_REASON.STAFF_UNAVAILABLE]: "Funcionário Indisponível",
  [RESCHEDULE_REASON.PRIORITY_CHANGE]: "Mudança de Prioridade",
  [RESCHEDULE_REASON.TECHNICAL_ISSUES]: "Problemas Técnicos",
  [RESCHEDULE_REASON.OTHER]: "Outro",
};

// =====================
// Invoice / Billing Labels
// =====================

export const INVOICE_STATUS_LABELS: Record<INVOICE_STATUS, string> = {
  [INVOICE_STATUS.DRAFT]: "Rascunho",
  [INVOICE_STATUS.ACTIVE]: "Ativa",
  [INVOICE_STATUS.PARTIALLY_PAID]: "Parcialmente Paga",
  [INVOICE_STATUS.PAID]: "Paga",
  [INVOICE_STATUS.CANCELLED]: "Cancelada",
};

export const INSTALLMENT_STATUS_LABELS: Record<INSTALLMENT_STATUS, string> = {
  [INSTALLMENT_STATUS.PENDING]: "Pendente",
  [INSTALLMENT_STATUS.PROCESSING]: "Processando",
  [INSTALLMENT_STATUS.PAID]: "Paga",
  [INSTALLMENT_STATUS.OVERDUE]: "Vencida",
  [INSTALLMENT_STATUS.CANCELLED]: "Cancelada",
};

export const BANK_SLIP_STATUS_LABELS: Record<BANK_SLIP_STATUS, string> = {
  [BANK_SLIP_STATUS.CREATING]: "Gerando",
  [BANK_SLIP_STATUS.REGISTERING]: "Registrando",
  [BANK_SLIP_STATUS.ACTIVE]: "Aberto",
  [BANK_SLIP_STATUS.OVERDUE]: "Vencido",
  [BANK_SLIP_STATUS.PAID]: "Pago",
  [BANK_SLIP_STATUS.CANCELLED]: "Cancelado",
  [BANK_SLIP_STATUS.REJECTED]: "Rejeitado",
  [BANK_SLIP_STATUS.ERROR]: "Erro",
};

export const NFSE_STATUS_LABELS: Record<NFSE_STATUS, string> = {
  [NFSE_STATUS.PENDING]: "Pendente",
  [NFSE_STATUS.PROCESSING]: "Processando",
  [NFSE_STATUS.AUTHORIZED]: "Autorizada",
  [NFSE_STATUS.CANCEL_REQUESTED]: "Cancelamento Solicitado",
  [NFSE_STATUS.CANCEL_REJECTED]: "Cancelamento Rejeitado",
  [NFSE_STATUS.CANCELLED]: "Cancelada",
  [NFSE_STATUS.ERROR]: "Erro",
};

// =====================
// Accounting Area — Departamento Pessoal & Medicina do Trabalho
// =====================

export const SALARY_ADJUSTMENT_TYPE_LABELS: Record<SALARY_ADJUSTMENT_TYPE, string> = {
  [SALARY_ADJUSTMENT_TYPE.DISSIDIO_CCT]: "Dissídio (CCT)",
  [SALARY_ADJUSTMENT_TYPE.MERIT]: "Mérito",
  [SALARY_ADJUSTMENT_TYPE.PROMOTION]: "Promoção",
  [SALARY_ADJUSTMENT_TYPE.EQUALIZATION]: "Equiparação Salarial",
  [SALARY_ADJUSTMENT_TYPE.REFRAME]: "Reenquadramento",
  [SALARY_ADJUSTMENT_TYPE.OTHER]: "Outro",
  [SALARY_ADJUSTMENT_TYPE.BONUS]: "Bonificação",
};

// Rótulos CLT-corretos: rebaixamento unilateral é ilegal (CF art.7º VI + CLT
// art.468), então não é ofertado. DEMOTION→Reversão (art.468 §único),
// ADJUSTMENT→Readaptação (art.461 §4º), CORRECTION→Reenquadramento (plano de cargos).
export const POSITION_CHANGE_REASON_LABELS: Record<POSITION_CHANGE_REASON, string> = {
  [POSITION_CHANGE_REASON.ADMISSION]: "Admissão",
  [POSITION_CHANGE_REASON.PROMOTION]: "Promoção",
  [POSITION_CHANGE_REASON.TRANSFER]: "Transferência",
  [POSITION_CHANGE_REASON.DEMOTION]: "Reversão",
  [POSITION_CHANGE_REASON.ADJUSTMENT]: "Readaptação",
  [POSITION_CHANGE_REASON.CORRECTION]: "Reenquadramento",
};

export const BENEFIT_KIND_LABELS: Record<BENEFIT_KIND, string> = {
  [BENEFIT_KIND.TRANSPORT_VOUCHER]: "Vale Transporte",
  [BENEFIT_KIND.MEAL_VOUCHER]: "Vale Refeição",
  [BENEFIT_KIND.FOOD_VOUCHER]: "Vale Alimentação",
  [BENEFIT_KIND.HEALTH_PLAN]: "Plano de Saúde",
  [BENEFIT_KIND.DENTAL_PLAN]: "Plano Odontológico",
  [BENEFIT_KIND.PHARMACY_AGREEMENT]: "Convênio Farmácia",
  [BENEFIT_KIND.PARTNERSHIP]: "Parceria",
  [BENEFIT_KIND.LIFE_INSURANCE]: "Seguro de Vida",
  [BENEFIT_KIND.OTHER]: "Outro",
};

export const BENEFIT_ENROLLMENT_STATUS_LABELS: Record<BENEFIT_ENROLLMENT_STATUS, string> = {
  [BENEFIT_ENROLLMENT_STATUS.ACTIVE]: "Ativa",
  [BENEFIT_ENROLLMENT_STATUS.SUSPENDED]: "Suspensa",
  [BENEFIT_ENROLLMENT_STATUS.OPTED_OUT]: "Optou por Não Receber",
  [BENEFIT_ENROLLMENT_STATUS.TERMINATED]: "Encerrada",
};

export const ADMISSION_STATUS_LABELS: Record<ADMISSION_STATUS, string> = {
  [ADMISSION_STATUS.DOCS_PENDING]: "Documentação Pendente",
  [ADMISSION_STATUS.MEDICAL_EXAM]: "Exame Admissional",
  [ADMISSION_STATUS.CONTRACT]: "Contrato",
  [ADMISSION_STATUS.REGISTRATION]: "Registro",
  [ADMISSION_STATUS.COMPLETED]: "Concluída",
  [ADMISSION_STATUS.CANCELLED]: "Cancelada",
};

export const ADMISSION_DOCUMENT_TYPE_LABELS: Record<ADMISSION_DOCUMENT_TYPE, string> = {
  [ADMISSION_DOCUMENT_TYPE.CPF]: "CPF",
  [ADMISSION_DOCUMENT_TYPE.RG]: "RG",
  [ADMISSION_DOCUMENT_TYPE.CTPS]: "CTPS",
  [ADMISSION_DOCUMENT_TYPE.PROOF_OF_RESIDENCE]: "Comprovante de Residência",
  [ADMISSION_DOCUMENT_TYPE.VOTER_ID]: "Título de Eleitor",
  [ADMISSION_DOCUMENT_TYPE.MILITARY_CERTIFICATE]: "Certificado de Reservista",
  [ADMISSION_DOCUMENT_TYPE.BIRTH_MARRIAGE_CERTIFICATE]: "Certidão de Nascimento/Casamento",
  [ADMISSION_DOCUMENT_TYPE.PHOTO]: "Foto 3x4",
  [ADMISSION_DOCUMENT_TYPE.PIS]: "PIS",
  [ADMISSION_DOCUMENT_TYPE.ADMISSION_EXAM]: "Exame Admissional",
  [ADMISSION_DOCUMENT_TYPE.TRANSPORT_VOUCHER_DECLARATION]: "Declaração de Vale Transporte",
  [ADMISSION_DOCUMENT_TYPE.FAMILY_SALARY_FORM]: "Ficha de Salário Família",
  [ADMISSION_DOCUMENT_TYPE.EMPLOYMENT_CONTRACT]: "Contrato de Trabalho",
  [ADMISSION_DOCUMENT_TYPE.TIME_BANK_AGREEMENT]: "Acordo de Banco de Horas",
  [ADMISSION_DOCUMENT_TYPE.LGPD_TERM]: "Termo LGPD",
  [ADMISSION_DOCUMENT_TYPE.DRIVER_LICENSE]: "CNH",
  [ADMISSION_DOCUMENT_TYPE.OTHER]: "Outro",
};

export const ADMISSION_DOCUMENT_STATUS_LABELS: Record<ADMISSION_DOCUMENT_STATUS, string> = {
  [ADMISSION_DOCUMENT_STATUS.PENDING]: "Pendente",
  [ADMISSION_DOCUMENT_STATUS.RECEIVED]: "Recebido",
  [ADMISSION_DOCUMENT_STATUS.SIGNED]: "Assinado",
  [ADMISSION_DOCUMENT_STATUS.WAIVED]: "Dispensado",
};

export const TERMINATION_TYPE_LABELS: Record<TERMINATION_TYPE, string> = {
  [TERMINATION_TYPE.WITHOUT_CAUSE]: "Dispensa sem justa causa",
  [TERMINATION_TYPE.WITH_CAUSE]: "Dispensa por justa causa",
  [TERMINATION_TYPE.RESIGNATION]: "Pedido de demissão",
  [TERMINATION_TYPE.MUTUAL_AGREEMENT]: "Acordo mútuo (484-A)",
  [TERMINATION_TYPE.EXPERIENCE_END]: "Término do contrato de experiência",
  [TERMINATION_TYPE.EXPERIENCE_EARLY_EMPLOYER]: "Rescisão antecipada da experiência (empregador)",
  [TERMINATION_TYPE.EXPERIENCE_EARLY_EMPLOYEE]: "Rescisão antecipada da experiência (empregado)",
  [TERMINATION_TYPE.INDIRECT]: "Rescisão indireta",
  [TERMINATION_TYPE.DEATH]: "Falecimento",
  [TERMINATION_TYPE.FIXED_TERM_EARLY_EMPLOYEE]: "Rescisão antecipada de contrato a prazo (empregado, art. 480)",
  [TERMINATION_TYPE.INTERMITTENT_END]: "Encerramento de contrato intermitente",
};

export const TERMINATION_STATUS_LABELS: Record<TERMINATION_STATUS, string> = {
  [TERMINATION_STATUS.INITIATED]: "Iniciada",
  [TERMINATION_STATUS.NOTICE_PERIOD]: "Aviso Prévio",
  [TERMINATION_STATUS.DOCUMENTS]: "Documentação",
  [TERMINATION_STATUS.MEDICAL_EXAM]: "Exame Demissional",
  [TERMINATION_STATUS.CALCULATION]: "Cálculo",
  [TERMINATION_STATUS.PAYMENT]: "Pagamento",
  [TERMINATION_STATUS.HOMOLOGATION]: "Homologação",
  [TERMINATION_STATUS.COMPLETED]: "Concluída",
  [TERMINATION_STATUS.CANCELLED]: "Cancelada",
};

export const NOTICE_TYPE_LABELS: Record<NOTICE_TYPE, string> = {
  [NOTICE_TYPE.WORKED]: "Trabalhado",
  [NOTICE_TYPE.INDEMNIFIED]: "Indenizado",
  [NOTICE_TYPE.WAIVED]: "Dispensado",
};

export const NOTICE_REDUCTION_LABELS: Record<NOTICE_REDUCTION, string> = {
  [NOTICE_REDUCTION.NONE]: "Sem redução",
  [NOTICE_REDUCTION.TWO_HOURS_PER_DAY]: "2 horas por dia",
  [NOTICE_REDUCTION.SEVEN_DAYS_OFF]: "7 dias corridos",
};

export const TERMINATION_ITEM_TYPE_LABELS: Record<TERMINATION_ITEM_TYPE, string> = {
  [TERMINATION_ITEM_TYPE.SALARY_BALANCE]: "Saldo de Salário",
  [TERMINATION_ITEM_TYPE.NOTICE_INDEMNIFIED]: "Aviso Prévio Indenizado",
  [TERMINATION_ITEM_TYPE.NOTICE_DISCOUNT]: "Desconto de Aviso Prévio",
  [TERMINATION_ITEM_TYPE.THIRTEENTH_PROPORTIONAL]: "13º Salário Proporcional",
  [TERMINATION_ITEM_TYPE.ACCRUED_VACATION]: "Férias Vencidas (+1/3)",
  [TERMINATION_ITEM_TYPE.PROPORTIONAL_VACATION]: "Férias Proporcionais (+1/3)",
  [TERMINATION_ITEM_TYPE.ART479_INDEMNITY]: "Indenização Art. 479 CLT",
  [TERMINATION_ITEM_TYPE.FGTS_FINE]: "Multa do FGTS",
  [TERMINATION_ITEM_TYPE.ART477_FINE]: "Multa Art. 477 CLT",
  [TERMINATION_ITEM_TYPE.INSS_DISCOUNT]: "Desconto INSS",
  [TERMINATION_ITEM_TYPE.IRRF_DISCOUNT]: "Desconto IRRF",
  [TERMINATION_ITEM_TYPE.ADVANCE_DISCOUNT]: "Desconto de Adiantamento",
  [TERMINATION_ITEM_TYPE.BENEFIT_DISCOUNT]: "Desconto de Benefício",
  [TERMINATION_ITEM_TYPE.OTHER_EARNING]: "Outro Provento",
  [TERMINATION_ITEM_TYPE.OTHER_DISCOUNT]: "Outro Desconto",
};

export const TERMINATION_DOCUMENT_TYPE_LABELS: Record<TERMINATION_DOCUMENT_TYPE, string> = {
  [TERMINATION_DOCUMENT_TYPE.NOTICE_LETTER]: "Carta de Aviso Prévio",
  [TERMINATION_DOCUMENT_TYPE.WARNING_LETTER]: "Carta de Aviso (Justa Causa)",
  [TERMINATION_DOCUMENT_TYPE.TRCT]: "TRCT",
  [TERMINATION_DOCUMENT_TYPE.TERM_484A]: "Termo de Acordo Mútuo (484-A)",
  [TERMINATION_DOCUMENT_TYPE.HOMOLOGATION_TERM]: "Termo de Homologação",
  [TERMINATION_DOCUMENT_TYPE.FGTS_GUIDE]: "Guia do FGTS",
  [TERMINATION_DOCUMENT_TYPE.FGTS_STATEMENT]: "Extrato do FGTS",
  [TERMINATION_DOCUMENT_TYPE.UNEMPLOYMENT_INSURANCE_FORM]: "Requerimento do Seguro-Desemprego",
  [TERMINATION_DOCUMENT_TYPE.DISMISSAL_EXAM]: "Exame Demissional",
  [TERMINATION_DOCUMENT_TYPE.PAYMENT_RECEIPT]: "Comprovante de Pagamento",
  [TERMINATION_DOCUMENT_TYPE.DOCUMENT_DELIVERY_RECEIPT]: "Recibo de Entrega de Documentos",
  [TERMINATION_DOCUMENT_TYPE.MUTUAL_AGREEMENT_TERM]: "Termo de Acordo Mútuo",
  [TERMINATION_DOCUMENT_TYPE.OTHER]: "Outro",
};

export const TERMINATION_DOCUMENT_STATUS_LABELS: Record<TERMINATION_DOCUMENT_STATUS, string> = {
  [TERMINATION_DOCUMENT_STATUS.PENDING]: "Pendente",
  [TERMINATION_DOCUMENT_STATUS.GENERATED]: "Gerado",
  [TERMINATION_DOCUMENT_STATUS.SIGNED]: "Assinado",
  [TERMINATION_DOCUMENT_STATUS.DELIVERED]: "Entregue",
};

export const MEDICAL_EXAM_TYPE_LABELS: Record<MEDICAL_EXAM_TYPE, string> = {
  [MEDICAL_EXAM_TYPE.ADMISSION]: "Admissional",
  [MEDICAL_EXAM_TYPE.PERIODIC]: "Periódico",
  [MEDICAL_EXAM_TYPE.RETURN_TO_WORK]: "Retorno ao Trabalho",
  [MEDICAL_EXAM_TYPE.RISK_CHANGE]: "Mudança de Risco",
  [MEDICAL_EXAM_TYPE.DISMISSAL]: "Demissional",
};

export const MEDICAL_EXAM_STATUS_LABELS: Record<MEDICAL_EXAM_STATUS, string> = {
  [MEDICAL_EXAM_STATUS.SCHEDULED]: "Agendado",
  [MEDICAL_EXAM_STATUS.COMPLETED]: "Realizado",
  [MEDICAL_EXAM_STATUS.EXPIRED]: "Vencido",
  [MEDICAL_EXAM_STATUS.CANCELLED]: "Cancelado",
};

export const MEDICAL_EXAM_RESULT_LABELS: Record<MEDICAL_EXAM_RESULT, string> = {
  [MEDICAL_EXAM_RESULT.PENDING]: "Pendente",
  [MEDICAL_EXAM_RESULT.FIT]: "Apto",
  [MEDICAL_EXAM_RESULT.FIT_WITH_RESTRICTIONS]: "Apto com restrições",
  [MEDICAL_EXAM_RESULT.UNFIT]: "Inapto",
};

// ============================================================================
// Área Andressa — new labels
// ============================================================================

export const INSALUBRITY_DEGREE_LABELS: Record<INSALUBRITY_DEGREE, string> = {
  [INSALUBRITY_DEGREE.NONE]: "Sem insalubridade",
  [INSALUBRITY_DEGREE.MIN]: "Grau mínimo (10%)",
  [INSALUBRITY_DEGREE.MED]: "Grau médio (20%)",
  [INSALUBRITY_DEGREE.MAX]: "Grau máximo (40%)",
};

export const STABILITY_TYPE_LABELS: Record<STABILITY_TYPE, string> = {
  [STABILITY_TYPE.ACCIDENT]: "Acidentária (12 meses)",
  [STABILITY_TYPE.PREGNANCY]: "Gestante",
  [STABILITY_TYPE.UNION]: "Dirigente sindical",
  [STABILITY_TYPE.CIPA]: "Membro da CIPA",
  [STABILITY_TYPE.OTHER]: "Outra",
};

export const INSS_BENEFIT_SPECIES_LABELS: Record<INSS_BENEFIT_SPECIES, string> = {
  [INSS_BENEFIT_SPECIES.B31]: "B31 — Auxílio-doença previdenciário",
  [INSS_BENEFIT_SPECIES.B91]: "B91 — Auxílio-doença acidentário",
  [INSS_BENEFIT_SPECIES.B32]: "B32 — Aposentadoria por invalidez previdenciária",
  [INSS_BENEFIT_SPECIES.B92]: "B92 — Aposentadoria por invalidez acidentária",
  [INSS_BENEFIT_SPECIES.B80]: "B80 — Salário-maternidade",
  [INSS_BENEFIT_SPECIES.B36]: "B36 — Auxílio-acidente",
  [INSS_BENEFIT_SPECIES.OTHER]: "Outra espécie",
};

export const VACATION_STATUS_LABELS: Record<VACATION_STATUS, string> = {
  [VACATION_STATUS.SCHEDULED]: "Agendada",
  [VACATION_STATUS.PAID]: "Paga",
  [VACATION_STATUS.EXPIRED]: "Vencida",
};

export const VACATION_GROUP_TYPE_LABELS: Record<VACATION_GROUP_TYPE, string> = {
  [VACATION_GROUP_TYPE.ALL]: "Toda a empresa",
  [VACATION_GROUP_TYPE.SECTOR]: "Por setor",
  [VACATION_GROUP_TYPE.POSITION]: "Por cargo",
};

export const THIRTEENTH_STATUS_LABELS: Record<THIRTEENTH_STATUS, string> = {
  [THIRTEENTH_STATUS.OPEN]: "Aberto",
  [THIRTEENTH_STATUS.FIRST_PAID]: "1ª parcela paga",
  [THIRTEENTH_STATUS.SECOND_PAID]: "2ª parcela paga",
  [THIRTEENTH_STATUS.PAID]: "Pago",
  [THIRTEENTH_STATUS.CANCELLED]: "Cancelado",
};

export const WORK_ACCIDENT_REPORT_TYPE_LABELS: Record<WORK_ACCIDENT_REPORT_TYPE, string> = {
  [WORK_ACCIDENT_REPORT_TYPE.INITIAL]: "CAT inicial",
  [WORK_ACCIDENT_REPORT_TYPE.REOPENING]: "CAT de reabertura",
  [WORK_ACCIDENT_REPORT_TYPE.DEATH]: "CAT de óbito",
};

export const PAYROLL_DISCOUNT_TYPE_LABELS: Record<PAYROLL_DISCOUNT_TYPE, string> = {
  [PAYROLL_DISCOUNT_TYPE.INSS]: "INSS",
  [PAYROLL_DISCOUNT_TYPE.IRRF]: "IRRF",
  [PAYROLL_DISCOUNT_TYPE.FGTS]: "FGTS",
  [PAYROLL_DISCOUNT_TYPE.ABSENCE]: "Falta",
  [PAYROLL_DISCOUNT_TYPE.PARTIAL_ABSENCE]: "Falta parcial",
  [PAYROLL_DISCOUNT_TYPE.DSR_ABSENCE]: "DSR sobre faltas",
  [PAYROLL_DISCOUNT_TYPE.LATE_ARRIVAL]: "Atraso",
  [PAYROLL_DISCOUNT_TYPE.SICK_LEAVE]: "Afastamento por doença",
  [PAYROLL_DISCOUNT_TYPE.UNION]: "Contribuição sindical",
  [PAYROLL_DISCOUNT_TYPE.ALIMONY]: "Pensão alimentícia",
  [PAYROLL_DISCOUNT_TYPE.GARNISHMENT]: "Penhora/Consignação",
  [PAYROLL_DISCOUNT_TYPE.HEALTH_INSURANCE]: "Plano de saúde",
  [PAYROLL_DISCOUNT_TYPE.DENTAL_INSURANCE]: "Plano odontológico",
  [PAYROLL_DISCOUNT_TYPE.MEAL_VOUCHER]: "Vale-refeição/alimentação",
  [PAYROLL_DISCOUNT_TYPE.TRANSPORT_VOUCHER]: "Vale-transporte",
  [PAYROLL_DISCOUNT_TYPE.LOAN]: "Empréstimo consignado",
  [PAYROLL_DISCOUNT_TYPE.ADVANCE]: "Adiantamento",
  [PAYROLL_DISCOUNT_TYPE.AUTHORIZED_DISCOUNT]: "Desconto autorizado",
  [PAYROLL_DISCOUNT_TYPE.CUSTOM]: "Personalizado",
  [PAYROLL_DISCOUNT_TYPE.FAMILY_ALLOWANCE]: "Salário-família",
  [PAYROLL_DISCOUNT_TYPE.INSALUBRIDADE]: "Adicional de insalubridade",
  [PAYROLL_DISCOUNT_TYPE.PERICULOSIDADE]: "Adicional de periculosidade",
  [PAYROLL_DISCOUNT_TYPE.HABITUAL_GRATIFICATION]: "Gratificação habitual",
};

export const LEAVE_TYPE_LABELS: Record<LEAVE_TYPE, string> = {
  [LEAVE_TYPE.ILLNESS_UP_TO_15]: "Doença (até 15 dias)",
  [LEAVE_TYPE.ILLNESS_INSS]: "Auxílio-Doença (INSS)",
  [LEAVE_TYPE.WORK_ACCIDENT]: "Acidente de Trabalho",
  [LEAVE_TYPE.MATERNITY]: "Licença-Maternidade",
  [LEAVE_TYPE.PATERNITY]: "Licença-Paternidade",
  [LEAVE_TYPE.MARRIAGE]: "Casamento",
  [LEAVE_TYPE.BEREAVEMENT]: "Luto",
  [LEAVE_TYPE.BLOOD_DONATION]: "Doação de Sangue",
  [LEAVE_TYPE.MILITARY]: "Serviço Militar",
  [LEAVE_TYPE.COURT_ATTENDANCE]: "Comparecimento Judicial",
  [LEAVE_TYPE.UNPAID]: "Licença Não Remunerada",
  [LEAVE_TYPE.SUSPENSION]: "Suspensão",
  [LEAVE_TYPE.OTHER]: "Outro",
};

export const LEAVE_STATUS_LABELS: Record<LEAVE_STATUS, string> = {
  [LEAVE_STATUS.SCHEDULED]: "Agendado",
  [LEAVE_STATUS.ACTIVE]: "Em Andamento",
  [LEAVE_STATUS.COMPLETED]: "Concluído",
  [LEAVE_STATUS.CANCELLED]: "Cancelado",
};

export const DEPENDENT_RELATIONSHIP_LABELS: Record<DEPENDENT_RELATIONSHIP, string> = {
  [DEPENDENT_RELATIONSHIP.CHILD]: "Filho(a)",
  [DEPENDENT_RELATIONSHIP.STEPCHILD]: "Enteado(a)",
  [DEPENDENT_RELATIONSHIP.SPOUSE]: "Cônjuge",
  [DEPENDENT_RELATIONSHIP.PARTNER]: "Companheiro(a)",
  [DEPENDENT_RELATIONSHIP.PARENT]: "Pai/Mãe",
  [DEPENDENT_RELATIONSHIP.WARD]: "Tutelado(a)",
  [DEPENDENT_RELATIONSHIP.DISABLED_ANY_AGE]: "Inválido(a) qualquer idade",
  [DEPENDENT_RELATIONSHIP.OTHER]: "Outro",
};

export const ORDER_PAYMENT_STATUS_LABELS: Record<ORDER_PAYMENT_STATUS, string> = {
  [ORDER_PAYMENT_STATUS.PENDING]: "Pagamento Pendente",
  [ORDER_PAYMENT_STATUS.AWAITING_PAYMENT]: "Aguardando Pagamento",
  [ORDER_PAYMENT_STATUS.PARTIALLY_PAID]: "Parcialmente Pago",
  [ORDER_PAYMENT_STATUS.PAID]: "Pago",
};

export const ORDER_INSTALLMENT_STATUS_LABELS: Record<ORDER_INSTALLMENT_STATUS, string> = {
  [ORDER_INSTALLMENT_STATUS.PENDING]: "Pendente",
  [ORDER_INSTALLMENT_STATUS.PARTIALLY_PAID]: "Parcialmente Pago",
  [ORDER_INSTALLMENT_STATUS.PAID]: "Pago",
  [ORDER_INSTALLMENT_STATUS.OVERDUE]: "Vencido",
  [ORDER_INSTALLMENT_STATUS.CANCELLED]: "Cancelado",
};

// =====================
// FISPQ / FDS labels
// =====================

// Short GHS pictogram codes (used as compact badges) + full hazard descriptions.
export const GHS_PICTOGRAM_LABELS: Record<GHS_PICTOGRAM, string> = {
  [GHS_PICTOGRAM.GHS01_EXPLOSIVE]: "GHS01 - Explosivo",
  [GHS_PICTOGRAM.GHS02_FLAMMABLE]: "GHS02 - Inflamável",
  [GHS_PICTOGRAM.GHS03_OXIDIZING]: "GHS03 - Oxidante",
  [GHS_PICTOGRAM.GHS04_GAS_UNDER_PRESSURE]: "GHS04 - Gás sob pressão",
  [GHS_PICTOGRAM.GHS05_CORROSIVE]: "GHS05 - Corrosivo",
  [GHS_PICTOGRAM.GHS06_TOXIC]: "GHS06 - Tóxico",
  [GHS_PICTOGRAM.GHS07_HARMFUL]: "GHS07 - Nocivo / Irritante",
  [GHS_PICTOGRAM.GHS08_HEALTH_HAZARD]: "GHS08 - Perigo à saúde",
  [GHS_PICTOGRAM.GHS09_ENVIRONMENTAL]: "GHS09 - Perigo ao meio ambiente",
};

// Compact codes for table chips (GHS01..GHS09).
export const GHS_PICTOGRAM_CODE_LABELS: Record<GHS_PICTOGRAM, string> = {
  [GHS_PICTOGRAM.GHS01_EXPLOSIVE]: "GHS01",
  [GHS_PICTOGRAM.GHS02_FLAMMABLE]: "GHS02",
  [GHS_PICTOGRAM.GHS03_OXIDIZING]: "GHS03",
  [GHS_PICTOGRAM.GHS04_GAS_UNDER_PRESSURE]: "GHS04",
  [GHS_PICTOGRAM.GHS05_CORROSIVE]: "GHS05",
  [GHS_PICTOGRAM.GHS06_TOXIC]: "GHS06",
  [GHS_PICTOGRAM.GHS07_HARMFUL]: "GHS07",
  [GHS_PICTOGRAM.GHS08_HEALTH_HAZARD]: "GHS08",
  [GHS_PICTOGRAM.GHS09_ENVIRONMENTAL]: "GHS09",
};

export const GHS_SIGNAL_WORD_LABELS: Record<GHS_SIGNAL_WORD, string> = {
  [GHS_SIGNAL_WORD.DANGER]: "Perigo",
  [GHS_SIGNAL_WORD.WARNING]: "Atenção",
};

export const FISPQ_STATUS_LABELS: Record<FISPQ_STATUS, string> = {
  [FISPQ_STATUS.DRAFT]: "Rascunho",
  [FISPQ_STATUS.ACTIVE]: "Vigente",
  [FISPQ_STATUS.EXPIRED]: "Vencida",
  [FISPQ_STATUS.ARCHIVED]: "Arquivada",
};
