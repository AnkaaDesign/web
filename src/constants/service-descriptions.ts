/**
 * Service Order Description Enums by Type
 *
 * These enums define the standardized service descriptions for each service order type.
 * Used for both ServiceOrder and TaskPricingItem descriptions.
 * All descriptions are in Title Case with Portuguese prepositions lowercase.
 */

import { SERVICE_ORDER_TYPE } from './enums';

// =====================
// PRODUCTION - Physical Work Actions (52 items including Outros)
// =====================
export const PRODUCTION_SERVICE_DESCRIPTIONS = [
  // Pintura de Componentes
  'Pintura Caixa de Cozinha',
  'Pintura Caixa de Ferramenta',
  'Pintura do Parachoque',
  'Pintura dos Paralamas',
  'Pintura Pes Mecanico',
  'Pintura das Rodas',
  'Pintura dos Cubos das Rodas',
  'Pintura do Quadro Lateral',
  'Pintura do Quadro Frontal',
  'Pintura do Quadro Traseiro',
  'Pintura do Chassis',
  'Pintura do Tanque',
  'Pintura do Estribo',
  'Pintura da Grade',
  'Pintura do Reservatorio',
  // Logomarca
  'Logomarca Padrao',
  'Logomarca Parcial',
  'Logomarca Plataforma',
  'Logomarca Portas Traseiras',
  'Logomarca no Teto',
  // Pintura de Áreas
  'Pintura Frota no Teto',
  'Pintura Placa no Teto',
  'Pintura Laterais',
  'Pintura Lateral',
  'Pintura Parcial',
  'Pintura Frontal',
  'Pintura Traseira',
  'Pintura do Teto',
  'Pintura Geral',
  'Pintura Cabine',
  // Adesivo
  'Adesivo Cabine',
  'Adesivo Portas Traseira',
  'Adesivo Lateral',
  'Adesivo Personalizado',
  // Aerografia
  'Aerografia',
  'Aerografia Parcial',
  // Carenagens e Frio
  'Pintura Carenagens Frio',
  'Reparos Carenagens Frio',
  // Reparos
  'Reparos Superficiais',
  'Reparos Amassados',
  // Faixas Refletivas
  'Troca de Faixas Refletivas',
  'Troca de Faixas Refletivas Parachoque',
  'Faixa Veiculo Longo Traseira',
  // Remoção
  'Remocao Lateral',
  'Remocao Laterais',
  'Remocao Parcial',
  // Verniz
  'Vedacao Externa',
  'Verniz Lateral',
  'Verniz Laterais',
  'Verniz Frontal',
  'Verniz Traseira',
  'Verniz Parcial',
  // Plotagem
  'Plotagem Lateral',
  'Plotagem Portas Traseiras',
  // Outros
  'Outros',
] as const;

// =====================
// COMMERCIAL - Sales Actions (52 items including Em Negociação + Outros)
// =====================
export const COMMERCIAL_SERVICE_DESCRIPTIONS = [
  // Default for new tasks
  'Em Negociacao',
  // Orçamento - Ações
  'Elaborar Orcamento',
  'Enviar Orcamento',
  'Reenviar Orcamento',
  'Revisar Orcamento',
  'Ajustar Orcamento',
  'Detalhar Orcamento',
  'Orcamento Urgente',
  'Orcamento Frota',
  'Orcamento Parcial',
  'Orcamento Complementar',
  // Proposta e Negociação
  'Apresentar Proposta',
  'Negociar Valor',
  'Negociar Prazo',
  'Negociar Condicoes',
  'Aplicar Desconto',
  'Proposta Especial',
  'Contraproposta',
  'Fechar Negocio',
  // Comunicação com Cliente
  'Ligar para Cliente',
  'Retornar Ligacao',
  'Enviar Whatsapp',
  'Enviar Email',
  'Responder Cliente',
  'Confirmar Interesse',
  'Esclarecer Duvidas',
  'Informar Prazo',
  'Informar Status',
  'Solicitar Feedback',
  // Cadastro de Cliente
  'Cadastrar Cliente',
  'Atualizar Cadastro Cliente',
  'Completar Dados Cliente',
  'Validar Dados Cliente',
  'Solicitar Documentos Cliente',
  'Registrar Contato Cliente',
  // Visitas e Reuniões
  'Agendar Visita',
  'Realizar Visita Tecnica',
  'Reuniao com Cliente',
  'Apresentar Catalogo',
  'Demonstrar Servicos',
  'Visita Pos-Servico',
  // Contratos e Documentos
  'Enviar Contrato',
  'Coletar Assinatura',
  'Registrar Aprovacao',
  'Formalizar Pedido',
  'Enviar Confirmacao',
  // Pós-venda e Fidelização
  'Pesquisa Satisfacao',
  'Tratar Reclamacao',
  'Oferecer Servico Adicional',
  'Programa Fidelidade',
  'Solicitar Indicacao',
  // Outros
  'Outros',
] as const;

