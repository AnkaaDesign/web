/**
 * Simulation tests for the navigation-context winner/expansion/breadcrumb logic.
 * Uses the REAL menu (MENU_ITEMS), the REAL per-privilege filtering pipeline and the
 * REAL resolution functions consumed by the sidebar, flyout and page breadcrumbs.
 */
import { describe, it, expect } from "vitest";
import { MENU_ITEMS, SECTOR_PRIVILEGES } from "../../constants";
import type { MenuItem } from "../../constants";
import { getFilteredMenuForUser } from "../../utils";
import { resolveActiveNav, computeExpandedFromActive, buildNavBreadcrumbs } from "../navigation-context";

const menuFor = (privilege: string): MenuItem[] =>
  getFilteredMenuForUser(MENU_ITEMS, { sector: { privileges: privilege } } as any, "web");

const ACCOUNTING = menuFor(SECTOR_PRIVILEGES.ACCOUNTING);
const ADMIN = menuFor(SECTOR_PRIVILEGES.ADMIN);

/** Top-level section ids that are expanded (the "one expanded chain" assertion). */
function expandedTopLevel(menu: MenuItem[], expanded: { [k: string]: boolean }): string[] {
  return menu.filter((m) => m.id && m.children && m.children.length > 0 && expanded[m.id]).map((m) => m.id);
}

describe("winner resolution with recorded nav context", () => {
  it("ACCOUNTING: DP > Colaboradores click (and reload with persisted context)", () => {
    const recorded = { id: "dp-colaboradores", path: "/administracao/colaboradores" };
    const active = resolveActiveNav(ACCOUNTING, "/administracao/colaboradores", recorded);
    expect(active.id).toBe("dp-colaboradores");
    expect(active.trail.map((t) => t.id)).toEqual(["departamento-pessoal"]);

    const expanded = computeExpandedFromActive(ACCOUNTING, active);
    expect(expandedTopLevel(ACCOUNTING, expanded)).toEqual(["departamento-pessoal"]);
  });

  it("ADMIN: DP > Colaboradores click does NOT open Administração", () => {
    const recorded = { id: "dp-colaboradores", path: "/administracao/colaboradores" };
    const active = resolveActiveNav(ADMIN, "/administracao/colaboradores", recorded);
    expect(active.id).toBe("dp-colaboradores");

    const expanded = computeExpandedFromActive(ADMIN, active);
    expect(expandedTopLevel(ADMIN, expanded)).toEqual(["departamento-pessoal"]);
    expect(expanded["administracao"]).toBe(false);
  });

  it("ADMIN: Administração > Colaboradores click does NOT open Departamento Pessoal", () => {
    const recorded = { id: "colaboradores", path: "/administracao/colaboradores" };
    const active = resolveActiveNav(ADMIN, "/administracao/colaboradores", recorded);
    expect(active.id).toBe("colaboradores");

    const expanded = computeExpandedFromActive(ADMIN, active);
    expect(expandedTopLevel(ADMIN, expanded)).toEqual(["administracao"]);
    expect(expanded["departamento-pessoal"]).toBe(false);
  });

  it("context survives into child routes (/detalhes/:id) of the recorded entry", () => {
    const recorded = { id: "dp-colaboradores", path: "/administracao/colaboradores" };
    const active = resolveActiveNav(ADMIN, "/administracao/colaboradores/detalhes/abc-123", recorded);
    expect(active.id).toBe("dp-colaboradores-detalhes");
    expect(active.trail.map((t) => t.id)).toEqual(["departamento-pessoal", "dp-colaboradores"]);
    expect(computeExpandedFromActive(ADMIN, active)["administracao"]).toBe(false);
  });

  it("Gratificações click (cross-section path /recursos-humanos/bonus) stays in DP", () => {
    const recorded = { id: "dp-gratificacoes", path: "/recursos-humanos/bonus" };
    for (const menu of [ACCOUNTING, ADMIN]) {
      const active = resolveActiveNav(menu, "/recursos-humanos/bonus", recorded);
      expect(active.id).toBe("dp-gratificacoes");
      const expanded = computeExpandedFromActive(menu, active);
      expect(expandedTopLevel(menu, expanded)).toEqual(["departamento-pessoal"]);
      // ADMIN also has RH > Bônus at this exact path — it must NOT yank open
      expect(expanded["recursos-humanos"] ?? false).toBe(false);
    }
  });

  it("benefits adesões: single deepest winner, single chain", () => {
    const recorded = { id: "dp-beneficios-adesoes", path: "/departamento-pessoal/beneficios/adesoes" };
    for (const menu of [ACCOUNTING, ADMIN]) {
      const active = resolveActiveNav(menu, "/departamento-pessoal/beneficios/adesoes", recorded);
      expect(active.id).toBe("dp-beneficios-adesoes");
      expect(active.trail.map((t) => t.id)).toEqual(["departamento-pessoal", "dp-beneficios"]);
      const expanded = computeExpandedFromActive(menu, active);
      expect(expandedTopLevel(menu, expanded)).toEqual(["departamento-pessoal"]);
      // sibling "Benefícios" list entry must not be expanded
      expect(expanded["dp-beneficios-lista"] ?? false).toBe(false);
    }
  });

  it("favorites jump / no recorded context falls back to longest match (one winner)", () => {
    // ACCOUNTING: only the DP entry exists for this path
    const acc = resolveActiveNav(ACCOUNTING, "/administracao/colaboradores", null);
    expect(acc.id).toBe("dp-colaboradores");
    // ADMIN: tie between Administração and DP resolves by displayed tree order (Administração first)
    const adm = resolveActiveNav(ADMIN, "/administracao/colaboradores", null);
    expect(adm.id).toBe("colaboradores");
    expect(expandedTopLevel(ADMIN, computeExpandedFromActive(ADMIN, adm)).length).toBe(1);
  });

  it("direct deep-link with no context resolves contextual children", () => {
    const active = resolveActiveNav(ACCOUNTING, "/administracao/mensagens/criar", null);
    expect(active.id).toBe("mensagens-accounting-criar");
    expect(active.trail.map((t) => t.id)).toEqual(["mensagens-accounting"]);
  });

  it("stale recorded context that no longer matches the URL falls back", () => {
    const recorded = { id: "dp-colaboradores", path: "/administracao/colaboradores" };
    const active = resolveActiveNav(ACCOUNTING, "/financeiro/contas-a-pagar", recorded);
    expect(active.id).toBe("contas-a-pagar");
    expect(active.trail.map((t) => t.id)).toEqual(["financeiro"]);
  });
});

