/**
 * O que sobrou do cotador no navegador: LER e MEDIR.
 *
 * O motor mudou de casa. Quem decide o que é um adesivo, de que borda se mede e
 * onde a linha de cota assenta é a API — `GET /layout-dimensions/:fileId` —,
 * porque a doutrina são 5.500 linhas calibradas em 2.102 cotas reais e uma
 * segunda cópia (a do celular, em Dart) divergiria da primeira. Provado no
 * acervo inteiro que a conta é a mesma dos dois lados: 231 de 231 arquivos com
 * itens, cotas e avisos idênticos.
 *
 * Aqui ficou só o que é INTERATIVO e por isso não pode depender da rede:
 *
 *  - `readPageGeometry` + `SnapIndex` + `measureBetween` são a RÉGUA. O ímã
 *    tem de responder ao dedo, e o pdf.js já está carregado no visualizador —
 *    buscar as retas no servidor a cada toque seria trocar um acerto instantâneo
 *    por uma ida à rede. (O celular não tem essa sorte: lá o PDFium não expõe
 *    caminho vetorial nenhum, e as retas vêm de `/layout-dimensions/:id/snap`.)
 *  - `detectScaleFrom` diz a escala do arquivo no rodapé, e sai da mesma
 *    leitura.
 *  - `types` e `style` são o vocabulário do desenho: a cota que a API manda, e
 *    o azul da casa com que ela é pintada.
 */

export * from "./types";
export { readPageGeometry } from "./geometry";
export { SnapIndex, measureBetween, measurementToDimension, orientationOf } from "./measure";
export type { Measurement, SnapTarget } from "./measure";
export { DIM_COLOR, STYLE_CM, PT_PER_CM_AT_1_10 } from "./style";
export { detectScale, detectScaleFrom } from "./scale-detect";
export type { ScaleDetection } from "./scale-detect";
