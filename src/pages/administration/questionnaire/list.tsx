// pages/administration/questionnaire/list.tsx
//
// Admin list of questionnaire campaigns — data table. Also exports the
// QuestionnaireStatusBadge reused by the details page.

import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { IconClipboardList, IconListDetails, IconPlus } from "@tabler/icons-react";

import {
  routes,
  SECTOR_PRIVILEGES,
  FAVORITE_PAGES,
  QUESTIONNAIRE_STATUS,
  QUESTIONNAIRE_AUDIENCE,
  QUESTIONNAIRE_AUDIENCE_SHORT_LABELS,
} from "@/constants";
import { useQuestionnaires, useDeleteQuestionnaire } from "@/hooks/questionnaire/use-questionnaire";
import { usePageTracker } from "@/hooks/common/use-page-tracker";
import { PrivilegeRoute } from "@/components/navigation/privilege-route";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import { EntityTable, type EntityColumn, type EntitySort } from "@/components/questionnaire/admin/entity-table";
import { ConfirmDeleteDialog, buildRowActions } from "@/components/questionnaire/admin/row-actions";
import { QuestionnaireStatusBadge } from "@/components/questionnaire/questionnaire-status-badge";

// Re-exported for backwards compatibility — some pages import it from here.
export { QuestionnaireStatusBadge };

const fmt = (d: Date | string | null | undefined) =>
  d ? new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" }) : "—";

/** Coluna clicada → cláusula `orderBy`. Sem escolha, a mais recente primeiro. */
const SORT_CLAUSES: Record<string, (dir: "asc" | "desc") => any> = {
  name: (dir) => ({ name: dir }),
  periodStart: (dir) => ({ periodStart: dir }),
  periodEnd: (dir) => ({ periodEnd: dir }),
  status: (dir) => ({ status: dir }),
};

const DEFAULT_ORDER_BY = { createdAt: "desc" };

export const QuestionnaireListPage = () => {
  usePageTracker({ title: "Questionários", icon: "clipboard-list" });
  const navigate = useNavigate();
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(40);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<EntitySort>(null);

  const [pendingDelete, setPendingDelete] = useState<any>(null);
  const deleteMut = useDeleteQuestionnaire();

  const { data, isLoading } = useQuestionnaires({
    page: page + 1,
    limit: pageSize,
    searchingFor: search || undefined,
    orderBy: (sort ? SORT_CLAUSES[sort.key]?.(sort.direction) ?? DEFAULT_ORDER_BY : DEFAULT_ORDER_BY) as any,
    include: { _count: { select: { questions: true, entries: true } } } as any,
  });

  const rows = useMemo(() => (data?.data ?? []) as any[], [data]);
  const total = data?.meta?.totalRecords ?? 0;

  const columns: EntityColumn<any>[] = [
    {
      key: "name",
      sortable: true,
      header: "NOME",
      align: "left",
      cell: (q) => (
        <span className="flex items-center font-medium">
          <span className="truncate" title={q.name}>{q.name}</span>
          {q.isAnonymous ? (
            <Badge variant="outline" className="ml-2 text-[10px] font-normal">Anônimo</Badge>
          ) : null}
        </span>
      ),
    },
    { key: "periodStart", sortable: true, header: "INÍCIO", align: "left", className: "w-32", cell: (q) => <span className="text-sm text-muted-foreground">{fmt(q.periodStart)}</span> },
    { key: "periodEnd", sortable: true, header: "TÉRMINO", align: "left", className: "w-32", cell: (q) => <span className="text-sm text-muted-foreground">{fmt(q.periodEnd)}</span> },
    {
      key: "publico",
      header: "PÚBLICO",
      align: "left",
      className: "w-40",
      cell: (q) => (
        <span className="text-sm text-muted-foreground">
          {QUESTIONNAIRE_AUDIENCE_SHORT_LABELS[
            (q.audience ?? QUESTIONNAIRE_AUDIENCE.ALL_USERS) as QUESTIONNAIRE_AUDIENCE
          ]}
        </span>
      ),
    },
    { key: "questions", header: "PERGUNTAS", align: "right", className: "w-32", cell: (q) => <Badge variant="default" className="w-10 justify-center">{q._count?.questions ?? 0}</Badge> },
    { key: "entries", header: "FICHAS", align: "right", className: "w-28", cell: (q) => <Badge variant="default" className="w-10 justify-center">{q._count?.entries ?? 0}</Badge> },
    { key: "status", sortable: true, header: "STATUS", align: "right", className: "w-36", cell: (q) => <QuestionnaireStatusBadge status={q.status} /> },
  ];

  return (
    <PrivilegeRoute requiredPrivilege={[SECTOR_PRIVILEGES.ADMIN, SECTOR_PRIVILEGES.HUMAN_RESOURCES, SECTOR_PRIVILEGES.PRODUCTION_MANAGER]}>
      <div className="h-full flex flex-col gap-4 bg-background px-4 pt-4">
        <PageHeader
          title="Questionários"
          favoritePage={FAVORITE_PAGES.ADMINISTRACAO_QUESTIONARIOS_LISTAR}
          icon={IconClipboardList}
          breadcrumbs={[
            { label: "Início", href: routes.home },
            { label: "Administração", href: routes.administration.root },
            { label: "Questionários" },
          ]}
          actions={[
            { key: "temas", label: "Temas", icon: IconListDetails, variant: "outline" as const, onClick: () => navigate(routes.administration.questionnaire.temas) },
            { key: "perguntas", label: "Perguntas", icon: IconListDetails, variant: "outline" as const, onClick: () => navigate(routes.administration.questionnaire.perguntas) },
            { key: "create", label: "Novo questionário", icon: IconPlus, variant: "default" as const, onClick: () => navigate(routes.administration.questionnaire.create) },
          ]}
          className="flex-shrink-0"
        />
        <div className="flex-1 min-h-0 pb-4">
          <EntityTable
            className="h-full"
            columns={columns}
            rows={rows}
            isLoading={isLoading}
            searchValue={search}
            searchPlaceholder="Buscar questionários..."
            onSearchChange={(v) => { setSearch(v); setPage(0); }}
            sort={sort}
            onSortChange={(s) => { setSort(s); setPage(0); }}
            page={page}
            pageSize={pageSize}
            totalItems={total}
            onPageChange={setPage}
            onPageSizeChange={(s) => { setPageSize(s); setPage(0); }}
            onRowClick={(q) => navigate(routes.administration.questionnaire.details(q.id))}
            contextActions={(q) =>
              buildRowActions({
                detailHref: routes.administration.questionnaire.details(q.id),
                navigate,
                onDelete: () => setPendingDelete(q),
                // A API só apaga campanha CANCELADA — cancelar é feito na tela
                // de detalhe, onde ficam as ações de ciclo de vida.
                deleteBlockedReason:
                  q.status === QUESTIONNAIRE_STATUS.CANCELLED
                    ? null
                    : "Excluir (cancele o questionário antes)",
              })
            }
            emptyText="Nenhum questionário criado."
          />
        </div>
      </div>

      <ConfirmDeleteDialog
        open={!!pendingDelete}
        onOpenChange={(open) => !open && setPendingDelete(null)}
        title="Excluir questionário?"
        description={
          <>
            O questionário <strong>{pendingDelete?.name}</strong> e suas fichas sairão das listagens.
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

export default QuestionnaireListPage;
