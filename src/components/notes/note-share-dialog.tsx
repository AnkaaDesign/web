// note-share-dialog.tsx
// Diálogo "Compartilhar" — seleciona usuários (Combobox múltiplo assíncrono) e,
// para cada um, um alternador Visualizador/Editor (canEdit). Confirma via
// `mutations.share` (PUT /notes/:id/share substitui o conjunto completo).
// Modelado a partir de message-metadata-form.tsx.

import { useEffect, useMemo, useRef, useState } from "react";
import { IconUsers } from "@tabler/icons-react";

import type { Note } from "@/types/note";
import { getUsers } from "@/api-client";
import { CONTRACT_STATUS } from "@/constants";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Combobox } from "@/components/ui/combobox";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { UserAvatarDisplay } from "@/components/ui/avatar-display";
import type { NoteMutations } from "./note-context-menu";

type UserInfo = { name: string; avatar: any };

export interface NoteShareDialogProps {
  note: Note | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mutations: NoteMutations;
}

export function NoteShareDialog({ note, open, onOpenChange, mutations }: NoteShareDialogProps) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [canEditMap, setCanEditMap] = useState<Record<string, boolean>>({});
  // Rótulos/avatares conhecidos (dos shares atuais + dos resultados de busca) para
  // exibir o nome de cada usuário selecionado sem uma consulta extra.
  const [userInfo, setUserInfo] = useState<Record<string, UserInfo>>({});
  // Chave de instância para o cache do Combobox (evita reaproveitar entre notas).
  const noteId = note?.id;

  // (Re)semeia o estado quando o diálogo abre para uma nota.
  useEffect(() => {
    if (!open || !note) return;
    const shares = note.shares ?? [];
    setSelectedIds(shares.map((s) => s.userId));
    setCanEditMap(Object.fromEntries(shares.map((s) => [s.userId, s.canEdit])));
    setUserInfo(
      Object.fromEntries(
        shares
          .filter((s) => s.user)
          .map((s) => [s.userId, { name: s.user!.name, avatar: s.user!.avatar ?? null }]),
      ),
    );
  }, [open, note]);

  const initialOptions = useMemo(
    () =>
      (note?.shares ?? [])
        .filter((s) => s.user)
        .map((s) => ({ value: s.userId, label: s.user!.name })),
    [note],
  );

  const savingRef = useRef(false);

  const handleConfirm = () => {
    if (!note || savingRef.current) return;
    savingRef.current = true;
    const shares = selectedIds.map((userId) => ({ userId, canEdit: canEditMap[userId] ?? false }));
    mutations.share.mutate(
      { id: note.id, shares },
      {
        onSettled: () => {
          savingRef.current = false;
        },
      },
    );
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <IconUsers className="h-5 w-5" />
            Compartilhar nota
          </DialogTitle>
          <DialogDescription>
            Selecione os usuários que poderão ver esta nota e defina se cada um pode editá-la.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-1">
          <div className="space-y-2">
            <Label>Usuários</Label>
            <Combobox
              mode="multiple"
              async
              value={selectedIds}
              onValueChange={(value) => setSelectedIds((value as string[]) ?? [])}
              initialOptions={initialOptions}
              queryKey={["users", "note-share", noteId ?? "none"]}
              queryFn={async (searchTerm: string, page: number = 1) => {
                const pageSize = 50;
                const result = await getUsers({
                  take: pageSize,
                  skip: (page - 1) * pageSize,
                  where: {
                    currentContractStatus: CONTRACT_STATUS.ACTIVE,
                    ...(searchTerm
                      ? {
                          OR: [
                            { name: { contains: searchTerm, mode: "insensitive" as const } },
                            { email: { contains: searchTerm, mode: "insensitive" as const } },
                          ],
                        }
                      : {}),
                  },
                  orderBy: { name: "asc" as const },
                  include: { sector: true, avatar: true },
                });

                const usersData = result.data || [];
                const total = result.meta?.totalRecords || 0;
                const hasMore = page * pageSize < total;

                // Memoriza nome/avatar para a lista de permissões abaixo.
                setUserInfo((prev) => {
                  const next = { ...prev };
                  for (const u of usersData) next[u.id] = { name: u.name, avatar: (u as any).avatar ?? null };
                  return next;
                });

                return {
                  data: usersData.map((user) => {
                    const parts = [user.name];
                    if (user.sector?.name) parts.push(user.sector.name);
                    return { value: user.id, label: parts.join(" - ") };
                  }),
                  hasMore,
                  total,
                };
              }}
              pageSize={50}
              minSearchLength={0}
              debounceMs={300}
              placeholder="Selecione os usuários..."
              searchPlaceholder="Buscar usuários..."
              emptyText="Nenhum usuário encontrado"
            />
          </div>

          {selectedIds.length > 0 && (
            <div className="space-y-2">
              <Label>Permissões</Label>
              <div className="max-h-64 space-y-1 overflow-y-auto rounded-md border border-border p-1">
                {selectedIds.map((id) => {
                  const info = userInfo[id];
                  const canEdit = canEditMap[id] ?? false;
                  return (
                    <div key={id} className="flex items-center gap-3 rounded px-2 py-1.5 hover:bg-muted/50">
                      <UserAvatarDisplay
                        avatar={info?.avatar ?? null}
                        userName={info?.name ?? "?"}
                        size="sm"
                        shape="circle"
                      />
                      <span className="flex-1 truncate text-sm">{info?.name ?? id}</span>
                      <div className="flex items-center gap-2">
                        <span className={cnEditLabel(canEdit)}>{canEdit ? "Editor" : "Visualizador"}</span>
                        <Switch
                          checked={canEdit}
                          onCheckedChange={(checked) =>
                            setCanEditMap((prev) => ({ ...prev, [id]: checked }))
                          }
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
              <p className="text-xs text-muted-foreground">
                Editores podem alterar o conteúdo, o título e a cor. Visualizadores têm acesso somente
                leitura.
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button type="button" onClick={handleConfirm} disabled={mutations.share.isPending}>
            Salvar compartilhamento
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function cnEditLabel(canEdit: boolean) {
  return canEdit
    ? "text-xs font-medium text-primary"
    : "text-xs font-medium text-muted-foreground";
}

export default NoteShareDialog;
