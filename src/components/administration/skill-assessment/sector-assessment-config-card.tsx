import { useEffect, useMemo, useState } from "react";
import { useFormContext, useWatch } from "react-hook-form";
import {
  IconAlertTriangle,
  IconCheck,
  IconTrash,
  IconUserCheck,
  IconUserPlus,
  IconUsers,
  IconX,
} from "@tabler/icons-react";

import { useSector, useUsers } from "../../../hooks";
import type { Sector, User } from "../../../types";

import { Combobox } from "@/components/ui/combobox";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { AdminUserSelector } from "@/components/administration/user/form/user-selector";

interface SectorAssessmentConfigCardProps {
  /** Form-array index for `sectors.${index}.*` paths */
  index: number;
  sectorId: string;
  disabled?: boolean;
  onRemove?: () => void;
}

/**
 * Per-sector configuration row for an assessment campaign.
 *
 * Renders the resolved appraiser (sector leader by default, with manual
 * override when missing or explicitly toggled) and the list of users who
 * will be assessed in this sector.
 *
 * Side-effects driven by `useEffect`:
 *   - Seeds `evaluateeIds` with the full sector roster on first user-fetch
 *     when the form value is still empty. Prevents the silent "nobody to
 *     assess" failure when the user picks a sector and submits.
 *   - When the appraiser changes, removes them from `evaluateeIds` to
 *     enforce the "no self-assessment" rule client-side.
 */
