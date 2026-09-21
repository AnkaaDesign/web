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
import { Fragment, type ReactNode } from "react";
import { IconCheck, IconClock, IconLock, IconPhoto, IconTimelineEvent } from "@tabler/icons-react";

import type { PortalFile, PortalStep, PortalVehicleProgress } from "@/api-client/portal";
import type { BadgeProps } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { formatDate, formatDateTime } from "@/utils";
import { cn } from "@/lib/utils";
import { PortalCard, PortalSubheading } from "../portal-detail";

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
  children,
}: {
  label: string;
  reached: boolean;
  reachedAt: string | null;
  atual: boolean;
  ultimo: boolean;
  /** As O.S. penduradas NESTE marco — ver `VeiculoAndamentoConteudo`. */
  children?: ReactNode;
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

        {children ? <div className="mt-2 space-y-1.5">{children}</div> : null}
      </div>
    </li>
  );
}

/**
 * UMA ORDEM DE SERVIÇO, PENDURADA NO MARCO "Em produção".
 *
 * ⛔ ERA UMA TABELA SOLTA embaixo da linha do tempo ("Ordens de serviço", três
 * colunas). Decisão do dono: a produção não é um anexo do andamento — ela é o
 * andamento. Com a tabela à parte, a linha dizia "Em produção · 09/10" e ponto,
 * e o cliente tinha de descer, achar a tabela e casar as datas de cabeça para
 * descobrir o que estava sendo feito no caminhão dele.
 *
 * Aqui cada O.S. é um degrau DENTRO do marco, com início e fim próprios: a
 * pergunta "em que pé está?" e a pergunta "o que já foi feito?" passam a ter
 * uma resposta só, lida de cima para baixo.
 *
 * ⚠️ O PONTO SEGUE O ESTADO DA O.S., não o do marco: uma etapa ainda em
 * andamento dentro de uma produção já concluída é possível (retrabalho), e
 * pintá-la de verde por herança mentiria sobre o que está aberto.
 */
/**
 * O ESTADO DE UMA ETAPA — as três palavras que a O.S. pode ter.
 *
 * ⛔ A TABELA DE "Ordens de serviço" SAIU e o BADGE também (decisão do dono, em
 * duas passadas): as etapas viraram degraus dentro do marco "Em produção", e o
 * estado delas é dito pelo MESMO marcador dos marcos — check, relógio, ponto
 * vazado. Este mapa sobreviveu porque a palavra continua necessária para quem
 * ouve a tela: é ela que vai no `sr-only` de `EtapaLinha`.
 *
 * ⚠️ SÓ EXISTEM O.S. DE TIPO `PRODUCTION` NÃO CANCELADAS: o servidor já filtra,
 * e `steps: []` é o normal de um veículo que ainda não entrou na fila.
 */
const ETAPA_BADGE: Record<PortalStep["status"], { label: string; variant: BadgeProps["variant"] }> = {
  PENDING: { label: "A fazer", variant: "secondary" },
  IN_PROGRESS: { label: "Em andamento", variant: "inProgress" },
  COMPLETED: { label: "Concluída", variant: "completed" },
};

