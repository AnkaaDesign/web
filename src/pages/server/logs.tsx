import { useAuth } from "@/contexts/auth-context";
import { SECTOR_PRIVILEGES, routes } from "../../constants";
import { hasPrivilege } from "../../utils";
import { IconFileText, IconRefresh, IconDownload, IconFilter, IconSearch, IconX, IconAlertTriangle, IconInfoCircle, IconCircleCheck, IconFile } from "@tabler/icons-react";
import { useNavigate } from "react-router-dom";
import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { usePageTracker } from "@/hooks/use-page-tracker";
import { PageHeader } from "@/components/ui/page-header";
import { useSystemServices } from "../../hooks";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { useServiceLogs } from "../../hooks";
// import { SystemLogsFilters } from "@/components/server/logs/system-logs-filters";
import { debounce } from "lodash";

export function ServerLogsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { success } = useToast();
  const [selectedService, setSelectedService] = useState<string>("");
  const [searchTerm, setSearchTerm] = useState("");
  const [displaySearchText, setDisplaySearchText] = useState("");
  const [logLines, setLogLines] = useState("50");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Check admin privileges
  const isAdmin = user?.sector?.privileges ? hasPrivilege(user as any, SECTOR_PRIVILEGES.ADMIN) : false;

  // Track page access
  usePageTracker({
    title: "Logs do Sistema",
    icon: "systemLogs",
  });

  // Fetch services for selection
  const { data: services } = useSystemServices();

  // Fetch logs for selected service
  const { data: logs, isLoading: logsLoading, refetch: refetchLogs } = useServiceLogs(selectedService, { lines: logLines }, { enabled: !!selectedService });

  // Create debounced search function
  const debouncedSearch = useMemo(
    () =>
      debounce((value: string) => {
        setSearchTerm(value);
      }, 300),
    [],
  );

  // Handle search with immediate UI update
  const handleSearch = useCallback(
    (value: string) => {
      setDisplaySearchText(value); // Immediate UI update
      debouncedSearch(value); // Debounced search term update
    },
    [debouncedSearch],
  );

  // Redirect if not admin
  useEffect(() => {
    if (!isAdmin) {
      navigate(routes.home);
    }
  }, [isAdmin, navigate]);

  if (!isAdmin) {
    return null;
  }

  // Filter logs based on search term
  const filteredLogs = logs?.data
    ? logs.data
        .split("\n")
        .filter((line) => !searchTerm || line.toLowerCase().includes(searchTerm.toLowerCase()))
        .join("\n")
    : "";

  // Determine log level from line content
  const getLogLevel = (line: string) => {
    const lowerLine = line.toLowerCase();
    if (lowerLine.includes("error") || lowerLine.includes("fail") || lowerLine.includes("critical")) {
      return "error";
    }
    if (lowerLine.includes("warn") || lowerLine.includes("warning")) {
      return "warning";
    }
    if (lowerLine.includes("info") || lowerLine.includes("started") || lowerLine.includes("loaded")) {
      return "info";
    }
    return "default";
  };

  const getLevelIcon = (level: string) => {
    switch (level) {
      case "error":
        return <IconX className="h-3 w-3 text-red-500" />;
      case "warning":
        return <IconAlertTriangle className="h-3 w-3 text-yellow-500" />;
      case "info":
        return <IconInfoCircle className="h-3 w-3 text-blue-500" />;
      default:
        return <IconCircleCheck className="h-3 w-3 text-gray-500" />;
    }
  };

  const getLevelColor = (level: string) => {
    switch (level) {
      case "error":
        return "border-l-red-500 bg-red-50/60 dark:bg-red-950/20";
      case "warning":
        return "border-l-amber-500 bg-amber-50/60 dark:bg-amber-950/20";
      case "info":
        return "border-l-blue-500 bg-blue-50/60 dark:bg-blue-950/20";
      default:
        return "border-l-border bg-muted/30";
    }
  };

  const handleDownloadLogs = () => {
    if (!logs?.data) return;

    const blob = new Blob([logs.data], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${selectedService}-logs-${new Date().toISOString().split("T")[0]}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    success("Logs exportados com sucesso");
  };

  const handleFiltersApply = (filters: { service?: string; lines?: string; searchTerm?: string }) => {
    if (filters.service !== undefined) {
      setSelectedService(filters.service);
    }
    if (filters.lines) {
      setLogLines(filters.lines);
    }
    if (filters.searchTerm !== undefined) {
      setSearchTerm(filters.searchTerm);
      setDisplaySearchText(filters.searchTerm); // Also update display text
    }
  };

  // Count active filters (excluding defaults)
  const activeFilterCount = [selectedService && selectedService !== "", displaySearchText && displaySearchText !== "", logLines !== "50"].filter(Boolean).length;

  return (
    <div className="flex flex-col h-full space-y-4">
      {/* Fixed Header */}
      <div className="flex-shrink-0">
        <PageHeader
          title="Logs do Sistema"
          icon={IconFileText}
          breadcrumbs={[{ label: "Início", href: routes.home }, { label: "Servidor", href: routes.server.root }, { label: "Logs do Sistema" }]}
        />
      </div>

      {/* Content Card */}
      <Card className="flex-1 flex flex-col min-h-0" level={1}>
        <CardContent className="flex-1 overflow-auto space-y-4">
          {/* Search and Filter Controls */}
          <div className="flex flex-col gap-3 sm:flex-row">
            {/* Search Input */}
            <div className="flex-1 relative">
              <IconSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input ref={searchInputRef} type="text" placeholder="Buscar nos logs..." value={displaySearchText} onChange={(e) => handleSearch(e.target.value)} className="pl-10" />
            </div>

            {/* Filter and Action Controls */}
            <div className="flex gap-2 items-center">
              <Button variant="outline" onClick={() => setFiltersOpen(true)} className="flex items-center gap-2">
                <IconFilter className="h-4 w-4" />
                Filtros
                {activeFilterCount > 0 && (
                  <Badge variant="secondary" className="ml-1">
                    {activeFilterCount}
                  </Badge>
                )}
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  refetchLogs();
                  success("Logs atualizados");
                }}
                disabled={!selectedService || logsLoading}
              >
                <IconRefresh className={`h-4 w-4 ${logsLoading ? "animate-spin" : ""}`} />
              </Button>
              <Button variant="outline" size="sm" onClick={handleDownloadLogs} disabled={!logs?.data}>
                <IconDownload className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Active Filter Indicators */}
          {activeFilterCount > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              {selectedService && (
                <Badge variant="outline" className="text-xs">
                  Serviço: {services?.data?.find((s) => s.name === selectedService)?.displayName}
                </Badge>
              )}
              {displaySearchText && (
                <Badge variant="outline" className="text-xs">
                  Busca: {displaySearchText}
                </Badge>
              )}
              {logLines !== "50" && (
                <Badge variant="outline" className="text-xs">
                  Linhas: {logLines}
                </Badge>
              )}
            </div>
          )}

          {/* Log Content */}
          <Card className="flex-1 flex flex-col min-h-0" level={2}>
            <CardHeader className="flex-shrink-0">
              <div className="flex justify-between items-center">
                <CardTitle className="text-xl flex items-center gap-3">
                  <div className="p-2 bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-lg">
                    <IconFile className="h-5 w-5" />
                  </div>
                  {selectedService ? `Logs - ${services?.data?.find((s) => s.name === selectedService)?.displayName}` : "Logs"}
                </CardTitle>
                {logs?.data && (
                  <Badge variant="outline" className="text-xs">
                    {filteredLogs.split("\n").length} linhas
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="flex-1 overflow-auto">
              {!selectedService ? (
                <div className="text-center py-12">
                  <IconFileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-muted-foreground mb-2">Selecione um Serviço</h3>
                  <p className="text-sm text-muted-foreground">Escolha um serviço na lista acima para visualizar seus logs</p>
                </div>
              ) : logsLoading ? (
                <div className="space-y-2">
                  {Array.from({ length: 10 }).map((_, i) => (
                    <div key={i} className="border-l-4 border-l-border pl-4 py-2 space-y-1">
                      <Skeleton className="h-4 w-full" />
                      <Skeleton className="h-3 w-3/4" />
                    </div>
                  ))}
                </div>
              ) : logs?.data ? (
                <div className="space-y-1">
                  {/* Enhanced log display */}
                  <div className="bg-muted/50 dark:bg-muted/20 rounded-lg p-4 max-h-96 overflow-auto font-mono text-sm">
                    <div className="space-y-1">
                      {filteredLogs
                        .split("\n")
                        .filter((line) => line.trim())
                        .map((line, index) => {
                          const level = getLogLevel(line);
                          return (
                            <div key={index} className={`border-l-4 pl-3 py-1 ${getLevelColor(level)} rounded-r`}>
                              <div className="flex items-start gap-2 text-xs">
                                {getLevelIcon(level)}
                                <span className="text-foreground leading-relaxed break-all">{line}</span>
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  </div>

                  {/* Raw text area for copying */}
                  <details className="mt-4">
                    <summary className="cursor-pointer text-sm text-muted-foreground hover:text-secondary-foreground">Visualizar logs em texto puro (para copiar)</summary>
                    <Textarea value={filteredLogs} readOnly className="mt-2 font-mono text-xs" rows={10} />
                  </details>
                </div>
              ) : (
                <div className="text-center py-12">
                  <IconFileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-muted-foreground mb-2">Nenhum Log Encontrado</h3>
                  <p className="text-sm text-muted-foreground">Não há logs disponíveis para o serviço selecionado</p>
                </div>
              )}
            </CardContent>
          </Card>
        </CardContent>
      </Card>

      {/* Filters Dialog */}
      {/* <SystemLogsFilters
        open={filtersOpen}
        onOpenChange={setFiltersOpen}
        currentService={selectedService}
        currentLines={logLines}
        currentSearch={displaySearchText}
        onApply={handleFiltersApply}
      /> */}
    </div>
  );
}

export default ServerLogsPage;
