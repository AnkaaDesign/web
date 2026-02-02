import {
  CHANGE_LOG_ENTITY_TYPE,
  MEASURE_UNIT_LABELS,
  CHANGE_LOG_ACTION,
  CHANGE_TRIGGERED_BY,
  SHIRT_SIZE_LABELS,
  BOOT_SIZE_LABELS,
  PANTS_SIZE_LABELS,
  SLEEVES_SIZE_LABELS,
  MASK_SIZE_LABELS,
  GLOVES_SIZE_LABELS,
  RAIN_BOOTS_SIZE_LABELS,
} from '@constants';
import { formatDateTime, formatDate } from "./date";
import { formatCurrency } from "./number";
import { formatBrazilianPhone, formatCPF, formatCNPJ, formatChassis } from "./formatters";

// Common field name mapping for all entities
const commonFields: Record<string, string> = {
  // Basic entity fields
  name: "Nome",
  status: "Status",
  description: "Descrição",
  notes: "Notas",
  comments: "Comentários",
  observations: "Observações",
  isActive: "Ativo",
  createdAt: "Criado em",
  updatedAt: "Atualizado em",

  // User-related fields
  userId: "Usuário",
  assignedToUserId: "Atribuído a",
  "user.name": "Nome do Usuário",
  "user.email": "E-mail do Usuário",

  // Common relationships
  supplierId: "Fornecedor",
  categoryId: "Categoria",
  brandId: "Marca",

  // Audit fields
  triggeredBy: "Acionado por",
  reason: "Motivo",
};

