import { useMemo, useState } from "react";
import { IconCash, IconLoader2 } from "@tabler/icons-react";

import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TooltipProvider } from "@/components/ui/tooltip";
import { PrivilegeRoute } from "@/components/navigation/privilege-route";
import { routes, SECTOR_PRIVILEGES } from "@/constants";
import { usePageTracker } from "@/hooks/common/use-page-tracker";
import { useLoanMasters } from "@/hooks";
import { EmployeeLoanDialog } from "@/components/human-resources/payroll/employee-loan-dialog";
import { cn } from "@/lib/utils";
import { createLoanColumns } from "./loan-table-columns";

function LoanListContent() {
  usePageTracker({ title: "Empréstimos" });
  const [showDialog, setShowDialog] = useState(false);

  const { data, isLoading, refetch } = useLoanMasters();
  const loans = Array.isArray(data) ? data : [];
  const columns = useMemo(() => createLoanColumns(), []);

  const alignClass = (align?: "left" | "center" | "right") =>
    align === "right" ? "text-right" : align === "center" ? "text-center" : "text-left";

  return (
    <TooltipProvider>
      <div className="h-full flex flex-col gap-4 bg-background px-4 pt-4">
        <PageHeader
          variant="list"
          title="Empréstimos"
          breadcrumbs={[{ label: "Início", href: "/" }, { label: "Departamento Pessoal", href: routes.personnelDepartment.root }, { label: "Empréstimos" }]}
          actions={[
            {
              key: "register",
              label: "Registrar Empréstimo",
              icon: IconCash,
              onClick: () => setShowDialog(true),
              variant: "default" as const,
            },
          ]}
          className="flex-shrink-0"
        />

        <div className="flex-1 min-h-0 pb-6 flex flex-col">
          <Card className="flex flex-col shadow-sm border border-border h-full">
            <CardContent className="flex-1 flex flex-col p-4 overflow-hidden">
              <div className="flex-1 min-h-0 overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {columns.map((col) => (
                        <TableHead key={col.key} className={cn(alignClass(col.align), col.className)}>
                          {col.header}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoading ? (
                      <TableRow>
                        <TableCell colSpan={columns.length} className="h-32 text-center">
                          <IconLoader2 className="h-5 w-5 animate-spin inline-block text-muted-foreground" />
                        </TableCell>
                      </TableRow>
                    ) : !loans || loans.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={columns.length} className="h-32 text-center text-muted-foreground">
                          Nenhum empréstimo registrado.
                        </TableCell>
                      </TableRow>
                    ) : (
                      loans.map((loan) => (
                        <TableRow key={loan.id}>
                          {columns.map((col) => (
                            <TableCell key={col.key} className={cn("py-2", alignClass(col.align), col.className)}>
                              {col.accessor(loan)}
                            </TableCell>
                          ))}
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>

        <EmployeeLoanDialog
          open={showDialog}
          onOpenChange={setShowDialog}
          onSaved={() => {
            void refetch();
          }}
        />
      </div>
    </TooltipProvider>
  );
}

export const LoanListPage = () => {
  return (
    <PrivilegeRoute requiredPrivilege={[SECTOR_PRIVILEGES.ACCOUNTING, SECTOR_PRIVILEGES.HUMAN_RESOURCES, SECTOR_PRIVILEGES.ADMIN]}>
      <LoanListContent />
    </PrivilegeRoute>
  );
};

export default LoanListPage;
