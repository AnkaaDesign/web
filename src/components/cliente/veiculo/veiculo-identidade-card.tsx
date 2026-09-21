// web/src/components/cliente/veiculo/veiculo-identidade-card.tsx
//
// O VEÍCULO NUM CARD SÓ — o que ele é, e o que dele se pode corrigir.
//
// ⛔ ERAM DOIS CARDS E UM FORMULÁRIO. "Identificação" desenhava quatro campos
// de texto com `Descartar` e `Salvar`, e "Sobre este veículo" repetia o mesmo
// molde ao lado com cinco linhas de leitura. Decisão do dono, com os prints na
// mão: vira UM card, e os campos deixam de ser formulário.
//
// ── POR QUE O FORMULÁRIO SAIU ───────────────────────────────────────────────
//
// Quem abre esta tela é o contato que está no pátio com a plaqueta na mão para
// corrigir UMA placa. O formulário o obrigava a administrar um rascunho: campos
// sempre abertos (ainda que não houvesse nada a mudar), um botão que só acende
// quando algo ficou sujo, e — porque existe rascunho — uma guarda de navegação,
// um diálogo de "alterações não salvas" e um estado `dirty` subindo por três
// componentes. Agora cada linha se grava sozinha no duplo clique, como na tela
// de detalhe do lado funcionário, e o que se perde ao sair é nada.
//
// ⚠️ CADA CAMPO VIAJA SOZINHO. `PATCH …/identificacao` recebe UMA chave por
// gravação: reenviar as outras três faria o servidor percorrer a unicidade, a
// escrita dupla do pedido de compra e a guarda do documento assinado para
// valores que ninguém tocou.
//
// ── O QUE NÃO MUDOU ─────────────────────────────────────────────────────────
//
//   · O SUB-PORTÃO do pedido de compra (`WRITE_PURCHASE_ORDER`): o gestor de
//     frota escreve placa e chassi e NÃO o pedido — mas continua VENDO o
//     número, porque escondê-lo faria abrir chamado por pendência que não
//     existe.
//   · O PAINEL DO 409: dado que já está no documento assinado não muda por
//     aqui, e a recusa fica na tela até o valor voltar ao que o documento
//     imprime.
//   · O AVISO ÂMBAR de placa/chassi faltando — é ele que liga a pendência à
//     emissão da nota e à entrega.
//   · A PLAQUETA só para LER. O cliente não é perguntado por ela; existindo a
//     foto, ele a vê.
//
// ⛔ AS DUAS EXPLICAÇÕES PERMANENTES SAÍRAM (decisão do dono): a do chassi
// ("17 caracteres, a norma do VIN não usa I, O e Q…") e a do pedido de compra
// ("é este número que a nota fiscal e o boleto citam…"). Elas ocupavam quatro
// linhas fixas embaixo de campos que quase nunca se editam. O que sobrevive é a
// RECUSA: as mesmas frases voltam, como erro, exatamente quando o valor as
// merece — e aí elas são a resposta a uma pergunta que a pessoa acabou de
// fazer, em vez de um aviso que ela lê toda vez que abre a tela.
import { useCallback } from "react";
import { IconAlertTriangle, IconCar, IconFileCertificate, IconLock } from "@tabler/icons-react";
import { Link } from "react-router-dom";

import {
  portalErrorMessage,
  portalErrorStatus,
  portalMissingIdentity,
  usePortalUpdateVehicleIdentity,
} from "@/api-client/portal";
import type { PortalVehicleDetail, PortalVehicleIdentity } from "@/api-client/portal";
import { Button } from "@/components/ui/button";
import { DetailRow } from "@/components/ui/detail-row";
import { QuoteStatusBadge } from "@/components/production/task/quote/quote-status-badge";
import { routes } from "@/constants/routes";
import {
  IMPLEMENT_TYPE_LABELS,
  TRUCK_CATEGORY_LABELS,
  type IMPLEMENT_TYPE,
  type TRUCK_CATEGORY,
} from "@/constants";
import {
  CHASSIS_FORBIDDEN_LETTERS,
  CHASSIS_FORBIDDEN_LETTERS_MESSAGE,
  CHASSIS_INVALID_MESSAGE,
  CHASSIS_REGEX,
  PLATE_INVALID_MESSAGE,
  PLATE_REGEX,
  formatChassis,
  formatDate,
  formatPlate,
} from "@/utils";
import { PortalCard, PortalRows } from "../portal-detail";
import { PortalInlineField } from "../portal-inline-field";

