import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

import { IconDeviceDesktop, IconDeviceMobile, IconFileDownload } from "@tabler/icons-react";
import type { MessageFormData } from "./types";
import { useMemo, useState } from "react";
import { MessageCanvas } from "@/components/messaging/MessageCanvas";
import { transformBlocksForDisplay } from "@/utils/message-transformer";
import { exportMessageToPdf } from "@/utils/message-pdf-export";

interface MessagePreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  data: MessageFormData;
}

export const MessagePreviewDialog = ({ open, onOpenChange, data }: MessagePreviewDialogProps) => {
  const [viewMode, setViewMode] = useState<'desktop' | 'mobile'>('desktop');

  // The dialog receives raw editor blocks — transform to renderer format once.
  const rendererBlocks = useMemo(() => transformBlocksForDisplay(data.blocks), [data.blocks]);

  const handleExportPDF = () => {
    exportMessageToPdf({ title: data.title, blocks: data.blocks });
  };

  // Shared preview surface: title + canonical MessageCanvas render.
  // `compact` = phone-width canvas (16px padding), identical to the mobile app.
  const previewContent = (compact: boolean) => (
    <div className="w-full bg-background text-foreground" id="message-preview-content">
      {/* Title */}
      <div className={compact ? "px-4 pt-4 pb-3" : "px-6 pt-5 pb-4"}>
        <h2 className="text-2xl font-bold break-words">{data.title}</h2>
      </div>
      <Separator />

      {/* Blocks — single canonical pipeline (spec §1) */}
      {data.blocks.length > 0 ? (
        <MessageCanvas blocks={rendererBlocks} compact={compact} className="py-4" />
      ) : (
        <div className="px-6 py-8 text-center text-muted-foreground">
          Nenhum conteúdo adicionado ainda
        </div>
      )}
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl h-[90vh] overflow-hidden flex flex-col p-0 gap-0">
        <DialogHeader className="px-6 pt-6 pb-4 flex-shrink-0">
          <DialogTitle>Preview da Mensagem</DialogTitle>
        </DialogHeader>

        <div className="flex flex-1 overflow-hidden min-h-0">
          {/* Left sidebar with view toggle */}
          <div className="w-48 border-r bg-muted/30 p-4 flex flex-col gap-2 flex-shrink-0">
            <div className="text-sm font-medium text-muted-foreground mb-2">Visualização</div>
            <Button
              variant={viewMode === 'desktop' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setViewMode('desktop')}
              className="justify-start gap-2"
            >
              <IconDeviceDesktop className="h-4 w-4" />
              Desktop
            </Button>
            <Button
              variant={viewMode === 'mobile' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setViewMode('mobile')}
              className="justify-start gap-2"
            >
              <IconDeviceMobile className="h-4 w-4" />
              Mobile
            </Button>

            {viewMode === 'mobile' && (
              <div className="mt-4 p-3 bg-background rounded-lg text-xs text-muted-foreground">
                <div className="font-medium mb-1">iPhone 13/14</div>
                <div>375 × 812 px</div>
              </div>
            )}

            <div className="mt-auto pt-4 border-t">
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportPDF}
                className="w-full justify-start gap-2"
              >
                <IconFileDownload className="h-4 w-4" />
                Exportar PDF
              </Button>
            </div>
          </div>

          {/* Preview area */}
          <div className="flex-1 overflow-hidden bg-muted/20 min-h-0 flex items-center justify-center p-6">
            {viewMode === 'mobile' ? (
              // Mobile frame with realistic design - iPhone 13/14 (375x812 aspect ratio)
              // Using fixed width approach with proper scaling
              <div className="relative flex items-center justify-center w-full h-full">
                <div
                  className="relative"
                  style={{
                    width: '375px',
                    maxWidth: '100%',
                    height: '100%',
                    maxHeight: '812px',
                    aspectRatio: '375 / 812',
                  }}
                >
                  <div className="w-full h-full rounded-[3rem] border-[14px] border-gray-800 dark:border-gray-700 shadow-2xl overflow-hidden bg-white dark:bg-gray-900 flex flex-col">
                    {/* Status bar */}
                    <div className="h-11 bg-white dark:bg-gray-900 flex items-center justify-between px-6 pt-2 flex-shrink-0 relative">
                      <div className="text-xs font-semibold">9:41</div>
                      <div className="absolute left-1/2 top-0 -translate-x-1/2 w-36 h-7 bg-gray-800 dark:bg-gray-900 rounded-b-3xl"></div>
                      <div className="flex items-center gap-1">
                        <svg className="w-4 h-3" viewBox="0 0 16 12" fill="currentColor"><path d="M1 4h2V3H1v1zm3 0h2V3H4v1zm3 0h2V3H7v1zm3 0h2V3h-2v1zm3-1v1h2V3h-2z" opacity=".4"/><path d="M1 6h2V5H1v1zm3 0h2V5H4v1zm3 0h2V5H7v1zm3 0h2V5h-2v1zm3 0h2V5h-2v1zM1 8h2V7H1v1zm3 0h2V7H4v1zm3 0h2V7H7v1zm3 0h2V7h-2v1zm3 0h2V7h-2v1z"/></svg>
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M17.778 8.222c-4.296-4.296-11.26-4.296-15.556 0A1 1 0 01.808 6.808c5.076-5.077 13.308-5.077 18.384 0a1 1 0 01-1.414 1.414zM14.95 11.05a7 7 0 00-9.9 0 1 1 0 01-1.414-1.414 9 9 0 0112.728 0 1 1 0 01-1.414 1.414zM12.12 13.88a3 3 0 00-4.242 0 1 1 0 01-1.415-1.415 5 5 0 017.072 0 1 1 0 01-1.415 1.415zM9 16a1 1 0 011-1h.01a1 1 0 110 2H10a1 1 0 01-1-1z" clipRule="evenodd"/></svg>
                        <svg className="w-6 h-4" fill="currentColor" viewBox="0 0 24 12"><rect x="0" y="0" width="18" height="12" rx="2" opacity=".3"/><rect x="0" y="0" width="14" height="12" rx="2"/><rect x="20" y="4" width="3" height="4" rx="1"/></svg>
                      </div>
                    </div>

                    {/* Content - Only this scrolls. Exactly 375px wide canvas with
                        compact (16px) padding — identical pipeline to the Flutter app. */}
                    <div className="bg-background flex-1 overflow-y-auto min-h-0">
                      {previewContent(true)}
                    </div>

                    {/* Home indicator */}
                    <div className="h-8 bg-white dark:bg-gray-900 flex items-center justify-center flex-shrink-0">
                      <div className="w-32 h-1.5 bg-gray-800 dark:bg-gray-700 rounded-full"></div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              // Desktop view - scrollable content, canvas capped at 672px
              <div className="w-full h-full overflow-y-auto">
                <div className="max-w-[672px] mx-auto overflow-hidden rounded-xl border border-border bg-background text-foreground">
                  {previewContent(false)}
                </div>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
