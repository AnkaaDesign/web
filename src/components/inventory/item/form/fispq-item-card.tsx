import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { IconFlask, IconChevronDown, IconChevronUp, IconLoader2 } from "@tabler/icons-react";

import { SECTOR_PRIVILEGES } from "../../../../constants";
import { useAuth } from "@/contexts/auth-context";
import { useFispqs, useFispqMutations, useUploadFispqDocument } from "@/hooks/occupational-health/use-fispq";
import type { FispqCreateFormData, FispqUpdateFormData } from "@/schemas/fispq";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/components/ui/sonner";
import { FispqForm, type FispqFormSubmitFn } from "@/components/occupational-health/fispq/form";

const EDIT_PRIVILEGES = [SECTOR_PRIVILEGES.WAREHOUSE, SECTOR_PRIVILEGES.ACCOUNTING, SECTOR_PRIVILEGES.HUMAN_RESOURCES, SECTOR_PRIVILEGES.ADMIN];

/** Saves the FISPQ against an item id the host only knows after the item itself is saved. */
export type FispqCardSaveFn = (itemId: string) => Promise<void>;

interface FispqItemCardProps {
  /** Existing item (update mode). Absent while the item is still being created. */
  itemId?: string;
  /** Receives the imperative save (and `null` on unmount) so the item form can persist this card. */
  registerSave?: (save: FispqCardSaveFn | null) => void;
  /** Reports this card's dirty state so the item form can enable its own save button. */
  onDirtyChange?: (isDirty: boolean) => void;
}

/**
 * Item-form FISPQ card (authoring path 1). The FISPQ is a separate entity, but it
 * has no save button of its own: it is created/updated by the item form's own
 * "Cadastrar" / "Salvar Alterações" action, linked to the item that action saved.
 * Edit controls are gated to [WAREHOUSE, ACCOUNTING, HUMAN_RESOURCES, ADMIN];
 * read-only otherwise.
 */
export function FispqItemCard({ itemId, registerSave, onDirtyChange }: FispqItemCardProps) {
  const { user } = useAuth();
  const canEdit = EDIT_PRIVILEGES.includes(user?.sector?.privileges as SECTOR_PRIVILEGES);

  const [open, setOpen] = useState(false);

  const { data: response, isLoading } = useFispqs(
    {
      where: { itemId },
      include: { pdfFile: true },
      limit: 1,
    },
    { enabled: !!itemId },
  );

  const fispq = useMemo(() => response?.data?.[0], [response?.data]);

  const { createAsync, createMutation, updateAsync, updateMutation } = useFispqMutations();
  const uploadDocument = useUploadFispqDocument();

  const isSaving = createMutation.isPending || updateMutation.isPending;

  const handleCreate = async (data: FispqCreateFormData) => {
    await createAsync({ ...data, itemId: data.itemId || (itemId as string) });
  };

  const handleUpdate = async (data: FispqUpdateFormData) => {
    if (!fispq) return;
    await updateAsync({ id: fispq.id, data });
  };

  const handleUploadPdf = async (file: globalThis.File) => {
    if (!fispq) return;
    await uploadDocument.mutateAsync({ id: fispq.id, file, include: { pdfFile: true } });
  };

  // Bridge the nested form's imperative save up to the item form.
  const submitRef = useRef<FispqFormSubmitFn | null>(null);
  const registerSubmit = useCallback((submit: FispqFormSubmitFn | null) => {
    submitRef.current = submit;
  }, []);

  useEffect(() => {
    if (!registerSave) return;
    registerSave(async (savedItemId: string) => {
      const submit = submitRef.current;
      if (!submit) return;
      const saved = await submit({ itemId: savedItemId });
      // Blocked by validation — the card is collapsed by default, so point at it.
      if (!saved) {
        setOpen(true);
        toast.error("A FISPQ não foi salva. Verifique os campos destacados.");
      }
    });
    return () => registerSave(null);
  }, [registerSave]);

  const formId = "item-fispq-form";

  return (
    <Card>
      <Collapsible open={open} onOpenChange={setOpen}>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <IconFlask className="h-5 w-5 text-muted-foreground" />
                  FISPQ / Segurança Química
                  {fispq ? (
                    <Badge variant="secondary" className="text-xs">
                      Cadastrada
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-xs">
                      Não cadastrada
                    </Badge>
                  )}
                </CardTitle>
                <CardDescription>Ficha de dados de segurança (FDS) do produto químico. Salva junto com o item.</CardDescription>
              </div>
              {open ? <IconChevronUp className="h-5 w-5 text-muted-foreground" /> : <IconChevronDown className="h-5 w-5 text-muted-foreground" />}
            </div>
          </CardHeader>
        </CollapsibleTrigger>

        {/* forceMount: collapsing must not discard typed-but-unsaved FISPQ data,
            since this card is only persisted when the item form is submitted. */}
        <CollapsibleContent forceMount>
          <CardContent className="space-y-4">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <IconLoader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : !canEdit && !fispq ? (
              <p className="text-sm text-muted-foreground">Nenhuma FISPQ cadastrada para este item.</p>
            ) : fispq ? (
              <FispqForm
                mode="update"
                fispq={fispq}
                formId={formId}
                disabled={!canEdit}
                onSubmit={handleUpdate}
                onUploadPdf={canEdit ? handleUploadPdf : undefined}
                isUploadingPdf={uploadDocument.isPending}
                isSubmitting={isSaving}
                registerSubmit={canEdit ? registerSubmit : undefined}
                onDirtyChange={canEdit ? onDirtyChange : undefined}
                showItemContext={false}
              />
            ) : (
              // No Fispq yet + editor: filling anything here creates one on item save.
              <FispqForm
                mode="create"
                itemId={itemId ?? ""}
                formId={formId}
                onSubmit={handleCreate}
                isSubmitting={isSaving}
                registerSubmit={registerSubmit}
                onDirtyChange={onDirtyChange}
                showItemContext={false}
              />
            )}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
