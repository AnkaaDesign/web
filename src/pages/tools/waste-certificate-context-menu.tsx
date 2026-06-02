import { DropdownMenu, DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { PositionedDropdownMenuContent } from "@/components/ui/positioned-dropdown-menu";
import {
  IconEye,
  IconDownload,
  IconFileCheck,
  IconCopy,
  IconExternalLink,
  IconTrash,
} from "@tabler/icons-react";

export type WasteCertificateAction =
  | "open-here"
  | "download"
  | "download-signed"
  | "copy-link"
  | "open"
  | "delete";

export interface WasteCertificateContextMenuState {
  x: number;
  y: number;
  item: any;
}

interface Props {
  contextMenu: WasteCertificateContextMenuState | null;
  onClose: () => void;
  onAction: (action: WasteCertificateAction, item: any) => void;
}

export function WasteCertificateContextMenu({ contextMenu, onClose, onAction }: Props) {
  if (!contextMenu) return null;

  const { item } = contextMenu;
  const hasGenerated = Boolean(item?.pdfFileId);
  const hasSigned = Boolean(item?.signedFileId);

  return (
    <DropdownMenu open={!!contextMenu} onOpenChange={(open) => !open && onClose()}>
      <PositionedDropdownMenuContent
        position={contextMenu}
        isOpen={!!contextMenu}
        className="min-w-[240px]"
      >
        <DropdownMenuItem onClick={() => onAction("open-here", item)}>
          <IconEye className="mr-2 h-4 w-4" />
          Abrir aqui
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          disabled={!hasGenerated}
          onClick={() => onAction("download", item)}
        >
          <IconDownload className="mr-2 h-4 w-4" />
          Baixar certificado
        </DropdownMenuItem>
        <DropdownMenuItem
          disabled={!hasSigned}
          onClick={() => onAction("download-signed", item)}
        >
          <IconFileCheck className="mr-2 h-4 w-4" />
          Baixar certificado assinado
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onAction("copy-link", item)}>
          <IconCopy className="mr-2 h-4 w-4" />
          Copiar link público
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onAction("open", item)}>
          <IconExternalLink className="mr-2 h-4 w-4" />
          Abrir página pública
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem className="text-destructive" onClick={() => onAction("delete", item)}>
          <IconTrash className="mr-2 h-4 w-4" />
          Excluir
        </DropdownMenuItem>
      </PositionedDropdownMenuContent>
    </DropdownMenu>
  );
}

export default WasteCertificateContextMenu;