describe("breadcrumbs derived from nav context", () => {
  const fallback = [
    { label: "Início", href: "/" },
    { label: "Administração", href: "/administracao" },
    { label: "Colaboradores" },
  ];

  it("ACCOUNTING never sees Administração on shared pages", () => {
    const crumbs = buildNavBreadcrumbs(
      ACCOUNTING,
      "/administracao/colaboradores",
      { id: "dp-colaboradores", path: "/administracao/colaboradores" },
      fallback,
    );
    expect(crumbs.map((c) => c.label)).toEqual(["Início", "Departamento Pessoal", "Colaboradores"]);
  });

  it("ACCOUNTING without recorded context still derives DP trail", () => {
    const crumbs = buildNavBreadcrumbs(ACCOUNTING, "/administracao/colaboradores", null, fallback);
    expect(crumbs.some((c) => c.label === "Administração")).toBe(false);
    expect(crumbs[crumbs.length - 1].label).toBe("Colaboradores");
  });

  it("ADMIN coming from Administração keeps the Administração trail", () => {
    const crumbs = buildNavBreadcrumbs(
      ADMIN,
      "/administracao/colaboradores",
      { id: "colaboradores", path: "/administracao/colaboradores" },
      fallback,
    );
    expect(crumbs.map((c) => c.label)).toEqual(["Início", "Administração", "Colaboradores"]);
  });

  it("leaf crumbs replace the winner crumb (entity names)", () => {
    const crumbs = buildNavBreadcrumbs(
      ACCOUNTING,
      "/administracao/colaboradores/detalhes/abc-123",
      { id: "dp-colaboradores", path: "/administracao/colaboradores" },
      fallback,
      [{ label: "Fulano da Silva" }],
    );
    expect(crumbs.map((c) => c.label)).toEqual(["Início", "Departamento Pessoal", "Colaboradores", "Fulano da Silva"]);
  });

  it("ACCOUNTING messages pages: root-level Mensagens trail", () => {
    const crumbs = buildNavBreadcrumbs(ACCOUNTING, "/administracao/mensagens", null, fallback);
    expect(crumbs.map((c) => c.label)).toEqual(["Início", "Mensagens"]);
  });

  it("falls back to the static array when nothing matches", () => {
    const crumbs = buildNavBreadcrumbs(ACCOUNTING, "/rota/inexistente", null, fallback);
    expect(crumbs).toBe(fallback);
  });
});

