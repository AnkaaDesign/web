// web/src/components/cliente/orcamento/orcamento-cobranca-card.tsx
//
// O PAGAMENTO — seção `PAYMENT`, lida do PRÓPRIO orçamento.
//
// ⛔ ELE DESCEU NA TELA, por decisão do dono: *"parte de pagamento deveria vir
// depois de assinaturas"*. E é a ordem do processo — só se cobra o que já foi
// assinado. Quem ordena é a página (`pages/cliente/orcamentos/[id].tsx`); este
// arquivo só desenha.
//
// ⛔ E AS PARCELAS VIRARAM TABELA. Eram `<ul class="divide-y">` com quatro
// `<span>` por linha: número, vencimento, badge e valor, sem cabeçalho nenhum
// dizendo o que cada um era. `components/cliente/portal-table.tsx` existe
// exatamente para a tabela que mora DENTRO de um cartão, é seguro fora do
// `AuthProvider` e já resolve cabeçalho, alinhamento de moeda, vazio e rolagem
// horizontal no celular.
//
// ⚠️ ESTE CARD NÃO CHAMA `GET /cliente/me/cobrancas`, e a razão é que a
// resposta do orçamento já traz a seção inteira. `budgetSelect` monta
// `payment: { billingSplit, payers[].installments[].bankSlip, nfse[] }` sempre
// que o recorte inclui `PAYMENT` — e monta JÁ ESCOPADO por pagador
// (`payerScopeSelect`), que é a metade que uma consulta lateral não teria como
// reproduzir sem repetir a régua de escopo no navegador.
//
// ⚠️ DOIS CICLOS DE ESTADO, E ELES NÃO SE CONFUNDEM. O que está aqui é o PLANO
// de pagamento do orçamento: parcelas com `INSTALLMENT_STATUS`. O ciclo da
// COBRANÇA (`BILLING_STATUS`, com "Vencido" e "Liquidado") vive na tela de
// Cobranças, que é a fatura VIVA — e é para lá que o cabeçalho aponta. Desenhar
// `QuoteStatusBadge` numa cobrança foi exatamente o defeito que fez a lista de
// Faturamento mostrar o ciclo errado.
import { Link } from "react-router-dom";
import { IconChevronRight, IconFileInvoice } from "@tabler/icons-react";

import type {
  PortalBudget,
  PortalBudgetInstallment,
  PortalBudgetPayer,
  PortalNfseRef,
} from "@/api-client/portal";
import { routes } from "@/constants/routes";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { INSTALLMENT_STATUS_LABELS, getBadgeVariant } from "@/constants";
import type { INSTALLMENT_STATUS } from "@/constants";
import { formatCurrency, formatDate } from "@/utils";
import { generatePaymentText } from "@/utils/quote-text-generators";
import { DetailRow } from "@/components/ui/detail-row";
import { PortalDash, PortalCard, PortalRows, PortalSubheading } from "../portal-detail";
import { PortalTable, type PortalTableColumn } from "../portal-table";
import { Button } from "@/components/ui/button";

const parcelaColumns: Array<PortalTableColumn<PortalBudgetInstallment>> = [
  {
    id: "numero",
    header: "Parcela",
    className: "whitespace-nowrap tabular-nums text-muted-foreground",
    cell: (installment) => (installment.number ? `${installment.number}ª` : "—"),
  },
  {
    id: "vencimento",
    header: "Vencimento",
    className: "whitespace-nowrap tabular-nums",
    cell: (installment) =>
      installment.dueDate ? formatDate(installment.dueDate) : <PortalDash />,
  },
  {
    id: "situacao",
    header: "Situação",
    cell: (installment) => (
      // O mapa de cor é o de PARCELA DE PEDIDO — a mesma pergunta ("esta
      // parcela está paga, pendente, vencida ou cancelada?") com o mesmo
      // significado de cor. Declarar mais um mapa de cor de parcela nesta base
      // seria a forma conhecida de fazer dois lugares divergirem.
      <Badge variant={getBadgeVariant(installment.status ?? "", "ORDER_INSTALLMENT")} size="sm">
        {INSTALLMENT_STATUS_LABELS[installment.status as INSTALLMENT_STATUS] ??
          installment.status ??
          "—"}
      </Badge>
    ),
  },
  {
    id: "valor",
    header: "Valor",
    align: "right",
    className: "whitespace-nowrap font-medium tabular-nums",
    cell: (installment) =>
      typeof installment.amount === "number" ? (
        formatCurrency(installment.amount)
      ) : (
        <PortalDash />
      ),
  },
];

