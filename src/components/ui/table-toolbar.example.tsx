import { useState, useMemo } from "react";
import { IconUser, IconMail, IconCalendar, IconTrash, IconEdit, IconFilter, IconDownload, IconGrid3x3, IconList, IconActivity } from "@tabler/icons-react";
import { TableToolbar, type TableColumn, type FilterConfig, type ActiveFilter, type SelectionAction, type ViewOption, type PresetConfig } from "./table-toolbar";
import { Input } from "./input";
import { Combobox, type ComboboxOption } from "./combobox";
import { Button } from "./button";
import { DateTimeInput } from "./date-time-input";
import { Badge } from "./badge";

// Example data type
interface User {
  id: string;
  name: string;
  email: string;
  status: "ACTIVE" | "INACTIVE" | "PENDING";
  role: "ADMIN" | "USER" | "MANAGER";
  createdAt: Date;
  lastLogin?: Date;
}

// Example component demonstrating TableToolbar usage
export function TableToolbarExample() {
  // Search state
  const [searchValue, setSearchValue] = useState("");

  // Selection state
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [showSelectedOnly, setShowSelectedOnly] = useState(false);

  // Filter state
  const [filters, setFilters] = useState({
    status: "",
    role: "",
    createdAfter: null as Date | null,
    createdBefore: null as Date | null,
  });

  // Column visibility state
  const [visibleColumns, setVisibleColumns] = useState<Set<string>>(new Set(["name", "email", "status", "role", "createdAt"]));

  // View state
  const [density, setDensity] = useState<"compact" | "normal" | "comfortable">("normal");
  const [currentView, setCurrentView] = useState<"table" | "grid" | "list">("table");

  // Preset state
  const [presets, setPresets] = useState<PresetConfig[]>([
    {
      id: "active-users",
      name: "Usuários Ativos",
      filters: { status: "ACTIVE" },
      isDefault: true,
    },
    {
      id: "admin-users",
      name: "Administradores",
      filters: { role: "ADMIN" },
    },
  ]);
  const [currentPreset, setCurrentPreset] = useState<string>("");

  // Mock data
  const mockUsers: User[] = [
    {
      id: "1",
      name: "João Silva",
      email: "joao@example.com",
      status: "ACTIVE",
      role: "ADMIN",
      createdAt: new Date("2024-01-15"),
      lastLogin: new Date("2024-12-01"),
    },
    {
      id: "2",
      name: "Maria Santos",
      email: "maria@example.com",
      status: "ACTIVE",
      role: "USER",
      createdAt: new Date("2024-02-20"),
      lastLogin: new Date("2024-11-30"),
    },
    {
      id: "3",
      name: "Pedro Costa",
      email: "pedro@example.com",
      status: "INACTIVE",
      role: "MANAGER",
      createdAt: new Date("2024-03-10"),
    },
  ];

  // Define table columns
  const columns: TableColumn[] = [
    { key: "name", header: "Nome", defaultVisible: true, sortable: true },
    { key: "email", header: "E-mail", defaultVisible: true, sortable: true },
    { key: "status", header: "Status", defaultVisible: true, sortable: true },
    { key: "role", header: "Função", defaultVisible: true, sortable: true },
    { key: "createdAt", header: "Data de Criação", defaultVisible: true, sortable: true },
    { key: "lastLogin", header: "Último Acesso", defaultVisible: false, sortable: true },
  ];

  // Status options for combobox
  const statusOptions: ComboboxOption[] = [
    { value: "", label: "Todos" },
    { value: "ACTIVE", label: "Ativo" },
    { value: "INACTIVE", label: "Inativo" },
    { value: "PENDING", label: "Pendente" },
  ];

  // Role options for combobox
  const roleOptions: ComboboxOption[] = [
    { value: "", label: "Todas" },
    { value: "ADMIN", label: "Administrador" },
    { value: "USER", label: "Usuário" },
    { value: "MANAGER", label: "Gerente" },
  ];

  // Filter configurations
  const filterConfigs: FilterConfig[] = [
    {
      key: "status",
      label: "Status",
      icon: <IconActivity className="h-4 w-4" />,
      component: (
        <Combobox
          value={filters.status}
          onValueChange={(value) => setFilters((prev) => ({ ...prev, status: String(value || "") }))}
          options={statusOptions}
          placeholder="Selecionar status..."
          className="w-full"
        />
      ),
    },
    {
      key: "role",
      label: "Função",
      icon: <IconUser className="h-4 w-4" />,
      component: (
        <Combobox
          value={filters.role}
          onValueChange={(value) => setFilters((prev) => ({ ...prev, role: String(value || "") }))}
          options={roleOptions}
          placeholder="Selecionar função..."
          className="w-full"
        />
      ),
    },
    {
      key: "dateRange",
      label: "Período de Criação",
      icon: <IconCalendar className="h-4 w-4" />,
      component: (
        <div className="space-y-2">
          <DateTimeInput
            value={filters.createdAfter}
            onChange={(date) => setFilters((prev) => ({ ...prev, createdAfter: date }))}
            placeholder="Data inicial..."
            mode="date"
            hideLabel
          />
          <DateTimeInput
            value={filters.createdBefore}
            onChange={(date) => setFilters((prev) => ({ ...prev, createdBefore: date }))}
            placeholder="Data final..."
            mode="date"
            hideLabel
          />
        </div>
      ),
    },
  ];

  // Active filters (computed from filter state)
  const activeFilters: ActiveFilter[] = useMemo(() => {
    const active: ActiveFilter[] = [];

    if (filters.status) {
      active.push({
        key: "status",
        label: "Status",
        value: getStatusLabel(filters.status),
        onRemove: () => setFilters((prev) => ({ ...prev, status: "" })),
        icon: <IconActivity className="h-3 w-3" />,
      });
    }

    if (filters.role) {
      active.push({
        key: "role",
        label: "Função",
        value: getRoleLabel(filters.role),
        onRemove: () => setFilters((prev) => ({ ...prev, role: "" })),
        icon: <IconUser className="h-3 w-3" />,
      });
    }

    if (filters.createdAfter) {
      active.push({
        key: "createdAfter",
        label: "Criado após",
        value: filters.createdAfter.toLocaleDateString("pt-BR"),
        onRemove: () => setFilters((prev) => ({ ...prev, createdAfter: null })),
        icon: <IconCalendar className="h-3 w-3" />,
      });
    }

    if (filters.createdBefore) {
      active.push({
        key: "createdBefore",
        label: "Criado antes",
        value: filters.createdBefore.toLocaleDateString("pt-BR"),
        onRemove: () => setFilters((prev) => ({ ...prev, createdBefore: null })),
        icon: <IconCalendar className="h-3 w-3" />,
      });
    }

    return active;
  }, [filters]);

  // Selection actions
  const selectionActions: SelectionAction[] = [
    {
      key: "edit",
      label: "Editar",
      icon: <IconEdit className="h-4 w-4" />,
      onClick: (selectedIds) => {
        console.log("Edit users:", Array.from(selectedIds));
      },
    },
    {
      key: "delete",
      label: "Excluir",
      icon: <IconTrash className="h-4 w-4" />,
      variant: "destructive",
      onClick: (selectedIds) => {
        console.log("Delete users:", Array.from(selectedIds));
      },
    },
  ];

  // View options
  const viewOptions: ViewOption[] = [
    {
      key: "table",
      label: "Tabela",
      icon: IconList,
      active: currentView === "table",
      onClick: () => setCurrentView("table"),
    },
    {
      key: "grid",
      label: "Grade",
      icon: IconGrid3x3,
      active: currentView === "grid",
      onClick: () => setCurrentView("grid"),
    },
  ];

  // Export columns
  const exportColumns = [
    { id: "name", label: "Nome", getValue: (user: User) => user.name },
    { id: "email", label: "E-mail", getValue: (user: User) => user.email },
    { id: "status", label: "Status", getValue: (user: User) => getStatusLabel(user.status) },
    { id: "role", label: "Função", getValue: (user: User) => getRoleLabel(user.role) },
    { id: "createdAt", label: "Data de Criação", getValue: (user: User) => user.createdAt.toLocaleDateString("pt-BR") },
  ];

  // Helper functions
  function getStatusLabel(status: string): string {
    const labels = {
      ACTIVE: "Ativo",
      INACTIVE: "Inativo",
      PENDING: "Pendente",
    };
    return labels[status as keyof typeof labels] || status;
  }

  function getRoleLabel(role: string): string {
    const labels = {
      ADMIN: "Administrador",
      USER: "Usuário",
      MANAGER: "Gerente",
    };
    return labels[role as keyof typeof labels] || role;
  }

  // Event handlers
  const handleClearAllFilters = () => {
    setFilters({
      status: "",
      role: "",
      createdAfter: null,
      createdBefore: null,
    });
  };

  const handleExport = async (format: string, items: User[], columns: any[]) => {
    console.log(`Exporting ${items.length} users as ${format}`, { items, columns });
    // Implement actual export logic here
  };

  const handlePresetSave = (name: string, filterValues: Record<string, any>, columnValues?: Set<string>) => {
    const newPreset: PresetConfig = {
      id: `preset-${Date.now()}`,
      name,
      filters: filterValues,
      columns: columnValues,
    };
    setPresets((prev) => [...prev, newPreset]);
  };

  const handlePresetChange = (presetId: string) => {
    const preset = presets.find((p) => p.id === presetId);
    if (preset) {
      setFilters((prev) => ({ ...prev, ...preset.filters }));
      if (preset.columns) {
        setVisibleColumns(preset.columns);
      }
      setCurrentPreset(presetId);
    }
  };

  const handlePresetDelete = (presetId: string) => {
    setPresets((prev) => prev.filter((p) => p.id !== presetId));
    if (currentPreset === presetId) {
      setCurrentPreset("");
    }
  };

  const filteredUsers = useMemo(() => {
    return mockUsers.filter((user) => {
      // Search filter
      if (searchValue) {
        const searchLower = searchValue.toLowerCase();
        if (!user.name.toLowerCase().includes(searchLower) && !user.email.toLowerCase().includes(searchLower)) {
          return false;
        }
      }

      // Status filter
      if (filters.status && user.status !== filters.status) {
        return false;
      }

      // Role filter
      if (filters.role && user.role !== filters.role) {
        return false;
      }

      // Date filters
      if (filters.createdAfter && user.createdAt < filters.createdAfter) {
        return false;
      }

      if (filters.createdBefore && user.createdAt > filters.createdBefore) {
        return false;
      }

      // Show selected only filter
      if (showSelectedOnly && !selectedItems.has(user.id)) {
        return false;
      }

      return true;
    });
  }, [mockUsers, searchValue, filters, showSelectedOnly, selectedItems]);

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">Exemplo de TableToolbar</h1>
        <p className="text-muted-foreground">Demonstração completa do componente TableToolbar com todas as funcionalidades.</p>
      </div>

      <TableToolbar
        // Search
        searchValue={searchValue}
        onSearchChange={setSearchValue}
        searchPlaceholder="Buscar usuários..."
        // Selection
        selectedItems={selectedItems}
        selectionActions={selectionActions}
        showSelectedOnly={showSelectedOnly}
        onShowSelectedOnlyChange={setShowSelectedOnly}
        // Filters
        filters={filterConfigs}
        activeFilters={activeFilters}
        onClearAllFilters={handleClearAllFilters}
        // Columns
        columns={columns}
        visibleColumns={visibleColumns}
        onColumnsChange={setVisibleColumns}
        columnStorageKey="user-table-columns"
        // View options
        density={density}
        onDensityChange={setDensity}
        viewOptions={viewOptions}
        // Export
        exportData={filteredUsers}
        exportColumns={exportColumns}
        onExport={handleExport}
        totalRecords={mockUsers.length}
        entityName="usuário"
        entityNamePlural="usuários"
        // Presets
        enablePresets
        presets={presets}
        currentPreset={currentPreset}
        onPresetChange={handlePresetChange}
        onPresetSave={handlePresetSave}
        onPresetDelete={handlePresetDelete}
        // General
        title="Gerenciar Usuários"
        subtitle={`${filteredUsers.length} usuários encontrados`}
        refreshAction={() => console.log("Refreshing data...")}
        customActions={
          <Button onClick={() => console.log("Add new user")}>
            <IconUser className="h-4 w-4 mr-2" />
            Novo Usuário
          </Button>
        }
      />

      {/* Example table display */}
      <div className="border rounded-lg">
        <div className="p-4">
          <h3 className="font-medium mb-4">Tabela de Usuários ({filteredUsers.length} itens)</h3>

          {/* Mock table header */}
          <div className="grid grid-cols-5 gap-4 pb-2 border-b font-medium text-sm text-muted-foreground">
            {visibleColumns.has("name") && <div>Nome</div>}
            {visibleColumns.has("email") && <div>E-mail</div>}
            {visibleColumns.has("status") && <div>Status</div>}
            {visibleColumns.has("role") && <div>Função</div>}
            {visibleColumns.has("createdAt") && <div>Criado em</div>}
          </div>

          {/* Mock table rows */}
          <div className="space-y-2 mt-2">
            {filteredUsers.map((user) => (
              <div
                key={user.id}
                className={`grid grid-cols-5 gap-4 p-2 rounded hover:bg-accent cursor-pointer ${selectedItems.has(user.id) ? "bg-accent" : ""}`}
                onClick={() => {
                  const newSelected = new Set(selectedItems);
                  if (newSelected.has(user.id)) {
                    newSelected.delete(user.id);
                  } else {
                    newSelected.add(user.id);
                  }
                  setSelectedItems(newSelected);
                }}
              >
                {visibleColumns.has("name") && <div className="font-medium">{user.name}</div>}
                {visibleColumns.has("email") && <div className="text-muted-foreground">{user.email}</div>}
                {visibleColumns.has("status") && (
                  <div>
                    <Badge variant={user.status === "ACTIVE" ? "default" : user.status === "INACTIVE" ? "destructive" : "secondary"}>{getStatusLabel(user.status)}</Badge>
                  </div>
                )}
                {visibleColumns.has("role") && <div>{getRoleLabel(user.role)}</div>}
                {visibleColumns.has("createdAt") && <div>{user.createdAt.toLocaleDateString("pt-BR")}</div>}
              </div>
            ))}
          </div>

          {filteredUsers.length === 0 && <div className="text-center py-8 text-muted-foreground">Nenhum usuário encontrado com os filtros atuais.</div>}
        </div>
      </div>

      {/* Debug info */}
      <details className="border rounded-lg p-4">
        <summary className="cursor-pointer font-medium">Estado Atual (Debug)</summary>
        <pre className="mt-2 text-xs bg-muted p-2 rounded overflow-auto">
          {JSON.stringify(
            {
              searchValue,
              selectedItems: Array.from(selectedItems),
              showSelectedOnly,
              filters,
              visibleColumns: Array.from(visibleColumns),
              density,
              currentView,
              currentPreset,
              filteredUsersCount: filteredUsers.length,
            },
            null,
            2,
          )}
        </pre>
      </details>
    </div>
  );
}
