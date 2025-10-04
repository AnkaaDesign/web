import { IconPaperclip, IconDownload, IconFile } from "@tabler/icons-react";

import type { Warning } from "../../../../types";
import { formatFileSize } from "../../../../utils";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface AttachmentsCardProps {
  warning: Warning;
}

export function AttachmentsCard({ warning }: AttachmentsCardProps) {
  if (!warning.attachments || warning.attachments.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <IconPaperclip className="h-5 w-5" />
            Anexos
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <IconFile className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">Nenhum anexo encontrado</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <IconPaperclip className="h-5 w-5" />
            Anexos
          </div>
          <Badge variant="secondary">
            {warning.attachments.length} arquivo{warning.attachments.length !== 1 ? "s" : ""}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {warning.attachments.map((file: any) => (
            <div key={file.id} className="border rounded-lg p-3 hover:bg-muted/50 transition-colors">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0">
                  <div className="h-10 w-10 rounded bg-muted flex items-center justify-center">
                    <IconFile className="h-5 w-5 text-muted-foreground" />
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate" title={file.filename}>
                    {file.filename}
                  </p>
                  <p className="text-xs text-muted-foreground">{formatFileSize(file.size)}</p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="flex-shrink-0"
                  onClick={() => {
                    // Download logic would go here
                    window.open(file.path, "_blank");
                  }}
                >
                  <IconDownload className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
