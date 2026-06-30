import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  IconUsers,
  IconPlus,
  IconSparkles,
  IconEye,
  IconEdit,
  IconGitMerge,
  IconUserCheck,
  IconUserX,
  IconTrash,
} from "@tabler/icons-react";
import { DataTablePage } from "@/components/ui/datatable";
import type { DataTableRowAction, DataTableRowClickMeta, DataTableFilterValues } from "@/components/ui/datatable";
import { Combobox } from "@/components/ui/combobox";
import { Label } from "@/components/ui/label";
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
import { useAuth } from "@/hooks/common/use-auth";
import { useUsersInfinite, useUserMutations, useUserBatchMutations } from "@/hooks";
import { canEditUsers, canDeleteUsers, shouldShowInteractiveElements } from "@/utils/permissions/entity-permissions";
import { mergeUsers } from "@/api-client";
import {
  routes,
  FAVORITE_PAGES,
  SECTOR_PRIVILEGES,
  CONTRACT_TYPE,
  CONTRACT_STATUS,
} from "@/constants";
import type { User } from "@/types";
import { useNavBreadcrumbs } from "@/contexts/navigation-context";
import { ThirteenthGenerateDialog } from "@/components/personnel-department/thirteenth/list/thirteenth-generate-dialog";
import { UserMergeDialog } from "../merge/user-merge-dialog";
import { createUserColumns, USER_TABLE_SECTOR_DEFAULTS } from "./user-table-columns";
import { buildUserFilterDefs } from "./user-table-filters";

// Trimmed include — only what the columns render (position/sector/ledSector names, ppe sizes, the
// current contract for status + the date columns, the most-recent admission's document checklist for
// the DOCUMENTOS progress, and the created-tasks count badge).
const LIST_INCLUDE = {
  position: true,
  sector: true,
  ledSector: true,
  ppeSize: true,
  currentContract: true,
  admissions: { include: { documents: true }, orderBy: { createdAt: "desc" } },
  _count: { select: { createdTasks: true } },
} as const;

// "Exibir" scope drives the server fetch (which subset to load); everything else (search, filters,
// sort, pagination) runs client-side over the loaded set.
type ExibirScope = "active" | "dismissed" | "all";
const EXIBIR_OPTIONS = [
  { value: "active", label: "Ativos" },
  { value: "dismissed", label: "Desligados" },
  { value: "all", label: "Todos" },
];

type DialogState = { items: User[] } | null;

