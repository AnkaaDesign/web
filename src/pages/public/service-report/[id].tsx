import { useState, useEffect, useCallback, useMemo } from "react";
import { useParams } from "react-router-dom";
import { taskQuoteService } from "@/api-client/task-quote";
import { formatCurrency, formatDate, toTitleCase, formatCNPJ } from "@/utils";
import { getApiBaseUrl } from "@/utils/file";
import { getPricingVisible, setPricingVisible } from "@/utils/pricing-visibility";
import { generatePaymentText, generateGuaranteeText } from "@/utils/quote-text-generators";
import { projectInstallments } from "@/utils/installment-projection";
import { dossierArchiveFilename, dossierPdfFilename } from "@/utils/document-filename";
import { filenameFromDisposition } from "@/api-client/signature";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toast } from "@/components/ui/sonner";
import { IconLoader2, IconAlertCircle, IconBrandWhatsapp, IconCopy, IconPhoto, IconFileTypePdf, IconDownload, IconChevronDown, IconShare } from "@tabler/icons-react";
import { COMPANY_INFO, BRAND_COLORS } from "@/config/company";
import { TRUCK_CATEGORY_LABELS, IMPLEMENT_TYPE_LABELS } from "@/constants/enum-labels";
import { PdfPageRenderer } from "@/components/common/file/pdf-page-renderer";
import { BudgetSignaturePanel } from "@/components/public/budget-signature-panel";

import { BRAND_ASSETS } from '@/config/assets';
const COMPANY = { ...COMPANY_INFO, ...BRAND_COLORS };