// =====================
// FINANCIAL - Billing Actions (51 items including Outros)
// =====================
export const FINANCIAL_SERVICE_DESCRIPTIONS = [
  // Boletos
  'Gerar Boleto',
  'Enviar Boleto',
  'Reenviar Boleto',
  'Gerar Segunda Via Boleto',
  'Boleto Entrada',
  'Boleto Parcela',
  'Boleto Saldo',
  'Boleto Avulso',
  'Cancelar Boleto',
  'Ajustar Vencimento Boleto',
  // Pagamentos
  'Registrar Pagamento',
  'Confirmar Pagamento',
  'Registrar Pagamento Pix',
  'Registrar Pagamento Cartao',
  'Registrar Pagamento Dinheiro',
  'Registrar Pagamento Cheque',
  'Compensar Cheque',
  'Registrar Pagamento Parcial',
  'Baixar Titulo',
  'Estornar Pagamento',
  // Notas Fiscais
  'Emitir Nota Fiscal',
  'Enviar Nota Fiscal',
  'Cancelar Nota Fiscal',
  'Carta Correcao NF',
  'Emitir NF Complementar',
  'Emitir NF Servico',
  // Cobrança
  'Cobrar Cliente',
  'Enviar Lembrete Pagamento',
  'Ligar Cobranca',
  'Enviar Whatsapp Cobranca',
  'Negociar Divida',
  'Parcelar Debito',
  'Renegociar Prazo',
  'Acordo Pagamento',
  // Cadastro de Cliente
  'Cadastrar Cliente Financeiro',
  'Atualizar Dados Financeiros',
  'Registrar Dados Bancarios',
  'Validar Cnpj Cliente',
  'Consultar Credito Cliente',
  'Atualizar Limite Credito',
  // Comprovantes e Recibos
  'Gerar Recibo',
  'Enviar Comprovante',
  'Enviar Extrato',
  'Emitir Declaracao',
  'Carta Quitacao',
  // Inadimplência
  'Registrar Inadimplencia',
  'Protestar Titulo',
  'Negativar Cliente',
  'Retirar Negativacao',
  'Encaminhar Juridico',
  // Outros
  'Outros',
] as const;

// =====================
// ARTWORK - Design Actions (51 items including Outros)
// =====================
export const ARTWORK_SERVICE_DESCRIPTIONS = [
  // Layout com Medidas
  'Elaborar Layout Lateral',
  'Elaborar Layout Frontal',
  'Elaborar Layout Traseira',
  'Elaborar Layout Teto',
  'Elaborar Layout Portas',
  'Elaborar Layout Cabine',
  'Elaborar Layout Completo',
  'Tirar Medidas Veiculo',
  'Conferir Medidas',
  'Ajustar Medidas Layout',
  'Layout com Gabarito',
  'Layout Escala Real',
  // Arte e Criação
  'Criar Arte Personalizada',
  'Criar Arte Logomarca',
  'Criar Arte Frota',
  'Vetorizar Imagem',
  'Digitalizar Arte',
  'Redesenhar Logomarca',
  'Adaptar Arte Cliente',
  'Melhorar Resolucao Arte',
  'Converter Formato Arquivo',
  'Preparar Arte Final',
  // Revisões e Ajustes
  'Revisar Layout',
  'Ajustar Cores Layout',
  'Ajustar Posicionamento',
  'Ajustar Proporcoes',
  'Corrigir Layout',
  'Refazer Layout',
  'Aplicar Alteracoes Cliente',
  'Versao Alternativa Layout',
  // Aprovação - Ações
  'Enviar Layout Aprovacao',
  'Reenviar Layout Aprovacao',
  'Registrar Aprovacao Arte',
  'Registrar Reprovacao Arte',
  'Solicitar Feedback Arte',
  'Apresentar Opcoes Cliente',
  // Gabaritos e Templates
  'Criar Gabarito Corte',
  'Ajustar Gabarito',
  'Gabarito Vinil',
  'Gabarito Estencil',
  'Gabarito Mascara',
  'Testar Gabarito',
  // Preparação para Produção
  'Preparar Arquivo Plotagem',
  'Separar Cores Corte',
  'Espelhar Arte',
  'Ajustar Escala Impressao',
  'Gerar Arquivo Corte',
  'Enviar para Plotagem',
  'Calcular Metragem Material',
  'Especificar Materiais',
  // Outros
  'Outros',
] as const;

