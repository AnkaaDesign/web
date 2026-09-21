// web/src/components/cliente/veiculo/index.ts
//
// A frota do cliente e o acompanhamento do serviço — as peças do pacote WEB-4.
// As páginas vivem em `pages/cliente/veiculos/`; os dados e os hooks são de
// `@/api-client/portal`.
export { VeiculoIdentidadeCard } from "./veiculo-identidade-card";
export { VeiculoAndamentoCard, VeiculoAndamentoConteudo } from "./veiculo-andamento-card";
export {
  PORTAL_VEICULOS_DEFAULT_SORTING,
  VEICULO_SORT_FIELD_MAP,
  buildVeiculoOrderBy,
  createPortalVeiculoColumns,
  portalVeiculoRowClassName,
} from "./veiculo-table-columns";
export type { PortalVeiculoColumnOptions } from "./veiculo-table-columns";
export {
  portalFileUrl,
  portalThumbnailUrl,
  portalVinPlateThumbUrl,
  portalVinPlateUrl,
} from "./portal-file-url";
// ⚠️ Os tipos do veículo são de `@/api-client/portal`, reexportados aqui só por
// conveniência de import. Este pacote NÃO declara forma própria: a que existia
// (`PortalVeiculoRow`, `PortalVeiculoDetalhe`, `PortalMarcoComFoto`) descrevia
// lacunas que eram do DTO e não da API. Ver `./types.ts`.
export type {
  PortalFile,
  PortalVehicle,
  PortalVehicleDetail,
  PortalVehicleIdentity,
  PortalVehicleProgress,
  PortalTimelineEntry,
} from "./types";
