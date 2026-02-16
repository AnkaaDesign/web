import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { buttonVariants } from "@/components/ui/button";

interface UnsavedChangesDialogProps {
  open: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function UnsavedChangesDialog({ open, onConfirm, onCancel }: UnsavedChangesDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={(isOpen) => { if (!isOpen) onCancel(); }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Alterações não salvas</AlertDialogTitle>
          <AlertDialogDescription>
            Você tem alterações que ainda não foram salvas. Se sair agora, essas alterações serão perdidas.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onCancel}>Continuar editando</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm} className={buttonVariants({ variant: "destructive" })}>
            Sair sem salvar
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
