/**
 * Simulation tests for the navigation-context winner/expansion/breadcrumb logic.
 * Uses the REAL menu (MENU_ITEMS), the REAL per-privilege filtering pipeline and the
 * REAL resolution functions consumed by the sidebar, flyout and page breadcrumbs.
 */
import { describe, it, expect } from "vitest";
import { MENU_ITEMS, SECTOR_PRIVILEGES } from "../../constants";
import type { MenuItem } from "../../constants";
import { getFilteredMenuForUser } from "../../utils";
import { getRequiredPrivilegeForRoute } from "../../utils/route-privileges";
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
      expect(active.trail.map((t) => t.id)).toEqual(["departamento-pessoal", "dp-salarios-e-cargos"]);
      const expanded = computeExpandedFromActive(menu, active);
      expect(expandedTopLevel(menu, expanded)).toEqual(["departamento-pessoal"]);
      // A antiga seção "Recursos Humanos" tinha um "Bônus" neste MESMO path e
      // abria junto. A migração RH → DP (429fd8c9) trocou o id por sed também
      // nesta asserção, que passou a exigir DP fechado logo após exigi-lo aberto.
      // A intenção original: a seção antiga não existe e não abre.
      expect(menu.some((m) => m.id === "recursos-humanos")).toBe(false);
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
    // Contas a Pagar é página de 1º nível do Financeiro (saiu da Conciliação
    // Bancária — ver o comentário do item em navigation.ts).
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

  it("Medicina do Trabalho: Agendamentos nested under Entrega de EPIs", () => {
    const mt = byId(ACCOUNTING, "medicina-do-trabalho")!;
    // FISPQ/FDS entrou em 293965c9, liberado para ACCOUNTING/HR/ADMIN.
    expect((mt.children || []).map((c) => c.title)).toEqual(["Afastamentos", "ASO", "CAT", "Entrega de EPIs", "Exames Periódicos", "FISPQ/FDS"]);
    const entregas = (mt.children || []).find((c) => c.id === "mt-epi-entregas")!;
    const childTitles = (entregas.children || []).map((c) => c.title);
    expect(childTitles).toContain("Agendamentos");
    // "Tamanhos" saiu em 293965c9: as páginas de cadastro/tamanhos de EPI foram removidas.
  });

  it("Financeiro (ACCOUNTING): Contas a Pagar/Receber no 1º nível; Extrato/Notas Fiscais/Recorrentes/Categorias sob Conciliação", () => {
    const fin = byId(ACCOUNTING, "financeiro")!;
    // Contas a Pagar / a Receber são páginas de 1º nível (saíram da Conciliação
    // Bancária). A Notas Fiscais de 1º nível é a das EMITIDAS, só para
    // FINANCIAL/COMMERCIAL; ACCOUNTING concilia as RECEBIDAS dentro da
    // Conciliação. Filhos de 1º nível em ordem alfabética.
    expect((fin.children || []).map((c) => c.title)).toEqual([
      "Conciliação Bancária",
      "Contas a Pagar",
      "Contas a Receber",
      "Faturamento",
    ]);
    const conc = (fin.children || []).find((c) => c.id === "conciliacao-bancaria")!;
    // Ordenados pelo campo `order`.
    expect((conc.children || []).map((c) => ({ title: c.title, path: c.path }))).toEqual([
      { title: "Extrato", path: "/financeiro/conciliacao/extrato" },
      { title: "Notas Fiscais", path: "/financeiro/conciliacao/notas" },
      { title: "Recorrentes", path: "/financeiro/contas-recorrentes" },
      { title: "Categorias", path: "/financeiro/conciliacao/categorias" },
    ]);
  });

  it("Notas Fiscais: recebidas na Conciliação (ADMIN/ACCOUNTING), emitidas no 1º nível (COMMERCIAL) — nunca as duas", () => {
    // Substitui o teste da view "Recorrentes (categorias)", que foi absorvida
    // pela "Recorrentes" e não existe mais em menu nenhum.
    const nfPlacements = (menu: MenuItem[]) => {
      const out: string[] = [];
      const walk = (items: MenuItem[], trail: string[]) =>
        items.forEach((i) => {
          if (i.title === "Notas Fiscais") out.push([...trail, i.id].join(">"));
          if (i.children) walk(i.children, [...trail, i.id]);
        });
      walk(menu, []);
      return out;
    };
    const RECEBIDAS = "financeiro>conciliacao-bancaria>conciliacao-notas";
    expect(nfPlacements(ADMIN)).toEqual([RECEBIDAS]);
    expect(nfPlacements(ACCOUNTING)).toEqual([RECEBIDAS]);
    expect(nfPlacements(menuFor(SECTOR_PRIVILEGES.COMMERCIAL))).toEqual(["financeiro>notas-fiscais"]);

    // ADMIN vê a mesma Conciliação que ACCOUNTING.
    const conc = (byId(ADMIN, "financeiro")!.children || []).find((c) => c.id === "conciliacao-bancaria")!;
    expect((conc.children || []).map((c) => c.title)).toEqual(["Extrato", "Notas Fiscais", "Recorrentes", "Categorias"]);

    for (const privilege of Object.values(SECTOR_PRIVILEGES)) {
      expect(JSON.stringify(menuFor(privilege)).includes("Recorrentes (categorias)")).toBe(false);
    }

  });

  it("FINANCIAL: só o menu plano — sem a seção Financeiro, sem Aerografia, nenhuma página duas vezes", () => {
    const FIN = menuFor(SECTOR_PRIVILEGES.FINANCIAL);
    expect(FIN.map((m) => m.title)).toEqual([
      "Início",
      "Clientes",
      "Contas a Receber",
      "Faturamento",
      "Histórico",
      "Minhas Mensagens",
      "Notas",
      "Notas Fiscais",
      "Orçamentos",
    ]);
    // A seção agrupada repetia Contas a Receber e Notas Fiscais, e só somava
    // Contas a Pagar, que o setor não usa.
    expect(byId(FIN, "financeiro")).toBeUndefined();

    const seen = new Map<string, number>();
    const walk = (items: MenuItem[]) =>
      items.forEach((i) => {
        if (i.path && !i.isDynamic) seen.set(i.path, (seen.get(i.path) ?? 0) + 1);
        if (i.children) walk(i.children);
      });
    walk(FIN);
    expect([...seen].filter(([, n]) => n > 1)).toEqual([]);

    // O detalhe da nota emitida continua destacando Notas Fiscais.
    const active = resolveActiveNav(FIN, "/financeiro/notas-fiscais/abc-123", null);
    expect(active.id).toBe("notas-fiscais-financeiro-detalhes");
    expect(active.trail.map((t) => t.id)).toEqual(["notas-fiscais-financeiro"]);
  });

  it("Ferramentas (ACCOUNTING): Calendário, Certificado de Resíduos, Custo de Horas Extras, Notas; no QR Code/Paleta/Mistura/Custo de Colaborador", () => {
    const tools = byId(ACCOUNTING, "ferramentas")!;
    expect((tools.children || []).map((c) => c.title)).toEqual([
      "Calendário",
      "Certificado de Resíduos",
      "Custo de Horas Extras",
      "Notas",
    ]);
    const calendario = (tools.children || []).find((c) => c.id === "ferramentas-calendario")!;
    expect(calendario.path).toBe("/departamento-pessoal/calendario");
  });

  it("HR/ADMIN: legacy Recursos Humanos section is gone; Calendário lives under Ferramentas; Feriados under Departamento Pessoal", () => {
    for (const privilege of [SECTOR_PRIVILEGES.HUMAN_RESOURCES, SECTOR_PRIVILEGES.ADMIN]) {
      const menu = menuFor(privilege);
      // A seção antiga "Recursos Humanos" foi aposentada (virou Departamento
      // Pessoal). A migração 429fd8c9 trocou o id por sed também aqui, e o
      // teste passou a exigir que o Departamento Pessoal NÃO existisse.
      expect(byId(menu, "recursos-humanos")).toBeUndefined();
      // Calendário now lives under Ferramentas for HR/ADMIN (same as ACCOUNTING).
      const tools = byId(menu, "ferramentas")!;
      expect((tools.children || []).some((c) => c.id === "ferramentas-calendario")).toBe(true);
      // Feriados fold into the consolidated Departamento Pessoal area.
      // EPI saiu do DP em 293965c9 e foi para Medicina do Trabalho, seção que é
      // só da ACCOUNTING — HR/ADMIN ficaram sem item de menu para Entrega de
      // EPIs, embora a rota (/medicina-do-trabalho/*) os aceite. Pendente de
      // decisão; não afirmamos nem a presença nem a ausência aqui.
      const dp = byId(menu, "departamento-pessoal")!;
      const dpTitles = (dp.children || []).map((c) => c.title);
      expect(dpTitles).toContain("Feriados");
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

  it("Validador de Documentos: só ADMIN e COMMERCIAL veem o item; nenhum outro setor, e a rota acompanha", () => {
    const VALIDATOR = "/ferramentas/validador-de-documentos";
    const allowed = [SECTOR_PRIVILEGES.ADMIN, SECTOR_PRIVILEGES.COMMERCIAL];
    for (const privilege of Object.values(SECTOR_PRIVILEGES)) {
      const menu = JSON.stringify(menuFor(privilege));
      const count = menu.split(`"path":"${VALIDATOR}"`).length - 1;
      // Exatamente UM item para quem pode (nada de duplicata no menu), zero para o resto.
      expect({ privilege, count }).toEqual({ privilege, count: allowed.includes(privilege) ? 1 : 0 });
    }
    expect(getRequiredPrivilegeForRoute(VALIDATOR)).toEqual(["ADMIN", "COMMERCIAL"]);
  });
});
