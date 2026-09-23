// G18 — as faces do implemento moram num lugar só.
//
// O `tsc` já barra o mapa `Record<ImplementFace, …>` que esquecer uma face. O que
// ele NÃO barra é a cópia escrita à mão da união: um `'left' | 'right' | 'back'`
// literal continua compilando quando a frente entrar em `IMPLEMENT_FACES` (P21),
// e aquela tela perde a frente em silêncio. Este teste cobra as duas coisas:
// os mapas cobrem exatamente as faces, e nenhuma união nova nasce fora daqui.
import { describe, it, expect } from "vitest";
import {
  FACE_LABEL,
  FACE_MEASURE_FIELD,
  FACE_PHOTO_FIELD,
  IMPLEMENT_FACES,
  isImplementFace,
} from "./implement-faces";

const sorted = (xs: readonly string[]) => [...xs].sort();

describe("IMPLEMENT_FACES", () => {
  it("tem as 3 faces de hoje, sem repetição", () => {
    expect(IMPLEMENT_FACES).toEqual(["left", "right", "back"]);
    expect(new Set(IMPLEMENT_FACES).size).toBe(IMPLEMENT_FACES.length);
  });

  it.each([
    ["FACE_LABEL", FACE_LABEL],
    ["FACE_MEASURE_FIELD", FACE_MEASURE_FIELD],
    ["FACE_PHOTO_FIELD", FACE_PHOTO_FIELD],
  ] as const)("%s cobre exatamente as faces", (_nome, mapa) => {
    expect(sorted(Object.keys(mapa))).toEqual(sorted(IMPLEMENT_FACES));
    for (const face of IMPLEMENT_FACES) expect(mapa[face]).toBeTruthy();
  });

  it("os rótulos de tela são os que o editor de medidas sempre mostrou", () => {
    expect(FACE_LABEL).toEqual({ left: "Motorista", right: "Sapo", back: "Traseira" });
  });

  it("os campos batem com os nomes que a API espera hoje", () => {
    expect(FACE_MEASURE_FIELD).toEqual({
      left: "leftSideMeasure",
      right: "rightSideMeasure",
      back: "backSideMeasure",
    });
    expect(FACE_PHOTO_FIELD).toEqual({ left: "leftSide", right: "rightSide", back: "backSide" });
  });

  it("isImplementFace aceita só as faces", () => {
    for (const face of IMPLEMENT_FACES) expect(isImplementFace(face)).toBe(true);
    for (const outro of ["front", "LEFT", "", null, undefined, 1]) expect(isImplementFace(outro)).toBe(false);
  });
});

// O Truck Studio tem o seu próprio vocabulário de faces (`MeasureSide`, com outra
// semântica: estrutura do render) e está fora do rework.
const FONTES = import.meta.glob<string>(
  ["/src/**/*.{ts,tsx}", "!/src/pages/tools/truck-studio/**", "!/src/constants/implement-faces*.ts"],
  { query: "?raw", import: "default", eager: true },
);

describe("nenhuma união de faces escrita à mão", () => {
  it("o glob enxergou o código-fonte", () => {
    expect(Object.keys(FONTES).length).toBeGreaterThan(500);
  });

  it("use ImplementFace em vez de 'left' | 'right' | 'back'", () => {
    const uniao = /(['"])left\1\s*\|\s*(['"])right\2\s*\|\s*(['"])back\3/;
    const achados = Object.entries(FONTES)
      .filter(([, fonte]) => uniao.test(fonte))
      .map(([arquivo]) => arquivo);
    expect(achados).toEqual([]);
  });
});