const nfseColumns: Array<PortalTableColumn<PortalNfseRef>> = [
  {
    id: "numero",
    header: "Nota",
    className: "whitespace-nowrap tabular-nums",
    cell: (nota) => (nota.nfseNumber ? `NFS-e ${nota.nfseNumber}` : "NFS-e"),
  },
  {
    id: "emitida",
    header: "Emitida em",
    align: "right",
    className: "whitespace-nowrap tabular-nums text-muted-foreground",
    cell: (nota) => (nota.createdAt ? formatDate(nota.createdAt) : <PortalDash />),
  },
];


/**
 * A CONFIGURAÇÃO DE PAGAMENTO — o acordo que gerou as parcelas.
 *
 * ⛔ O CARD MOSTRAVA A TABELA E MAIS NADA. O contato via "3 parcelas de
 * R$ 1.499,67" e não tinha como responder três perguntas que são dele: pago
 * como? a partir de quando conta? a fatura sai no CNPJ de quem? Tudo isso está
 * na cláusula do documento impresso — esconder no portal não protegia nada,
 * só obrigava a abrir o PDF para saber o que a tela já tinha em mãos.
 *
 * ⚠️ A CLÁUSULA É GERADA PELO MESMO `generatePaymentText` DO PDF. Reescrever a
 * prosa aqui garantiria que as duas divergissem no primeiro conserto de texto —
 * e a divergência apareceria justamente entre o que o cliente leu e o que ele
 * assinou. `firstDueDate` vem da primeira parcela REAL quando ela existe, que é
 * o que troca "a partir da finalização" por uma data no calendário.
 */
function ConfiguracaoPagamento({
  payer,
  billingSplit,
  nomear,
}: {
  payer: PortalBudgetPayer;
  billingSplit: string | null;
  nomear: boolean;
}) {
  const parcelas = payer.installments ?? [];
  const config = payer.paymentConfig ?? null;

  const clausula = generatePaymentText({
    customPaymentText: payer.customPaymentText ?? null,
    paymentConfig: config,
    paymentCondition: payer.paymentCondition ?? null,
    total: payer.total ?? 0,
    firstDueDate: parcelas.find((p) => p.dueDate)?.dueDate ?? null,
  });

  const metodo = config?.method ? METODO_LABEL[config.method] ?? config.method : null;
  const quantas = parcelas.length || config?.installmentCount || (config?.type === "CASH" ? 1 : null);

  // ⚠️ SÓ APARECE QUANDO HÁ ALGO A DIZER. Um bloco de rótulos com quatro
  // travessões é pior que bloco nenhum: sugere cadastro incompleto onde o
  // acordo apenas ainda não foi fechado.
  const temAlgo = !!(clausula || metodo || quantas || payer.total !== null);
  if (!temAlgo) return null;

  return (
    <div className="space-y-1.5">
      {nomear ? <PortalSubheading>{payer.customerName ?? "Pagador"}</PortalSubheading> : null}
      <PortalRows>
        {payer.customerName ? (
          <DetailRow label="Faturar para" value={payer.customerName} />
        ) : null}

        {metodo ? <DetailRow label="Forma de pagamento" value={metodo} /> : null}

        {quantas ? (
          <DetailRow
            label="Parcelas"
            value={
              <span className="tabular-nums">
                {quantas === 1 ? "à vista" : `${quantas}x`}
              </span>
            }
          />
        ) : null}

        {typeof payer.total === "number" ? (
          <DetailRow
            label="Total"
            value={<span className="font-medium tabular-nums">{formatCurrency(payer.total)}</span>}
          />
        ) : null}

        {typeof payer.discountValue === "number" && payer.discountValue > 0 ? (
          <DetailRow
            label="Desconto"
            value={
              <span className="tabular-nums">
                {payer.discountType === "PERCENTAGE"
                  ? `${payer.discountValue}%`
                  : formatCurrency(payer.discountValue)}
              </span>
            }
          />
        ) : null}

        {/* O QUE VAI SER EMITIDO — as duas perguntas que o financeiro do cliente
            faz por telefone. "Não" também é resposta: há acordo sem boleto
            (transferência combinada) e o silêncio fazia o cliente esperar um
            documento que nunca vinha. */}
        {payer.generateInvoice !== null ? (
          <DetailRow
            label="Nota fiscal"
            value={payer.generateInvoice ? "Será emitida" : "Não será emitida"}
          />
        ) : null}
        {payer.generateBankSlip !== null ? (
          <DetailRow
            label="Boleto"
            value={payer.generateBankSlip ? "Será emitido" : "Não será emitido"}
          />
        ) : null}

        {billingSplit ? (
          <DetailRow label="Cobrança" value={SPLIT_LABEL[billingSplit] ?? billingSplit} />
        ) : null}

        {/* A CLÁUSULA POR EXTENSO, em bloco: é uma frase, não um valor, e
            espremê-la na coluna da direita de uma linha rótulo/valor a quebraria
            em quatro linhas de duas palavras. */}
        {clausula ? <DetailRow label="Condição" value={clausula} block /> : null}
      </PortalRows>
    </div>
  );
}

