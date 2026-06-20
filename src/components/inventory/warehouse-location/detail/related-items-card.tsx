import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { IconPackage, IconAlertCircle } from "@tabler/icons-react";
import type { Item } from "../../../../types";
import { routes } from "../../../../constants";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TableSearchInput } from "@/components/ui/table-search-input";
import { SimplePaginationAdvanced } from "@/components/ui/pagination-advanced";

interface RelatedItemsCardProps {
  items?: Item[];
  warehouseLocationId?: string;
  className?: string;
}

const DEFAULT_PAGE_SIZE = 20;

export function RelatedItemsCard({ items, warehouseLocationId, className }: RelatedItemsCardProps) {
  const navigate = useNavigate();
  const safeItems = items || [];

  const [searchText, setSearchText] = useState("");
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);

  const filteredItems = useMemo(() => {
    if (!searchText.trim()) return safeItems;
    const searchLower = searchText.toLowerCase();
    return safeItems.filter(
      (item) =>
        item.name?.toLowerCase().includes(searchLower) ||
        item.uniCode?.toLowerCase().includes(searchLower) ||
        item.category?.name?.toLowerCase().includes(searchLower),
    );
  }, [safeItems, searchText]);

  const paginatedItems = useMemo(() => {
    const start = page * pageSize;
    return filteredItems.slice(start, start + pageSize);
  }, [filteredItems, page, pageSize]);

  const totalPages = Math.ceil(filteredItems.length / pageSize);

  if (safeItems.length === 0) {
    return (
      <Card className={cn("shadow-sm border border-border w-full", className)}>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <IconPackage className="h-5 w-5 text-muted-foreground" />
              Produtos Relacionados
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="text-center py-12">
            <IconAlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">Nenhum produto associado a esta localização.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn("shadow-sm border border-border w-full", className)}>
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <IconPackage className="h-5 w-5 text-muted-foreground" />
            Produtos Relacionados
          </CardTitle>
          {warehouseLocationId && (
            <Button variant="outline" size="sm" onClick={() => navigate(routes.inventory.products.list)}>
              Ver todos os itens
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent className="pt-0 space-y-4">
        <TableSearchInput value={searchText} onChange={setSearchText} placeholder="Buscar por nome, código..." className="flex-1" />

        <div className="rounded-lg border border-border overflow-hidden">
          <Table className="w-full">
            <TableHeader className="[&_tr]:border-b-0 [&_tr]:hover:bg-muted">
              <TableRow className="bg-muted hover:bg-muted">
                <TableHead className="text-foreground font-bold uppercase text-xs px-4 py-2">Código</TableHead>
                <TableHead className="text-foreground font-bold uppercase text-xs px-4 py-2">Nome</TableHead>
                <TableHead className="text-foreground font-bold uppercase text-xs px-4 py-2">Categoria</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedItems.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-center py-12">
                    <IconAlertCircle className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                    <p className="text-muted-foreground">Nenhum item encontrado</p>
                  </TableCell>
                </TableRow>
              ) : (
                paginatedItems.map((item, index) => (
                  <TableRow
                    key={item.id}
                    className={cn("cursor-pointer transition-colors border-b border-border", index % 2 === 1 && "bg-muted/10", "hover:bg-muted/20")}
                    onClick={() => navigate(routes.inventory.products.details(item.id))}
                  >
                    <TableCell className="px-4 py-2 text-sm">{item.uniCode || "-"}</TableCell>
                    <TableCell className="px-4 py-2 font-medium">{item.name}</TableCell>
                    <TableCell className="px-4 py-2 text-sm text-muted-foreground">{item.category?.name || "-"}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        <div className="px-4 bg-muted/50 rounded-lg">
          <SimplePaginationAdvanced
            currentPage={page}
            totalPages={totalPages}
            onPageChange={setPage}
            pageSize={pageSize}
            totalItems={filteredItems.length}
            pageSizeOptions={[20, 40, 60, 100]}
            onPageSizeChange={(newSize) => {
              setPageSize(newSize);
              setPage(0);
            }}
            showPageSizeSelector={true}
            showGoToPage={true}
            showPageInfo={true}
          />
        </div>
      </CardContent>
    </Card>
  );
}
