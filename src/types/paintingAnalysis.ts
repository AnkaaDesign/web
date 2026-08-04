// packages/types/src/paintingAnalysis.ts

import type { BaseCreateResponse, BaseDeleteResponse, BaseEntity, BaseGetManyResponse, BaseGetUniqueResponse, BaseUpdateResponse } from "./common";
import type { File } from "./file";
import type { ImplementMeasure } from "./implementMeasure";
import type { Item } from "./item";
import type { Paint, PaintType } from "./paint";
import type { Task } from "./task";

// =====================
// Enums (mirror api prisma enums Painting*)
// =====================

export type PaintingAnalysisStatus = "DRAFT" | "PROCESSING" | "REVIEW" | "APPROVED" | "ARCHIVED" | "FAILED";
export type PaintingServiceContext = "NEW_IMPLEMENT" | "REFORM";
export type PaintingSubstrate = "CHAPA_FRISOS" | "ISOPLASTIC" | "SIDER_LONA" | "OUTRO";
export type PaintingFaceView = "LEFT_SIDE" | "RIGHT_SIDE" | "BACK" | "FRONT" | "ROOF";
export type PaintingReferenceKind = "TOTAL_LENGTH" | "WIDTH" | "SIDE_HEIGHT" | "HEIGHT";
export type PaintingBackgroundMode = "WHITE_PLATE" | "GENERAL_PAINT" | "SIDER_CANVAS";
export type PaintingRegionKind = "CHAPADA" | "DEGRADE" | "FOTOGRAFICO" | "MICRO" | "TEXTURA" | "RESERVA";
export type PaintingStrategy = "ADESIVO_RECORTE" | "FITA_CORTE" | "FITA_FLEXIVEL" | "STENCIL" | "CURA_ADESIVO" | "AEROGRAFIA" | "AEROGRAFIA_ARTISTICA" | "NENHUMA";
export type PaintingBoundaryKind = "PAINT_PAINT" | "WITH_BACKGROUND" | "KEYLINE";
export type PaintingBoundaryResolution = "FITA_CORTE" | "FITA_FLEXIVEL" | "CURA_ADESIVO" | "NENHUMA";
export type PaintingValueSource = "AUTO" | "MANUAL";
/** Natureza da linha de custo — mão de obra NÃO é material. */
export type PaintingCostLineKind = "MATERIAL" | "MAO_DE_OBRA" | "SERVICO" | "EQUIPAMENTO";
export type PaintingMeasureBasis = "AREA" | "LINEAR" | "VOLUME" | "UNIT" | "TIME";
export type PaintingCoatRole = "GROUND" | "COLOR" | "CLEAR";
export type PaintingStepKind =
  | "REMOCAO_ADESIVO_ANTIGO"
  | "REMOCAO_REFLETIVA"
  | "DESMONTAGEM"
  | "REMONTAGEM"
  | "PREPARACAO"
  | "SECAGEM"
  | "MASCARAMENTO"
  | "LIMPEZA_TETO"
  | "PINTURA_TETO"
  | "LAVAGEM"
  | "VEDACAO_PU"
  | "EMPAPELAMENTO"
  | "MASCARAMENTO_LIQUIDO"
  | "LIXAMENTO"
  | "FUNDO"
  | "PINTURA"
  | "VERNIZ"
  | "ADESIVO_PLOTAGEM"
  | "ADESIVO_DEPILACAO"
  | "ADESIVO_APLICACAO"
  | "FITA"
  | "CORTE"
  | "STENCIL"
  | "CURA"
  | "REMOCAO_MASCARA"
  | "AEROGRAFIA"
  | "APLICACAO_REFLETIVA"
  | "LIMPEZA"
  | "INSPECAO";
export type PaintingRateMode = "M2_PER_MIN" | "M_PER_MIN" | "CM_PER_MIN" | "MIN_FIXED" | "MIN_PER_UNIT";
export type PaintingIndirectMode = "FIXED" | "PER_HOUR" | "PER_M2" | "PCT_COST" | "PCT_PRICE";
export type PaintingAlertSeverity = "INFO" | "WARNING" | "ERROR";
export type PaintingComputeStage = "MATCH" | "STRATEGY" | "PLAN";