// Entity-specific field mappings
const entitySpecificFields: Partial<Record<CHANGE_LOG_ENTITY_TYPE, Record<string, string>>> = {
  [CHANGE_LOG_ENTITY_TYPE.ITEM]: {
    // Basic fields
    name: "Nome",
    quantity: "Quantidade",
    price: "Preço",
    maxQuantity: "Quantidade Máxima",
    measureUnit: "Unidade de Medida",
    measureValue: "Valor da Medida",
    measures: "Medidas",
    barcode: "Código de Barras",
    barcodes: "Códigos de Barras",
    unicode: "Código Único",
    uniCode: "Código Único",

    // PPE fields
    CA: "CA (Certificado de Aprovação)",
    ppeCA: "CA (Certificado de Aprovação)",
    ppeType: "Tipo de EPI",
    ppeSize: "Tamanho do EPI",
    ppeDeliveryMode: "Modo de Entrega de EPI",
    ppeStandardQuantity: "Quantidade Padrão de EPI",
    shouldAssignToUser: "Deve ser Atribuído a Usuário",
    isForEpi: "É EPI",

    // Stock management
    leadTime: "Tempo de Entrega",
    estimatedLeadTime: "Tempo de Entrega Estimado",
    boxQuantity: "Quantidade por Caixa",
    reorderPoint: "Ponto de Reposição",
    reorderQuantity: "Quantidade de Reposição",
    location: "Localização",

    // Financial fields
    icms: "ICMS (%)",
    ipi: "IPI (%)",
    taxrate: "Taxa de Imposto (%)",
    totalPrice: "Preço Total",
    lastPurchasePrice: "Preço da Última Compra",
    averageCost: "Custo Médio",
    unitCost: "Custo Unitário",
    margin: "Margem",
    minimumMargin: "Margem Mínima",
    suggestedPrice: "Preço Sugerido",

    // Analysis fields
    monthlyConsumption: "Consumo Mensal",
    monthlyConsumptionTrendPercent: "Tendência de Consumo (%)",
    abcCategory: "Categoria ABC",
    abcCategoryOrder: "Ordem da Categoria ABC",
    xyzCategory: "Categoria XYZ",
    xyzCategoryOrder: "Ordem da Categoria XYZ",

    // Physical attributes
    weight: "Peso",
    dimensions: "Dimensões",

    // Codes and identifiers
    serialNumber: "Número de Série",
    manufacturerCode: "Código do Fabricante",
    supplierCode: "Código do Fornecedor",
    sku: "SKU",
    ean: "EAN",
    ncm: "NCM",

    // Dates and warranty
    warranty: "Garantia",
    warrantyPeriod: "Período de Garantia",
    expirationDate: "Data de Validade",
    manufacturingDate: "Data de Fabricação",
    lastPurchaseDate: "Data da Última Compra",

    // Status and relationships
    isActive: "Ativo",
    relatedItems: "Itens Relacionados",
    relatedItemIds: "Itens Relacionados",
    relatedTo: "Relacionado a",
  },
  [CHANGE_LOG_ENTITY_TYPE.ITEM_CATEGORY]: {
    isPpe: "É EPI",
    "category.isPpe": "Categoria é EPI",
  },
  [CHANGE_LOG_ENTITY_TYPE.ITEM_BRAND]: {
    "brand.name": "Nome da Marca",
  },
  [CHANGE_LOG_ENTITY_TYPE.ORDER]: {
    orderId: "ID do Pedido",
    orderItemId: "ID do Item do Pedido",
    totalAmount: "Valor Total",
    scheduledFor: "Agendado para",
    deliveryDate: "Data de Entrega",
    receivedDate: "Data de Recebimento",
    forecast: "Previsão",
    status: "Status",
    status_transition: "Status",
    statusOrder: "Ordem do Status",
    budgetIds: "Orçamentos",
    invoiceIds: "Notas Fiscais",
    receiptIds: "Recibos",
    supplierId: "Fornecedor",
    orderScheduleId: "Agendamento do Pedido",
    orderRuleId: "Regra do Pedido",
    ppeScheduleId: "Agendamento de EPI",
    notes: "Observações",
    doneAt: "Concluído em",
    "supplier.name": "Nome do Fornecedor",
    "supplier.fantasyName": "Nome Fantasia do Fornecedor",
    "budget.filename": "Nome do Orçamento",
    "nfe.filename": "Nome da NFe",
    "receipt.filename": "Nome do Recibo",
  },
  [CHANGE_LOG_ENTITY_TYPE.ORDER_ITEM]: {
    orderId: "Pedido",
    itemId: "Item",
    orderedQuantity: "Quantidade Pedida",
    receivedQuantity: "Quantidade Recebida",
    price: "Preço Unitário",
    icms: "ICMS (%)",
    ipi: "IPI (%)",
    receivedAt: "Recebido em",
    fulfilledAt: "Cumprido em",
    notes: "Observações do Item",
    "item.name": "Nome do Item",
    "item.sku": "SKU do Item",
    "item.unicode": "Código do Item",
    "item.uniCode": "Código do Item",
    "item.barcode": "Código de Barras do Item",
    "order.description": "Descrição do Pedido",
    "order.status": "Status do Pedido",
    totalPrice: "Valor Total",
  },
  [CHANGE_LOG_ENTITY_TYPE.USER]: {
    // Basic information
    name: "Nome",
    email: "E-mail",
    phone: "Telefone",
    cpf: "CPF",
    pis: "PIS",
    payrollNumber: "Número da Folha",
    birth: "Data de Nascimento",

    // Address fields
    address: "Endereço",
    addressNumber: "Número",
    addressComplement: "Complemento",
    neighborhood: "Bairro",
    city: "Cidade",
    state: "Estado",
    zipCode: "CEP",
    site: "Site",

    // Organizational fields
    position: "Cargo",
    positionId: "Cargo",
    sector: "Setor",
    sectorId: "Setor",
    managedSector: "Setor Gerenciado",
    performanceLevel: "Nível de Desempenho",

    // Status and employment
    status: "Status",
    statusOrder: "Ordem do Status",
    isActive: "Ativo",
    admissional: "Data de Admissão",
    effectedAt: "Data de Contratação",
    exp1StartAt: "Início da Experiência 1",
    exp1EndAt: "Fim da Experiência 1",
    exp2StartAt: "Início da Experiência 2",
    exp2EndAt: "Fim da Experiência 2",
    dismissedAt: "Data de Demissão",

    // Security and verification
    verified: "Verificado",
    requirePasswordChange: "Requer Mudança de Senha",
    password: "Senha",
    verificationCode: "Código de Verificação",
    verificationExpiresAt: "Expiração da Verificação",
    verificationType: "Tipo de Verificação",
    sessionToken: "Token de Sessão",
    lastLoginAt: "Último Login",

    // External integrations
    secullumId: "ID Secullum",
    preferenceId: "ID de Preferências",
    avatarId: "Avatar",

    // PPE size fields
    "ppeSize.shirts": "Tamanho de Camiseta",
    "ppeSize.boots": "Tamanho de Botas",
    "ppeSize.pants": "Tamanho de Calças",
    "ppeSize.shorts": "Tamanho de Bermudas",
    "ppeSize.sleeves": "Tamanho de Mangas",
    "ppeSize.mask": "Tamanho de Máscara",
    "ppeSize.gloves": "Tamanho de Luvas",
    "ppeSize.rainBoots": "Tamanho de Galochas",

    // Legacy/computed fields
    isExternal: "É Externo",
  },
  [CHANGE_LOG_ENTITY_TYPE.TASK]: {
    name: "Nome",
    status: "Status",
    statusOrder: "Ordem do Status",
    serialNumber: "Número de Série",
    chassisNumber: "Número do Chassi",
    plate: "Placa",
    details: "Detalhes",
    entryDate: "Data de Entrada",
    term: "Prazo",
    startedAt: "Iniciado em",
    finishedAt: "Finalizado em",
    forecastDate: "Data de Previsão",
    paintId: "Tinta",
    commission: "Comissão",
    bonusDiscountId: "Desconto Bônus",
    customerId: "Cliente",
    invoiceToId: "Faturar Para",
    sectorId: "Setor",
    createdById: "Criado por",
    budgetIds: "Orçamentos",
    invoiceIds: "Notas Fiscais",
    receiptIds: "Recibos",
    generalPainting: "Pintura Geral",
    observationId: "Observação",
    truckId: "Caminhão",
    negotiatingWith: "Negociando Com",
    // Relationship fields
    sector: "Setor",
    customer: "Cliente",
    invoiceTo: "Faturar Para",
    budget: "Orçamento",
    nfe: "Nota Fiscal",
    receipt: "Recibo",
    paint: "Tinta",
    observation: "Observação",
    truck: "Caminhão",
    createdBy: "Criado por",
    artworks: "Artes",
    artworkIds: "Artes",
    baseFiles: "Arquivos Base",
    baseFileIds: "Arquivos Base",
    logoPaints: "Tintas da Logomarca",
    logoPaintIds: "Tintas da Logomarca",
    paints: "Tintas da logomarca",
    groundPaints: "Fundos da Tinta",
    layouts: "Layouts do Veículo",
    commissions: "Comissões",
    services: "Serviços", // Legacy - for historical changelog records
    serviceOrders: "Ordens de Serviço",
    pricingId: "Orçamento",
    airbrushings: "Aerografias",
    cuts: "Recortes",
    cutRequest: "Solicitações de Corte",
    cutPlan: "Planos de Corte",
    relatedTasks: "Tarefas Relacionadas",
    relatedTo: "Relacionado a",
    trucks: "Caminhões",
    representatives: "Representantes",
    representativeIds: "Representantes",
    // Direct truck fields (when truck data is embedded in task changelog)
    category: "Categoria do Caminhão",
    implementType: "Tipo de Implemento",
    // Nested relationship fields
    "customer.fantasyName": "Nome Fantasia do Cliente",
    "customer.corporateName": "Razão Social do Cliente",
    "customer.cnpj": "CNPJ do Cliente",
    "invoiceTo.fantasyName": "Nome Fantasia (Faturar Para)",
    "invoiceTo.corporateName": "Razão Social (Faturar Para)",
    "invoiceTo.cnpj": "CNPJ (Faturar Para)",
    "negotiatingWith.name": "Responsável pela Negociação",
    "negotiatingWith.phone": "Telefone do Responsável",
    "sector.name": "Nome do Setor",
    "createdBy.name": "Nome do Criador",
    "budget.filename": "Nome do Orçamento",
    "nfe.filename": "Nome da NFe",
    "receipt.filename": "Nome do Recibo",
    "paint.name": "Nome da Tinta",
    "observation.content": "Conteúdo da Observação",
    "observation.type": "Tipo da Observação",
    "truck.plate": "Placa do Caminhão",
    "truck.model": "Modelo do Caminhão",
    "truck.manufacturer": "Fabricante do Caminhão",
  },
  [CHANGE_LOG_ENTITY_TYPE.SUPPLIER]: {
    // Basic information
    corporateName: "Razão Social",
    fantasyName: "Nome Fantasia",
    cnpj: "CNPJ",
    email: "E-mail",
    phone: "Telefone",
    phones: "Telefones",
    site: "Site",

    // Address fields
    streetType: "Tipo de Logradouro",
    address: "Endereço",
    addressNumber: "Número",
    addressComplement: "Complemento",
    number: "Número",
    complement: "Complemento",
    neighborhood: "Bairro",
    city: "Cidade",
    state: "Estado",
    zipCode: "CEP",

    // Additional fields
    tags: "Tags",
    logoId: "Logo",
    logo: "Logo",

    // Legacy fields (may exist in old data)
    representativeName: "Nome do Representante",
    country: "País",
    observations: "Observações",
    statusOrder: "Ordem do Status",
  },
  [CHANGE_LOG_ENTITY_TYPE.PPE_DELIVERY]: {
    ppeConfigId: "ID da Configuração de EPI",
    ppeDeliveryId: "ID da Entrega de EPI",
    ppeScheduleId: "Agendamento de EPI",
    userId: "Funcionário",
    itemId: "Item de EPI",
    quantity: "Quantidade",
    status: "Status",
    statusOrder: "Ordem do Status",
    scheduledDate: "Data Agendada",
    actualDeliveryDate: "Data de Entrega",
    deliveryDate: "Data de Entrega",
    reviewedBy: "Aprovado por",
    observation: "Observação",
    expirationDate: "Data de Validade",
    ppe_info: "Informações do EPI",
    delivery_completed: "Entrega Concluída",
    batch_approval: "Aprovação em Lote",
    batch_rejection: "Rejeição em Lote",
    batch_mark_delivered: "Entrega em Lote",
    reschedule: "Reagendamento",
    auto_creation_error: "Erro na Criação Automática",
    auto_schedule_update: "Atualização Automática do Agendamento",
    // Nested relationship fields
    "user.name": "Nome do Funcionário",
    "item.name": "Nome do Item",
    "item.ppeType": "Tipo de EPI",
    "item.ppeSize": "Tamanho do EPI",
    "reviewedByUser.name": "Nome do Aprovador",
    "ppeSchedule.frequency": "Frequência do Agendamento",
  },
  [CHANGE_LOG_ENTITY_TYPE.PPE_CONFIG]: {
    itemId: "Item",
    ppeType: "Tipo de EPI",
    requiredQuantity: "Quantidade Necessária",
    validityDays: "Dias de Validade",
    size: "Tamanho",
    // Nested relationship fields
    "item.name": "Nome do Item",
  },
  [CHANGE_LOG_ENTITY_TYPE.PPE_SIZE]: {
    userId: "Funcionário",
    shirts: "Tamanho de Camisa",
    pants: "Tamanho de Calça",
    shorts: "Tamanho de Bermuda",
    boots: "Tamanho de Bota",
    sleeves: "Tamanho de Manga",
    mask: "Tamanho de Máscara",
    gloves: "Tamanho de Luva",
    rainBoots: "Tamanho de Bota de Chuva",
    // Nested relationship fields
    "user.name": "Nome do Funcionário",
  },
  [CHANGE_LOG_ENTITY_TYPE.PPE_DELIVERY_SCHEDULE]: {
    userId: "Funcionário",
    itemId: "Item",
    categoryId: "Categoria",
    quantity: "Quantidade",
    frequency: "Frequência",
    frequencyCount: "Contagem de Frequência",
    isActive: "Ativo",
    nextRun: "Próxima Execução",
    lastRun: "Última Execução",
    assignmentType: "Tipo de Atribuição",
    excludedUserIds: "Usuários Excluídos",
    includedUserIds: "Usuários Incluídos",
    items: "Itens de EPI", // PpeScheduleItem relation
    ppeItems: "Itens de EPI", // Legacy JSON field - for old changelog entries
    weeklyConfigId: "Configuração Semanal",
    monthlyConfigId: "Configuração Mensal",
    yearlyConfigId: "Configuração Anual",
    dayOfWeek: "Dia da Semana",
    dayOfMonth: "Dia do Mês",
    month: "Mês",
    // Nested relationship fields
    "user.name": "Nome do Funcionário",
    "item.name": "Nome do Item",
    "category.name": "Nome da Categoria",
  },
  [CHANGE_LOG_ENTITY_TYPE.ACTIVITY]: {
    itemId: "Item",
    userId: "Usuário",
    orderId: "Pedido",
    orderItemId: "Item do Pedido",
    quantity: "Quantidade",
    operation: "Tipo de Operação",
    operationType: "Tipo de Operação",
    reason: "Motivo",
    description: "Descrição",
    // Nested fields
    "item.name": "Nome do Item",
    "item.uniCode": "Código do Item",
    "user.name": "Nome do Usuário",
    "order.description": "Descrição do Pedido",
  },
  [CHANGE_LOG_ENTITY_TYPE.EXTERNAL_WITHDRAWAL]: {
    withdrawerName: "Nome do Retirador",
    withdrawerDocument: "Documento do Retirador",
    withdrawerContact: "Contato do Retirador",
    willReturn: "Vai Devolver",
    status: "Status",
    status_transition: "Status",
    statusOrder: "Ordem do Status",
    invoiceIds: "Notas Fiscais Eletrônicas",
    receiptIds: "Recibos",
    budgetIds: "Orçamentos",
    notes: "Observações",
    totalPrice: "Valor Total",
    withdrawalDate: "Data da Retirada",
    actualReturnDate: "Data Real de Devolução",
    totalValue: "Valor Total",
    isPaid: "Pago",
    paymentDate: "Data de Pagamento",
    withdrawalType: "Tipo de Retirada",
    responsibleUserId: "Responsável",
    reason: "Motivo",
    items: "Itens",
    "nfe.filename": "Nome da NFe",
    "receipt.filename": "Nome do Recibo",
    "budget.filename": "Nome do Orçamento",
    "responsibleUser.name": "Nome do Responsável",
  },
  [CHANGE_LOG_ENTITY_TYPE.EXTERNAL_WITHDRAWAL_ITEM]: {
    externalWithdrawalId: "Retirada Externa",
    itemId: "Item",
    withdrawedQuantity: "Quantidade Retirada",
    returnedQuantity: "Quantidade Devolvida",
    price: "Preço Unitário",
    unitPrice: "Preço Unitário",
    totalPrice: "Preço Total",
    icms: "ICMS (%)",
    ipi: "IPI (%)",
    discount: "Desconto",
    notes: "Observações",
    condition: "Condição",
    serialNumber: "Número de Série",
    batchNumber: "Número do Lote",
    expirationDate: "Data de Validade",
    location: "Localização",
    isDefective: "Defeituoso",
    defectDescription: "Descrição do Defeito",
    "item.name": "Nome do Item",
    "item.sku": "SKU do Item",
    "item.barcode": "Código de Barras do Item",
    "item.unicode": "Código Único do Item",
    "item.uniCode": "Código Único do Item",
    "externalWithdrawal.withdrawerName": "Nome do Retirador",
  },
  [CHANGE_LOG_ENTITY_TYPE.POSITION]: {
    name: "Nome",
    level: "Nível",
    sectorId: "Setor",
    privileges: "Privilégios",
    commissionEligible: "Elegível para Comissão",
    maxAllowedVacationDays: "Dias Máximos de Férias",
    remuneration: "Remuneração",
    sector: "Setor",
    "sector.name": "Nome do Setor",
  },
  [CHANGE_LOG_ENTITY_TYPE.SECTOR]: {
    name: "Nome",
    privileges: "Privilégios",
    users: "Usuários",
    positions: "Cargos",
    tasks: "Tarefas",
  },
  [CHANGE_LOG_ENTITY_TYPE.MAINTENANCE]: {
    type: "Tipo",
    truckId: "Caminhão",
    mechanicId: "Mecânico",
    scheduledFor: "Agendado para",
    startedAt: "Iniciado em",
    finishedAt: "Finalizado em",
    completedAt: "Concluído em",
    timeTaken: "Tempo gasto",
    cost: "Custo",
    maintenanceScheduleId: "Cronograma de Manutenção",
    itemId: "Equipamento",
    item: "Equipamento",
    truck: "Caminhão",
    mechanic: "Mecânico",
    maintenanceSchedule: "Cronograma",
    itemsNeeded: "Itens necessários",
    // Nested fields
    "truck.plate": "Placa do Caminhão",
    "truck.model": "Modelo do Caminhão",
    "truck.manufacturer": "Fabricante do Caminhão",
    "mechanic.name": "Nome do Mecânico",
    "item.name": "Nome do Equipamento",
    "maintenanceSchedule.name": "Nome do Cronograma",
  },
  [CHANGE_LOG_ENTITY_TYPE.MAINTENANCE_ITEM]: {
    maintenanceId: "Manutenção",
    itemId: "Item",
    quantity: "Quantidade",
    price: "Preço Unitário",
    totalPrice: "Preço Total",
    maintenance: "Manutenção",
    item: "Item",
    // Nested fields
    "maintenance.name": "Nome da Manutenção",
    "maintenance.type": "Tipo de Manutenção",
    "item.name": "Nome do Item",
    "item.sku": "SKU do Item",
    "item.barcode": "Código de Barras do Item",
    "item.unicode": "Código Único do Item",
    "item.uniCode": "Código Único do Item",
  },
  [CHANGE_LOG_ENTITY_TYPE.VACATION]: {
    userId: "Funcionário",
    startAt: "Data de Início",
    endAt: "Data de Término",
    status: "Status",
    statusOrder: "Ordem do Status",
    type: "Tipo",
    typeOrder: "Ordem do Tipo",
    isCollective: "É Coletiva",
    approvedBy: "Aprovado por",
    approvedAt: "Aprovado em",
    rejectedBy: "Rejeitado por",
    rejectedAt: "Rejeitado em",
    cancelledBy: "Cancelado por",
    cancelledAt: "Cancelado em",
    observation: "Observação",
    statusTransition: "Transição de Status",
    // Nested relationship fields
    "user.name": "Nome do Funcionário",
    "user.cpf": "CPF do Funcionário",
    "user.position.name": "Cargo do Funcionário",
    "approvedByUser.name": "Nome do Aprovador",
    "rejectedByUser.name": "Nome do Rejeitador",
    "cancelledByUser.name": "Nome do Cancelador",
  },
  [CHANGE_LOG_ENTITY_TYPE.PRICE]: {
    itemId: "Item",
    value: "Valor",
    icms: "ICMS (%)",
    ipi: "IPI (%)",
    // Nested relationship fields
    "item.name": "Nome do Item",
    "item.sku": "SKU do Item",
    "item.unicode": "Código do Item",
    "item.uniCode": "Código do Item",
    "item.barcode": "Código de Barras do Item",
  },
  [CHANGE_LOG_ENTITY_TYPE.HOLIDAY]: {
    name: "Nome",
    date: "Data",
    type: "Tipo",
    description: "Descrição",
    isRecurring: "É Recorrente",
    isNational: "É Nacional",
    isOptional: "É Opcional",
    // Nested relationship fields
    "user.name": "Nome do Usuário",
  },
  [CHANGE_LOG_ENTITY_TYPE.CUSTOMER]: {
    // Basic information
    fantasyName: "Nome Fantasia",
    corporateName: "Razão Social",
    cnpj: "CNPJ",
    cpf: "CPF",
    email: "E-mail",
    phone: "Telefone",
    phones: "Telefones",
    site: "Site",
    tags: "Tags",

    // Address fields
    streetType: "Tipo de Logradouro",
    address: "Endereço",
    addressNumber: "Número",
    addressComplement: "Complemento",
    neighborhood: "Bairro",
    city: "Cidade",
    state: "Estado",
    zipCode: "CEP",

    // Additional fields
    logoId: "Logo",
    economicActivityId: "Atividade Econômica",
    registrationStatus: "Situação Cadastral",

    // Nested relationship fields
    "logo.filename": "Nome do Logo",
    "tasks.length": "Quantidade de Tarefas",
    "economicActivity.description": "Descrição da Atividade Econômica",
  },
  [CHANGE_LOG_ENTITY_TYPE.PAINT]: {
    name: "Nome",
    code: "Código",
    type: "Tipo",
    brand: "Marca",
    finish: "Acabamento",
    color: "Cor",
    hexColor: "Cor Hexadecimal",
    manufacturer: "Fabricante",
    productLine: "Linha de Produto",
    isActive: "Ativo",
    notes: "Observações",
    formulas: "Fórmulas",
    paintGrounds: "Fundos da Tinta",
    groundPaints: "Fundos da Tinta",
    // Nested relationship fields
    "formulas.length": "Quantidade de Fórmulas",
  },
  [CHANGE_LOG_ENTITY_TYPE.PAINT_FORMULA]: {
    description: "Descrição",
    paintId: "Tinta",
    density: "Densidade (g/ml)",
    pricePerLiter: "Preço por Litro",
    viscosity: "Viscosidade",
    isActive: "Ativo",
    code: "Código",
    type: "Tipo",
    notes: "Observações",
    components: "Componentes",
    productions: "Produções",
    formulas: "Fórmulas",
    // Nested relationship fields
    "paint.name": "Nome da Tinta",
    "paint.code": "Código da Tinta",
    "components.length": "Quantidade de Componentes",
    "productions.length": "Quantidade de Produções",
  },
  [CHANGE_LOG_ENTITY_TYPE.PAINT_FORMULA_COMPONENT]: {
    formulaPaintId: "Fórmula",
    itemId: "Item",
    ratio: "Proporção (%)",
    quantity: "Quantidade",
    weight: "Peso (g)",
    volume: "Volume (ml)",
    // Nested relationship fields
    "item.name": "Nome do Item",
    "item.sku": "SKU do Item",
    "item.barcode": "Código de Barras do Item",
    "formulaPaint.description": "Descrição da Fórmula",
  },
  [CHANGE_LOG_ENTITY_TYPE.PAINT_PRODUCTION]: {
    formulaId: "Fórmula",
    weight: "Peso (g)",
    volumeLiters: "Volume (L)",
    batchCode: "Código do Lote",
    productionDate: "Data de Produção",
    notes: "Observações",
    cost: "Custo",
    componentImpact: "Impacto nos Componentes",
    // Nested relationship fields
    "formula.description": "Descrição da Fórmula",
    "formula.paint.name": "Nome da Tinta",
    "formula.paint.code": "Código da Tinta",
  },
  [CHANGE_LOG_ENTITY_TYPE.TRUCK]: {
    width: "Largura",
    height: "Altura",
    length: "Comprimento",
    xPosition: "Posição X",
    yPosition: "Posição Y",
    taskId: "Tarefa",
    garageId: "Garagem",
    spot: "Localização",
    category: "Categoria",
    implementType: "Tipo de Implemento",
    vehicle_movement: "Movimentação de Veículo",
    parking_position: "Posição de Estacionamento",
    // Related task fields
    "task.name": "Nome da Tarefa",
    "task.serialNumber": "Número de Série",
    "task.status": "Status da Tarefa",
    // Truck fields (accessed via truck relation)
    plate: "Placa",
    chassisNumber: "Número do Chassi",
    // Related garage fields
    "garage.name": "Nome da Garagem",
  },
  [CHANGE_LOG_ENTITY_TYPE.LAYOUT]: {
    height: "Altura",
    photoId: "Foto",
    leftSideLayoutId: "Layout Lateral Esquerdo",
    rightSideLayoutId: "Layout Lateral Direito",
    backSideLayoutId: "Layout Traseiro",
    // Nested fields
    "photo.name": "Nome da Foto",
    "photo.path": "Caminho da Foto",
  },
  [CHANGE_LOG_ENTITY_TYPE.CUT]: {
    type: "Tipo",
    fileId: "Arquivo",
    taskId: "Tarefa",
    origin: "Origem",
    reason: "Motivo",
    parentCutId: "Corte Pai",
    status: "Status",
    statusOrder: "Ordem do Status",
    startedAt: "Iniciado em",
    completedAt: "Concluído em",
    // Nested relationship fields
    "file.filename": "Nome do Arquivo",
    "task.serialNumber": "Número de Série da Tarefa",
    "task.title": "Título da Tarefa",
    "parentCut.id": "ID do Corte Pai",
  },
  [CHANGE_LOG_ENTITY_TYPE.FILE]: {
    filename: "Nome do Arquivo",
    originalName: "Nome Original",
    mimetype: "Tipo de Arquivo",
    path: "Caminho",
    size: "Tamanho",
    thumbnailUrl: "URL da Miniatura",
    // Relationship fields
    tasksArtworks: "Artes das Tarefas",
    customerLogo: "Logo do Cliente",
    supplierLogo: "Logo do Fornecedor",
    observations: "Observações",
    warning: "Avisos",
    taskBudgets: "Orçamentos de Tarefas",
    taskInvoices: "Notas Fiscais de Tarefas",
    taskReceipts: "Recibos de Tarefas",
    orderBudgets: "Orçamentos de Pedidos",
    orderInvoices: "Notas Fiscais de Pedidos",
    orderReceipts: "Recibos de Pedidos",
    airbrushingReceipts: "Recibos de Aerografia",
    airbrushingInvoices: "Notas Fiscais de Aerografia",
    externalWithdrawalInvoices: "Notas Fiscais de Retirada Externa",
    externalWithdrawalReceipts: "Recibos de Retirada Externa",
  },
  [CHANGE_LOG_ENTITY_TYPE.NOTIFICATION]: {
    title: "Título",
    body: "Conteúdo",
    type: "Tipo",
    importance: "Importância",
    actionUrl: "URL de Ação",
    actionType: "Tipo de Ação",
    sentAt: "Enviado em",
    scheduledAt: "Agendado para",
    channel: "Canais",
    userId: "Usuário",
    readStatus: "Status de Leitura",
    seenBy: "Visto por",
    // Nested relationship fields
    "user.name": "Nome do Usuário",
    "user.email": "E-mail do Usuário",
  },
  [CHANGE_LOG_ENTITY_TYPE.SEEN_NOTIFICATION]: {
    notificationId: "Notificação",
    userId: "Usuário",
    seenAt: "Visto em",
    // Nested relationship fields
    "notification.title": "Título da Notificação",
    "user.name": "Nome do Usuário",
  },
  [CHANGE_LOG_ENTITY_TYPE.SERVICE]: {
    name: "Nome",
    price: "Preço",
    description: "Descrição",
    status: "Status",
    statusOrder: "Ordem do Status",
  },
  [CHANGE_LOG_ENTITY_TYPE.SERVICE_ORDER]: {
    type: "Tipo",
    status: "Status",
    statusOrder: "Ordem do Status",
    description: "Descrição",
    observation: "Observação",
    taskId: "Tarefa",
    assignedToId: "Atribuído a",
    createdById: "Criado por",
    startedById: "Iniciado por",
    approvedById: "Aprovado por",
    completedById: "Concluído por",
    startedAt: "Iniciado em",
    approvedAt: "Aprovado em",
    finishedAt: "Finalizado em",
    completedAt: "Concluído em",
    userId: "Responsável",
    notes: "Observações",
    // Nested relationship fields
    "task.name": "Nome da Tarefa",
    "task.serialNumber": "Número de Série da Tarefa",
    "user.name": "Nome do Responsável",
    "assignedTo.name": "Nome do Responsável",
    "createdBy.name": "Nome do Criador",
    "startedBy.name": "Nome de quem Iniciou",
    "approvedBy.name": "Nome de quem Aprovou",
    "completedBy.name": "Nome de quem Concluiu",
  },
  [CHANGE_LOG_ENTITY_TYPE.TIME_CLOCK_ENTRY]: {
    userId: "Funcionário",
    date: "Data",
    entry1: "Entrada 1",
    exit1: "Saída 1",
    entry2: "Entrada 2",
    exit2: "Saída 2",
    entry3: "Entrada 3",
    exit3: "Saída 3",
    entry4: "Entrada 4",
    exit4: "Saída 4",
    entry5: "Entrada 5",
    exit5: "Saída 5",
    dayType: "Tipo do Dia",
    compensated: "Compensado",
    neutral: "Neutro",
    dayOff: "Folga",
    freeLunch: "Almoço Livre",
    source: "Origem",
    deviceId: "ID do Dispositivo",
    hasPhoto: "Tem Foto",
    synced: "Sincronizado",
    secullumSyncStatus: "Status de Sincronização",
    secullumRecordId: "ID do Registro Secullum",
    syncAttempts: "Tentativas de Sincronização",
    lastSyncError: "Último Erro de Sincronização",
    latitude: "Latitude",
    longitude: "Longitude",
    accuracy: "Precisão",
    address: "Endereço",
    // Nested relationship fields
    "user.name": "Nome do Funcionário",
    "user.cpf": "CPF do Funcionário",
    "user.position.name": "Cargo do Funcionário",
    "user.sector.name": "Setor do Funcionário",
  },
  // Add more entity-specific mappings as needed
};

