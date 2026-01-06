import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { formatNumber } from "../../../../utils";
import { MEASURE_UNIT_LABELS, MEASURE_TYPE } from "../../../../constants";
import { routes } from "../../../../constants";
import type { PaintBrand, Item } from "../../../../types";
import { IconComponents, IconWeight, IconDroplet, IconPackage, IconChevronLeft, IconChevronRight, IconSearch } from "@tabler/icons-react";
import { useNavigate } from "react-router-dom";
import { ColumnVisibilityManager } from "../../../inventory/item/list/column-visibility-manager";

interface PaintBrandComponentsCardProps {
  paintBrand: PaintBrand;
}

// Define columns for the components table
const createComponentColumns = () => [
  {
    key: "uniCode",
    header: "CÓDIGO",
    accessor: (item: Item) => <div className="text-sm truncate">{item.uniCode || "-"}</div>,
    sortable: true,
    className: "w-32",
    align: "left" as const,
  },
  {
    key: "name",
    header: "COMPONENTE",
    accessor: (item: Item) => (
      <div className="flex items-center gap-2">
        {item.uniCode && <span className="text-sm font-mono text-muted-foreground">{item.uniCode}</span>}
        <p className="font-medium truncate">{item.name}</p>
      </div>
    ),
    sortable: true,
    className: "w-64",
    align: "left" as const,
  },
  {
    key: "category.name",
    header: "CATEGORIA",
    accessor: (item: Item) => (item.category ? <Badge variant="outline">{item.category.name}</Badge> : <span className="text-muted-foreground">-</span>),
    sortable: true,
    className: "w-40",
    align: "left" as const,
  },
  {
    key: "weight",
    header: "PESO",
    accessor: (item: Item) => {
      const weightMeasure = item.measures?.find((m) => m.measureType === MEASURE_TYPE.WEIGHT);
      return weightMeasure ? (
        <div className="flex items-center gap-1 whitespace-nowrap">
          <IconWeight className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm">
            {weightMeasure.value !== null ? formatNumber(weightMeasure.value) : "-"}{" "}
            {weightMeasure.unit && MEASURE_UNIT_LABELS[weightMeasure.unit] ? MEASURE_UNIT_LABELS[weightMeasure.unit] : weightMeasure.unit || ""}
          </span>
        </div>
      ) : (
        <span className="text-muted-foreground">-</span>
      );
    },
    sortable: false,
    className: "w-32",
    align: "left" as const,
  },
  {
    key: "volume",
    header: "VOLUME",
    accessor: (item: Item) => {
      const volumeMeasure = item.measures?.find((m) => m.measureType === MEASURE_TYPE.VOLUME);
      return volumeMeasure ? (
        <div className="flex items-center gap-1 whitespace-nowrap">
          <IconDroplet className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm">
            {volumeMeasure.value !== null ? formatNumber(volumeMeasure.value) : "-"}{" "}
            {volumeMeasure.unit && MEASURE_UNIT_LABELS[volumeMeasure.unit] ? MEASURE_UNIT_LABELS[volumeMeasure.unit] : volumeMeasure.unit || ""}
          </span>
        </div>
      ) : (
        <span className="text-muted-foreground">-</span>
      );
    },
    sortable: false,
    className: "w-32",
    align: "left" as const,
  },
  {
    key: "quantity",
    header: "ESTOQUE",
    accessor: (item: Item) => {
      const hasStock = item.quantity > 0;
      return <span className={cn("font-medium", hasStock ? "text-green-600" : "text-red-600")}>{formatNumber(item.quantity)}</span>;
    },
    sortable: true,
    className: "w-28",
    align: "left" as const,
  },
];

