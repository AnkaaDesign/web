import { useMemo, useState } from "react";
import { IconFlask, IconChevronDown, IconChevronUp, IconCheck, IconLoader2, IconPlus } from "@tabler/icons-react";

import { SECTOR_PRIVILEGES } from "../../../../constants";
import { useAuth } from "@/contexts/auth-context";
import { useFispqs, useFispqMutations, useUploadFispqDocument } from "@/hooks/occupational-health/use-fispq";
import type { FispqCreateFormData, FispqUpdateFormData } from "@/schemas/fispq";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";
import { FispqForm } from "@/components/occupational-health/fispq/form";

const EDIT_PRIVILEGES = [SECTOR_PRIVILEGES.WAREHOUSE, SECTOR_PRIVILEGES.ACCOUNTING, SECTOR_PRIVILEGES.HUMAN_RESOURCES, SECTOR_PRIVILEGES.ADMIN];

interface FispqItemCardProps {
  itemId: string;
}

/**
 * Item-form FISPQ card (authoring path 1). The FISPQ is a separate entity edited
 * by itemId via use-fispq — create-on-first-save. Non-breaking: if the item has
 * no Fispq yet, the card offers to create one. Edit controls are gated to
 * [WAREHOUSE, ACCOUNTING, HUMAN_RESOURCES, ADMIN]; read-only otherwise.
 */
export function FispqItemCard({ itemId }: FispqItemCardProps) {
  const { user } = useAuth();
  const canEdit = EDIT_PRIVILEGES.includes(user?.sector?.privileges as SECTOR_PRIVILEGES);

  const [open, setOpen] = useState(false);

  const { data: response, isLoading } = useFispqs({
    where: { itemId },
    include: { pdfFile: true },
    limit: 1,
  });

  const fispq = useMemo(() => response?.data?.[0], [response?.data]);

  const { createAsync, createMutation, updateAsync, updateMutation } = useFispqMutations();
  const uploadDocument = useUploadFispqDocument();

  const isSaving = createMutation.isPending || updateMutation.isPending;

  const handleCreate = async (data: FispqCreateFormData) => {
    await createAsync({ ...data, itemId });
  };

  const handleUpdate = async (data: FispqUpdateFormData) => {
    if (!fispq) return;
    await updateAsync({ id: fispq.id, data });
  };

  const handleUploadPdf = async (file: globalThis.File) => {
    if (!fispq) return;
    await uploadDocument.mutateAsync({ id: fispq.id, file, include: { pdfFile: true } });
  };

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
                <CardDescription>Ficha de dados de segurança (FDS) do produto químico.</CardDescription>
              </div>
              {open ? <IconChevronUp className="h-5 w-5 text-muted-foreground" /> : <IconChevronDown className="h-5 w-5 text-muted-foreground" />}
            </div>
          </CardHeader>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <CardContent className="space-y-4">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <IconLoader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : !canEdit && !fispq ? (
              <p className="text-sm text-muted-foreground">Nenhuma FISPQ cadastrada para este item.</p>
            ) : fispq ? (
              <>
                <FispqForm
                  mode="update"
                  fispq={fispq}
                  formId={formId}
                  disabled={!canEdit}
                  onSubmit={handleUpdate}
                  onUploadPdf={canEdit ? handleUploadPdf : undefined}
                  isUploadingPdf={uploadDocument.isPending}
                  isSubmitting={isSaving}
                />
                {canEdit && (
                  <div className="flex justify-end">
                    <Button type="button" onClick={() => document.getElementById(`${formId}-submit`)?.click()} disabled={isSaving}>
                      {isSaving ? <IconLoader2 className="h-4 w-4 mr-2 animate-spin" /> : <IconCheck className="h-4 w-4 mr-2" />}
                      Salvar FISPQ
                    </Button>
                  </div>
                )}
              </>
            ) : (
              // No Fispq yet + editor: offer to create one.
              <>
                <FispqForm mode="create" itemId={itemId} formId={formId} onSubmit={handleCreate} isSubmitting={isSaving} />
                <div className="flex justify-end">
                  <Button type="button" onClick={() => document.getElementById(`${formId}-submit`)?.click()} disabled={isSaving}>
                    {isSaving ? <IconLoader2 className="h-4 w-4 mr-2 animate-spin" /> : <IconPlus className="h-4 w-4 mr-2" />}
                    Criar FISPQ
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
