import { useCallback, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { IconLoader2, IconUserCheck, IconUserX } from "@tabler/icons-react";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { BatchOperationResultDialog } from "@/components/ui/batch-operation-result-dialog";
import { toast } from "@/components/ui/sonner";
import { useUserMutations, useUserBatchMutations } from "@/hooks";
import { userKeys, employmentContractKeys } from "@/hooks/common/query-keys";
import { CONTRACT_STATUS, CONTRACT_TYPE } from "@/constants";
import { formatDate } from "@/utils";
import { cn } from "@/lib/utils";
import type { UserUpdateFormData } from "@/schemas";
import type { BatchOperationResult, User } from "@/types";

interface SecullumSync {
  status: "synced" | "skipped" | "error";
  reason?: string;
  funcionarioId?: number;
}

export interface UserContractActionDialogProps {
  /** Collaborators to act on. `null` (or empty) keeps the dialog closed. */
  users: User[] | null;
  /** Called when the flow ends (confirmed or cancelled) so the caller can drop its dialog state. */
  onClose: () => void;
  /** Called after the request completes, with the ids that were sent. */
  onCompleted?: (ids: string[]) => void;
}

interface ActionConfig {
  /** Vínculo fields written on every selected collaborator. */
  payload: (stampedAt: Date) => UserUpdateFormData;
  title: string;
  icon: typeof IconUserX;
  destructive: boolean;
  verb: string;
  /** Line under the question explaining what the vínculo becomes. */
  note: (stampedAt: Date) => string;
  /** Caption under each name in the bulk result modal. */
  successNote: (stampedAt: Date) => string;
  /**
   * Whether to surface the Secullum sync outcome of the single-user path. Only the
   * dismissal writes Demissao on the funcionário, and the operator needs to know
   * whether that landed.
   */
  showSecullumSync: boolean;
}

const DISMISS: ActionConfig = {
  payload: (stampedAt) => ({ contractStatus: CONTRACT_STATUS.TERMINATED, terminationDate: stampedAt }),
  title: "Confirmar desligamento",
  icon: IconUserX,
  destructive: true,
  verb: "desligar",
  note: (stampedAt) =>
    `O vínculo passa para Desligado com a data de demissão de hoje (${formatDate(stampedAt)}) e o colaborador sai da lista de ativos. A data pode ser corrigida depois no cadastro do colaborador.`,
  successNote: (stampedAt) => `Desligado em ${formatDate(stampedAt)}`,
  showSecullumSync: true,
};

const EFFECT: ActionConfig = {
  // Efetivação (CLT art. 451): the bond becomes prazo indeterminado and the
  // experiência ends. Status stays ACTIVE (sent explicitly, as it always was).
  payload: (stampedAt) => ({
    contractType: CONTRACT_TYPE.INDETERMINATE,
    contractStatus: CONTRACT_STATUS.ACTIVE,
    effectedAt: stampedAt,
  }),
  title: "Confirmar efetivação",
  icon: IconUserCheck,
  destructive: false,
  verb: "efetivar",
  note: (stampedAt) =>
    `O vínculo passa para prazo indeterminado (efetivado) com a data de contratação de hoje (${formatDate(stampedAt)}), encerrando o período de experiência.`,
  successNote: (stampedAt) => `Efetivado em ${formatDate(stampedAt)}`,
  showSecullumSync: false,
};

/**
 * Shared confirmation + outcome report for the vínculo shortcuts (Demitir / Efetivar)
 * offered by every user table: Colaboradores, Minha Equipe, setor/cargo detail and
 * visualizadores de mensagem. One implementation so those surfaces can't drift apart.
 *
 *  - ONE user → the single-update endpoint, which toasts on its own;
 *  - MANY users → the batch endpoint. The axios interceptor deliberately suppresses
 *    notifications for `/batch` URLs ("they'll be handled by the dialog"), so without
 *    the result modal below a bulk action would land completely silently — including
 *    its per-user failures.
 *  - queries are invalidated in a `finally`, so a request that fails midway (some users
 *    already written) still leaves the tables showing server truth.
 */
function UserContractActionDialog({
  users,
  onClose,
  onCompleted,
  config,
}: UserContractActionDialogProps & { config: ActionConfig }) {
  const queryClient = useQueryClient();
  const { updateAsync } = useUserMutations();
  const { batchUpdateAsync } = useUserBatchMutations();

  const [isSubmitting, setIsSubmitting] = useState(false);
  // Kept after `users` is cleared so the result modal can still resolve names by id.
  const [submitted, setSubmitted] = useState<User[]>([]);
  const [stampedAt, setStampedAt] = useState(() => new Date());
  const [result, setResult] = useState<BatchOperationResult<User, { id: string }> | null>(null);

  const nameById = useCallback((id?: string) => submitted.find((u) => u.id === id)?.name, [submitted]);

  const confirm = useCallback(async () => {
    if (!users || users.length === 0) return;
    const items = users;
    // 13:00 local, NOT `new Date()`. terminationDate is a calendar date stored in
    // a timestamp column, and both readers slice the UTC day — the edit form
    // (`split('T')[0]`) and the Secullum bridge (`toISOString().slice(0,10)`, the
    // value written to `Demissao`). A raw stamp taken after 21:00 in São Paulo is
    // already the next day in UTC and the dismissal shows up a day late in both.
    // 13:00 is the same anchor `DateTimeInput` writes for every mode="date" field,
    // so a dismissal registered by this shortcut and one registered by the edit
    // form are byte-identical, and it keeps 8h of margin on either side of the
    // boundary (midnight local would leave only 3h).
    const now = new Date();
    now.setHours(13, 0, 0, 0);
    const payload = config.payload(now);

    setIsSubmitting(true);
    setSubmitted(items);
    setStampedAt(now);
    try {
      if (items.length === 1) {
        const res = (await updateAsync({ id: items[0].id, data: payload })) as {
          secullumSync?: SecullumSync;
        };
        const sync = config.showSecullumSync ? res?.secullumSync : undefined;
        if (sync?.status === "synced") {
          toast.success(`Demissão sincronizada com Secullum (Funcionário #${sync.funcionarioId ?? "?"})`);
        } else if (sync?.status === "skipped") {
          toast.warning(`Sincronização Secullum ignorada: ${sync.reason ?? "motivo desconhecido"}`);
        } else if (sync?.status === "error") {
          toast.error(`Falha ao sincronizar com Secullum: ${sync.reason ?? "erro desconhecido"}`);
        }
      } else {
        const res = await batchUpdateAsync({ users: items.map((u) => ({ id: u.id, data: payload })) });
        // No toast reaches the operator for /batch — the result modal is the only feedback.
        if (res?.data) setResult(res.data as BatchOperationResult<User, { id: string }>);
      }
      onCompleted?.(items.map((u) => u.id));
    } catch {
      // The api client already surfaced the error notification.
    } finally {
      // Belt-and-braces: the mutation hooks invalidate on success, but a request that
      // throws after writing part of the batch would otherwise leave stale rows.
      void queryClient.invalidateQueries({ queryKey: userKeys.all });
      void queryClient.invalidateQueries({ queryKey: employmentContractKeys.all });
      setIsSubmitting(false);
      onClose();
    }
  }, [users, config, updateAsync, batchUpdateAsync, onCompleted, onClose, queryClient]);

  const count = users?.length ?? 0;
  // Name the people affected while the list is still readable; fall back to a count.
  const names = (users ?? []).slice(0, 3).map((u) => u.name).join(", ");
  const nameSummary = count > 3 ? `${names} e mais ${count - 3}` : names;
  const Icon = config.icon;

  return (
    <>
      <AlertDialog open={!!users && count > 0} onOpenChange={(open) => !open && !isSubmitting && onClose()}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className={cn("flex items-center gap-2", config.destructive && "text-destructive")}>
              <Icon className="h-5 w-5" />
              {config.title}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {count > 1
                ? `Tem certeza que deseja ${config.verb} ${count} colaboradores (${nameSummary})?`
                : `Tem certeza que deseja ${config.verb} o colaborador "${users?.[0]?.name}"?`}
              <span className="mt-2 block">{config.note(new Date())}</span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSubmitting}>Cancelar</AlertDialogCancel>
            {/* A plain Button (not AlertDialogAction) so the dialog stays open — and shows
                progress — while the request runs, instead of closing on the first click. */}
            <Button variant={config.destructive ? "destructive" : "default"} onClick={confirm} disabled={isSubmitting}>
              {isSubmitting && <IconLoader2 className="mr-2 h-4 w-4 animate-spin" />}
              {count > 1
                ? `${config.verb[0].toUpperCase()}${config.verb.slice(1)} ${count} colaboradores`
                : `${config.verb[0].toUpperCase()}${config.verb.slice(1)}`}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk feedback — /batch responses never toast, so this is the only outcome report. */}
      <BatchOperationResultDialog<User, { id: string }>
        open={!!result}
        onOpenChange={(open) => !open && setResult(null)}
        result={result}
        operationType="update"
        entityName="colaborador"
        successItemDisplay={(user) => (
          <div className="flex-1">
            <p className="text-sm font-medium">{user.name}</p>
            <p className="text-xs text-muted-foreground">{config.successNote(stampedAt)}</p>
          </div>
        )}
        failedItemDisplay={(error) => (
          <div className="flex-1">
            {/* The API returns the update PAYLOAD as `error.data`, not the user — resolve the name by id. */}
            <p className="text-sm font-medium">{nameById(error.id ?? error.data?.id) ?? "Colaborador desconhecido"}</p>
            <p className="mt-1 text-sm text-destructive">{error.error}</p>
          </div>
        )}
      />
    </>
  );
}

/** "Demitir" — ends the current vínculo (destructive). */
export function UserDismissDialog(props: UserContractActionDialogProps) {
  return <UserContractActionDialog {...props} config={DISMISS} />;
}

/** "Efetivar" — converts the vínculo to prazo indeterminado (CLT art. 451). */
export function UserEffectDialog(props: UserContractActionDialogProps) {
  return <UserContractActionDialog {...props} config={EFFECT} />;
}
