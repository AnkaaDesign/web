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
    const recorded = { id: "dp-colaboradores", path: "/departamento-pessoal/colaboradores" };
    const active = resolveActiveNav(ACCOUNTING, "/departamento-pessoal/colaboradores", recorded);
    expect(active.id).toBe("dp-colaboradores");
    expect(active.trail.map((t) => t.id)).toEqual(["departamento-pessoal"]);

    const expanded = computeExpandedFromActive(ACCOUNTING, active);
    expect(expandedTopLevel(ACCOUNTING, expanded)).toEqual(["departamento-pessoal"]);
  });

  it("ADMIN: DP > Colaboradores click does NOT open Administração", () => {
    const recorded = { id: "dp-colaboradores", path: "/departamento-pessoal/colaboradores" };
    const active = resolveActiveNav(ADMIN, "/departamento-pessoal/colaboradores", recorded);
    expect(active.id).toBe("dp-colaboradores");

    const expanded = computeExpandedFromActive(ADMIN, active);
    expect(expandedTopLevel(ADMIN, expanded)).toEqual(["departamento-pessoal"]);
    expect(expanded["administracao"]).toBe(false);
  });

  it("ADMIN: Colaboradores lives only under Departamento Pessoal (removed from Administração)", () => {
    // The duplicate "Colaboradores" entry under Administração was removed; the
    // employee directory now lives solely under Departamento Pessoal.
    const recorded = { id: "dp-colaboradores", path: "/departamento-pessoal/colaboradores" };
    const active = resolveActiveNav(ADMIN, "/departamento-pessoal/colaboradores", recorded);
    expect(active.id).toBe("dp-colaboradores");

    const expanded = computeExpandedFromActive(ADMIN, active);
    expect(expandedTopLevel(ADMIN, expanded)).toEqual(["departamento-pessoal"]);
    expect(expanded["administracao"]).toBe(false);
  });

  it("context survives into child routes (/detalhes/:id) of the recorded entry", () => {
    const recorded = { id: "dp-colaboradores", path: "/departamento-pessoal/colaboradores" };
    const active = resolveActiveNav(ADMIN, "/departamento-pessoal/colaboradores/detalhes/abc-123", recorded);
    expect(active.id).toBe("dp-colaboradores-detalhes");
    expect(active.trail.map((t) => t.id)).toEqual(["departamento-pessoal", "dp-colaboradores"]);
    expect(computeExpandedFromActive(ADMIN, active)["administracao"]).toBe(false);
  });

  it("Gratificações click (cross-section path /departamento-pessoal/bonus) stays in DP", () => {
    const recorded = { id: "dp-gratificacoes", path: "/departamento-pessoal/bonus" };
    for (const menu of [ACCOUNTING, ADMIN]) {
      const active = resolveActiveNav(menu, "/departamento-pessoal/bonus", recorded);
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
    // Colaboradores now has a single placement (Departamento Pessoal) for every sector.
    const acc = resolveActiveNav(ACCOUNTING, "/departamento-pessoal/colaboradores", null);
    expect(acc.id).toBe("dp-colaboradores");
    const adm = resolveActiveNav(ADMIN, "/departamento-pessoal/colaboradores", null);
    expect(adm.id).toBe("dp-colaboradores");
    expect(expandedTopLevel(ADMIN, computeExpandedFromActive(ADMIN, adm)).length).toBe(1);
  });

  it("direct deep-link with no context resolves contextual children", () => {
    const active = resolveActiveNav(ACCOUNTING, "/administracao/mensagens/criar", null);
    expect(active.id).toBe("mensagens-accounting-criar");
    expect(active.trail.map((t) => t.id)).toEqual(["mensagens-accounting"]);
  });

  it("stale recorded context that no longer matches the URL falls back", () => {
    const recorded = { id: "dp-colaboradores", path: "/departamento-pessoal/colaboradores" };
    const active = resolveActiveNav(ACCOUNTING, "/financeiro/contas-a-pagar", recorded);
    expect(active.id).toBe("contas-a-pagar");
    // Contas a Pagar now lives under Conciliação Bancária, so the trail nests it.
    expect(active.trail.map((t) => t.id)).toEqual(["financeiro", "conciliacao-bancaria"]);
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
      "/departamento-pessoal/colaboradores",
      { id: "dp-colaboradores", path: "/departamento-pessoal/colaboradores" },
      fallback,
    );
    expect(crumbs.map((c) => c.label)).toEqual(["Início", "Departamento Pessoal", "Colaboradores"]);
  });

  it("ACCOUNTING without recorded context still derives DP trail", () => {
    const crumbs = buildNavBreadcrumbs(ACCOUNTING, "/departamento-pessoal/colaboradores", null, fallback);
    expect(crumbs.some((c) => c.label === "Administração")).toBe(false);
    expect(crumbs[crumbs.length - 1].label).toBe("Colaboradores");
  });

  it("ADMIN Colaboradores resolves to the Departamento Pessoal trail (Administração entry removed)", () => {
    const crumbs = buildNavBreadcrumbs(
      ADMIN,
      "/departamento-pessoal/colaboradores",
      { id: "dp-colaboradores", path: "/departamento-pessoal/colaboradores" },
      fallback,
    );
    expect(crumbs.map((c) => c.label)).toEqual(["Início", "Departamento Pessoal", "Colaboradores"]);
  });

  it("leaf crumbs replace the winner crumb (entity names)", () => {
    const crumbs = buildNavBreadcrumbs(
      ACCOUNTING,
      "/departamento-pessoal/colaboradores/detalhes/abc-123",
      { id: "dp-colaboradores", path: "/departamento-pessoal/colaboradores" },
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

  it("Departamento Pessoal (ACCOUNTING): no Calendário/Feriados/EPI, and Secullum is ADMIN-only", () => {
    const dp = byId(ACCOUNTING, "departamento-pessoal")!;
    const titles = (dp.children || []).map((c) => c.title);
    // "Integração Secullum" is now ADMIN-only and no longer surfaces for ACCOUNTING.
    // "EPI" and "Feriados" are HR/ADMIN-only DP items (ACCOUNTING uses Medicina do
    // Trabalho for PPE), so they don't appear here either.
    expect(titles).toEqual([
      "Admissões",
      "Advertências",
      "Benefícios",
      "Colaboradores",
      "Controle de Ponto",
      "Empréstimos",
      "Férias",
      "Rescisões",
      "Salários e Cargos",
    ]);
    const salarios = (dp.children || []).find((c) => c.id === "dp-salarios-e-cargos")!;
    expect(salarios.children!.map((c) => c.title)).toEqual([
      "Cargos",
      "Folha de Pagamento",
      "Gratificações",
      "Horários",
      "Promoções",
      "Reajustes",
    ]);
  });

  it("Medicina do Trabalho: Agendamentos/Tamanhos nested under Entrega de EPIs", () => {
    const mt = byId(ACCOUNTING, "medicina-do-trabalho")!;
    expect((mt.children || []).map((c) => c.title)).toEqual(["Afastamentos", "ASO", "CAT", "Entrega de EPIs", "Exames Periódicos"]);
    const entregas = (mt.children || []).find((c) => c.id === "mt-epi-entregas")!;
    const childTitles = (entregas.children || []).map((c) => c.title);
    expect(childTitles).toContain("Agendamentos");
    expect(childTitles).toContain("Tamanhos");
  });

  it("Financeiro (ACCOUNTING): unified Notas Fiscais at top level; Contas a Receber/Pagar/Recorrentes under Conciliação", () => {
    const fin = byId(ACCOUNTING, "financeiro")!;
    // Notas Fiscais is now a single top-level entry (Emitidas+Recebidas toggle).
    // Contas a Receber / a Pagar / Recorrentes were regrouped under Conciliação
    // Bancária. Top-level children are sorted alphabetically.
    expect((fin.children || []).map((c) => c.title)).toEqual([
      "Conciliação Bancária",
      "Faturamento",
      "Notas Fiscais",
    ]);
    const conc = (fin.children || []).find((c) => c.id === "conciliacao-bancaria")!;
    // Ordered by the `order` field; "Recorrentes (categorias)" ([ADMIN,FINANCIAL])
    // is hidden from ACCOUNTING.
    expect((conc.children || []).map((c) => ({ title: c.title, path: c.path }))).toEqual([
      { title: "Extrato", path: "/financeiro/conciliacao/extrato" },
      { title: "Contas a Receber", path: "/financeiro/conciliacao/entradas" },
      { title: "Contas a Pagar", path: "/financeiro/contas-a-pagar" },
      { title: "Contas Recorrentes", path: "/financeiro/contas-recorrentes" },
      { title: "Categorias", path: "/financeiro/conciliacao/categorias" },
    ]);
  });

  it("ADMIN sees the legacy Recorrentes (categorias) view; ACCOUNTING does not", () => {
    // NOTE: FINANCIAL has a flat per-role nav and was never in the "Financeiro"
    // SECTION audience — it keeps page ACCESS via ROUTE_PRIVILEGES.
    const conc = (byId(ADMIN, "financeiro")!.children || []).find((c: MenuItem) => c.id === "conciliacao-bancaria")!;
    const titles = (conc.children || []).map((c: MenuItem) => c.title);
    expect(titles).toEqual([
      "Extrato",
      "Contas a Receber",
      "Contas a Pagar",
      "Contas Recorrentes",
      "Recorrentes (categorias)",
      "Categorias",
    ]);

    const accConc = (byId(ACCOUNTING, "financeiro")!.children || []).find((c) => c.id === "conciliacao-bancaria")!;
    const accTitles = (accConc.children || []).map((c) => c.title);
    expect(accTitles).not.toContain("Recorrentes (categorias)");

    // FINANCIAL was previously locked out of the Financeiro section (its parent
    // privilege omitted FINANCIAL); it is now included, so the section shows.
    const FINANCIAL = menuFor(SECTOR_PRIVILEGES.FINANCIAL);
    expect(byId(FINANCIAL, "financeiro")).toBeDefined();
  });

  it("Ferramentas: spec tools incl. Calculadora de Horas and Calendário; no QR Code/Paleta", () => {
    const tools = byId(ACCOUNTING, "ferramentas")!;
    expect((tools.children || []).map((c) => c.title)).toEqual([
      "Calculadora de Horas",
      "Calendário",
      "Certificado de Resíduos",
      "Custo de Funcionário",
      "Custo de Horas Extras",
      "Post-its",
    ]);
    const calendario = (tools.children || []).find((c) => c.id === "ferramentas-calendario")!;
    expect(calendario.path).toBe("/departamento-pessoal/calendario");
  });

  it("HR/ADMIN: legacy Recursos Humanos section is gone; Calendário lives under Ferramentas; Feriados/EPI under Departamento Pessoal", () => {
    for (const privilege of [SECTOR_PRIVILEGES.HUMAN_RESOURCES, SECTOR_PRIVILEGES.ADMIN]) {
      const menu = menuFor(privilege);
      // The duplicate "Recursos Humanos" section was retired entirely.
      expect(byId(menu, "recursos-humanos")).toBeUndefined();
      // Calendário now lives under Ferramentas for HR/ADMIN (same as ACCOUNTING).
      const tools = byId(menu, "ferramentas")!;
      expect((tools.children || []).some((c) => c.id === "ferramentas-calendario")).toBe(true);
      // Feriados and EPI fold into the consolidated Departamento Pessoal area.
      const dp = byId(menu, "departamento-pessoal")!;
      const dpTitles = (dp.children || []).map((c) => c.title);
      expect(dpTitles).toContain("Feriados");
      expect(dpTitles).toContain("EPI");
      // Integração Secullum is ADMIN-only: present for ADMIN, absent for HR.
      const hasSecullum = (dp.children || []).some((c) => c.id === "dp-integracao-secullum");
      expect(hasSecullum).toBe(privilege === SECTOR_PRIVILEGES.ADMIN);
    }
  });

  it("PRODUCTION_MANAGER: gains Admissões/Rescisões/Férias and a Ferramentas Calendário", () => {
    const PM = menuFor(SECTOR_PRIVILEGES.PRODUCTION_MANAGER);
    const colaboradores = byId(PM, "colaboradores-group-production-manager")!;
    const colabTitles = (colaboradores.children || []).map((c) => c.title);
    expect(colabTitles).toContain("Admissões");
    expect(colabTitles).toContain("Rescisões");
    expect(colabTitles).toContain("Férias");
    const tools = byId(PM, "ferramentas-production-manager")!;
    expect((tools.children || []).some((c) => c.id === "ferramentas-calendario-pm")).toBe(true);
    // Secullum is ADMIN-only — PM must not see it anywhere.
    expect(JSON.stringify(PM).includes("dp-integracao-secullum")).toBe(false);
  });
});
