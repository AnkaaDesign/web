import { useCallback } from "react";
import { IconFileTypePdf, IconHash, IconCalendarPlus, IconCalendarRepeat, IconCalendarDue, IconAlertTriangle } from "@tabler/icons-react";
import { differenceInCalendarDays } from "date-fns";

import { formatDate } from "../../../../utils";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DetailRow } from "@/components/ui/detail-row";
import { FileItem, useFileViewer } from "@/components/common/file";
import type { Fispq } from "@/types/fispq";
import type { File as AnkaaFile } from "../../../../types";
import { getExpiryClassName } from "../list/fispq-table-columns";

interface FispqDocumentCardProps {
  fispq: Fispq;
  className?: string;
}

/** Badge de vencimento da FDS: vencida (vermelho) / a vencer (âmbar) / em dia. */
function ExpiryBadge({ validUntil }: { validUntil: Date | string | null }) {
  if (!validUntil) return null;
  const daysLeft = differenceInCalendarDays(new Date(validUntil), new Date());
  if (daysLeft < 0) {
    return (
      <Badge variant="destructive" className="font-normal whitespace-nowrap">
        <IconAlertTriangle className="h-3 w-3 mr-1" />
        Vencida há {Math.abs(daysLeft)} {Math.abs(daysLeft) === 1 ? "dia" : "dias"}
      </Badge>
    );
  }
  if (daysLeft <= 30) {
    return (
      <Badge variant="amber" className="font-normal whitespace-nowrap">
        Vence em {daysLeft} {daysLeft === 1 ? "dia" : "dias"}
      </Badge>
    );
  }
  return null;
}

export function FispqDocumentCard({ fispq, className }: FispqDocumentCardProps) {
  const { actions } = useFileViewer();

  const handleFileClick = useCallback(
    (file: AnkaaFile) => {
      actions.viewFiles([file], 0);
    },
    [actions],
  );

  return (
    <Card className={cn("shadow-sm border border-border", className)}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <IconFileTypePdf className="h-5 w-5 text-muted-foreground" />
          Documento e validade
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <DetailRow icon={IconHash} label="Revisão" value={fispq.revisionNumber || "-"} />
          <DetailRow icon={IconCalendarPlus} label="Emissão" value={fispq.issueDate ? formatDate(new Date(fispq.issueDate)) : "-"} />
          <DetailRow icon={IconCalendarRepeat} label="Data de revisão" value={fispq.revisionDate ? formatDate(new Date(fispq.revisionDate)) : "-"} />
          <DetailRow
            icon={IconCalendarDue}
            label="Válida até"
            value={
              <div className="flex items-center justify-end gap-2 flex-wrap">
                <span className={getExpiryClassName(fispq.validUntil)}>{fispq.validUntil ? formatDate(new Date(fispq.validUntil)) : "-"}</span>
                <ExpiryBadge validUntil={fispq.validUntil} />
              </div>
            }
          />
        </div>

        {fispq.pdfFile ? (
          <FileItem file={fispq.pdfFile} viewMode="list" onPreview={handleFileClick} />
        ) : (
          <p className="text-sm text-muted-foreground">Nenhum PDF anexado. Use “Editar” para anexar o PDF oficial da FDS.</p>
        )}
      </CardContent>
    </Card>
  );
}
