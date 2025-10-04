import { useState } from "react";
import { IconGasStation, IconPlus, IconFilter, IconDownload, IconTruck, IconReceipt } from "@tabler/icons-react";
import { formatCurrency, formatDate } from "../../../utils";
import {
  FUEL_TYPE_LABELS,
  FUEL_TRANSACTION_TYPE_LABELS,
  FUEL_ENTRY_STATUS_LABELS,
  type FUEL_TYPE,
  type FUEL_TRANSACTION_TYPE,
  type FUEL_ENTRY_STATUS,
} from "../../../constants";
import type { Fuel } from "../../../types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { StandardizedTable } from "@/components/ui/standardized-table";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useNavigate } from "react-router-dom";

interface FuelListProps {
  fuels: Fuel[];
  isLoading?: boolean;
  totalRecords?: number;
  currentPage?: number;
  hasNextPage?: boolean;
  onPageChange?: (page: number) => void;
  onSearch?: (search: string) => void;
  onFilterChange?: (filters: FuelFilters) => void;
}

interface FuelFilters {
  fuelType?: FUEL_TYPE;
  transactionType?: FUEL_TRANSACTION_TYPE;
  status?: FUEL_ENTRY_STATUS;
  vehicleId?: string;
  supplier?: string;
}

export const FuelList = ({
  fuels,
  isLoading = false,
  totalRecords = 0,
  currentPage = 1,
  hasNextPage = false,
  onPageChange,
  onSearch,
  onFilterChange,
}: FuelListProps) => {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState("");
  const [filters, setFilters] = useState<FuelFilters>({});
  const [showFilters, setShowFilters] = useState(false);

  const handleSearch = (value: string) => {
    setSearchTerm(value);
    onSearch?.(value);
  };

  const handleFilterChange = (newFilters: Partial<FuelFilters>) => {
    const updatedFilters = { ...filters, ...newFilters };
    setFilters(updatedFilters);
    onFilterChange?.(updatedFilters);
  };

  const clearFilters = () => {
    setFilters({});
    onFilterChange?.({});
  };

  const getStatusBadge = (status: FUEL_ENTRY_STATUS) => {
    const variants = {
      PENDING: "secondary",
      CONFIRMED: "success",
      CANCELLED: "destructive",
    } as const;

    return (
      <Badge variant={variants[status] || "secondary"}>
        {FUEL_ENTRY_STATUS_LABELS[status]}
      </Badge>
    );
  };

  const getTransactionTypeBadge = (type: FUEL_TRANSACTION_TYPE) => {
    const variants = {
      REFUEL: "default",
      FUEL_PURCHASE: "outline",
      FUEL_ADJUSTMENT: "secondary",
    } as const;

    return (
      <Badge variant={variants[type] || "default"}>
        {FUEL_TRANSACTION_TYPE_LABELS[type]}
      </Badge>
    );
  };

  const columns = [
    {
      accessorKey: "fuelDate",
      header: "Data",
      cell: ({ row }: { row: { original: Fuel } }) => formatDate(row.original.fuelDate),
    },
    {
      accessorKey: "transactionType",
      header: "Tipo",
      cell: ({ row }: { row: { original: Fuel } }) =>
        getTransactionTypeBadge(row.original.transactionType),
    },
    {
      accessorKey: "fuelType",
      header: "Combustível",
      cell: ({ row }: { row: { original: Fuel } }) =>
        FUEL_TYPE_LABELS[row.original.fuelType],
    },
    {
      accessorKey: "vehicle",
      header: "Veículo",
      cell: ({ row }: { row: { original: Fuel } }) => {
        const fuel = row.original;
        return fuel.vehicle ? (
          <div className="flex items-center gap-2">
            <IconTruck className="w-4 h-4 text-muted-foreground" />
            <span>{fuel.vehicle.plate}</span>
            <span className="text-sm text-muted-foreground">
              {fuel.vehicle.model}
            </span>
          </div>
        ) : (
          <span className="text-muted-foreground">-</span>
        );
      },
    },
    {
      accessorKey: "quantity",
      header: "Quantidade",
      cell: ({ row }: { row: { original: Fuel } }) =>
        `${row.original.quantity.toFixed(2)} L`,
    },
    {
      accessorKey: "pricePerLiter",
      header: "Preço/L",
      cell: ({ row }: { row: { original: Fuel } }) =>
        formatCurrency(row.original.pricePerLiter),
    },
    {
      accessorKey: "totalCost",
      header: "Total",
      cell: ({ row }: { row: { original: Fuel } }) => (
        <span className="font-medium">
          {formatCurrency(row.original.totalCost)}
        </span>
      ),
    },
    {
      accessorKey: "location",
      header: "Local",
      cell: ({ row }: { row: { original: Fuel } }) =>
        row.original.location || <span className="text-muted-foreground">-</span>,
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }: { row: { original: Fuel } }) =>
        getStatusBadge(row.original.status),
    },
    {
      accessorKey: "receiptNumber",
      header: "Recibo",
      cell: ({ row }: { row: { original: Fuel } }) =>
        row.original.receiptNumber ? (
          <div className="flex items-center gap-2">
            <IconReceipt className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm">{row.original.receiptNumber}</span>
          </div>
        ) : (
          <span className="text-muted-foreground">-</span>
        ),
    },
  ];

  return (
    <div className="container mx-auto p-6 space-y-6">
      <PageHeader
        title="Controle de Combustível"
        subtitle={`${totalRecords} registro${totalRecords !== 1 ? 's' : ''} de abastecimento`}
        icon={<IconGasStation className="w-6 h-6" />}
        actions={
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => setShowFilters(!showFilters)}
            >
              <IconFilter className="w-4 h-4 mr-2" />
              Filtros
            </Button>
            <Button variant="outline">
              <IconDownload className="w-4 h-4 mr-2" />
              Exportar
            </Button>
            <Button onClick={() => navigate("/fleet/fuel/create")}>
              <IconPlus className="w-4 h-4 mr-2" />
              Novo Abastecimento
            </Button>
          </div>
        }
      />

      {/* Search and Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="space-y-4">
            <div className="flex gap-4">
              <div className="flex-1">
                <Input
                  placeholder="Buscar por local, fornecedor, recibo..."
                  value={searchTerm}
                  onChange={(e) => handleSearch(e.target.value)}
                />
              </div>
            </div>

            {showFilters && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 p-4 bg-muted/50 rounded-lg">
                <div>
                  <label className="text-sm font-medium mb-2 block">
                    Tipo de Combustível
                  </label>
                  <Select
                    value={filters.fuelType || ""}
                    onValueChange={(value) =>
                      handleFilterChange({
                        fuelType: value as FUEL_TYPE || undefined,
                      })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Todos" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Todos</SelectItem>
                      {Object.entries(FUEL_TYPE_LABELS).map(([key, label]) => (
                        <SelectItem key={key} value={key}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">
                    Tipo de Transação
                  </label>
                  <Select
                    value={filters.transactionType || ""}
                    onValueChange={(value) =>
                      handleFilterChange({
                        transactionType: value as FUEL_TRANSACTION_TYPE || undefined,
                      })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Todos" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Todos</SelectItem>
                      {Object.entries(FUEL_TRANSACTION_TYPE_LABELS).map(([key, label]) => (
                        <SelectItem key={key} value={key}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">
                    Status
                  </label>
                  <Select
                    value={filters.status || ""}
                    onValueChange={(value) =>
                      handleFilterChange({
                        status: value as FUEL_ENTRY_STATUS || undefined,
                      })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Todos" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Todos</SelectItem>
                      {Object.entries(FUEL_ENTRY_STATUS_LABELS).map(([key, label]) => (
                        <SelectItem key={key} value={key}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-end">
                  <Button variant="outline" onClick={clearFilters} className="w-full">
                    Limpar Filtros
                  </Button>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Fuel Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <IconGasStation className="w-5 h-5" />
            Registros de Abastecimento
          </CardTitle>
        </CardHeader>
        <CardContent>
          <StandardizedTable
            data={fuels}
            columns={columns}
            isLoading={isLoading}
            pagination={{
              totalRecords,
              currentPage,
              hasNextPage,
              onPageChange,
            }}
            onRowClick={(fuel) => navigate(`/fleet/fuel/${fuel.id}`)}
          />
        </CardContent>
      </Card>
    </div>
  );
};