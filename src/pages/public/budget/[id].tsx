import { useState, useEffect, useCallback } from "react";
import { useParams } from "react-router-dom";
import { taskPricingService } from "@/api-client/task-pricing";
import { formatCurrency, formatDate, toTitleCase } from "@/utils";
import { getApiBaseUrl } from "@/utils/file";
import { generatePaymentText, generateGuaranteeText } from "@/utils/pricing-text-generators";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { IconUpload, IconCheck, IconAlertCircle, IconLoader2 } from "@tabler/icons-react";
import type { TaskPricing } from "@/types/task-pricing";

// Company constants (deep forest green to match reference PDF)
const COMPANY = {
  name: "Ankaa Design",
  address: "Rua: Luís Carlos Zani, 2493 - Santa Paula, Ibiporã-PR",
  phone: "43 9 8428-3228",
  phoneClean: "5543984283228",
  website: "ankaadesign.com.br",
  websiteUrl: "https://ankaadesign.com.br",
  primaryGreen: "#0a5c1e",
  directorName: "Sergio Rodrigues",
  directorTitle: "Diretor Comercial",
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
    negotiatingWith?: { name?: string };
    customer?: {
      id: string;
      corporateName?: string;
      fantasyName?: string;
    };
    truck?: {
      plate?: string;
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

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <IconLoader2 className="h-12 w-12 animate-spin text-[#1a8b3d] mx-auto mb-4" />
          <p className="text-gray-600">Carregando orçamento...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <IconAlertCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
            <h1 className="text-xl font-bold text-gray-900 mb-2">
              Orçamento Indisponível
            </h1>
            <p className="text-gray-600">{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!pricing) return null;

  // Calculate derived data
  const corporateName = pricing.task?.customer?.corporateName || pricing.task?.customer?.fantasyName || "Cliente";
  const contactName = pricing.task?.negotiatingWith?.name || "";
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
  const paymentText = generatePaymentText(pricing);
  const guaranteeText = generateGuaranteeText(pricing);
  const hasDiscount = pricing.discountType !== "NONE" && pricing.discountValue && pricing.discountValue > 0;
  const discountAmount = pricing.discountType === "PERCENTAGE"
    ? (pricing.subtotal * (pricing.discountValue || 0)) / 100
    : (pricing.discountValue || 0);

  const whatsappLink = `https://wa.me/${COMPANY.phoneClean}`;
  const hasExistingSignature = !!pricing.customerSignature?.id;
  // Use serve endpoint for full quality images
  const layoutImageUrl = pricing.layoutFile?.id ? getFileServeUrl(pricing.layoutFile) : null;
  // Use serve endpoint for signature to preserve PNG transparency
  const signatureImageUrl = pricing.customerSignature?.id ? getFileServeUrl(pricing.customerSignature) : null;

  return (
    <div className="min-h-screen bg-gray-100 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Single Page Budget */}
        <div className="bg-white shadow-lg rounded-lg overflow-hidden">
          <div className="p-6 md:p-8">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start gap-4 mb-6">
              <img src="/logo.png" alt="Ankaa Design" className="h-16 md:h-20" />
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
                À {corporateName}
              </p>
              {contactName && (
                <p className="text-gray-700 mb-1">Caro {contactName}</p>
              )}
              <p className="text-gray-700">
                Conforme solicitado, apresentamos nossa proposta de preço para execução dos
                serviços abaixo descriminados
                {(pricing.task?.serialNumber || pricing.task?.truck?.plate) && (
                  <>
                    {" "}no veículo
                    {pricing.task?.serialNumber && (
                      <> nº série: <strong>{pricing.task.serialNumber}</strong></>
                    )}
                    {pricing.task?.serialNumber && pricing.task?.truck?.plate && ","}
                    {pricing.task?.truck?.plate && (
                      <> placa: <span className="font-semibold">{pricing.task.truck.plate}</span></>
                    )}
                  </>
                )}.
              </p>
            </div>

            {/* Services */}
            <div className="mb-6">
              <h3 className="text-lg font-bold mb-4" style={{ color: COMPANY.primaryGreen }}>
                Serviços
              </h3>
              <div className="space-y-2 pl-4">
                {pricing.items?.map((item, index) => {
                  // Combine description and observation inline (e.g., "Pintura Geral Azul Firenze")
                  // All text is displayed in Title Case
                  const description = toTitleCase(item.description || "");
                  const observation = item.observation ? toTitleCase(item.observation) : "";
                  const displayText = observation ? `${description} ${observation}` : description;
                  return (
                    <div key={item.id} className="flex justify-between items-baseline">
                      <span className="text-gray-800 capitalize">
                        {index + 1} - {displayText}
                      </span>
                      <span className="text-gray-800 font-normal ml-4 whitespace-nowrap">
                        {formatCurrency(Number(item.amount) || 0)}
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
                      <span className="text-gray-800">{formatCurrency(pricing.subtotal)}</span>
                    </div>
                    <div className="flex justify-between items-baseline text-red-600">
                      <span>
                        Desconto
                        {pricing.discountType === "PERCENTAGE"
                          ? ` (${pricing.discountValue}%)`
                          : ""}
                      </span>
                      <span>- {formatCurrency(discountAmount)}</span>
                    </div>
                  </>
                )}
                <div className={`flex justify-between items-baseline ${hasDiscount ? 'pt-2 border-t border-gray-200' : ''}`}>
                  <span className="font-bold text-gray-900">Total</span>
                  <span className="font-bold text-lg" style={{ color: COMPANY.primaryGreen }}>
                    {formatCurrency(pricing.total)}
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
