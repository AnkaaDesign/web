import { useState, useEffect, useCallback, useMemo } from "react";
import { useParams } from "react-router-dom";
import { taskQuoteService } from "@/api-client/task-quote";
import { formatCurrency, formatDate, toTitleCase, formatCNPJ } from "@/utils";
import { getApiBaseUrl } from "@/utils/file";
import { getPricingVisible, setPricingVisible } from "@/utils/pricing-visibility";
import { generatePaymentText, generateGuaranteeText } from "@/utils/quote-text-generators";
import { budgetPdfFilename } from "@/utils/document-filename";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toast } from "@/components/ui/sonner";
import { BudgetSignaturePanel } from "@/components/public/budget-signature-panel";
import { signatureService } from "@/api-client/signature";
import { IconAlertCircle, IconLoader2, IconBrandWhatsapp, IconCopy, IconFileTypePdf, IconChevronDown, IconShare, IconShieldCheck } from "@tabler/icons-react";
import type { TaskQuote } from "@/types/task-quote";
import { COMPANY_INFO, BRAND_COLORS } from "@/config/company";
import { TRUCK_CATEGORY_LABELS, IMPLEMENT_TYPE_LABELS } from "@/constants/enum-labels";

import { BRAND_ASSETS } from '@/config/assets';
// Company constants assembled from centralized config
const COMPANY = {
  ...COMPANY_INFO,
  ...BRAND_COLORS,
};

// Helper to get original file URL (full quality, preserves transparency)
const getFileServeUrl = (file: { id: string } | null | undefined): string => {
  if (!file?.id) return "";
  const apiBaseUrl = getApiBaseUrl();
  return `${apiBaseUrl}/files/serve/${file.id}`;
};

interface QuoteData extends TaskQuote {
  task?: {
    id: string;
    name?: string;
    serialNumber?: string;
    term?: Date;
    responsibles?: { id: string; name?: string; role?: string }[];
    customer?: {
      id: string;
      corporateName?: string;
      fantasyName?: string;
    };
    truck?: {
      plate?: string;
      chassisNumber?: string;
      category?: string | null;
      implementType?: string | null;
    };
  };
}

