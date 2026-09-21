// web/src/components/cliente/orcamento/orcamento-layout-card.tsx
//
// O LAYOUT — seção `LAYOUT`, agrupado POR ARTE e não por veículo.
//
// ⛔ O DEFEITO QUE O DONO VIU: *"mesmo que tenha 3 veículos, não precisaria
// mostrar layout para os 3, já que será o mesmo"*. Esta tela iterava
// `vehicles.filter(v => !!v.layout)` e abria UM acordeão POR CAMINHÃO — três
// blocos idênticos, com as MESMAS miniaturas, para uma arte só.
//
// E eram literalmente as mesmas: `Layout`, `File` e `Paint` são relações N:N com
// a tarefa, então a frota que recebe a mesma arte aponta para as MESMAS LINHAS.
// A repetição não era um dado se repetindo — era a tela desenhando o mesmo
// registro três vezes, e ainda pedindo ao navegador três vezes cada miniatura.
//
// ── Como se agrupa ─────────────────────────────────────────────────────────
//
// Pela ASSINATURA da arte: `[pintura geral, cores da logomarca, artes,
// arquivos-base]`, cada lista pelos IDs em ordem. Mesma assinatura, mesmo
// bloco; as etiquetas dos caminhões que a partilham vão no cabeçalho dele. Uma
// arte só ⇒ um bloco só, aberto, SEM acordeão — que é o caso comum.
//
// ⚠️ IDs, e nunca conteúdo: comparar nome de arquivo ou hex de tinta juntaria
// duas artes homônimas de veículos diferentes, e é exatamente o erro que
// esconderia do cliente uma arte que ele precisa aprovar.
//
// ⛔ POR QUE O CARD NÃO EXISTIA. O contato de MARKETING tem `LAYOUT` como ÚNICA
// seção: ele abre o portal exatamente para ver a arte que vai aprovar, e não vê
// preço, serviço, prazo nem cobrança. O detalhe do orçamento desenhava cinco
// cards e nenhum deles era o dele. A causa não era falta de dado —
// `portal-read.service.ts` manda `budget.layout.files` e `vehicle.layout` desde
// sempre para quem tem a seção; quem não declarava os campos era o DTO do web.
//
// ── O que entra aqui, e de onde ─────────────────────────────────────────────
//
//   • ARTES DO ORÇAMENTO (`budget.layout.files`) — os arquivos pendurados no
//     documento, valem para a coleta inteira;
//   • POR ARTE (`vehicle.layout`) — tinta geral, tintas de logomarca,
//     arquivos-base enviados na requisição e as ARTES APROVADAS. ⚠️ Só as
//     aprovadas: um layout em revisão é conversa interna, e mandá-lo ao cliente
//     é pedir aprovação do que ainda não foi proposto. O filtro é do servidor.
import { useState } from "react";
import { IconChevronDown, IconPalette, IconPhoto } from "@tabler/icons-react";

import type { PortalBudget, PortalFile, PortalPaint, PortalVehicle } from "@/api-client/portal";
import { EmptyState } from "@/components/ui/empty-state";
import { portalFileUrl, portalThumbnailUrl } from "@/components/cliente/veiculo/portal-file-url";
import { cn } from "@/lib/utils";
import { PortalCard, PortalSubheading } from "../portal-detail";
import { VehicleChips } from "./vehicle-chips";

/**
 * A grade de arquivos.
 *
 * Abre em guia nova, e não num modal: o visualizador de arquivos do app mora
 * dentro do `FileViewerProvider`, que é do lado FUNCIONÁRIO — a árvore do portal
 * não o tem, e um modal sem provider abriria um nada silencioso.
 */