import { portalVinPlateThumbUrl, portalVinPlateUrl } from "./portal-file-url";

/**
 * O NÚMERO DO PEDIDO VIVE EM DOIS LUGARES, e o da direita é o novo.
 *
 * `purchaseOrder.number` é a entidade (`PurchaseOrder`, 1..N veículos);
 * `customerOrderNumber` é a coluna LEGADA, que a NFS-e, o boleto e a regra de
 * atenção ainda leem. O servidor escreve as DUAS no mesmo `update` e elas têm de
 * concordar sempre — mas os caminhos antigos (`PUT /tasks/:id`, a grade em lote)
 * escrevem só a coluna. Ler a entidade primeiro e a coluna depois é o que mostra
 * o número certo nos dois estados.
 */
/**
 * As opções dos dois seletores — derivadas do MAPA DE RÓTULOS, não digitadas.
 *
 * ⚠️ Uma lista escrita à mão aqui divergiria do enum no dia em que um valor
 * entrasse: o `Object.entries` garante que a tela ofereça exatamente o que o
 * servidor aceita.
 */
const CATEGORIA_OPCOES = Object.entries(TRUCK_CATEGORY_LABELS).map(([value, label]) => ({
  value,
  label,
}));
const IMPLEMENTO_OPCOES = Object.entries(IMPLEMENT_TYPE_LABELS).map(([value, label]) => ({
  value,
  label,
}));

function pedidoDe(identity: PortalVehicleIdentity | null): string {
  return identity?.purchaseOrder?.number?.trim() || identity?.customerOrderNumber?.trim() || "";
}

interface VeiculoIdentidadeCardProps {
  veiculo: PortalVehicleDetail;
  /** `hasPortalCapability(roles, WRITE_VEHICLE_IDENTITY)` — decidido pela página. */
  canWrite: boolean;
  /** `WRITE_PURCHASE_ORDER` — o sub-portão do número do pedido. */
  canWriteOrder?: boolean;
  /** Avisa a página que algo foi gravado (ela reconsulta). */
  onSaved?: () => void;
}

