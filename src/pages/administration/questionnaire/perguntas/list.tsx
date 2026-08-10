// pages/administration/questionnaire/perguntas/list.tsx
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { IconClipboardList } from "@tabler/icons-react";
import {
  routes,
  SECTOR_PRIVILEGES,
  FAVORITE_PAGES,
  QUESTIONNAIRE_QUESTION_TYPE,
  QUESTIONNAIRE_QUESTION_TYPE_LABELS,
} from "@/constants";
import {
  useQuestionnaireQuestions,
  useDeleteQuestionnaireQuestion,
} from "@/hooks/questionnaire/use-questionnaire";
import { usePageTracker } from "@/hooks/common/use-page-tracker";
import { PrivilegeRoute } from "@/components/navigation/privilege-route";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { EntityTable, type EntityColumn, type EntitySort } from "@/components/questionnaire/admin/entity-table";
import { ConfirmDeleteDialog, buildRowActions } from "@/components/questionnaire/admin/row-actions";

/**
 * Coluna clicada → cláusula `orderBy` do Prisma. O tema ordena por
 * `group.name` (e não por `groupId`, que é uuid e produzia uma sequência
 * aleatória de temas — o motivo de a listagem parecer "sem ordem").
 */
const SORT_CLAUSES: Record<string, (dir: "asc" | "desc") => any> = {
  order: (dir) => [{ order: dir }],
  title: (dir) => [{ title: dir }],
  tema: (dir) => [{ group: { name: dir } }, { order: "asc" }],
  type: (dir) => [{ type: dir }, { order: "asc" }],
  isRequired: (dir) => [{ isRequired: dir }, { order: "asc" }],
  isActive: (dir) => [{ isActive: dir }, { order: "asc" }],
};

/** Sem ordenação escolhida: tema na ordem do próprio tema, depois a pergunta. */
const DEFAULT_ORDER_BY = [{ group: { order: "asc" } }, { order: "asc" }];

