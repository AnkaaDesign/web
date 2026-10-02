/**
 * As FACES do implemento — a lista única.
 *
 * Antes cada tela escrevia a sua união `'left' | 'right' | 'back'` à mão (32
 * cópias em 11 arquivos). Quando a face da FRENTE entrar (pacote P21), uma cópia
 * esquecida continuaria compilando e a frente sumiria daquela tela em silêncio.
 * Com o tipo daqui e os mapas como `Record<ImplementFace, …>`, acrescentar
 * `'front'` a `IMPLEMENT_FACES` faz o `tsc` apontar TODO mapa que não a trata.
 *
 * São 4 faces, as do contrato da API (`faces.todas` em
 * `src/generated/contracts/enums.json` — o G18 confere): `left` = lado do
 * motorista, `right` = lado do "sapo", `back` = traseira, `front` = frente. Os
 * rótulos de tela ficam em `FACE_LABEL`.
 */

export const IMPLEMENT_FACES = ["left", "right", "back", "front"] as const;

export type ImplementFace = (typeof IMPLEMENT_FACES)[number];

export function isImplementFace(value: unknown): value is ImplementFace {
  return typeof value === "string" && (IMPLEMENT_FACES as readonly string[]).includes(value);
}

/** Rótulo de tela de cada face (o mesmo texto que o editor de medidas já mostrava). */
export const FACE_LABEL: Record<ImplementFace, string> = {
  left: "Motorista",
  right: "Sapo",
  back: "Traseira",
  front: "Frente",
};

/** As faces que levam FOTO além da medida (contrato: `faces.comFoto`). */
export const IMPLEMENT_FACES_WITH_PHOTO: readonly ImplementFace[] = ["back", "front"];

/** A face leva foto de fundo (traseira e frente)? */
export function faceHasPhoto(face: ImplementFace): boolean {
  return IMPLEMENT_FACES_WITH_PHOTO.includes(face);
}

/**
 * As LATERAIS (motorista e sapo): as faces com portas desenhadas, altura
 * sincronizada entre si e "Copiar/Espelhar" da oposta. Derivadas da lista
 * única: as faces que não levam foto.
 */
export const IMPLEMENT_LATERAL_FACES: readonly ImplementFace[] = IMPLEMENT_FACES.filter(
  (face) => !IMPLEMENT_FACES_WITH_PHOTO.includes(face),
);

export function isLateralFace(face: ImplementFace): boolean {
  return IMPLEMENT_LATERAL_FACES.includes(face);
}

/** A lateral oposta (motorista ↔ sapo). Só faz sentido para lateral. */
export function oppositeLateralFace(face: ImplementFace): ImplementFace {
  return face === "left" ? "right" : "left";
}

/** O campo da medida de cada face no implemento (`implement.*SideMeasure` na API de hoje). */
export const FACE_MEASURE_FIELD = {
  left: "leftSideMeasure",
  right: "rightSideMeasure",
  back: "backSideMeasure",
  front: "frontSideMeasure",
} as const satisfies Record<ImplementFace, string>;

export type ImplementFaceMeasureField = (typeof FACE_MEASURE_FIELD)[ImplementFace];

/**
 * O nome da face no campo multipart da foto (`implementMeasurePhotos.<nome>`),
 * que é como a API recebe a foto junto do salvamento da tarefa.
 */
export const FACE_PHOTO_FIELD = {
  left: "leftSide",
  right: "rightSide",
  back: "backSide",
  front: "frontSide",
} as const satisfies Record<ImplementFace, string>;

export type ImplementFacePhotoField = (typeof FACE_PHOTO_FIELD)[ImplementFace];
