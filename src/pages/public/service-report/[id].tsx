import { useState, useEffect, useCallback, useMemo } from "react";
import { useParams } from "react-router-dom";
import { taskQuoteService } from "@/api-client/task-quote";
import { formatCurrency, formatDate, toTitleCase } from "@/utils";
import { getApiBaseUrl } from "@/utils/file";
import { generatePaymentText, generateGuaranteeText } from "@/utils/quote-text-generators";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toast } from "@/components/ui/sonner";
import { IconLoader2, IconAlertCircle, IconBrandWhatsapp, IconDotsVertical, IconCopy, IconPhoto, IconFileTypePdf, IconDownload } from "@tabler/icons-react";
import { COMPANY_INFO, BRAND_COLORS } from "@/config/company";
import { exportCompleteDossiePdf } from "@/utils/dossie-pdf-generator";
import { PdfPageRenderer } from "@/components/common/file/pdf-page-renderer";

const COMPANY = { ...COMPANY_INFO, ...BRAND_COLORS };

const getFileServeUrl = (file: { id: string } | null | undefined): string => {
  if (!file?.id) return "";
  return `${getApiBaseUrl()}/files/serve/${file.id}`;
};

/**
 * Compute a single unified status for an installment + bank slip combo.
 */
function getUnifiedInstallmentStatus(inst: any): { label: string; className: string } {
  const bankSlip = inst.bankSlip;
  const isPaidExternally = inst.status === "PAID" && bankSlip?.status === "CANCELLED";

  if (inst.status === "PAID") {
    let paidLabel = "Paga";
    if (isPaidExternally) {
      const method = bankSlip?.sicrediStatus;
      if (method === "PAID_PIX") paidLabel = "Paga (PIX)";
      else if (method === "PAID_CASH") paidLabel = "Paga (Dinheiro)";
      else if (method === "PAID_TRANSFER") paidLabel = "Paga (Transferência)";
      else paidLabel = "Paga (por fora)";
    }
    return { label: paidLabel, className: "bg-green-100 text-green-700" };
  }

  if (bankSlip && ["ERROR", "REJECTED"].includes(bankSlip.status)) {
    return { label: "Erro no Boleto", className: "bg-red-100 text-red-700" };
  }

  if (inst.status === "OVERDUE" || bankSlip?.status === "OVERDUE") {
    return { label: "Vencida", className: "bg-red-100 text-red-700" };
  }

  if (inst.status === "CANCELLED") {
    return { label: "Cancelada", className: "bg-gray-100 text-gray-500" };
  }

  if (bankSlip?.status === "ACTIVE") {
    return { label: "Aguardando Pagamento", className: "bg-blue-100 text-blue-700" };
  }

  if (bankSlip && ["CREATING", "REGISTERING"].includes(bankSlip.status)) {
    return { label: "Processando", className: "bg-amber-100 text-amber-700" };
  }

  return { label: "Pendente", className: "bg-amber-100 text-amber-700" };
}

