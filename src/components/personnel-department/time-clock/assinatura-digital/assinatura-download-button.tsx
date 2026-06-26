import { useMemo } from "react";
import { IconDownload, IconChevronDown } from "@tabler/icons-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useSecullumAssinaturas, useDownloadAssinaturasZip } from "../../../../hooks";

interface AssinaturaDownloadButtonProps {
  // The apuração(ões) this detail page represents (one, or a merged group).
  apuracaoIds: number[];
}

/**
 * Download control for the apuração detail header. Counts come from the list
 * query (Aprovados/Rejeitados). Behaviour:
 *   - both approved & rejected exist → a dropdown with Aceitos / Rejeitados / Ambos
 *   - only one category exists       → a plain button that downloads it directly
 *   - nothing approved/rejected      → nothing rendered (no signed PDFs to zip)
 * The ZIP separates files into Aceitos/ and Rejeitados/ folders server-side.
 */
export function AssinaturaDownloadButton({ apuracaoIds }: AssinaturaDownloadButtonProps) {
  const { data } = useSecullumAssinaturas();
  const download = useDownloadAssinaturasZip();

  const { approved, rejected } = useMemo(() => {
    const list = data?.data?.data;
    const headers = Array.isArray(list) ? list.filter((a) => apuracaoIds.includes(a.Id)) : [];
    return {
      approved: headers.reduce((s, h) => s + (Number(h.Aprovados) || 0), 0),
      rejected: headers.reduce((s, h) => s + (Number(h.Rejeitados) || 0), 0),
    };
  }, [data, apuracaoIds]);

  const total = approved + rejected;
  if (total === 0) return null; // nothing signed/rejected yet → nothing to download

  const pending = download.isPending;
  const run = (status: "approved" | "rejected" | "both") => download.mutate({ apuracaoIds, status });

  // Both present → let the user pick. Otherwise download the only category directly.
  if (approved > 0 && rejected > 0) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button disabled={pending} className="gap-2">
            <IconDownload className="h-4 w-4" />
            {pending ? "Baixando..." : "Baixar"}
            <IconChevronDown className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          <DropdownMenuItem onClick={() => run("approved")}>Aceitos ({approved})</DropdownMenuItem>
          <DropdownMenuItem onClick={() => run("rejected")}>Rejeitados ({rejected})</DropdownMenuItem>
          <DropdownMenuItem onClick={() => run("both")}>Ambos ({total})</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  const only: "approved" | "rejected" = approved > 0 ? "approved" : "rejected";
  return (
    <Button disabled={pending} className="gap-2" onClick={() => run(only)}>
      <IconDownload className="h-4 w-4" />
      {pending ? "Baixando..." : "Baixar"}
    </Button>
  );
}