// =====================
// Labels (pt-BR)
// =====================

export const PAINTING_ANALYSIS_STATUS_LABELS: Record<PaintingAnalysisStatus, string> = {
  DRAFT: "Rascunho",
  PROCESSING: "Processando",
  REVIEW: "Em Revisão",
  APPROVED: "Aprovada",
  ARCHIVED: "Arquivada",
  FAILED: "Falhou",
};

export const PAINTING_SERVICE_CONTEXT_LABELS: Record<PaintingServiceContext, string> = {
  NEW_IMPLEMENT: "Implemento Novo",
  REFORM: "Reforma",
};

export const PAINTING_SUBSTRATE_LABELS: Record<PaintingSubstrate, string> = {
  CHAPA_FRISOS: "Carga Seca",
  ISOPLASTIC: "Isoplastic",
  SIDER_LONA: "Lona",
  OUTRO: "Refrigerado",
};

export const PAINTING_FACE_VIEW_LABELS: Record<PaintingFaceView, string> = {
  LEFT_SIDE: "Lateral Esquerda",
  RIGHT_SIDE: "Lateral Direita",
  BACK: "Traseira",
  FRONT: "Frente",
  ROOF: "Teto",
};

export const PAINTING_REFERENCE_KIND_LABELS: Record<PaintingReferenceKind, string> = {
  TOTAL_LENGTH: "Comprimento Total",
  WIDTH: "Largura",
  SIDE_HEIGHT: "Altura da Lateral",
  HEIGHT: "Altura",
};

export const PAINTING_BACKGROUND_MODE_LABELS: Record<PaintingBackgroundMode, string> = {
  WHITE_PLATE: "Chapa Branca",
  GENERAL_PAINT: "Pintura Geral",
  SIDER_CANVAS: "Lona Sider",
};

export const PAINTING_REGION_KIND_LABELS: Record<PaintingRegionKind, string> = {
  CHAPADA: "Chapada",
  DEGRADE: "Degradê",
  FOTOGRAFICO: "Fotográfico",
  MICRO: "Micro",
  TEXTURA: "Textura",
  RESERVA: "Reserva",
};

export const PAINTING_STRATEGY_LABELS: Record<PaintingStrategy, string> = {
  ADESIVO_RECORTE: "Adesivo Recorte",
  FITA_CORTE: "Fita + Corte",
  FITA_FLEXIVEL: "Fita Flexível",
  STENCIL: "Stencil",
  CURA_ADESIVO: "Cura + Adesivo",
  AEROGRAFIA: "Aerografia",
  AEROGRAFIA_ARTISTICA: "Aerografia Artística",
  NENHUMA: "Nenhuma",
};

export const PAINTING_BOUNDARY_KIND_LABELS: Record<PaintingBoundaryKind, string> = {
  PAINT_PAINT: "Tinta × Tinta",
  WITH_BACKGROUND: "Com Fundo",
  KEYLINE: "Keyline",
};

export const PAINTING_BOUNDARY_RESOLUTION_LABELS: Record<PaintingBoundaryResolution, string> = {
  FITA_CORTE: "Fita + Corte",
  FITA_FLEXIVEL: "Fita Flexível",
  CURA_ADESIVO: "Cura + Adesivo",
  NENHUMA: "Nenhuma",
};

export const PAINTING_COST_LINE_KIND_LABELS: Record<PaintingCostLineKind, string> = {
  MATERIAL: "Materiais",
  MAO_DE_OBRA: "Mão de obra",
  SERVICO: "Serviços",
  EQUIPAMENTO: "Equipamentos",
};