export const QuestionnairePerguntasListPage = () => {
  usePageTracker({ title: "Perguntas", icon: "clipboard-list" });
  const navigate = useNavigate();
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(40);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<EntitySort>(null);

  const [pendingDelete, setPendingDelete] = useState<any>(null);
  const deleteMut = useDeleteQuestionnaireQuestion();

  const orderBy = useMemo(
    () => (sort ? SORT_CLAUSES[sort.key]?.(sort.direction) ?? DEFAULT_ORDER_BY : DEFAULT_ORDER_BY),
    [sort],
  );

  const { data, isLoading } = useQuestionnaireQuestions({
    page: page + 1,
    limit: pageSize,
    searchingFor: search || undefined,
    orderBy: orderBy as any,
    // `_count.links` diz em quantas campanhas a pergunta já entrou — é o que
    // decide se "Excluir" aparece habilitado.
    include: { group: true, _count: { select: { options: true, links: true } } } as any,
  });

  const rows = useMemo(() => (data?.data ?? []) as any[], [data]);
  const total = data?.meta?.totalRecords ?? 0;

  const columns: EntityColumn<any>[] = [
    { key: "order", sortable: true, header: "ORDEM", align: "left", className: "w-28 min-w-[100px] max-w-[120px]", cell: (q) => <span className="text-sm text-muted-foreground">{q.order}</span> },
    { key: "title", sortable: true, header: "TÍTULO", align: "left", className: "w-96 min-w-[320px] max-w-[520px]", cell: (q) => <span className="font-medium truncate block" title={q.title}>{q.title}</span> },
    {
      key: "description",
      header: "DESCRIÇÃO",
      align: "left",
      cell: (q) =>
        q.description ? (
          <TooltipProvider delayDuration={200}>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="block whitespace-nowrap overflow-hidden text-ellipsis text-sm text-muted-foreground">{q.description}</span>
              </TooltipTrigger>
              <TooltipContent side="top" align="start" className="max-w-md whitespace-pre-wrap">
                {q.description}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        ) : (
          <span className="text-sm text-muted-foreground/60">—</span>
        ),
    },
    { key: "tema", sortable: true, header: "TEMA", align: "left", className: "w-80 min-w-[280px] max-w-[360px]", cell: (q) => (q.group ? <Badge variant="default" className="font-normal whitespace-nowrap">{q.group.name}</Badge> : <span className="text-sm text-muted-foreground">—</span>) },
    {
      key: "type",
      sortable: true,
      header: "TIPO",
      align: "left",
      className: "w-36 min-w-[130px] max-w-[150px]",
      cell: (q) => (
        <Badge variant="outline" className="font-normal whitespace-nowrap">
          {QUESTIONNAIRE_QUESTION_TYPE_LABELS[
            (q.type ?? QUESTIONNAIRE_QUESTION_TYPE.OPTIONS) as QUESTIONNAIRE_QUESTION_TYPE
          ]}
        </Badge>
      ),
    },
    {
      key: "isRequired",
      sortable: true,
      header: "OBRIGATÓRIA",
      align: "left",
      className: "w-36 min-w-[130px] max-w-[150px]",
      cell: (q) =>
        q.isRequired === false ? (
          <Badge variant="gray" className="font-normal">Opcional</Badge>
        ) : (
          <Badge variant="default" className="font-normal">Obrigatória</Badge>
        ),
    },
    {
      key: "options",
      header: "OPÇÕES",
      align: "right",
      className: "w-32 min-w-[120px] max-w-[140px]",
      // Texto livre não tem opções — um "0" ali leria como pergunta mal cadastrada.
      cell: (q) =>
        q.type === QUESTIONNAIRE_QUESTION_TYPE.TEXT ? (
          <span className="text-sm text-muted-foreground/60">—</span>
        ) : (
          <Badge variant="default" className="w-10 justify-center">{q._count?.options ?? 0}</Badge>
        ),
    },
    { key: "isActive", sortable: true, header: "STATUS", align: "right", className: "w-36 min-w-[130px] max-w-[150px]", cell: (q) => (q.isActive ? <Badge variant="green" className="font-normal">Ativa</Badge> : <Badge variant="gray" className="font-normal">Inativa</Badge>) },
  ];

  return (
    <PrivilegeRoute requiredPrivilege={[SECTOR_PRIVILEGES.ADMIN, SECTOR_PRIVILEGES.HUMAN_RESOURCES, SECTOR_PRIVILEGES.PRODUCTION_MANAGER]}>
      <div className="h-full flex flex-col gap-4 bg-background px-4 pt-4">
        <PageHeader
          title="Perguntas"
          favoritePage={FAVORITE_PAGES.ADMINISTRACAO_QUESTIONARIOS_PERGUNTAS_LISTAR}
          icon={IconClipboardList}
          breadcrumbs={[
            { label: "Início", href: routes.home },
            { label: "Administração", href: routes.administration.root },
            { label: "Questionários", href: routes.administration.questionnaire.root },
            { label: "Perguntas" },
          ]}
          actions={[{ key: "new", label: "Cadastrar", href: routes.administration.questionnaire.perguntaCreate, variant: "default" as const }]}
          className="flex-shrink-0"
        />
        <div className="flex-1 min-h-0 pb-4">
          <EntityTable
            className="h-full"
            columns={columns}
            rows={rows}
            isLoading={isLoading}
            searchValue={search}
            searchPlaceholder="Buscar perguntas..."
            onSearchChange={(v) => { setSearch(v); setPage(0); }}
            sort={sort}
            onSortChange={(s) => { setSort(s); setPage(0); }}
            page={page}
            pageSize={pageSize}
            totalItems={total}
            onPageChange={setPage}
            onPageSizeChange={(s) => { setPageSize(s); setPage(0); }}
            onRowClick={(q) => navigate(routes.administration.questionnaire.perguntaDetail(q.id))}
            contextActions={(q) =>
              buildRowActions({
                detailHref: routes.administration.questionnaire.perguntaDetail(q.id),
                editHref: routes.administration.questionnaire.perguntaEdit(q.id),
                navigate,
                onDelete: () => setPendingDelete(q),
                deleteBlockedReason:
                  (q._count?.links ?? 0) > 0
                    ? "Excluir (em uso por questionário)"
                    : null,
              })
            }
            emptyText="Nenhuma pergunta cadastrada."
          />
        </div>
      </div>

      <ConfirmDeleteDialog
        open={!!pendingDelete}
        onOpenChange={(open) => !open && setPendingDelete(null)}
        title="Excluir pergunta?"
        description={
          <>
            A pergunta <strong>{pendingDelete?.title}</strong> deixará de aparecer no catálogo e não
            poderá ser incluída em novos questionários.
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

export default QuestionnairePerguntasListPage;
