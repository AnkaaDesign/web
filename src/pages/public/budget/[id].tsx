import { useState, useEffect, useCallback, useMemo } from "react";
import { useParams } from "react-router-dom";
import { taskPricingService } from "@/api-client/task-pricing";
import { formatCurrency, formatDate, toTitleCase } from "@/utils";
import { getApiBaseUrl } from "@/utils/file";
import { generatePaymentText, generateGuaranteeText } from "@/utils/pricing-text-generators";
import { exportBudgetPdfFromData } from "@/utils/budget-pdf-generator";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toast } from "@/components/ui/sonner";
import { IconUpload, IconCheck, IconAlertCircle, IconLoader2, IconBrandWhatsapp, IconDotsVertical, IconCopy, IconFileTypePdf } from "@tabler/icons-react";
import type { TaskPricing } from "@/types/task-pricing";
import { COMPANY_INFO, BRAND_COLORS } from "@/config/company";

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

interface PricingData extends TaskPricing {
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
    };
  };
}

export function PublicBudgetPage() {
  const { id, customerId } = useParams<{ id: string; customerId: string }>();
  const [pricing, setPricing] = useState<PricingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [signatureFile, setSignatureFile] = useState<File | null>(null);
  const [signaturePreview, setSignaturePreview] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  // Use customerId from URL to filter services for a specific invoiceTo customer
  // If customerId matches the task's own customer (or is generic), show all services
  const selectedCustomerId = useMemo(() => {
    if (!customerId || !pricing?.customerConfigs) return null;
    // Only filter if the customerId matches one of the customerConfigs customers
    const isConfigCustomer = pricing.customerConfigs.some(c => c.id === customerId);
    return isConfigCustomer ? customerId : null;
  }, [customerId, pricing?.customerConfigs]);

  // Fetch pricing data
  const fetchPricing = useCallback(async () => {
    if (!id) {
      setError("ID do orçamento não fornecido.");
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const response = await taskPricingService.getPublic(id);
      if (response.data?.success && response.data?.data) {
        setPricing(response.data.data);
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
    fetchPricing();
  }, [fetchPricing]);

  // Handle signature file selection
  const handleSignatureChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type
      const allowedTypes = ["image/png", "image/jpeg", "image/jpg", "image/webp"];
      if (!allowedTypes.includes(file.type)) {
        toast.error("Tipo de arquivo inválido. Use PNG, JPEG ou WebP.");
        return;
      }

      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        toast.error("Arquivo muito grande. Máximo 5MB.");
        return;
      }

      setSignatureFile(file);

      // Create preview
      const reader = new FileReader();
      reader.onload = () => {
        setSignaturePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  // Handle signature upload
  const handleUploadSignature = async () => {
    if (!signatureFile || !id) return;

    try {
      setUploading(true);
      const response = await taskPricingService.uploadPublicSignature(id, signatureFile);
      if (response.data?.success) {
        toast.success("Assinatura enviada com sucesso!");
        // Refresh pricing data
        await fetchPricing();
        setSignatureFile(null);
        setSignaturePreview(null);
      } else {
        toast.error(response.data?.message || "Erro ao enviar assinatura.");
      }
    } catch (err: any) {
      const message = err.response?.data?.message || "Erro ao enviar assinatura.";
      toast.error(message);
    } finally {
      setUploading(false);
    }
  };

  // Filter services based on selected customer (hooks must be before early returns)
  const filteredServices = useMemo(() => {
    if (!pricing?.services) return [];
    if (!selectedCustomerId) return pricing.services;
    return pricing.services.filter(
      (service) => service.invoiceToCustomerId === selectedCustomerId || service.invoiceToCustomerId === null
    );
  }, [pricing?.services, selectedCustomerId]);

  // Recalculate subtotal for filtered services
  const filteredSubtotal = useMemo(() => {
    return filteredServices.reduce((sum, service) => sum + (service.amount || 0), 0);
  }, [filteredServices]);

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

  if (!pricing) return null;

  // Calculate derived data
  const corporateName = pricing.task?.customer?.corporateName || pricing.task?.customer?.fantasyName || "Cliente";
  // Find the relevant customer config (filtered by URL param, or first available)
  const activeConfig = pricing.customerConfigs?.find(c => c.id === selectedCustomerId) || pricing.customerConfigs?.[0];
  // Prefer the explicitly selected budget responsible from the config
  const commercialRep = pricing.task?.responsibles?.find(r => r.role === "COMMERCIAL");
  const contactName = activeConfig?.responsible?.name
    || commercialRep?.name
    || pricing.task?.responsibles?.[0]?.name
    || "";
  // Format budget number with leading zeros (e.g., "0042")
  const budgetNumber = pricing.budgetNumber
    ? String(pricing.budgetNumber).padStart(4, '0')
    : pricing.task?.serialNumber || "0000";
  // Calculate validity in days (budget expiration, NOT delivery time)
  const validityDays = pricing.expiresAt
    ? Math.max(0, Math.round((new Date(pricing.expiresAt).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)))
    : 30;
  const termDate = pricing.task?.term ? formatDate(pricing.task.term) : "";
  // Custom delivery days (production time) - used when no term date is set
  const customDeliveryDays = pricing.customForecastDays || null;
  const paymentText = generatePaymentText({
    customPaymentText: activeConfig?.customPaymentText || null,
    paymentCondition: activeConfig?.paymentCondition,
    downPaymentDate: activeConfig?.downPaymentDate,
    total: activeConfig?.total ?? pricing.total,
  });
  const guaranteeText = generateGuaranteeText(pricing);
  const configDiscountType = activeConfig?.discountType || "NONE";
  const configDiscountValue = activeConfig?.discountValue ?? null;
  const hasDiscount = configDiscountType !== "NONE" && configDiscountValue && configDiscountValue > 0;

  const whatsappLink = `https://wa.me/${COMPANY.phoneClean}`;
  const configSignature = activeConfig?.customerSignature;
  const hasExistingSignature = !!configSignature?.id;
  // Use serve endpoint for full quality images
  const layoutImageUrl = pricing.layoutFile?.id ? getFileServeUrl(pricing.layoutFile) : null;
  // Use serve endpoint for signature to preserve PNG transparency
  const signatureImageUrl = configSignature?.id ? getFileServeUrl(configSignature) : null;

  // Recalculate discount and total based on active filter
  const displaySubtotal = selectedCustomerId ? filteredSubtotal : pricing.subtotal;
  const discountAmount = configDiscountType === "PERCENTAGE"
    ? (displaySubtotal * (configDiscountValue || 0)) / 100
    : (configDiscountValue || 0);
  const displayTotal = selectedCustomerId
    ? Math.max(0, Math.round((displaySubtotal - discountAmount) * 100) / 100)
    : pricing.total;

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
  const handleExportPdf = async () => {
    try {
      toast.info("Gerando PDF...");
      await exportBudgetPdfFromData({
        corporateName,
        contactName,
        currentDate: formatDate(pricing.createdAt),
        validityDays,
        budgetNumber,
        items: pricing.services || [],
        subtotal: pricing.subtotal,
        discountType: configDiscountType,
        discountValue: configDiscountValue,
        total: pricing.total,
        termDate,
        customDeliveryDays,
        paymentText,
        guaranteeText,
        layoutImageUrl,
        customerSignatureUrl: signatureImageUrl,
        serialNumber: pricing.task?.serialNumber || null,
        plate: pricing.task?.truck?.plate || null,
        chassisNumber: pricing.task?.truck?.chassisNumber || null,
        customerConfigs: pricing.customerConfigs,
        simultaneousTasks: pricing.simultaneousTasks || null,
        discountReference: activeConfig?.discountReference || null,
        customerFilter: selectedCustomerId,
      });
      toast.success("PDF exportado!");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Erro ao exportar PDF."
      );
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
              <img src="/logo.png" alt="Ankaa Design" className="h-16 md:h-20" />
              <div className="flex items-start gap-2">
                <div className="text-right">
                <h1 className="text-xl md:text-2xl font-bold text-gray-900">
                  Orçamento Nº {budgetNumber}
                </h1>
                <p className="text-sm text-gray-600 mt-1">
                  <span className="font-semibold">Emissão:</span> {formatDate(pricing.createdAt)}
                </p>
                <p className="text-sm text-gray-600">
                  <span className="font-semibold">Validade:</span> {validityDays} dias
                </p>
                </div>
                <Popover open={menuOpen} onOpenChange={setMenuOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-gray-500 hover:text-gray-900 hover:bg-gray-100"
                    >
                      <IconDotsVertical className="h-5 w-5" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent align="end" sideOffset={4} className="w-48 p-1">
                    <button
                      onClick={() => { setMenuOpen(false); handleCopyLink(); }}
                      className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm hover:bg-gray-100 transition-colors"
                    >
                      <IconCopy className="h-4 w-4 text-gray-500" />
                      Copiar link
                    </button>
                    <button
                      onClick={() => { setMenuOpen(false); handleWhatsAppShare(); }}
                      className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm hover:bg-gray-100 transition-colors"
                    >
                      <IconBrandWhatsapp className="h-4 w-4 text-green-600" />
                      WhatsApp
                    </button>
                    <button
                      onClick={() => { setMenuOpen(false); handleExportPdf(); }}
                      className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm hover:bg-gray-100 transition-colors"
                    >
                      <IconFileTypePdf className="h-4 w-4 text-red-500" />
                      PDF
                    </button>
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            {/* Green divider */}
            <div
              className="h-px mb-8"
              style={{
                background: `linear-gradient(to right, #888 0%, ${COMPANY.primaryGreen} 30%)`,
              }}
            />

            {/* Title */}
            <h2
              className="text-xl font-bold underline underline-offset-4 mb-6"
              style={{ color: COMPANY.primaryGreen }}
            >
              ORÇAMENTO
            </h2>

            {/* Customer Info */}
            <div className="mb-6">
              <p className="font-bold mb-1" style={{ color: COMPANY.primaryGreen }}>
                À {contactName || corporateName}
              </p>
              <p className="text-gray-700">
                Conforme solicitado, apresentamos nossa proposta de preço para execução dos
                serviços abaixo descriminados
                {(pricing.task?.serialNumber || pricing.task?.truck?.plate || pricing.task?.truck?.chassisNumber) && (
                  <>
                    {" "}no veículo
                    {pricing.task?.serialNumber && (
                      <> nº série: <strong>{pricing.task.serialNumber}</strong></>
                    )}
                    {pricing.task?.serialNumber && (pricing.task?.truck?.plate || pricing.task?.truck?.chassisNumber) && ","}
                    {pricing.task?.truck?.plate && (
                      <> placa: <strong>{pricing.task.truck.plate}</strong></>
                    )}
                    {pricing.task?.truck?.plate && pricing.task?.truck?.chassisNumber && ","}
                    {pricing.task?.truck?.chassisNumber && (
                      <> chassi: <strong>{pricing.task.truck.chassisNumber}</strong></>
                    )}
                  </>
                )}.
              </p>
              {pricing.customerConfigs && pricing.customerConfigs.length > 0 && (
                <p className="text-gray-700 mt-2">
                  <strong>Faturamento para:</strong>{" "}
                  {pricing.customerConfigs
                    .map(c => c.customer?.fantasyName || c.customer?.corporateName || "Cliente")
                    .join(", ")}
                </p>
              )}
            </div>

            {/* Services */}
            <div className="mb-6">
              <h3 className="text-lg font-bold mb-4" style={{ color: COMPANY.primaryGreen }}>
                Serviços
              </h3>
              <div className="space-y-2 pl-4">
                {filteredServices.map((service, index) => {
                  // Combine description and observation inline (e.g., "Pintura Geral Azul Firenze")
                  // For "Outros" services, display only the observation (not "Outros observation")
                  const isOutros = service.description?.trim().toLowerCase() === "outros";
                  const description = toTitleCase(service.description || "");
                  const observation = service.observation || "";
                  const displayText = isOutros && observation
                    ? observation
                    : observation
                      ? `${description} ${observation}`
                      : description;
                  return (
                    <div key={service.id} className="flex justify-between items-baseline">
                      <span className="text-gray-800">
                        {index + 1} - {displayText}
                      </span>
                      <span className="text-gray-800 font-normal ml-4 whitespace-nowrap">
                        {formatCurrency(Number(service.amount) || 0)}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Totals - Always show total, only show subtotal/discount rows when there's a discount */}
              <div className="mt-6 pl-4 space-y-1">
                {hasDiscount && (
                  <>
                    <div className="flex justify-between items-baseline">
                      <span className="text-gray-700">Subtotal</span>
                      <span className="text-gray-800">{formatCurrency(displaySubtotal)}</span>
                    </div>
                    <div className="flex justify-between items-baseline text-red-600">
                      <span>
                        Desconto
                        {configDiscountType === "PERCENTAGE"
                          ? ` (${configDiscountValue}%)`
                          : ""}
                        {activeConfig?.discountReference && (
                          <span className="text-gray-500 font-normal"> — Ref: {activeConfig.discountReference}</span>
                        )}
                      </span>
                      <span>- {formatCurrency(discountAmount)}</span>
                    </div>
                  </>
                )}
                <div className={`flex justify-between items-baseline ${hasDiscount ? 'pt-2 border-t border-gray-200' : ''}`}>
                  <span className="font-bold text-gray-900">Total</span>
                  <span className="font-bold text-lg" style={{ color: COMPANY.primaryGreen }}>
                    {formatCurrency(displayTotal)}
                  </span>
                </div>
              </div>
            </div>

            {/* Delivery Term - customDeliveryDays takes priority over termDate */}
            {customDeliveryDays ? (
              <div className="mb-6">
                <h3 className="text-lg font-bold mb-2" style={{ color: COMPANY.primaryGreen }}>
                  Prazo de entrega
                </h3>
                <p className="text-gray-700">
                  O prazo de entrega é de {customDeliveryDays} dias úteis a partir da data de liberação.
                  {pricing.simultaneousTasks && pricing.simultaneousTasks > 1 && (
                    <> Capacidade de produção: {pricing.simultaneousTasks} tarefas simultâneas.</>
                  )}
                </p>
              </div>
            ) : termDate ? (
              <div className="mb-6">
                <h3 className="text-lg font-bold mb-2" style={{ color: COMPANY.primaryGreen }}>
                  Prazo de entrega
                </h3>
                <p className="text-gray-700">
                  O prazo de entrega é de {termDate}, desde que o implemento esteja nas condições
                  previamente informada e não haja alterações nos serviços descritos.
                </p>
              </div>
            ) : null}

            {/* Payment Terms */}
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

            {/* Layout Image - Full Width */}
            {layoutImageUrl && (
              <div className="mb-8">
                <h3 className="text-lg font-bold mb-4" style={{ color: COMPANY.primaryGreen }}>
                  Layout aprovado
                </h3>
                <div className="w-full">
                  <img
                    src={layoutImageUrl}
                    alt="Layout aprovado"
                    className="w-full h-auto rounded-lg shadow-md"
                  />
                </div>
              </div>
            )}

            {/* Signature Section */}
            <div className="mt-8 mb-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Company Signature */}
                <div className="text-center">
                  <div className="h-24 flex items-end justify-center mb-2">
                    <img
                      src="/sergio-signature.webp"
                      alt="Assinatura Sergio Rodrigues"
                      className="max-h-20 object-contain mt-10"
                    />
                  </div>
                  <div className="border-t border-gray-900 pt-3">
                    <p className="text-gray-900">{COMPANY.directorName}</p>
                    <p className="text-sm text-gray-600">{COMPANY.directorTitle}</p>
                  </div>
                </div>

                {/* Customer Signature */}
                <div className="text-center">
                  {/* Signature image or file picker */}
                  <div className="h-24 flex items-end justify-center mb-2">
                    {hasExistingSignature && signatureImageUrl ? (
                      <img
                        src={signatureImageUrl}
                        alt="Assinatura do Cliente"
                        className="max-h-20 object-contain"
                      />
                    ) : signaturePreview ? (
                      <div className="flex flex-col items-center gap-2 w-full">
                        <img
                          src={signaturePreview}
                          alt="Preview da assinatura"
                          className="max-h-14 object-contain"
                        />
                        <Button
                          onClick={handleUploadSignature}
                          disabled={uploading}
                          size="sm"
                          style={{ backgroundColor: COMPANY.primaryGreen }}
                          className="text-white hover:opacity-90 px-4 py-2"
                        >
                          {uploading ? (
                            <>
                              <IconLoader2 className="h-4 w-4 animate-spin mr-2" />
                              Enviando...
                            </>
                          ) : (
                            <>
                              <IconUpload className="h-4 w-4 mr-2" />
                              Confirmar Assinatura
                            </>
                          )}
                        </Button>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center w-full">
                        <label
                          htmlFor="signature-upload"
                          className="cursor-pointer flex flex-col items-center gap-2 px-6 py-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-gray-400 transition-colors w-full max-w-xs"
                        >
                          <IconUpload className="h-8 w-8 text-gray-400" />
                          <span className="text-sm text-gray-500 font-medium">Enviar assinatura</span>
                          <span className="text-xs text-gray-400">PNG, JPEG ou WebP</span>
                          <input
                            id="signature-upload"
                            type="file"
                            accept="image/png,image/jpeg,image/jpg,image/webp"
                            onChange={handleSignatureChange}
                            className="hidden"
                          />
                        </label>
                      </div>
                    )}
                  </div>
                  <div className="border-t border-gray-900 pt-3">
                    <p className="text-gray-900">Responsável CLIENTE</p>
                    <p className="text-sm text-gray-600">&nbsp;</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Success message when signature exists */}
            {hasExistingSignature && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-8 flex items-center gap-3">
                <IconCheck className="h-5 w-5 text-green-600 flex-shrink-0" />
                <p className="text-green-800">
                  Assinatura enviada com sucesso! O orçamento foi confirmado.
                </p>
              </div>
            )}

            {/* Footer */}
            <div
              className="pt-4 mt-8 border-t"
              style={{
                borderImage: `linear-gradient(to right, #888 0%, ${COMPANY.primaryGreen} 30%) 1`,
              }}
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
                  {COMPANY.phone}
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
                  {COMPANY.website}
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
