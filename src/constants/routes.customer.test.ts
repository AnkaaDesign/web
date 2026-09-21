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
          children: [
            { id: "portalIndex", index: true },
            { id: "portalOrcamentos", path: "orcamentos" },
            { id: "portalOrcamento", path: "orcamentos/:id" },
            { id: "portalSolicitar", path: "solicitar" },
            { id: "portalVeiculos", path: "veiculos" },
            { id: "portalVeiculo", path: "veiculos/:taskId" },
            { id: "portalAssinaturas", path: "assinaturas" },
            { id: "portalCobrancas", path: "cobrancas" },
            { id: "portalPedidos", path: "pedidos" },
            { id: "portalResto", path: "*" },
          ],
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

  // ── AS SECOES DO PORTAL (20/09/2026) ──────────────────────────────────────
  //
  // Cada uma tem de casar com o SEU filho, e nao com a publica irmã nem com o
  // catch-all do shell. O teste acima prova que a colisao existe; estes provam
  // que cada secao nova escapou dela.
  //
  // ⚠️ SECAO NOVA NO PORTAL PRECISA DE LINHA AQUI. Sem ela, a colisao volta
  // calada: a pessoa clica no menu e recebe um documento publico, ou o painel.
  it("cada secao do portal alcanca a PROPRIA tela", () => {
    const shell = "portalProvider > portalShell > ";
    expect(quem(routes.customer.portal.orcamentos)).toBe(shell + "portalOrcamentos");
    expect(quem(routes.customer.portal.orcamento("ID"))).toBe(shell + "portalOrcamento");
    expect(quem(routes.customer.portal.solicitar)).toBe(shell + "portalSolicitar");
    expect(quem(routes.customer.portal.veiculos)).toBe(shell + "portalVeiculos");
    expect(quem(routes.customer.portal.veiculo("TASK"))).toBe(shell + "portalVeiculo");
    expect(quem(routes.customer.portal.assinaturas)).toBe(shell + "portalAssinaturas");
    expect(quem(routes.customer.portal.cobrancas)).toBe(shell + "portalCobrancas");
    expect(quem(routes.customer.portal.pedidos)).toBe(shell + "portalPedidos");
  });

  // O PLURAL E' A DEFESA, E E' SO ISSO QUE SEPARA UMA DA OUTRA.
  //
  // `orcamentos` escapa porque o terceiro segmento deixa de casar com o literal
  // `orcamento` da rota publica. Trocar para o singular — por "consistencia",
  // por refatoracao ou por engano — devolve a secao inteira para a publica, e o
  // contato passa a ver um documento aberto por capability no lugar da lista
  // logada dele.
  it("o singular seria engolido pela rota publica; o plural nao e'", () => {
    expect(quem(`${routes.customer.portal.root}/orcamentos/ID`)).toBe(
      "portalProvider > portalShell > portalOrcamento",
    );
    expect(quem(`${routes.customer.portal.root}/orcamento/ID`)).toBe("budgetPorCliente");

    expect(routes.customer.portal.orcamentos.split("/").filter(Boolean)).toEqual([
      "cliente",
      "painel",
      "orcamentos",
    ]);
  });

  // Nenhuma secao do portal pode ensombrar as publicas, que sao as que chegam
  // por WhatsApp e continuam tendo de abrir para quem nao tem sessao.
  it("as publicas seguem intactas depois das secoes novas", () => {
    expect(quem("/cliente/UUID/orcamento/ID")).toBe("budgetPorCliente");
    expect(quem("/cliente/UUID/dossie/ID")).toBe("dossiePorCliente");
    expect(quem("/cliente/assinar/TOKEN")).toBe("signature");
    expect(quem("/cliente")).toBe("catchAll");
  });
});
