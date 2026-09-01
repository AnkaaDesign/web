/**
 * O cotador de layout, agora servido pela API.
 *
 * Ele já morou aqui dentro — 5.500 linhas de doutrina rodando no navegador. O
 * problema não era o desempenho, era a MULTIPLICAÇÃO: portar para o celular
 * criaria uma segunda cópia, em Dart, com os ~40 limiares calibrados de novo no
 * braço e sem bancada de regressão. Duas cópias divergem, e a divergência
 * aparece como dois números diferentes para o mesmo adesivo — o operador na
 * oficina com o celular e o projetista na mesa com a web.
 *
 * Com o cálculo no servidor há um motor só. O cliente recebe números prontos e
 * não tem opinião sobre eles.
 */

import { apiClient } from "./axiosClient";
import type { Dimension, PageGeometry, PanelSide, Rect } from "@/lib/layout-dimensions";

export interface LayoutItemDto {
  index: number;
  faceIndex: number;
  kind: "sticker" | "wrap";
  side: PanelSide;
  bbox: Rect;
  alignedBoxPt: Rect;
  outlinePt?: { x: number; y: number }[][];
  widthCm: number;
  heightCm: number;
}

export interface LayoutFaceDto {
  index: number;
  side: PanelSide;
  widthCm: number;
  heightCm: number;
  ptPerCm: number;
  panelPt: Rect;
  aspectErrorPct: number;
  unusable?: string;
}

export interface LayoutDimensionsDto {
  pageWidthPt: number;
  pageHeightPt: number;
  pageNumber: number;
  rotation: number;
  detectedScale: {
    ptPerCm: number;
    denominator: number;
    agree: number;
    labels: number;
    source: "cotas-do-arquivo" | "padrao-da-casa";
  };
  faces: LayoutFaceDto[];
  items: LayoutItemDto[];
  dimensions: Dimension[];
  warnings: string[];
}

export interface LayoutSnapDto {
  pageWidthPt: number;
  pageHeightPt: number;
  /** segmentos achatados: 4 números por segmento */
  segments: number[];
  totalSegments: number;
}

/**
 * O plano de cotas já pronto para desenhar, com a geometria da página junto.
 *
 * Antes este tipo era `LayoutDimensionsResult`, do motor que rodava aqui. Agora
 * o motor é do servidor e o cliente só precisa de três coisas: as cotas, os
 * itens em que se toca, e a ponte pt ↔ cm de cada face. A geometria vetorial
 * entra à parte porque ela é do NAVEGADOR — quem a lê é o pdf.js que já está
 * carregado, e ela serve à régua, não às cotas.
 */
export interface LayoutPlan extends LayoutDimensionsDto {
  geometry: PageGeometry;
}

interface Envelope<T> {
  success: boolean;
  message: string;
  data: T;
}

export const layoutDimensionsService = {
  /** O plano de cotas do arquivo. Dezenas de KB — é o que todo mundo abre. */
  async get(
    fileId: string,
    params: { truckId: string; page?: number; rotation?: number },
  ): Promise<LayoutDimensionsDto> {
    const response = await apiClient.get<Envelope<LayoutDimensionsDto>>(
      `/layout-dimensions/${fileId}`,
      { params },
    );
    return response.data.data;
  },

  /**
   * As retas do desenho para o ímã da régua.
   *
   * Pedido à parte de propósito: são 19 mil segmentos na mediana e 248 mil no
   * pior arquivo do acervo, e só quem vai medir na mão precisa deles. Cobrar
   * isso de quem só quer ver as cotas seria pagar megabytes por um recurso que
   * a maioria não toca.
   */
  async snap(
    fileId: string,
    params: { page?: number; rotation?: number } = {},
  ): Promise<LayoutSnapDto> {
    const response = await apiClient.get<Envelope<LayoutSnapDto>>(
      `/layout-dimensions/${fileId}/snap`,
      { params },
    );
    return response.data.data;
  },
};