/** Os dois valores que `PaymentConfig.method` assume hoje. */
const METODO_LABEL: Record<string, string> = {
  BANK_SLIP: "Boleto",
  PIX: "Pix",
};

/**
 * COMO A COBRANÇA É REPARTIDA — `Budget.billingSplit`.
 *
 * Num orçamento de um veículo os dois valores dizem a mesma coisa, e é por isso
 * que a linha só aparece quando o servidor manda o campo.
 */
const SPLIT_LABEL: Record<string, string> = {
  JOINT: "Uma cobrança para o orçamento inteiro",
  PER_TASK: "Uma cobrança por veículo",
};

export function OrcamentoCobrancaCard({ budget }: { budget: PortalBudget }) {
  const payment = budget.payment;
  // `undefined` = a seção `PAYMENT` não está no recorte. O card não existe — e,
  // ao contrário do desenho antigo, NENHUMA pergunta é feita à rede por ele.
  if (!payment) return null;

  const payers = payment.payers ?? [];
  const nfse = payment.nfse ?? [];
  const comParcelas = payers.filter((payer) => (payer.installments ?? []).length > 0);
  // ⚠️ "NADA A COBRAR" DEIXOU DE INCLUIR "acordo já fechado, parcelas ainda
  // não lançadas". Esse estado é o normal entre a assinatura e a aprovação do
  // faturamento, e nele a condição de pagamento JÁ EXISTE — dizer "nada a
  // cobrar ainda" por cima de um acordo fechado escondia justamente o que o
  // cliente vem conferir antes de aprovar.
  const temAcordo = payers.some(
    (payer) =>
      !!payer.paymentCondition ||
      !!payer.paymentConfig ||
      !!payer.customPaymentText ||
      typeof payer.total === "number",
  );
  const vazio = comParcelas.length === 0 && nfse.length === 0 && !temAcordo;
  // Um pagador só é o caso normal, e repetir o nome dele acima da única tabela
  // é ruído: o card inteiro já é o pagamento DESTE orçamento.
  const nomearPagador = comParcelas.length > 1;

  return (
    <PortalCard
      icon={IconFileInvoice}
      title="Pagamento"
      description="O plano de pagamento deste orçamento: parcelas, boletos e notas fiscais."
      actions={
        /* ⚠️ O MESMO BOTÃO DE "Abrir veículo" (`variant="outline" size="sm"`
           com a seta). Era um link de texto cinza, e dois atalhos com o mesmo
           papel — sair deste card para a tela cheia do assunto — não podem ter
           duas peles: a mais fraca vira decoração e ninguém a encontra. */
        <Button variant="outline" size="sm" asChild>
          <Link to={routes.customer.portal.cobrancas} className="gap-1">
            Ver cobranças
            <IconChevronRight className="h-4 w-4" aria-hidden />
          </Link>
        </Button>
      }
    >
      {vazio ? (
        // ⚠️ VAZIO COM INTENÇÃO: "ainda não há o que pagar" é resposta, não
        // carcaça — é a pergunta que traz o financeiro do cliente ao portal.
        <EmptyState
          className="py-8"
          icon={<IconFileInvoice className="h-8 w-8" />}
          title="Nada a cobrar ainda"
          description="A cobrança nasce depois que o orçamento é aprovado. Quando as parcelas forem lançadas, elas aparecem aqui."
        />
      ) : (
        <div className="space-y-4">
          {/* ⚠️ O ACORDO VEM ANTES DAS PARCELAS, e não depois: a tabela é a
              CONSEQUÊNCIA dele. Quem abre o card pergunta "como eu pago?" antes
              de "quando vence a segunda?". */}
          {payers.map((payer) => (
            <ConfiguracaoPagamento
              key={`config-${payer.id}`}
              payer={payer}
              billingSplit={payment.billingSplit ?? null}
              nomear={payers.length > 1}
            />
          ))}

          {comParcelas.map((payer) => (
            <div key={payer.id} className="space-y-1.5">
              {nomearPagador ? (
                <PortalSubheading>{payer.customerName ?? "Pagador"}</PortalSubheading>
              ) : (
                <PortalSubheading>Parcelas</PortalSubheading>
              )}
              <PortalTable
                columns={parcelaColumns}
                rows={payer.installments ?? []}
                getRowId={(installment) => installment.id}
              />
            </div>
          ))}

          {/* A NFS-e é do ORÇAMENTO, não da parcela: numa tabela de parcelas ela
              não tem linha onde morar. */}
          {nfse.length > 0 ? (
            <div className="space-y-1.5">
              <PortalSubheading>Notas fiscais</PortalSubheading>
              <PortalTable columns={nfseColumns} rows={nfse} getRowId={(nota) => nota.id} />
            </div>
          ) : null}
        </div>
      )}
    </PortalCard>
  );
}
