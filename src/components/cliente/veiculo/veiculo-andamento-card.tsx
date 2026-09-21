// web/src/components/cliente/veiculo/veiculo-andamento-card.tsx
//
// A LINHA DO TEMPO DO SERVIÇO — e o motivo de ela ser BURRA.
//
// ⚠️ ESTE COMPONENTE NÃO DECIDE NADA. Ele desenha, na ordem recebida, a
// projeção que o servidor mandou. Não deriva etapa de status, não ordena por
// data, não esconde marco "que não faz sentido", não completa buraco.
//
// Por quê: os carimbos de produção são APAGADOS em operação normal. Uma O.S.
// que volta para `PENDING` zera as próprias datas; cancelar todas as O.S. de
// produção zera `Task.startedAt`; `COMPLETED → PREPARATION` é transição legal.
// Uma linha do tempo lida AO VIVO do status regride — e um cliente que viu
// "Concluído" lê "Em Preparação" na semana seguinte. Por isso a projeção é
// MONOTÔNICA e vive no servidor (§9 do CONTRATO, §6.3 do desenho). Qualquer
// recálculo aqui reintroduz exatamente o defeito que a projeção existe para
// impedir.
//
// ⚠️ A FORMA É A DO SERVIDOR. `progress.timeline[]` é
// `{ key, label, order, reached, reachedAt }` — não `{ at, done }`, que era a
// invenção do DTO antigo. E `reachedAt: null` num marco `reached: true` NÃO é
// "sem data": é "o carimbo foi apagado e só o changelog prova o fato". Inventar
// a data seria pior que omiti-la, e é por isso que a linha diz "data não
// registrada" em vez de cair no silêncio de um traço.
//
// ── As ETAPAS são outra lista ───────────────────────────────────────────────
//
// `progress.steps[]` são as O.S. de PRODUÇÃO, com descrição e estado próprio
// (`PENDING`/`IN_PROGRESS`/`COMPLETED`, com `PAUSED` já reescrito para
// `IN_PROGRESS` na origem — para o cliente uma etapa pausada é uma etapa em
// andamento, e a pausa é quase sempre almoço ou fila de cabine). Elas moram
// abaixo da escada porque respondem outra pergunta: a escada diz EM QUE PÉ ESTÁ,
// as etapas dizem O QUE ESTÁ SENDO FEITO.
//
// ⛔ O que nunca aparece aqui, e o servidor já filtra: O.S. de tipo `COMMERCIAL`
// (52 descrições, entre elas "Aplicar Desconto", "Contraproposta" e "Tratar
// Reclamação"), tempo trabalhado, quem executou, pausa, vaga no barracão,
// bonificação, observação, detalhe da tarefa, motivo de recorte, preço de
// aerografia e `Task.term`.
import type { ReactNode } from "react";
import { IconCheck, IconClock, IconLock, IconPhoto, IconTimelineEvent } from "@tabler/icons-react";

import type { PortalFile, PortalStep, PortalVehicleProgress } from "@/api-client/portal";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { formatDate, formatDateTime } from "@/utils";
import { cn } from "@/lib/utils";
import { PortalCard, PortalSubheading } from "../portal-detail";
import { PortalTable, type PortalTableColumn } from "../portal-table";

import { portalFileUrl, portalThumbnailUrl } from "./portal-file-url";