export const PAINTING_STEP_KIND_LABELS: Record<PaintingStepKind, string> = {
  REMOCAO_ADESIVO_ANTIGO: "Remoção de Adesivo Antigo",
  REMOCAO_REFLETIVA: "Remoção de Refletiva",
  DESMONTAGEM: "Desmontagem",
  REMONTAGEM: "Remontagem",
  PREPARACAO: "Preparação",
  SECAGEM: "Secagem",
  MASCARAMENTO: "Mascaramento",
  LIMPEZA_TETO: "Limpeza do Teto",
  PINTURA_TETO: "Pintura do Teto",
  LAVAGEM: "Lavagem",
  VEDACAO_PU: "Vedação PU",
  EMPAPELAMENTO: "Empapelamento",
  MASCARAMENTO_LIQUIDO: "Mascaramento Líquido",
  LIXAMENTO: "Lixamento",
  FUNDO: "Fundo",
  PINTURA: "Pintura",
  VERNIZ: "Verniz",
  ADESIVO_PLOTAGEM: "Adesivo — Plotagem",
  ADESIVO_DEPILACAO: "Adesivo — Depilação",
  ADESIVO_APLICACAO: "Adesivo — Aplicação",
  FITA: "Fita",
  CORTE: "Corte",
  STENCIL: "Stencil",
  CURA: "Cura",
  REMOCAO_MASCARA: "Remoção de Máscara",
  AEROGRAFIA: "Aerografia",
  APLICACAO_REFLETIVA: "Aplicação de Refletiva",
  LIMPEZA: "Limpeza",
  INSPECAO: "Inspeção",
};

export const PAINTING_RATE_MODE_LABELS: Record<PaintingRateMode, string> = {
  M2_PER_MIN: "m²/min",
  M_PER_MIN: "m/min",
  CM_PER_MIN: "cm/min",
  MIN_FIXED: "min fixo",
  MIN_PER_UNIT: "min/unidade",
};

export const PAINTING_INDIRECT_MODE_LABELS: Record<PaintingIndirectMode, string> = {
  FIXED: "Fixo",
  PER_HOUR: "Por hora",
  PER_M2: "Por m²",
  PCT_COST: "% do custo",
  PCT_PRICE: "% do preço",
};

// =====================
// Engine Artifact (JSON persisted by the processing engine)
// =====================

export interface PaintingEngineImageInfo {
  workWidthPx: number;
  workHeightPx: number;
}

export interface PaintingEnginePaletteEntry {
  index: number;
  hex: string;
  pixelPct: number;
}

export interface PaintingEngineArtifact {
  image: PaintingEngineImageInfo;
  palette?: PaintingEnginePaletteEntry[];
  adhesive?: unknown[];
  photoZoneAreaPct?: number | null;
}

export interface PaintingRegionGeometry {
  contour: Array<[number, number]>;
  holes?: Array<Array<[number, number]>>;
  centroid?: [number, number];
  isBackground?: boolean;
}

// =====================
// Visualização por passo (cena AUTOCONTIDA emitida pelo motor — rects cumulativos com phase)
// =====================

export type PaintingVisualizationBaseMode = "BW" | "COLOR";
export type PaintingVisualizationRectKind = "ADHESIVE_BAND" | "PAPER" | "PAINT_WINDOW";
/** PRIOR = herdado de passos anteriores (ênfase reduzida); CURRENT = deste passo. */
export type PaintingVisualizationPhase = "PRIOR" | "CURRENT";

export interface PaintingVisualizationRect {
  /** Coordenadas em CENTÍMETROS, origem no canto superior esquerdo da face. */
  x: number;
  y: number;
  w: number;
  h: number;
  kind: PaintingVisualizationRectKind;
  phase?: PaintingVisualizationPhase;
  color?: string | null;
  label?: string | null;
}

export interface PaintingStepVisualization {
  baseMode: PaintingVisualizationBaseMode;
  rects: PaintingVisualizationRect[];
}

// =====================
// Main Entity Interfaces
// =====================

export interface PaintingRegion extends BaseEntity {
  faceId: string;
  engineId: number;
  colorHex: string;

  paintId: string | null;
  paint?: Paint | null;
  paintSource: PaintingValueSource;

  kind: PaintingRegionKind;
  kindSource: PaintingValueSource;

  strategy: PaintingStrategy;
  strategySource: PaintingValueSource;

  areaM2: number;
  perimeterM: number;
  islands: number;
  minStrokeMm: number | null;
  bboxWidthCm: number | null;
  bboxHeightCm: number | null;

  geometry: PaintingRegionGeometry | null;
  gradient?: unknown;
}

export interface PaintingBoundary extends BaseEntity {
  faceId: string;
  engineId: number;
  regionAId: string | null;
  regionBId: string | null;

