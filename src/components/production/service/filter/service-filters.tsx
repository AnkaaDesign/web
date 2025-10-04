import { type ServiceGetManyFormData } from "../../../../schemas";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Combobox, type ComboboxOption } from "@/components/ui/combobox";
import { IconArrowsSort } from "@tabler/icons-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export type ServiceSortOption = "description_asc" | "description_desc" | "createdAt_asc" | "createdAt_desc" | "updatedAt_asc" | "updatedAt_desc";

interface ServiceFiltersProps {
  filters: Partial<ServiceGetManyFormData>;
  onFilterChange: (filters: Partial<ServiceGetManyFormData>) => void;
}

const SORT_OPTIONS: Record<ServiceSortOption, string> = {
  description_asc: "Descrição (A-Z)",
  description_desc: "Descrição (Z-A)",
  createdAt_desc: "Data de Criação (Mais Recente)",
  createdAt_asc: "Data de Criação (Mais Antiga)",
  updatedAt_desc: "Última Atualização (Mais Recente)",
  updatedAt_asc: "Última Atualização (Mais Antiga)",
};

export function ServiceFilters({ filters, onFilterChange }: ServiceFiltersProps) {
  // Determine current sort option
  const getCurrentSortOption = (): ServiceSortOption => {
    if (!filters.orderBy) return "description_asc";

    const field = Object.keys(filters.orderBy)[0];
    const direction = filters.orderBy[field as keyof typeof filters.orderBy];

    return `${field}_${direction}` as ServiceSortOption;
  };

  const currentSort = getCurrentSortOption();

  const handleSortChange = (sortOption: ServiceSortOption) => {
    const [field, direction] = sortOption.split("_") as [string, "asc" | "desc"];

    onFilterChange({
      ...filters,
      orderBy: { [field]: direction },
    });
  };

  const handleLimitChange = (value: string) => {
    onFilterChange({
      ...filters,
      take: parseInt(value),
    });
  };

  return (
    <div className="flex items-center gap-4">
      {/* Sort Selector */}
      <div className="flex items-center gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="default" className="group">
              <IconArrowsSort className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
              <span className="text-foreground">Ordenar: {SORT_OPTIONS[currentSort]}</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-[240px]">
            <DropdownMenuLabel>Ordenar por</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuRadioGroup value={currentSort} onValueChange={(value: string) => handleSortChange(value as ServiceSortOption)}>
              <DropdownMenuLabel className="text-xs text-muted-foreground font-medium px-2 py-1">Descrição</DropdownMenuLabel>
              <DropdownMenuRadioItem value="description_asc" className="cursor-pointer">
                {SORT_OPTIONS["description_asc"]}
              </DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="description_desc" className="cursor-pointer">
                {SORT_OPTIONS["description_desc"]}
              </DropdownMenuRadioItem>

              <DropdownMenuSeparator />
              <DropdownMenuLabel className="text-xs text-muted-foreground font-medium px-2 py-1">Data de Criação</DropdownMenuLabel>
              <DropdownMenuRadioItem value="createdAt_desc" className="cursor-pointer">
                {SORT_OPTIONS["createdAt_desc"]}
              </DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="createdAt_asc" className="cursor-pointer">
                {SORT_OPTIONS["createdAt_asc"]}
              </DropdownMenuRadioItem>

              <DropdownMenuSeparator />
              <DropdownMenuLabel className="text-xs text-muted-foreground font-medium px-2 py-1">Última Atualização</DropdownMenuLabel>
              <DropdownMenuRadioItem value="updatedAt_desc" className="cursor-pointer">
                {SORT_OPTIONS["updatedAt_desc"]}
              </DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="updatedAt_asc" className="cursor-pointer">
                {SORT_OPTIONS["updatedAt_asc"]}
              </DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Page Size Selector */}
      <div className="flex items-center gap-2">
        <Label className="text-sm font-medium">Itens por página</Label>
        <Combobox
          value={filters.take?.toString() || "20"}
          onValueChange={handleLimitChange}
          options={[
            { value: "10", label: "10" },
            { value: "20", label: "20" },
            { value: "50", label: "50" },
            { value: "100", label: "100" },
          ]}
          placeholder="20"
          searchable={false}
          clearable={false}
          className="w-[70px]"
          triggerClassName="h-8"
        />
      </div>
    </div>
  );
}
