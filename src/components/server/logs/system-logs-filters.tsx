import { useState, useEffect } from "react";
import { IconFilter } from "@tabler/icons-react";
import { FilterDrawer } from "@/components/common/filters/ui/FilterDrawer";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useSystemServices } from "@/hooks";

export interface SystemLogsFiltersData {
  service?: string;
  lines?: string;
  searchTerm?: string;
}

interface SystemLogsFiltersProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentService: string;
  currentLines: string;
  currentSearch: string;
  onApply: (filters: SystemLogsFiltersData) => void;
}

// Mirrors the line counts the logs page requests from /system/services/:name/logs
const LINE_OPTIONS = ["50", "100", "200", "500", "1000"];

export function SystemLogsFilters({
  open,
  onOpenChange,
  currentService,
  currentLines,
  currentSearch,
  onApply,
}: SystemLogsFiltersProps) {
  const { data: services } = useSystemServices();
  const serviceList = services?.data ?? [];

  const [service, setService] = useState(currentService);
  const [lines, setLines] = useState(currentLines);
  const [searchTerm, setSearchTerm] = useState(currentSearch);

  // Re-sync local draft with the live values each time the sheet opens so it
  // never shows stale selections after the user changed things on the page.
  useEffect(() => {
    if (open) {
      setService(currentService);
      setLines(currentLines);
      setSearchTerm(currentSearch);
    }
  }, [open, currentService, currentLines, currentSearch]);

  const handleApply = () => {
    onApply({ service, lines, searchTerm });
    onOpenChange(false);
  };

  const handleClear = () => {
    setService("");
    setLines("50");
    setSearchTerm("");
    onApply({ service: "", lines: "50", searchTerm: "" });
  };

  return (
    <FilterDrawer
      open={open}
      onOpenChange={onOpenChange}
      title="Filtros de Logs"
      titleIcon={<IconFilter className="h-5 w-5" />}
      description="Filtre os logs do sistema por serviço, quantidade de linhas e termo de busca"
      onApply={handleApply}
      onReset={handleClear}
      applyLabel="Aplicar Filtros"
      resetLabel="Limpar"
    >
          {/* Service */}
          <div className="space-y-2">
            <Label htmlFor="log-service">Serviço</Label>
            <Select value={service} onValueChange={setService}>
              <SelectTrigger id="log-service">
                <SelectValue placeholder="Selecione um serviço" />
              </SelectTrigger>
              <SelectContent>
                {serviceList
                  .filter((s) => s?.name)
                  .map((s) => (
                    <SelectItem key={s.name} value={s.name}>
                      {s.displayName ?? s.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>

          {/* Lines */}
          <div className="space-y-2">
            <Label htmlFor="log-lines">Linhas</Label>
            <Select value={lines} onValueChange={setLines}>
              <SelectTrigger id="log-lines">
                <SelectValue placeholder="Quantidade de linhas" />
              </SelectTrigger>
              <SelectContent>
                {LINE_OPTIONS.map((opt) => (
                  <SelectItem key={opt} value={opt}>
                    {opt} linhas
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Search */}
          <div className="space-y-2">
            <Label htmlFor="log-search">Buscar no conteúdo</Label>
            <Input
              id="log-search"
              value={searchTerm}
              onChange={(value) => setSearchTerm(value as string)}
              placeholder="Filtrar linhas que contenham..."
            />
          </div>
    </FilterDrawer>
  );
}

export default SystemLogsFilters;
