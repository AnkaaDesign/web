import { IconRotateClockwise2 } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Combobox } from "@/components/ui/combobox";
import { WAREHOUSE_LOCATION_TYPE, WAREHOUSE_LOCATION_TYPE_LABELS } from "../../../../constants";

/** Local editable copy of a structure while its editor modal is open. */
export interface StructureDraft {
  id: string;
  name: string;
  type: WAREHOUSE_LOCATION_TYPE;
  section: string | null;
  code: string | null;
  levels: number;
  columns: number;
  width: number;
  height: number;
  rotation: number;
  positionX: number;
  positionY: number;
}

interface Props {
  draft: StructureDraft;
  onChange: (patch: Partial<StructureDraft>) => void;
}

const TYPE_OPTIONS = Object.values(WAREHOUSE_LOCATION_TYPE).map((t) => ({ value: t, label: WAREHOUSE_LOCATION_TYPE_LABELS[t] }));

const numberOr = (raw: string | number | null, fallback: number, min = 0) => {
  const n = typeof raw === "number" ? raw : Number(raw);
  if (raw === null || raw === "" || Number.isNaN(n)) return fallback;
  return Math.max(min, n);
};
const textOrNull = (raw: string | number | null) => {
  const s = raw == null ? "" : String(raw);
  return s.trim() === "" ? null : s;
};

const snap10 = (v: number) => Math.round(v / 10) * 10; // align to the 10 cm grid

/** Form fields for the structure editor — rendered inside a modal Dialog. */
export function WarehouseStructureFields({ draft, onChange }: Props) {
  const isKanban = draft.type === WAREHOUSE_LOCATION_TYPE.ESTANTE_KANBAN; // only kanban shelves have boxes (caixas)
  // Swap width/height around the center → vertical / horizontal orientation.
  const rotate90 = () => {
    const cx = draft.positionX + draft.width / 2;
    const cy = draft.positionY + draft.height / 2;
    const nw = snap10(draft.height);
    const nh = snap10(draft.width);
    onChange({ width: nw, height: nh, positionX: snap10(cx - nw / 2), positionY: snap10(cy - nh / 2) });
  };
  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label className="text-xs">Nome</Label>
        <Input value={draft.name} onChange={(v) => onChange({ name: String(v ?? "") })} placeholder="Ex: Estante A1" />
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs">Tipo</Label>
        <Combobox
          value={draft.type}
          onValueChange={(v) => {
            if (v && !Array.isArray(v)) {
              const type = v as WAREHOUSE_LOCATION_TYPE;
              // Only kanban shelves have boxes (caixas/columns); reset to 1 for the others.
              onChange(type === WAREHOUSE_LOCATION_TYPE.ESTANTE_KANBAN ? { type } : { type, columns: 1 });
            }
          }}
          options={TYPE_OPTIONS}
          mode="single"
          clearable={false}
          placeholder="Selecione o tipo"
          searchable={false}
        />
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs">Código</Label>
        <Input value={draft.code ?? ""} onChange={(v) => onChange({ code: textOrNull(v) })} placeholder="A1" />
      </div>

      <div className={isKanban ? "grid grid-cols-2 gap-3" : "space-y-1.5"}>
        <div className="space-y-1.5">
          <Label className="text-xs">Prateleiras</Label>
          <Input type="number" min={1} value={draft.levels} onChange={(v) => onChange({ levels: numberOr(v, draft.levels, 1) })} />
        </div>
        {isKanban && (
          <div className="space-y-1.5">
            <Label className="text-xs">Caixas</Label>
            <Input type="number" min={1} value={draft.columns} onChange={(v) => onChange({ columns: numberOr(v, draft.columns, 1) })} />
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs">Largura (cm)</Label>
          <Input type="number" min={10} step={10} value={draft.width} onChange={(v) => onChange({ width: snap10(numberOr(v, draft.width, 10)) })} />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Profundidade (cm)</Label>
          <Input type="number" min={10} step={10} value={draft.height} onChange={(v) => onChange({ height: snap10(numberOr(v, draft.height, 10)) })} />
        </div>
      </div>

      <Button type="button" variant="outline" size="sm" className="w-full gap-1.5" onClick={rotate90}>
        <IconRotateClockwise2 className="h-4 w-4" /> Girar 90° (deixar vertical / horizontal)
      </Button>

      <p className="text-[11px] text-muted-foreground">
        Posição: {Math.round(draft.positionX)}, {Math.round(draft.positionY)} cm · arraste a estrutura no mapa para reposicionar.
      </p>
    </div>
  );
}