export function SectorAssessmentConfigCard({
  index,
  sectorId,
  disabled,
  onRemove,
}: SectorAssessmentConfigCardProps) {
  const form = useFormContext();
  const namePath = `sectors.${index}` as const;
  const appraiserPath = `${namePath}.appraiserId` as const;
  const evaluateesPath = `${namePath}.evaluateeIds` as const;

  const appraiserId = useWatch({ control: form.control, name: appraiserPath }) as
    | string
    | null
    | undefined;
  const evaluateeIds = (useWatch({ control: form.control, name: evaluateesPath }) ?? []) as string[];

  const sectorQ = useSector(sectorId, { include: { leader: true } } as any);
  const sector = (sectorQ?.data as any)?.data as
    | (Sector & { leader?: User | null })
    | undefined;

  // Use only convenience filters (sectorIds + statuses + orderBy + take), which
  // the web user schema's transform turns into a clean Prisma where clause.
  // Mixing `where.sectorId` with `statuses` produced an empty result set; the
  // backend Zod schema also caps `take` at 100.
  const usersQ = useUsers({
    sectorIds: [sectorId],
    isActive: true,
    orderBy: { name: "asc" },
    take: 100,
  } as any);
  const sectorUsers = ((usersQ?.data as any)?.data ?? []) as User[];

  const leader = sector?.leader ?? null;
  const effectiveAppraiserId = appraiserId ?? leader?.id ?? null;

  // The user can force the override selector to appear even when a sector
  // leader exists. Persisting it in component state (vs the form) keeps the
  // form payload clean: clearing the override sends `appraiserId: null`.
  const [showOverride, setShowOverride] = useState<boolean>(!!appraiserId && appraiserId !== leader?.id);

  // Seed the evaluatee list once we have users. We avoid re-seeding after the
  // user has interacted (which would clobber their manual unchecks).
  const [didSeed, setDidSeed] = useState(false);
  useEffect(() => {
    if (didSeed) return;
    if (!sectorUsers.length) return;
    if (evaluateeIds.length > 0) {
      setDidSeed(true);
      return;
    }
    const seeded = sectorUsers
      .filter(u => u.id !== effectiveAppraiserId)
      .map(u => u.id);
    form.setValue(evaluateesPath, seeded, { shouldDirty: false, shouldValidate: false });
    setDidSeed(true);
  }, [didSeed, sectorUsers, effectiveAppraiserId, evaluateeIds.length, evaluateesPath, form]);

  // Strip the appraiser out of the evaluatee list whenever the appraiser
  // changes — covers the case where the user picks an appraiser AFTER seeding,
  // or swaps the override to a user who was previously checked.
  useEffect(() => {
    if (!effectiveAppraiserId) return;
    if (!evaluateeIds.includes(effectiveAppraiserId)) return;
    form.setValue(
      evaluateesPath,
      evaluateeIds.filter(id => id !== effectiveAppraiserId),
      { shouldDirty: true, shouldValidate: false },
    );
  }, [effectiveAppraiserId, evaluateeIds, evaluateesPath, form]);

  const userOptions = useMemo(
    () =>
      sectorUsers
        .filter(u => u.id !== effectiveAppraiserId)
        .map(u => ({
          value: u.id,
          label: u.name,
          description: u.secullumEmployeeId ? undefined : "Sem vínculo Secullum",
        })),
    [sectorUsers, effectiveAppraiserId],
  );

  const isAppraiserResolved = !!effectiveAppraiserId;
  const hasEvaluatees = evaluateeIds.length > 0;
  const isReady = isAppraiserResolved && hasEvaluatees;

  const handleAppraiserChange = (next: string | string[] | null | undefined) => {
    const id = Array.isArray(next) ? next[0] : next;
    // Storing `null` (instead of the leader's id) means "use the live sector
    // leader at open-time" — preserved across leader changes on the Sector.
    form.setValue(appraiserPath, id ?? null, { shouldDirty: true, shouldValidate: true });
  };

  const sectorName = sector?.name ?? "Carregando setor…";
  const sectorLoading = !sector && sectorQ?.isLoading;

  return (
    <Card className="border-l-4" data-status={isReady ? "ready" : "incomplete"} style={{ borderLeftColor: isReady ? "rgb(34 197 94)" : "rgb(234 179 8)" }}>
      <CardContent className="p-4 space-y-4">
        {/* Header: sector name + status + remove */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            {isReady ? (
              <IconCheck className="h-5 w-5 text-green-600 shrink-0" />
            ) : (
              <IconAlertTriangle className="h-5 w-5 text-amber-500 shrink-0" />
            )}
            <span className="font-medium truncate">{sectorName}</span>
            {sectorLoading && (
              <span className="text-xs text-muted-foreground">…</span>
            )}
          </div>
          {onRemove && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onRemove}
              disabled={disabled}
              className="text-muted-foreground hover:text-destructive"
              aria-label="Remover setor"
            >
              <IconTrash className="h-4 w-4" />
            </Button>
          )}
        </div>

        {/* Appraiser row */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm font-medium">
            <IconUserCheck className="h-4 w-4 text-muted-foreground" />
            Avaliador
          </div>

          {!showOverride && leader ? (
            <div className="flex items-center justify-between rounded-md bg-muted/40 px-3 py-2">
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="bg-muted text-muted-foreground hover:bg-muted">
                  Líder do setor
                </Badge>
                <span className="text-sm">{leader.name}</span>
              </div>
              <Button
                type="button"
                variant="link"
                size="sm"
                onClick={() => setShowOverride(true)}
                disabled={disabled}
                className="h-auto p-0"
              >
                Trocar avaliador
              </Button>
            </div>
          ) : (
            <div className="space-y-1">
              {!leader && !showOverride && (
                <div className="flex items-center gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:bg-amber-950/30 dark:text-amber-200 dark:border-amber-800">
                  <IconAlertTriangle className="h-4 w-4 shrink-0" />
                  <span>Este setor não possui líder. Escolha um avaliador para a campanha.</span>
                </div>
              )}
              <div className="flex items-center gap-2">
                <div className="flex-1">
                  <AdminUserSelector
                    control={form.control}
                    name={appraiserPath}
                    label=""
                    placeholder={leader ? "Escolha um avaliador alternativo" : "Selecione um avaliador"}
                    disabled={disabled}
                  />
                </div>
                {leader && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setShowOverride(false);
                      handleAppraiserChange(null);
                    }}
                    disabled={disabled}
                    aria-label="Voltar ao líder do setor"
                  >
                    <IconX className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Evaluatees row */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-medium">
              <IconUsers className="h-4 w-4 text-muted-foreground" />
              Avaliados
              <Badge variant="outline" className="font-normal">
                {evaluateeIds.length}
                {sectorUsers.length ? ` / ${userOptions.length}` : ""}
              </Badge>
            </div>
            {sectorUsers.length > 0 && (
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-auto py-1 text-xs"
                  onClick={() =>
                    form.setValue(
                      evaluateesPath,
                      userOptions.map(o => o.value),
                      { shouldDirty: true, shouldValidate: true },
                    )
                  }
                  disabled={disabled}
                >
                  <IconUserPlus className="h-3.5 w-3.5 mr-1" />
                  Todos
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-auto py-1 text-xs text-muted-foreground"
                  onClick={() =>
                    form.setValue(evaluateesPath, [], {
                      shouldDirty: true,
                      shouldValidate: true,
                    })
                  }
                  disabled={disabled}
                >
                  Limpar
                </Button>
              </div>
            )}
          </div>

          <Combobox
            mode="multiple"
            value={evaluateeIds}
            onValueChange={next => {
              const ids = Array.isArray(next) ? next : next ? [next] : [];
              form.setValue(evaluateesPath, ids, {
                shouldDirty: true,
                shouldValidate: true,
              });
            }}
            options={userOptions}
            placeholder={
              sectorUsers.length
                ? "Selecione os colaboradores"
                : usersQ?.isLoading
                  ? "Carregando colaboradores…"
                  : "Nenhum colaborador ativo neste setor"
            }
            emptyText="Nenhum colaborador encontrado"
            disabled={disabled || !sectorUsers.length}
            searchable
            showCount
          />

          {!hasEvaluatees && sectorUsers.length > 0 && (
            <p className="text-xs text-amber-700 dark:text-amber-300">
              Selecione ao menos um colaborador para abrir a campanha.
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
