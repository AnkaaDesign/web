import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { ReactNode } from "react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  matchCount: number;
  onConfirm: () => void;
  isLoading?: boolean;
  /** Optional overrides so the same dialog serves NF-side "reset" too. */
  title?: string;
  description?: ReactNode;
}

export function UnmatchConfirmDialog({
  open,
  onOpenChange,
  matchCount,
  onConfirm,
  isLoading,
  title,
  description,
}: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title ?? "Desfazer conciliação"}</DialogTitle>
          <DialogDescription>
            {description ?? (
              <>
                Esta ação removerá {matchCount} vínculo
                {matchCount === 1 ? "" : "s"} entre esta transação e a
                {matchCount === 1 ? "" : "s"} nota{matchCount === 1 ? "" : "s"}{" "}
                fiscal
                {matchCount === 1 ? "" : "is"}. A transação voltará a "Não
                conciliado".
              </>
            )}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isLoading}
          >
            Cancelar
          </Button>
          <Button
            variant="destructive"
            onClick={onConfirm}
            disabled={isLoading}
          >
            {isLoading ? "Desfazendo..." : "Desfazer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