  kind: PaintingBoundaryKind;
  lengthM: number;
  dominantCurve: string | null;
  curveHist?: unknown;
  corners: number | null;

  resolution: PaintingBoundaryResolution;
  resolutionSource: PaintingValueSource;

  cutLengthM: number | null;
  tapeLengthM: number | null;
  samplePath?: unknown;
}

export interface PaintingAnalysisFace extends BaseEntity {
  analysisId: string;
  view: PaintingFaceView;

  fileId: string;
  file?: File;

  referenceKind: PaintingReferenceKind;
  referenceValueCm: number;
  pxPerCm: number | null;
  widthCm: number | null;
  heightCm: number | null;
  areaM2: number | null;

  backgroundMode: PaintingBackgroundMode | null;
  backgroundModeSource?: PaintingValueSource;
  backgroundHex: string | null;
  backgroundPaintId?: string | null;

  engineArtifact?: PaintingEngineArtifact | null;
  processedAt: Date | string | null;

  regions?: PaintingRegion[];
  boundaries?: PaintingBoundary[];
}

export interface PaintingStepMaterial extends BaseEntity {
  stepId: string;
  label: string;
  /** Especificação do insumo p/ a coluna Tamanho (ex.: "Rolo 60 cm"); ausente → "—". */
  sizeLabel?: string | null;
  /** Agrupa a tabela do passo: MATERIAL | MAO_DE_OBRA | SERVICO | EQUIPAMENTO. */
  kind?: PaintingCostLineKind;
  basis?: PaintingMeasureBasis;
  crewSize?: number;
  position?: number;
  /** Base do consumo (ex.: 53,24 m²); com `quantity` dá o rendimento exibido. */
  basisQuantity?: number | null;
  basisUnit?: string | null;
  quantity: number;
  unit: string;
  unitPriceSnapshot: number;
  totalCost: number;

  itemId?: string | null;
  item?: Item | null;
  paintId?: string | null;
  paint?: Paint | null;
}

/** Sub-tarefa do passo (checklist) — cada uma com seus minutos e tamanho de equipe. */
export interface PaintingStepTask extends BaseEntity {
  stepId: string;
  position: number;
  label: string;
  rateKey: string | null;
  basisQuantity: number;
  basisUnit: string | null;
  minutes: number;
  minutesSource: PaintingValueSource;
  crewSize: number;
}

export interface PaintingProductionStep extends BaseEntity {
  planId: string;
  position: number;
  day: number;
  session: number;

  kind: PaintingStepKind;
  title: string;
  description: string | null;

  quantity: number | null;
  quantityUnit: string | null;
  rateUsed: number | null;

  minutes: number;
  minutesSource: PaintingValueSource;
  waitMinutes: number;

  actualMinutes?: number | null;
  actualNotes?: string | null;

  laborCost: number;
  materialCost: number;

  faceId: string | null;
  regionIds?: unknown;
  windowAreaM2?: number | null;
  /** Populado pelo compute; ausente/null enquanto a API não emite a cena do passo. */
  visualization?: PaintingStepVisualization | null;

  materials?: PaintingStepMaterial[];
  tasks?: PaintingStepTask[];
}

export interface PaintingProductionPlan extends BaseEntity {
  analysisId: string;

  totalMinutes: number;
  totalWaitMinutes: number;
  totalDays: number;

  materialCost: number;
  laborCost: number;
  indirectCost: number;
  totalCost: number;
  profitMarginPct: number;
  suggestedPrice: number;
  laborRatePerHour: number;
  priceSnapshotAt: Date | string | null;

  steps?: PaintingProductionStep[];
}

export interface PaintingAnalysisAlert extends BaseEntity {
  analysisId: string;
  code: string;
  severity: PaintingAlertSeverity;
  message: string;
  resolvedAt: Date | string | null;
}

export interface PaintingAnalysis extends BaseEntity {
  name: string;
  status: PaintingAnalysisStatus;
  serviceContext: PaintingServiceContext;
  substrate: PaintingSubstrate;
  alreadyPrepared: boolean;
  processingError?: string | null;

  taskId?: string | null;
  task?: Task | null;
  implementMeasureId?: string | null;
  implementMeasure?: ImplementMeasure | null;