function Arquivos({ files, label }: { files: PortalFile[]; label: string }) {
  if (!files.length) return null;
  return (
    <div className="space-y-1.5">
      <PortalSubheading className="text-muted-foreground">{label}</PortalSubheading>
      <ul className="flex flex-wrap gap-2">
        {files.map((file) => (
          <li key={file.id}>
            <a
              href={portalFileUrl(file)}
              target="_blank"
              rel="noreferrer"
              className="block overflow-hidden rounded-md border border-border transition-opacity hover:opacity-90"
              title={file.originalName ?? file.filename ?? label}
            >
              {file.mimetype?.startsWith("image/") ? (
                <img
                  src={portalThumbnailUrl(file)}
                  alt={file.originalName ?? file.filename ?? label}
                  loading="lazy"
                  className="h-24 w-24 object-cover"
                />
              ) : (
                // Arquivo sem miniatura (PDF, EPS, CDR): ÍCONE, e o nome no
                // `title` do link. Uma legenda de 12 px dentro de um quadro de
                // 96 px seria o único texto do portal menor que `text-sm` — e a
                // regra do §10 (rótulo nunca menor que o controle ao lado) vale
                // mais do que caber o nome inteiro, que o `title` já entrega.
                <span className="flex h-24 w-24 items-center justify-center">
                  <IconPhoto className="h-6 w-6 text-muted-foreground" aria-hidden />
                </span>
              )}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Uma tinta: a amostra de cor, o nome e o acabamento. */
function Tinta({ paint }: { paint: PortalPaint }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-md border border-border px-2 py-1">
      <span
        aria-hidden
        className="h-4 w-4 shrink-0 rounded-sm border border-border"
        style={paint.hex ? { backgroundColor: paint.hex } : undefined}
      />
      <span className="text-sm">
        {paint.name ?? "Tinta sem nome"}
        {paint.finish ? <span className="text-muted-foreground"> · {paint.finish}</span> : null}
      </span>
    </span>
  );
}

/** Um veículo COM layout — o `?` do tipo já foi resolvido pelo agrupador. */
type VeiculoComLayout = PortalVehicle & { layout: NonNullable<PortalVehicle["layout"]> };

interface ArteAgrupada {
  /** A assinatura — é ela que decide se dois caminhões partilham a arte. */
  key: string;
  layout: NonNullable<PortalVehicle["layout"]>;
  vehicles: VeiculoComLayout[];
}

/**
 * A ASSINATURA DE UMA ARTE.
 *
 * ⚠️ As listas vão ORDENADAS: o servidor não promete ordem de relação N:N, e
 * `["a","b"]` contra `["b","a"]` são a mesma arte — sem o `sort`, o mesmo layout
 * viraria dois blocos conforme a ordem em que o Prisma devolveu as linhas.
 */
function assinaturaDoLayout(layout: NonNullable<PortalVehicle["layout"]>): string {
  const ids = (list: Array<{ id: string }>) => list.map((item) => item.id).sort().join(",");
  return [
    layout.generalPainting?.id ?? "",
    ids(layout.logoPaints),
    ids(layout.artworks),
    ids(layout.baseFiles),
  ].join("|");
}

function temConteudo(layout: NonNullable<PortalVehicle["layout"]>): boolean {
  return (
    !!layout.generalPainting ||
    layout.logoPaints.length > 0 ||
    layout.baseFiles.length > 0 ||
    layout.artworks.length > 0
  );
}

/** Agrupa na ORDEM DOS VEÍCULOS — o primeiro caminhão que traz a arte a ancora. */
function agruparPorArte(vehicles: PortalVehicle[]): ArteAgrupada[] {
  const grupos: ArteAgrupada[] = [];
  const porChave = new Map<string, ArteAgrupada>();

  for (const vehicle of vehicles) {
    const layout = vehicle.layout;
    // ⚠️ Layout VAZIO não vira bloco. Desenhar "nada de layout registrado para
    // este veículo" era a carcaça que o sistema não desenha — e num orçamento
    // de quinze caminhões eram quinze delas.
    if (!layout || !temConteudo(layout)) continue;

    const key = assinaturaDoLayout(layout);
    const existente = porChave.get(key);
    if (existente) {
      existente.vehicles.push(vehicle as VeiculoComLayout);
      continue;
    }
    const grupo: ArteAgrupada = { key, layout, vehicles: [vehicle as VeiculoComLayout] };
    porChave.set(key, grupo);
    grupos.push(grupo);
  }

  return grupos;
}

function ArteConteudo({ layout }: { layout: NonNullable<PortalVehicle["layout"]> }) {
  return (
    <div className="space-y-3">
      {layout.generalPainting || layout.logoPaints.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {layout.generalPainting ? (
            <div className="space-y-1.5">
              <PortalSubheading className="text-muted-foreground">Pintura geral</PortalSubheading>
              <Tinta paint={layout.generalPainting} />
            </div>
          ) : null}
          {layout.logoPaints.length > 0 ? (
            <div className="space-y-1.5">
              <PortalSubheading className="text-muted-foreground">Cores da logomarca</PortalSubheading>
              <div className="flex flex-wrap gap-1.5">
                {layout.logoPaints.map((paint) => (
                  <Tinta key={paint.id} paint={paint} />
                ))}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      <Arquivos files={layout.artworks} label="Artes aprovadas" />
      <Arquivos files={layout.baseFiles} label="Arquivos de referência" />
    </div>
  );
}

export function OrcamentoLayoutCard({ budget }: { budget: PortalBudget }) {
  // ⚠️ A RESPOSTA É A RÉGUA. `budget.layout` só existe quando o recorte inclui
  // `LAYOUT` — o projetor cria o objeto dentro do `hasSection`, e nunca com
  // campos nulos. Perguntar ao espelho local seria perguntar a uma segunda
  // verdade sobre o que o servidor acabou de decidir.
  const canSee = !!budget.layout || (budget.vehicles ?? []).some((v) => !!v.layout);
  const artes = agruparPorArte(budget.vehicles ?? []);
  // ACORDEÃO DE EXPANSÃO ÚNICA (§10) — e só quando há MAIS DE UMA arte. Com uma
  // só, não há escolha a fazer e o clique a mais é puro atrito.
  const [expandida, setExpandida] = useState<string | null>(null);

  if (!canSee) return null;

  const arquivosDoOrcamento = budget.layout?.files ?? [];
  const vazio = arquivosDoOrcamento.length === 0 && artes.length === 0;
  const arteUnica = artes.length === 1;

  return (
    <PortalCard
      icon={IconPalette}
      title="Layout"
      description={
        arteUnica && artes[0].vehicles.length > 1
          ? `A mesma arte para os ${artes[0].vehicles.length} veículos deste orçamento.`
          : "As artes, os arquivos de referência e as cores de pintura deste orçamento."
      }
    >
      {vazio ? (
        // ⚠️ VAZIO COM INTENÇÃO, e não carcaça: para o contato de MARKETING esta
        // é a ÚNICA seção do recorte. Sumir com o card deixaria a tela dele em
        // branco sem dizer por quê.
        <EmptyState
          className="py-8"
          icon={<IconPalette className="h-8 w-8" />}
          title="Nenhuma arte ainda"
          description="Assim que a Ankaa registrar o layout deste orçamento, ele aparece aqui — e você recebe o aviso no seu contato cadastrado."
        />
      ) : (
        <div className="space-y-4">
          <Arquivos files={arquivosDoOrcamento} label="Artes do orçamento" />

          {arteUnica ? (
            <div className="space-y-3">
              {/* Uma arte para vários caminhões: as etiquetas dizem QUAIS, sem
                  repetir o bloco para cada um. */}
              {artes[0].vehicles.length > 1 ? (
                <VehicleChips vehicles={artes[0].vehicles} limit={artes[0].vehicles.length} />
              ) : null}
              <ArteConteudo layout={artes[0].layout} />
            </div>
          ) : (
            artes.map((arte, index) => {
              const aberta = expandida === arte.key;
              return (
                <div key={arte.key} className="rounded-lg border border-border">
                  <button
                    type="button"
                    aria-expanded={aberta}
                    onClick={() => setExpandida((atual) => (atual === arte.key ? null : arte.key))}
                    className="flex w-full items-start justify-between gap-3 px-3 py-2.5 text-left transition-colors hover:bg-muted/50"
                  >
                    <div className="min-w-0 space-y-1">
                      <p className="text-sm font-medium">
                        Arte {index + 1}
                        <span className="text-muted-foreground">
                          {" · "}
                          {arte.vehicles.length === 1
                            ? "1 veículo"
                            : `${arte.vehicles.length} veículos`}
                        </span>
                      </p>
                      <VehicleChips vehicles={arte.vehicles} limit={4} />
                    </div>
                    <IconChevronDown
                      aria-hidden
                      className={cn(
                        "mt-0.5 h-4 w-4 shrink-0 text-muted-foreground transition-transform",
                        aberta && "rotate-180",
                      )}
                    />
                  </button>
                  {aberta ? (
                    <div className="border-t border-border px-3 py-3">
                      <ArteConteudo layout={arte.layout} />
                    </div>
                  ) : null}
                </div>
              );
            })
          )}
        </div>
      )}
    </PortalCard>
  );
}
