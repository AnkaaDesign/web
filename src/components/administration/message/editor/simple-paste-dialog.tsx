import { useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { IconClipboardText, IconTrash } from "@tabler/icons-react";
import { htmlToContentBlocks } from "@/utils/message-rich-paste";
import type { ContentBlock } from "./types";

interface SimplePasteDialogProps {
  open: boolean;
  onClose: () => void;
  /** Receives the content blocks parsed from the pasted text (logo/footer added by the caller). */
  onInsert: (blocks: ContentBlock[]) => void;
}

// Short human summary of what was detected, to reassure the user before inserting.
function summarize(blocks: ContentBlock[]): string {
  const counts: Record<string, number> = {};
  for (const b of blocks) counts[b.type] = (counts[b.type] || 0) + 1;
  const parts: string[] = [];
  const headings = (counts.heading1 || 0) + (counts.heading2 || 0);
  if (headings) parts.push(`${headings} título${headings > 1 ? 's' : ''}`);
  if (counts.paragraph) parts.push(`${counts.paragraph} parágrafo${counts.paragraph > 1 ? 's' : ''}`);
  if (counts.list) parts.push(`${counts.list} lista${counts.list > 1 ? 's' : ''}`);
  if (counts.quote) parts.push(`${counts.quote} citação${counts.quote > 1 ? 'ões' : ''}`);
  return parts.join(' · ');
}

export const SimplePasteDialog = ({ open, onClose, onInsert }: SimplePasteDialogProps) => {
  const editorRef = useRef<HTMLDivElement>(null);
  const [blocks, setBlocks] = useState<ContentBlock[]>([]);

  const reparse = () => {
    const el = editorRef.current;
    if (!el) return;
    setBlocks(htmlToContentBlocks(el.innerHTML));
  };

  const handleClear = () => {
    if (editorRef.current) editorRef.current.innerHTML = '';
    setBlocks([]);
  };

  const handleClose = () => {
    handleClear();
    onClose();
  };

  const handleInsert = () => {
    if (!blocks.length) return;
    onInsert(blocks);
    handleClear();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <IconClipboardText className="h-5 w-5" />
            Colar conteúdo formatado
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3 mt-2">
          <p className="text-sm text-muted-foreground">
            Cole (<kbd className="px-1 py-0.5 rounded bg-muted text-xs">Ctrl/Cmd + V</kbd>) seu texto já formatado
            abaixo. Negrito, itálico, sublinhado, links, listas e o espaçamento entre parágrafos serão preservados.
            O logo no topo e o rodapé serão adicionados automaticamente.
          </p>

          <div
            ref={editorRef}
            contentEditable
            suppressContentEditableWarning
            onInput={reparse}
            data-placeholder="Cole seu conteúdo aqui..."
            className="min-h-[220px] max-h-[45vh] overflow-y-auto rounded-md border border-input bg-background p-4 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring prose prose-sm dark:prose-invert max-w-none empty:before:content-[attr(data-placeholder)] empty:before:text-muted-foreground empty:before:pointer-events-none [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5"
          />

          <div className="flex items-center justify-between gap-2 min-h-[2rem]">
            <span className="text-xs text-muted-foreground">
              {blocks.length ? `Detectado: ${summarize(blocks)}` : 'Nenhum conteúdo detectado ainda.'}
            </span>
            {blocks.length > 0 && (
              <Button variant="ghost" size="sm" className="gap-1 text-muted-foreground" onClick={handleClear}>
                <IconTrash className="h-4 w-4" />
                Limpar
              </Button>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" onClick={handleClose}>
              Cancelar
            </Button>
            <Button onClick={handleInsert} disabled={!blocks.length}>
              Inserir conteúdo
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
