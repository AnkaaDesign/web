// pages/administration/questionnaire/temas/list.tsx
//
// Temas list (the questionnaire equivalent of Competências). Data table.

import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { IconClipboardList } from "@tabler/icons-react";

import { routes, SECTOR_PRIVILEGES, FAVORITE_PAGES } from "@/constants";
import {
  useQuestionnaireGroups,
  useDeleteQuestionnaireGroup,
} from "@/hooks/questionnaire/use-questionnaire";
import { usePageTracker } from "@/hooks/common/use-page-tracker";
import { PrivilegeRoute } from "@/components/navigation/privilege-route";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { EntityTable, type EntityColumn, type EntitySort } from "@/components/questionnaire/admin/entity-table";
import { ConfirmDeleteDialog, buildRowActions } from "@/components/questionnaire/admin/row-actions";

/** Coluna clicada → cláusula `orderBy`. Sem escolha, a ordem do próprio tema. */
const SORT_CLAUSES: Record<string, (dir: "asc" | "desc") => any> = {
  order: (dir) => ({ order: dir }),
  name: (dir) => ({ name: dir }),
  isActive: (dir) => [{ isActive: dir }, { order: "asc" }],
};

const DEFAULT_ORDER_BY = { order: "asc" };

export const QuestionnaireTemasListPage = () => {
  usePageTracker({ title: "Temas", icon: "clipboard-list" });
  const navigate = useNavigate();
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(40);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<EntitySort>(null);

  const [pendingDelete, setPendingDelete] = useState<any>(null);
  const deleteMut = useDeleteQuestionnaireGroup();

  const { data, isLoading } = useQuestionnaireGroups({
    page: page + 1,
    limit: pageSize,
    searchingFor: search || undefined,
    orderBy: (sort ? SORT_CLAUSES[sort.key]?.(sort.direction) ?? DEFAULT_ORDER_BY : DEFAULT_ORDER_BY) as any,
    include: { _count: { select: { questions: true } } } as any,
  });

  const rows = useMemo(() => (data?.data ?? []) as any[], [data]);
  const total = data?.meta?.totalRecords ?? 0;

  const columns: EntityColumn<any>[] = [
    { key: "order", sortable: true, header: "ORDEM", align: "left", className: "w-28 min-w-[100px] max-w-[120px]", cell: (t) => <span className="text-sm text-muted-foreground">{t.order}</span> },
    { key: "name", sortable: true, header: "NOME", align: "left", className: "w-80 min-w-[280px] max-w-[360px]", cell: (t) => <span className="font-medium truncate block" title={t.name}>{t.name}</span> },
    {
      key: "description",
      header: "DESCRIÇÃO",
      align: "left",
      cell: (t) =>
        t.description ? (
          <TooltipProvider delayDuration={200}>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="block whitespace-nowrap overflow-hidden text-ellipsis text-sm text-muted-foreground">{t.description}</span>
              </TooltipTrigger>
              <TooltipContent side="top" align="start" className="max-w-md whitespace-pre-wrap">
                {t.description}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        ) : (
          <span className="text-sm text-muted-foreground/60">—</span>
        ),
    },
    { key: "questions", header: "PERGUNTAS", align: "right", className: "w-32 min-w-[120px] max-w-[140px]", cell: (t) => <Badge variant="default" className="w-10 justify-center">{t._count?.questions ?? 0}</Badge> },
    { key: "isActive", sortable: true, header: "STATUS", align: "right", className: "w-36 min-w-[130px] max-w-[150px]", cell: (t) => (t.isActive ? <Badge variant="green" className="font-normal">Ativa</Badge> : <Badge variant="gray" className="font-normal">Inativa</Badge>) },
  ];

  return (
    <PrivilegeRoute requiredPrivilege={[SECTOR_PRIVILEGES.ADMIN, SECTOR_PRIVILEGES.HUMAN_RESOURCES, SECTOR_PRIVILEGES.PRODUCTION_MANAGER]}>
      <div className="h-full flex flex-col gap-4 bg-background px-4 pt-4">
        <PageHeader
          title="Temas"
          favoritePage={FAVORITE_PAGES.ADMINISTRACAO_QUESTIONARIOS_TEMAS_LISTAR}
          icon={IconClipboardList}
          breadcrumbs={[
            { label: "Início", href: routes.home },
            { label: "Administração", href: routes.administration.root },
            { label: "Questionários", href: routes.administration.questionnaire.root },
            { label: "Temas" },
          ]}
          actions={[{ key: "new", label: "Cadastrar", href: routes.administration.questionnaire.temaCreate, variant: "default" as const }]}
          className="flex-shrink-0"
        />
        <div className="flex-1 min-h-0 pb-4">
          <EntityTable
            className="h-full"
            columns={columns}
            rows={rows}
            isLoading={isLoading}
            searchValue={search}
            searchPlaceholder="Buscar temas..."
            onSearchChange={(v) => { setSearch(v); setPage(0); }}
            sort={sort}
            onSortChange={(s) => { setSort(s); setPage(0); }}
            page={page}
            pageSize={pageSize}
            totalItems={total}
            onPageChange={setPage}
            onPageSizeChange={(s) => { setPageSize(s); setPage(0); }}
            onRowClick={(t) => navigate(routes.administration.questionnaire.temaDetail(t.id))}
            contextActions={(t) =>
              buildRowActions({
                detailHref: routes.administration.questionnaire.temaDetail(t.id),
                editHref: routes.administration.questionnaire.temaEdit(t.id),
                navigate,
                onDelete: () => setPendingDelete(t),
                deleteBlockedReason:
                  (t._count?.questions ?? 0) > 0 ? "Excluir (tem perguntas)" : null,
              })
            }
            emptyText="Nenhum tema cadastrado."
          />
        </div>
      </div>

      <ConfirmDeleteDialog
        open={!!pendingDelete}
        onOpenChange={(open) => !open && setPendingDelete(null)}
        title="Excluir tema?"
        description={
          <>
            O tema <strong>{pendingDelete?.name}</strong> deixará de aparecer no catálogo e não
            poderá ser usado por novas perguntas.
          </>
        }
        loading={deleteMut.isPending}
        onConfirm={() => {
          if (!pendingDelete) return;
          deleteMut.mutate(pendingDelete.id, { onSettled: () => setPendingDelete(null) });
        }}
      />
    </PrivilegeRoute>
  );
};

export default QuestionnaireTemasListPage;