  // --- programa de superfície (pintura geral) ---
  /** DERIVADO da arte no compute — não é escolha do usuário. */
  generalPaint: boolean;
  paintSystemKey?: string | null;
  /** Override manual da cor detectada na arte. */
  targetPaintId?: string | null;
  targetPaint?: Paint | null;
  /** ÚNICAS medidas digitadas (cm); largura, teto, chassi e frames são inferidos. */
  lengthCm?: number | null;
  heightCm?: number | null;

  faces?: PaintingAnalysisFace[];
  plan?: PaintingProductionPlan | null;
  alerts?: PaintingAnalysisAlert[];
}

// =====================
// Config Entities
// =====================

export interface PaintingProductivityRate extends BaseEntity {
  key: string;
  label: string;
  mode: PaintingRateMode;
  value: number;
  complexityFactorMedium: number;
  complexityFactorHigh: number;
  notes: string | null;
}

export interface PaintingIndirectCost extends BaseEntity {
  key: string;
  label: string;
  mode: PaintingIndirectMode;
  value: number;
  active: boolean;
}

export interface PaintingRule extends BaseEntity {
  key: string;
  label: string;
  params: Record<string, unknown> | null;
  active: boolean;
  position: number;
}

export interface PaintingProcessParams extends BaseEntity {
  paintTypeId: string;
  paintType?: PaintType | null;
  coatsDefault: number;
  coverageM2PerL: number;
  sprayLossPct: number;
  prepLossPct: number;
  cureMinutes: number;
  needsClearCoat: boolean;
}

/** Sistema de pintura: esquema de demãos + catálise/diluição. */
export interface PaintingPaintSystem extends BaseEntity {
  key: string;
  label: string;
  paintTypeId: string | null;
  paintType?: PaintType | null;
  coatsSchedule: Array<{ role: PaintingCoatRole; systemKey: string; coats: number }>;
  mixBase: number;
  mixCatalyst: number;
  mixThinner: number;
  catalystItemId: string | null;
  catalystItem?: Item | null;
  thinnerItemId: string | null;
  thinnerItem?: Item | null;
  coverageM2PerL: number;
  sprayLossPct: number;
  prepLossPct: number;
  minBatchL: number;
  cureMinutes: number;
  needsConfirmation: boolean;
  active: boolean;
  position: number;
}

export interface PaintingConfig {
  rates: PaintingProductivityRate[];
  indirects: PaintingIndirectCost[];
  rules: PaintingRule[];
  processParams: PaintingProcessParams[];
  paintSystems: PaintingPaintSystem[];
}

// =====================
// Form Data (request payloads)
// =====================

export interface PaintingAnalysisGetManyFormData {
  page?: number;
  limit?: number;
  searchingFor?: string;
  status?: PaintingAnalysisStatus;
}

/** Só o que o usuário digita — todo o resto é inferido ou vem da arte. */
export interface PaintingSurfaceFormData {
  paintSystemKey?: string | null;
  targetPaintId?: string | null;
  lengthCm?: number | null;
  heightCm?: number | null;
}

export interface PaintingAnalysisCreateFormData extends PaintingSurfaceFormData {
  name: string;
  serviceContext: PaintingServiceContext;
  substrate: PaintingSubstrate;
  /** Legado — o implemento nunca chega preparado; a API assume false. */
  alreadyPrepared?: boolean;
  taskId?: string;
  implementMeasureId?: string;
}

export interface PaintingAnalysisUpdateFormData extends PaintingSurfaceFormData {
  name?: string;
  serviceContext?: PaintingServiceContext;
  substrate?: PaintingSubstrate;
  alreadyPrepared?: boolean;
  status?: PaintingAnalysisStatus;
}

export interface PaintingAnalysisFaceCreateFormData {
  file: globalThis.File;
  view: PaintingFaceView;
  referenceKind: PaintingReferenceKind;
  referenceValueCm: number;
}

export interface PaintingAnalysisFaceUpdateFormData {
  referenceKind?: PaintingReferenceKind;
  referenceValueCm?: number;
  backgroundMode?: PaintingBackgroundMode;
  backgroundPaintId?: string | null;
}

export interface PaintingAnalysisProcessFormData {
  faceIds?: string[];
  stages?: string[];
}