describe("ACCOUNTING tree matches the spec (Área Andressa)", () => {
  const byId = (items: MenuItem[], id: string) => items.find((i) => i.id === id);

  it("top-level sections", () => {
    expect(ACCOUNTING.map((m) => m.title)).toEqual([
      "Início",
      "Departamento Pessoal",
      "Ferramentas",
      "Financeiro",
      "Medicina do Trabalho",
      "Mensagens",
      "Minhas Mensagens",
    ]);
  });

  it("Departamento Pessoal: no Calendário, no Feriados", () => {
    const dp = byId(ACCOUNTING, "departamento-pessoal")!;
    const titles = (dp.children || []).map((c) => c.title);
    expect(titles).toEqual([
      "Admissões",
      "Advertências",
      "Benefícios",
      "Colaboradores",
      "Controle de Ponto",
      "Férias",
      "Integração Secullum",
      "Requisições",
      "Rescisões",
      "Salários e Cargos",
    ]);
    const salarios = (dp.children || []).find((c) => c.id === "dp-salarios-e-cargos")!;
    expect(salarios.children!.map((c) => c.title)).toEqual([
      "Cargos",
      "Faixas Salariais",
      "Folha de Pagamento",
      "Gratificações",
      "Horários",
      "Promoções",
      "Reajustes",
    ]);
  });

  it("Medicina do Trabalho: Agendamentos/Tamanhos nested under Entrega de EPIs", () => {
    const mt = byId(ACCOUNTING, "medicina-do-trabalho")!;
    expect((mt.children || []).map((c) => c.title)).toEqual(["Afastamentos", "ASO", "Entrega de EPIs", "Exames Periódicos"]);
    const entregas = (mt.children || []).find((c) => c.id === "mt-epi-entregas")!;
    const childTitles = (entregas.children || []).map((c) => c.title);
    expect(childTitles).toContain("Agendamentos");
    expect(childTitles).toContain("Tamanhos");
  });

  it("Financeiro: Contas a Pagar + Conciliação Bancária (Notas Fiscais now lives inside Conciliação)", () => {
    const fin = byId(ACCOUNTING, "financeiro")!;
    // The top-level ACCOUNTING "Notas Fiscais" duplicate was removed; the fiscal
    // documents list now lives only inside the Conciliação Bancária submenu.
    // Previsão de Saídas now sits at the top level of Financeiro (a sibling of
    // Conciliação Bancária, outside the conciliação domain). Sorted alphabetically.
    expect((fin.children || []).map((c) => c.title)).toEqual([
      "Conciliação Bancária",
      "Contas a Pagar",
      "Previsão de Saídas",
    ]);
    const conc = (fin.children || []).find((c) => c.id === "conciliacao-bancaria")!;
    expect((conc.children || []).map((c) => ({ title: c.title, path: c.path }))).toEqual([
      { title: "Extrato", path: "/financeiro/conciliacao/extrato" },
      { title: "Saídas", path: "/financeiro/conciliacao/saidas" },
      { title: "Entradas", path: "/financeiro/conciliacao/entradas" },
      { title: "Categorias", path: "/financeiro/conciliacao/categorias" },
      { title: "Notas Fiscais", path: "/financeiro/conciliacao/notas" },
    ]);
  });

  it("ADMIN keeps Transações/Notas/Recorrentes; ACCOUNTING does not see them", () => {
    // NOTE: FINANCIAL has a flat per-role nav and was never in the "Financeiro"
    // SECTION audience ([ADMIN, COMMERCIAL, ACCOUNTING]) — it keeps page ACCESS via
    // ROUTE_PRIVILEGES, unchanged. ADMIN is the section-nav role to verify here.
    const conc = (byId(ADMIN, "financeiro")!.children || []).find((c: MenuItem) => c.id === "conciliacao-bancaria")!;
    const titles = (conc.children || []).map((c: MenuItem) => c.title);
    expect(titles).toContain("Transações");
    expect(titles).toContain("Recorrentes");
    expect(titles).toContain("Notas Fiscais");

    const accConc = (byId(ACCOUNTING, "financeiro")!.children || []).find((c) => c.id === "conciliacao-bancaria")!;
    const accTitles = (accConc.children || []).map((c) => c.title);
    expect(accTitles).not.toContain("Transações");
    expect(accTitles).not.toContain("Recorrentes");

    // FINANCIAL flat nav: no Financeiro section before, none after
    const FINANCIAL = menuFor(SECTOR_PRIVILEGES.FINANCIAL);
    expect(byId(FINANCIAL, "financeiro")).toBeUndefined();
  });

  it("Ferramentas: spec tools incl. Calculadora and Calendário; no QR Code/Paleta", () => {
    const tools = byId(ACCOUNTING, "ferramentas")!;
    expect((tools.children || []).map((c) => c.title)).toEqual([
      "Calculadora",
      "Calculadora de Horas",
      "Calendário",
      "Certificado de Resíduos",
      "Custo de Funcionário",
      "Custo de Horas Extras",
      "Post-its",
    ]);
    const calendario = (tools.children || []).find((c) => c.id === "ferramentas-calendario-accounting")!;
    expect(calendario.path).toBe("/recursos-humanos/calendario");
  });

  it("HR/ADMIN keep Calendário/Feriados in Recursos Humanos (not under Ferramentas)", () => {
    for (const privilege of [SECTOR_PRIVILEGES.HUMAN_RESOURCES, SECTOR_PRIVILEGES.ADMIN]) {
      const menu = menuFor(privilege);
      const rh = byId(menu, "recursos-humanos")!;
      const titles = (rh.children || []).map((c) => c.title);
      expect(titles).toContain("Calendário");
      expect(titles).toContain("Feriados");
      const tools = byId(menu, "ferramentas")!;
      expect((tools.children || []).some((c) => c.id === "ferramentas-calendario-accounting")).toBe(false);
    }
  });
});
