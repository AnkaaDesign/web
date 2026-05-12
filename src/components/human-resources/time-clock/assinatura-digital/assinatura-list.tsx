import { useEffect, useMemo, useState } from "react";

import { useSecullumAssinaturas } from "../../../../hooks";
import { debounce } from "../../../../utils";
import { cn } from "@/lib/utils";

import { Card, CardContent } from "@/components/ui/card";
import { TableSearchInput } from "@/components/ui/table-search-input";
import { Skeleton } from "@/components/ui/skeleton";
import { AssinaturaTable, type SecullumAssinatura } from "./assinatura-table";
import { AssinaturaEmpty } from "./assinatura-empty";

interface AssinaturaListProps {
  className?: string;
}

const DEFAULT_PAGE_SIZE = 50;

export function AssinaturaList({ className }: AssinaturaListProps) {
  const [displaySearchText, setDisplaySearchText] = useState("");
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);

  const { data: response, isLoading } = useSecullumAssinaturas();

  const [urlParams, setUrlParams] = useState(() => new URLSearchParams(window.location.search));
  const searchText = urlParams.get("searchingFor") || "";

  useEffect(() => {
    const handleUrlChange = () => {
      setUrlParams(new URLSearchParams(window.location.search));
    };
    window.addEventListener("popstate", handleUrlChange);
    return () => window.removeEventListener("popstate", handleUrlChange);
  }, []);

  useEffect(() => {
    setDisplaySearchText(searchText);
  }, [searchText]);

  useEffect(() => {
    setPage(0);
  }, [searchText]);

  const filtered = useMemo<SecullumAssinatura[]>(() => {
    const list = response?.data?.data;
    let arr: SecullumAssinatura[] = Array.isArray(list) ? list : [];

    if (searchText) {
      const q = searchText.toLowerCase();
      arr = arr.filter(
        (a) =>
          a.Descricao?.toLowerCase().includes(q) ||
          String(a.Id).includes(q),
      );
    }

    // Newest apuração first by DataInicio. Within the same period, the bulk
    // monthly apuração is created before the per-employee retry rows, so its
    // Id is lower — sort by Id asc as a tiebreaker so the main batch appears
    // above its follow-ups (matches the Secullum UI order).
    arr = [...arr].sort((a, b) => {
      const diff = new Date(b.DataInicio).getTime() - new Date(a.DataInicio).getTime();
      if (diff !== 0) return diff;
      return a.Id - b.Id;
    });

    return arr;
  }, [response, searchText]);

  // Client-side pagination: Secullum's /AssinaturaDigitalCartaoPonto endpoint
  // returns the full list with no `?page=`/`?take=` params, so the table slices
  // locally. Cheap because total record counts top out in the hundreds.
  const paginated = useMemo(() => {
    const start = page * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, page, pageSize]);

  const totalRecords = filtered.length;
  const totalPages = Math.max(1, Math.ceil(totalRecords / pageSize));

  const updateSearchParams = useMemo(
    () =>
      debounce((value: string) => {
        const params = new URLSearchParams(window.location.search);
        if (value) params.set("searchingFor", value);
        else params.delete("searchingFor");
        const newUrl = `${window.location.pathname}${params.toString() ? `?${params}` : ""}`;
        window.history.replaceState({}, "", newUrl);
        window.dispatchEvent(new PopStateEvent("popstate"));
      }, 300),
    [],
  );

  const handleSearchChange = (value: string) => {
    setDisplaySearchText(value);
    updateSearchParams(value);
  };

  return (
    <Card className={cn("flex flex-col shadow-sm border border-border", className)}>
      <CardContent className="flex-1 flex flex-col p-4 space-y-4 overflow-hidden">
        <div className="flex flex-col sm:flex-row gap-3">
          <TableSearchInput
            value={displaySearchText}
            onChange={handleSearchChange}
            placeholder="Buscar por descrição ou número..."
            isPending={displaySearchText !== searchText}
          />
        </div>

        <div className="flex-1 min-h-0 overflow-auto">
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : paginated.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <AssinaturaEmpty hasFilters={!!searchText} />
            </div>
          ) : (
            <AssinaturaTable
              apuracoes={paginated}
              currentPage={page}
              totalPages={totalPages}
              pageSize={pageSize}
              totalItems={totalRecords}
              onPageChange={setPage}
              onPageSizeChange={(s) => {
                setPageSize(s);
                setPage(0);
              }}
              className="h-full"
            />
          )}
        </div>
      </CardContent>
    </Card>
  );
}