/**
 * Get the display label for a field name
 * @param field - The field name
 * @param entityType - The entity type for context-specific labels
 * @returns The display label for the field
 */
export function getFieldLabel(field: string | null, entityType: CHANGE_LOG_ENTITY_TYPE): string {
  if (!field) return "";

  // Try entity-specific fields first, then common fields
  const entityFields = entitySpecificFields[entityType] || {};
  return entityFields[field] || commonFields[field] || field;
}

// Define a flexible type for field values that can handle the complexity of this function
type ComplexFieldValue = unknown;

// Define metadata type
interface FieldMetadata {
  fieldType?: string;
  [key: string]: unknown;
}

/**
 * Format a field value for display based on field type and entity context
 * @param value - The value to format
 * @param field - The field name (optional)
 * @param entityType - The entity type for context-specific formatting (optional)
 * @param metadata - Optional metadata for additional context
 * @returns The formatted value as a string
 */
export function formatFieldValue(value: ComplexFieldValue, field?: string | null, entityType?: CHANGE_LOG_ENTITY_TYPE, metadata?: FieldMetadata): string {
  // Handle null/undefined commission field specifically
  if ((value === null || value === undefined) && field === "commission" && entityType === CHANGE_LOG_ENTITY_TYPE.TASK) {
    return "Não Definida";
  }

  if (value === null || value === undefined) return "Nenhum";

  // First, try to parse JSON-encoded strings (double-encoded values from backend)
  if (typeof value === "string") {
    // Check if it's a JSON-encoded string (starts and ends with quotes)
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      try {
        value = JSON.parse(value);
      } catch (e) {
        // Not a valid JSON string, continue with the original value
      }
    }
  }

  // Parse string numbers for specific numeric fields
  if (typeof value === "string" && field) {
    const numericFields = [
      "pricePerLiter", "density", "price", "totalPrice", "unitCost", "averageCost",
      "lastPurchasePrice", "suggestedPrice", "totalAmount", "remuneration", "cost",
      "icms", "ipi", "margin", "minimumMargin", "monthlyConsumptionTrendPercent", "ratio",
      "quantity", "maxQuantity", "boxQuantity", "reorderPoint", "reorderQuantity",
      "orderedQuantity", "receivedQuantity", "withdrawedQuantity", "returnedQuantity",
      "viscosity", "weight", "volume", "volumeLiters", "timeTaken"
    ];

    if (numericFields.includes(field)) {
      const parsed = parseFloat(value);
      if (!isNaN(parsed)) {
        value = parsed;
      }
    }
  }

  // Special handling for item returned quantity from metadata
  if (metadata?.fieldType === "item_returned_quantity" && typeof value === "number") {
    return `${value.toLocaleString("pt-BR")} un`;
  }

  // Handle boolean values
  if (typeof value === "boolean") {
    return value ? "Sim" : "Não";
  }

  // Handle arrays
  if (Array.isArray(value)) {
    if (value.length === 0) return "Nenhum";
    if (field === "barcodes" || field === "barcode") {
      const stringValues = (value as string[]).filter(Boolean);
      if (stringValues.length > 3) {
        return `${stringValues.slice(0, 3).join(", ")} e mais ${stringValues.length - 3}`;
      }
      return stringValues.join(", ");
    }
    if (field === "phones") {
      // Format phones array with Brazilian phone formatting
      const formattedPhones = (value as string[]).filter((phone) => phone && String(phone).trim() !== "").map((phone) => formatBrazilianPhone(String(phone)));

      if (formattedPhones.length === 0) return "Nenhum";
      if (formattedPhones.length > 3) {
        return `${formattedPhones.slice(0, 3).join(", ")} e mais ${formattedPhones.length - 3}`;
      }
      return formattedPhones.join(", ");
    }
    if (field === "relatedItemIds") {
      return `${value.length} ${value.length === 1 ? "item relacionado" : "itens relacionados"}`;
    }
    if (field === "tags") {
      return value.join(", ");
    }
    if (field === "measures" && Array.isArray(value)) {
      // Format measures array
      const formattedMeasures = value.map((measure: Record<string, unknown>) => {
        const measureTypeLabels: Record<string, string> = {
          WEIGHT: "Peso",
          VOLUME: "Volume",
          LENGTH: "Comprimento",
          AREA: "Área",
          COUNT: "Contagem",
        };
        const type = measureTypeLabels[measure.measureType as string] || String(measure.measureType);
        const unit = MEASURE_UNIT_LABELS[measure.unit as keyof typeof MEASURE_UNIT_LABELS] || String(measure.unit);
        return `${type}: ${measure.value} ${unit}`;
      });
      return formattedMeasures.join(", ");
    }

    // Task-specific array handling
    if (entityType === CHANGE_LOG_ENTITY_TYPE.TASK) {
      if (field === "artworks") {
        return `${value.length} ${value.length === 1 ? "arte" : "artes"}`;
      }
      if (field === "baseFiles") {
        return `${value.length} ${value.length === 1 ? "arquivo base" : "arquivos base"}`;
      }
      // Don't format logoPaints/paints/groundPaints as strings - they will be rendered as special cards in the UI
      if (field === "logoPaints" || field === "paints" || field === "groundPaints") {
        // Return the array as-is to be handled by the UI component
        return value;
      }
      if (field === "services") {
        return `${value.length} ${value.length === 1 ? "serviço" : "serviços"}`;
      }
      if (field === "commissions") {
        return `${value.length} ${value.length === 1 ? "comissão" : "comissões"}`;
      }
      if (field === "airbrushings") {
        return `${value.length} ${value.length === 1 ? "aerografia" : "aerografias"}`;
      }
      if (field === "cutRequest") {
        return `${value.length} ${value.length === 1 ? "solicitação de corte" : "solicitações de corte"}`;
      }
      if (field === "cutPlan") {
        return `${value.length} ${value.length === 1 ? "plano de corte" : "planos de corte"}`;
      }
      if (field === "relatedTasks" || field === "relatedTo") {
        return `${value.length} ${value.length === 1 ? "tarefa relacionada" : "tarefas relacionadas"}`;
      }
      if (field === "representatives" || field === "representativeIds") {
        // Format representatives with name and phone
        if (value.length > 0 && typeof value[0] === "object" && value[0].name) {
          return value.map((rep: { name?: string; phone?: string; role?: string }) => {
            const name = rep.name || "Representante";
            const phone = rep.phone ? formatBrazilianPhone(rep.phone) : "";
            return phone ? `${name} - ${phone}` : name;
          }).join("\n");
        }
        // Fallback to count for IDs only
        return `${value.length} ${value.length === 1 ? "representante" : "representantes"}`;
      }
    }

    // Paint-specific array handling
    if (entityType === CHANGE_LOG_ENTITY_TYPE.PAINT) {
      // Don't format paintGrounds as strings - they will be rendered as special cards in the UI
      if (field === "paintGrounds" || field === "groundPaints") {
        // Return the array as-is to be handled by the UI component
        return value;
      }
      if (field === "formulas") {
        return `${value.length} ${value.length === 1 ? "fórmula" : "fórmulas"}`;
      }
    }

    return `${value.length} ${value.length === 1 ? "item" : "itens"}`;
  }

  // Handle enums
  if (field === "measureUnit" && typeof value === "string") {
    return MEASURE_UNIT_LABELS[value as keyof typeof MEASURE_UNIT_LABELS] || value;
  }

  // Handle order status
  if ((field === "status" || field === "status_transition") && entityType === CHANGE_LOG_ENTITY_TYPE.ORDER && typeof value === "string") {
    const orderStatusLabels: Record<string, string> = {
      CREATED: "Criado",
      PARTIALLY_FULFILLED: "Parcialmente Pedido",
      FULFILLED: "Pedido",
      OVERDUE: "Atrasado",
      PARTIALLY_RECEIVED: "Parcialmente Recebido",
      RECEIVED: "Recebido",
      CANCELLED: "Cancelado",
    };
    return orderStatusLabels[value] || value;
  }

  // Handle external withdrawal status
  if ((field === "status" || field === "status_transition") && entityType === CHANGE_LOG_ENTITY_TYPE.EXTERNAL_WITHDRAWAL && typeof value === "string") {
    const externalWithdrawalStatusLabels: Record<string, string> = {
      PENDING: "Pendente",
      PARTIALLY_RETURNED: "Parcialmente Devolvido",
      FULLY_RETURNED: "Totalmente Devolvido",
      CHARGED: "Cobrado",
      CANCELLED: "Cancelado",
    };
    return externalWithdrawalStatusLabels[value] || value;
  }

  // Handle service order status
  if ((field === "status" || field === "status_transition") && entityType === CHANGE_LOG_ENTITY_TYPE.SERVICE_ORDER && typeof value === "string") {
    const serviceOrderStatusLabels: Record<string, string> = {
      PENDING: "Pendente",
      IN_PROGRESS: "Em Andamento",
      WAITING_APPROVE: "Aguardando Aprovação",
      COMPLETED: "Concluído",
      CANCELLED: "Cancelado",
    };
    return serviceOrderStatusLabels[value] || value;
  }

  // Handle task status
  if ((field === "status" || field === "status_transition") && entityType === CHANGE_LOG_ENTITY_TYPE.TASK && typeof value === "string") {
    const taskStatusLabels: Record<string, string> = {
      PREPARATION: "Em Preparação",
      WAITING_PRODUCTION: "Aguardando Produção",
      IN_PRODUCTION: "Em Produção",
      COMPLETED: "Concluído",
      CANCELLED: "Cancelado",
    };
    return taskStatusLabels[value] || value;
  }

  // Handle maintenance status
  if ((field === "status" || field === "status_transition") && entityType === CHANGE_LOG_ENTITY_TYPE.MAINTENANCE && typeof value === "string") {
    const maintenanceStatusLabels: Record<string, string> = {
      PENDING: "Pendente",
      IN_PROGRESS: "Em Progresso",
      COMPLETED: "Concluído",
      CANCELLED: "Cancelado",
      OVERDUE: "Atrasado",
    };
    return maintenanceStatusLabels[value] || value;
  }

  // Handle user status
  if ((field === "status" || field === "status_transition") && entityType === CHANGE_LOG_ENTITY_TYPE.USER && typeof value === "string") {
    const userStatusLabels: Record<string, string> = {
      EXPERIENCE_PERIOD_1: "Experiência - 1º Período",
      EXPERIENCE_PERIOD_2: "Experiência - 2º Período",
      EFFECTED: "Efetivado",
      DISMISSED: "Demitido",
    };
    return userStatusLabels[value] || value;
  }

  // Handle PPE size fields for User entity
  if (entityType === CHANGE_LOG_ENTITY_TYPE.USER && typeof value === "string") {
    if (field === "ppeSize.shirts") {
      return SHIRT_SIZE_LABELS[value as keyof typeof SHIRT_SIZE_LABELS] || value;
    }
    if (field === "ppeSize.boots") {
      return BOOT_SIZE_LABELS[value as keyof typeof BOOT_SIZE_LABELS] || value;
    }
    if (field === "ppeSize.pants") {
      return PANTS_SIZE_LABELS[value as keyof typeof PANTS_SIZE_LABELS] || value;
    }
    if (field === "ppeSize.shorts") {
      return PANTS_SIZE_LABELS[value as keyof typeof PANTS_SIZE_LABELS] || value;
    }
    if (field === "ppeSize.sleeves") {
      return SLEEVES_SIZE_LABELS[value as keyof typeof SLEEVES_SIZE_LABELS] || value;
    }
    if (field === "ppeSize.mask") {
      return MASK_SIZE_LABELS[value as keyof typeof MASK_SIZE_LABELS] || value;
    }
    if (field === "ppeSize.gloves") {
      return GLOVES_SIZE_LABELS[value as keyof typeof GLOVES_SIZE_LABELS] || value;
    }
    if (field === "ppeSize.rainBoots") {
      return RAIN_BOOTS_SIZE_LABELS[value as keyof typeof RAIN_BOOTS_SIZE_LABELS] || value;
    }
  }

  // Handle PPE delivery status
  if ((field === "status" || field === "status_transition") && entityType === CHANGE_LOG_ENTITY_TYPE.PPE_DELIVERY && typeof value === "string") {
    const ppeDeliveryStatusLabels: Record<string, string> = {
      PENDING: "Pendente",
      APPROVED: "Aprovado",
      DELIVERED: "Entregue",
      REPROVED: "Reprovado",
    };
    return ppeDeliveryStatusLabels[value] || value;
  }

  // Handle holiday type
  if (field === "type" && entityType === CHANGE_LOG_ENTITY_TYPE.HOLIDAY && typeof value === "string") {
    const holidayTypeLabels: Record<string, string> = {
      NATIONAL: "Nacional",
      STATE: "Estadual",
      MUNICIPAL: "Municipal",
    };
    return holidayTypeLabels[value] || value;
  }

  // Handle vacation status
  if ((field === "status" || field === "status_transition") && entityType === CHANGE_LOG_ENTITY_TYPE.VACATION && typeof value === "string") {
    const vacationStatusLabels: Record<string, string> = {
      PENDING: "Pendente",
      APPROVED: "Aprovado",
      REJECTED: "Rejeitado",
      IN_PROGRESS: "Em Andamento",
      COMPLETED: "Concluído",
      CANCELLED: "Cancelado",
    };
    return vacationStatusLabels[value] || value;
  }

  // Handle vacation type
  if (field === "type" && entityType === CHANGE_LOG_ENTITY_TYPE.VACATION && typeof value === "string") {
    const vacationTypeLabels: Record<string, string> = {
      ANNUAL: "Anual",
      COLLECTIVE: "Coletiva",
      SICK_LEAVE: "Licença Médica",
      MATERNITY_LEAVE: "Licença Maternidade",
      PATERNITY_LEAVE: "Licença Paternidade",
      OTHER: "Outro",
    };
    return vacationTypeLabels[value] || value;
  }

  // Handle cut status
  if ((field === "status" || field === "status_transition") && entityType === CHANGE_LOG_ENTITY_TYPE.CUT && typeof value === "string") {
    const cutStatusLabels: Record<string, string> = {
      PENDING: "Pendente",
      CUTTING: "Cortando",
      COMPLETED: "Concluído",
    };
    return cutStatusLabels[value] || value;
  }

  // Handle cut type
  if (field === "type" && entityType === CHANGE_LOG_ENTITY_TYPE.CUT && typeof value === "string") {
    const cutTypeLabels: Record<string, string> = {
      VINYL: "Vinil",
      STENCIL: "Estêncil",
    };
    return cutTypeLabels[value] || value;
  }

  // Handle truck category (for both TRUCK entity and truck.category in TASK entity)
  if ((field === "category" || field === "truck.category") && typeof value === "string") {
    const truckCategoryLabels: Record<string, string> = {
      MINI: "Mini",
      VUC: "VUC (Veículo Urbano de Carga)",
      THREE_QUARTER: "3/4",
      RIGID: "Toco",
      TRUCK: "Caminhão",
      SEMI_TRAILER: "Carreta",
      B_DOUBLE: "Bitrem",
    };
    return truckCategoryLabels[value] || value;
  }

  // Handle truck implement type
  if ((field === "implementType" || field === "truck.implementType") && typeof value === "string") {
    const implementTypeLabels: Record<string, string> = {
      DRY_CARGO: "Carga Seca",
      REFRIGERATED: "Refrigerado",
      INSULATED: "Isoplastic",
      CURTAIN_SIDE: "Sider",
      TANK: "Tanque",
      FLATBED: "Carroceria",
      CORRUGATED: "Baú (Legado)", // Legacy value - migrated to REFRIGERATED
    };
    return implementTypeLabels[value] || value;
  }

  // Handle truck spot
  if (field === "spot" || field === "truck.spot") {
    // Handle empty/null case
    if (!value || value === "" || value === null) return "Pátio";

    if (typeof value === "string") {
      if (value === "PATIO") return "Pátio";
      // Parse B1_F1_V1 format -> "Garagem 1 - Fila 1 - Vaga 1"
      const match = value.match(/B(\d)_F(\d)_V(\d)/);
      if (match) {
        return `Garagem ${match[1]} - Fila ${match[2]} - Vaga ${match[3]}`;
      }
      return value;
    }
  }

  // Handle cut origin
  if (field === "origin" && entityType === CHANGE_LOG_ENTITY_TYPE.CUT && typeof value === "string") {
    const cutOriginLabels: Record<string, string> = {
      PLAN: "Plano",
      REQUEST: "Solicitação",
    };
    return cutOriginLabels[value] || value;
  }

  // Handle cut request reason
  if (field === "reason" && entityType === CHANGE_LOG_ENTITY_TYPE.CUT && typeof value === "string") {
    const cutReasonLabels: Record<string, string> = {
      WRONG_APPLY: "Aplicação Errada",
      LOST: "Perdido",
      WRONG: "Errado",
    };
    return cutReasonLabels[value] || value;
  }

  // Handle commission status
  if (field === "commission" && entityType === CHANGE_LOG_ENTITY_TYPE.TASK && typeof value === "string") {
    const commissionStatusLabels: Record<string, string> = {
      NO_COMMISSION: "Sem Comissão",
      PARTIAL_COMMISSION: "Comissão Parcial",
      FULL_COMMISSION: "Comissão Integral",
      SUSPENDED_COMMISSION: "Comissão Suspensa",
    };
    return commissionStatusLabels[value] || value;
  }

  // Handle maintenance type
  if (field === "type" && entityType === CHANGE_LOG_ENTITY_TYPE.MAINTENANCE && typeof value === "string") {
    const maintenanceTypeLabels: Record<string, string> = {
      PREVENTIVE: "Preventiva",
      CORRECTIVE: "Corretiva",
      PREDICTIVE: "Preditiva",
      ROUTINE: "Rotineira",
      EMERGENCY: "Emergência",
    };
    return maintenanceTypeLabels[value] || value;
  }

  // Handle paint type
  if (field === "type" && entityType === CHANGE_LOG_ENTITY_TYPE.PAINT && typeof value === "string") {
    const paintTypeLabels: Record<string, string> = {
      POLYESTER: "Poliéster",
      ACRYLIC: "Acrílica",
      LACQUER: "Laca",
      POLYURETHANE: "Poliuretano",
      EPOXY: "Epóxi",
    };
    return paintTypeLabels[value] || value;
  }

  // Handle paint brand
  if (field === "brand" && entityType === CHANGE_LOG_ENTITY_TYPE.PAINT && typeof value === "string") {
    const paintBrandLabels: Record<string, string> = {
      PPG: "PPG",
      FARBEN: "Farben",
      LAZZURIL: "Lazzuril",
    };
    return paintBrandLabels[value] || value;
  }

  // Handle paint finish
  if (field === "finish" && entityType === CHANGE_LOG_ENTITY_TYPE.PAINT && typeof value === "string") {
    const paintFinishLabels: Record<string, string> = {
      SOLID: "Sólido",
      METALLIC: "Metálico",
      PEARL: "Perolizado",
      MATTE: "Fosco",
      SATIN: "Acetinado",
    };
    return paintFinishLabels[value] || value;
  }


  // Handle ABC/XYZ categories
  if (field === "abcCategory" && typeof value === "string") {
    const abcLabels: Record<string, string> = {
      A: "Categoria A - Alto Valor",
      B: "Categoria B - Valor Médio",
      C: "Categoria C - Baixo Valor",
    };
    return abcLabels[value] || value;
  }

  if (field === "xyzCategory" && typeof value === "string") {
    const xyzLabels: Record<string, string> = {
      X: "Categoria X - Baixa Variabilidade",
      Y: "Categoria Y - Média Variabilidade",
      Z: "Categoria Z - Alta Variabilidade",
    };
    return xyzLabels[value] || value;
  }

  // Handle street type for Supplier and Customer
  if (field === "streetType" && typeof value === "string") {
    const streetTypeLabels: Record<string, string> = {
      RUA: "Rua",
      AVENIDA: "Avenida",
      ALAMEDA: "Alameda",
      TRAVESSA: "Travessa",
      PRACA: "Praça",
      RODOVIA: "Rodovia",
      ESTRADA: "Estrada",
      VIA: "Via",
      LARGO: "Largo",
      VIELA: "Viela",
      BECO: "Beco",
      RUELA: "Ruela",
      CAMINHO: "Caminho",
      PASSAGEM: "Passagem",
      JARDIM: "Jardim",
      QUADRA: "Quadra",
      LOTE: "Lote",
      SITIO: "Sítio",
      PARQUE: "Parque",
      FAZENDA: "Fazenda",
    };
    return streetTypeLabels[value] || value;
  }

  // Handle registration status for Customer
  if (field === "registrationStatus" && typeof value === "string") {
    const registrationStatusLabels: Record<string, string> = {
      ACTIVE: "Active",
      SUSPENDED: "Suspended",
      UNFIT: "Unfit",
      ACTIVE_NOT_REGULAR: "Active Not Regular",
      DEREGISTERED: "Deregistered",
    };
    return registrationStatusLabels[value] || value;
  }

  // Handle sector privileges
  if (field === "privileges" && (entityType === CHANGE_LOG_ENTITY_TYPE.SECTOR || entityType === CHANGE_LOG_ENTITY_TYPE.POSITION) && typeof value === "string") {
    const privilegeLabels: Record<string, string> = {
      BASIC: "Básico",
      TRAINEE: "Estagiário",
      JUNIOR: "Júnior",
      INTERMEDIATE: "Intermediário",
      SENIOR: "Sênior",
      LEAD: "Líder",
      HUMAN_RESOURCES: "Recursos Humanos",
      ADMIN: "Administrador",
      PRODUCTION: "Produção",
      COMMERCIAL: "Comercial",
      FINANCIAL: "Financeiro",
      WAREHOUSE: "Almoxarifado",
      DESIGNER: "Designer",
      LOGISTIC: "Logística",
      PLOTTING: "Plotagem",
      MAINTENANCE: "Manutenção",
      EXTERNAL: "Externo",
    };
    return privilegeLabels[value] || value;
  }

  // Handle activity reasons
  if (field === "reason" && typeof value === "string") {
    const activityReasonLabels: Record<string, string> = {
      ORDER_RECEIVED: "Pedido Recebido",
      PRODUCTION_USAGE: "Uso em Produção",
      PPE_DELIVERY: "Entrega de EPI",
      BORROW: "Empréstimo",
      RETURN: "Devolução",
      EXTERNAL_WITHDRAWAL: "Retirada Externa",
      EXTERNAL_WITHDRAWAL_RETURN: "Devolução de Retirada Externa",
      INVENTORY_COUNT: "Contagem de Inventário",
      MANUAL_ADJUSTMENT: "Ajuste Manual",
      MAINTENANCE: "Manutenção",
      DAMAGE: "Avaria",
      LOSS: "Perda",
      OTHER: "Outro",
    };
    return activityReasonLabels[value] || value;
  }

  // Handle notification type
  if (field === "notificationType" && typeof value === "string") {
    const notificationTypeLabels: Record<string, string> = {
      TASK_CREATED: "Tarefa Criada",
      TASK_UPDATED: "Tarefa Atualizada",
      TASK_COMPLETED: "Tarefa Concluída",
      TASK_CANCELLED: "Tarefa Cancelada",
      TASK_ASSIGNED: "Tarefa Atribuída",
      ORDER_CREATED: "Pedido Criado",
      ORDER_UPDATED: "Pedido Atualizado",
      ORDER_RECEIVED: "Pedido Recebido",
      ORDER_CANCELLED: "Pedido Cancelado",
      LOW_STOCK_ALERT: "Alerta de Estoque Baixo",
      PPE_DELIVERY_SCHEDULED: "Entrega de EPI Agendada",
      PPE_DELIVERY_PENDING: "Entrega de EPI Pendente",
      PPE_EXPIRATION_WARNING: "Aviso de Vencimento de EPI",
      MAINTENANCE_SCHEDULED: "Manutenção Agendada",
      MAINTENANCE_OVERDUE: "Manutenção Atrasada",
      VACATION_REQUESTED: "Férias Solicitadas",
      VACATION_APPROVED: "Férias Aprovadas",
      VACATION_REJECTED: "Férias Rejeitadas",
      VACATION_STARTED: "Férias Iniciadas",
      VACATION_ENDED: "Férias Finalizadas",
      EXTERNAL_WITHDRAWAL_CREATED: "Retirada Externa Criada",
      EXTERNAL_WITHDRAWAL_OVERDUE: "Retirada Externa Atrasada",
      SYSTEM_UPDATE: "Atualização do Sistema",
      SYSTEM_MAINTENANCE: "Manutenção do Sistema",
      GENERAL_ANNOUNCEMENT: "Comunicado Geral",
    };
    return notificationTypeLabels[value] || value;
  }

  // Handle notification importance
  if (field === "importance" && entityType === CHANGE_LOG_ENTITY_TYPE.NOTIFICATION_PREFERENCE && typeof value === "string") {
    const importanceLabels: Record<string, string> = {
      LOW: "Baixa",
      NORMAL: "Normal",
      HIGH: "Alta",
      URGENT: "Urgente",
    };
    return importanceLabels[value] || value;
  }

  // Handle notification channels
  if ((field === "channels" || field === "channel") && entityType === CHANGE_LOG_ENTITY_TYPE.NOTIFICATION_PREFERENCE && Array.isArray(value)) {
    const channelLabels: Record<string, string> = {
      EMAIL: "E-mail",
      PUSH: "Push",
      SMS: "SMS",
      IN_APP: "No App",
    };
    const formattedChannels = value.map((channel) => channelLabels[channel] || channel);
    if (formattedChannels.length === 0) return "Nenhum";
    return formattedChannels.join(", ");
  }

  // Handle PPE types
  if ((field === "ppeType" || field === "item.ppeType") && typeof value === "string") {
    const ppeTypeLabels: Record<string, string> = {
      SHIRT: "Camisa",
      PANTS: "Calça",
      SHORT: "Bermuda",
      BOOTS: "Bota",
      SLEEVES: "Manga",
      MASK: "Máscara",
      GLOVES: "Luva",
      RAIN_BOOTS: "Bota de Chuva",
      HELMET: "Capacete",
      GOGGLES: "Óculos",
      OVERALL: "Macacão",
      APRON: "Avental",
      VEST: "Colete",
      EAR_PROTECTOR: "Protetor Auricular",
      RESPIRATOR: "Respirador",
      SAFETY_HARNESS: "Cinto de Segurança",
      FACE_SHIELD: "Protetor Facial",
    };
    return ppeTypeLabels[value] || value;
  }

  // Handle PPE delivery mode
  if (field === "ppeDeliveryMode" && typeof value === "string") {
    const ppeDeliveryModeLabels: Record<string, string> = {
      INDIVIDUAL: "Individual",
      CATEGORY: "Por Categoria",
      SCHEDULED: "Agendado",
      ON_DEMAND: "Sob Demanda",
    };
    return ppeDeliveryModeLabels[value] || value;
  }

  // Handle PPE sizes
  if (
    (field === "size" || field === "shirts" || field === "pants" || field === "shorts" || field === "boots" || field === "sleeves" || field === "mask" || field === "gloves" || field === "rainBoots") &&
    typeof value === "string"
  ) {
    // Size values are already in Portuguese format (PP, P, M, G, GG, XGG, etc.)
    return value;
  }

  // Handle schedule frequency
  if ((field === "frequency" || field === "ppeSchedule.frequency") && typeof value === "string") {
    const frequencyLabels: Record<string, string> = {
      DAILY: "Diário",
      WEEKLY: "Semanal",
      MONTHLY: "Mensal",
      QUARTERLY: "Trimestral",
      SEMI_ANNUAL: "Semestral",
      ANNUAL: "Anual",
      ON_DEMAND: "Sob Demanda",
    };
    return frequencyLabels[value] || value;
  }

  // Handle assignment type
  if (field === "assignmentType" && typeof value === "string") {
    const assignmentTypeLabels: Record<string, string> = {
      ALL: "Todos",
      ALL_EXCEPT: "Todos Exceto",
      SPECIFIC: "Específicos",
    };
    return assignmentTypeLabels[value] || value;
  }

  // Handle PPE items array (special handling for PPE schedule)
  // 'items' is the new relational field, 'ppeItems' is legacy JSON field for old changelog entries
  if ((field === "items" || field === "ppeItems") && Array.isArray(value)) {
    const ppeTypeLabels: Record<string, string> = {
      SHIRT: "Camisa",
      PANTS: "Calça",
      SHORT: "Bermuda",
      BOOTS: "Bota",
      SLEEVES: "Manga",
      MASK: "Máscara",
      GLOVES: "Luva",
      RAIN_BOOTS: "Bota de Chuva",
      HELMET: "Capacete",
      GOGGLES: "Óculos",
      OVERALL: "Macacão",
      APRON: "Avental",
      VEST: "Colete",
      EAR_PROTECTOR: "Protetor Auricular",
      RESPIRATOR: "Respirador",
      SAFETY_HARNESS: "Cinto de Segurança",
      FACE_SHIELD: "Protetor Facial",
    };

    const formattedItems = value.map((item: Record<string, unknown>) => {
      if (typeof item === "object" && item.ppeType) {
        const typeName = ppeTypeLabels[item.ppeType as string] || String(item.ppeType);
        return `${typeName} (${item.quantity} un)`;
      }
      return JSON.stringify(item);
    });

    if (formattedItems.length === 0) return "Nenhum";
    if (formattedItems.length > 3) {
      return `${formattedItems.slice(0, 3).join(", ")} e mais ${formattedItems.length - 3}`;
    }
    return formattedItems.join(", ");
  }

  // Handle operation type
  if ((field === "operationType" || field === "operation") && typeof value === "number") {
    return value === 1 ? "Entrada" : value === -1 ? "Saída" : String(value);
  }

  // Handle activity operation enum
  if ((field === "operation" || field === "operationType") && typeof value === "string") {
    const operationLabels: Record<string, string> = {
      INBOUND: "Entrada",
      OUTBOUND: "Saída",
    };
    return operationLabels[value] || value;
  }

  // Handle notification importance
  if (field === "importance" && entityType === CHANGE_LOG_ENTITY_TYPE.NOTIFICATION && typeof value === "string") {
    const importanceLabels: Record<string, string> = {
      LOW: "Baixa",
      MEDIUM: "Média",
      HIGH: "Alta",
      URGENT: "Urgente",
    };
    return importanceLabels[value] || value;
  }

  // Handle notification channel array
  if (field === "channel" && entityType === CHANGE_LOG_ENTITY_TYPE.NOTIFICATION && Array.isArray(value)) {
    const channelLabels: Record<string, string> = {
      IN_APP: "No Aplicativo",
      EMAIL: "E-mail",
      SMS: "SMS",
      PUSH: "Push",
    };
    const formattedChannels = value.map((channel: string) => channelLabels[channel] || channel);
    return formattedChannels.length > 0 ? formattedChannels.join(", ") : "Nenhum";
  }

  // Handle TIME_CLOCK_ENTRY specific fields
  if (entityType === CHANGE_LOG_ENTITY_TYPE.TIME_CLOCK_ENTRY) {
    // Handle source field
    if (field === "source" && typeof value === "string") {
      const sourceLabels: Record<string, string> = {
        MANUAL: "Manual",
        SECULLUM: "Secullum",
        DEVICE: "Dispositivo",
        MOBILE: "Mobile",
        WEB: "Web",
      };
      return sourceLabels[value] || value;
    }

    // Handle dayType field
    if (field === "dayType" && typeof value === "number") {
      const dayTypeLabels: Record<number, string> = {
        0: "Dia de Trabalho",
        1: "Folga",
        2: "Feriado",
        3: "Compensado",
      };
      return dayTypeLabels[value] || `Tipo ${value}`;
    }

    // Handle secullumSyncStatus field
    if (field === "secullumSyncStatus" && typeof value === "string") {
      const syncStatusLabels: Record<string, string> = {
        PENDING: "Pendente",
        SYNCED: "Sincronizado",
        ERROR: "Erro",
        CONFLICT: "Conflito",
      };
      return syncStatusLabels[value] || value;
    }

    // Handle time fields (entry1, exit1, etc.)
    if (field && /^(entry|exit)\d$/.test(field) && typeof value === "string") {
      return value || "—";
    }
  }

  // Handle file size formatting
  if (field === "size" && entityType === CHANGE_LOG_ENTITY_TYPE.FILE && typeof value === "number") {
    // Format file size
    if (value < 1024) {
      return `${value} B`;
    } else if (value < 1024 * 1024) {
      return `${(value / 1024).toFixed(1)} KB`;
    } else if (value < 1024 * 1024 * 1024) {
      return `${(value / (1024 * 1024)).toFixed(1)} MB`;
    } else {
      return `${(value / (1024 * 1024 * 1024)).toFixed(1)} GB`;
    }
  }

  // Handle file mimetype display
  if (field === "mimetype" && entityType === CHANGE_LOG_ENTITY_TYPE.FILE && typeof value === "string") {
    const mimeTypeLabels: Record<string, string> = {
      "application/pdf": "PDF",
      "image/jpeg": "JPEG",
      "image/jpg": "JPG",
      "image/png": "PNG",
      "image/gif": "GIF",
      "image/webp": "WebP",
      "image/svg+xml": "SVG",
      "application/msword": "Word",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "Word",
      "application/vnd.ms-excel": "Excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "Excel",
      "text/plain": "Texto",
      "text/csv": "CSV",
      "application/zip": "ZIP",
      "application/x-rar-compressed": "RAR",
    };
    return mimeTypeLabels[value] || value;
  }

  // Handle notification read status
  if (field === "readStatus" && typeof value === "string") {
    return value === "read" ? "Lida" : value === "unread" ? "Não Lida" : value;
  }

  // Handle logo field - special case for logoId
  if (field === "logoId" || field === "logo") {
    if (!value || value === null) {
      return "—";
    }
    // Check if it's a UUID (logo file ID)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (typeof value === "string" && uuidRegex.test(value)) {
      return `Logo (${value.slice(0, 8)}...)`;
    }
    // For logo fields, we'll handle the display at the UI component level
    // Just return the raw value and let the component handle UUID detection and image rendering
    return String(value);
  }

  // Handle single phone field
  if (field === "phone" && typeof value === "string") {
    return formatBrazilianPhone(value);
  }

  // Handle CPF field
  if (field === "cpf" && typeof value === "string") {
    return formatCPF(value);
  }

  // Handle CNPJ field
  if (field === "cnpj" && typeof value === "string") {
    return formatCNPJ(value);
  }

  // Handle Chassis Number field
  if (field === "chassisNumber" && typeof value === "string") {
    return formatChassis(value);
  }

  // Handle payrollNumber field
  if (field === "payrollNumber" && typeof value === "number") {
    return value.toString();
  }

  // Handle UUID references (will be resolved by entity details)
  if (typeof value === "string") {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (uuidRegex.test(value)) {
      if (
        field === "supplierId" ||
        field === "categoryId" ||
        field === "brandId" ||
        field === "assignedToUserId" ||
        field === "createdById" ||
        field === "customerId" ||
        field === "sectorId" ||
        field === "paintId" ||
        field === "budgetIds" ||
        field === "invoiceIds" ||
        field === "receiptIds" ||
        field === "observationId" ||
        field === "truckId" ||
        field === "userId" ||
        field === "itemId" ||
        field === "reviewedBy" ||
        field === "ppeScheduleId" ||
        field === "ppeConfigId" ||
        field === "weeklyConfigId" ||
        field === "monthlyConfigId" ||
        field === "yearlyConfigId" ||
        field === "positionId" ||
        field === "approvedBy" ||
        field === "rejectedBy" ||
        field === "cancelledBy" ||
        field === "garageId"
      ) {
        return value; // Will be replaced with entity name
      }
    }
  }

  // Handle number formatting
  if (typeof value === "number") {
    // Currency fields
    if (
      field === "price" ||
      field === "totalPrice" ||
      field === "unitCost" ||
      field === "averageCost" ||
      field === "lastPurchasePrice" ||
      field === "suggestedPrice" ||
      field === "totalAmount" ||
      field === "remuneration" ||
      field === "cost" ||
      field === "pricePerLiter"
    ) {
      return formatCurrency(value);
    }

    // ORDER_ITEM specific - calculate total price
    if (field === "totalPrice" && entityType === CHANGE_LOG_ENTITY_TYPE.ORDER_ITEM) {
      return formatCurrency(value);
    }

    // Percentage fields
    if (field === "icms" || field === "ipi" || field === "margin" || field === "minimumMargin" || field === "monthlyConsumptionTrendPercent" || field === "ratio") {
      return `${value.toLocaleString("pt-BR")}%`;
    }

    // Time fields (days)
    if (field === "leadTime" || field === "estimatedLeadTime" || field === "warrantyPeriod") {
      return `${value} ${value === 1 ? "dia" : "dias"}`;
    }

    // Time fields (seconds to HH:MM format)
    if (field === "timeTaken") {
      const hours = Math.floor(value / 3600);
      const minutes = Math.floor((value % 3600) / 60);
      return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
    }

    // Quantity fields
    if (
      field === "quantity" ||
      field === "maxQuantity" ||
      field === "boxQuantity" ||
      field === "reorderPoint" ||
      field === "reorderQuantity" ||
      field === "orderedQuantity" ||
      field === "receivedQuantity" ||
      field === "withdrawedQuantity" ||
      field === "returnedQuantity"
    ) {
      return `${value.toLocaleString("pt-BR")} un`;
    }

    // Density field
    if (field === "density") {
      return `${value.toLocaleString("pt-BR", { minimumFractionDigits: 3, maximumFractionDigits: 3 })} g/ml`;
    }

    // Viscosity field
    if (field === "viscosity") {
      return `${value.toLocaleString("pt-BR")} cP`;
    }

    // Weight field (grams)
    if (field === "weight" && (entityType === CHANGE_LOG_ENTITY_TYPE.PAINT_FORMULA_COMPONENT || entityType === CHANGE_LOG_ENTITY_TYPE.PAINT_PRODUCTION)) {
      return `${value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} g`;
    }

    // Volume field (milliliters)
    if (field === "volume" && entityType === CHANGE_LOG_ENTITY_TYPE.PAINT_FORMULA_COMPONENT) {
      return `${value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ml`;
    }

    // Volume field (liters)
    if (field === "volumeLiters") {
      return `${value.toLocaleString("pt-BR", { minimumFractionDigits: 3, maximumFractionDigits: 3 })} L`;
    }

    // Order fields
    if (field === "abcCategoryOrder" || field === "xyzCategoryOrder") {
      return `${value}º`;
    }

    return value.toLocaleString("pt-BR");
  }

  // Handle date formatting for known date fields
  // Date-only fields (no time component needed) - check BEFORE generic ISO date detection
  if (
    field === "expirationDate" ||
    field === "manufacturingDate" ||
    field === "lastPurchaseDate" ||
    field === "deliveryDate" ||
    field === "receivedDate" ||
    field === "dueDate" ||
    field === "entryDate" ||
    field === "term" ||
    field === "scheduledFor" ||
    field === "forecast" ||
    field === "scheduledDate" ||
    field === "actualDeliveryDate" ||
    field === "nextRun" ||
    field === "lastRun" ||
    field === "birth" ||
    field === "productionDate" ||
    field === "admissional" ||
    field === "exp1StartAt" ||
    field === "exp1EndAt" ||
    field === "exp2StartAt" ||
    field === "exp2EndAt" ||
    field === "effectedAt" ||
    field === "dismissedAt"
  ) {
    const date = new Date(value as any);
    if (!isNaN(date.getTime())) {
      return formatDate(date);
    }
  }

  // DateTime fields (include time component)
  if (
    field === "createdAt" ||
    field === "updatedAt" ||
    field === "startedAt" ||
    field === "completedAt" ||
    field === "finishedAt" ||
    field === "receivedAt" ||
    field === "fulfilledAt" ||
    field === "verificationExpiresAt" ||
    field === "lastLoginAt" ||
    field === "startAt" ||
    field === "endAt" ||
    field === "approvedAt" ||
    field === "rejectedAt" ||
    field === "cancelledAt" ||
    field === "sentAt" ||
    field === "scheduledAt" ||
    field === "seenAt"
  ) {
    const date = new Date(value as any);
    if (!isNaN(date.getTime())) {
      return formatDateTime(date);
    }
  }

  // Generic ISO date string detection - catches any value that looks like an ISO date (fallback)
  if (typeof value === "string") {
    // Check if the string matches ISO 8601 format (e.g., "2025-10-30T14:35:59.569Z")
    const isoDateRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?$/;
    if (isoDateRegex.test(value)) {
      const date = new Date(value);
      if (!isNaN(date.getTime())) {
        return formatDateTime(date);
      }
    }
  }

  // Handle empty strings
  if (value === "") {
    return "Nenhum";
  }

  // Handle objects
  if (typeof value === "object") {
    // Special handling for negotiatingWith field in TASK
    if (field === "negotiatingWith" && entityType === CHANGE_LOG_ENTITY_TYPE.TASK) {
      const data = value as { name?: string; phone?: string | null };
      if (!data.name && !data.phone) return "Nenhum";
      if (data.name && data.phone) {
        return `${data.name} ${formatBrazilianPhone(data.phone)}`;
      }
      return data.name || "Nenhum";
    }

    // Special handling for componentImpact field in PAINT_PRODUCTION
    if (field === "componentImpact" && entityType === CHANGE_LOG_ENTITY_TYPE.PAINT_PRODUCTION) {
      if ((value as any).action === "ADD_COMPONENT") {
        return `Componente adicionado: ${(value as any).itemName} (${(value as any).ratio.toFixed(2)}%)`;
      } else if ((value as any).action === "REMOVE_COMPONENT") {
        return `Componente removido: ${(value as any).itemName} (${(value as any).ratio.toFixed(2)}%)`;
      } else if ((value as any).operationType === "INCREASE") {
        return `${(value as any).itemName}: ${(value as any).additionalUnitsUsed.toFixed(2)} unidades adicionais utilizadas (${(value as any).additionalVolumeUsed.toFixed(3)}L)`;
      } else if ((value as any).operationType === "DECREASE") {
        return `${(value as any).itemName}: ${(value as any).returnedUnits.toFixed(2)} unidades retornadas (${(value as any).returnedVolume.toFixed(3)}L)`;
      } else if ((value as any).operationType === "DELETE_RETURN") {
        return `${(value as any).itemName}: ${(value as any).returnedUnits.toFixed(2)} unidades retornadas`;
      } else if ((value as any).batchOperation) {
        return `${(value as any).itemName}: ${(value as any).unitsUsed.toFixed(2)} unidades (${(value as any).volumeUsed.toFixed(3)}L)`;
      } else {
        return `${(value as any).itemName}: ${(value as any).unitsUsed.toFixed(2)} unidades (${(value as any).volumeUsed.toFixed(3)}L, ${(value as any).ratio.toFixed(1)}%)`;
      }
    }

    // Special handling for components field in PAINT_FORMULA
    if (field === "components" && entityType === CHANGE_LOG_ENTITY_TYPE.PAINT_FORMULA) {
      if ((value as any).action === "ADD_COMPONENT") {
        return `${(value as any).itemName} adicionado (${(value as any).ratio.toFixed(2)}%)`;
      } else if ((value as any).action === "REMOVE_COMPONENT") {
        return `Componente removido (${(value as any).ratio.toFixed(2)}%)`;
      }
    }

    // Special handling for delivery_completed field in PPE_DELIVERY
    if (field === "delivery_completed" && entityType === CHANGE_LOG_ENTITY_TYPE.PPE_DELIVERY) {
      const data = value as any;
      if (data.itemName && data.userName && data.quantity) {
        return `${data.itemName} entregue para ${data.userName} (Quantidade: ${data.quantity})`;
      }
    }

    // Special handling for batch_approval field in PPE_DELIVERY
    if (field === "batch_approval" && entityType === CHANGE_LOG_ENTITY_TYPE.PPE_DELIVERY) {
      const data = value as any;
      if (data.approvedCount) {
        return `${data.approvedCount} ${data.approvedCount === 1 ? "entrega aprovada" : "entregas aprovadas"}`;
      }
    }

    // Special handling for batch_rejection field in PPE_DELIVERY
    if (field === "batch_rejection" && entityType === CHANGE_LOG_ENTITY_TYPE.PPE_DELIVERY) {
      const data = value as any;
      if (data.rejectedCount) {
        return `${data.rejectedCount} ${data.rejectedCount === 1 ? "entrega rejeitada" : "entregas rejeitadas"}`;
      }
    }

    // Special handling for batch_mark_delivered field in PPE_DELIVERY
    // Only show the status label - date/user are shown in changelog header
    if (field === "batch_mark_delivered" && entityType === CHANGE_LOG_ENTITY_TYPE.PPE_DELIVERY) {
      const data = value as any;
      const statusLabel: Record<string, string> = {
        PENDING: "Pendente",
        APPROVED: "Aprovado",
        DELIVERED: "Entregue",
        COMPLETED: "Concluído",
        CANCELLED: "Cancelado",
        WAITING_SIGNATURE: "Aguardando Assinatura",
        SIGNATURE_REJECTED: "Assinatura Rejeitada",
        REPROVED: "Reprovado",
      };
      return statusLabel[data.status] || data.status || "Desconhecido";
    }

    return JSON.stringify(value, null, 2);
  }

  return String(value);
}

