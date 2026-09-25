/**
 * G5 (web) — TODO VALOR DE ENUM TEM RÓTULO EM CADA MAPA, e cada documento
 * continua com as palavras de hoje.
 *
 * Os rótulos de categoria e de implemento vêm do contrato gerado pela API
 * (`src/generated/contracts/labels.json`, perfis por documento, D-18). Este
 * arquivo trava:
 *
 *   1. todo perfil rotula todo valor de `IMPLEMENT_CATEGORY` e `IMPLEMENT_TYPE`
 *      DESTE web (um valor novo no enum sem rótulo sai cru na tela ou na
 *      prévia da nota);
 *   2. os enums do web são os do contrato (o espelho à mão não divergiu);
 *   3. os mapas de tela SÃO o perfil `screen`;
 *   4. todo mapa `X_LABELS` de `enum-labels.ts` cobre o enum `X`;
 *   5. as palavras de hoje de cada documento — a prévia da NFS-e e a do boleto
 *      têm de mostrar o que a API emite, e o histórico mantém as suas.
 */
import { describe, expect, it } from "vitest";
import * as ENUMS from "./enums";
import { IMPLEMENT_TYPE, IMPLEMENT_CATEGORY } from "./enums";
import * as ENUM_LABELS from "./enum-labels";
import { IMPLEMENT_TYPE_LABELS, IMPLEMENT_CATEGORY_LABELS } from "./enum-labels";
import {
  IMPLEMENT_TYPE_PROFILE_LABELS,
  LABEL_PROFILES,
  IMPLEMENT_CATEGORY_PROFILE_LABELS,
} from "./document-labels";
import contractEnums from "@/generated/contracts/enums.json";
import { buildDiscriminacao } from "@/utils/nfse-discriminacao";
import { formatFieldValue } from "@/utils/changelog-fields";

const categorias = Object.values(IMPLEMENT_CATEGORY) as string[];
const implementos = Object.values(IMPLEMENT_TYPE) as string[];

function lacunas(values: string[], map: Readonly<Record<string, string>>) {
  return {
    faltam: values.filter(v => typeof map[v] !== "string" || map[v].trim() === ""),
    sobram: Object.keys(map).filter(k => !values.includes(k)),
  };
}

describe("rótulos por documento (contrato da API)", () => {
  it("há os perfis de cada documento", () => {
    expect(LABEL_PROFILES).toEqual(
      expect.arrayContaining(["screen", "nfseTask", "nfsePainter", "boleto", "invoice", "webChangelog"]),
    );
  });

  it.each(LABEL_PROFILES)("perfil %s rotula toda categoria e todo implemento", perfil => {
    expect(lacunas(categorias, IMPLEMENT_CATEGORY_PROFILE_LABELS[perfil])).toEqual({ faltam: [], sobram: [] });
    expect(lacunas(implementos, IMPLEMENT_TYPE_PROFILE_LABELS[perfil])).toEqual({ faltam: [], sobram: [] });
  });

  it("os enums do web são os do contrato da API", () => {
    expect(categorias).toEqual(contractEnums.enums.IMPLEMENT_CATEGORY);
    expect(implementos).toEqual(contractEnums.enums.IMPLEMENT_TYPE);
  });

  it("os mapas de tela SÃO o perfil screen", () => {
    expect(IMPLEMENT_CATEGORY_LABELS).toBe(IMPLEMENT_CATEGORY_PROFILE_LABELS.screen);
    expect(IMPLEMENT_TYPE_LABELS).toBe(IMPLEMENT_TYPE_PROFILE_LABELS.screen);
  });

  it("todo mapa X_LABELS de enum-labels cobre o enum X", () => {
    const problemas: string[] = [];
    let mapas = 0;
    for (const [nome, mapa] of Object.entries(ENUM_LABELS)) {
      if (!nome.endsWith("_LABELS") || !mapa || typeof mapa !== "object") continue;
      const en = (ENUMS as Record<string, unknown>)[nome.slice(0, -"_LABELS".length)];
      if (!en || typeof en !== "object") continue;
      // Só enum de TEXTO: o numérico (OP_SIMP_NAC…) tem o mapa reverso e é rotulado pelo número.
      const valores = Object.values(en as object);
      if (valores.length === 0 || !valores.every(v => typeof v === "string")) continue;
      mapas++;
      const { faltam } = lacunas(valores, mapa as Record<string, string>);
      if (faltam.length) problemas.push(`${nome}: faltam ${faltam.join(", ")}`);
    }
    expect(mapas).toBeGreaterThan(50);
    expect(problemas).toEqual([]);
  });
});