export function PublicServiceReportPage() {
  const { id, customerId } = useParams<{ id: string; customerId: string }>();
  const [quote, setQuote] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [layoutImageUrl, setLayoutImageUrl] = useState<string | null>(null);

  const selectedCustomerId = useMemo(() => {
    if (!customerId || !quote?.customerConfigs) return null;
    const isConfigCustomer = quote.customerConfigs.some((c: any) => c.customerId === customerId);
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

  // Validate layout image exists (avoid 404s)
  const layoutFileUrl = quote?.layoutFile?.id ? `${getApiBaseUrl()}/files/serve/${quote.layoutFile.id}` : null;
  useEffect(() => {
    if (!layoutFileUrl) { setLayoutImageUrl(null); return; }
    const img = new Image();
    img.onload = () => setLayoutImageUrl(layoutFileUrl);
    img.onerror = () => setLayoutImageUrl(null);
    img.src = layoutFileUrl;
  }, [layoutFileUrl]);

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
  const corporateName = quote.task?.customer?.corporateName || quote.task?.customer?.fantasyName || "Cliente";
  const activeConfig = quote.customerConfigs?.find((c: any) => c.customerId === selectedCustomerId) || quote.customerConfigs?.[0];
  const budgetNumber = quote.budgetNumber ? String(quote.budgetNumber).padStart(4, "0") : "0000";
  const contactName = activeConfig?.responsible?.name || quote.task?.responsibles?.[0]?.name || "";
  const paymentText = generatePaymentText({
    customPaymentText: activeConfig?.customPaymentText || null,
    paymentCondition: activeConfig?.paymentCondition,
    total: activeConfig?.total ?? quote.total,
  });
  const guaranteeText = generateGuaranteeText(quote);
  const whatsappLink = `https://wa.me/${COMPANY.phoneClean}`;

  // Filter services by customer
  const services = (quote.services || []).filter((s: any) =>
    !selectedCustomerId || s.invoiceToCustomerId === selectedCustomerId || !s.invoiceToCustomerId
  );
  const subtotal = services.reduce((sum: number, s: any) => sum + (Number(s.amount) || 0), 0);
  const discountAmount = services.reduce((sum: number, svc: any) => {
    const amount = Number(svc.amount) || 0;
    if (svc.discountType === "PERCENTAGE" && svc.discountValue) return sum + Math.round((amount * svc.discountValue / 100) * 100) / 100;
    if (svc.discountType === "FIXED_VALUE" && svc.discountValue) return sum + Math.min(svc.discountValue, amount);
    return sum;
  }, 0);
  const total = Math.max(0, subtotal - discountAmount);
  const hasDiscount = discountAmount > 0.01;

  // Installments & bank slips from relevant configs
  const allConfigs = quote.customerConfigs || [];
  const relevantConfigs = selectedCustomerId ? [activeConfig].filter(Boolean) : allConfigs;
  const installments = relevantConfigs
    .flatMap((c: any) => c.installments || [])
    .sort((a: any, b: any) => a.number - b.number);

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

  const handleExportPdf = async () => {
    try {
      toast.info("Gerando PDF...");
      await exportCompleteDossiePdf({
        documentTitle: `${corporateName} - ${quote.task?.serialNumber || budgetNumber}`,
        budgetNumber,
        corporateName,
        contactName,
        serialNumber: quote.task?.serialNumber || null,
        plate: quote.task?.truck?.plate || null,
        chassisNumber: quote.task?.truck?.chassisNumber || null,
        finishedAt: quote.task?.finishedAt || null,
        services,
        subtotal,
        discountAmount,
        total,
        hasDiscount,
        paymentText,
        guaranteeText,
        layoutImageUrl,
        serviceOrders,
        bankSlipPdfUrls: bankSlipInstallments.map((s: any) => s.pdfUrl),
        nfsePdfUrls: nfseDocuments.map((doc: any) => `${apiUrl}/nfse/public/${doc.elotechNfseId}/pdf`),
      });
      toast.success("PDF baixado!");
    } catch (err) {
      console.error("PDF generation error:", err);
      toast.error(err instanceof Error ? err.message : "Erro ao gerar PDF.");
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
      a.download = `dossie-${budgetNumber}.zip`;
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
              <img src="/logo.png" alt={COMPANY.name} className="h-16 md:h-20" />
              <div className="flex items-start gap-2">
                <div className="text-right">
                  <h1 className="text-xl md:text-2xl font-bold text-gray-900">
                    Dossiê Nº {budgetNumber}
                  </h1>
                  <p className="text-sm text-gray-600 mt-1">
                    <span className="font-semibold">Emissão:</span> {formatDate(new Date())}
                  </p>
                  {quote.task?.finishedAt && (
                    <p className="text-sm text-gray-600">
                      <span className="font-semibold">Finalizado em:</span> {formatDate(quote.task.finishedAt)}
                    </p>
                  )}
                </div>
                <Popover open={menuOpen} onOpenChange={setMenuOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-500 hover:text-gray-900 hover:bg-gray-100 no-print">
                      <IconDotsVertical className="h-5 w-5" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent align="end" sideOffset={4} className="w-48 p-1 bg-white border border-gray-200 shadow-lg">
                    <button onClick={() => { setMenuOpen(false); handleCopyLink(); }} className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors">
                      <IconCopy className="h-4 w-4 text-gray-500" /> Copiar link
                    </button>
                    <button onClick={() => { setMenuOpen(false); handleWhatsAppShare(); }} className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors">
                      <IconBrandWhatsapp className="h-4 w-4 text-green-600" /> WhatsApp
                    </button>
                    <button onClick={() => { setMenuOpen(false); handleExportPdf(); }} className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors">
                      <IconFileTypePdf className="h-4 w-4 text-red-500" /> Baixar PDF
                    </button>
                    <button onClick={() => { setMenuOpen(false); handleDownloadArchive(); }} className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors">
                      <IconDownload className="h-4 w-4 text-blue-500" /> Baixar Arquivos
                    </button>
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            {/* Green divider */}
            <div className="h-px mb-8" style={{ background: `linear-gradient(to right, #888 0%, ${COMPANY.primaryGreen} 30%)` }} />

            {/* Title */}
            <h2 className="text-xl font-bold underline underline-offset-4 mb-6" style={{ color: COMPANY.primaryGreen }}>
              DOSSIÊ
            </h2>

            {/* Customer + Vehicle Info */}
            <div className="mb-6">
              <p className="font-bold mb-1" style={{ color: COMPANY.primaryGreen }}>
                À {contactName || corporateName}
              </p>
              <p className="text-gray-700">
                Prezado(a) cliente, segue o dossiê referente aos serviços realizados
                {(quote.task?.serialNumber || quote.task?.truck?.plate || quote.task?.truck?.chassisNumber) && (
                  <>
                    {" "}no veículo
                    {quote.task?.serialNumber && <> nº de série: <strong>{quote.task.serialNumber}</strong></>}
                    {quote.task?.serialNumber && (quote.task?.truck?.plate || quote.task?.truck?.chassisNumber) && ","}
                    {quote.task?.truck?.plate && <> placa: <strong>{quote.task.truck.plate}</strong></>}
                    {quote.task?.truck?.plate && quote.task?.truck?.chassisNumber && ","}
                    {quote.task?.truck?.chassisNumber && <> chassi: <strong>{quote.task.truck.chassisNumber}</strong></>}
                  </>
                )}.
              </p>
            </div>

            {/* Services */}
            <div className="mb-6">
              <h3 className="text-lg font-bold mb-4" style={{ color: COMPANY.primaryGreen }}>
                Serviços Realizados
              </h3>
              <table className="w-full ml-4" style={{ borderCollapse: 'collapse' }}>
                <tbody>
                  {services.map((svc: any, i: number) => {
                    const amount = Number(svc.amount) || 0;
                    const desc = toTitleCase(svc.description || "");
                    const obs = svc.observation || "";
                    const isOutros = svc.description?.trim().toLowerCase() === "outros";
                    const displayDesc = isOutros && obs ? obs : obs ? `${desc} ${obs}` : desc;
                    let discount = 0;
                    if (svc.discountType === "PERCENTAGE" && svc.discountValue) discount = Math.round((amount * svc.discountValue / 100) * 100) / 100;
                    else if (svc.discountType === "FIXED_VALUE" && svc.discountValue) discount = Math.min(svc.discountValue, amount);
                    const net = Math.max(0, amount - discount);

                    return (
                      <tr key={svc.id || i} className="align-top">
                        <td className="text-gray-800 py-1 pr-2">
                          {i + 1} - {displayDesc}
                          {discount > 0 && svc.discountReference && (
                            <span className="text-xs text-gray-500 ml-1">
                              ({svc.discountType === 'PERCENTAGE' ? `${svc.discountValue}%` : formatCurrency(discount)} desc. — Ref: {svc.discountReference})
                            </span>
                          )}
                        </td>
                        <td className="text-gray-800 font-normal whitespace-nowrap text-right py-1 pl-2">
                          {discount > 0 ? (
                            <>
                              <span className="line-through text-gray-400 text-[10px] mr-1">{formatCurrency(amount)}</span>
                              {formatCurrency(net)}
                            </>
                          ) : (
                            formatCurrency(amount)
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {/* Totals */}
              <div className="mt-6 pl-4 space-y-1">
                {hasDiscount && (
                  <>
                    <div className="flex justify-between items-baseline">
                      <span className="text-gray-700">Subtotal</span>
                      <span className="text-gray-800">{formatCurrency(subtotal)}</span>
                    </div>
                    <div className="flex justify-between items-baseline text-red-600">
                      <span>Desconto</span>
                      <span>- {formatCurrency(discountAmount)}</span>
                    </div>
                  </>
                )}
                <div className={`flex justify-between items-baseline ${hasDiscount ? 'pt-2 border-t border-gray-200' : ''}`}>
                  <span className="font-bold text-gray-900">Total</span>
                  <span className="font-bold text-lg" style={{ color: COMPANY.primaryGreen }}>
                    {formatCurrency(total)}
                  </span>
                </div>
              </div>
            </div>

            {/* Payment Conditions */}
            {paymentText && (
              <div className="mb-6">
                <h3 className="text-lg font-bold mb-2" style={{ color: COMPANY.primaryGreen }}>
                  Condições de pagamento
                </h3>
                <p className="text-gray-700">{paymentText}</p>
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

            {/* Layout Image */}
            {layoutImageUrl && (
              <div className="mb-8">
                <h3 className="text-lg font-bold mb-4" style={{ color: COMPANY.primaryGreen }}>
                  Layout aprovado
                </h3>
                <div className="w-full">
                  <img src={layoutImageUrl} alt="Layout aprovado" className="w-full h-auto rounded-lg shadow-md" />
                </div>
              </div>
            )}

            {/* Footer */}
            <div
              className="pt-4 mt-8 border-t"
              style={{ borderImage: `linear-gradient(to right, #888 0%, ${COMPANY.primaryGreen} 30%) 1` }}
            >
              <p className="font-bold" style={{ color: COMPANY.primaryGreen }}>{COMPANY.name}</p>
              <p className="text-sm text-gray-600">{COMPANY.address}</p>
              <p className="text-sm">
                <a href={whatsappLink} target="_blank" rel="noopener noreferrer" style={{ color: COMPANY.primaryGreen }} className="hover:underline">
                  {COMPANY.phone}
                </a>
              </p>
              <p className="text-sm">
                <a href={COMPANY.websiteUrl} target="_blank" rel="noopener noreferrer" style={{ color: COMPANY.primaryGreen }} className="hover:underline">
                  {COMPANY.website}
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
                <img src="/logo.png" alt={COMPANY.name} className="h-16 md:h-20" />
                <div className="text-right">
                  <h1 className="text-xl md:text-2xl font-bold text-gray-900">Dossiê Nº {budgetNumber}</h1>
                  <p className="text-sm text-gray-600 mt-1"><span className="font-semibold">Emissão:</span> {formatDate(new Date())}</p>
                </div>
              </div>
              <div className="h-px mb-8" style={{ background: `linear-gradient(to right, #888 0%, ${COMPANY.primaryGreen} 30%)` }} />

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
                            <div className="grid grid-cols-3 md:grid-cols-4 gap-2">
                              {checkinFiles.map((f: any) => (
                                <img key={f.id} src={`${apiUrl}/files/serve/${f.id}`} alt={desc} className="w-full aspect-[4/3] object-cover rounded border border-gray-200" />
                              ))}
                            </div>
                          </div>
                        )}
                        {checkoutFiles.length > 0 && (
                          <div>
                            <p className="text-xs font-semibold text-green-600 uppercase tracking-wide mb-1.5">Depois</p>
                            <div className="grid grid-cols-3 md:grid-cols-4 gap-2">
                              {checkoutFiles.map((f: any) => (
                                <img key={f.id} src={`${apiUrl}/files/serve/${f.id}`} alt={desc} className="w-full aspect-[4/3] object-cover rounded border border-gray-200" />
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
              <div className="pt-4 mt-8 border-t" style={{ borderImage: `linear-gradient(to right, #888 0%, ${COMPANY.primaryGreen} 30%) 1` }}>
                <p className="font-bold" style={{ color: COMPANY.primaryGreen }}>{COMPANY.name}</p>
                <p className="text-sm text-gray-600">{COMPANY.address}</p>
                <p className="text-sm"><a href={whatsappLink} target="_blank" rel="noopener noreferrer" style={{ color: COMPANY.primaryGreen }} className="hover:underline">{COMPANY.phone}</a></p>
                <p className="text-sm"><a href={COMPANY.websiteUrl} target="_blank" rel="noopener noreferrer" style={{ color: COMPANY.primaryGreen }} className="hover:underline">{COMPANY.website}</a></p>
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