export interface PaintingAnalysisComputeFormData {
  stages?: PaintingComputeStage[];
}

export interface PaintingRegionUpdateFormData {
  paintId?: string;
  kind?: PaintingRegionKind;
  strategy?: PaintingStrategy;
}

export interface PaintingBoundaryUpdateFormData {
  resolution: PaintingBoundaryResolution;
}

export interface PaintingStepUpdateFormData {
  minutes?: number;
  actualMinutes?: number;
  actualNotes?: string;
}

export interface PaintingStepTaskUpdateFormData {
  minutes?: number;
}

export interface PaintingStepMaterialUpdateFormData {
  quantity?: number;
  unitPrice?: number;
}

export interface PaintingPaintSystemUpdateFormData {
  label?: string;
  paintTypeId?: string | null;
  coatsSchedule?: Array<{ role: PaintingCoatRole; systemKey: string; coats: number }>;
  mixBase?: number;
  mixCatalyst?: number;
  mixThinner?: number;
  catalystItemId?: string | null;
  thinnerItemId?: string | null;
  coverageM2PerL?: number;
  sprayLossPct?: number;
  prepLossPct?: number;
  minBatchL?: number;
  cureMinutes?: number;
  needsConfirmation?: boolean;
  active?: boolean;
}

export interface PaintingRateUpdateFormData {
  value?: number;
  complexityFactorMedium?: number;
  complexityFactorHigh?: number;
  notes?: string;
}

export interface PaintingIndirectUpdateFormData {
  value?: number;
  active?: boolean;
}

export interface PaintingRuleUpdateFormData {
  params?: Record<string, unknown>;
  active?: boolean;
}

export interface PaintingProcessParamsUpdateFormData {
  coatsDefault?: number;
  coverageM2PerL?: number;
  sprayLossPct?: number;
  prepLossPct?: number;
  cureMinutes?: number;
  needsClearCoat?: boolean;
}

// =====================
// API Response Types
// =====================

export interface PaintingAnalysisGetUniqueResponse extends BaseGetUniqueResponse<PaintingAnalysis> {}
export interface PaintingAnalysisGetManyResponse extends BaseGetManyResponse<PaintingAnalysis> {}
export interface PaintingAnalysisCreateResponse extends BaseCreateResponse<PaintingAnalysis> {}
export interface PaintingAnalysisUpdateResponse extends BaseUpdateResponse<PaintingAnalysis> {}
export interface PaintingAnalysisDeleteResponse extends BaseDeleteResponse {}

export interface PaintingAnalysisFaceCreateResponse extends BaseCreateResponse<PaintingAnalysisFace> {}
export interface PaintingAnalysisFaceUpdateResponse extends BaseUpdateResponse<PaintingAnalysisFace> {}
export interface PaintingAnalysisFaceDeleteResponse extends BaseDeleteResponse {}

export interface PaintingRegionUpdateResponse extends BaseUpdateResponse<PaintingRegion> {}
export interface PaintingBoundaryUpdateResponse extends BaseUpdateResponse<PaintingBoundary> {}
export interface PaintingStepUpdateResponse extends BaseUpdateResponse<PaintingProductionStep> {}
export interface PaintingStepTaskUpdateResponse extends BaseUpdateResponse<PaintingStepTask> {}
export interface PaintingStepMaterialUpdateResponse extends BaseUpdateResponse<PaintingStepMaterial> {}
export interface PaintingPaintSystemUpdateResponse extends BaseUpdateResponse<PaintingPaintSystem> {}
export interface PaintingAlertResolveResponse extends BaseUpdateResponse<PaintingAnalysisAlert> {}

export interface PaintingConfigGetResponse extends BaseGetUniqueResponse<PaintingConfig> {}
export interface PaintingRateUpdateResponse extends BaseUpdateResponse<PaintingProductivityRate> {}
export interface PaintingIndirectUpdateResponse extends BaseUpdateResponse<PaintingIndirectCost> {}
export interface PaintingRuleUpdateResponse extends BaseUpdateResponse<PaintingRule> {}
export interface PaintingProcessParamsUpdateResponse extends BaseUpdateResponse<PaintingProcessParams> {}