// Action configuration for changelog
export const actionConfig: Record<CHANGE_LOG_ACTION, { label: string }> = {
  [CHANGE_LOG_ACTION.CREATE]: { label: "Criado" },
  [CHANGE_LOG_ACTION.UPDATE]: { label: "Atualizado" },
  [CHANGE_LOG_ACTION.DELETE]: { label: "Excluído" },
  [CHANGE_LOG_ACTION.RESTORE]: { label: "Restaurado" },
  [CHANGE_LOG_ACTION.ROLLBACK]: { label: "Revertido" },
  [CHANGE_LOG_ACTION.ARCHIVE]: { label: "Arquivado" },
  [CHANGE_LOG_ACTION.UNARCHIVE]: { label: "Desarquivado" },
  [CHANGE_LOG_ACTION.ACTIVATE]: { label: "Ativado" },
  [CHANGE_LOG_ACTION.DEACTIVATE]: { label: "Desativado" },
  [CHANGE_LOG_ACTION.APPROVE]: { label: "Aprovado" },
  [CHANGE_LOG_ACTION.REJECT]: { label: "Rejeitado" },
  [CHANGE_LOG_ACTION.CANCEL]: { label: "Cancelado" },
  [CHANGE_LOG_ACTION.COMPLETE]: { label: "Concluído" },
  [CHANGE_LOG_ACTION.BATCH_CREATE]: { label: "Criação em Lote" },
  [CHANGE_LOG_ACTION.BATCH_UPDATE]: { label: "Atualização em Lote" },
  [CHANGE_LOG_ACTION.BATCH_DELETE]: { label: "Exclusão em Lote" },
  [CHANGE_LOG_ACTION.VIEW]: { label: "Visualizado" },
};