// =====================
// LOGISTIC - Coordination Actions (51 items including Outros)
// =====================
export const LOGISTIC_SERVICE_DESCRIPTIONS = [
  // Configuração de Tarefa
  'Configurar Tarefa',
  'Criar Tarefa',
  'Reagendar Tarefa',
  'Cancelar Tarefa',
  'Priorizar Tarefa',
  'Desprioritizar Tarefa',
  'Duplicar Tarefa',
  'Vincular Tarefas',
  // Agendamento
  'Agendar Entrada',
  'Confirmar Agendamento',
  'Reagendar Entrada',
  'Agendar Liberacao',
  'Definir Previsao',
  'Ajustar Previsao',
  'Reservar Data',
  'Bloquear Periodo',
  // Chegada e Recebimento
  'Registrar Chegada',
  'Receber Veiculo',
  'Checklist Entrada',
  'Fotografar Entrada',
  'Registrar Avarias Entrada',
  'Conferir Documentos Entrada',
  // Liberação e Saída
  'Liberar Veiculo',
  'Checklist Saida',
  'Fotografar Saida',
  'Conferir Servicos Executados',
  'Termo Responsabilidade',
  'Entregar Chaves',
  // Barracão e Espaço
  'Alocar Vaga',
  'Transferir Vaga',
  'Liberar Vaga',
  'Verificar Disponibilidade',
  'Reservar Espaco',
  'Organizar Fila Producao',
  // Comunicação com Cliente
  'Avisar Cliente Chegada',
  'Avisar Cliente Liberacao',
  'Enviar Previsao Cliente',
  'Confirmar Horario Cliente',
  'Ligar para Cliente',
  'Enviar Whatsapp Cliente',
  'Atualizar Cliente Status',
  'Solicitar Retirada',
  // Cadastro de Cliente
  'Cadastrar Cliente Logistica',
  'Atualizar Dados Cliente',
  'Registrar Contato Cliente',
  'Validar Endereco Cliente',
  // Coordenação Interna
  'Cobrar Setor Producao',
  'Verificar Andamento',
  'Redistribuir Tarefa',
  'Escalar Prioridade',
  // Outros
  'Outros',
] as const;

// =====================
// Type Definitions
// =====================
export type ProductionServiceDescription =
  (typeof PRODUCTION_SERVICE_DESCRIPTIONS)[number];
export type CommercialServiceDescription =
  (typeof COMMERCIAL_SERVICE_DESCRIPTIONS)[number];
export type FinancialServiceDescription =
  (typeof FINANCIAL_SERVICE_DESCRIPTIONS)[number];
export type ArtworkServiceDescription =
  (typeof ARTWORK_SERVICE_DESCRIPTIONS)[number];
export type LogisticServiceDescription =
  (typeof LOGISTIC_SERVICE_DESCRIPTIONS)[number];

// =====================
// Helper to get descriptions by type
// =====================
export const SERVICE_DESCRIPTIONS_BY_TYPE: Record<
  SERVICE_ORDER_TYPE,
  readonly string[]
> = {
  [SERVICE_ORDER_TYPE.PRODUCTION]: PRODUCTION_SERVICE_DESCRIPTIONS,
  [SERVICE_ORDER_TYPE.COMMERCIAL]: COMMERCIAL_SERVICE_DESCRIPTIONS,
  [SERVICE_ORDER_TYPE.FINANCIAL]: FINANCIAL_SERVICE_DESCRIPTIONS,
  [SERVICE_ORDER_TYPE.ARTWORK]: ARTWORK_SERVICE_DESCRIPTIONS,
  [SERVICE_ORDER_TYPE.LOGISTIC]: LOGISTIC_SERVICE_DESCRIPTIONS,
};

/**
 * Get service descriptions for a specific type
 */
export function getServiceDescriptionsByType(
  type: SERVICE_ORDER_TYPE,
): readonly string[] {
  return SERVICE_DESCRIPTIONS_BY_TYPE[type] || [];
}

/**
 * Check if a description is valid for a given type
 * Case-insensitive comparison
 */
export function isValidServiceDescription(
  type: SERVICE_ORDER_TYPE,
  description: string,
): boolean {
  const descriptions = SERVICE_DESCRIPTIONS_BY_TYPE[type];
  if (!descriptions) return false;
  const normalizedDescription = description.toLowerCase().trim();
  return descriptions.some((d) => d.toLowerCase() === normalizedDescription);
}

/**
 * Default service order for new tasks (COMMERCIAL type with "Em Negociacao")
 */
export const DEFAULT_TASK_SERVICE_ORDER = {
  type: SERVICE_ORDER_TYPE.COMMERCIAL,
  description: 'Em Negociacao',
} as const;
