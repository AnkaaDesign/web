// web/src/components/cliente/orcamento/index.ts
//
// As peças da área de ORÇAMENTOS do portal do cliente.
// ⚠️ O MOLDE É ÚNICO e mora em `components/cliente/portal-detail.tsx`; este
// caminho continua valendo por reexportação. `PortalField`/`PortalFieldGrid`
// SAÍRAM — par rótulo/valor nesta casa é `ui/detail-row.tsx`.
export {
  PortalBand,
  PortalBandSkeleton,
  PortalCard,
  PortalCardSkeleton,
  PortalDash,
  PortalErrorBanner,
  PortalRowLink,
  PortalRows,
  PortalSubheading,
  portalEst,
} from "./portal-card";
export type { PortalBandItem } from "./portal-card";
export { VehicleChips, vehicleChipLabel } from "./vehicle-chips";
export { createPortalBudgetColumns, PORTAL_BUDGET_STATUS_OPTIONS } from "./orcamento-columns";
export type { PortalBudgetColumnOptions } from "./orcamento-columns";
export {
  OrcamentoDecisaoCard,
  OrcamentoGarantiaCard,
  OrcamentoPropostaCard,
  OrcamentoValoresCard,
  orcamentoTemDecisao,
} from "./orcamento-proposta-card";
export { OrcamentoVeiculosCard, estOrcamentoVeiculos } from "./orcamento-veiculos-card";
export { OrcamentoAndamentoCard } from "./orcamento-andamento-card";
export { OrcamentoServicosCard } from "./orcamento-servicos-card";
export { OrcamentoLayoutCard } from "./orcamento-layout-card";
export { OrcamentoAssinaturasCard } from "./orcamento-assinaturas-card";
export { OrcamentoCobrancaCard } from "./orcamento-cobranca-card";
export { PreAprovacaoActions, canDecideBudget } from "./pre-aprovacao-actions";
export type { PreAprovacaoActionsProps } from "./pre-aprovacao-actions";
export {
  PORTAL_ROLE_SECTIONS,
  PORTAL_SECTION_IMPLIED_BY_CAPABILITY,
  sectionsForResponsibleRoles,
  portalSectionsForRoles,
  resolvePortalSections,
  hasPortalSection,
  portalRoleSigns,
} from "./sections";
export {
  PORTAL_WAITING_BY_STATUS,
  PORTAL_WAITING_TONE_CLASS,
  portalWaitingOn,
} from "./waiting-on";
export type { PortalWaitingOn, PortalWaitingTone } from "./waiting-on";
