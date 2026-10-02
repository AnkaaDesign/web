/**
 * As MEDIDAS DO IMPLEMENTO no formulário — o que o editor estilizado
 * (`ImplementMeasureForm`) troca com quem o hospeda.
 *
 * Cada face é `{ height, sections[], photoId, photoFile? }`, em METROS (o editor
 * converte de/para centímetros). Os dois lados (motorista e "sapo") são o mesmo
 * baú visto de cada lado: o comprimento tem de bater, com folga de 2 cm.
 *
 * Puro; extraído do formulário de criação de tarefa para o orçamento usar o
 * mesmo desenho e a mesma regra.
 */
import type { ImplementFace } from "@/constants/implement-faces";

export interface MeasureSection {
  width: number;
  isDoor: boolean;
  doorHeight: number | null;
  position: number;
}

export interface MeasureLayout {
  height: number;
  sections: MeasureSection[];
  photoId?: string | null;
  photoFile?: File | null;
}

/** A face em branco: 1 m × 1 m, sem porta — o ponto de partida do editor. */
export function defaultMeasureLayout(): MeasureLayout {
  return { height: 1, sections: [{ width: 1, isDoor: false, doorHeight: null, position: 0 }], photoId: null };
}

/** A face gravada (`implement.*SideMeasure`) na forma do editor; `null` sem seções. */
export function measureLayoutFromSaved(saved: any): MeasureLayout | null {
  if (!saved?.sections || saved.sections.length === 0) return null;
  return {
    height: saved.height,
    sections: saved.sections.map((s: any) => ({
      width: s.width,
      isDoor: s.isDoor,
      doorHeight: s.doorHeight,
      position: s.position,
    })),
    photoId: saved.photoId ?? null,
  };
}

/** O que vai para a API na face (`implement.<face>SideMeasure`): sem o `File`. */
export function measurePayloadOf(layout: MeasureLayout, uploadedPhotoId?: string | null) {
  return {
    height: layout.height,
    sections: layout.sections,
    photoId: uploadedPhotoId || layout.photoId || null,
  };
}

/** O comprimento da face em centímetros (0 sem seções). */
export function measureTotalWidthCm(layout: { sections?: readonly { width?: number | null }[] | null } | null | undefined): number {
  const sections = layout?.sections ?? [];
  return Math.round(sections.reduce((sum, s) => sum + (s?.width || 0), 0) * 100);
}

/** Folga entre os dois lados, em metros. */
const MAX_SIDE_DIFFERENCE_M = 0.02;

/**
 * O motivo de recusa quando os lados não fecham, ou `null`.
 * Só compara quando os DOIS lados têm seções.
 */
export function measuresWidthError(layouts: Partial<Record<ImplementFace, { sections?: readonly { width?: number | null }[] | null } | null | undefined>>): string | null {
  const left = layouts.left?.sections ?? [];
  const right = layouts.right?.sections ?? [];
  if (left.length === 0 || right.length === 0) return null;
  const leftM = left.reduce((sum, s) => sum + (s?.width || 0), 0);
  const rightM = right.reduce((sum, s) => sum + (s?.width || 0), 0);
  const difference = Math.abs(leftM - rightM);
  if (difference <= MAX_SIDE_DIFFERENCE_M) return null;
  return (
    `O implemento tem diferença de comprimento maior que 2 cm entre os lados. ` +
    `Lado Motorista: ${(leftM * 100).toFixed(0)} cm, Lado Sapo: ${(rightM * 100).toFixed(0)} cm ` +
    `(diferença de ${(difference * 100).toFixed(1)} cm).`
  );
}
