import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import {
  IconReceipt,
  IconNote,
  IconBuilding,
  IconUser,
  IconCreditCard,
  IconTruck,
  IconFileInvoice,
  IconShieldCheck,
  IconPhoto,
  IconWriting,
  IconDownload,
  IconLoader2,
  IconEye,
} from "@tabler/icons-react";

import { Button } from "@/components/ui/button";
import { Combobox } from "@/components/ui/combobox";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { cn } from "@/lib/utils";

import { InstallmentStatusBadge } from "@/components/production/task/billing/installment-status-badge";
import { BankSlipStatusBadge } from "@/components/production/task/billing/bank-slip-status-badge";
import { BoletoActions } from "@/components/production/task/billing/boleto-actions";
import { NfseStatusBadge } from "@/components/production/task/billing/nfse-status-badge";
import { NfseActions } from "@/components/production/task/billing/nfse-actions";
import { TaskNfseHistoryCard } from "@/components/production/task/billing/task-nfse-history";
import { NfseEnrichedInfo } from "@/components/production/task/billing/nfse-enriched-info";
import { FileItem, useFileViewer } from "@/components/common/file";
import { SignatureEnvelopeCard } from "@/components/financial/budget/signature-envelope-card";

import { useTaskBillingInvoices } from "@/hooks/production/use-invoice";
import { useCurrentUser } from "@/hooks/common/use-auth";
import { invoiceService } from "@/api-client/invoice";
import { nfseService } from "@/api-client/nfse";

import { generatePaymentText, generateGuaranteeText } from "@/utils/quote-text-generators";
import { getApiBaseUrl } from "@/utils/file";
import { formatCurrency } from "@/utils/number";
import { formatDate } from "@/utils/date";
import { hasPrivilege } from "@/utils/user";
import { canEditQuote } from "@/utils/permissions/quote-permissions";

import { routes, SECTOR_PRIVILEGES } from "@/constants";

import type { Task } from "@/types";
import type { Invoice } from "@/types/invoice";
import type { File as CustomFile } from "@/types/file";
import {
  configsForTask,
  perVehicleAmount,
  quoteVehicleCount,
  coveredTaskCount,
  hasMultipleCustomers,
  dedupeConfigsByCustomer,
} from "@/utils/quote-tasks";

/**
 * A CLÁUSULA DE UMA FATURA, com o mesmo critério do documento.
 *
 * `scope` ("para cada um dos 4 veículos", "para cada grupo de 2 veículos") e a
 * contagem de cobranças só dizem a verdade quando TODAS as faturas cobrem a
 * mesma quantidade de veículos — que é o caso do acervo inteiro: conjunta,
 * veículo a veículo, ou lotes iguais. Com lotes DESIGUAIS a generalização
 * mente nos dois números: um orçamento repartido em 3+1 anunciava "para cada
 * grupo de 3 veículos… serão 6 cobranças" quando existe exatamente um grupo de
 * três, um de um, e duas faturas.
 *
 * Nesse caso o documento abandona o escopo e prefixa cada frase com os veículos
 * daquela fatura ("Veículos 8101, 8102, 8104: Fica acertado…"). Aqui é a mesma
 * frase, para que a tela e o PDF não discordem.
 */
function quoteClauseArgs(
  quote: any,
  config: any,
): { prefix: string; vehicleCount: number; coveredVehicleCount: number | undefined } {
  // ⚠️ ESTA PÁGINA É DE UM CAMINHÃO, e a cláusula tem de falar da fatura DELE.
  //
  // O escopo saía do CONTRATO: `vehicleCount` era `quoteVehicleCount(quote)`, e
  // num orçamento de quatro veículos cobrados separadamente a frase virava
  //
  //   "Fica acertado o pagamento, PARA CADA UM DOS 4 VEÍCULOS, em 2 parcelas de
  //    R$ 0,10 (…). Serão 8 COBRANÇAS NO TOTAL."
  //
  // As duas partes em maiúsculas são do contrato inteiro e não têm o que fazer
  // na página do caminhão 78000: quem a abre quer saber quando ESTE paga, não
  // quantas cobranças os quatro somam. Esse é o texto do DOCUMENTO, que fala do
  // negócio todo; aqui o assunto é uma fatura.
  //
  // Passando `vehicleCount = coveredVehicleCount`, `paymentScope` não emite
  // prefixo e `invoiceCount` dá 1 — some a contagem de cobranças. Numa fatura
  // CONJUNTA os dois já eram iguais, então aquele caso não muda uma vírgula.
  const covered = coveredTaskCount(config) || undefined;
  const escopo = covered ?? quoteVehicleCount(quote);
  return { prefix: "", vehicleCount: escopo, coveredVehicleCount: covered };
}

/**
 * Bare render body for the "Orçamento / Faturamento Detalhado" detail section
 * (the DetailPage host supplies the Card chrome, title and quote-status control).
 *
 * Self-contained, faithful port of the legacy schedule task-detail card body. Renders the
 * budget header, the per-customer pricing breakdown, installments + boletos, NFS-e, delivery
 * deadline, guarantee, approved layout thumbnails and the customer signature. Returns null when
 * the task has no quote.
 */
/**
 * DUAS SEÇÕES, UM RENDERIZADOR.
 *
 * Orçamento e faturamento viraram entidades separadas em 16/09/2026 — ciclos,
 * estados e telas próprios —, e o detalhe da tarefa continuava mostrando os dois
 * num cartão só, com um título que alternava entre "Orçamento" e "Faturamento"
 * conforme o status. O cartão dizia uma palavra e mostrava as duas coisas.
 *
 * O que separa os blocos é a pergunta que cada um responde:
 *
 *   ORÇAMENTO  — o que foi PROPOSTO: serviços, preço, desconto, total, prazo de
 *                entrega, garantia, layout aprovado e a assinatura da proposta.
 *   FATURAMENTO — o que vai ser COBRADO: pagador, condição de pagamento,
 *                parcelas, boletos e notas fiscais.
 *
 * ⚠️ O CORPO CONTINUA NUM RENDERIZADOR SÓ, com `part` escolhendo os blocos.
 * Copiá-lo em dois componentes duplicaria oitocentas linhas de JSX e, com elas,
 * a derivação que decide QUAL fatia do orçamento pertence a este veículo
 * (`configsForTask`, `coveredTaskCount`) — a regra mais delicada do arquivo, e a
 * que já causou o caminhão 12 exibindo os sessenta blocos do orçamento inteiro.
 * Uma cópia divergiria na primeira correção feita só de um lado.
 *
 * Cada seção tem o SEU filtro de cliente, e não um compartilhado: são cartões
 * independentes agora, e um controle num cartão que mexe no outro é ação à
 * distância. O custo é um `useState` repetido.
 */
