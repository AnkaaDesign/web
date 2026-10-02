/**
 * AS MEDIDAS DO IMPLEMENTO, no desenho estilizado — as três faces, o
 * comprimento total e a conferência entre os lados.
 *
 * O mesmo editor do formulário de tarefa (`ImplementMeasureForm`), embrulhado
 * para quem só precisa de "estas são as faces, avise quando uma mudar". O
 * orçamento o usa no passo Veículos; quem hospeda decide o que gravar (só as
 * faces em `modifiedSides`).
 */
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FACE_LABEL, IMPLEMENT_FACES, faceHasPhoto, type ImplementFace } from "@/constants/implement-faces";
import { defaultMeasureLayout, measureTotalWidthCm, type MeasureLayout } from "@/utils/implement-measures";
import { ImplementMeasureForm } from "./implement-measure-form";

interface ImplementMeasuresEditorProps {
  /** A face como está agora (rascunho ou gravada); ausente = em branco. */
  layouts: Partial<Record<ImplementFace, MeasureLayout | null>>;
  /** Faces que o operador mexeu nesta tela. */
  modifiedSides: ReadonlySet<ImplementFace>;
  /** Faces que já têm medida gravada. */
  savedSides?: ReadonlySet<ImplementFace>;
  onSideChange: (side: ImplementFace, layout: MeasureLayout) => void;
  validationError?: string | null;
  disabled?: boolean;
}

export function ImplementMeasuresEditor({
  layouts,
  modifiedSides,
  savedSides,
  onSideChange,
  validationError,
  disabled,
}: ImplementMeasuresEditorProps) {
  const [side, setSide] = useState<ImplementFace>("left");
  // Sempre com seções: sem elas o editor emite o estado inicial como se fosse
  // uma edição, e a face apareceria "modificada" sem ninguém ter mexido.
  const layout = layouts[side] ?? defaultMeasureLayout();

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-2">
          {IMPLEMENT_FACES.map((face) => (
            <Button
              key={face}
              type="button"
              size="sm"
              variant={side === face ? "default" : "outline"}
              onClick={() => setSide(face)}
            >
              {FACE_LABEL[face]}
              {modifiedSides.has(face) ? (
                <Badge variant="success" className="ml-2">
                  Modificado
                </Badge>
              ) : savedSides?.has(face) ? (
                <Badge variant="secondary" className="ml-2">
                  Configurado
                </Badge>
              ) : null}
            </Button>
          ))}
        </div>
        <div className="rounded-md bg-primary/10 px-3 py-1 text-sm">
          <span className="text-muted-foreground">Comprimento Total: </span>
          <span className="font-semibold text-foreground">{measureTotalWidthCm(layout)} cm</span>
        </div>
      </div>
      <ImplementMeasureForm
        selectedSide={side}
        layout={layout as any}
        validationError={validationError}
        onChange={(face, data) => onSideChange(face, data as MeasureLayout)}
        showPhoto={faceHasPhoto(side)}
        disabled={disabled}
      />
    </div>
  );
}