export function VeiculoIdentidadeCard({
  veiculo,
  canWrite,
  canWriteOrder = false,
  onSaved,
}: VeiculoIdentidadeCardProps) {
  const mutation = usePortalUpdateVehicleIdentity();

  const identity = veiculo.identity ?? null;
  const pedidoAtual = pedidoDe(identity);

  /**
   * UMA CHAVE POR GRAVAÇÃO — ver o cabeçalho.
   *
   * `""` vira `null`, que é como se APAGA um valor; o pedido de compra nunca
   * chega aqui vazio porque a validação do campo o recusa antes.
   */
  const gravar = useCallback(
    async (
      campo:
        | "serialNumber"
        | "plate"
        | "chassisNumber"
        | "purchaseOrderNumber"
        | "category"
        | "implementType"
        | "forecastDate",
      valor: string,
    ) => {
      await mutation.mutateAsync({
        taskId: veiculo.id,
        data: { [campo]: valor.trim() ? valor.trim() : null },
      });
      onSaved?.();
    },
    [mutation, veiculo.id, onSaved],
  );

  // O aviso do topo é sobre PLACA e CHASSI, não sobre série: são esses dois que
  // travam nota e entrega. Série faltando aparece na linha, e só.
  const bloqueando = portalMissingIdentity(veiculo).filter((campo) => campo !== "série");

  const erroStatus = mutation.isError ? portalErrorStatus(mutation.error) : 0;
  /** O 409 é o único que ganha painel fixo. Ver o cabeçalho deste arquivo. */
  const conflitoDocumento =
    erroStatus === 409
      ? portalErrorMessage(
          mutation.error,
          "Este dado já consta do documento em assinatura e não pode ser alterado por aqui.",
        )
      : null;

  const budget = veiculo.budget;
  const progress = veiculo.progress;
  const cliente = identity?.customer?.name ?? null;

  return (
    <PortalCard
      icon={IconCar}
      title="O veículo"
      actions={
        !canWrite ? (
          <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <IconLock className="h-3.5 w-3.5 shrink-0" aria-hidden />
            Somente leitura
          </span>
        ) : undefined
      }
      contentClassName="space-y-4"
    >
      {/* ⛔ O PAINEL DO DOCUMENTO ASSINADO — fixo, no TOPO, sem botão de fechar.
          Fica acima das linhas porque é ele que explica por que o valor
          digitado não entrou. */}
      {conflitoDocumento && (
        <div
          role="alert"
          aria-live="assertive"
          className="space-y-3 rounded-lg border-2 border-destructive bg-destructive/10 p-4"
        >
          <div className="flex items-start gap-3">
            <IconFileCertificate className="mt-0.5 h-5 w-5 shrink-0 text-destructive" aria-hidden />
            <div className="space-y-2">
              <p className="text-base font-semibold text-destructive">
                Este dado já está no documento assinado
              </p>
              <p className="text-sm text-destructive">{conflitoDocumento}</p>
              <p className="text-sm text-muted-foreground">
                Nada foi alterado: o cadastro continua igual ao que o documento imprime. Isto não é
                falha da tela e tentar de novo devolve a mesma resposta — mudar um dado que já foi
                assinado precisa do comercial da Ankaa, que corrige o cadastro e reemite o documento
                para assinatura.
              </p>
            </div>
          </div>
          <div className="flex justify-end">
            <Button type="button" variant="outline" size="sm" onClick={() => mutation.reset()}>
              Entendi
            </Button>
          </div>
        </div>
      )}

      {bloqueando.length > 0 && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2.5 text-sm text-amber-800 dark:text-amber-300">
          <IconAlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <p>
            {bloqueando.length === 2
              ? "Este veículo ainda está sem placa e sem chassi."
              : `Este veículo ainda está sem ${bloqueando[0]}.`}{" "}
            {canWrite
              ? "Corrija abaixo para liberar a emissão da nota e a entrega — duplo clique na linha."
              : "Peça a quem cuida da frota na sua empresa para informar esses dados."}
          </p>
        </div>
      )}

      <PortalRows>
        <PortalInlineField
          label="Número de série"
          value={identity?.serialNumber ?? ""}
          display={
            identity?.serialNumber ? (
              <span className="tabular-nums">{identity.serialNumber}</span>
            ) : (
              <ValorFaltando label="não informado" />
            )
          }
          canEdit={canWrite}
          placeholder="Ex.: 1042"
          validate={(v) => (v.length > 120 ? "Número de série longo demais" : null)}
          onCommit={(v) => gravar("serialNumber", v)}
        />

        <PortalInlineField
          label="Placa"
          value={identity?.plate ?? ""}
          display={
            identity?.plate ? (
              <span className="tabular-nums">{formatPlate(identity.plate)}</span>
            ) : (
              <ValorFaltando label="não informada" />
            )
          }
          canEdit={canWrite}
          inputType="plate"
          validate={(v) => (v && !PLATE_REGEX.test(v) ? PLATE_INVALID_MESSAGE : null)}
          onCommit={(v) => gravar("plate", v)}
        />

        <PortalInlineField
          label="Chassi"
          value={identity?.chassisNumber ?? ""}
          display={
            identity?.chassisNumber ? (
              <span className="tabular-nums">{formatChassis(identity.chassisNumber)}</span>
            ) : (
              <ValorFaltando label="não informado" />
            )
          }
          canEdit={canWrite}
          inputType="chassis"
          // ⚠️ AS DUAS MENSAGENS SÃO DUAS PERGUNTAS DIFERENTES. "17 caracteres"
          // responde a quem digitou de menos; a outra responde ao erro que de
          // fato acontece — a ISO 3779 proíbe I, O e Q no VIN justamente porque
          // se confundem com 1 e 0, e quem lê a plaqueta em campo escreve `O`
          // onde está `0`. Dizer "17 caracteres" a esse caso manda conferir o
          // TAMANHO, que está certo, e a pessoa fica presa.
          validate={(v) => {
            if (!v) return null;
            if (CHASSIS_FORBIDDEN_LETTERS.test(v)) return CHASSIS_FORBIDDEN_LETTERS_MESSAGE;
            if (!CHASSIS_REGEX.test(v)) return CHASSIS_INVALID_MESSAGE;
            return null;
          }}
          onCommit={(v) => gravar("chassisNumber", v)}
        />

        {/* ⛔ O SUB-PORTÃO — some o CAMPO, nunca o DADO. Saber o número é
            diferente de poder escrevê-lo. */}
        <PortalInlineField
          label="Número do pedido de compra"
          value={pedidoAtual}
          display={pedidoAtual ? <span>{pedidoAtual}</span> : undefined}
          canEdit={canWrite && canWriteOrder}
          placeholder="Ex.: 8842"
          // ⛔ APAGAR NÃO PASSA, e a recusa é DAQUI: o número é citado na nota
          // fiscal e no boleto, e a correção é informar o novo. O servidor
          // devolveria 400 depois da viagem; dizer antes evita que a pessoa
          // ache que salvou e apagou.
          validate={(v) => {
            if (v.length > 100) return "Número do pedido longo demais";
            if (pedidoAtual && !v) {
              return "O número do pedido não pode ser apagado pelo portal — ele é citado na nota fiscal e no boleto. Para corrigi-lo, informe o número novo.";
            }
            return null;
          }}
          onCommit={(v) => gravar("purchaseOrderNumber", v)}
          lockedHint={
            pedidoAtual ? (
              <span className="inline-flex shrink-0 items-center gap-1 text-xs font-normal text-muted-foreground">
                <IconLock className="h-3.5 w-3.5 shrink-0" aria-hidden />
                seu perfil não altera
              </span>
            ) : undefined
          }
        />

        {/* ── CATEGORIA E IMPLEMENTO ───────────────────────────────────────
            São do cliente tanto quanto a placa: quem sabe se o caminhão é um
            bitrem e se o baú é frigorífico é quem opera a frota. O portal os
            MOSTRAVA sem deixar corrigir — o erro ficava à vista do dono do dado
            e o conserto dependia de ligar para o comercial.

            ⚠️ O valor gravado é o do ENUM; o que aparece é o rótulo da casa
            (`TRUCK_CATEGORY_LABELS`), o mesmo do lado funcionário e o mesmo que
            o documento imprime. */}
        <PortalInlineField
          label="Categoria"
          value={identity?.category ?? ""}
          display={
            identity?.category ? (
              <span>
                {TRUCK_CATEGORY_LABELS[identity.category as TRUCK_CATEGORY] ?? identity.category}
              </span>
            ) : (
              <ValorFaltando label="não informada" />
            )
          }
          canEdit={canWrite}
          options={CATEGORIA_OPCOES}
          placeholder="Escolher categoria"
          onCommit={(v) => gravar("category", v)}
        />

        <PortalInlineField
          label="Implemento"
          value={identity?.implementType ?? ""}
          display={
            identity?.implementType ? (
              <span>
                {IMPLEMENT_TYPE_LABELS[identity.implementType as IMPLEMENT_TYPE] ??
                  identity.implementType}
              </span>
            ) : (
              <ValorFaltando label="não informado" />
            )
          }
          canEdit={canWrite}
          options={IMPLEMENTO_OPCOES}
          placeholder="Escolher implemento"
          onCommit={(v) => gravar("implementType", v)}
        />

        <PlaquetaLeitura identity={identity} />

        {/* ── O CONTEXTO, NA MESMA PILHA ─────────────────────────────────────
            ⛔ ERA UM CARD PRÓPRIO ao lado deste, e depois virou um subgrupo com
            o título "Sobre este veículo" dentro de um card chamado "O veículo" —
            a mesma frase duas vezes, e uma segunda pilha com respiro próprio que
            desalinhava a coluna de valores. Agora é UMA lista: o que separa o que
            se corrige do que só se lê é o comportamento da linha (duplo clique),
            não um rótulo no meio. */}
        {cliente ? <DetailRow label="Cliente" value={cliente} /> : null}

        {budget ? (
          <DetailRow
            label="Orçamento"
            value={
              <span className="flex flex-wrap items-center justify-end gap-2">
                <Link
                  to={routes.customer.portal.orcamento(budget.id)}
                  className="tabular-nums underline-offset-4 hover:underline"
                >
                  {budget.budgetNumber ? `nº ${budget.budgetNumber}` : "abrir"}
                </Link>
                <QuoteStatusBadge status={budget.status} size="sm" />
              </span>
            }
          />
        ) : null}

        {/* ⚠️ ESTA DATA É DO CLIENTE, e ele a edita aqui.
            `Task.forecastDate` é quando o caminhão SAI DA FROTA DELE e fica
            disponível para a Ankaa — não é a previsão de entrega do serviço
            pronto. O rótulo antigo ("Previsão de entrega") dizia o oposto, e a
            data chegava por telefone ao comercial, que a digitava do lado de cá.

            ⚠️ POR VEÍCULO, e não uma para o lote: é coluna de `Task`, e a rota
            é `/veiculos/:taskId/identificacao`. Dois caminhões do mesmo
            orçamento podem ser liberados em semanas diferentes — é o normal numa
            frota que não pode parar inteira.

            ⚠️ E VEM ANTES DA ENTRADA, que é a ordem dos fatos: primeiro o
            cliente libera o caminhão, depois ele entra no pátio. */}
        <PortalInlineField
          label="Liberação do veículo"
          value={progress?.forecastDate ?? ""}
          display={
            progress?.forecastDate ? (
              <span className="tabular-nums">{formatDate(progress.forecastDate)}</span>
            ) : (
              <ValorFaltando label="a combinar" />
            )
          }
          canEdit={canWrite}
          inputType="date"
          onCommit={(v) => gravar("forecastDate", v)}
        />

        {progress?.entryDate ? (
          <DetailRow
            label="Entrada"
            value={<span className="tabular-nums">{formatDate(progress.entryDate)}</span>}
          />
        ) : null}

        {progress?.finishedAt ? (
          <DetailRow
            label="Concluído em"
            value={<span className="tabular-nums">{formatDate(progress.finishedAt)}</span>}
          />
        ) : null}
      </PortalRows>
    </PortalCard>
  );
}

