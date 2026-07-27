// =====================================================
// Attention system — manual "Enviar aviso" (send a warning)
// =====================================================
//
// A globally-mounted modal (via SendWarningProvider) that lets a user push an
// attention warning to specific colleagues, on top of the automatic rules. It is
// opened from a table row's right-click action and from a detail-page field's
// icon (see `useSendWarning`). Recipients receive it in real time over the
// attention socket and their row/detail/field blinks + bips.

import { createContext, useContext, useMemo, useState } from "react";

import { apiClient } from "@/api-client/axiosClient";
import { getUsers } from "@/api-client";
import { useAuth } from "@/contexts/auth-context";
import { CONTRACT_STATUS, SECTOR_PRIVILEGES } from "@/constants";
import { canAccessAnyPrivilege } from "@/utils/privilege";
import { toast } from "@/components/ui/sonner";
import { Button } from "@/components/ui/button";
import { Combobox } from "@/components/ui/combobox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

import type { AttentionEntityType, AttentionTarget, AttentionTone } from "./types";

/** Only these sectors may send a manual attention warning to other users. */
const SEND_WARNING_PRIVILEGES = [SECTOR_PRIVILEGES.ADMIN, SECTOR_PRIVILEGES.COMMERCIAL] as const;

export function canSendAttentionWarning(privilege: string | undefined): boolean {
  return !!privilege && canAccessAnyPrivilege(privilege as never, SEND_WARNING_PRIVILEGES as never);
}

export interface SendWarningTarget {
  entityType: AttentionEntityType;
  entityId: string;
  target: AttentionTarget;
  /** Human label of the entity (for the dialog header). */
  entityLabel?: string;
  /** Human label of the field, when target.level === 'field'. */
  fieldLabel?: string;
  /** Field-level only: recipients are scoped to users who can see/edit this field
   * (the field's own `editablePrivilege`/`requiredPrivilege`). Omitted (row/detail
   * targets) = any active user is a valid recipient. */
  allowedPrivileges?: string[];
}

interface SendWarningApi {
  open: (target: SendWarningTarget) => void;
}

const SendWarningContext = createContext<SendWarningApi | null>(null);

/** Open the send-warning modal. Safe no-op if the provider isn't mounted, or if
 * the current user's sector isn't allowed to send warnings (ADMIN/COMMERCIAL only —
 * enforced again server-side in AttentionService.sendWarning). */
export function useSendWarning(): SendWarningApi {
  const { user } = useAuth();
  const api = useContext(SendWarningContext);
  const allowed = canSendAttentionWarning(user?.sector?.privileges);
  return allowed && api ? api : { open: () => {} };
}

export function SendWarningProvider({ children }: { children: React.ReactNode }) {
  const [target, setTarget] = useState<SendWarningTarget | null>(null);
  const api = useMemo<SendWarningApi>(() => ({ open: setTarget }), []);

  return (
    <SendWarningContext.Provider value={api}>
      {children}
      {target ? <SendWarningDialog target={target} onClose={() => setTarget(null)} /> : null}
    </SendWarningContext.Provider>
  );
}

