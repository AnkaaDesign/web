// pages/administration/questionnaire/list.tsx
//
// Admin list of questionnaire campaigns — data table. Also exports the
// QuestionnaireStatusBadge reused by the details page.

import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { IconClipboardList, IconListDetails, IconPlus } from "@tabler/icons-react";

import { routes, SECTOR_PRIVILEGES } from "@/constants";
import { useQuestionnaires } from "@/hooks/questionnaire/use-questionnaire";
import { usePageTracker } from "@/hooks/common/use-page-tracker";
import { PrivilegeRoute } from "@/components/navigation/privilege-route";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import { EntityTable, type EntityColumn } from "@/components/questionnaire/admin/entity-table";
import { QuestionnaireStatusBadge } from "@/components/questionnaire/questionnaire-status-badge";

// Re-exported for backwards compatibility — some pages import it from here.
export { QuestionnaireStatusBadge };

const fmt = (d: Date | string | null | undefined) =>
  d ? new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" }) : "—";

export const QuestionnaireListPage = () => {
  usePageTracker({ title: "Questionários", icon: "clipboard-list" });
  const navigate = useNavigate();
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(40);
  const [search, setSearch] = useState("");

  const { data, isLoading } = useQuestionnaires({
    page: page + 1,
    limit: pageSize,
    searchingFor: search || undefined,
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { questions: true, entries: true } } } as any,
  });

  const rows = useMemo(() => (data?.data ?? []) as any[], [data]);
  const total = data?.meta?.totalRecords ?? 0;

  const columns: EntityColumn<any>[] = [
    {
      key: "name",
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
    { key: "periodStart", header: "INÍCIO", align: "left", className: "w-32", cell: (q) => <span className="text-sm text-muted-foreground">{fmt(q.periodStart)}</span> },
    { key: "periodEnd", header: "TÉRMINO", align: "left", className: "w-32", cell: (q) => <span className="text-sm text-muted-foreground">{fmt(q.periodEnd)}</span> },
    { key: "publico", header: "PÚBLICO", align: "left", className: "w-40", cell: (q) => <span className="text-sm text-muted-foreground">{q.targetAllUsers ? "Todos" : "Setores"}</span> },
    { key: "questions", header: "PERGUNTAS", align: "right", className: "w-32", cell: (q) => <Badge variant="default" className="w-10 justify-center">{q._count?.questions ?? 0}</Badge> },
    { key: "entries", header: "FICHAS", align: "right", className: "w-28", cell: (q) => <Badge variant="default" className="w-10 justify-center">{q._count?.entries ?? 0}</Badge> },
    { key: "status", header: "STATUS", align: "right", className: "w-36", cell: (q) => <QuestionnaireStatusBadge status={q.status} /> },
  ];

  return (
    <PrivilegeRoute requiredPrivilege={[SECTOR_PRIVILEGES.ADMIN, SECTOR_PRIVILEGES.HUMAN_RESOURCES]}>
      <div className="h-full flex flex-col gap-4 bg-background px-4 pt-4">
        <PageHeader
          title="Questionários"
          icon={IconClipboardList}
          breadcrumbs={[
            { label: "Início", href: routes.home },
            { label: "Administração" },
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
            page={page}
            pageSize={pageSize}
            totalItems={total}
            onPageChange={setPage}
            onPageSizeChange={(s) => { setPageSize(s); setPage(0); }}
            onRowClick={(q) => navigate(routes.administration.questionnaire.details(q.id))}
            emptyText="Nenhum questionário criado."
          />
        </div>
      </div>
    </PrivilegeRoute>
  );
};

export default QuestionnaireListPage;