export function UserTablePage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { delete: deleteUser, updateAsync } = useUserMutations();
  const { batchDelete, batchUpdateAsync } = useUserBatchMutations();

  const privileges = user?.sector?.privileges;
  const isAdmin = privileges === SECTOR_PRIVILEGES.ADMIN;
  const canGenerateThirteenth =
    privileges === SECTOR_PRIVILEGES.ADMIN ||
    privileges === SECTOR_PRIVILEGES.HUMAN_RESOURCES ||
    privileges === SECTOR_PRIVILEGES.ACCOUNTING;
  const canEdit = canEditUsers(user ?? null);
  const canDelete = canDeleteUsers(user ?? null);
  const showInteractive = shouldShowInteractiveElements(user ?? null, "user");

  // --- data: load the selected "Exibir" subset (client-mode table over the loaded rows) ---
  const [exibir, setExibir] = useState<ExibirScope>("active");
  // The table runs client-side, but it still reports its active filters via onParamsChange. We watch
  // them so the SERVER fetch scope can widen when a filter targets rows the current "Exibir" subset
  // never loaded (otherwise the filter matches nothing).
  const [activeFilters, setActiveFilters] = useState<DataTableFilterValues>({});
  const onParamsChange = useCallback(
    (next: { search: string; filters: DataTableFilterValues }) => setActiveFilters(next.filters),
    [],
  );
  // A "Data de Demissão" range, or an explicit TERMINATED status filter, targets dismissed
  // collaborators — not loaded under Exibir=Ativos. Widen the fetch to include them (the legacy list
  // auto-switched the scope to "Desligados" in this case).
  const needsTerminated =
    activeFilters.dismissedAt != null ||
    (Array.isArray(activeFilters.currentContractStatus) &&
      (activeFilters.currentContractStatus as string[]).includes(CONTRACT_STATUS.TERMINATED));
  const statuses =
    exibir === "active"
      ? needsTerminated
        ? undefined // load every status so the dismissed-targeting filter has rows to match
        : [CONTRACT_STATUS.ACTIVE]
      : exibir === "dismissed"
        ? [CONTRACT_STATUS.TERMINATED]
        : undefined;

  const queryParams = useMemo(
    () => ({
      ...(statuses ? { statuses } : {}),
      include: LIST_INCLUDE,
      limit: 100,
      orderBy: { name: "asc" },
    }),
    [statuses],
  );

  // The API caps a page at 100, so we page through the whole selected "Exibir" scope (a bounded
  // roster) and let the DataTable filter/sort/search/paginate client-side over the full set.
  const { data, isLoading, hasNextPage, fetchNextPage, isFetchingNextPage } = useUsersInfinite(queryParams as never);
  useEffect(() => {
    if (hasNextPage && !isFetchingNextPage) void fetchNextPage();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);
  const users = useMemo(
    () => (data as { pages?: Array<{ data?: User[] }> } | undefined)?.pages?.flatMap((p) => p?.data ?? []) ?? [],
    [data],
  );
  const loading = isLoading || !!hasNextPage;

  const columns = useMemo(() => createUserColumns(), []);
  const filterDefs = useMemo(() => buildUserFilterDefs(users), [users]);

  // --- row → detail navigation (hands over the current filtered+sorted order for prev/next) ---
  const onRowClick = useCallback(
    (row: User, meta: DataTableRowClickMeta) => {
      navigate(routes.administration.collaborators.details(row.id), { state: { ids: meta.orderedIds } });
    },
    [navigate],
  );

  // --- page-level dialogs (faithful to the legacy confirm flows) ---
  const [deleteDialog, setDeleteDialog] = useState<DialogState>(null);
  const [dismissDialog, setDismissDialog] = useState<DialogState>(null);
  const [contractDialog, setContractDialog] = useState<DialogState>(null);
  const [mergeDialog, setMergeDialog] = useState<{ open: boolean; users: User[] }>({ open: false, users: [] });
  const [generateOpen, setGenerateOpen] = useState(false);

  const { mutate: mergeMutation } = useMutation({
    mutationFn: (params: { targetUserId: string; sourceUserIds: string[]; conflictResolutions?: Record<string, unknown> }) =>
      mergeUsers(params as never),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["users"] }),
  });

  const confirmDelete = useCallback(async () => {
    if (!deleteDialog) return;
    try {
      const ids = deleteDialog.items.map((u) => u.id);
      if (ids.length === 1) await deleteUser(ids[0]);
      else await batchDelete({ userIds: ids });
    } catch {
      // The api client already surfaced the error notification.
    } finally {
      setDeleteDialog(null);
    }
  }, [deleteDialog, deleteUser, batchDelete]);

  const confirmContract = useCallback(async () => {
    if (!contractDialog) return;
    try {
      // Efetivação (CLT art. 451): convert the bond to prazo indeterminado + flip status to ACTIVE.
      const payload = {
        contractType: CONTRACT_TYPE.INDETERMINATE,
        contractStatus: CONTRACT_STATUS.ACTIVE,
        effectedAt: new Date(),
      };
      await batchUpdateAsync({ users: contractDialog.items.map((u) => ({ id: u.id, data: payload })) });
    } catch {
      // handled by the api client.
    } finally {
      setContractDialog(null);
    }
  }, [contractDialog, batchUpdateAsync]);

  const confirmDismiss = useCallback(async () => {
    if (!dismissDialog) return;
    try {
      const items = dismissDialog.items;
      const payload = { contractStatus: CONTRACT_STATUS.TERMINATED, terminationDate: new Date() };
      if (items.length === 1) {
        // Single dismiss — surface the Secullum sync outcome (Demissão set on the funcionário).
        const res = (await updateAsync({ id: items[0].id, data: payload })) as {
          secullumSync?: { status: "synced" | "skipped" | "error"; reason?: string; funcionarioId?: number };
        };
        const sync = res?.secullumSync;
        if (sync?.status === "synced") {
          toast.success(`Demissão sincronizada com Secullum (Funcionário #${sync.funcionarioId ?? "?"})`);
        } else if (sync?.status === "skipped") {
          toast.warning(`Sincronização Secullum ignorada: ${sync.reason ?? "motivo desconhecido"}`);
        } else if (sync?.status === "error") {
          toast.error(`Falha ao sincronizar com Secullum: ${sync.reason ?? "erro desconhecido"}`);
        }
      } else {
        await batchUpdateAsync({ users: items.map((u) => ({ id: u.id, data: payload })) });
      }
    } catch {
      // handled by the api client.
    } finally {
      setDismissDialog(null);
    }
  }, [dismissDialog, updateAsync, batchUpdateAsync]);

  const handleMergeConfirm = useCallback(
    async (targetId: string, resolutions: Record<string, unknown>) => {
      const sourceIds = mergeDialog.users.map((u) => u.id).filter((id) => id !== targetId);
      mergeMutation({ targetUserId: targetId, sourceUserIds: sourceIds, conflictResolutions: resolutions });
      setMergeDialog({ open: false, users: [] });
    },
    [mergeMutation, mergeDialog.users],
  );

  // --- context-menu (right-click) actions — bulk-aware (rows = single row or whole selection) ---
  const rowActions = useMemo<DataTableRowAction<User>[]>(() => {
    const inExperience = (u: User) =>
      u.currentContractType === CONTRACT_TYPE.EXPERIENCE_PERIOD_1 ||
      u.currentContractType === CONTRACT_TYPE.EXPERIENCE_PERIOD_2;
    const isActiveBond = (u: User) => u.currentContractStatus === CONTRACT_STATUS.ACTIVE;

    const actions: DataTableRowAction<User>[] = [
      {
        key: "details",
        label: "Ver Detalhes",
        icon: <IconEye className="h-4 w-4" />,
        hidden: (rows) => rows.length !== 1,
        onClick: (rows) => rows[0] && navigate(routes.administration.collaborators.details(rows[0].id)),
      },
    ];

    if (canEdit) {
      actions.push({
        key: "edit",
        label: "Editar",
        icon: <IconEdit className="h-4 w-4" />,
        onClick: (rows) => {
          if (rows.length === 1) navigate(routes.administration.collaborators.edit(rows[0].id));
          else if (rows.length > 1) navigate(`${routes.administration.collaborators.batchEdit}?ids=${rows.map((r) => r.id).join(",")}`);
        },
      });
      actions.push({
        key: "merge",
        label: "Mesclar usuários",
        icon: <IconGitMerge className="h-4 w-4" />,
        hidden: (rows) => rows.length < 2,
        onClick: (rows) => setMergeDialog({ open: true, users: rows }),
      });
      actions.push({
        key: "efetivar",
        label: "Efetivar",
        icon: <IconUserCheck className="h-4 w-4" />,
        separatorBefore: true,
        hidden: (rows) => !rows.some(inExperience),
        onClick: (rows) => setContractDialog({ items: rows.filter(inExperience) }),
      });
      actions.push({
        key: "demitir",
        label: "Demitir",
        icon: <IconUserX className="h-4 w-4" />,
        hidden: (rows) => !rows.some(isActiveBond),
        onClick: (rows) => setDismissDialog({ items: rows.filter(isActiveBond) }),
      });
    }

    if (canDelete) {
      actions.push({
        key: "delete",
        label: "Deletar",
        icon: <IconTrash className="h-4 w-4" />,
        variant: "destructive",
        separatorBefore: true,
        onClick: (rows) => setDeleteDialog({ items: rows }),
      });
    }

    return actions;
  }, [canEdit, canDelete, navigate]);

  // --- header actions (Gerar 13º + Novo Colaborador) ---
  const breadcrumbs = useNavBreadcrumbs([
    { label: "Início", href: "/" },
    { label: "Administração", href: "/administracao" },
    { label: "Colaboradores" },
  ]);

  const actions = useMemo(
    () => [
      ...(canGenerateThirteenth
        ? [
            {
              key: "generate-thirteenth",
              label: "Gerar 13º do ano",
              icon: IconSparkles,
              onClick: () => setGenerateOpen(true),
              variant: "outline" as const,
            },
          ]
        : []),
      ...(isAdmin
        ? [
            {
              key: "create",
              label: "Novo Colaborador",
              icon: IconPlus,
              onClick: () => navigate(routes.administration.collaborators.create),
              variant: "default" as const,
            },
          ]
        : []),
    ],
    [canGenerateThirteenth, isAdmin, navigate],
  );

  // "Exibir" scope lives inside the Filtros drawer (not the toolbar). It drives the server fetch
  // scope; it updates immediately (refetching) rather than staging behind "Aplicar".
  const exibirControl = (
    <div className="space-y-2">
      <Label className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
        <IconEye className="h-4 w-4" />
        Exibir
      </Label>
      <Combobox
        mode="single"
        options={EXIBIR_OPTIONS}
        value={exibir}
        onValueChange={(value) => setExibir((typeof value === "string" ? value : "active") as ExibirScope)}
        placeholder="Exibir"
        searchable={false}
        clearable={false}
      />
    </div>
  );

  return (
    <>
      <DataTablePage<User>
        title="Colaboradores"
        icon={IconUsers}
        favoritePage={FAVORITE_PAGES.ADMINISTRACAO_COLABORADORES_LISTAR}
        breadcrumbs={breadcrumbs}
        actions={actions}
        table={{
          tableId: "user-collaborators-list",
          data: users,
          columns,
          filterDefs,
          rowActions,
          getRowId: (u) => u.id,
          onRowClick,
          onParamsChange,
          isLoading: loading,
          enableSelection: showInteractive,
          sectorDefaults: USER_TABLE_SECTOR_DEFAULTS,
          defaultSorting: [{ id: "name", desc: false }],
          filterContent: exibirControl,
          searchPlaceholder: "Buscar: nome, email, CPF ou nº folha...",
          exportTitle: "Colaboradores",
          exportFilename: "colaboradores",
          emptyMessage: "Nenhum colaborador encontrado. Ajuste os filtros ou cadastre um novo colaborador.",
        }}
      />

      {/* 13º bulk generation (no dedicated 13º page anymore). */}
      <ThirteenthGenerateDialog open={generateOpen} onOpenChange={setGenerateOpen} />

      {/* Merge */}
      <UserMergeDialog
        open={mergeDialog.open}
        onOpenChange={(open) => setMergeDialog((s) => ({ ...s, open }))}
        users={mergeDialog.users}
        onMerge={handleMergeConfirm}
      />

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteDialog} onOpenChange={(open) => !open && setDeleteDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteDialog && deleteDialog.items.length > 1
                ? `Tem certeza que deseja deletar ${deleteDialog.items.length} usuários? Esta ação não pode ser desfeita.`
                : `Tem certeza que deseja deletar o usuário "${deleteDialog?.items[0]?.name}"? Esta ação não pode ser desfeita.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Deletar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Efetivar confirmation */}
      <AlertDialog open={!!contractDialog} onOpenChange={(open) => !open && setContractDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar contratação</AlertDialogTitle>
            <AlertDialogDescription>
              {contractDialog && contractDialog.items.length > 1
                ? `Tem certeza que deseja marcar ${contractDialog.items.length} usuários como contratados?`
                : `Tem certeza que deseja marcar o usuário "${contractDialog?.items[0]?.name}" como contratado?`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmContract}>Confirmar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Demitir confirmation */}
      <AlertDialog open={!!dismissDialog} onOpenChange={(open) => !open && setDismissDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar desligamento</AlertDialogTitle>
            <AlertDialogDescription>
              {dismissDialog && dismissDialog.items.length > 1
                ? `Tem certeza que deseja marcar ${dismissDialog.items.length} usuários como desligados?`
                : `Tem certeza que deseja marcar o usuário "${dismissDialog?.items[0]?.name}" como desligado?`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDismiss}>Confirmar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
