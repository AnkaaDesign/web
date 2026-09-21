// web/src/components/cliente/solicitacao/index.ts
//
// O assistente de requisição do portal do cliente (contrato §5 / desenho §6.2).
export { SolicitacaoStepCliente } from "./step-cliente";
export { SolicitacaoStepBriefing } from "./step-briefing";
export { SolicitacaoStepVeiculos } from "./step-veiculos";
export { SolicitacaoStepPintura } from "./step-pintura";
export { SolicitacaoStepRevisao } from "./step-revisao";
export { PortalCustomerCombobox } from "./portal-customer-combobox";
export { NovoClienteDialog } from "./novo-cliente-dialog";
export { ClienteReaproveitadoDialog } from "./cliente-reaproveitado-dialog";
export { NovaTintaDialog } from "./nova-tinta-dialog";

export {
  LADO_DO_IMPLEMENTO,
  MAX_BASE_FILES,
  MAX_VEICULOS,
  MEDIDA_PADRAO_ALTURA_CM,
  MEDIDA_PADRAO_LARGURA_CM,
  NOVA_TINTA_VALUE,
  NOVO_CLIENTE_VALUE,
  ROTULO_DO_LADO,
  buildSolicitacaoPayload,
  expandSerialRange,
  medidaLadoDoFormulario,
  medidaLadoParaFormulario,
  medidaLadoSchema,
  medidaSecaoSchema,
  medidasSchema,
  novaTintaSchema,
  novasMedidas,
  novaMedidaLado,
  novoClienteSchema,
  novoVeiculo,
  solicitacaoSchema,
  veiculoSchema,
} from "./solicitacao-schema";
export type {
  LadoImplemento,
  MedidaLadoFormData,
  MedidasFormData,
  NovaTintaFormData,
  NovoClienteFormData,
  SolicitacaoFormData,
  VeiculoFormData,
} from "./solicitacao-schema";

export {
  buscarClientesDoPortal,
  buscarTintasDoPortal,
  listarTiposDeTinta,
} from "./solicitacao-api";
export type {
  PagedResult,
  PortalCustomerOption,
  PortalPaintOption,
  PortalPaintTypeOption,
} from "./solicitacao-api";
