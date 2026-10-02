/**
 * "ASSINADO FORA DO SISTEMA" (DD11).
 *
 * Quando o cliente assina o orçamento no papel, no sistema dele ou por e-mail, a
 * Ankaa registra a PROVA (PDF ou imagem) e a nota de como foi. O eixo da
 * assinatura vai a "Assinada fora do sistema" e a cobrança passa a poder ser
 * aprovada — sem coleta eletrônica.
 *
 * Só aparece quando faz sentido, que é o que a API aceita
 * (`POST /budgets/:id/offline-signature`): valor aprovado, nenhuma coleta em
 * andamento ou concluída, e a assinatura ainda não resolvida (não emitida,
 * recusada, vencida ou invalidada).
 */
import { useState } from "react";
import { IconFileCheck } from "@tabler/icons-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { BUDGET_SIGNATURE_STATUS, SECTOR_PRIVILEGES, TASK_QUOTE_STATUS } from "@/constants/enums";
import { useRegisterOfflineSignature } from "@/hooks/production/use-budget";

/** De onde a API aceita o registro (`OFFLINE_SIGNATURE_FROM` em `budget.service.ts`). */
const OFFLINE_SIGNATURE_FROM = new Set<string>([
  BUDGET_SIGNATURE_STATUS.NOT_ISSUED,
  BUDGET_SIGNATURE_STATUS.REFUSED,
  BUDGET_SIGNATURE_STATUS.EXPIRED,
  BUDGET_SIGNATURE_STATUS.INVALIDATED,
]);

const CAN_REGISTER = new Set<string>([SECTOR_PRIVILEGES.ADMIN, SECTOR_PRIVILEGES.COMMERCIAL]);

const MIN_NOTE_LENGTH = 3;

/** O mesmo desenho do `Input` do repo, que não cobre `file` nem `date`. */
const NATIVE_INPUT_CLASS =
  "flex h-10 w-full rounded-md border border-border bg-transparent px-2 py-2 text-sm file:mr-3 file:border-0 file:bg-transparent file:text-sm file:font-medium focus:outline-none disabled:cursor-not-allowed disabled:opacity-50";

/** Quando o cartão aparece — a mesma conta da API, para não oferecer um 400. */
export function canRegisterOfflineSignature(args: {
  status?: string | null;
  signatureStatus?: string | null;
  hasLiveEnvelope: boolean;
  userRole?: string;
}): boolean {
  return (
    args.status === TASK_QUOTE_STATUS.APPROVED &&
    OFFLINE_SIGNATURE_FROM.has(args.signatureStatus || BUDGET_SIGNATURE_STATUS.NOT_ISSUED) &&
    !args.hasLiveEnvelope &&
    CAN_REGISTER.has(args.userRole ?? "")
  );
}

interface OfflineSignatureCardProps {
  budgetId?: string | null;
  status?: string | null;
  signatureStatus?: string | null;
  /** Há coleta em andamento ou concluída (a API recusa por cima dela). */
  hasLiveEnvelope: boolean;
  userRole?: string;
  disabled?: boolean;
}

export function OfflineSignatureCard({
  budgetId,
  status,
  signatureStatus,
  hasLiveEnvelope,
  userRole,
  disabled,
}: OfflineSignatureCardProps) {
  const register = useRegisterOfflineSignature();
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [note, setNote] = useState("");
  const [signedAt, setSignedAt] = useState("");

  if (!budgetId || !canRegisterOfflineSignature({ status, signatureStatus, hasLiveEnvelope, userRole })) return null;

  const today = new Date().toISOString().slice(0, 10);
  const canConfirm = !!file && note.trim().length >= MIN_NOTE_LENGTH && !register.isPending;

  const reset = () => {
    setFile(null);
    setNote("");
    setSignedAt("");
  };

  const confirm = () => {
    if (!file) return;
    void register
      .mutateAsync({
        id: budgetId,
        file,
        note: note.trim(),
        // Meio-dia de SP, para a data escolhida não virar o dia anterior em UTC.
        signedAt: signedAt ? new Date(`${signedAt}T12:00:00-03:00`).toISOString() : null,
      })
      .then(() => {
        setOpen(false);
        reset();
      })
      .catch(() => undefined);
  };

  return (
    <Card className="mb-4 border border-border">
      <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-sm font-semibold">
            <IconFileCheck className="h-4 w-4 text-muted-foreground" />
            Assinado fora do sistema?
          </p>
          <p className="text-sm text-muted-foreground">
            Se o cliente assinou no papel, no sistema dele ou por e-mail, registre a prova. A assinatura fica resolvida e a
            cobrança pode ser aprovada.
          </p>
        </div>
        <Button type="button" variant="outline" className="shrink-0" disabled={disabled} onClick={() => setOpen(true)}>
          Registrar assinatura
        </Button>
      </CardContent>

      <Dialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) reset();
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assinado fora do sistema</DialogTitle>
            <DialogDescription>
              Anexe o documento assinado (PDF ou imagem) e diga como foi — quem assinou, por onde e quando.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="offline-signature-file">Documento assinado</Label>
              <input
                className={NATIVE_INPUT_CLASS}
                id="offline-signature-file"
                type="file"
                accept="application/pdf,image/*"
                onChange={(event) => setFile(event.target.files?.[0] ?? null)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="offline-signature-note">Como foi assinado</Label>
              <Textarea
                id="offline-signature-note"
                value={note}
                onChange={(event) => setNote(event.target.value)}
                placeholder='Ex.: "assinado no papel por Fulano (Compras) e devolvido por e-mail em 02/10"'
                rows={3}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="offline-signature-date">Data da assinatura (opcional)</Label>
              <input
                className={NATIVE_INPUT_CLASS}
                id="offline-signature-date"
                type="date"
                max={today}
                value={signedAt}
                onChange={(event) => setSignedAt(event.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={register.isPending}>
              Cancelar
            </Button>
            <Button type="button" onClick={confirm} disabled={!canConfirm}>
              Registrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
