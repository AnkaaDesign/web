// a1-certificate-card.tsx
//
// Certificado digital A1 (.pfx/.p12) do colaborador PRESTADOR. É com ele que a NFS-e do
// aerografista é assinada na SEFIN nacional — o certificado é DELE, não da empresa.
//
// A senha só sobe: é guardada cifrada no servidor e NUNCA é devolvida nem exibida. Por
// isso não existe "ver senha" nem pré-preenchimento — trocar a senha significa reenviar
// o certificado.

import { useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { IconCertificate, IconFileCertificate, IconLoader2, IconTrash, IconUpload } from "@tabler/icons-react";

import { Form } from "@/components/ui/form";
import { FormInput } from "@/components/ui/form-input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/components/ui/sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

import { formatDate, maskCNPJ } from "@/utils";
import type { FiscalCertificateSummary } from "../../../../types";
import { useFiscalEmitter, useRevokeFiscalCertificate, useUploadFiscalCertificate } from "../../../../hooks/administration/use-fiscal-emitter";

// O servidor recusa acima disso — barramos antes de subir para não gastar o upload.
const MAX_CERTIFICATE_BYTES = 512 * 1024;
const ACCEPTED_CERTIFICATE = "application/x-pkcs12,.pfx,.p12";

const schema = z.object({
  password: z.string().min(1, "Informe a senha do certificado"),
});

type CertificateFormValues = z.infer<typeof schema>;

/** Badge de validade — revogado e vencido têm precedência sobre "vence em N dias". */
function certificateStatus(certificate: FiscalCertificateSummary): { label: string; variant: BadgeProps["variant"] } {
  if (certificate.revokedAt || !certificate.isActive) return { label: "Revogado", variant: "cancelled" };
  if (certificate.isExpired) return { label: "Vencido", variant: "cancelled" };
  const days = certificate.daysUntilExpiry;
  if (days != null && days <= 30) return { label: days === 1 ? "Vence em 1 dia" : `Vence em ${days} dias`, variant: "pending" };
  return { label: "Válido", variant: "active" };
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-border/40 py-2 last:border-b-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-right text-sm font-medium text-foreground">{value ?? <span className="text-muted-foreground">—</span>}</span>
    </div>
  );
}

interface A1CertificateCardProps {
  userId: string;
  className?: string;
  /** Renderiza APENAS o corpo — a seção da página de detalhes fornece a moldura. */
  embedded?: boolean;
  /** Somente leitura — esconde upload e revogação. */
  readOnly?: boolean;
}