export function PublicServiceReportPage() {
  const { id, customerId } = useParams<{ id: string; customerId: string }>();
  const [quote, setQuote] = useState<any>(null);

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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  // Validated layout image URLs (the layoutFiles array, those that load OK)
  const [layoutImageUrls, setLayoutImageUrls] = useState<string[]>([]);

  // A config's customer: the FK when the payload carries it, else the nested
  // customer's id. Both are matched because the public select has shipped
  // without the FK before — and when nothing matches, the page silently falls
  // back to the Completo view instead of the one customer that was asked for.
  const configCustomerId = (config: any): string | undefined => config?.customerId || config?.customer?.id;

  const selectedCustomerId = useMemo(() => {
    if (!customerId || !quote?.customerConfigs) return null;
    const isConfigCustomer = quote.customerConfigs.some((c: any) => configCustomerId(c) === customerId);
    return isConfigCustomer ? customerId : null;
  }, [customerId, quote?.customerConfigs]);

  const fetchQuote = useCallback(async () => {
    if (!id) { setError("ID não fornecido."); setLoading(false); return; }
    try {
      setLoading(true);
      const response = await taskQuoteService.getPublic(id);
      if (response.data?.success && response.data?.data) {
        setQuote(response.data.data);
        setError(null);
      } else {
        setError(response.data?.message || "Erro ao carregar dados.");
      }
    } catch (err: any) {
      setError(err.response?.data?.message || "Erro ao carregar dados.");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { fetchQuote(); }, [fetchQuote]);

  // Validate layout images exist (avoid 404s) — the layoutFiles array, order preserved
  const layoutFileUrls = ((quote?.layoutFiles || []) as any[])
    .filter((f) => f?.id)
    .map((f) => `${getApiBaseUrl()}/files/serve/${f.id}`);
  const layoutFileUrlsKey = layoutFileUrls.join("|");
  useEffect(() => {
    const urls = layoutFileUrlsKey ? layoutFileUrlsKey.split("|") : [];
    if (urls.length === 0) { setLayoutImageUrls([]); return; }
    let cancelled = false;
    Promise.all(
      urls.map(
        (url) =>
          new Promise<string | null>((resolve) => {
            const img = new Image();
            img.onload = () => resolve(url);
            img.onerror = () => resolve(null);
            img.src = url;
          }),
      ),
    ).then((results) => {
      if (!cancelled) setLayoutImageUrls(results.filter(Boolean) as string[]);
    });
    return () => { cancelled = true; };
  }, [layoutFileUrlsKey]);

  // Derived data (safe to compute even if quote is null — guarded by early return below)
  const apiUrl = getApiBaseUrl();

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <IconLoader2 className="h-12 w-12 animate-spin mx-auto mb-4" style={{ color: COMPANY.primaryGreen }} />
          <p className="text-gray-600">Carregando dossiê...</p>
        </div>
      </div>
    );
  }

  if (error || !quote) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
        <Card className="max-w-md w-full bg-white">
          <CardContent className="pt-6 text-center">
            <IconAlertCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
            <h1 className="text-xl font-bold text-gray-900 mb-2">Indisponível</h1>
            <p className="text-gray-600">{error || "Dados não encontrados."}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Derived data
  const activeConfig = quote.customerConfigs?.find((c: any) => configCustomerId(c) === selectedCustomerId) || quote.customerConfigs?.[0];
  const budgetNumber = quote.budgetNumber ? String(quote.budgetNumber).padStart(4, "0") : "0000";
  const ownerResponsible = quote.task?.responsibles?.find((r: any) => r.roles?.includes('OWNER'));
  const contactName = activeConfig?.responsible?.name || ownerResponsible?.name || quote.task?.responsibles?.[0]?.name || "";
  const guaranteeText = generateGuaranteeText(quote);
  const whatsappLink = `https://wa.me/${COMPANY.phoneClean}`;

  const allConfigs = quote.customerConfigs || [];
  const relevantConfigs = selectedCustomerId ? [activeConfig].filter(Boolean) : allConfigs;
  // "Completo": no customer filter on a quote billed to more than one customer.
  // Same split the budget page makes — services gain a "faturar para" column and
  // every customer gets its own subtotal and payment terms.
  const isCompleteView = !selectedCustomerId && allConfigs.length >= 2;

  // Filter services by customer — same FK-or-nested-id fallback as the configs.
  //
  // A service with no invoice-to customer belongs to every view on a
  // single-customer quote (the API's own per-config totals count all services
  // there). On a MULTI-customer quote it belongs to no config and is counted in
  // no config total, so listing it under one customer would show a line the
  // Total below doesn't include — it stays out of the filtered view and is
  // reunited with the rest in Completo.
  const serviceCustomerId = (svc: any): string | undefined => svc?.invoiceToCustomerId || svc?.invoiceToCustomer?.id;
  const isMultiCustomerQuote = (quote.customerConfigs?.length ?? 0) >= 2;
  const services = (quote.services || []).filter((s: any) => {
    if (!selectedCustomerId) return true;
    const svcCustomer = serviceCustomerId(s);
    if (svcCustomer) return svcCustomer === selectedCustomerId;
    return !isMultiCustomerQuote;
  });
  const configName = (config: any): string =>
    config?.customer?.corporateName || config?.customer?.fantasyName || "Cliente";
  // Who the services are billed to, with their document — the same identification
  // the budget page weaves into its intro. In Completo that's every customer.
  const customerDoc = (customer: any): string =>
    customer?.cnpj ? `CNPJ ${formatCNPJ(customer.cnpj)}` : customer?.cpf ? `CPF ${customer.cpf}` : "";
  const invoiceCustomers = (relevantConfigs.length > 0
    ? relevantConfigs.map((c: any) => ({ name: configName(c), doc: customerDoc(c?.customer) }))
    : [{
        name: quote.task?.customer?.corporateName || quote.task?.customer?.fantasyName || "",
        doc: customerDoc(quote.task?.customer),
      }]
  ).filter((c: { name: string }) => !!c.name);
  const servicesSum = services.reduce((sum: number, s: any) => sum + (Number(s.amount) || 0), 0);
  // The config's own subtotal/total are what the API computed and what billing
  // actually charges (discount applied there) — prefer them over re-deriving the
  // discount here, and fall back to the service lines only when absent.
  const configSubtotal = activeConfig?.subtotal != null ? Number(activeConfig.subtotal) : null;
  const configTotal = activeConfig?.total != null ? Number(activeConfig.total) : null;
  const subtotal = configSubtotal ?? servicesSum;
  const configDiscountType = activeConfig?.discountType;
  const configDiscountValue = activeConfig?.discountValue != null ? Number(activeConfig.discountValue) : 0;
  const discountAmount = configTotal != null
    ? Math.max(0, Math.round((subtotal - configTotal) * 100) / 100)
    : configDiscountType === "PERCENTAGE" && configDiscountValue
      ? Math.round((subtotal * configDiscountValue / 100) * 100) / 100
      : configDiscountType === "FIXED_VALUE" && configDiscountValue
        ? Math.min(configDiscountValue, subtotal)
        : 0;
  // In Completo the totals come from the configs themselves (each already net of
  // its own discount), never from re-summing the service lines.
  const customerTotals = isCompleteView
    ? allConfigs.map((c: any) => ({ name: configName(c), total: Number(c.total) || 0 }))
    : [];
  // Services assigned to no customer are in no config total — add them to the
  // Completo total so the sum of the lines above still adds up.
  const unassignedSum = isCompleteView
    ? services
        .filter((s: any) => !serviceCustomerId(s))
        .reduce((sum: number, s: any) => sum + (Number(s.amount) || 0), 0)
    : 0;
  const total = isCompleteView
    ? customerTotals.reduce((sum: number, c: { total: number }) => sum + c.total, 0) + unassignedSum
    : configTotal ?? Math.max(0, subtotal - discountAmount);
  const hasDiscount = !isCompleteView && discountAmount > 0.01;

  // Installments & bank slips from relevant configs
  const installments = relevantConfigs
    .flatMap((c: any) => c.installments || [])
    .sort((a: any, b: any) => a.number - b.number);

  // One payment clause per config on show — a single block normally, one per
  // customer in Completo (mirroring the budget page).
  const paymentBlocks = relevantConfigs
    .map((config: any) => {
      const configInstallments = (config?.installments || [])
        .slice()
        .sort((a: any, b: any) => a.number - b.number);

      // The settlement method named in the clause. Real installments win when
      // they exist and all agree — they carry what was actually stamped at
      // billing; otherwise `generatePaymentText` falls back to the configured
      // method (and to BANK_SLIP, mirroring the API's
      // `resolveInstallmentPaymentMethod`).
      const stamped = Array.from(
        new Set(configInstallments.map((inst: any) => inst.paymentMethod).filter(Boolean)),
      ) as string[];
      const paymentMethod = stamped.length === 1 ? stamped[0] : null;

      // On a dossiê the service is already finished, so "para 5 dias a partir da
      // finalização do serviço" counts down from a date in the past — name the
      // actual vencimento instead. Real installments carry it once billing is
      // approved; before that, project it from finishedAt as the API will.
      const hasStructuredPaymentConfig =
        !!config?.paymentConfig?.type || !!(config?.paymentCondition && config.paymentCondition !== "CUSTOM");
      const configTotal = config?.total ?? quote.total;
      const firstDueDate: Date | string | null =
        configInstallments[0]?.dueDate
        ?? (quote.task?.finishedAt && hasStructuredPaymentConfig
          ? projectInstallments(
              configTotal,
              config?.paymentConfig,
              config?.paymentCondition,
              new Date(quote.task.finishedAt),
            )[0]?.dueDate ?? null
          : null);

      return {
        id: config?.id,
        // Only Completo needs to say whose terms these are.
        customerName: isCompleteView ? configName(config) : null,
        // Same source of truth as the budget page (custom text → structured
        // paymentConfig → legacy paymentCondition), with the method woven into
        // the sentence and the relative deadline resolved to a real date.
        paymentText: generatePaymentText({
          customPaymentText: config?.customPaymentText || null,
          paymentConfig: config?.paymentConfig || null,
          paymentCondition: config?.paymentCondition,
          total: configTotal,
          paymentMethod,
          firstDueDate,
        }),
        // Customer's purchase-order number, shown with the payment terms
        // exactly as the budget page does.
        orderNumber: (config?.orderNumber as string | null) || null,
      };
    })
    .filter((block: { paymentText: string; orderNumber: string | null }) => block.paymentText || block.orderNumber);

  // All installments that have a bank slip
  const bankSlipInstallments = installments
    .filter((inst: any) => inst.bankSlip && !["PAID", "CANCELLED"].includes(inst.bankSlip.status))
    .map((inst: any) => ({
      installmentId: inst.id,
      installmentNumber: inst.number,
      pdfUrl: `${apiUrl}/invoices/public/${inst.id}/boleto/pdf`,
      bankSlip: inst.bankSlip,
    }));

  // NFSe documents from relevant configs' invoices (only authorized ones)
  const nfseDocuments = relevantConfigs
    .flatMap((c: any) => c.invoice?.nfseDocuments || [])
    .filter((doc: any) => doc.status === "AUTHORIZED" && doc.elotechNfseId);

  const serviceOrders = (quote.task?.serviceOrders || [])
    .filter((so: any) => so.checkinFiles?.length > 0 || so.checkoutFiles?.length > 0)
    .sort((a: any, b: any) => (a.position ?? 0) - (b.position ?? 0));

  const handleCopyLink = async () => {
    try { await navigator.clipboard.writeText(window.location.href); toast.success("Link copiado!"); }
    catch { toast.error("Não foi possível copiar o link."); }
  };

  const handleWhatsAppShare = () => {
    const msg = `Dossiê Nº ${budgetNumber} - ${COMPANY.name}\n${window.location.href}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, "_blank");
  };

  /**
   * O dossiê vem PRONTO do servidor.
   *
   * Antes era montado aqui no browser, o que obrigava a re-renderizar o
   * orçamento a partir dos dados — ou seja, o cliente recebia uma reconstrução,
   * não o documento que ele assinou. Agora o servidor entrega as páginas do
   * PDF ASSINADO, seguidas do dossiê fotográfico, das notas e dos boletos.
   */
  const handleExportPdf = async () => {
    try {
      toast.info("Gerando PDF...");
      // O cliente do recorte viaja junto: esta página já mostra na tela só os
      // serviços, a nota e o boleto do cliente escolhido, e o PDF vinha com os
      // documentos de todos os clientes do faturamento.
      const url =
        `${apiUrl}/assinatura/publico/orcamento/${quote.id}/dossie.pdf` +
        (selectedCustomerId ? `?cliente=${encodeURIComponent(selectedCustomerId)}` : "");
      const res = await fetch(url);
      if (!res.ok) {
        // 400 = ainda não há envelope concluído para este orçamento.
        const body = await res.json().catch(() => null);
        throw new Error(body?.message ?? "Não foi possível gerar o dossiê.");
      }
      const blob = await res.blob();
      const href = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = href;
      // O nome vem do servidor quando ele anuncia um: no dossiê recortado quem
      // nomeia é o cliente do recorte, e `quote.task.customer` é sempre o da
      // tarefa. O recuo é o mesmo nome de antes — o número é o do ORÇAMENTO, não
      // o `serialNumber` (a série identifica o implemento, e usá-la aqui fazia
      // dois documentos do mesmo cliente chegarem numerados por sistemas
      // diferentes). O .zip logo abaixo leva o MESMO nome, só com outra extensão.
      a.download =
        filenameFromDisposition(res.headers.get("content-disposition")) ??
        dossierPdfFilename(quote.task?.customer, quote.budgetNumber);
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(href);
      toast.success("Dossiê baixado.");
    } catch (error: any) {
      toast.error(error?.message ?? "Erro ao gerar o PDF.");
    }
  };

  const handleDownloadArchive = async () => {
    try {
      toast.info("Preparando arquivos...");
      const JSZip = (await import('jszip')).default;
      const zip = new JSZip();

      const fetchBlob = async (url: string): Promise<Blob | null> => {
        try {
          const res = await fetch(url);
          if (!res.ok) return null;
          return await res.blob();
        } catch {
          return null;
        }
      };

      // 1. Dossiê fotográfico images
      const fotosFolder = zip.folder("fotos");
      for (const so of serviceOrders) {
        const soName = (so.description === "Outros" && so.observation ? so.observation : so.description || "servico")
          .replace(/[^a-zA-Z0-9À-ÿ\s-]/g, "").trim().replace(/\s+/g, "-").toLowerCase();
        const soFolder = fotosFolder!.folder(soName);

        for (const f of (so.checkinFiles || [])) {
          const blob = await fetchBlob(`${apiUrl}/files/serve/${f.id}`);
          if (blob) {
            const ext = f.originalName?.split('.').pop() || f.filename?.split('.').pop() || 'jpg';
            soFolder!.file(`antes-${f.id.slice(0, 8)}.${ext}`, blob);
          }
        }
        for (const f of (so.checkoutFiles || [])) {
          const blob = await fetchBlob(`${apiUrl}/files/serve/${f.id}`);
          if (blob) {
            const ext = f.originalName?.split('.').pop() || f.filename?.split('.').pop() || 'jpg';
            soFolder!.file(`depois-${f.id.slice(0, 8)}.${ext}`, blob);
          }
        }
      }

      // 2. Bank slip PDFs
      if (bankSlipInstallments.length > 0) {
        const boletosFolder = zip.folder("boletos");
        for (const slip of bankSlipInstallments) {
          const blob = await fetchBlob(slip.pdfUrl);
          if (blob) {
            boletosFolder!.file(`boleto-parcela-${slip.installmentNumber}.pdf`, blob);
          }
        }
      }

      // 3. NFSe PDFs
      if (nfseDocuments.length > 0) {
        const nfseFolder = zip.folder("nfse");
        for (const doc of nfseDocuments) {
          const blob = await fetchBlob(`${apiUrl}/nfse/public/${doc.elotechNfseId}/pdf`);
          if (blob) {
            nfseFolder!.file(`nfse-${doc.elotechNfseId}.pdf`, blob);
          }
        }
      }

      const zipBlob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = dossierArchiveFilename(quote.task?.customer, quote.budgetNumber);
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success("Arquivos baixados!");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao baixar arquivos.");
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 py-8 px-4 print:bg-white print:py-0 print:px-0">
      {/* Print styles */}
      <style>{`
        @media print {
          body { background: white !important; margin: 0; }
          .no-print { display: none !important; }
          .print-page-break { break-before: page; }
          .dossie-card { box-shadow: none !important; border-radius: 0 !important; margin-top: 0 !important; }
          .dossie-card + .dossie-card { margin-top: 0 !important; }
          iframe { height: 100vh !important; min-height: 100vh !important; }
          .pdf-embed-container { height: 100vh !important; min-height: 100vh !important; }
        }
      `}</style>

      <div className="max-w-4xl mx-auto print:max-w-none">
        {/* ═══════════════════════════════════════════════════════════
            PAGE 1: Main Dossiê content (matches budget page structure)
           ═══════════════════════════════════════════════════════════ */}
        <div className="bg-white shadow-lg rounded-lg overflow-hidden relative dossie-card">
          <div className="p-6 md:p-8">

            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start gap-4 mb-6">
              <img src={BRAND_ASSETS.logo} alt={COMPANY.name} className="h-16 md:h-20" />
              <div className="flex flex-col items-end gap-2">
                <Popover open={menuOpen} onOpenChange={setMenuOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className="gap-2 h-9 px-3 text-sm font-medium no-print"
                      style={{ borderColor: COMPANY.primaryGreen, color: COMPANY.primaryGreen }}
                    >
                      <IconShare className="h-4 w-4" />
                      Opções
                      <IconChevronDown className={`h-3.5 w-3.5 opacity-70 transition-transform ${menuOpen ? 'rotate-180' : ''}`} />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent align="end" sideOffset={6} className="w-52 p-1 bg-white border border-gray-200 shadow-lg">
                    <button onClick={() => { setMenuOpen(false); handleCopyLink(); }} className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 hover:text-gray-900 transition-colors">
                      <IconCopy className="h-4 w-4 text-gray-500" /> Copiar link
                    </button>
                    <button onClick={() => { setMenuOpen(false); handleWhatsAppShare(); }} className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 hover:text-gray-900 transition-colors">
                      <IconBrandWhatsapp className="h-4 w-4 text-green-600" /> WhatsApp
                    </button>
                    <button onClick={() => { setMenuOpen(false); handleExportPdf(); }} className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 hover:text-gray-900 transition-colors">
                      <IconFileTypePdf className="h-4 w-4 text-red-500" /> Baixar PDF
                    </button>
                    <button onClick={() => { setMenuOpen(false); handleDownloadArchive(); }} className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 hover:text-gray-900 transition-colors">
                      <IconDownload className="h-4 w-4 text-blue-500" /> Baixar Arquivos
                    </button>
                  </PopoverContent>
                </Popover>
                {/* Mesmo cabeçalho do documento assinado: número em VERDE da
                    marca, datas em cinza com rótulo em negrito escuro. */}
                <div className="text-right">
                  <h1
                    className="text-xl md:text-2xl font-bold"
                    style={{ color: COMPANY.primaryGreen }}
                  >
                    Dossiê Nº {budgetNumber}
                  </h1>
                  <p className="text-sm mt-1 leading-relaxed" style={{ color: COMPANY.textGray }}>
                    <span className="font-semibold" style={{ color: COMPANY.textDark }}>Emissão:</span>{' '}
                    {formatDate(new Date())}
                  </p>
                </div>
              </div>
            </div>

            {/* Régua de 2 px verde maciço, como `.header-line` no PDF. */}
            <div className="mb-8" style={{ height: 2, backgroundColor: COMPANY.primaryGreen }} />

            {/* Title */}
            <h2 className="text-xl font-bold underline underline-offset-4 mb-6" style={{ color: COMPANY.primaryGreen }}>
              DOSSIÊ
            </h2>

            {/* Customer + Vehicle Info */}
            <div className="mb-6">
              {/* "À Fulano" em PRETO semibold, como `.customer-name` no PDF —
                  em verde ele lia como título de seção. */}
              {contactName && (
                <p className="font-semibold mb-1" style={{ color: COMPANY.textDark }}>
                  À {contactName}
                </p>
              )}
              <p className="text-gray-700 text-justify">
                Prezado(a) cliente, segue o dossiê referente aos serviços realizados
                {invoiceCustomers.length > 0 && (
                  <>
                    {" "}para a{" "}
                    {invoiceCustomers.map((c: { name: string; doc: string }, i: number) => (
                      <span key={i}>
                        {i > 0 && (i === invoiceCustomers.length - 1 ? " e " : ", ")}
                        <strong>{c.name}</strong>
                        {c.doc ? ` (${c.doc})` : ""}
                      </span>
                    ))}
                  </>
                )}
                {(() => {
                  const truckCategoryLabel = quote.task?.truck?.category
                    ? (TRUCK_CATEGORY_LABELS[quote.task.truck.category as keyof typeof TRUCK_CATEGORY_LABELS] || quote.task.truck.category)
                    : null;
                  const truckImplementLabel = quote.task?.truck?.implementType
                    ? (IMPLEMENT_TYPE_LABELS[quote.task.truck.implementType as keyof typeof IMPLEMENT_TYPE_LABELS] || quote.task.truck.implementType)
                    : null;
                  const parts: React.ReactNode[] = [];
                  if (quote.task?.serialNumber) parts.push(<> nº de série: <strong>{quote.task.serialNumber}</strong></>);
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
            <div className="mb-6">
              <h3 className="text-lg font-bold mb-4" style={{ color: COMPANY.primaryGreen }}>
                Serviços Realizados
              </h3>
              {/* pl-4 (not ml-4) so the price column's right edge lines up EXACTLY with
                  the Subtotal/Total column below (also pl-4) — a margin here would push
                  this table's full-width box 1rem further right than the totals div,
                  which only insets its content via padding. */}
              <div className="pl-4">
                <table className="w-full" style={{ borderCollapse: 'collapse' }}>
                  <tbody>
                    {services.map((svc: any, i: number) => {
                      const amount = Number(svc.amount) || 0;
                      const desc = toTitleCase(svc.description || "");
                      const obs = svc.observation || "";
                      const isOutros = svc.description?.trim().toLowerCase() === "outros";
                      const displayDesc = isOutros && obs ? obs : obs ? `${desc} ${obs}` : desc;

                      const invoiceToName =
                        svc.invoiceToCustomer?.corporateName || svc.invoiceToCustomer?.fantasyName;

                      // Filete pontilhado sob cada serviço, exceto o último —
                      // mesma regra de `.service-row` no PDF.
                      const isLast = i === services.length - 1;
                      return (
                        <tr
                          key={svc.id || i}
                          className="align-top"
                          style={isLast ? undefined : { borderBottom: "0.5px dotted #ccc" }}
                        >
                          <td className="text-gray-800 py-1 pr-2">
                            {i + 1} - {displayDesc}
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
                // Completo: one subtotal per customer, then the combined total
                <div className="mt-6 pl-4 space-y-3">
                  {customerTotals.map((c: { name: string; total: number }, i: number) => (
                    <div key={i} className="flex justify-between items-baseline">
                      <span className="text-gray-700 text-sm">{c.name}</span>
                      <span className="text-gray-800 font-medium">{formatCurrency(c.total)}</span>
                    </div>
                  ))}
                  <div
                    className="flex justify-between items-baseline pt-2"
                    style={{ borderTop: `1.5px solid ${COMPANY.primaryGreen}` }}
                  >
                    <span className="font-bold" style={{ color: COMPANY.primaryGreen }}>Total</span>
                    <span className="font-bold text-lg" style={{ color: COMPANY.primaryGreen }}>
                      {formatCurrency(total)}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="mt-6 pl-4 space-y-1">
                  {hasDiscount && (
                    <>
                      <div className="flex justify-between items-baseline">
                        <span className="text-gray-700">Subtotal</span>
                        <span className="text-gray-800">{formatCurrency(subtotal)}</span>
                      </div>
                      {/* Rótulo em cor normal, só o VALOR em vermelho — é o que
                          `.total-row-discount .total-value` faz no PDF. */}
                      <div className="flex justify-between items-baseline">
                        <span className="text-gray-700">
                          {configDiscountType === 'PERCENTAGE' && configDiscountValue
                            ? `Desconto (${configDiscountValue}%)`
                            : 'Desconto'}
                          {activeConfig?.discountReference && <> — {activeConfig.discountReference}</>}
                        </span>
                        <span className="text-red-600">- {formatCurrency(discountAmount)}</span>
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
                      {formatCurrency(total)}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Payment conditions — the same prose the budget page shows (custom
                text → structured config → legacy condition), with the settlement
                method woven in. One block per customer in Completo. No
                parcela-by-parcela table: the boletos themselves are appended
                further down and carry the real dates. */}
            {paymentBlocks.length > 0 && (
              <div className="mb-6">
                <h3 className="text-lg font-bold mb-2" style={{ color: COMPANY.primaryGreen }}>
                  Condições de pagamento
                </h3>
                <div className="space-y-3">
                  {paymentBlocks.map((block: { id?: string; customerName: string | null; paymentText: string; orderNumber: string | null }, i: number) => (
                    <div key={block.id || i}>
                      {block.customerName && (
                        <p className="text-sm font-semibold text-gray-800">{block.customerName}</p>
                      )}
                      {block.paymentText && <p className="text-gray-700">{block.paymentText}</p>}
                      {block.orderNumber && (
                        <p className="text-sm text-gray-600 mt-1">
                          <span className="font-semibold">N° do Pedido:</span> {block.orderNumber}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

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

            {/* Layout Image(s) — the layoutFiles array. Título "Layout" e
                imagens sem moldura, como `.layout-section` no PDF (105 mm de
                altura máxima ≈ 397 px). */}
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

            {/* Assinaturas — a seção que faltava.
                O dossiê embute, como primeiro componente, o PDF do orçamento,
                que SEMPRE traz a folha de assinaturas (com selo quando houve
                coleta e com as linhas em branco quando não houve). Esta página
                era o único lugar do fluxo que a omitia: o cliente lia o dossiê
                na tela, baixava o PDF e encontrava uma seção que a tela nunca
                mostrou. É o mesmo componente da página do orçamento porque, nos
                dois casos, o documento por baixo é o mesmo. */}
            <BudgetSignaturePanel
              quoteId={quote.id}
              customerName={invoiceCustomers[0]?.name || undefined}
            />

            {/* Rodapé: régua de 2 px verde maciço, espelhando a do cabeçalho. */}
            <div
              className="pt-4 mt-8"
              style={{ borderTop: `2px solid ${COMPANY.primaryGreen}` }}
            >
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

        {/* ═══════════════════════════════════════════════════════════
            PAGE 2+: Dossiê Fotográfico
           ═══════════════════════════════════════════════════════════ */}
        {serviceOrders.length > 0 && (
          <div className="bg-white shadow-lg rounded-lg overflow-hidden mt-8 print-page-break dossie-card">
            <div className="p-6 md:p-8">
              <div className="flex flex-col md:flex-row justify-between items-start gap-4 mb-6">
                <img src={BRAND_ASSETS.logo} alt={COMPANY.name} className="h-16 md:h-20" />
                <div className="text-right">
                  <h1 className="text-xl md:text-2xl font-bold text-gray-900">Dossiê Nº {budgetNumber}</h1>
                  <p className="text-sm text-gray-600 mt-1"><span className="font-semibold">Emissão:</span> {formatDate(new Date())}</p>
                </div>
              </div>
              <div className="mb-8" style={{ height: 2, backgroundColor: COMPANY.primaryGreen }} />

              <h3 className="text-lg font-bold mb-4 flex items-center gap-2" style={{ color: COMPANY.primaryGreen }}>
                <IconPhoto className="h-5 w-5" />
                Dossiê Fotográfico
              </h3>

              <div className="space-y-6">
                {serviceOrders.map((so: any) => {
                  const desc = so.description === "Outros" && so.observation ? so.observation : so.description;
                  const checkinFiles = so.checkinFiles || [];
                  const checkoutFiles = so.checkoutFiles || [];

                  return (
                    <div key={so.id} className="border border-gray-200 rounded-lg overflow-hidden">
                      <div className="px-3 py-2 font-semibold text-sm text-white" style={{ backgroundColor: COMPANY.primaryGreen }}>
                        {desc || "Serviço"}
                        {so.observation && so.description !== "Outros" && (
                          <span className="ml-2 font-normal text-xs opacity-80">{so.observation}</span>
                        )}
                      </div>
                      <div className="p-3 space-y-3">
                        {checkinFiles.length > 0 && (
                          <div>
                            <p className="text-xs font-semibold text-blue-600 uppercase tracking-wide mb-1.5">Antes</p>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 items-start justify-items-start">
                              {checkinFiles.map((f: any) => (
                                <img key={f.id} src={`${apiUrl}/files/serve/${f.id}`} alt={desc} className="w-full h-auto block" />
                              ))}
                            </div>
                          </div>
                        )}
                        {checkoutFiles.length > 0 && (
                          <div>
                            <p className="text-xs font-semibold text-green-600 uppercase tracking-wide mb-1.5">Depois</p>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 items-start justify-items-start">
                              {checkoutFiles.map((f: any) => (
                                <img key={f.id} src={`${apiUrl}/files/serve/${f.id}`} alt={desc} className="w-full h-auto block" />
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Footer */}
              <div className="pt-4 mt-8" style={{ borderTop: `2px solid ${COMPANY.primaryGreen}` }}>
                <p className="font-bold" style={{ color: COMPANY.primaryGreen }}>{COMPANY.name}</p>
                <p className="text-sm text-gray-600">{COMPANY.address}</p>
                <p className="text-sm"><a href={whatsappLink} target="_blank" rel="noopener noreferrer" style={{ color: COMPANY.primaryGreen }} className="hover:underline">{COMPANY.phone.startsWith('(') ? COMPANY.phone : COMPANY.phone.replace(/^(\d{2})\s/, '($1) ')}</a></p>
                <p className="text-sm"><a href={COMPANY.websiteUrl} target="_blank" rel="noopener noreferrer" style={{ color: COMPANY.primaryGreen }} className="hover:underline">{COMPANY.websiteUrl}</a></p>
              </div>
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════
            Bank Slips — rendered via pdfjs (no browser toolbar)
           ═══════════════════════════════════════════════════════════ */}
        {bankSlipInstallments.map((slip: any) => (
          <div key={slip.bankSlip.id} className="bg-white shadow-lg rounded-lg overflow-hidden mt-8 print-page-break dossie-card">
            <PdfPageRenderer url={slip.pdfUrl} className="w-full" />
          </div>
        ))}

        {/* ═══════════════════════════════════════════════════════════
            NFS-e — rendered via pdfjs (no browser toolbar)
           ═══════════════════════════════════════════════════════════ */}
        {nfseDocuments.map((doc: any) => (
          <div key={doc.id} className="bg-white shadow-lg rounded-lg overflow-hidden mt-8 print-page-break dossie-card">
            <PdfPageRenderer url={`${apiUrl}/nfse/public/${doc.elotechNfseId}/pdf`} className="w-full" />
          </div>
        ))}
      </div>
    </div>
  );
}
