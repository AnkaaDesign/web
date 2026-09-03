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
import { BudgetSignaturePanel, type Summary } from "@/components/public/budget-signature-panel";
import { signatureService } from "@/api-client/signature";
import { IconAlertCircle, IconLoader2, IconBrandWhatsapp, IconCopy, IconFileTypePdf, IconChevronDown, IconShare, IconShieldCheck } from "@tabler/icons-react";
import type { TaskQuote } from "@/types/task-quote";
import { QuoteVehicleTable } from "@/components/public/quote-vehicle-table";
import { quoteTasks, primaryTask, taskCount } from "@/utils/quote-tasks";
import { computeQuoteMoney } from "@/utils/quote-money";
import { QuoteBillingBox } from "@/components/public/quote-billing-box";
import { COMPANY_INFO, BRAND_COLORS } from "@/config/company";

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

  /**
   * Paginação do documento, para a tela se paginar como ele. `undefined` = ainda
   * carregando; `null` = sem envelope. A folha própria de assinaturas só existe
   * quando o PDF CONGELADO as tem fora da primeira folha (`signaturesPage > 0`);
   * cabendo tudo numa folha — o caso normal, com 2 signatários — elas ficam na
   * primeira, aqui e lá.
   */
  const [sigSummary, setSigSummary] = useState<Summary | null | undefined>(undefined);
  useEffect(() => {
    if (!id) return;
    let alive = true;
    signatureService
      .getQuoteSummary(id)
      .then((res: any) => {
        if (!alive) return;
        setSigSummary(res?.data?.data ?? res?.data ?? null);
      })
      .catch(() => alive && setSigSummary(null));
    return () => {
      alive = false;
    };
  }, [id]);
  /**
   * Folha própria para as assinaturas?
   *
   * COM envelope, a verdade é o documento congelado: `signaturesPage` sai das
   * âncoras gravadas e não se recalcula do orçamento de hoje, que pode ter mudado.
   *
   * SEM envelope não há documento congelado — o PDF é renderizado na hora, e o
   * arranjo é determinístico: havendo arte, ela e as assinaturas dividem a última
   * folha; não havendo, tudo fecha numa folha só. É a mesma regra do
   * `quote-renderer.service` (`if (!hasLayout) tryFusedRender`), aplicada aqui
   * sobre `layoutFiles` — a lista CRUA do orçamento, não as URLs já validadas, que
   * chegam depois e fariam o bloco pular de folha ao carregar.
   *
   * Resta um caso impreciso: sem envelope, sem layout e com orçamento longo demais
   * para uma folha (12+ serviços, ~3% deles), o documento pagina e a tela ainda diz
   * "folha 1". Sem re-renderizar o PDF não há como saber, e o envelope — que é
   * quando o documento passa a existir de verdade — resolve.
   */
  const signaturesOnOwnSheet = sigSummary?.hasEnvelope
    ? (sigSummary.signaturesPage ?? 0) > 0
    : (quote?.layoutFiles?.length ?? 0) > 0;

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
  // O responsável PRINCIPAL sai da união das tarefas — o mesmo conjunto que
  // assina o documento.
  const contactName =
    quoteTasks<any>(quote).flatMap((t: any) => t?.responsibles ?? [])[0]?.name || "";
  // Invoice-to customer (woven into the intro): corporate/fantasy name + CNPJ or CPF
  // when present. Prefer the active config's customer, fall back to the task's.
  const billCustomer: any = activeConfig?.customer || primaryTask<any>(quote)?.customer;
  const invoiceName: string = billCustomer?.corporateName || billCustomer?.fantasyName || "";
  const invoiceDoc: string = billCustomer?.cnpj
    ? `CNPJ ${formatCNPJ(billCustomer.cnpj)}`
    : billCustomer?.cpf
      ? `CPF ${billCustomer.cpf}`
      : "";
  // Format budget number with leading zeros (e.g., "0042")
  const budgetNumber = quote.budgetNumber
    ? String(quote.budgetNumber).padStart(4, '0')
    : primaryTask<any>(quote)?.serialNumber || "0000";
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
  const termDate = primaryTask<any>(quote)?.term
    ? formatDate(primaryTask<any>(quote)!.term)
    : "";
  // Custom delivery days (production time) - used when no term date is set
  const customDeliveryDays = quote.customForecastDays || null;
  const paymentText = generatePaymentText({
    customPaymentText: activeConfig?.customPaymentText || null,
    paymentConfig: (activeConfig as any)?.paymentConfig || null,
    paymentCondition: activeConfig?.paymentCondition,
    // `config.total` é o que a FATURA cobra — o total geral em `JOINT`, o de um
    // veículo em `PER_TASK` —, e é isso que a cláusula precisa descrever. O
    // unitário exibido na lista de serviços é outra coisa.
    total: activeConfig?.total ?? quote.total,
    vehicleCount: Math.max(1, taskCount(quote)),
    perVehicleBilling: ((quote as any).billingSplit ?? 'JOINT') === 'PER_TASK',
  });
  const guaranteeText = generateGuaranteeText(quote);

  const whatsappLink = `https://wa.me/${COMPANY.phoneClean}`;

  // Use serve endpoint for full quality images (layoutFiles array, up to 2)
  const layoutImageUrls: string[] = (quote.layoutFiles || [])
    .filter((f: any) => f?.id)
    .map((f: any) => getFileServeUrl(f));
  
  /**
   * Bloco "Layout", posicionado conforme o documento: quando a arte existe, ela
   * divide a ÚLTIMA folha com as assinaturas (o caminho de 2 partes do
   * renderizador); quando não existe, não há bloco e o contrato fecha numa folha
   * só, com as assinaturas nela.
   */
  const layoutBlock =
    layoutImageUrls.length > 0 ? (
      <div className="mb-8">
        <h3 className="text-lg font-bold mb-4" style={{ color: COMPANY.primaryGreen }}>
          Layout
        </h3>
        <div className="flex w-full flex-col items-center gap-4">
          {layoutImageUrls.map((url, i) => (
            <img key={i} src={url} alt="Layout" className="max-w-full h-auto object-contain" style={{ maxHeight: 397 }} />
          ))}
        </div>
      </div>
    ) : null;

  // Use serve endpoint for signature to preserve PNG transparency

  // Recalculate discount and total based on active filter
  const isCompleteViewGlobal = !selectedCustomerId && (quote?.customerConfigs?.length ?? 0) >= 2;
  // ═══════════════════════════════════════════════════════════════════════════
  // DINHEIRO: O VALOR UNITÁRIO, O "× N" E O TOTAL GERAL
  // ═══════════════════════════════════════════════════════════════════════════
  //
  // A lista de serviços acima mostra o preço de UM veículo, e
  // `activeConfig.total` é o que a FATURA cobra — que em `JOINT` já vem
  // multiplicado. Exibir os dois lado a lado sem a linha de multiplicação faria
  // a lista não fechar com o total: num orçamento de sessenta caminhões, por um
  // fator de sessenta.
  //
  // A conta é refeita a partir dos serviços com a MESMA fórmula da API
  // (`computeQuoteMoney`), que é o que garante que esta tela, o PDF assinado e o
  // boleto digam o mesmo número.
  const vehicleCount = Math.max(1, taskCount(quote));
  const money = computeQuoteMoney({
    serviceAmounts: filteredServices.map((sv: any) =>
      typeof sv.amount === 'number' ? sv.amount : Number(sv.amount) || 0,
    ),
    discountType: activeConfigForDiscount?.discountType,
    discountValue:
      activeConfigForDiscount?.discountValue != null
        ? Number(activeConfigForDiscount.discountValue)
        : null,
    taskCount: vehicleCount,
    billingSplit: (quote as any).billingSplit ?? 'JOINT',
  });
  const isMultiVehicle = vehicleCount > 1;

  // Com um veículo os valores exibidos são os de sempre (e vêm da configuração,
  // que é a fonte que o faturamento usa). Com N, a tela mostra o UNITÁRIO na
  // linha de subtotal/total e o geral no fecho.
  const displaySubtotal = isMultiVehicle
    ? money.perVehicleSubtotal
    : selectedCustomerId
      ? (typeof activeConfig?.subtotal === 'number' ? activeConfig.subtotal : Number(activeConfig?.subtotal) || filteredSubtotal)
      : quote.subtotal;
  const displayTotal = isMultiVehicle
    ? money.perVehicleTotal
    : selectedCustomerId
      ? (typeof activeConfig?.total === 'number' ? activeConfig.total : Number(activeConfig?.total) || 0)
      : isCompleteViewGlobal
        ? quote.customerConfigs!.reduce((sum: number, c: any) => sum + (typeof c.total === 'number' ? c.total : Number(c.total) || 0), 0)
        : quote.total;
  /** O valor do CONTRATO — `total por veículo × N`. */
  const displayGrandTotal = money.grandTotal;

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
      a.download = budgetPdfFilename(primaryTask<any>(quote)?.customer, quote?.budgetNumber);
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch {
      toast.error("Não foi possível gerar o PDF deste orçamento. Tente novamente.");
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 py-8 px-4 print:bg-white print:py-0 print:px-0">
      {/* Print styles — os mesmos da página do dossiê, para que a folha de
          assinaturas imprima como folha, e não emendada no fim do orçamento. */}
      <style>{`
        @media print {
          body { background: white !important; margin: 0; }
          .no-print { display: none !important; }
          .print-page-break { break-before: page; }
          .budget-card { box-shadow: none !important; border-radius: 0 !important; margin-top: 0 !important; }
          .budget-card + .budget-card { margin-top: 0 !important; }
        }
      `}</style>

      <div className="max-w-4xl mx-auto print:max-w-none">
        {/* Single Page Budget */}
        <div className="bg-white shadow-lg rounded-lg overflow-hidden relative budget-card">
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
                {quoteTasks(quote).length > 0 && (
                  <>
                    {" "}
                    {quoteTasks(quote).length > 1
                      ? "nos veículos abaixo relacionados"
                      : "no veículo abaixo identificado"}
                  </>
                )}
                {quoteTasks(quote).length > 0 ? ":" : "."}
              </p>
              {/* A IDENTIFICAÇÃO EM TABELA — espelha `.vehicle-table` do PDF
                  assinado. A frase acima só a anuncia. */}
              <QuoteVehicleTable quote={quote} />
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
                        <span className="text-gray-700">
                          Subtotal{isMultiVehicle ? " por veículo" : ""}
                        </span>
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
                  {/* ═══════════════════════════════════════════════════════
                      COM UM VEÍCULO: régua VERDE sobre o Total, como
                      `.total-row-final` no PDF, e nada mais — os orçamentos de
                      um veículo, que são a esmagadora maioria, saem idênticos.

                      COM N: "Total por veículo" é um DEGRAU (filete cinza fino,
                      peso 600), depois a multiplicação, e o fecho verde é o
                      TOTAL GERAL. Sem essa hierarquia os dois números liam como
                      concorrentes e o cliente conferia o errado.

                      Espelha `.total-row-unit` / `.total-row-multiplier` /
                      `.total-row-final` do PDF assinado.
                      ═══════════════════════════════════════════════════════ */}
                  <div
                    className="flex justify-between items-baseline pt-2"
                    style={
                      isMultiVehicle
                        ? { borderTop: "0.8px solid #bbb" }
                        : { borderTop: `1.5px solid ${COMPANY.primaryGreen}` }
                    }
                  >
                    <span
                      className={isMultiVehicle ? "font-semibold" : "font-bold"}
                      style={isMultiVehicle ? { color: COMPANY.textDark } : { color: COMPANY.primaryGreen }}
                    >
                      Total{isMultiVehicle ? " por veículo" : ""}
                    </span>
                    <span
                      className={isMultiVehicle ? "font-semibold" : "font-bold text-lg"}
                      style={isMultiVehicle ? { color: COMPANY.textDark } : { color: COMPANY.primaryGreen }}
                    >
                      {formatCurrency(displayTotal)}
                    </span>
                  </div>
                  {isMultiVehicle && (
                    <>
                      {/* O multiplicador NÃO é dinheiro e não deve parecer: cinza,
                          sem destaque, e sem "R$" — o que também o mantém visível
                          quando o operador esconde valores (a redação é por regex
                          sobre "R$"). */}
                      <div className="flex justify-between items-baseline">
                        <span style={{ color: COMPANY.textGray }}>Veículos</span>
                        <span className="tabular-nums" style={{ color: COMPANY.textGray }}>
                          &times; {vehicleCount}
                        </span>
                      </div>
                      <div
                        className="flex justify-between items-baseline pt-2"
                        style={{ borderTop: `1.5px solid ${COMPANY.primaryGreen}` }}
                      >
                        <span className="font-bold" style={{ color: COMPANY.primaryGreen }}>
                          Total geral
                        </span>
                        <span className="font-bold text-lg" style={{ color: COMPANY.primaryGreen }}>
                          {formatCurrency(displayGrandTotal)}
                        </span>
                      </div>
                    </>
                  )}
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
                      Faturamento
                    </h3>
                    <div className="space-y-5">
                      {quote.customerConfigs!.map((config: any) => {
                        const configPaymentText = generatePaymentText({
                          customPaymentText: config.customPaymentText || null,
                          paymentConfig: config.paymentConfig || null,
                          paymentCondition: config.paymentCondition,
                          total: config.total ?? 0,
                          vehicleCount,
                          perVehicleBilling:
                            ((quote as any).billingSplit ?? 'JOINT') === 'PER_TASK',
                        });
                        if (!configPaymentText && !config.customer) return null;
                        const customerName = config.customer?.corporateName || config.customer?.fantasyName || 'Cliente';
                        return (
                          <div key={config.id}>
                            <p className="text-sm font-semibold text-gray-800 mb-1">{customerName}</p>
                            <QuoteBillingBox
                              customer={config.customer}
                              orderNumber={config.orderNumber ?? null}
                            />
                            {configPaymentText && (
                              <p
                                className="text-gray-700 pt-2"
                                style={{ borderTop: "0.5px solid #ddd" }}
                              >
                                {configPaymentText}
                              </p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              }
              if (!paymentText && !billCustomer) return null;
              return (
                <div className="mb-6">
                  {/* A seção passou a se chamar FATURAMENTO e abre com o quadro
                      do tomador; a frase das parcelas vem logo abaixo, separada
                      por um filete. A frase NÃO saiu — ela é o acordo de
                      pagamento, e um instrumento sem ela deixa de dizer quanto e
                      quando se paga. Espelha a seção `PAYMENT` do PDF assinado.
                      O nº do pedido entrou no quadro, onde a Elotech o procura. */}
                  <h3 className="text-lg font-bold mb-2" style={{ color: COMPANY.primaryGreen }}>
                    Faturamento
                  </h3>
                  <QuoteBillingBox
                    customer={billCustomer}
                    orderNumber={activeConfig?.orderNumber ?? null}
                  />
                  {paymentText && (
                    <p
                      className="text-gray-700 pt-2"
                      style={{ borderTop: "0.5px solid #ddd" }}
                    >
                      {paymentText}
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

            {/* Sem layout o documento fecha numa folha só: a arte não existe e as
                assinaturas ficam AQUI. Havendo layout, os dois vão juntos para a
                folha seguinte. Montado só depois que o resumo chega, senão o bloco
                apareceria aqui e pularia de folha ao carregar. */}
            {sigSummary !== undefined && !signaturesOnOwnSheet && layoutBlock}
            {sigSummary !== undefined && !signaturesOnOwnSheet && (
              <BudgetSignaturePanel
                quoteId={id!}
                customerName={invoiceName || undefined}
                onEnvelope={handleEnvelope}
                preloaded={sigSummary}
              />
            )}

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

        {/* ═══════════════════════════════════════════════════════════
            FOLHA DE ASSINATURAS
            ───────────────────────────────────────────────────────────
            Estado real da coleta eletrônica. O upload de imagem que existia
            aqui foi removido: aceitava um PNG qualquer, não registrava quem
            assinou, IP, hora, consentimento nem hash, e não alterava o status
            do orçamento — apesar de a tela afirmar que "o orçamento foi
            confirmado". Quem assina agora é o signatário, pelo link pessoal
            que recebe por WhatsApp.

            Em FOLHA PRÓPRIA porque é assim que o documento assinado se pagina:
            a fusão numa folha só é tentada e quase nunca cabe (`tryFusedRender`,
            api quote-renderer.service — 22 das 24 âncoras gravadas estão na
            página 2). A tela mostrava as assinaturas na primeira página e o PDF
            na segunda.
           ═══════════════════════════════════════════════════════════ */}
        {signaturesOnOwnSheet && (
        <div className="bg-white shadow-lg rounded-lg overflow-hidden mt-8 print-page-break budget-card">
          <div className="p-6 md:p-8">
            <div className="flex flex-col md:flex-row justify-between items-start gap-4 mb-6">
              <img src={BRAND_ASSETS.logo} alt="Ankaa Design" className="h-16 md:h-20" />
              <div className="text-right">
                <h1 className="text-xl md:text-2xl font-bold text-gray-900">Orçamento Nº {budgetNumber}</h1>
              </div>
            </div>
            <div className="mb-8" style={{ height: 2, backgroundColor: COMPANY.primaryGreen }} />

            {/* Havendo layout, a arte divide esta folha com as assinaturas — é o
                arranjo do documento (caminho de 2 partes do renderizador). */}
            {layoutBlock}

            <BudgetSignaturePanel
              quoteId={id!}
              customerName={invoiceName || undefined}
              onEnvelope={handleEnvelope}
              preloaded={sigSummary}
            />

            <div className="pt-4 mt-8" style={{ borderTop: `2px solid ${COMPANY.primaryGreen}` }}>
              <p className="font-bold" style={{ color: COMPANY.primaryGreen }}>{COMPANY.name}</p>
              <p className="text-sm text-gray-600">{COMPANY.address}</p>
              <p className="text-sm">
                <a href={whatsappLink} target="_blank" rel="noopener noreferrer" style={{ color: COMPANY.primaryGreen }} className="hover:underline">
                  {COMPANY.phone.startsWith('(') ? COMPANY.phone : COMPANY.phone.replace(/^(\d{2})\s/, '($1) ')}
                </a>
              </p>
              <p className="text-sm">
                <a href={COMPANY.websiteUrl} target="_blank" rel="noopener noreferrer" style={{ color: COMPANY.primaryGreen }} className="hover:underline">
                  {COMPANY.websiteUrl}
                </a>
              </p>
            </div>
          </div>
        </div>
        )}
      </div>
    </div>
  );
}

export default PublicBudgetPage;
