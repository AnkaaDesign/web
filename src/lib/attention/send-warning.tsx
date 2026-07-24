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
import { useAuth } from "@/contexts/auth-context";
import { useUsers } from "@/hooks/personnel-department/use-user";
import { toast } from "@/components/ui/sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

import type { AttentionEntityType, AttentionTarget, AttentionTone } from "./types";

export interface SendWarningTarget {
  entityType: AttentionEntityType;
  entityId: string;
  target: AttentionTarget;
  /** Human label of the entity (for the dialog header). */
  entityLabel?: string;
  /** Human label of the field, when target.level === 'field'. */
  fieldLabel?: string;
}

interface SendWarningApi {
  open: (target: SendWarningTarget) => void;
}

const SendWarningContext = createContext<SendWarningApi | null>(null);

/** Open the send-warning modal. Safe no-op if the provider isn't mounted. */
export function useSendWarning(): SendWarningApi {
  return useContext(SendWarningContext) ?? { open: () => {} };
}

interface UserLite {
  id: string;
  name: string;
  sector?: { name?: string } | null;
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
  const { data: usersData, isLoading } = useUsers({ orderBy: { name: "asc" } } as never);
  const users = ((usersData as { data?: UserLite[] } | undefined)?.data ?? []).filter((u) => u.id !== user?.id);

  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [message, setMessage] = useState("");
  const [tone, setTone] = useState<AttentionTone>("soft");
  const [sending, setSending] = useState(false);

  const filtered = users.filter((u) => u.name.toLowerCase().includes(search.toLowerCase()));

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const send = async () => {
    if (selected.size === 0) {
      toast.error("Selecione ao menos um destinatário");
      return;
    }
    setSending(true);
    try {
      await apiClient.post("/attention/warnings", {
        entityType: target.entityType,
        entityId: target.entityId,
        target: target.target,
        recipientUserIds: [...selected],
        message: message.trim() || undefined,
        tone,
        fromUserName: user?.name,
      });
      toast.success(`Aviso enviado para ${selected.size} ${selected.size === 1 ? "pessoa" : "pessoas"}`);
      onClose();
    } catch {
      toast.error("Não foi possível enviar o aviso");
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
            <Label>Destinatários {selected.size > 0 ? <Badge variant="secondary">{selected.size}</Badge> : null}</Label>
            <Input placeholder="Buscar pessoa..." value={search} onChange={(v) => setSearch(String(v ?? ""))} />
            <ScrollArea className="h-48 rounded-md border">
              <div className="p-1">
                {isLoading ? (
                  <div className="p-3 text-sm text-muted-foreground">Carregando...</div>
                ) : filtered.length === 0 ? (
                  <div className="p-3 text-sm text-muted-foreground">Nenhuma pessoa encontrada.</div>
                ) : (
                  filtered.map((u) => (
                    <button
                      key={u.id}
                      type="button"
                      onClick={() => toggle(u.id)}
                      className={cn(
                        "flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-muted",
                        selected.has(u.id) && "bg-muted",
                      )}
                    >
                      <Checkbox checked={selected.has(u.id)} className="pointer-events-none" />
                      <span className="flex-1 truncate">{u.name}</span>
                      {u.sector?.name ? <span className="truncate text-xs text-muted-foreground">{u.sector.name}</span> : null}
                    </button>
                  ))
                )}
              </div>
            </ScrollArea>
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
          <Button onClick={send} disabled={sending || selected.size === 0}>
            {sending ? "Enviando..." : "Enviar aviso"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
