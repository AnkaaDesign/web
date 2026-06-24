import {
  IconSignature,
  IconFingerprint,
  IconShieldX,
  IconClock,
  IconCertificate,
  IconUser,
} from "@tabler/icons-react";

import type { Warning, WarningSignature } from "../../../../types";
import { formatDate, formatDateTime } from "../../../../utils";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface SignaturesCardProps {
  warning: Warning;
  className?: string;
}

// Mirrors the inline map used by the PPE delivery signature card.
const BIOMETRIC_LABELS: Record<string, string> = {
  FINGERPRINT: "Impressão Digital",
  FACE_ID: "Reconhecimento Facial",
  IRIS: "Reconhecimento de Íris",
  DEVICE_PIN: "PIN do Dispositivo",
  NONE: "Sem Biometria",
};

function roleLabel(role: string): string {
  return role === "COLLABORATOR" ? "Colaborador" : "Testemunha";
}

function roleVariant(role: string) {
  // COLLABORATOR → blue/active; WITNESS → secondary.
  return role === "COLLABORATOR" ? ("active" as const) : ("secondary" as const);
}

function SignatureRow({ signature }: { signature: WarningSignature }) {
  const signerName = signature.signedByUser?.name ?? "—";
  const verificationCode = signature.hmacSignature ? signature.hmacSignature.substring(0, 16).toUpperCase() : null;

  return (
    <div className="border rounded-lg p-3 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <IconUser className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          <span className="text-sm font-medium truncate">{signerName}</span>
        </div>
        <Badge variant={roleVariant(signature.signerRole)}>{roleLabel(signature.signerRole)}</Badge>
      </div>

      {signature.refused ? (
        <div className="rounded-md bg-destructive/10 border border-destructive/20 p-2 space-y-1">
          <div className="flex items-center gap-1.5 text-destructive">
            <IconShieldX className="h-4 w-4 flex-shrink-0" />
            <span className="text-xs font-medium">Recusou-se a assinar</span>
          </div>
          <p className="text-xs text-muted-foreground">
            O colaborador tomou ciência e recusou-se a assinar, na presença das testemunhas, em{" "}
            {formatDate(signature.serverTimestamp)}.
          </p>
          {signature.refusedReason && (
            <p className="text-xs text-muted-foreground">
              <span className="font-medium">Motivo:</span> {signature.refusedReason}
            </p>
          )}
          {signature.registeredBy?.name && (
            <p className="text-xs text-muted-foreground">Registrado por {signature.registeredBy.name}</p>
          )}
        </div>
      ) : (
        <div className="space-y-1.5">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <IconClock className="h-3.5 w-3.5 flex-shrink-0" />
            <span>{formatDateTime(signature.serverTimestamp)}</span>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <IconFingerprint className="h-3.5 w-3.5 flex-shrink-0" />
            <span>{BIOMETRIC_LABELS[signature.biometricMethod] || signature.biometricMethod}</span>
          </div>
          {verificationCode && (
            <div className="flex items-center gap-1.5 text-xs">
              <span className="text-muted-foreground">Código de verificação:</span>
              <span className="font-mono font-medium tracking-wide">{verificationCode}</span>
            </div>
          )}
          {signature.padesSealed && (
            <div className="flex items-center gap-1.5 text-xs text-green-600 dark:text-green-500">
              <IconCertificate className="h-3.5 w-3.5 flex-shrink-0" />
              <span>
                Selado digitalmente (PAdES)
                {signature.padesSealedAt ? ` em ${formatDateTime(signature.padesSealedAt)}` : ""}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function SignaturesCard({ warning, className }: SignaturesCardProps) {
  const signatures = (warning.signatures as WarningSignature[]) ?? [];
  const witnesses = (warning.witness as any[]) ?? [];

  // Witnesses configured on the warning that do not yet have a signature recorded.
  const signedUserIds = new Set(signatures.map((s) => s.signedByUserId));
  const pendingWitnesses = witnesses.filter((w: any) => !signedUserIds.has(w.id));

  if (signatures.length === 0 && pendingWitnesses.length === 0) {
    return null;
  }

  return (
    <Card className={cn("shadow-sm border border-border", className)}>
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <IconSignature className="h-5 w-5 text-muted-foreground" />
            Assinaturas
          </div>
          {signatures.length > 0 && (
            <Badge variant="secondary">
              {signatures.length} assinatura{signatures.length !== 1 ? "s" : ""}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0 space-y-3">
        {signatures.map((signature) => (
          <SignatureRow key={signature.id} signature={signature} />
        ))}

        {pendingWitnesses.map((w: any) => (
          <div key={w.id} className="border border-dashed rounded-lg p-3 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <IconUser className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              <span className="text-sm truncate">{w.name}</span>
              <Badge variant="secondary">Testemunha</Badge>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground flex-shrink-0">
              <IconClock className="h-3.5 w-3.5" />
              <span>Aguardando assinatura</span>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
