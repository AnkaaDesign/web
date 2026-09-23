/**
 * Rótulos de categoria e de implemento POR DOCUMENTO — lidos do contrato da API.
 *
 * A fonte é `api/src/constants/document-labels.ts` (D-18). Os documentos que
 * nomeiam o veículo não falam a mesma língua, e cada um continua com o texto
 * de hoje até o dono escolher as palavras:
 *
 *   screen       telas ("Carga Seca", "Isoplastic", "Carroceria");
 *   nfseTask     NFS-e da tarefa ("Carga seca", "Isotérmico", "Prancha/Plataforma");
 *   nfsePainter  NFS-e do aerografista;
 *   boleto       informativo do boleto (varredura);
 *   invoice      informativo do boleto (registro na aprovação);
 *   webChangelog histórico de alterações deste web ("VUC (Veículo Urbano de
 *                Carga)", "Caminhão").
 *
 * `src/generated/contracts/labels.json` é GERADO pela API
 * (`npx tsx scripts/export-contracts.ts --out ../web/src/generated/contracts`);
 * não se edita à mão. A importação é NOMEADA (`perfis`) de propósito: o Vite
 * descarta do pacote as outras chaves do JSON (os 174 mapas de tela da API).
 */
import { perfis } from "@/generated/contracts/labels.json";
import type { IMPLEMENT_TYPE, TRUCK_CATEGORY } from "./enums";

export type LabelProfile = keyof typeof perfis.TRUCK_CATEGORY;

export const LABEL_PROFILES = Object.keys(perfis.TRUCK_CATEGORY) as LabelProfile[];

export const TRUCK_CATEGORY_PROFILE_LABELS = perfis.TRUCK_CATEGORY as Readonly<
  Record<LabelProfile, Readonly<Record<TRUCK_CATEGORY, string>>>
>;

export const IMPLEMENT_TYPE_PROFILE_LABELS = perfis.IMPLEMENT_TYPE as Readonly<
  Record<LabelProfile, Readonly<Record<IMPLEMENT_TYPE, string>>>
>;