function Fotos({ photos, label }: { photos: PortalFile[]; label: string }) {
  if (!photos.length) return null;
  return (
    <div className="space-y-1.5">
      <PortalSubheading className="text-muted-foreground">{label}</PortalSubheading>
      <ul className="flex flex-wrap gap-2">
        {photos.map((photo) => (
          <li key={photo.id}>
            {/* Abre em guia nova, e não num modal: o visualizador de arquivos do
                app mora dentro do `FileViewerProvider`, que é do lado FUNCIONÁRIO
                — a árvore do portal não o tem, e um modal sem provider abriria um
                nada silencioso. */}
            <a
              href={portalFileUrl(photo)}
              target="_blank"
              rel="noreferrer"
              className="block overflow-hidden rounded-md border border-border transition-opacity hover:opacity-90"
              title={photo.originalName ?? photo.filename ?? label}
            >
              <img
                src={portalThumbnailUrl(photo)}
                alt={photo.originalName ?? photo.filename ?? label}
                loading="lazy"
                className="h-20 w-20 object-cover"
              />
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

function MarcoLinha({
  label,
  reached,
  reachedAt,
  atual,
  ultimo,
}: {
  label: string;
  reached: boolean;
  reachedAt: string | null;
  atual: boolean;
  ultimo: boolean;
}) {
  return (
    <li className="relative flex gap-3 pb-6 last:pb-0">
      {/* O fio. Vai do marcador até o próximo; some no último para a linha não
          continuar apontando para lugar nenhum. */}
      {!ultimo && (
        <span
          aria-hidden
          className={cn(
            "absolute bottom-0 left-[11px] top-6 w-px",
            reached ? "bg-primary/40" : "bg-border",
          )}
        />
      )}

      <span
        aria-hidden
        className={cn(
          "relative z-10 mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2",
          reached && "border-primary bg-primary text-primary-foreground",
          !reached && atual && "border-primary bg-background text-primary",
          !reached && !atual && "border-border bg-background text-muted-foreground",
        )}
      >
        {reached ? (
          <IconCheck className="h-3.5 w-3.5" />
        ) : atual ? (
          <IconClock className="h-3.5 w-3.5" />
        ) : (
          <span className="h-1.5 w-1.5 rounded-full bg-current" />
        )}
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
          <p
            className={cn(
              "text-sm",
              reached || atual ? "font-medium text-foreground" : "text-muted-foreground",
            )}
          >
            {label}
          </p>

          {reachedAt ? (
            <time
              dateTime={reachedAt}
              title={formatDateTime(reachedAt)}
              className="shrink-0 text-sm tabular-nums text-muted-foreground"
            >
              {formatDate(reachedAt)}
            </time>
          ) : (
            <span className="shrink-0 text-sm text-muted-foreground">
              {/* ⚠️ Marco ATINGIDO sem data é o carimbo apagado — o changelog
                  prova o fato e a data não existe mais. Dizer isso é honesto;
                  inventar uma data, não. */}
              {reached ? "data não registrada" : atual ? "em andamento" : "a fazer"}
            </span>
          )}
        </div>
      </div>
    </li>
  );
}

/**
 * AS ETAPAS — as ORDENS DE SERVIÇO de produção, em tabela.
 *
 * ⛔ Eram um `<ul class="divide-y">` com dois `<span>` por linha, e o estado da
 * etapa só aparecia quando NÃO havia data ("a fazer" no lugar do dia). Quem
 * estava lendo tinha de inferir a situação da ausência de um carimbo. Agora são
 * três colunas nomeadas, sobre `PortalTable` — o mesmo desenho das parcelas e
 * dos serviços, na mesma tela.
 *
 * ⚠️ SÓ EXISTEM PARA O.S. DE TIPO `PRODUCTION` NÃO CANCELADAS: o servidor já
 * filtra, e `steps: []` é o normal de um veículo que ainda não entrou na fila.
 * Vazio aqui não desenha tabela nenhuma — ver o `etapas.length > 0` abaixo.
 */
const ETAPA_BADGE: Record<PortalStep["status"], { label: string; variant: BadgeProps["variant"] }> = {
  PENDING: { label: "A fazer", variant: "secondary" },
  IN_PROGRESS: { label: "Em andamento", variant: "inProgress" },
  COMPLETED: { label: "Concluída", variant: "completed" },
};

const etapaColumns: Array<PortalTableColumn<PortalStep>> = [
  {
    id: "descricao",
    header: "Etapa",
    cell: (step) => <span className="text-sm">{step.description ?? "Etapa"}</span>,
  },
  {
    id: "situacao",
    header: "Situação",
    cell: (step) => {
      const badge = ETAPA_BADGE[step.status];
      return (
        <Badge variant={badge.variant} size="sm">
          {badge.label}
        </Badge>
      );
    },
  },
  {
    id: "quando",
    header: "Quando",
    align: "right",
    className: "whitespace-nowrap tabular-nums text-muted-foreground",
    cell: (step) =>
      step.finishedAt
        ? formatDate(step.finishedAt)
        : step.startedAt
          ? `desde ${formatDate(step.startedAt)}`
          : "—",
  },
];

export interface VeiculoAndamentoProps {
  /**
   * `PortalVehicle.progress` — `undefined` quando o contato não tem a seção
   * `DELIVERY`.
   *
   * ⚠️ "Nenhum marco" e "você não vê marcos" são estados diferentes, e o cliente
   * precisa saber em qual está — senão fica esperando por uma tela que nunca vai
   * preencher. Por isso o `undefined` tem um vazio PRÓPRIO, e não o mesmo do
   * serviço que ainda não começou.
   */
  progress: PortalVehicleProgress | undefined;
  /** `true` quando o veículo foi cancelado — a escada perde o sentido. */
  cancelled?: boolean | null;
}

/**
 * O CONTEÚDO, SEM O CARTÃO.
 *
 * Existe separado porque o andamento aparece em DOIS lugares com molduras
 * diferentes: sozinho no detalhe do veículo (um cartão por veículo) e dentro do
 * detalhe do ORÇAMENTO, onde N caminhões dividem UM cartão com seletor. Aninhar
 * cartão dentro de cartão para reaproveitar o componente seria pagar a moldura
 * duas vezes.
 */
export function VeiculoAndamentoConteudo({ progress, cancelled }: VeiculoAndamentoProps) {
  const marcos = progress?.timeline ?? [];
  const etapas = progress?.steps ?? [];
  const checkin = progress?.checkinFiles ?? [];
  const checkout = progress?.checkoutFiles ?? [];
  const temFoto = checkin.length > 0 || checkout.length > 0;

  // O primeiro passo ainda não atingido é o "em andamento". Os `reached` vêm do
  // servidor; aqui só se escolhe qual marcador fica cheio.
  const indiceAtual = marcos.findIndex((m) => !m.reached);

  if (!progress) {
    return (
      <EmptyState
        icon={<IconLock className="h-8 w-8" />}
        title="O andamento não faz parte do seu acesso"
        description="Quem acompanha a produção na sua empresa vê esta parte. Fale com o contato responsável pelo pedido."
        className="py-8"
      />
    );
  }

  if (marcos.length === 0) {
    return (
      <EmptyState
        icon={<IconTimelineEvent className="h-8 w-8" />}
        title="Ainda não há andamento para mostrar"
        description="Assim que o serviço avançar, cada etapa aparece aqui com a data."
        className="py-8"
      />
    );
  }

  return (
    <div className="space-y-4">
      {cancelled ? (
        <p className="rounded-lg bg-muted/50 px-4 py-2.5 text-sm text-muted-foreground">
          Este veículo foi cancelado. A linha abaixo mostra até onde o serviço chegou.
        </p>
      ) : null}

      <ol className="relative">
        {marcos.map((marco, index) => (
          <MarcoLinha
            key={marco.key}
            label={marco.label}
            reached={marco.reached}
            reachedAt={marco.reachedAt}
            atual={index === indiceAtual}
            ultimo={index === marcos.length - 1}
          />
        ))}
      </ol>

      {/* ⛔ SEM ETAPA, SEM TABELA — e sem carcaça. `steps: []` é o normal de
          quem ainda não entrou na fila de produção, e uma tabela vazia com três
          cabeçalhos sugeriria que algo sumiu. */}
      {etapas.length > 0 ? (
        <div className="space-y-1.5">
          <PortalSubheading>Ordens de serviço</PortalSubheading>
          <PortalTable columns={etapaColumns} rows={etapas} getRowId={(step) => step.id} />
        </div>
      ) : null}

      {temFoto ? (
        <div className="space-y-3">
          <Fotos photos={checkin} label="Como o veículo entrou" />
          <Fotos photos={checkout} label="Como o veículo saiu" />
        </div>
      ) : null}
    </div>
  );
}

export interface VeiculoAndamentoCardProps extends VeiculoAndamentoProps {
  /** O título do cartão. O detalhe do veículo não precisa nomear qual veículo. */
  titulo?: ReactNode;
  descricao?: ReactNode;
}

export function VeiculoAndamentoCard({
  progress,
  cancelled,
  titulo = "Andamento",
  descricao,
}: VeiculoAndamentoCardProps) {
  const temFoto =
    (progress?.checkinFiles?.length ?? 0) > 0 || (progress?.checkoutFiles?.length ?? 0) > 0;

  return (
    <PortalCard
      icon={IconTimelineEvent}
      title={titulo}
      description={descricao}
      actions={
        temFoto ? (
          <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <IconPhoto className="h-3.5 w-3.5 shrink-0" aria-hidden />
            Fotos de entrada e saída
          </span>
        ) : undefined
      }
    >
      <VeiculoAndamentoConteudo progress={progress} cancelled={cancelled} />
    </PortalCard>
  );
}
