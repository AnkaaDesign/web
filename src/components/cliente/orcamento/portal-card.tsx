// web/src/components/cliente/orcamento/portal-card.tsx
//
// ⛔ O MOLDE MUDOU DE ENDEREÇO — ele agora é UM SÓ, e mora em
// `components/cliente/portal-detail.tsx`.
//
// Havia três moldes concorrentes de card nesta área (este, `PortalSectionCard` e
// `<Card>` cru nos cards de veículo) e o dono via os três na mesma sessão. Este
// arquivo fica como reexportação para não espalhar o conserto por todo import
// da pasta.
//
// ⛔ E `PortalField`/`PortalFieldGrid` SAÍRAM. Eles empilhavam rótulo sobre
// valor, sem fundo — o oposto exato do `DetailRow` da casa
// (`ui/detail-row.tsx`), que é a linha rótulo/valor de TODA tela de detalhe do
// lado funcionário: fundo `bg-muted/50`, rótulo à esquerda, valor à direita.
// Quem precisa de par rótulo/valor usa `DetailRow`; ele importa só `react` e
// `cn`, então é seguro fora do `AuthProvider`.
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
} from "../portal-detail";
export type { PortalBandItem, PortalCardProps } from "../portal-detail";
