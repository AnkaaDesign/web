import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { WAREHOUSE_LOCATION_TYPE } from "../../../../constants";

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
  /** True when the typed código collides with another structure in the same setor. */
  duplicateCode?: boolean;
}

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

/**
 * Form fields for the structure editor — rendered inside a modal Dialog.
 *
 * The structure TYPE is fixed at creation (chosen from the "Adicionar" toolbar) and is shown in
 * the dialog title, so it is intentionally not editable here. There is no separate "Nome": the
 * map identifies every structure as "setor-código" (e.g. S1-E9), so the código is the only label
 * that matters and the full name is derived from it. Orientation is not a toggle either — just
 * make one side longer than the other (Largura vs Profundidade) and the rack turns to match.
 */
export function WarehouseStructureFields({ draft, onChange, duplicateCode }: Props) {
  const isKanban = draft.type === WAREHOUSE_LOCATION_TYPE.ESTANTE_KANBAN; // only kanban shelves have boxes (caixas)
  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label className="text-xs">Código</Label>
        <Input
          value={draft.code ?? ""}
          onChange={(v) => onChange({ code: textOrNull(v) })}
          placeholder="E9"
          className={cn(duplicateCode && "border-destructive focus-visible:ring-destructive")}
        />
        {duplicateCode ? (
          <p className="text-[11px] text-destructive">Já existe uma estrutura com este código neste setor.</p>
        ) : (
          <p className="text-[11px] text-muted-foreground">Identificada no mapa como {[draft.section, draft.code].filter(Boolean).join("-") || "—"}.</p>
        )}
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

      <p className="text-[11px] text-muted-foreground">
        Posição: {Math.round(draft.positionX)}, {Math.round(draft.positionY)} cm · arraste a estrutura no mapa para reposicionar. Para deixar a estrutura na vertical ou horizontal, basta deixar um lado maior que o outro.
      </p>
    </div>
  );
}
