import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { IconCalendar, IconShield, IconShieldCheck, IconUser, IconPackage, IconTruck, IconCircleCheck, IconFileText, IconPencil, IconExternalLink, IconFingerprint, IconLoader2 } from "@tabler/icons-react";
import type { PpeDelivery } from "../../../../../types";
import { PPE_DELIVERY_STATUS_LABELS, getBadgeVariant, PPE_DELIVERY_STATUS } from "../../../../../constants";
import { formatDateTime } from "../../../../../utils";
import { cn } from "@/lib/utils";
import { useVerifyPpeSignature } from "@/hooks/human-resources/use-ppe";
import { toast } from "@/components/ui/sonner";

const BIOMETRIC_LABELS: Record<string, string> = {
  FINGERPRINT: 'Impressão Digital',
  FACE_ID: 'Reconhecimento Facial',
  IRIS: 'Reconhecimento de Íris',
  DEVICE_PIN: 'PIN do Dispositivo',
  NONE: 'Nenhuma',
};

interface PpeDeliveryInfoCardProps {
  ppeDelivery: PpeDelivery;
  className?: string;
}

export function PpeDeliveryInfoCard({ ppeDelivery, className }: PpeDeliveryInfoCardProps) {
  const statusLabel = PPE_DELIVERY_STATUS_LABELS[ppeDelivery.status] || ppeDelivery.status;
  const statusVariant = getBadgeVariant(ppeDelivery.status, "PPE_DELIVERY");

  const verifySignatureMutation = useVerifyPpeSignature();
  const [verificationResult, setVerificationResult] = useState<{ valid: boolean; details?: string } | null>(null);

  const handleVerifySignature = () => {
    setVerificationResult(null);
    verifySignatureMutation.mutate(ppeDelivery.id, {
      onSuccess: (result) => {
        setVerificationResult({ valid: result.valid, details: result.details });
        if (result.valid) {
          toast.success("Integridade verificada", {
            description: "A assinatura digital foi verificada com sucesso.",
          });
        } else {
          toast.error("Verificação falhou", {
            description: result.details || "A assinatura digital pode ter sido adulterada.",
          });
        }
      },
      onError: (error) => {
        toast.error("Erro ao verificar", {
          description: error.message || "Ocorreu um erro ao verificar a integridade da assinatura.",
        });
      },
    });
  };

  return (
    <Card className={cn("shadow-sm border border-border", className)}>
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2">
          <IconShield className="h-5 w-5 text-muted-foreground" />
          Informações da Entrega
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Status */}
        <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-3">
          <span className="text-sm font-medium text-muted-foreground">Status</span>
          <Badge variant={statusVariant} className="whitespace-nowrap">
            {statusLabel}
          </Badge>
        </div>

        {/* Item */}
        <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-3">
          <div className="flex items-center gap-2">
            <IconPackage className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium text-muted-foreground">Item</span>
          </div>
          <span className="text-sm font-semibold text-foreground">{ppeDelivery.item?.name || "-"}</span>
        </div>

        {/* Funcionário */}
        <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-3">
          <div className="flex items-center gap-2">
            <IconUser className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium text-muted-foreground">Funcionário</span>
          </div>
          <span className="text-sm font-semibold text-foreground">{ppeDelivery.user?.name || "-"}</span>
        </div>

        {/* Aprovado Por */}
        {ppeDelivery.reviewedByUser && (
          <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-3">
            <div className="flex items-center gap-2">
              <IconCircleCheck className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium text-muted-foreground">Aprovado Por</span>
            </div>
            <span className="text-sm font-semibold text-foreground">{ppeDelivery.reviewedByUser.name}</span>
          </div>
        )}

        {/* Quantidade */}
        <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-3">
          <div className="flex items-center gap-2">
            <IconPackage className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium text-muted-foreground">Quantidade</span>
          </div>
          <span className="font-mono font-semibold text-lg">{ppeDelivery.quantity || 0}</span>
        </div>

        {/* Data de Requisição */}
        <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-3">
          <div className="flex items-center gap-2">
            <IconCalendar className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium text-muted-foreground">Data de Requisição</span>
          </div>
          <span className="text-sm font-semibold text-foreground">{formatDateTime(ppeDelivery.createdAt)}</span>
        </div>

        {/* Data de Aprovação */}
        {ppeDelivery.reviewedBy && ppeDelivery.updatedAt && (
          <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-3">
            <div className="flex items-center gap-2">
              <IconCircleCheck className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium text-muted-foreground">Data de Aprovação</span>
            </div>
            <span className="text-sm font-semibold text-foreground">{formatDateTime(ppeDelivery.updatedAt)}</span>
          </div>
        )}

        {/* Data de Entrega */}
        {ppeDelivery.actualDeliveryDate && (
          <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-3">
            <div className="flex items-center gap-2">
              <IconTruck className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium text-muted-foreground">Data de Entrega</span>
            </div>
            <span className="text-sm font-semibold text-foreground">{formatDateTime(ppeDelivery.actualDeliveryDate)}</span>
          </div>
        )}

        {/* Signature Section - Show for delivered and signature-related statuses */}
        {(ppeDelivery.status === PPE_DELIVERY_STATUS.DELIVERED ||
          ppeDelivery.status === PPE_DELIVERY_STATUS.WAITING_SIGNATURE ||
          ppeDelivery.status === PPE_DELIVERY_STATUS.COMPLETED ||
          ppeDelivery.status === PPE_DELIVERY_STATUS.SIGNATURE_REJECTED) && (
          <>
            {/* Divider */}
            <div className="border-t border-border my-4" />

            {/* Signature Header */}
            <div className="flex items-center gap-2 mb-3">
              <IconPencil className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-semibold text-foreground">Assinatura Digital</span>
            </div>

            {/* Signature Status */}
            <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-3">
              <span className="text-sm font-medium text-muted-foreground">Status da Assinatura</span>
              <Badge
                variant={
                  ppeDelivery.status === PPE_DELIVERY_STATUS.COMPLETED
                    ? "success"
                    : ppeDelivery.status === PPE_DELIVERY_STATUS.SIGNATURE_REJECTED
                    ? "destructive"
                    : "warning"
                }
              >
                {ppeDelivery.status === PPE_DELIVERY_STATUS.COMPLETED
                  ? "Assinado"
                  : ppeDelivery.status === PPE_DELIVERY_STATUS.SIGNATURE_REJECTED
                  ? "Rejeitado"
                  : "Aguardando Assinatura"}
              </Badge>
            </div>

            {/* In-App Signature Details */}
            {ppeDelivery.signature && (
              <>
                {/* Signer */}
                <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-3">
                  <div className="flex items-center gap-2">
                    <IconUser className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium text-muted-foreground">Assinante</span>
                  </div>
                  <span className="text-sm font-semibold text-foreground">
                    {ppeDelivery.signature.signedByUser?.name || ppeDelivery.user?.name || '-'}
                  </span>
                </div>

                {/* Biometric Method */}
                <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-3">
                  <div className="flex items-center gap-2">
                    <IconFingerprint className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium text-muted-foreground">Autenticação</span>
                  </div>
                  <span className="text-sm font-semibold text-foreground">
                    {BIOMETRIC_LABELS[ppeDelivery.signature.biometricMethod] || ppeDelivery.signature.biometricMethod}
                  </span>
                </div>

                {/* Signature Timestamp */}
                <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-3">
                  <div className="flex items-center gap-2">
                    <IconCircleCheck className="h-4 w-4 text-green-500" />
                    <span className="text-sm font-medium text-muted-foreground">Data da Assinatura</span>
                  </div>
                  <span className="text-sm font-semibold text-foreground">
                    {formatDateTime(ppeDelivery.signature.serverTimestamp || ppeDelivery.signature.clientTimestamp)}
                  </span>
                </div>

                {/* Verification Code */}
                {ppeDelivery.signature.hmacSignature && (
                  <div className="flex justify-between items-center bg-green-50 dark:bg-green-950/20 rounded-lg px-4 py-3">
                    <span className="text-xs font-medium text-muted-foreground">Código de verificação</span>
                    <span className="text-xs font-bold font-mono text-green-600 tracking-wider">
                      {ppeDelivery.signature.hmacSignature.substring(0, 16).toUpperCase()}
                    </span>
                  </div>
                )}

                {/* Verify Integrity Button */}
                <div className="flex flex-col gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleVerifySignature}
                    disabled={verifySignatureMutation.isPending}
                    className="w-full"
                  >
                    {verifySignatureMutation.isPending ? (
                      <IconLoader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <IconShieldCheck className="mr-2 h-4 w-4" />
                    )}
                    Verificar Integridade
                  </Button>

                  {/* Verification Result Feedback */}
                  {verificationResult && (
                    <div
                      className={cn(
                        "flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium",
                        verificationResult.valid
                          ? "bg-green-50 dark:bg-green-950/20 text-green-700 dark:text-green-400"
                          : "bg-red-50 dark:bg-red-950/20 text-red-700 dark:text-red-400",
                      )}
                    >
                      {verificationResult.valid ? (
                        <>
                          <IconCircleCheck className="h-4 w-4 flex-shrink-0" />
                          Assinatura íntegra e válida
                        </>
                      ) : (
                        <>
                          <IconShield className="h-4 w-4 flex-shrink-0" />
                          {verificationResult.details || "Assinatura inválida ou adulterada"}
                        </>
                      )}
                    </div>
                  )}
                </div>

                {/* Signed Document PDF (in-app) */}
                {ppeDelivery.signature.signedDocumentId && (
                  <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-3">
                    <div className="flex items-center gap-2">
                      <IconFileText className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium text-muted-foreground">Termo Assinado</span>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      asChild
                      className="h-7"
                    >
                      <a
                        href={`${import.meta.env.VITE_API_URL || ""}/files/serve/${ppeDelivery.signature.signedDocumentId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1"
                      >
                        <IconExternalLink className="h-3.5 w-3.5" />
                        Ver Documento Assinado
                      </a>
                    </Button>
                  </div>
                )}
              </>
            )}

            {/* Delivery Document */}
            {ppeDelivery.deliveryDocument && (
              <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-3">
                <div className="flex items-center gap-2">
                  <IconFileText className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium text-muted-foreground">
                    {ppeDelivery.signature?.signedDocumentId ? "Termo Original" : "Termo de Entrega"}
                  </span>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  asChild
                  className="h-7"
                >
                  <a
                    href={`${import.meta.env.VITE_API_URL || ""}/files/serve/${ppeDelivery.deliveryDocument.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1"
                  >
                    <IconExternalLink className="h-3.5 w-3.5" />
                    Ver Documento
                  </a>
                </Button>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