export function A1CertificateCard({ userId, className, embedded = false, readOnly = false }: A1CertificateCardProps) {
  const { data: response, isLoading } = useFiscalEmitter(userId);
  const uploadMutation = useUploadFiscalCertificate();
  const revokeMutation = useRevokeFiscalCertificate();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [revokeTarget, setRevokeTarget] = useState<FiscalCertificateSummary | null>(null);

  const profile = response?.data?.profile ?? null;
  const certificate = response?.data?.certificate ?? null;

  const form = useForm<CertificateFormValues>({
    resolver: zodResolver(schema) as never,
    defaultValues: { password: "" },
  });

  const handleFilePick = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    event.target.value = "";
    if (!file) return;
    if (file.size > MAX_CERTIFICATE_BYTES) {
      toast.error("O certificado deve ter no máximo 512 KB.");
      return;
    }
    setSelectedFile(file);
  };

  const handleUpload = async (values: CertificateFormValues) => {
    if (!selectedFile) {
      toast.error("Selecione o arquivo .pfx ou .p12 do certificado.");
      return;
    }
    setIsUploading(true);
    try {
      await uploadMutation.mutateAsync({ userId, file: selectedFile, password: values.password });
      toast.success("Certificado enviado.");
      setSelectedFile(null);
      form.reset({ password: "" });
    } catch {
      // O interceptor global do api client já mostrou a notificação de erro.
    } finally {
      setIsUploading(false);
    }
  };

  const handleRevoke = async () => {
    if (!revokeTarget) return;
    try {
      await revokeMutation.mutateAsync({ certificateId: revokeTarget.id, userId });
      toast.success("Certificado revogado.");
    } catch {
      // O interceptor global do api client já mostrou a notificação de erro.
    } finally {
      setRevokeTarget(null);
    }
  };

  if (isLoading) {
    const skeleton = (
      <div className="space-y-3">
        <Skeleton className="h-9 w-full" />
        <Skeleton className="h-9 w-2/3" />
      </div>
    );
    return embedded ? (
      <div className={className}>{skeleton}</div>
    ) : (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <IconCertificate className="h-5 w-5" />
            Certificado Digital A1
          </CardTitle>
        </CardHeader>
        <CardContent>{skeleton}</CardContent>
      </Card>
    );
  }

  const status = certificate ? certificateStatus(certificate) : null;

  const body = (
    <div className="space-y-4">
      {!profile && (
        <p className="text-sm text-muted-foreground">
          Cadastre primeiro a identidade fiscal do colaborador — o certificado fica vinculado ao CNPJ do prestador.
        </p>
      )}

      {/* Painel somente leitura do certificado ativo. */}
      {certificate ? (
        <div className="rounded-md border border-border/40 p-4">
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <IconFileCertificate className="h-4 w-4" />
              Certificado ativo
            </span>
            {status && <Badge variant={status.variant}>{status.label}</Badge>}
          </div>
          <DetailRow label="Titular" value={certificate.subjectCommonName} />
          <DetailRow label="CNPJ/CPF do titular" value={certificate.holderDocument ? maskCNPJ(certificate.holderDocument) : null} />
          <DetailRow label="Emissor" value={certificate.issuer} />
          <DetailRow label="Número de série" value={certificate.serialNumber ? <span className="font-mono text-xs">{certificate.serialNumber}</span> : null} />
          <DetailRow
            label="Validade"
            value={
              certificate.notBefore || certificate.notAfter
                ? `${certificate.notBefore ? formatDate(certificate.notBefore) : "—"} até ${certificate.notAfter ? formatDate(certificate.notAfter) : "—"}`
                : null
            }
          />
          {!readOnly && (
            <div className="mt-3 flex justify-end">
              <Button variant="outline" size="sm" onClick={() => setRevokeTarget(certificate)} disabled={revokeMutation.isPending}>
                <IconTrash className="mr-2 h-4 w-4" />
                Revogar certificado
              </Button>
            </div>
          )}
        </div>
      ) : (
        <div className="rounded-md border border-dashed border-border/60 p-4 text-sm text-muted-foreground">
          Nenhum certificado ativo. Sem certificado A1 válido, a NFS-e deste aerografista não pode ser assinada nem emitida.
        </div>
      )}

      {/* Envio de um novo certificado (substitui o ativo). */}
      {!readOnly && (
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleUpload)} className="space-y-3">
            <div className="space-y-1.5">
              <span className="text-sm font-medium text-foreground">Arquivo do certificado</span>
              <div className="flex items-center gap-2">
                <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()} disabled={isUploading}>
                  <IconUpload className="mr-2 h-4 w-4" />
                  Selecionar arquivo
                </Button>
                <span className="truncate text-sm text-muted-foreground">{selectedFile ? selectedFile.name : "Nenhum arquivo selecionado"}</span>
              </div>
              <p className="text-xs text-muted-foreground">Formatos .pfx ou .p12, até 512 KB.</p>
              <input ref={fileInputRef} type="file" accept={ACCEPTED_CERTIFICATE} className="hidden" onChange={handleFilePick} />
            </div>

            <FormInput<CertificateFormValues>
              name="password"
              type="password"
              label="Senha do certificado"
              required
              placeholder="Senha do arquivo .pfx/.p12"
              description="A senha é armazenada cifrada e nunca é exibida novamente. Para trocá-la, reenvie o certificado."
              disabled={isUploading}
            />

            <div className="flex justify-end">
              <Button type="submit" disabled={isUploading || !selectedFile}>
                {isUploading ? <IconLoader2 className="mr-2 h-4 w-4 animate-spin" /> : <IconUpload className="mr-2 h-4 w-4" />}
                Enviar certificado
              </Button>
            </div>
          </form>
        </Form>
      )}

      <AlertDialog open={!!revokeTarget} onOpenChange={(open) => !open && setRevokeTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revogar certificado</AlertDialogTitle>
            <AlertDialogDescription>
              Revogar o certificado interrompe a emissão de NFS-e deste aerografista até que um novo seja enviado. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleRevoke} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Revogar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );

  if (embedded) return <div className={className}>{body}</div>;

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <IconCertificate className="h-5 w-5" />
          Certificado Digital A1
        </CardTitle>
      </CardHeader>
      <CardContent>{body}</CardContent>
    </Card>
  );
}
