import { useState, useEffect } from "react";
import { IconFilter, IconX } from "@tabler/icons-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
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
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <IconFilter className="h-5 w-5" />
            Filtros de Logs
          </SheetTitle>
          <SheetDescription>
            Filtre os logs do sistema por serviço, quantidade de linhas e termo de busca
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6">
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
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Filtrar linhas que contenham..."
            />
          </div>
        </div>

        <SheetFooter className="mt-6 pt-4 border-t gap-2 sm:gap-2">
          <Button variant="outline" onClick={handleClear} className="flex-1">
            <IconX className="h-4 w-4 mr-2" />
            Limpar
          </Button>
          <Button onClick={handleApply} className="flex-1">
            Aplicar Filtros
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

export default SystemLogsFilters;