function EtapaLinha({ step }: { step: PortalStep }) {
  const concluida = step.status === "COMPLETED";
  const correndo = step.status === "IN_PROGRESS";
  const inicio = step.startedAt ? formatDate(step.startedAt) : null;
  const fim = step.finishedAt ? formatDate(step.finishedAt) : null;

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg bg-muted/50 px-3 py-2">
      {/* ⛔ O BADGE "Concluída" SAIU (decisão do dono). Ele dizia em palavra o
          que o marcador já diz em símbolo, e numa coluna de quatro linhas
          viravam quatro etiquetas verdes disputando a atenção com as datas —
          que são a informação que muda de linha para linha. O estado agora é o
          MESMO vocabulário dos marcos acima: check para o que fechou, relógio
          para o que corre, ponto vazado para o que não começou. */}
      <span
        aria-hidden
        className={cn(
          "flex h-4 w-4 shrink-0 items-center justify-center rounded-full border",
          concluida && "border-primary bg-primary text-primary-foreground",
          correndo && "border-primary bg-background text-primary",
          !concluida && !correndo && "border-border bg-background text-muted-foreground",
        )}
      >
        {concluida ? (
          <IconCheck className="h-2.5 w-2.5" />
        ) : correndo ? (
          <IconClock className="h-2.5 w-2.5" />
        ) : (
          <span className="h-1 w-1 rounded-full bg-current" />
        )}
      </span>
      {/* A situação continua NOMEADA para quem não enxerga o símbolo. */}
      <span className="sr-only">{ETAPA_BADGE[step.status].label}</span>

      <span className="min-w-0 flex-1 truncate text-sm text-foreground">
        {step.description ?? "Etapa"}
      </span>

      {/* ⚠️ AS DUAS DATAS, e o travessão quando falta uma: "começou e não
          terminou" é justamente o estado que o cliente quer distinguir de
          "nem começou". */}
      <span className="shrink-0 text-sm tabular-nums text-muted-foreground">
        {inicio || fim ? (
          <>
            {inicio ?? "—"} <span aria-hidden>→</span> {fim ?? "—"}
          </>
        ) : (
          "a fazer"
        )}
      </span>
    </div>
  );
}

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

  // ── O CONTROLE DE QUALIDADE, DERIVADO ──────────────────────────────────
  // O porquê está no comentário da escada, logo abaixo.
  const todasConcluidas = etapas.length > 0 && etapas.every((e) => e.status === "COMPLETED");
  /** A MESMA data do marco `CONCLUIDO`: os dois terminam juntos. */
  const concluidoEm =
    marcos.find((m) => m.key === "CONCLUIDO" && m.reached)?.reachedAt ?? progress?.finishedAt ?? null;

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
          <Fragment key={marco.key}>
            {/* ⛔ O CONTROLE DE QUALIDADE É UM DEGRAU PRÓPRIO, e vem ANTES de
                "Concluído" — decisão do dono, segunda passada. Ele estava
                pendurado dentro de "Em produção", junto das O.S., e ali lia
                como se fosse mais uma ordem de serviço. Não é: as ordens
                acabam, o veículo passa pela conferência, e é a aprovação dela
                que conclui a tarefa.

                ⚠️ É DERIVADO, e de dois fatos que já estão na resposta: só
                existe quando TODA O.S. fechou, e carrega a data do marco
                `CONCLUIDO` — os dois terminam no mesmo instante. Sem esse
                marco, fica em andamento, que é a resposta honesta para "as
                ordens acabaram, e agora?". Ele não recalcula nada; a regra
                monotônica continua sendo do servidor. */}
            {marco.key === "CONCLUIDO" && todasConcluidas ? (
              <MarcoLinha
                label="Controle de qualidade"
                reached={!!concluidoEm}
                reachedAt={concluidoEm}
                atual={!concluidoEm}
                ultimo={false}
              />
            ) : null}

            <MarcoLinha
              label={marco.label}
              reached={marco.reached}
              reachedAt={marco.reachedAt}
              atual={index === indiceAtual}
              ultimo={index === marcos.length - 1}
            >
              {/* ⛔ SEM ETAPA, NADA PENDURADO. `steps: []` é o normal de quem
                  ainda não entrou na fila de produção, e uma carcaça vazia
                  sugeriria que algo sumiu.

                  ⚠️ O ALVO É `EM_PRODUCAO` PELA CHAVE, não pelo rótulo nem pela
                  posição: o rótulo é texto que se conserta e a posição muda se
                  um marco novo entrar na escada. A chave é o contrato do
                  servidor (`portal-read.service.ts`). */}
              {marco.key === "EM_PRODUCAO" && etapas.length > 0
                ? etapas.map((step) => <EtapaLinha key={step.id} step={step} />)
                : null}
            </MarcoLinha>
          </Fragment>
        ))}
      </ol>

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
