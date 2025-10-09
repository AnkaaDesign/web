import { BaseExportPopover, type ExportFormat, type ExportColumn } from "@/components/ui/export-popover";
import { toast } from "@/components/ui/sonner";
import { userService } from "../../../../api-client";
import { formatCPF, formatBrazilianPhone, formatDate } from "../../../../utils";
import type { User } from "../../../../types";
import type { UserGetManyFormData } from "../../../../schemas";

interface UserExportProps {
  className?: string;
  filters?: Partial<UserGetManyFormData>;
  currentUsers?: User[];
  totalRecords?: number;
  visibleColumns?: Set<string>;
  selectedUsers?: Set<string>;
}

// Column configuration for export - matches table columns
const EXPORT_COLUMNS: ExportColumn<User>[] = [
  { id: "payrollNumber", label: "Nº Folha", getValue: (user: User) => user.payrollNumber?.toString() || "" },
  { id: "name", label: "Nome", getValue: (user: User) => user.name },
  { id: "email", label: "Email", getValue: (user: User) => user.email || "" },
  { id: "phone", label: "Telefone", getValue: (user: User) => (user.phone ? formatBrazilianPhone(user.phone) : "") },
  { id: "cpf", label: "CPF", getValue: (user: User) => (user.cpf ? formatCPF(user.cpf) : "") },
  { id: "pis", label: "PIS", getValue: (user: User) => user.pis || "" },
  { id: "position", label: "Cargo", getValue: (user: User) => user.position?.name || "" },
  { id: "sector", label: "Setor", getValue: (user: User) => user.sector?.name || "" },
  { id: "admissional", label: "Data de Admissão", getValue: (user: User) => (user.admissional ? formatDate(new Date(user.admissional)) : "") },
];

// Default visible columns if none specified
const DEFAULT_VISIBLE_COLUMNS = new Set(["payrollNumber", "name", "email", "position", "sector"]);

export function UserExport({ className, filters, currentUsers = [], totalRecords = 0, visibleColumns, selectedUsers }: UserExportProps) {
  const fetchAllUsers = async (): Promise<User[]> => {
    try {
      const allUsers: User[] = [];
      let page = 1;
      let hasMore = true;

      while (hasMore) {
        const response = await userService.getUsers({
          ...filters,
          page,
          limit: 100,
          include: {
            position: {
              include: {
                sector: true,
              },
            },
            managedSector: true,
            count: {
              select: {
                tasks: true,
                activities: true,
              },
            },
          },
        });

        if (response.data) {
          allUsers.push(...response.data);
        }

        hasMore = response.meta?.hasNextPage || false;
        page++;
      }

      return allUsers;
    } catch (error) {
      console.error("Error fetching all users:", error);
      toast.error("Erro ao buscar colaboradores para exportação");
      throw error;
    }
  };

  const handleExport = async (format: ExportFormat, items: User[]) => {
    try {
      // The BaseExportPopover component handles the actual export logic
      // including CSV, Excel, and PDF generation// If you need custom export logic, you can implement it here
      // For now, we'll let the BaseExportPopover handle it
    } catch (error) {
      console.error("Export error:", error);
      toast.error("Erro ao exportar dados");
      throw error;
    }
  };

  // Filter items based on selection
  const getItemsToExport = () => {
    if (selectedUsers && selectedUsers.size > 0) {
      return currentUsers.filter((user) => selectedUsers.has(user.id));
    }
    return currentUsers;
  };

  return (
    <BaseExportPopover
      className={className}
      currentItems={getItemsToExport()}
      totalRecords={totalRecords}
      selectedItems={selectedUsers}
      visibleColumns={visibleColumns}
      exportColumns={EXPORT_COLUMNS}
      defaultVisibleColumns={DEFAULT_VISIBLE_COLUMNS}
      onExport={handleExport}
      onFetchAllItems={fetchAllUsers}
      entityName="colaborador"
      entityNamePlural="colaboradores"
    />
  );
}