export function BudgetBreakdown({ task }: { task: Task }): React.ReactNode {
  return <QuoteBillingBreakdown task={task} part="budget" />;
}

export function BillingBreakdown({ task }: { task: Task }): React.ReactNode {
  return <QuoteBillingBreakdown task={task} part="billing" />;
}

function QuoteBillingBreakdown({ task, part }: { task: Task; part: "budget" | "billing" }): React.ReactNode {
  const navigate = useNavigate();
  const { data: currentUser } = useCurrentUser();
  const [quoteCustomerFilter, setQuoteCustomerFilter] = useState<string | null>(null);

  /**
   * O PEDIDO DE COMPRA DESTE VEÍCULO.
   *
   * Morava na configuração de faturamento, por CLIENTE, e a coluna já não existe:
   * o pedido é da ENTREGA (`Task.customerOrderNumber`). Aqui a resposta é simples
   * porque a tela é de UM caminhão — o número dele, não o dos irmãos. É também a
   * diferença que a tela precisava mostrar: dois veículos do mesmo orçamento
   * podem ter vindo em pedidos diferentes.
   */
  // ⚠️ O Nº DO PEDIDO SAIU DAQUI, e de propósito.
  //
  // Ele ficava dentro das Condições de Pagamento, herdado de quando morava na
  // fatia do cliente. Desde a migração `20260909170000` o pedido é do VEÍCULO
  // (`Task.customerOrderNumber`) — e esta é a página do veículo, onde ele já
  // aparece como campo próprio, ao lado da placa e da série. Repeti-lo dentro do
  // bloco de pagamento sugeria que ele fosse do faturamento, que é exatamente a
  // leitura antiga e errada.

  // Fetch invoice data for inline boleto/NFS-e display in the quote section.
  // Pela rota do ORÇAMENTO, filtradas pela cobertura: a rota por tarefa não
  // enxerga a fatura conjunta (`Invoice.taskId` nulo).
  const { data: invoicesData } = useTaskBillingInvoices(task.id, task.quoteId ?? undefined);
  const invoices: Invoice[] = useMemo(() => {
    const data = invoicesData?.data;
    return Array.isArray(data) ? data : data ? [data] : [];
  }, [invoicesData]);

  // The file viewer provider wraps the whole app (App.tsx), so call the hook directly like every
  // sibling section (a try/catch around a hook is a rules-of-hooks anti-pattern).
  const fileViewerContext = useFileViewer();

  // Check if user can access customer pages (ADMIN, FINANCIAL, LOGISTIC, COMMERCIAL)
  const canAccessCustomerPages =
    currentUser &&
    (hasPrivilege(currentUser, SECTOR_PRIVILEGES.ADMIN) ||
      hasPrivilege(currentUser, SECTOR_PRIVILEGES.FINANCIAL) ||
      hasPrivilege(currentUser, SECTOR_PRIVILEGES.LOGISTIC) ||
      hasPrivilege(currentUser, SECTOR_PRIVILEGES.COMMERCIAL));

  // Mesma regra da página de orçamento: quem pode editar o orçamento pode emitir,
  // cancelar e reenviar a coleta de assinaturas (ADMIN | FINANCIAL | COMMERCIAL).
  const canManageSignature = canEditQuote(currentUser?.sector?.privileges || "");

  const rawQuote = task.quote;
  if (!rawQuote) return null;

  // ─── AS FATURAS DESTE VEÍCULO ────────────────────────────────────────────────
  //
  // Um orçamento pode cobrir sessenta caminhões, e esta seção mostra o orçamento
  // de UM deles (a tela é a da tarefa). Numa cobrança veículo a veículo existe
  // uma fatura POR CAMINHÃO, todas do mesmo cliente: sem filtrar, o caminhão 12
  // exibia os sessenta blocos de parcelas, o seletor listava "Cliente" sessenta
  // vezes com o mesmo nome, e o primeiro bloco — que é o do caminhão 1 — era lido
  // como se fosse o dele. Numa fatura conjunta a cobertura inclui este veículo e
  // a lista continua inteira, como sempre foi.
  const quote = {
    ...rawQuote,
    customerConfigs: configsForTask(rawQuote.customerConfigs, task.id),
  };
  const vehicleCount = quoteVehicleCount(rawQuote);
  const isMultiVehicle = vehicleCount > 1;
  // A FATURA DESTE VEÍCULO COBRA SÓ ELE?
  //
  // Pela COBERTURA, não pelo modo: um lote de vinte cobra vinte, e dizer "por
  // veículo" ali afirmaria que o número na tela é o de um caminhão quando é o de
  // vinte. O par de números abaixo mostra os DOIS quando diferem, para ninguém
  // confundir "o que este caminhão custa" com "o que o cliente assinou".
  const thisVehicleConfig = quote.customerConfigs?.[0];
  const coveredHere = coveredTaskCount(thisVehicleConfig as any);
  const isPerVehicleBilling = coveredHere > 0 && coveredHere < vehicleCount;
  const services = quote.services ?? [];

  return (
    <div className="space-y-4">
      {/* The section TITLE + header "Visualizar" action (host-owned) open the quote. */}
      {/* Customer filter combobox - only show when 2+ invoiceTo customers (header chrome is host-owned) */}
      {/* ⚠️ CLIENTES DISTINTOS, e não `customerConfigs.length`. Um faturamento
          por veículo é UM PAGADOR REPETIDO, não vários clientes: contar fatias
          punha um filtro "Completo / Cliente 1 / Cliente 2 / Cliente 3 / Cliente
          4" com o MESMO nome quatro vezes num orçamento de um cliente só. É a
          mesma distinção que o "Faturar Para" faz — múltiplos faturamentos de um
          orçamento não são múltiplos pagadores. */}
      {hasMultipleCustomers(quote.customerConfigs) && (
        <div className="flex justify-end">
          <Combobox
            value={quoteCustomerFilter || "all"}
            onValueChange={(value) => setQuoteCustomerFilter(value === "all" ? null : typeof value === "string" ? value : null)}
            options={[
              { value: "all", label: "Completo" },
              ...dedupeConfigsByCustomer(quote.customerConfigs).configs.map((config) => ({
                value: config.customerId,
                label: config.customer?.corporateName || config.customer?.fantasyName || "Cliente",
              })),
            ]}
            searchable={false}
            placeholder="Filtrar cliente"
            className="h-9 rounded-md w-[220px]"
          />
        </div>
      )}

      {/* Budget number + validity are shown as section fields by the host (avoids duplication). */}

      {/* Pricing items table */}
      {(() => {
        // OS DOIS CARTÕES MOSTRAM OS SERVIÇOS, e pela mesma tabela.
        //
        // O faturamento listava pagador, parcelas e boletos sem dizer o que
        // estava sendo cobrado: quem abria a cobrança via "R$ 0,20" e um nome,
        // e precisava voltar ao Orçamento para descobrir por qual serviço. São
        // cartões independentes desde 16/09 — um deles não pode depender do
        // outro estar aberto para fazer sentido.
        //
        // A tabela é a MESMA de propósito. O que muda entre os cartões não é a
        // lista, é o recorte: `quote.customerConfigs` já vem filtrado para a
        // fatura DESTE veículo (`configsForTask`), então o resumo logo abaixo
        // soma o que este caminhão paga, e não o contrato inteiro.
        const filteredServices = services.filter(
          (item) => !quoteCustomerFilter || item.invoiceToCustomer?.id === quoteCustomerFilter || !item.invoiceToCustomerId,
        );

        const renderServiceRow = (item: any, index: number, showCustomerCol: boolean) => {
          const isOutrosWithObservation = item.description === "Outros" && !!item.observation;
          const displayDescription = isOutrosWithObservation ? item.observation : item.description;
          const amount = typeof item.amount === "number" ? item.amount : Number(item.amount) || 0;
          return (
            <tr key={item.id || index} className="hover:bg-muted/30 transition-colors">
              <td className="px-4 py-1.5 text-sm align-middle">
                <div className="flex items-center gap-2">
                  <span>{displayDescription}</span>
                  {!isOutrosWithObservation && item.observation && (
                    <HoverCard openDelay={100} closeDelay={100}>
                      <HoverCardTrigger asChild>
                        <button className="relative flex items-center justify-center h-5 w-5 rounded border border-input bg-background hover:bg-accent hover:text-accent-foreground transition-colors">
                          <IconNote className="h-3.5 w-3.5" />
                          <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-destructive text-[9px] font-bold text-destructive-foreground">
                            !
                          </span>
                        </button>
                      </HoverCardTrigger>
                      <HoverCardContent className="w-72 p-3" side="top">
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <IconNote className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm font-medium">Observação</span>
                          </div>
                          <p className="text-sm text-muted-foreground">{item.observation}</p>
                        </div>
                      </HoverCardContent>
                    </HoverCard>
                  )}
                </div>
              </td>
              {showCustomerCol && (
                <td className="px-4 py-1.5 text-sm text-muted-foreground align-middle">
                  {canAccessCustomerPages && item.invoiceToCustomer?.id ? (
                    <span
                      className="cursor-pointer hover:text-primary hover:underline transition-colors"
                      onClick={() => navigate(routes.financial.customers.details(item.invoiceToCustomer!.id))}
                    >
                      {item.invoiceToCustomer.corporateName || item.invoiceToCustomer.fantasyName}
                    </span>
                  ) : (
                    item.invoiceToCustomer?.corporateName || item.invoiceToCustomer?.fantasyName || "-"
                  )}
                </td>
              )}
              <td className="px-4 py-1.5 text-sm text-right font-medium align-middle">{formatCurrency(amount)}</td>
            </tr>
          );
        };

        // Group by customer when "Completo" with 2+ customers — 2-column layout
        // Use customerConfigs order to ensure consistent "Cliente N" numbering with billing section
        // Por CLIENTES distintos: com uma fatia por veículo, contar fatias abria
        // um grupo por caminhão para o mesmo pagador.
        if (!quoteCustomerFilter && hasMultipleCustomers(quote.customerConfigs)) {
          const servicesByCustomer = new Map<string, typeof filteredServices>();
          for (const item of filteredServices) {
            const customerId = item.invoiceToCustomer?.id || "__unassigned__";
            if (!servicesByCustomer.has(customerId)) {
              servicesByCustomer.set(customerId, []);
            }
            servicesByCustomer.get(customerId)!.push(item);
          }

          // Follow customerConfigs order for consistent numbering
          const orderedGroups = quote.customerConfigs!.map((config) => ({
            customerId: config.customerId,
            name: config.customer?.corporateName || config.customer?.fantasyName || "Sem cliente",
            services: servicesByCustomer.get(config.customerId) || [],
          }));

          return (
            <div className="grid grid-cols-1 md:grid-cols-2 items-stretch gap-3">
              {orderedGroups.map((group, groupIndex) => (
                <div key={group.customerId} className="border border-border dark:border-border/30 rounded-lg overflow-hidden">
                  <div className="flex items-center gap-2 px-4 py-2.5 bg-muted/40 border-b border-border dark:border-border/30">
                    <IconBuilding className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-semibold">
                      <span className="text-muted-foreground font-medium">Cliente {groupIndex + 1}:</span>{" "}
                      {canAccessCustomerPages && group.customerId !== "__unassigned__" ? (
                        <span
                          className="cursor-pointer hover:text-primary hover:underline transition-colors"
                          onClick={() => navigate(routes.financial.customers.details(group.customerId))}
                        >
                          {group.name}
                        </span>
                      ) : (
                        group.name
                      )}
                    </span>
                    <span className="text-xs text-muted-foreground ml-auto">
                      {formatCurrency(
                        (() => {
                          const config = quote.customerConfigs?.find((c: any) => c.customerId === group.customerId);
                          return config?.total != null ? Number(config.total) : group.services.reduce((sum: number, s: any) => sum + (Number(s.amount) || 0), 0);
                        })(),
                      )}
                    </span>
                  </div>
                  <div>
                    <table className="w-full">
                      <thead className="bg-muted/50">
                        <tr>
                          <th className="px-4 py-2.5 text-left text-sm font-semibold text-muted-foreground">Descrição</th>
                          <th className="px-4 py-2.5 text-right text-sm font-semibold text-muted-foreground w-28">Valor</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border dark:divide-border/30">{group.services.map((item, index) => renderServiceRow(item, index, false))}</tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          );
        }

        // Single customer or filtered view: flat table
        return (
          <div className="border border-border dark:border-border/30 rounded-lg overflow-hidden">
            <table className="w-full">
              <thead className="bg-muted/50">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-muted-foreground">Descrição</th>
                  <th className="px-4 py-3 text-right text-sm font-semibold text-muted-foreground w-32">Valor</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border dark:divide-border/30">{filteredServices.map((item, index) => renderServiceRow(item, index, false))}</tbody>
            </table>
          </div>
        );
      })()}

      {/* Pricing Summary */}
      {(() => {
        // Acompanha a tabela acima nos dois cartões: uma lista de serviços sem
        // subtotal, desconto e total é meia resposta.
        const configs = quote.customerConfigs || [];
        const hasConfigs = configs.length > 0;

        // Determine which discount/total source to use
        // Discounts are on customerConfig level (global per customer)
        let displaySubtotal: number;
        let discountAmount = 0;
        let displayTotal: number;
        let discountLabel = "Desconto";

        if (quoteCustomerFilter) {
          // Specific customer filtered: use that config's data
          const selectedConfig = configs.find((c) => c.customerId === quoteCustomerFilter);
          if (selectedConfig) {
            displaySubtotal = typeof selectedConfig.subtotal === "number" ? selectedConfig.subtotal : Number(selectedConfig.subtotal) || 0;
            displayTotal = typeof selectedConfig.total === "number" ? selectedConfig.total : Number(selectedConfig.total) || 0;
            if (displaySubtotal !== displayTotal) {
              discountAmount = displaySubtotal - displayTotal;
              if (selectedConfig.discountType === "PERCENTAGE" && selectedConfig.discountValue) {
                discountLabel = `Desconto (${selectedConfig.discountValue}%)`;
              }
              if (selectedConfig.discountReference) {
                discountLabel += ` — ${selectedConfig.discountReference}`;
              }
            }
          } else {
            // Fallback: compute from filtered services + global discount
            const filtered = services.filter((item) => item.invoiceToCustomer?.id === quoteCustomerFilter || !item.invoiceToCustomerId);
            displaySubtotal = filtered.reduce((sum, item) => sum + (typeof item.amount === "number" ? item.amount : Number(item.amount) || 0), 0);
            displayTotal = displaySubtotal;
          }
        } else if (hasConfigs && configs.length >= 2) {
          // "Completo" with 2+ configs: aggregate from configs, no global discount
          displaySubtotal = configs.reduce((sum, c) => sum + (typeof c.subtotal === "number" ? c.subtotal : Number(c.subtotal) || 0), 0);
          displayTotal = configs.reduce((sum, c) => sum + (typeof c.total === "number" ? c.total : Number(c.total) || 0), 0);
          // Show aggregate discount if subtotal != total
          if (displaySubtotal !== displayTotal) {
            discountAmount = displaySubtotal - displayTotal;
          }
        } else if (hasConfigs && configs.length === 1) {
          // Single config: use that config's data
          const config = configs[0];
          let configSubtotal = typeof config.subtotal === "number" ? config.subtotal : Number(config.subtotal) || 0;
          if (configSubtotal === 0 && services.length > 0) {
            configSubtotal = services.reduce((sum: number, item: any) => sum + (typeof item.amount === "number" ? item.amount : Number(item.amount) || 0), 0);
          }
          displaySubtotal = configSubtotal;
          let configTotal = typeof config.total === "number" ? config.total : Number(config.total) || 0;
          if (configTotal === 0 && displaySubtotal > 0) {
            configTotal = displaySubtotal;
          }
          displayTotal = configTotal;
          if (displaySubtotal !== displayTotal) {
            discountAmount = displaySubtotal - displayTotal;
            if (config.discountType === "PERCENTAGE" && config.discountValue) {
              discountLabel = `Desconto (${config.discountValue}%)`;
            }
            if (config.discountReference) {
              discountLabel += ` — ${config.discountReference}`;
            }
          }
        } else {
          // Sem configuração de faturamento: os agregados do orçamento, divididos
          // pelos veículos — o card é de UM caminhão, e `quote.total` é o contrato.
          displaySubtotal = perVehicleAmount(quote.subtotal, vehicleCount);
          displayTotal = perVehicleAmount(quote.total, vehicleCount);
        }

        return (
          <div className="bg-muted/20 border border-border dark:border-border/30 rounded-lg p-4 space-y-3">
            {/* Subtotal */}
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Subtotal</span>
              <span className="font-medium">{formatCurrency(displaySubtotal)}</span>
            </div>

            {/* Discount (from customer config) */}
            {discountAmount > 0 && (
              <div className="flex items-center justify-between text-sm text-destructive">
                <span>{discountLabel}</span>
                <span className="font-medium">- {formatCurrency(discountAmount)}</span>
              </div>
            )}

            {/* Total */}
            <div className="flex items-center justify-between pt-3 border-t border-border dark:border-border/30">
              <span className="text-base font-bold text-foreground">TOTAL</span>
              <span className="text-xl font-bold text-primary">{formatCurrency(displayTotal)}</span>
            </div>

            {/* O OUTRO número, quando o orçamento cobre mais de um veículo: o valor
                acima é o desta FATURA (um caminhão, ou um lote), e quem lê a tela
                de um veículo precisa do total do orçamento ao lado para não
                confundir os dois. */}
            {isMultiVehicle && (
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                {isPerVehicleBilling ? (
                  <>
                    <span>
                      {coveredHere > 1
                        ? `Esta fatura cobra ${coveredHere} veículos · total do orçamento (${vehicleCount})`
                        : `Total do orçamento (${vehicleCount} veículos)`}
                    </span>
                    <span className="tabular-nums">{formatCurrency(Number(quote.total) || 0)}</span>
                  </>
                ) : (
                  <>
                    <span>Por veículo ({vehicleCount} no orçamento)</span>
                    <span className="tabular-nums">
                      {formatCurrency(perVehicleAmount(quote.total, vehicleCount))}
                    </span>
                  </>
                )}
              </div>
            )}
          </div>
        );
      })()}

      {/* Per-Customer Config Cards */}
      {part === "billing" &&
        quote.customerConfigs &&
        quote.customerConfigs.length > 0 &&
        (() => {
          const configs = quoteCustomerFilter
            ? quote.customerConfigs!.filter((c) => c.customerId === quoteCustomerFilter)
            : hasMultipleCustomers(quote.customerConfigs)
              ? quote.customerConfigs!
              : [];

          if (configs.length === 0) return null;

          const isMultiColumnLayout = !quoteCustomerFilter && configs.length >= 2;

          return (
            <div className={cn("gap-3", isMultiColumnLayout ? "grid grid-cols-1 md:grid-cols-2 items-stretch" : "space-y-3")}>
              {configs.map((config, configIndex) => {
                const configSubtotal = typeof config.subtotal === "number" ? config.subtotal : Number(config.subtotal) || 0;
                const configTotal = typeof config.total === "number" ? config.total : Number(config.total) || 0;
                const configDiscountAmount = Math.max(0, configSubtotal - configTotal);
                let configDiscountLabel = "Desconto";
                if (config.discountType === "PERCENTAGE" && config.discountValue) {
                  configDiscountLabel = `Desconto (${config.discountValue}%)`;
                }
                if (config.discountReference) {
                  configDiscountLabel += ` — ${config.discountReference}`;
                }
                // SOBRE QUANTOS VEÍCULOS ESTA FATURA FALA. Sem a cobertura, a
                // frase é montada como se o orçamento tivesse um veículo só: num
                // `PER_TASK` de quatro caminhões ela anunciava "3 parcelas de
                // R$ 583,33" sem dizer que são por veículo e que haverá doze
                // cobranças — exatamente a ambiguidade que o escopo existe para
                // desfazer. O documento já dizia certo; esta tela, não.
                const clause = quoteClauseArgs(quote as any, config);
                const configPaymentBody = generatePaymentText({
                  customPaymentText: config.customPaymentText,
                  paymentConfig: (config as any).paymentConfig,
                  paymentCondition: config.paymentCondition,
                  total: configTotal,
                  vehicleCount: clause.vehicleCount,
                  coveredVehicleCount: clause.coveredVehicleCount,
                });
                const configPaymentText = configPaymentBody
                  ? `${clause.prefix}${configPaymentBody}`
                  : "";

                return (
                  <div key={config.id} className="bg-muted/30 rounded-lg p-4 space-y-2 flex flex-col">
                    <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                      <IconBuilding className="h-4 w-4 text-muted-foreground" />
                      <span className="text-muted-foreground font-medium">Cliente {configIndex + 1}:</span>
                      {canAccessCustomerPages && config.customerId ? (
                        <span
                          className="cursor-pointer hover:text-primary hover:underline transition-colors"
                          onClick={() => navigate(routes.financial.customers.details(config.customerId))}
                        >
                          {config.customer?.corporateName || config.customer?.fantasyName || "Cliente"}
                        </span>
                      ) : (
                        config.customer?.corporateName || config.customer?.fantasyName || "Cliente"
                      )}
                    </div>

                    {config.responsible?.name && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <IconUser className="h-4 w-4" />
                        <span>
                          Responsável: <span className="font-medium text-foreground">{config.responsible.name}</span>
                        </span>
                      </div>
                    )}

                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Subtotal</span>
                      <span className="font-medium">{formatCurrency(configSubtotal)}</span>
                    </div>

                    {configDiscountAmount > 0 ? (
                      <div className="flex items-center justify-between text-sm text-destructive">
                        <span>{configDiscountLabel}</span>
                        <span className="font-medium">- {formatCurrency(configDiscountAmount)}</span>
                      </div>
                    ) : null}

                    <div className="flex items-center justify-between pt-2 border-t border-border dark:border-border/30">
                      <span className="text-sm font-bold text-foreground">Total</span>
                      <span className="text-base font-bold text-primary">{formatCurrency(configTotal)}</span>
                    </div>

                    {configPaymentText && (
                      <div className="pt-2">
                        <div className="flex items-center gap-2 text-sm font-semibold text-foreground mb-1">
                          <IconCreditCard className="h-4 w-4 text-muted-foreground" />
                          Condições de Pagamento
                        </div>
                        <p className="text-sm text-muted-foreground">{configPaymentText}</p>
                      </div>
                    )}

                    {/* Boletos (from invoice data or fallback to simple parcelas) */}
                    {(() => {
                      const configInvoice = invoices.find((inv) => inv.customerConfigId === config.id);
                      if (configInvoice) {
                        const invoiceInstallments = configInvoice.installments ? [...configInvoice.installments].sort((a, b) => a.number - b.number) : [];
                        return (
                          <div className="pt-2 space-y-2">
                            {/* Parcelas */}
                            <div className="flex items-center justify-between text-sm font-semibold text-foreground">
                              <div className="flex items-center gap-2">
                                <IconReceipt className="h-3.5 w-3.5 text-muted-foreground" />
                                Parcelas
                              </div>
                              <DownloadAllBoletosButton installments={invoiceInstallments} />
                            </div>
                            <div className="divide-y divide-border/50 rounded-md border border-border/50 overflow-hidden">
                              {invoiceInstallments.map((installment) => (
                                <div key={installment.id} className="px-3 py-2 hover:bg-muted/40 transition-colors">
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3 flex-1 min-w-0 flex-wrap">
                                      <span className="text-xs text-muted-foreground">{formatDate(installment.dueDate)}</span>
                                      <span className="text-xs font-medium">{formatCurrency(installment.amount)}</span>
                                      <InstallmentStatusBadge status={installment.status} size="sm" />
                                      {installment.bankSlip && <BankSlipStatusBadge status={installment.bankSlip.status} size="sm" />}
                                    </div>
                                    <BoletoActions
                                      installmentId={installment.id}
                                      bankSlip={installment.bankSlip}
                                      dueDate={installment.dueDate}
                                      installmentStatus={installment.status}
                                      installmentPaymentMethod={installment.paymentMethod}
                                      paidAt={installment.paidAt}
                                      receiptFiles={installment.receiptFiles}
                                      observations={installment.observations}
                                    />
                                  </div>
                                </div>
                              ))}
                            </div>

                            {/* NFS-e */}
                            <div className="flex items-center gap-2 text-sm font-semibold text-foreground pt-1">
                              <IconFileInvoice className="h-3.5 w-3.5 text-muted-foreground" />
                              NFS-e
                            </div>
                            <div className="rounded-md border border-border/50 px-3 py-2">
                              {(() => {
                                const nfseDocuments = configInvoice.nfseDocuments ?? [];
                                const activeNfse = nfseDocuments.find((d) => d.status === "AUTHORIZED") ?? nfseDocuments[nfseDocuments.length - 1] ?? null;
                                return (
                                  <>
                                    <div className="flex items-center justify-between">
                                      <div className="flex items-center gap-3">
                                        {activeNfse ? (
                                          <NfseStatusBadge status={activeNfse.status} size="sm" />
                                        ) : (
                                          <span className="text-xs text-muted-foreground">Nao emitida</span>
                                        )}
                                        {nfseDocuments.length > 1 && <span className="text-xs text-muted-foreground">({nfseDocuments.length} emissões)</span>}
                                      </div>
                                      <div className="flex items-center gap-1">
                                        {activeNfse?.elotechNfseId && <NfsePdfButtons elotechNfseId={activeNfse.elotechNfseId} />}
                                        <NfseActions invoiceId={configInvoice.id} nfseDocuments={nfseDocuments} showCancel={false} />
                                      </div>
                                    </div>
                                    {activeNfse?.elotechNfseId && <NfseEnrichedInfo elotechNfseId={activeNfse.elotechNfseId} />}
                                    {activeNfse?.status === "ERROR" && activeNfse.errorMessage && <p className="text-xs text-destructive mt-1">{activeNfse.errorMessage}</p>}
                                  </>
                                );
                              })()}
                            </div>
                          </div>
                        );
                      }

                      // Fallback: simple parcelas when no invoice data
                      if (config.installments && config.installments.length > 0) {
                        return (
                          <div className="pt-2">
                            <div className="text-sm font-semibold text-foreground mb-1">Parcelas</div>
                            <div className="space-y-1">
                              {config.installments.map((inst) => (
                                <div key={inst.id} className="flex items-center justify-between text-sm text-muted-foreground">
                                  <span>
                                    {inst.number}ª — {formatDate(inst.dueDate)}
                                  </span>
                                  <span className="font-medium text-foreground">{formatCurrency(inst.amount)}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      }

                      return null;
                    })()}
                  </div>
                );
              })}
            </div>
          );
        })()}

      {/* Delivery Deadline */}
      {part === "budget" && (quote.customForecastDays || (quote.simultaneousTasks && quote.simultaneousTasks > 1)) && (
        <div className="bg-muted/30 rounded-lg p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground mb-2">
            <IconTruck className="h-4 w-4 text-muted-foreground" />
            Prazo de Entrega
          </div>
          <p className="text-sm text-muted-foreground">
            {quote.customForecastDays && <>O prazo de entrega é de {quote.customForecastDays} dias úteis a partir da data de liberação.</>}
            {quote.simultaneousTasks && quote.simultaneousTasks > 1 && (
              <>
                {quote.customForecastDays ? " " : ""}Capacidade de produção: {quote.simultaneousTasks} tarefas simultâneas.
              </>
            )}
          </p>
        </div>
      )}

      {/* Payment Conditions */}
      {(() => {
        if (part !== "billing") return null;
        const configs = quote.customerConfigs || [];
        // When filtering a specific customer, use that config's payment data
        if (quoteCustomerFilter) {
          const selectedConfig = configs.find((c) => c.customerId === quoteCustomerFilter);
          if (selectedConfig) return null; // Already shown in per-customer card above
        }
        // When "Completo" with 2+ configs, skip global (shown in per-customer cards)
        if (!quoteCustomerFilter && configs.length >= 2) return null;
        // When 1 config, use that config's data
        if (configs.length === 1) {
          const config = configs[0];
          const configTotal = typeof config.total === "number" ? config.total : Number(config.total) || 0;
          // Mesma leitura do cartão por cliente acima.
          const clause = quoteClauseArgs(quote as any, config);
          const paymentBody = generatePaymentText({
            customPaymentText: config.customPaymentText,
            paymentConfig: (config as any).paymentConfig,
            paymentCondition: config.paymentCondition,
            total: configTotal,
            vehicleCount: clause.vehicleCount,
            coveredVehicleCount: clause.coveredVehicleCount,
          });
          const paymentText = paymentBody ? `${clause.prefix}${paymentBody}` : "";
          const hasContent = Boolean(paymentText);
          return hasContent ? (
            <div className="bg-muted/30 rounded-lg p-4 space-y-2">
              {paymentText && (
                <>
                  <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                    <IconCreditCard className="h-4 w-4 text-muted-foreground" />
                    Condições de Pagamento
                  </div>
                  <p className="text-sm text-muted-foreground">{paymentText}</p>
                </>
              )}

            </div>
          ) : null;
        }
        // Fallback to global quote (paymentCondition now lives on config level)
        // Sem nenhuma fatia, `quote.total` é o CONTRATO inteiro — que é o que
        // uma fatura conjunta cobraria. Declarar a cobertura como "todos" deixa
        // isso explícito em vez de deixar o padrão responder por acidente.
        const fallbackVehicleCount = quoteVehicleCount(quote as any);
        const paymentText = generatePaymentText({
          customPaymentText: null,
          paymentCondition: null,
          total: typeof quote.total === "number" ? quote.total : Number(quote.total) || 0,
          vehicleCount: fallbackVehicleCount,
          coveredVehicleCount: fallbackVehicleCount,
        });
        return paymentText ? (
          <div className="bg-muted/30 rounded-lg p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground mb-2">
              <IconCreditCard className="h-4 w-4 text-muted-foreground" />
              Condições de Pagamento
            </div>
            <p className="text-sm text-muted-foreground">{paymentText}</p>
          </div>
        ) : null;
      })()}

      {/* Boletos & NFS-e for single-customer case (not shown in per-customer cards) */}
      {(() => {
        if (part !== "billing") return null;
        const configs = quote.customerConfigs || [];
        // Only show here when there's a single config and no customer filter (per-customer cards don't render)
        if (quoteCustomerFilter || configs.length !== 1) return null;
        const config = configs[0];
        const configInvoice = invoices.find((inv) => inv.customerConfigId === config.id);
        if (!configInvoice) {
          // Fallback: simple parcelas
          if (!config.installments || config.installments.length === 0) return null;
          return (
            <div className="bg-muted/30 rounded-lg p-4">
              <div className="text-sm font-semibold text-foreground mb-2">Parcelas</div>
              <div className="space-y-1">
                {config.installments.map((inst) => (
                  <div key={inst.id} className="flex items-center justify-between text-sm text-muted-foreground">
                    <span>
                      {inst.number}ª — {formatDate(inst.dueDate)}
                    </span>
                    <span className="font-medium text-foreground">{formatCurrency(inst.amount)}</span>
                  </div>
                ))}
              </div>
            </div>
          );
        }

        const invoiceInstallments = configInvoice.installments ? [...configInvoice.installments].sort((a, b) => a.number - b.number) : [];

        return (
          <div className="bg-muted/30 rounded-lg p-4 space-y-3">
            {/* Parcelas */}
            {invoiceInstallments.length > 0 && (
              <>
                <div className="flex items-center justify-between text-sm font-semibold text-foreground">
                  <div className="flex items-center gap-2">
                    <IconReceipt className="h-3.5 w-3.5 text-muted-foreground" />
                    Parcelas
                  </div>
                  <DownloadAllBoletosButton installments={invoiceInstallments} />
                </div>
                <div className="divide-y divide-border/50 rounded-md border border-border/50 overflow-hidden">
                  {invoiceInstallments.map((installment) => (
                    <div key={installment.id} className="px-3 py-2 hover:bg-muted/40 transition-colors">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3 flex-1 min-w-0 flex-wrap">
                          <span className="text-xs text-muted-foreground">{formatDate(installment.dueDate)}</span>
                          <span className="text-xs font-medium">{formatCurrency(installment.amount)}</span>
                          <InstallmentStatusBadge status={installment.status} size="sm" />
                          {installment.bankSlip && <BankSlipStatusBadge status={installment.bankSlip.status} size="sm" />}
                        </div>
                        <BoletoActions
                                      installmentId={installment.id}
                                      bankSlip={installment.bankSlip}
                                      dueDate={installment.dueDate}
                                      installmentStatus={installment.status}
                                      installmentPaymentMethod={installment.paymentMethod}
                                      paidAt={installment.paidAt}
                                      receiptFiles={installment.receiptFiles}
                                      observations={installment.observations}
                                    />
                      </div>
                      {installment.bankSlip?.pdfFile && (
                        <div className="mt-1.5">
                          <FileItem
                            file={installment.bankSlip.pdfFile as unknown as CustomFile}
                            viewMode="list"
                            onPreview={(file) => fileViewerContext?.actions.viewFile(file)}
                            onDownload={(file) => fileViewerContext?.actions.downloadFile(file)}
                            showActions
                          />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* NFS-e */}
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground pt-1">
              <IconFileInvoice className="h-3.5 w-3.5 text-muted-foreground" />
              NFS-e
            </div>
            <div className="rounded-md border border-border/50 px-3 py-2">
              {(() => {
                const nfseDocuments = configInvoice.nfseDocuments ?? [];
                const activeNfse = nfseDocuments.find((d) => d.status === "AUTHORIZED") ?? nfseDocuments[nfseDocuments.length - 1] ?? null;
                return (
                  <>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {activeNfse ? <NfseStatusBadge status={activeNfse.status} size="sm" /> : <span className="text-xs text-muted-foreground">Nao emitida</span>}
                        {nfseDocuments.length > 1 && <span className="text-xs text-muted-foreground">({nfseDocuments.length} emissões)</span>}
                      </div>
                      <div className="flex items-center gap-1">
                        {activeNfse?.elotechNfseId && activeNfse.status === "AUTHORIZED" && <NfsePdfButtons elotechNfseId={activeNfse.elotechNfseId} />}
                        <NfseActions invoiceId={configInvoice.id} nfseDocuments={nfseDocuments} showCancel={false} />
                      </div>
                    </div>
                    {activeNfse?.elotechNfseId && <NfseEnrichedInfo elotechNfseId={activeNfse.elotechNfseId} />}
                    {activeNfse?.status === "ERROR" && activeNfse.errorMessage && <p className="text-xs text-destructive mt-1">{activeNfse.errorMessage}</p>}
                  </>
                );
              })()}
            </div>
          </div>
        );
      })()}

      {/* Histórico completo de NFS-e da tarefa — inclui notas órfãs, isto é, notas emitidas e
          depois canceladas cujo faturamento foi revertido (invoiceId → null). Os blocos acima
          leem apenas as notas da fatura viva, então sem isto uma nota que existiu de verdade
          na prefeitura simplesmente sumia da tela. Escopo de tarefa, renderizado uma vez. */}
      {part === "billing" && <TaskNfseHistoryCard taskId={task.id} />}

      {/* Guarantee */}
      {(() => {
        if (part !== "budget") return null;
        const guaranteeText = generateGuaranteeText(quote);
        return guaranteeText ? (
          <div className="bg-muted/30 rounded-lg p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground mb-2">
              <IconShieldCheck className="h-4 w-4 text-muted-foreground" />
              Garantia
            </div>
            <p className="text-sm text-muted-foreground">{guaranteeText}</p>
          </div>
        ) : null;
      })()}

      {/* Layout File Preview (the layoutFiles array) */}
      {part === "budget" && (quote.layoutFiles?.length ?? 0) > 0 && (
        <div className="bg-muted/30 rounded-lg p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground mb-3">
            <IconPhoto className="h-4 w-4 text-muted-foreground" />
            Layout Aprovados
          </div>
          <div className="flex flex-wrap justify-start gap-3">
            {(quote.layoutFiles || []).map((layoutFile: any) => (
              <img
                key={layoutFile.id}
                src={`${getApiBaseUrl()}/files/thumbnail/${layoutFile.id}`}
                alt="Layout aprovado"
                className="max-h-48 rounded-lg shadow-sm object-contain cursor-pointer hover:opacity-90 transition-opacity"
                onClick={() => {
                  if (fileViewerContext) {
                    fileViewerContext.actions.viewFile(layoutFile);
                  }
                }}
              />
            ))}
          </div>
        </div>
      )}

      {/* Customer Signature - read from the first config (or filtered config) */}
      {(() => {
        if (part !== "budget") return null;
        const sigConfig = quoteCustomerFilter ? quote.customerConfigs?.find((c: any) => c.customerId === quoteCustomerFilter) : quote.customerConfigs?.[0];
        const configSig = sigConfig?.customerSignature;
        if (!configSig) return null;
        return (
          <div className="bg-muted/30 rounded-lg p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground mb-3">
              <IconWriting className="h-4 w-4 text-muted-foreground" />
              Assinatura do Cliente
            </div>
            <div className="flex justify-center">
              <img
                src={`${getApiBaseUrl()}/files/serve/${configSig.id}`}
                alt="Assinatura do cliente"
                className="max-h-24 object-contain cursor-pointer hover:opacity-90 transition-opacity"
                onClick={() => {
                  if (fileViewerContext && configSig) {
                    fileViewerContext.actions.viewFile(configSig);
                  }
                }}
              />
            </div>
          </div>
        );
      })()}

      {/* Assinatura eletrônica — mesmo painel da página de orçamento (status, link
          pessoal de cada signatário, WhatsApp, reenvio, PDF e hash). */}
      {part === "budget" && <SignatureEnvelopeCard quoteId={quote.id} canManage={canManageSignature} embedded />}
    </div>
  );
}

function DownloadAllBoletosButton({ installments }: { installments: any[] }) {
  const [isDownloading, setIsDownloading] = useState(false);

  const downloadable = installments.filter((inst) => inst.bankSlip && (inst.bankSlip.status === "ACTIVE" || inst.bankSlip.status === "OVERDUE"));

  if (downloadable.length < 2) return null;

  const handleDownloadAll = async () => {
    setIsDownloading(true);
    try {
      const JSZip = (await import("jszip")).default;
      const zip = new JSZip();

      for (const inst of downloadable) {
        const res = await invoiceService.getBoletoPdf(inst.id);
        const blob = res.data instanceof Blob ? res.data : new Blob([res.data], { type: "application/pdf" });
        zip.file(`boleto-parcela-${inst.number}.pdf`, blob);
      }

      const zipBlob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `boletos.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      // download failures are surfaced by the api client.
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <Button variant="ghost" size="sm" onClick={handleDownloadAll} disabled={isDownloading} title="Baixar todos os boletos" className="h-7 px-2 text-xs gap-1">
      {isDownloading ? <IconLoader2 className="h-3.5 w-3.5 animate-spin" /> : <IconDownload className="h-3.5 w-3.5" />}
      Baixar todos
    </Button>
  );
}

function NfsePdfButtons({ elotechNfseId }: { elotechNfseId: number }) {
  const [isViewing, setIsViewing] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  const fetchPdf = async () => {
    const res = await nfseService.getPdf(elotechNfseId);
    return res.data instanceof Blob ? res.data : new Blob([res.data], { type: "application/pdf" });
  };

  const handleView = async () => {
    setIsViewing(true);
    try {
      const blob = await fetchPdf();
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank");
      setTimeout(() => URL.revokeObjectURL(url), 30000);
    } catch {
      // surfaced by the api client.
    } finally {
      setIsViewing(false);
    }
  };

  const handleDownload = async () => {
    setIsDownloading(true);
    try {
      const blob = await fetchPdf();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `nfse-${elotechNfseId}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      // download failures are surfaced by the api client.
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <>
      <Button variant="ghost" size="sm" onClick={handleView} disabled={isViewing} title="Visualizar NFS-e" className="h-7 w-7 p-0">
        {isViewing ? <IconLoader2 className="h-4 w-4 animate-spin" /> : <IconEye className="h-4 w-4" />}
      </Button>
      <Button variant="ghost" size="sm" onClick={handleDownload} disabled={isDownloading} title="Baixar NFS-e" className="h-7 w-7 p-0">
        {isDownloading ? <IconLoader2 className="h-4 w-4 animate-spin" /> : <IconDownload className="h-4 w-4" />}
      </Button>
    </>
  );
}