/**
 * Determine the action label based on action and triggered by
 * @param action - The change action
 * @param triggeredBy - The trigger type
 * @returns The action label
 */
export function getActionLabel(action: CHANGE_LOG_ACTION, triggeredBy?: CHANGE_TRIGGERED_BY, metadata?: { sourceTaskName?: string }): string {
  const baseLabel = actionConfig[action]?.label || action;

  // Handle copy from task operation
  if (triggeredBy === CHANGE_TRIGGERED_BY.TASK_COPY_FROM_TASK) {
    if (metadata?.sourceTaskName) {
      return `Copiado de "${metadata.sourceTaskName}"`;
    }
    return "Copiado de outra tarefa";
  }

  // Handle batch operations
  if (triggeredBy === CHANGE_TRIGGERED_BY.BATCH_UPDATE) {
    return "Atualizado em lote";
  } else if (triggeredBy === CHANGE_TRIGGERED_BY.BATCH_CREATE) {
    return "Criado em lote";
  } else if (triggeredBy === CHANGE_TRIGGERED_BY.BATCH_DELETE) {
    return "Excluído em lote";
  } else if (triggeredBy === CHANGE_TRIGGERED_BY.BATCH_OPERATION) {
    return "Operação em lote";
  }

  return baseLabel;
}

/**
 * Check if this is a batch operation
 * @param triggeredBy - The trigger type
 * @returns Whether this is a batch operation
 */
export function isBatchOperation(triggeredBy?: CHANGE_TRIGGERED_BY): boolean {
  return (
    triggeredBy === CHANGE_TRIGGERED_BY.BATCH_UPDATE ||
    triggeredBy === CHANGE_TRIGGERED_BY.BATCH_CREATE ||
    triggeredBy === CHANGE_TRIGGERED_BY.BATCH_DELETE ||
    triggeredBy === CHANGE_TRIGGERED_BY.BATCH_OPERATION
  );
}
