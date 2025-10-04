import { useState, useMemo } from "react";
import { useBorrows, useBorrowMutations } from "../../hooks";
import { useDebounce } from "@/hooks/use-debounce";
import type { Borrow } from "../../types";
import type { BorrowGetManyFormData } from "../../schemas";
import { BORROW_STATUS, BORROW_STATUS_LABELS } from "../../constants";
import { formatDateTime } from "../../utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { IconSearch, IconPackage } from "@tabler/icons-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/auth-context";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

export const MyLoansPage = () => {
  const { user } = useAuth();
  const [searchText, setSearchText] = useState("");
  const debouncedSearchText = useDebounce(searchText, 500);
  const [activeTab, setActiveTab] = useState<"active" | "returned">("active");
  const { update } = useBorrowMutations();

  // Filter params based on current user and tab
  const queryParams = useMemo<BorrowGetManyFormData>(() => {
    const params: BorrowGetManyFormData = {
      where: {
        userId: user?.id,
      },
      include: {
        item: true,
      },
      orderBy: {
        createdAt: "desc",
      },
      limit: 100, // Simple page without pagination
    };

    // Add search filter
    if (debouncedSearchText) {
      params.searchingFor = debouncedSearchText;
    }

    // Add status filter based on tab
    if (activeTab === "active") {
      params.where = {
        ...params.where,
        status: BORROW_STATUS.ACTIVE,
      };
    } else {
      params.where = {
        ...params.where,
        status: BORROW_STATUS.RETURNED,
      };
    }

    return params;
  }, [user?.id, debouncedSearchText, activeTab]);

  const { data: borrowsData, isLoading } = useBorrows(queryParams);
  const borrows = borrowsData?.data || [];

  // Handle return
  const handleReturn = async (borrow: Borrow) => {
    try {
      const now = new Date();
      await update({
        id: borrow.id,
        data: {
          returnedAt: now,
          status: BORROW_STATUS.RETURNED,
        },
      });
      toast.success(`${borrow.item?.name || "Item"} devolvido com sucesso`);
    } catch (error: any) {
      toast.error(`Erro ao devolver item: ${error.message || "Erro desconhecido"}`);
    }
  };

  // Filter borrows based on search
  const filteredBorrows = useMemo(() => {
    if (!searchText) return borrows;

    const searchLower = searchText.toLowerCase();
    return borrows.filter((borrow) => borrow.item?.name?.toLowerCase().includes(searchLower) || borrow.item?.uniCode?.toLowerCase().includes(searchLower));
  }, [borrows, searchText]);

  const getStatusBadge = (status: BORROW_STATUS) => {
    const variants: Record<BORROW_STATUS, "default" | "secondary"> = {
      [BORROW_STATUS.ACTIVE]: "default",
      [BORROW_STATUS.RETURNED]: "secondary",
      [BORROW_STATUS.LOST]: "secondary",
    };

    return <Badge variant={variants[status]}>{BORROW_STATUS_LABELS[status]}</Badge>;
  };

  if (!user) {
    return (
      <Card className="h-full flex items-center justify-center">
        <CardContent>
          <p className="text-muted-foreground">Faça login para ver seus empréstimos</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-full flex flex-col rounded-md">
      <CardHeader className="px-8 py-3 flex-shrink-0 border-b border-neutral-200 dark:border-neutral-700">
        <div className="flex items-start justify-between">
          <div className="flex flex-col gap-2">
            <CardTitle className="text-xl font-bold">Meus Empréstimos</CardTitle>
            <Breadcrumb />
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex-1 flex flex-col px-8 py-4 space-y-4 overflow-hidden">
        {/* Search bar */}
        <div className="relative">
          <IconSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input
            type="text"
            placeholder="Buscar por nome ou código do item..."
            value={searchText}
            onChange={(value) => setSearchText(typeof value === "string" ? value : "")}
            className="pl-10"
          />
        </div>

        {/* Tabs for active/returned */}
        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as "active" | "returned")}>
          <TabsList className="grid w-full max-w-[400px] grid-cols-2">
            <TabsTrigger value="active">Ativos ({borrows.filter((b) => b.status === BORROW_STATUS.ACTIVE).length})</TabsTrigger>
            <TabsTrigger value="returned">Devolvidos ({borrows.filter((b) => b.status === BORROW_STATUS.RETURNED).length})</TabsTrigger>
          </TabsList>

          <TabsContent value={activeTab} className="flex-1 min-h-0">
            <div className="rounded-md border overflow-auto h-full">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Item</TableHead>
                    <TableHead>Código</TableHead>
                    <TableHead className="text-center">Quantidade</TableHead>
                    <TableHead>Emprestado em</TableHead>
                    {activeTab === "returned" && <TableHead>Devolvido em</TableHead>}
                    <TableHead>Status</TableHead>
                    {activeTab === "active" && <TableHead className="text-right">Ações</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={activeTab === "active" ? 6 : 7} className="h-24 text-center">
                        <div className="flex items-center justify-center">
                          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : filteredBorrows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={activeTab === "active" ? 6 : 7} className="h-24 text-center text-muted-foreground">
                        {searchText ? "Nenhum empréstimo encontrado com os filtros aplicados" : `Nenhum empréstimo ${activeTab === "active" ? "ativo" : "devolvido"}`}
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredBorrows.map((borrow) => (
                      <TableRow key={borrow.id}>
                        <TableCell className="font-medium">{borrow.item?.name || "Item desconhecido"}</TableCell>
                        <TableCell>
                          <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{borrow.item?.uniCode || "-"}</code>
                        </TableCell>
                        <TableCell className="text-center">{borrow.quantity}</TableCell>
                        <TableCell>{formatDateTime(borrow.createdAt)}</TableCell>
                        {activeTab === "returned" && <TableCell>{borrow.returnedAt ? formatDateTime(borrow.returnedAt) : "-"}</TableCell>}
                        <TableCell>{getStatusBadge(borrow.status)}</TableCell>
                        {activeTab === "active" && (
                          <TableCell className="text-right">
                            <Button size="sm" variant="outline" onClick={() => handleReturn(borrow)} className="gap-2">
                              <IconPackage className="h-4 w-4" />
                              Devolver
                            </Button>
                          </TableCell>
                        )}
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};