export function PaintBrandComponentsCard({ paintBrand }: PaintBrandComponentsCardProps) {
  const navigate = useNavigate();
  const components = paintBrand.componentItems || [];
  const columns = useMemo(() => createComponentColumns(), []);

  // State for table features
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(10);
  const [visibleColumns, setVisibleColumns] = useState<Set<string>>(() => {
    // Default visible columns for components
    return new Set(["name", "category.name", "weight", "volume", "quantity"]);
  });

  // Filter components based on search
  const filteredComponents = useMemo(() => {
    if (!searchQuery) return components;
    const query = searchQuery.toLowerCase();
    return components.filter(
      (item) =>
        item.name?.toLowerCase().includes(query) ||
        item.uniCode?.toLowerCase().includes(query) ||
        item.category?.name?.toLowerCase().includes(query),
    );
  }, [components, searchQuery]);

  // Pagination
  const totalPages = Math.ceil(filteredComponents.length / pageSize);
  const paginatedComponents = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return filteredComponents.slice(startIndex, startIndex + pageSize);
  }, [filteredComponents, currentPage, pageSize]);

  // Reset to page 1 when search changes
  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    setCurrentPage(1);
  };

  // Get visible columns
  const visibleColumnsArray = columns.filter((col) => visibleColumns.has(col.key));

  if (components.length === 0) {
    return (
      <Card className="h-full flex flex-col shadow-sm border border-border">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
          <IconComponents className="h-5 w-5 text-muted-foreground" />
          Componentes
        </CardTitle>
            <Button variant="outline" size="sm" onClick={() => navigate(`${routes.inventory.products.list}?brands=${paintBrand.id}`)}>
              Ver todos os itens
            </Button>
          </div>
        </CardHeader>
        <CardContent className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <IconPackage className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">Nenhum componente configurado para esta marca.</p>
            <p className="text-sm text-muted-foreground mt-2">Configure os componentes editando a marca.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-full flex flex-col shadow-sm border border-border">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
          <IconComponents className="h-5 w-5 text-muted-foreground" />
          Componentes
        </CardTitle>
          <Button variant="outline" size="sm" onClick={() => navigate(`${routes.inventory.products.list}?brands=${paintBrand.id}`)}>
            Ver todos os itens
          </Button>
        </div>
      </CardHeader>
      <CardContent className="flex-1 min-h-0 pt-0 flex flex-col">
        {/* Search and Column Visibility Controls */}
        <div className="flex items-center gap-2 mb-4">
          <div className="relative flex-1">
            <IconSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input type="text" placeholder="Buscar componentes..." value={searchQuery} onChange={(value) => handleSearchChange(String(value || ""))} className="pl-9" />
          </div>
          <ColumnVisibilityManager columns={columns} visibleColumns={visibleColumns} onVisibilityChange={setVisibleColumns} />
        </div>

        {/* Table Container with min/max height */}
        <div className="rounded-md border border-border/50 flex-1 flex flex-col bg-muted/30 min-h-[400px] max-h-[600px]">
          <div className="overflow-auto flex-1">
            <Table className="w-full [&>div]:border-0 [&>div]:rounded-none">
              <TableHeader className="[&_tr]:border-b-0 [&_tr]:hover:bg-muted sticky top-0 z-10">
                <TableRow className="bg-muted hover:bg-muted even:bg-muted">
                  {visibleColumnsArray.map((column) => (
                    <TableHead key={column.key} className={cn("whitespace-nowrap text-foreground font-bold uppercase text-xs p-0 bg-muted !border-r-0", column.className)}>
                      <div className="flex items-center px-4 py-3">{column.header}</div>
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedComponents.length > 0 ? (
                  paginatedComponents.map((item) => (
                    <TableRow key={item.id} className="cursor-pointer hover:bg-muted/50" onClick={() => navigate(`/estoque/produtos/detalhes/${item.id}`)}>
                      {visibleColumnsArray.map((column) => (
                        <TableCell key={column.key} className={column.className}>
                          {column.accessor(item)}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={visibleColumnsArray.length} className="h-24 text-center">
                      <div className="text-muted-foreground">Nenhum componente encontrado</div>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-4">
            <div className="text-sm text-muted-foreground">
              Mostrando {(currentPage - 1) * pageSize + 1} a {Math.min(currentPage * pageSize, filteredComponents.length)} de {filteredComponents.length} entradas
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))} disabled={currentPage === 1}>
                <IconChevronLeft className="h-4 w-4" />
              </Button>
              <div className="text-sm">
                Página {currentPage} de {totalPages}
              </div>
              <Button variant="outline" size="sm" onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))} disabled={currentPage === totalPages}>
                <IconChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
