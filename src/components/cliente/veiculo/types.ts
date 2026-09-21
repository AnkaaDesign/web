// web/src/components/cliente/veiculo/types.ts
//
// O QUE ESTE PACOTE DESENHA ALÉM DO QUE `api-client/portal.ts` DECLARA.
//
// ⚠️ ESTE ARQUIVO ENCOLHEU, e o motivo é bom: as duas "lacunas" que ele existia
// para contornar NÃO ERAM lacunas da API — eram do DTO, que foi escrito como
// proposta antes de o servidor existir. Reconciliados os tipos contra
// `portal-read.service.ts`, as duas desapareceram:
//
//   1. A PREVISÃO DE ENTREGA existe, em `vehicle.progress.forecastDate`. Era a
//      pergunta nº 1 do cliente ("quando fica pronto?") e a coluna desenhava
//      travessão porque `PortalVehicleSummary` não declarava o campo. ⚠️ É
//      `forecastDate`, NUNCA `Task.term` — o prazo interno está na lista do §9
//      do que não vai para o cliente.
//
//   2. AS FOTOS DE CHECK-IN/OUT existem, em `vehicle.progress.checkinFiles` e
//      `checkoutFiles` — relações de ARQUIVO da tarefa, sem depender de comparar
//      texto livre de descrição de O.S. Vêm `[]` na LISTA e preenchidas no
//      DETALHE.
//
// O que sobra aqui é o que de fato não vem do servidor: a régua de "o que falta
// identificar", que é DERIVADA (o servidor não manda booleano nenhum) e vive em
// `api-client/portal.ts` junto dos demais leitores do recorte.
//
// ⚠️ E NÃO HÁ `PortalVeiculoRow` nem `PortalVeiculoDetalhe`. A lista e o detalhe
// de `/cliente/me/veiculos` devolvem A MESMA forma (`assembleVehicles` é um
// caminho só), e dois aliases para o mesmo tipo convidavam a declarar menos num
// deles — que é exatamente como `layout` sumiu do orçamento. Use
// `PortalVehicleDetail` nos dois.
export type {
  PortalFile,
  PortalVehicle,
  PortalVehicleDetail,
  PortalVehicleIdentity,
  PortalVehicleProgress,
  PortalTimelineEntry,
} from "@/api-client/portal";
