// The public budget/dossiê links have two shapes and the difference is not
// cosmetic: with a customer segment the page renders ONLY that customer's
// services, subtotal and payment terms; without it, the complete document.
//
// This has regressed twice by callers substituting an arbitrary customer
// (`customerConfigs[0]`, the task's own customer, the string "all") to satisfy
// a required-string signature — producing a link that says "Completo" in the UI
// and shows one customer to the customer. These tests pin both shapes.
import { describe, it, expect } from "vitest";
import { matchRoutes, type RouteObject } from "react-router-dom";
import { routes } from "./routes";

describe("public customer document links", () => {
  it("includes the customer segment when one customer is selected", () => {
    expect(routes.customer.budget("cust-1", "quote-9")).toBe("/cliente/cust-1/orcamento/quote-9");
    expect(routes.customer.serviceReport("cust-1", "quote-9")).toBe("/cliente/cust-1/dossie/quote-9");
  });

  it("omits the customer segment for the complete view", () => {
    expect(routes.customer.budget(null, "quote-9")).toBe("/cliente/orcamento/quote-9");
    expect(routes.customer.serviceReport(null, "quote-9")).toBe("/cliente/dossie/quote-9");
  });

  it("treats undefined and empty string as the complete view, never as a customer", () => {
    expect(routes.customer.budget(undefined, "quote-9")).toBe("/cliente/orcamento/quote-9");
    expect(routes.customer.serviceReport("", "quote-9")).toBe("/cliente/dossie/quote-9");
  });

  it("keeps the two shapes distinguishable by segment count (no route ambiguity)", () => {
    const complete = routes.customer.serviceReport(null, ":id").split("/").filter(Boolean);
    const perCustomer = routes.customer.serviceReport(":customerId", ":id").split("/").filter(Boolean);
    expect(complete).toEqual(["cliente", "dossie", ":id"]);
    expect(perCustomer).toEqual(["cliente", ":customerId", "dossie", ":id"]);
  });
});

// O PORTAL DO CLIENTE ENTROU DEBAIXO DE /cliente, ONDE JA MORAVAM AS ROTAS
// PUBLICAS.
//
// `/cliente/entrar` e `/cliente/painel/*` sao rotas LOGADAS e passaram a
// conviver com as publicas (assinatura, orcamento, dossie, comercial), que sao
// abertas por capability. Uma rota nova engolindo uma antiga aqui nao quebra
// nada em tempo de compilacao: o cliente e' que recebe a pagina errada, ou
// nenhuma.
//
// Estes testes usam o `matchRoutes` DE VERDADE do React Router, porque a regra
// em jogo e' a pontuacao dele (segmento estatico vale mais que dinamico, e
// splat e' penalizado) — nao uma convencao nossa que pudessemos afirmar lendo
// o codigo.
describe("a familia /cliente depois que o portal logado entrou", () => {
  // Espelha os paths declarados em App.tsx. `id` e' so rotulo de leitura.
  const rotas: RouteObject[] = [
    { id: "signature", path: "/cliente/assinar/:token" },
    { id: "commercial", path: "/cliente/comercial" },
    { id: "budgetCompleto", path: "/cliente/orcamento/:id" },
    { id: "budgetPorCliente", path: "/cliente/:customerId/orcamento/:id" },
    { id: "dossieCompleto", path: "/cliente/dossie/:id" },
    { id: "dossiePorCliente", path: "/cliente/:customerId/dossie/:id" },
    // O portal e' uma rota de LAYOUT (sem `path`) com as duas telas dentro: e'
    // o que faz o `ResponsibleAuthProvider` atravessar a navegacao entre entrar
    // e painel em vez de ser desmontado e remontado do zero.
    //
    // A ausencia de `path` na mae importa: com `path: "/cliente"` ela casaria
    // SOZINHA e `/cliente` puro renderizaria o provider com um Outlet vazio.
    {
      id: "portalProvider",
      children: [
        { id: "portalLogin", path: routes.customer.portal.login },
        {
          id: "portalShell",
          path: `${routes.customer.portal.root}/*`,
          children: [{ id: "portalIndex", index: true }, { id: "portalResto", path: "*" }],
        },
      ],
    },
    { id: "catchAll", path: "*" },
  ];

  const quem = (url: string) =>
    (matchRoutes(rotas, url) ?? []).map(m => m.route.id).join(" > ");

  it("nao ensombrou nenhuma das rotas publicas que ja existiam", () => {
    expect(quem("/cliente/comercial")).toBe("commercial");
    expect(quem("/cliente/assinar/TOKEN")).toBe("signature");
    expect(quem("/cliente/orcamento/ID")).toBe("budgetCompleto");
    expect(quem("/cliente/UUID/orcamento/ID")).toBe("budgetPorCliente");
    expect(quem("/cliente/dossie/ID")).toBe("dossieCompleto");
    expect(quem("/cliente/UUID/dossie/ID")).toBe("dossiePorCliente");
  });

  it("entra no portal pelas duas portas dele, e as duas passam pelo MESMO provider", () => {
    expect(quem(routes.customer.portal.login)).toBe("portalProvider > portalLogin");
    expect(quem(routes.customer.portal.root)).toBe(
      "portalProvider > portalShell > portalIndex",
    );
  });

  // A rota-mae do provider NAO tem `index`. Sem um filho que case, `/cliente`
  // sozinho nao casa com o ramo do portal e segue caindo no catch-all — que e'
  // o comportamento que ja existia antes do portal nascer.
  it("/cliente sozinho nao foi capturado pelo portal", () => {
    expect(quem("/cliente")).toBe("catchAll");
  });

  // Sem o `path="*"` filho, esta URL casava com o shell e com NENHUM filho: o
  // <Outlet/> renderizava `null` e o contato via o cabecalho do portal sobre uma
  // pagina em branco — sem erro, sem 404 e sem caminho de volta.
  it("sub-rota inexistente do portal cai no filho catch-all, nunca no vazio", () => {
    const casamento = matchRoutes(rotas, `${routes.customer.portal.root}/nao-existe`) ?? [];
    expect(casamento.map(m => m.route.id)).toEqual([
      "portalProvider",
      "portalShell",
      "portalResto",
    ]);
  });

  // ARMADILHA CONHECIDA, fixada de proposito.
  //
  // `/cliente/:customerId/orcamento/:id` pontua ACIMA de `/cliente/painel/*`
  // (quatro segmentos, dois estaticos, contra dois estaticos e um splat
  // penalizado). Entao uma secao do portal chamada `orcamento` ou `dossie` nunca
  // seria alcancada: a rota PUBLICA a engole, com `customerId = "painel"`, e o
  // cliente recebe um documento publico no lugar da tela logada que pediu.
  //
  // Se este teste falhar, alguem mexeu na pontuacao ou nos paths — e a decisao
  // de dar ao portal uma secao com um desses nomes tem de ser tomada de olhos
  // abertos, provavelmente mudando o prefixo do portal.
  it("documenta a colisao: 'orcamento' e 'dossie' nao podem virar secoes do portal", () => {
    expect(quem(`${routes.customer.portal.root}/orcamento/ID`)).toBe("budgetPorCliente");
    expect(quem(`${routes.customer.portal.root}/dossie/ID`)).toBe("dossiePorCliente");
  });
});
