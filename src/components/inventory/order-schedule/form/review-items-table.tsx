import { useMemo } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { IconLoader2 } from "@tabler/icons-react";
import { useItems } from "../../../../hooks";
import { createItemColumns } from "../../item/list/item-table-columns";
import type { Item } from "../../../../types";

interface ReviewItemsTableProps {
  itemIds: string[];
}

// Same identity columns the order-schedule DETAIL table shows (minus the
// schedule-projection columns, which don't exist until the schedule runs).
const REVIEW_COLUMN_KEYS = ["uniCode", "name", "brand.name", "category.name", "measures", "quantity"];

/**
 * Read-only table of the items selected for an order schedule, shown on the
 * review step. Renders the SAME `createItemColumns` cells as the detail page's
 * "Itens do Agendamento" table (consistent código/nome/marca/categoria/medidas/qnt
 * rendering), inside the order form's clean single-table chrome. Mounted only on
 * the review step, so the fetch is scoped to it.
 */
export function ReviewItemsTable({ itemIds }: ReviewItemsTableProps) {
  const columns = useMemo(() => {
    const all = createItemColumns();
    return REVIEW_COLUMN_KEYS.map((key) => all.find((c) => c.key === key)).filter((c): c is (typeof all)[number] => Boolean(c));
  }, []);

  const { data, isLoading } = useItems({
    where: { id: { in: itemIds } },
    include: { brands: true, category: true, measures: true },
    orderBy: { name: "asc" },
    page: 1,
    limit: Math.max(itemIds.length, 1),
  });

  const items = (data?.data ?? []) as Item[];

  if (itemIds.length === 0) {
    return <p className="text-sm text-muted-foreground bg-muted/50 rounded-lg px-4 py-3">Nenhum item selecionado.</p>;
  }

  return (
    <div className="rounded-md border border-border overflow-hidden w-full">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50">
            {columns.map((c) => (
              <TableHead key={c.key} className={cn("font-semibold", c.align === "right" && "text-right", c.align === "center" && "text-center")}>
                {c.header}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            <TableRow>
              <TableCell colSpan={columns.length} className="text-center py-6 text-muted-foreground">
                <IconLoader2 className="h-4 w-4 animate-spin inline mr-2" />
                Carregando itens...
              </TableCell>
            </TableRow>
          ) : items.length === 0 ? (
            <TableRow>
              <TableCell colSpan={columns.length} className="text-center py-6 text-muted-foreground">
                Itens não encontrados.
              </TableCell>
            </TableRow>
          ) : (
            items.map((item, index) => (
              <TableRow key={item.id} className={cn("transition-colors", index % 2 === 1 && "bg-muted/10")}>
                {columns.map((c) => (
                  <TableCell key={c.key} className={cn(c.align === "right" && "text-right", c.align === "center" && "text-center")}>
                    {c.accessor(item)}
                  </TableCell>
                ))}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
