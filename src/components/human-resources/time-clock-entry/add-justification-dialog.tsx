import { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Combobox } from "@/components/ui/combobox";
import { useSecullumJustifications } from "../../../hooks";

interface SecullumJustification {
  Id: number;
  NomeAbreviado: string;
  NomeCompleto: string | null;
  Desativar?: boolean;
}

interface AddJustificationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (nomeAbreviado: string) => void;
  fieldLabel: string;
}

export function AddJustificationDialog({ open, onOpenChange, onConfirm, fieldLabel }: AddJustificationDialogProps) {
  const { data: justificationsResp, isLoading } = useSecullumJustifications();
  const [selected, setSelected] = useState<string>("");

  const options = useMemo(() => {
    const list: SecullumJustification[] = (justificationsResp?.data?.data ?? []) as SecullumJustification[];
    return list
      .filter((j) => !j.Desativar)
      .map((j) => ({
        value: j.NomeAbreviado,
        label: j.NomeCompleto ? `${j.NomeAbreviado.trim()} — ${j.NomeCompleto}` : j.NomeAbreviado.trim(),
      }));
  }, [justificationsResp]);

  const handleConfirm = () => {
    if (!selected) return;
    onConfirm(selected);
    setSelected("");
  };

  const handleOpenChange = (next: boolean) => {
    if (!next) setSelected("");
    onOpenChange(next);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Adicionar Justificativa</DialogTitle>
          <DialogDescription>Selecione a justificativa para o campo {fieldLabel}.</DialogDescription>
        </DialogHeader>

        <div className="py-2">
          <Combobox
            mode="single"
            value={selected}
            onValueChange={(v) => setSelected(typeof v === "string" ? v : "")}
            options={options}
            placeholder={isLoading ? "Carregando..." : "Selecione uma justificativa"}
            searchPlaceholder="Buscar justificativa..."
            emptyText="Nenhuma justificativa encontrada"
            disabled={isLoading}
          />
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
            Cancelar
          </Button>
          <Button type="button" onClick={handleConfirm} disabled={!selected}>
            Confirmar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