export function PublicBudgetPage() {
  const { id, customerId } = useParams<{ id: string; customerId: string }>();
  const [quote, setQuote] = useState<QuoteData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  /** Código do envelope, reportado pelo painel de assinaturas (ver onEnvelope). */
  const [verificationCode, setVerificationCode] = useState<string | null>(null);
  // useCallback: o painel tem `onEnvelope` nas dependências do efeito que busca o
  // resumo — uma função nova a cada render dispararia a busca em laço.
  const handleEnvelope = useCallback(
    (summary: { verificationCode?: string }) => setVerificationCode(summary.verificationCode ?? null),
    [],
  );

  // This is a customer-facing public page (unauthenticated, no eye-toggle in
  // reach) — it must always show real currency values regardless of the
  // internal staff eye-toggle's hidden-by-default state (that toggle only
  // makes sense inside the authenticated app, where the button to reveal
  // values actually exists).
  useEffect(() => {
    // Restore on the way out: money visibility is a SAVED preference now
    // (nothing resets it on navigation any more), so forcing it on here and
    // walking away would leave the authenticated app showing values the user
    // had deliberately hidden.
    const previous = getPricingVisible();
    setPricingVisible(true);
    return () => setPricingVisible(previous);
  }, []);

  // A config's customer: the FK when the payload carries it, else the nested
  // customer's id. Both are matched because the public select has shipped
  // without the FK before — and when nothing matches, the page silently falls
  // back to the complete view instead of the one customer that was asked for.
  const configCustomerId = (config: any): string | undefined => config?.customerId || config?.customer?.id;
  const serviceCustomerId = (svc: any): string | undefined => svc?.invoiceToCustomerId || svc?.invoiceToCustomer?.id;

  // Use customerId from URL to filter services for a specific invoiceTo customer
  // If customerId matches one of the customerConfigs' customer, activate filtering
  const selectedCustomerId = useMemo(() => {
    if (!customerId || !quote?.customerConfigs) return null;
    const isConfigCustomer = quote.customerConfigs.some(c => configCustomerId(c) === customerId);
    return isConfigCustomer ? customerId : null;
  }, [customerId, quote?.customerConfigs]);

  // Fetch quote data
  const fetchQuote = useCallback(async () => {
    if (!id) {
      setError("ID do orçamento não fornecido.");
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const response = await taskQuoteService.getPublic(id);
      if (response.data?.success && response.data?.data) {
        setQuote(response.data.data);
        setError(null);
      } else {
        setError(response.data?.message || "Erro ao carregar orçamento.");
      }
    } catch (err: any) {
      const message = err.response?.data?.message || "Erro ao carregar orçamento.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchQuote();
  }, [fetchQuote]);

  // Handle signature file selection
  // Filter services based on selected customer (hooks must be before early returns).
  //
  // A service with no invoice-to customer belongs to every view on a
  // single-customer quote (the API's own per-config totals count all services
  // there). On a MULTI-customer quote it belongs to no config and is counted in
  // no config total, so listing it under one customer would show a line the
  // Total below doesn't include.
  const filteredServices = useMemo(() => {
    if (!quote?.services) return [];
    if (!selectedCustomerId) return quote.services;
    const isMultiCustomerQuote = (quote?.customerConfigs?.length ?? 0) >= 2;
    return quote.services.filter((service) => {
      const svcCustomer = serviceCustomerId(service);
      if (svcCustomer) return svcCustomer === selectedCustomerId;
      return !isMultiCustomerQuote;
    });
  }, [quote?.services, quote?.customerConfigs?.length, selectedCustomerId]);

  // Recalculate subtotal for filtered services
  const filteredSubtotal = useMemo(() => {
    return filteredServices.reduce((sum, service) => sum + (Number(service.amount) || 0), 0);
  }, [filteredServices]);

  // Compute discount from customer config level (must be before early returns)
  const activeConfigForDiscount = quote?.customerConfigs?.find((c: any) => configCustomerId(c) === selectedCustomerId) || quote?.customerConfigs?.[0];
  const computedDiscountAmount = useMemo(() => {
    if (!activeConfigForDiscount) return 0;
    const subtotal = typeof activeConfigForDiscount.subtotal === 'number' ? activeConfigForDiscount.subtotal : Number(activeConfigForDiscount.subtotal) || 0;
    const total = typeof activeConfigForDiscount.total === 'number' ? activeConfigForDiscount.total : Number(activeConfigForDiscount.total) || 0;
    return Math.max(0, Math.round((subtotal - total) * 100) / 100);
  }, [activeConfigForDiscount]);
  const hasDiscount = computedDiscountAmount > 0;

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <IconLoader2 className="h-12 w-12 animate-spin text-[#1a8b3d] mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-300">Carregando orçamento...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-gray-100 dark:bg-gray-900 flex items-center justify-center p-4">
        <Card className="max-w-md w-full bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
          <CardContent className="pt-6 text-center">
            <IconAlertCircle className="h-16 w-16 text-red-500 dark:text-red-400 mx-auto mb-4" />
            <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">
              Orçamento Indisponível
            </h1>
            <p className="text-gray-600 dark:text-gray-300">{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!quote) return null;

  // Calculate derived data
  // Find the relevant customer config (filtered by URL param, or first available)
  const activeConfig = quote.customerConfigs?.find(c => configCustomerId(c) === selectedCustomerId) || quote.customerConfigs?.[0];
  // The budget's contact is ALWAYS the task's first responsible — the quote no longer
  // carries its own (which went stale after duplicating a task + changing its responsible).
  const contactName = quote.task?.responsibles?.[0]?.name || "";
  // Invoice-to customer (woven into the intro): corporate/fantasy name + CNPJ or CPF
  // when present. Prefer the active config's customer, fall back to the task's.
  const billCustomer: any = activeConfig?.customer || quote.task?.customer;
  const invoiceName: string = billCustomer?.corporateName || billCustomer?.fantasyName || "";
  const invoiceDoc: string = billCustomer?.cnpj
    ? `CNPJ ${formatCNPJ(billCustomer.cnpj)}`
    : billCustomer?.cpf
      ? `CPF ${billCustomer.cpf}`
      : "";
  // Format budget number with leading zeros (e.g., "0042")
  const budgetNumber = quote.budgetNumber
    ? String(quote.budgetNumber).padStart(4, '0')
    : quote.task?.serialNumber || "0000";
  /**
   * Validade como DATA ABSOLUTA, igual ao documento assinado.
   *
   * Aqui se imprimia "Validade: N dias", recalculado contra `new Date()` a cada
   * carregamento, virando um "Vencido" vermelho quando N chegava a zero — ou
   * seja, a página dizia uma coisa hoje e outra amanhã enquanto o PDF que ela
   * oferece para download dizia "Válido até DD/MM/AAAA" e não se movia. Ver a
   * decisão 2 no cabeçalho de `api/.../document/quote-html.builder.ts`.
   */
  const validUntil = quote.expiresAt ? formatDate(quote.expiresAt) : "";
  const termDate = quote.task?.term ? formatDate(quote.task.term) : "";
  // Custom delivery days (production time) - used when no term date is set
  const customDeliveryDays = quote.customForecastDays || null;
  const paymentText = generatePaymentText({
    customPaymentText: activeConfig?.customPaymentText || null,
    paymentConfig: (activeConfig as any)?.paymentConfig || null,
    paymentCondition: activeConfig?.paymentCondition,
    total: activeConfig?.total ?? quote.total,
  });
  const guaranteeText = generateGuaranteeText(quote);

  const whatsappLink = `https://wa.me/${COMPANY.phoneClean}`;
  // Use serve endpoint for full quality images (layoutFiles array, up to 2)
  const layoutImageUrls: string[] = (quote.layoutFiles || [])
    .filter((f: any) => f?.id)
    .map((f: any) => getFileServeUrl(f));
  // Use serve endpoint for signature to preserve PNG transparency

  // Recalculate discount and total based on active filter
  const isCompleteViewGlobal = !selectedCustomerId && (quote?.customerConfigs?.length ?? 0) >= 2;
  const displaySubtotal = selectedCustomerId
    ? (typeof activeConfig?.subtotal === 'number' ? activeConfig.subtotal : Number(activeConfig?.subtotal) || filteredSubtotal)
    : quote.subtotal;
  const displayTotal = selectedCustomerId
    ? (typeof activeConfig?.total === 'number' ? activeConfig.total : Number(activeConfig?.total) || 0)
    : isCompleteViewGlobal
      ? quote.customerConfigs!.reduce((sum: number, c: any) => sum + (typeof c.total === 'number' ? c.total : Number(c.total) || 0), 0)
      : quote.total;

  // Copy URL to clipboard
  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      toast.success("Link copiado!");
    } catch {
      toast.error("Não foi possível copiar o link.");
    }
  };

  // WhatsApp share: compose message with budget title + URL
  const handleWhatsAppShare = () => {
    const message = `Orçamento Nº ${budgetNumber} - ${COMPANY.name}\n${window.location.href}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, "_blank");
  };

  // Export as PDF (same output as task detail page)
  /**
   * Baixa o MESMO documento que o "Ver documento" abre.
   *
   * Antes isto chamava o gerador do navegador (`exportBudgetPdfFromData`), que
   * produzia um PDF diferente do que está sendo assinado — dois documentos com o
   * mesmo número. Agora existe uma única fonte: o servidor. Quando ainda não há
   * coleta, a MESMA rota devolve o orçamento renderizado sob demanda, com as
   * linhas de assinatura em branco — o download nunca depende de existir
   * assinatura.
   */
  const handleExportPdf = async () => {
    try {
      const res = await fetch(signatureService.quoteDocumentUrl(id!), { credentials: "omit" });
      if (!res.ok) throw new Error(String(res.status));
      const url = URL.createObjectURL(await res.blob());
      const a = document.createElement("a");
      a.href = url;
      a.download = budgetPdfFilename(quote?.task?.customer, quote?.budgetNumber);
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch {
      toast.error("Não foi possível gerar o PDF deste orçamento. Tente novamente.");
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Single Page Budget */}
        <div className="bg-white shadow-lg rounded-lg overflow-hidden relative">
          <div className="p-6 md:p-8">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start gap-4 mb-6">
              <img src={BRAND_ASSETS.logo} alt="Ankaa Design" className="h-16 md:h-20" />
              <div className="flex flex-col items-end gap-2">
                <Popover open={menuOpen} onOpenChange={setMenuOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className="gap-2 h-9 px-3 text-sm font-medium"
                      style={{ borderColor: COMPANY.primaryGreen, color: COMPANY.primaryGreen }}
                    >
                      <IconShare className="h-4 w-4" />
                      Opções
                      <IconChevronDown className={`h-3.5 w-3.5 opacity-70 transition-transform ${menuOpen ? 'rotate-180' : ''}`} />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent align="end" sideOffset={6} className="w-60 p-1 bg-white border border-gray-200 shadow-lg">
                    <button
                      onClick={() => { setMenuOpen(false); handleCopyLink(); }}
                      className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 hover:text-gray-900 transition-colors"
                    >
                      <IconCopy className="h-4 w-4 text-gray-500" />
                      Copiar link
                    </button>
                    <button
                      onClick={() => { setMenuOpen(false); handleWhatsAppShare(); }}
                      className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 hover:text-gray-900 transition-colors"
                    >
                      <IconBrandWhatsapp className="h-4 w-4 text-green-600" />
                      WhatsApp
                    </button>
                    <button
                      onClick={() => { setMenuOpen(false); handleExportPdf(); }}
                      className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 hover:text-gray-900 transition-colors"
                    >
                      <IconFileTypePdf className="h-4 w-4 text-red-500" />
                      Baixar PDF
                    </button>
                    {/* Só existe quando há envelope emitido: sem código de
                        verificação não há o que verificar. */}
                    {verificationCode && (
                      <button
                        onClick={() => {
                          setMenuOpen(false);
                          window.open(`/v/${verificationCode}`, "_blank", "noopener,noreferrer");
                        }}
                        className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 hover:text-gray-900 transition-colors"
                      >
                        <IconShieldCheck className="h-4 w-4" style={{ color: COMPANY.primaryGreen }} />
                        Verificar autenticidade
                      </button>
                    )}
                  </PopoverContent>
                </Popover>
                {/* Cabeçalho idêntico ao do PDF: número em VERDE da marca e as
                    duas datas empilhadas em cinza, com os rótulos em negrito
                    escuro. Antes o número saía cinza-escuro e as datas na mesma
                    linha. */}
                <div className="text-right">
                  <h1
                    className="text-xl md:text-2xl font-bold"
                    style={{ color: COMPANY.primaryGreen }}
                  >
                    Orçamento Nº {budgetNumber}
                  </h1>
                  <p className="text-sm mt-1 leading-relaxed" style={{ color: COMPANY.textGray }}>
                    <span className="font-semibold" style={{ color: COMPANY.textDark }}>Emissão:</span>{' '}
                    {formatDate(quote.createdAt)}
                    <br />
                    <span className="font-semibold" style={{ color: COMPANY.textDark }}>Válido até:</span>{' '}
                    {validUntil}
                  </p>
                </div>
              </div>
            </div>

            {/* Régua do cabeçalho: 2 px VERDE MACIÇO, como `.header-line` no PDF.
                O degradê cinza→verde de 1 px que existia aqui não tem par
                nenhum no documento — e o rodapé abaixo espelha esta régua,
                de modo que a folha tem exatamente duas divisórias. */}
            <div className="mb-8" style={{ height: 2, backgroundColor: COMPANY.primaryGreen }} />

            {/* Title */}
            <h2
              className="text-xl font-bold underline underline-offset-4 mb-6"
              style={{ color: COMPANY.primaryGreen }}
            >
              ORÇAMENTO
            </h2>

            {/* Customer Info — "À Fulano" em PRETO semibold, como `.customer-name`
                no PDF. Em verde ele lia como um título de seção, que não é. */}
            <div className="mb-6">
              {contactName && (
                <p className="font-semibold mb-1" style={{ color: COMPANY.textDark }}>
                  À {contactName}
                </p>
              )}
              <p className="text-gray-700 text-justify">
                Conforme solicitado, apresentamos nossa proposta de preço
                {invoiceName ? (
                  <>
                    {" "}para a <strong>{invoiceName}</strong>
                    {invoiceDoc ? <> ({invoiceDoc})</> : null},
                  </>
                ) : null}
                {" "}para execução dos serviços abaixo descriminados
                {(() => {
                  const truckCategoryLabel = quote.task?.truck?.category
                    ? (TRUCK_CATEGORY_LABELS[quote.task.truck.category as keyof typeof TRUCK_CATEGORY_LABELS] || quote.task.truck.category)
                    : null;
                  const truckImplementLabel = quote.task?.truck?.implementType
                    ? (IMPLEMENT_TYPE_LABELS[quote.task.truck.implementType as keyof typeof IMPLEMENT_TYPE_LABELS] || quote.task.truck.implementType)
                    : null;
                  const parts: React.ReactNode[] = [];
                  if (quote.task?.serialNumber) parts.push(<> nº série: <strong>{quote.task.serialNumber}</strong></>);
                  if (quote.task?.truck?.plate) parts.push(<> placa: <strong>{quote.task.truck.plate}</strong></>);
                  if (quote.task?.truck?.chassisNumber) parts.push(<> chassi: <strong>{quote.task.truck.chassisNumber}</strong></>);
                  if (truckCategoryLabel) parts.push(<> categoria: <strong>{truckCategoryLabel}</strong></>);
                  if (truckImplementLabel) parts.push(<> implemento: <strong>{truckImplementLabel}</strong></>);
                  if (!parts.length) return null;
                  return (
                    <>
                      {" "}no veículo
                      {parts.map((p, i) => (
                        <span key={i}>{i > 0 && ","}{p}</span>
                      ))}
                    </>
                  );
                })()}.
              </p>
            </div>

            {/* Services */}
            {(() => {
              const isCompleteView = !selectedCustomerId && (quote?.customerConfigs?.length ?? 0) >= 2;
              return (
              <div className="mb-6">
              <h3 className="text-lg font-bold mb-4" style={{ color: COMPANY.primaryGreen }}>
                Serviços
              </h3>
              {/* pl-4 (not ml-4) so the price column's right edge lines up EXACTLY with
                  the Subtotal/Total column below (also pl-4) — a margin here would push
                  this table's full-width box 1rem further right than the totals div,
                  which only insets its content via padding. */}
              <div className="pl-4">
                <table className="w-full" style={{ borderCollapse: 'collapse' }}>
                  <tbody>
                  {filteredServices.map((service, index) => {
                    const isOutros = service.description?.trim().toLowerCase() === "outros";
                    const description = toTitleCase(service.description || "");
                    const observation = service.observation || "";
                    const displayText = isOutros && observation
                      ? observation
                      : observation
                        ? `${description} ${observation}`
                        : description;
                    const amount = Number(service.amount) || 0;
                    const svc = service as any;
                    const invoiceToName = svc.invoiceToCustomer?.corporateName || svc.invoiceToCustomer?.fantasyName;
                    // Filete pontilhado sob cada serviço, exceto o último — a
                    // mesma regra de `.service-row` no PDF, onde a última linha
                    // o dispensa porque logo abaixo vem a régua dos totais.
                    const isLast = index === filteredServices.length - 1;
                    return (
                      <tr
                        key={service.id}
                        className="align-top"
                        style={isLast ? undefined : { borderBottom: "0.5px dotted #ccc" }}
                      >
                        <td className="text-gray-800 py-1 pr-2">
                          {index + 1} - {displayText}
                        </td>
                        {isCompleteView && (
                          <td className="text-xs text-gray-500 whitespace-nowrap py-1 px-2">
                            {invoiceToName || '-'}
                          </td>
                        )}
                        <td className="text-gray-800 font-semibold whitespace-nowrap text-right py-1">
                          {formatCurrency(amount)}
                        </td>
                      </tr>
                    );
                  })}
                  </tbody>
                </table>
              </div>

              {/* Totals */}
              {isCompleteView ? (
                // Completo: show per-customer subtotals
                <div className="mt-6 pl-4 space-y-3">
                  {quote.customerConfigs!.map((config: any) => {
                    const configTotal = typeof config.total === 'number' ? config.total : Number(config.total) || 0;
                    const customerName = config.customer?.corporateName || config.customer?.fantasyName || 'Cliente';
                    return (
                      <div key={config.id} className="flex justify-between items-baseline">
                        <span className="text-gray-700 text-sm">{customerName}</span>
                        <span className="text-gray-800 font-medium">{formatCurrency(configTotal)}</span>
                      </div>
                    );
                  })}
                  <div
                    className="flex justify-between items-baseline pt-2"
                    style={{ borderTop: `1.5px solid ${COMPANY.primaryGreen}` }}
                  >
                    <span className="font-bold" style={{ color: COMPANY.primaryGreen }}>Total</span>
                    <span className="font-bold text-lg" style={{ color: COMPANY.primaryGreen }}>
                      {formatCurrency(displayTotal)}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="mt-6 pl-4 space-y-1">
                  {hasDiscount && (
                    <>
                      <div className="flex justify-between items-baseline">
                        <span className="text-gray-700">Subtotal</span>
                        <span className="text-gray-800">{formatCurrency(displaySubtotal)}</span>
                      </div>
                      {/* Rótulo em cor NORMAL e só o valor em vermelho — é o que
                          `.total-row-discount .total-value` faz no PDF. A linha
                          inteira vermelha lia como um erro, e não como um abatimento.
                          O rótulo também segue a forma do documento:
                          `Desconto (5%) — ESPECIAL`, percentual no parêntese e
                          referência depois do travessão. */}
                      <div className="flex justify-between items-baseline">
                        <span className="text-gray-700">
                          {activeConfig?.discountType === 'PERCENTAGE' && activeConfig?.discountValue
                            ? `Desconto (${activeConfig.discountValue}%)`
                            : 'Desconto'}
                          {activeConfig?.discountReference && <> — {activeConfig.discountReference}</>}
                        </span>
                        <span className="text-red-600">- {formatCurrency(computedDiscountAmount)}</span>
                      </div>
                    </>
                  )}
                  {/* Régua VERDE sobre o Total, como `.total-row-final` no PDF. */}
                  <div
                    className="flex justify-between items-baseline pt-2"
                    style={{ borderTop: `1.5px solid ${COMPANY.primaryGreen}` }}
                  >
                    <span className="font-bold" style={{ color: COMPANY.primaryGreen }}>Total</span>
                    <span className="font-bold text-lg" style={{ color: COMPANY.primaryGreen }}>
                      {formatCurrency(displayTotal)}
                    </span>
                  </div>
                </div>
              )}
              </div>
              );
            })()}

            {/* Delivery Term - customDeliveryDays takes priority over termDate */}
            {customDeliveryDays ? (
              <div className="mb-6">
                <h3 className="text-lg font-bold mb-2" style={{ color: COMPANY.primaryGreen }}>
                  Prazo de entrega
                </h3>
                {/* Frase LITERAL do documento assinado — o PDF diz "Neste
                    período, N tarefas poderão ser produzidas simultaneamente."
                    e a página dizia "Capacidade de produção: N tarefas
                    simultâneas.", que é outra afirmação. */}
                <p className="text-gray-700 text-justify">
                  O prazo de entrega é de {customDeliveryDays} dias úteis a partir da data de liberação.
                  {quote.simultaneousTasks && quote.simultaneousTasks > 1 && (
                    <> Neste período, {quote.simultaneousTasks} tarefas poderão ser produzidas simultaneamente.</>
                  )}
                </p>
              </div>
            ) : termDate ? (
              <div className="mb-6">
                <h3 className="text-lg font-bold mb-2" style={{ color: COMPANY.primaryGreen }}>
                  Prazo de entrega
                </h3>
                {/* O PDF não tem este ramo: `task.term` não entra no snapshot do
                    orçamento, então o documento assinado só sabe imprimir o
                    prazo em dias (`customForecastDays`). Mantido aqui porque
                    suprimi-lo tiraria do cliente uma informação que ele precisa
                    e que nenhum outro lugar da página dá. */}
                <p className="text-gray-700 text-justify">
                  O prazo de entrega é de {termDate}, desde que o implemento esteja nas condições
                  previamente informada e não haja alterações nos serviços descritos.
                </p>
              </div>
            ) : null}

            {/* Payment Terms */}
            {(() => {
              const isCompleteView = !selectedCustomerId && (quote?.customerConfigs?.length ?? 0) >= 2;
              if (isCompleteView) {
                // Show per-customer payment conditions
                return (
                  <div className="mb-6">
                    <h3 className="text-lg font-bold mb-2" style={{ color: COMPANY.primaryGreen }}>
                      Condições de pagamento
                    </h3>
                    <div className="space-y-3">
                      {quote.customerConfigs!.map((config: any) => {
                        const configPaymentText = generatePaymentText({
                          customPaymentText: config.customPaymentText || null,
                          paymentConfig: config.paymentConfig || null,
                          paymentCondition: config.paymentCondition,
                          total: config.total ?? 0,
                        });
                        if (!configPaymentText && !config.orderNumber) return null;
                        const customerName = config.customer?.corporateName || config.customer?.fantasyName || 'Cliente';
                        return (
                          <div key={config.id}>
                            <p className="text-sm font-semibold text-gray-800">{customerName}</p>
                            {configPaymentText && <p className="text-gray-700">{configPaymentText}</p>}
                            {config.orderNumber && (
                              <p className="text-sm text-gray-600 mt-1">
                                <span className="font-semibold">N° do Pedido:</span> {config.orderNumber}
                              </p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              }
              if (!paymentText && !activeConfig?.orderNumber) return null;
              return (
                <div className="mb-6">
                  {paymentText && (
                    <>
                      <h3 className="text-lg font-bold mb-2" style={{ color: COMPANY.primaryGreen }}>
                        Condições de pagamento
                      </h3>
                      <p className="text-gray-700">{paymentText}</p>
                    </>
                  )}
                  {activeConfig?.orderNumber && (
                    <p className="text-sm text-gray-600 mt-2">
                      <span className="font-semibold">N° do Pedido:</span> {activeConfig.orderNumber}
                    </p>
                  )}
                </div>
              );
            })()}

            {/* Guarantee */}
            {guaranteeText && (
              <div className="mb-6">
                <h3 className="text-lg font-bold mb-2" style={{ color: COMPANY.primaryGreen }}>
                  Garantias
                </h3>
                <p
                  className="text-gray-700"
                  dangerouslySetInnerHTML={{
                    __html: guaranteeText.replace(
                      /(\d+)\s*(anos?)/gi,
                      "<strong>$1 $2</strong>"
                    ),
                  }}
                />
              </div>
            )}

            {/* Layout Image(s) - Full Width (layoutFiles array) */}
            {/* Título "Layout" e imagens SEM moldura — `.layout-section` do PDF
                não arredonda nem sombreia nada, e chamava a seção de "Layout".
                As imagens são centralizadas e limitadas em altura (105 mm no
                PDF ≈ 397 px), em vez de esticadas na largura da folha. */}
            {layoutImageUrls.length > 0 && (
              <div className="mb-8">
                <h3 className="text-lg font-bold mb-4" style={{ color: COMPANY.primaryGreen }}>
                  Layout
                </h3>
                <div className="flex w-full flex-col items-center gap-4">
                  {layoutImageUrls.map((url, i) => (
                    <img
                      key={i}
                      src={url}
                      alt="Layout"
                      className="max-w-full h-auto object-contain"
                      style={{ maxHeight: 397 }}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Assinaturas — estado real da coleta eletrônica.
                O upload de imagem que existia aqui foi removido: aceitava um PNG
                qualquer, não registrava quem assinou, IP, hora, consentimento nem
                hash, e não alterava o status do orçamento — apesar de a tela
                afirmar que "o orçamento foi confirmado". Quem assina agora é o
                signatário, pelo link pessoal que recebe por WhatsApp. */}
            <BudgetSignaturePanel
              quoteId={id!}
              customerName={invoiceName || undefined}
              onEnvelope={handleEnvelope}
            />

            {/* Rodapé: régua de 2 px VERDE MACIÇO, espelhando a do cabeçalho —
                exatamente o que `.footer` faz no PDF. */}
            <div
              className="pt-4 mt-8"
              style={{ borderTop: `2px solid ${COMPANY.primaryGreen}` }}
            >
              <p className="font-bold" style={{ color: COMPANY.primaryGreen }}>
                {COMPANY.name}
              </p>
              <p className="text-sm text-gray-600">{COMPANY.address}</p>
              <p className="text-sm">
                <a
                  href={whatsappLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: COMPANY.primaryGreen }}
                  className="hover:underline"
                >
                  {COMPANY.phone.startsWith('(') ? COMPANY.phone : COMPANY.phone.replace(/^(\d{2})\s/, '($1) ')}
                </a>
              </p>
              <p className="text-sm">
                <a
                  href={COMPANY.websiteUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: COMPANY.primaryGreen }}
                  className="hover:underline"
                >
                  {COMPANY.websiteUrl}
                </a>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default PublicBudgetPage;
