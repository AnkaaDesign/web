import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { IconPlus, IconSparkles } from "@tabler/icons-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TableSearchInput } from "@/components/ui/table-search-input";
import { SimplePaginationAdvanced } from "@/components/ui/pagination-advanced";
import { PrivilegeRoute } from "@/components/navigation/privilege-route";
import { cn } from "@/lib/utils";
import { routes, SECTOR_PRIVILEGES, THIRTEENTH_STATUS, THIRTEENTH_STATUS_LABELS } from "../../../constants";
import { usePageTracker } from "@/hooks/common/use-page-tracker";
import { useTableState } from "@/hooks/common/use-table-state";
import { useThirteenths } from "../../../hooks/personnel-department/use-thirteenths";
import { ThirteenthGenerateDialog } from "@/components/personnel-department/thirteenth/list";
import { formatCurrency } from "../../../utils";
import type { Thirteenth } from "../../../types/thirteenth";

const DEFAULT_PAGE_SIZE = 40;

const statusVariant = (status: THIRTEENTH_STATUS): "delivered" | "pending" | "secondary" | "outline" => {
  switch (status) {
    case THIRTEENTH_STATUS.PAID:
      return "delivered";
    case THIRTEENTH_STATUS.FIRST_PAID:
    case THIRTEENTH_STATUS.SECOND_PAID:
      return "secondary";
    case THIRTEENTH_STATUS.CANCELLED:
      return "outline";
    default:
      return "pending";
  }
};

const ThirteenthListPage = () => {
  usePageTracker({ title: "13º Salário", icon: "gift" });
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [generateOpen, setGenerateOpen] = useState(false);

  const { page, pageSize, setPage, setPageSize } = useTableState({
    defaultPageSize: DEFAULT_PAGE_SIZE,
    resetSelectionOnPageChange: false,
  });

  const queryParams = useMemo(
    () => ({
      page: page + 1,
      limit: pageSize,
      include: { user: true },
      orderBy: [{ year: "desc" as const }, { statusOrder: "asc" as const }],
      ...(search.trim() ? { searchingFor: search.trim() } : {}),
    }),
    [page, pageSize, search],
  );

  const { data: response, isLoading } = useThirteenths(queryParams);
  const records = (response?.data ?? []) as Thirteenth[];
  const totalRecords = response?.meta?.totalRecords ?? 0;
  const totalPages = Math.ceil(totalRecords / pageSize);

  return (
    <PrivilegeRoute requiredPrivilege={[SECTOR_PRIVILEGES.ACCOUNTING, SECTOR_PRIVILEGES.HUMAN_RESOURCES, SECTOR_PRIVILEGES.ADMIN]}>
      <div className="h-full flex flex-col gap-4 bg-background px-4 pt-4">
        <PageHeader
          variant="list"
          title="13º Salário"
          breadcrumbs={[{ label: "Início", href: "/" }, { label: "Departamento Pessoal" }, { label: "13º Salário" }]}
          actions={[
            {
              key: "generate",
              label: "Gerar 13º",
              icon: IconSparkles,
              onClick: () => setGenerateOpen(true),
              variant: "outline" as const,
            },
            {
              key: "create",
              label: "Novo 13º",
              icon: IconPlus,
              onClick: () => navigate(routes.personnelDepartment.thirteenth.create),
              variant: "default" as const,
            },
          ]}
          className="flex-shrink-0"
        />

        <div className="flex-1 min-h-0 pb-6 flex flex-col">
          <Card className="flex flex-col shadow-sm border border-border h-full">
            <CardContent className="flex-1 flex flex-col p-4 space-y-4 overflow-hidden">
              <TableSearchInput value={search} onChange={(value) => setSearch(value)} placeholder="Buscar por colaborador" />

              <div className="flex-1 min-h-0 overflow-auto rounded-lg border border-border">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted hover:bg-muted">
                      <TableHead className="whitespace-nowrap text-foreground font-bold uppercase text-xs">Colaborador</TableHead>
                      <TableHead className="whitespace-nowrap text-foreground font-bold uppercase text-xs">Ano</TableHead>
                      <TableHead className="whitespace-nowrap text-foreground font-bold uppercase text-xs">Avos</TableHead>
                      <TableHead className="whitespace-nowrap text-foreground font-bold uppercase text-xs text-right">1ª parcela</TableHead>
                      <TableHead className="whitespace-nowrap text-foreground font-bold uppercase text-xs text-right">2ª parcela</TableHead>
                      <TableHead className="whitespace-nowrap text-foreground font-bold uppercase text-xs">Situação</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoading ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-8">
                          Carregando...
                        </TableCell>
                      </TableRow>
                    ) : records.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-8">
                          Nenhum registro de 13º. Use "Gerar 13º" para gerar o ano ou "Novo 13º" para um registro avulso.
                        </TableCell>
                      </TableRow>
                    ) : (
                      records.map((t) => (
                        <TableRow
                          key={t.id}
                          className="cursor-pointer hover:bg-muted/40"
                          onClick={() => navigate(routes.personnelDepartment.thirteenth.details(t.id))}
                        >
                          <TableCell className="text-sm font-medium">{t.user?.name ?? "-"}</TableCell>
                          <TableCell className="text-sm">{t.year}</TableCell>
                          <TableCell className="text-sm">{t.avos}/12</TableCell>
                          <TableCell className="text-sm text-right tabular-nums">{t.firstInstallment != null ? formatCurrency(t.firstInstallment) : "-"}</TableCell>
                          <TableCell className="text-sm text-right tabular-nums">{t.secondInstallment != null ? formatCurrency(t.secondInstallment) : "-"}</TableCell>
                          <TableCell>
                            <Badge variant={statusVariant(t.status)} className="text-xs">
                              {THIRTEENTH_STATUS_LABELS[t.status] ?? t.status}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>

              <div className={cn("flex-shrink-0", totalPages <= 1 && "hidden")}>
                <SimplePaginationAdvanced
                  currentPage={page}
                  totalPages={totalPages}
                  onPageChange={setPage}
                  pageSize={pageSize}
                  totalItems={totalRecords}
                  onPageSizeChange={setPageSize}
                  showPageSizeSelector
                  showGoToPage
                  showPageInfo
                />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <ThirteenthGenerateDialog open={generateOpen} onOpenChange={setGenerateOpen} />
    </PrivilegeRoute>
  );
};

export default ThirteenthListPage;