function SendWarningDialog({ target, onClose }: { target: SendWarningTarget; onClose: () => void }) {
  const { user } = useAuth();
  const [recipientIds, setRecipientIds] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const [tone, setTone] = useState<AttentionTone>("soft");
  const [sending, setSending] = useState(false);

  const send = async () => {
    if (recipientIds.length === 0) {
      toast.error("Selecione ao menos um destinatário");
      return;
    }
    setSending(true);
    try {
      // `fromUserName` is deliberately NOT sent — the server resolves the sender's name
      // from the authenticated user, so a warning can't be attributed to someone else.
      const res = await apiClient.post("/attention/warnings", {
        entityType: target.entityType,
        entityId: target.entityId,
        target: target.target,
        recipientUserIds: recipientIds,
        message: message.trim() || undefined,
        tone,
      });

      // A pushed warning is ephemeral: an offline recipient's socket room is empty and
      // the emit is dropped. Report what actually landed instead of claiming success for
      // everyone — the sender needs to know to follow up another way.
      const payload = (res as { data?: { delivered?: number; offline?: number } })?.data ?? (res as { delivered?: number; offline?: number });
      const delivered = payload?.delivered ?? recipientIds.length;
      const offline = payload?.offline ?? 0;

      if (offline > 0 && delivered === 0) {
        toast.warning(
          `Ninguém recebeu o aviso`,
          `${offline === 1 ? "O destinatário está" : "Os destinatários estão"} offline. O aviso não fica guardado.`,
        );
      } else if (offline > 0) {
        toast.warning(`Aviso entregue a ${delivered} de ${delivered + offline}`, `${offline} offline no momento — não receberão este aviso.`);
      } else {
        toast.success(`Aviso enviado para ${delivered} ${delivered === 1 ? "pessoa" : "pessoas"}`);
      }
      onClose();
    } catch (err) {
      // Surface the server's reason (403 "Apenas ADMIN e COMERCIAL…", validation errors)
      // instead of a generic network message.
      const detail = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error("Não foi possível enviar o aviso", detail);
    } finally {
      setSending(false);
    }
  };

  const scopeLabel =
    target.target.level === "field"
      ? `campo "${target.fieldLabel ?? target.target.field}"`
      : target.target.level === "detail"
        ? "página de detalhes"
        : "linha";

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Enviar aviso</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Piscar {scopeLabel} de <span className="font-medium text-foreground">{target.entityLabel ?? "este item"}</span> para as pessoas
            selecionadas.
          </p>

          <div className="space-y-2">
            <Label htmlFor="warning-recipients">Destinatários</Label>
            <Combobox
              mode="multiple"
              async
              value={recipientIds}
              onValueChange={(value) => setRecipientIds(value as string[])}
              queryKey={["users", "attention-warning", target.entityType, target.target.level, (target.allowedPrivileges ?? []).join(",")]}
              queryFn={async (searchTerm: string, page: number = 1) => {
                const pageSize = 50;
                const result = await getUsers({
                  take: pageSize,
                  skip: (page - 1) * pageSize,
                  ...(target.allowedPrivileges?.length ? { includeSectorPrivileges: target.allowedPrivileges } : {}),
                  where: {
                    currentContractStatus: CONTRACT_STATUS.ACTIVE,
                    id: { not: user?.id },
                    ...(searchTerm
                      ? { OR: [{ name: { contains: searchTerm, mode: "insensitive" as const } }, { email: { contains: searchTerm, mode: "insensitive" as const } }] }
                      : {}),
                  },
                  orderBy: { name: "asc" as const },
                  include: { sector: true },
                } as never);
                const usersData = (result as { data?: { id: string; name: string; sector?: { name?: string } }[] }).data ?? [];
                const total = (result as { meta?: { totalRecords?: number } }).meta?.totalRecords ?? 0;
                return {
                  data: usersData.map((u) => ({ value: u.id, label: u.sector?.name ? `${u.name} - ${u.sector.name}` : u.name })),
                  hasMore: page * pageSize < total,
                  total,
                };
              }}
              pageSize={50}
              minSearchLength={0}
              debounceMs={300}
              placeholder="Selecione os destinatários..."
              searchPlaceholder="Buscar pessoa..."
              emptyText={target.allowedPrivileges?.length ? "Nenhuma pessoa com acesso a este campo" : "Nenhuma pessoa encontrada"}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="warning-message">Mensagem (opcional)</Label>
            <Textarea
              id="warning-message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Ex.: Confirmar previsão de liberação"
              rows={2}
            />
          </div>

          <div className="space-y-2">
            <Label>Intensidade</Label>
            <div className="flex gap-2">
              {(["soft", "harsh"] as const).map((t) => (
                <Button key={t} type="button" size="sm" variant={tone === t ? "default" : "outline"} onClick={() => setTone(t)}>
                  {t === "soft" ? "Suave" : "Urgente"}
                </Button>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={sending}>
            Cancelar
          </Button>
          <Button onClick={send} disabled={sending || recipientIds.length === 0}>
            {sending ? "Enviando..." : "Enviar aviso"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