/**
 * A PLAQUETA, SÓ PARA LER — e só quando ela existe.
 *
 * ⛔ Sem foto não há linha. O cliente não é perguntado pela plaqueta: quem a
 * tira é a Ankaa, na entrada do veículo.
 */
function PlaquetaLeitura({ identity }: { identity: PortalVehicleIdentity | null }) {
  const vinPlateFileId = identity?.vinPlate?.id ?? null;
  const plaqueta = portalVinPlateUrl(vinPlateFileId);
  const plaquetaThumb = portalVinPlateThumbUrl(vinPlateFileId);
  if (!plaqueta) return null;

  return (
    <DetailRow
      label="Plaqueta"
      value={
        <a
          href={plaqueta}
          target="_blank"
          rel="noreferrer"
          className="block overflow-hidden rounded-md border border-border"
        >
          <img
            src={plaquetaThumb}
            alt="Plaqueta do veículo"
            loading="lazy"
            className="h-16 w-auto max-w-[12rem] object-cover"
          />
        </a>
      }
    />
  );
}

/**
 * ⚠️ O FALTANDO CONTINUA EM ÂMBAR, e continua sendo texto e não traço: "não
 * informado" num campo que trava nota e entrega é uma PENDÊNCIA do cliente, e
 * apagá-la num traço neutro esconderia dele o que só ele pode resolver.
 */
function ValorFaltando({ label }: { label: string }) {
  return <span className="font-normal text-amber-700 dark:text-amber-400">{label}</span>;
}
