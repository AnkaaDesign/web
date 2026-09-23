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

/**
 * Uma sequência de literais de face ligados por `|` (união) ou `,` (array), em
 * QUALQUER ordem. Conta como lista de faces escrita à mão quando junta um lado
 * (`left`/`right`) com `back` ou `front`: só `"left" | "right"` é também o
 * alinhamento/direção de mil componentes, e só `"front" | "back"` é a ordem das
 * notas — esses não são faces do implemento.
 */
const SEQUENCIA = /(?:(['"])(?:left|right|back|front)\1\s*[|,]\s*)+(['"])(?:left|right|back|front)\2/g;

function listasDeFaceAMao(fonte: string): string[] {
  const achadas: string[] = [];
  for (const m of fonte.matchAll(SEQUENCIA)) {
    const faces = new Set(m[0].match(/left|right|back|front/g));
    const lado = faces.has("left") || faces.has("right");
    if (lado && (faces.has("back") || faces.has("front"))) achadas.push(m[0]);
  }
  return achadas;
}

describe("nenhuma lista de faces escrita à mão", () => {
  it("o glob enxergou o código-fonte", () => {
    expect(Object.keys(FONTES).length).toBeGreaterThan(500);
  });

  it.each([
    ["união na ordem de hoje", "type L = 'left' | 'right' | 'back';"],
    ["união permutada", "type L = 'right' | 'left' | 'back';"],
    ["array", 'const LADOS = ["left", "right", "back"] as const;'],
    ["Record com face faltando", "type M = Record<'left' | 'back', number>;"],
    ["com a frente", "type L = 'left' | 'right' | 'back' | 'front';"],
  ])("a varredura acusa %s", (_nome, fonte) => {
    expect(listasDeFaceAMao(fonte)).not.toEqual([]);
  });

  it.each([
    ["alinhamento", 'align?: "left" | "right" | "center";'],
    ["direção", 'direction: "left" | "right"'],
    ["ordem das notas", 'where: "front" | "back"'],
  ])("a varredura não acusa %s", (_nome, fonte) => {
    expect(listasDeFaceAMao(fonte)).toEqual([]);
  });

  it("use IMPLEMENT_FACES/ImplementFace em vez de listar as faces à mão", () => {
    const achados = Object.entries(FONTES)
      .map(([arquivo, fonte]) => [arquivo, listasDeFaceAMao(fonte)] as const)
      .filter(([, listas]) => listas.length > 0)
      .map(([arquivo, listas]) => `${arquivo}: ${listas.join(" ; ")}`);
    expect(achados).toEqual([]);
  });
});