describe("as palavras de hoje, documento a documento (D-18)", () => {
  it("tela", () => {
    expect(IMPLEMENT_TYPE_PROFILE_LABELS.screen).toEqual({
      DRY_CARGO: "Carga Seca",
      REFRIGERATED: "Refrigerado",
      INSULATED: "Isoplastic",
      CURTAIN_SIDE: "Sider",
      TANK: "Tanque",
      FLATBED: "Carroceria",
    });
  });

  it("NFS-e da tarefa (prévia da nota)", () => {
    expect(IMPLEMENT_TYPE_PROFILE_LABELS.nfseTask).toEqual({
      DRY_CARGO: "Carga seca",
      REFRIGERATED: "Refrigerado",
      INSULATED: "Isotérmico",
      CURTAIN_SIDE: "Sider",
      TANK: "Tanque",
      FLATBED: "Prancha/Plataforma",
    });
    expect(IMPLEMENT_CATEGORY_PROFILE_LABELS.nfseTask).toEqual({
      MINI: "Mini",
      VUC: "VUC",
      THREE_QUARTER: "3/4",
      RIGID: "Toco",
      TRUCK: "Truck",
      SEMI_TRAILER: "Semirreboque",
      SEMI_TRAILER_2_AXLES: "Semirreboque 2 Eixos",
      B_DOUBLE_FRONT: "Bitrem Composição Dianteira",
      B_DOUBLE_REAR: "Bitrem Composição Traseira",
      BITRUCK: "Bitruck",
    });
  });

  it("informativo do boleto (prévia do boleto)", () => {
    expect(IMPLEMENT_TYPE_PROFILE_LABELS.invoice).toEqual(IMPLEMENT_TYPE_PROFILE_LABELS.screen);
    expect(IMPLEMENT_TYPE_PROFILE_LABELS.boleto).toEqual(IMPLEMENT_TYPE_PROFILE_LABELS.invoice);
    expect(IMPLEMENT_CATEGORY_PROFILE_LABELS.invoice).toEqual(IMPLEMENT_CATEGORY_PROFILE_LABELS.nfseTask);
  });

  it("a discriminação sem mapas fala a língua da NFS-e da tarefa", () => {
    const texto = buildDiscriminacao({
      budgetNumber: 990,
      services: ["Logomarca Lateral"],
      vehicles: [
        { serialNumber: "78000", plate: "TES1T01", category: "TRUCK", implementType: "INSULATED" },
        { serialNumber: "78001", plate: "TES1T02", category: "RIGID", implementType: "FLATBED" },
      ],
    });
    expect(texto.split("\n")).toEqual([
      "Orçamento nº 990",
      "Serviços: Logomarca Lateral",
      "Veículos (2):",
      "1) Truck Isotérmico - Série 78000 - Placa TES1T01",
      "2) Toco Prancha/Plataforma - Série 78001 - Placa TES1T02",
    ]);
  });

  it("o histórico de alterações mantém as suas palavras", () => {
    expect(formatFieldValue("VUC", "implement.category")).toBe("VUC (Veículo Urbano de Carga)");
    expect(formatFieldValue("TRUCK", "category")).toBe("Caminhão");
    expect(formatFieldValue("INSULATED", "implement.type")).toBe("Isoplastic");
    expect(formatFieldValue("CORRUGATED", "implementType")).toBe("Baú (Legado)");
    expect(formatFieldValue("VALOR_NOVO", "implementType")).toBe("VALOR_NOVO");
  });
});
