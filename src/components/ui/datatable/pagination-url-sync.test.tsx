/**
 * A PAGINAÇÃO DA TABELA E A URL TÊM DE CONTAR A MESMA HISTÓRIA.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * OS DEFEITOS QUE ESTE ARQUIVO IMPEDE
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Relatados na tela de Faturamento: "clico para ir para a página 2 e às vezes
 * vai, às vezes não; e às vezes muda de página mas o conteúdo continua o mesmo".
 *
 * Numa lista em modo servidor há DUAS verdades sobre "que página estou vendo":
 *
 *   · o estado interno do TanStack (`pagination.pageIndex`), que desenha o rodapé;
 *   · o `?page=` da URL, que é de onde a página monta a consulta ao servidor.
 *
 * 1. ELAS DIVERGIAM. A URL era lida UMA vez, no mount, para semear o estado; daí
 *    em diante a sincronia era só de ida (tabela → URL) e só no clique. Qualquer
 *    mudança de URL por outro caminho deixava o rodapé anunciando a página 3
 *    enquanto a consulta buscava a 1 — e não se recuperava sozinha.
 *
 * 2. AS ESCRITAS NA URL SE APAGAVAM. `setSearchParams(fn)` do react-router
 *    (6.30.1) PARECE o `setState` do React e não é: o `fn` recebe o
 *    `searchParams` capturado NAQUELE RENDER e o resultado vai direto para
 *    `navigate()`. Duas chamadas no mesmo tick partem da mesma base, e a segunda
 *    apaga a primeira. Ordenar fazia exatamente isso (escrevia `sort`, depois
 *    apagava `page`), então a ordem NUNCA chegava à URL — o cabeçalho girava a
 *    seta e o servidor continuava devolvendo a ordem antiga.
 *
 * 3. O RODAPÉ SE DESABILITAVA SOZINHO. Sem `placeholderData`, a consulta devolve
 *    `undefined` enquanto a próxima página viaja e a tela repassa `rowCount = 0`;
 *    `getPageCount()` vira 0, o rodapé colapsa para "1 de 1" e o botão de
 *    avançar fica desabilitado — no instante exato em que o usuário clica de novo.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, render, screen } from "@testing-library/react";
import { MemoryRouter, useSearchParams, useLocation } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

vi.mock("@/hooks/common/use-table-preferences", () => ({
  useTablePreferences: () => ({
    localConfig: null,
    localDirty: false,
    serverConfig: null,
    isServerLoaded: true,
    save: vi.fn(),
    reset: vi.fn(),
  }),
}));

import { useDataTable } from "./use-data-table";
import { useUrlParams } from "./use-url-params";
import { DataTable } from "./data-table";
import type { DataTableColumnDef } from "./data-table-types";

interface Row {
  id: string;
  name: string;
}

const COLUMNS = [{ id: "name", accessorKey: "name", header: "Nome" }] as DataTableColumnDef<Row>[];
const ROWS: Row[] = Array.from({ length: 20 }, (_, i) => ({ id: `r${i}`, name: `Linha ${i}` }));

/** Lê o `?…` corrente de dentro do Router, para o teste poder afirmar sobre ele. */
function locationSpy(sink: { search: string }) {
  return function Spy() {
    sink.search = useLocation().search;
    return null;
  };
}

/** O motor da tabela em modo servidor, com o escritor de URL que o `DataTable` lhe dá. */
function serverTable(sink: { search: string }, initial: string, extra?: React.ReactNode) {
  const Spy = locationSpy(sink);
  return renderHook(
    () => {
      const writeUrl = useUrlParams(true);
      return useDataTable<Row>({
        tableId: "t",
        data: ROWS,
        columns: COLUMNS,
        scrollRef: { current: null },
        listRef: { current: null },
        mode: "server",
        rowCount: 200,
        defaultPageSize: 20,
        getRowId: (r: Row) => r.id,
        writeUrl,
      });
    },
    {
      wrapper: ({ children }) => (
        <MemoryRouter initialEntries={[initial]}>
          <Spy />
          {extra}
          {children}
        </MemoryRouter>
      ),
    },
  );
}

beforeEach(() => {
  localStorage.clear();
});

describe("a premissa do react-router: setSearchParams NÃO acumula", () => {
  it("duas escritas cruas no mesmo tick — a segunda apaga a primeira", () => {
    const sink = { search: "" };
    let write: (k: string, v: string) => void = () => {};
    const Spy = locationSpy(sink);

    function Probe() {
      const [, setSearchParams] = useSearchParams();
      write = (k, v) =>
        setSearchParams(
          (prev) => {
            const next = new URLSearchParams(prev);
            next.set(k, v);
            return next;
          },
          { replace: true },
        );
      return null;
    }

    render(
      <MemoryRouter initialEntries={["/x"]}>
        <Spy />
        <Probe />
      </MemoryRouter>,
    );

    act(() => {
      write("a", "1");
      write("b", "2");
    });

    expect(sink.search).toContain("b=2");
    expect(sink.search).not.toContain("a=1"); // ← a primeira escrita some
  });

  it("e é por isso que `useUrlParams` existe: com ele, as duas sobrevivem", () => {
    const sink = { search: "" };
    let write: (k: string, v: string) => void = () => {};
    const Spy = locationSpy(sink);

    function Probe() {
      const writeUrl = useUrlParams(true);
      write = (k, v) => writeUrl((p) => p.set(k, v));
      return null;
    }

    render(
      <MemoryRouter initialEntries={["/x"]}>
        <Spy />
        <Probe />
      </MemoryRouter>,
    );

    act(() => {
      write("a", "1");
      write("b", "2");
    });

    expect(sink.search).toContain("a=1");
    expect(sink.search).toContain("b=2");
  });

  it("e o acumulado não vaza para o tick seguinte", () => {
    const sink = { search: "" };
    let write: (k: string, v: string | null) => void = () => {};
    const Spy = locationSpy(sink);

    function Probe() {
      const writeUrl = useUrlParams(true);
      write = (k, v) => writeUrl((p) => (v === null ? p.delete(k) : p.set(k, v)));
      return null;
    }

    render(
      <MemoryRouter initialEntries={["/x"]}>
        <Spy />
        <Probe />
      </MemoryRouter>,
    );

    act(() => {
      write("a", "1");
    });
    act(() => {
      write("a", null);
    });

    expect(sink.search).not.toContain("a=1");
  });
});

describe("ir para a página 2", () => {
  it("leva o ?page=2 para a URL", () => {
    const sink = { search: "" };
    const { result } = serverTable(sink, "/x");

    act(() => {
      result.current.table.setPageIndex(1);
    });

    expect(result.current.table.getState().pagination.pageIndex).toBe(1);
    expect(sink.search).toContain("page=2");
  });

  it("ordenar zera a página E publica a ordem — as duas coisas", () => {
    const sink = { search: "" };
    const { result } = serverTable(sink, "/x");

    act(() => {
      result.current.table.setPageIndex(1);
    });
    expect(sink.search).toContain("page=2");

    act(() => {
      result.current.table.setSorting([{ id: "name", desc: true }]);
    });

    // É da URL que a consulta ao servidor sai: sem o `sort` ali, o cabeçalho
    // mostra a seta nova e o servidor devolve a ordem antiga.
    expect(sink.search).not.toContain("page=2");
    expect(sink.search).toContain("sort=");
  });
});

describe("a URL manda na página", () => {
  it("o rodapé segue o ?page= quando ele muda POR FORA da tabela", () => {
    // Voltar do navegador, um link restaurado, ou uma escrita concorrente que
    // apagou o `page`. Se o estado interno não seguir, o rodapé anuncia a 3
    // enquanto a consulta monta a 1 — "mudou de página, continua o mesmo".
    const sink = { search: "" };
    let forceUrl: (search: string) => void = () => {};

    function Outsider() {
      const [, setSearchParams] = useSearchParams();
      forceUrl = (search) => setSearchParams(new URLSearchParams(search), { replace: true });
      return null;
    }

    const { result } = serverTable(sink, "/x?page=3", <Outsider />);
    expect(result.current.table.getState().pagination.pageIndex).toBe(2);

    act(() => {
      forceUrl("");
    });

    expect(sink.search).toBe("");
    expect(result.current.table.getState().pagination.pageIndex).toBe(0);
  });

  it("e um `pageSize` ausente na URL não desfaz o tamanho já em vigor", () => {
    // As restaurações (config do servidor, padrão do setor) só escrevem o
    // tamanho quando ele difere do padrão. Ausência quer dizer "o que já vale",
    // não "volte ao padrão" — senão o efeito de sincronia desfaria a restauração.
    const sink = { search: "" };
    const { result } = serverTable(sink, "/x");

    act(() => {
      result.current.table.setPageSize(60);
    });
    expect(result.current.table.getState().pagination.pageSize).toBe(60);

    act(() => {
      result.current.table.setPageIndex(1);
    });
    expect(result.current.table.getState().pagination.pageSize).toBe(60);
  });
});

describe("o rodapé enquanto a próxima página viaja", () => {
  function Bench({ rowCount, isLoading }: { rowCount: number; isLoading: boolean }) {
    return (
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <MemoryRouter initialEntries={["/x?page=2"]}>
          <DataTable<Row>
            tableId="bench"
            data={isLoading ? [] : ROWS}
            columns={COLUMNS}
            getRowId={(r) => r.id}
            mode="server"
            rowCount={rowCount}
            isLoading={isLoading}
            defaultPageSize={20}
            persist={false}
          />
        </MemoryRouter>
      </QueryClientProvider>
    );
  }

  it("mantém o avançar habilitado quando a contagem ainda não chegou", () => {
    // Primeiro com a contagem em mãos, para o componente aprender quanto é.
    const { rerender } = render(<Bench rowCount={200} isLoading={false} />);
    const next = () => screen.getByRole("button", { name: /pr[óo]xima p[áa]gina/i });
    expect(next()).not.toBeDisabled();

    // Agora o voo: `rowCount` 0 é ausência de resposta, não "não há nada".
    rerender(<Bench rowCount={0} isLoading={true} />);
    expect(next()).not.toBeDisabled();
  });

  it("mas um zero de verdade (busca sem resultado) desabilita", () => {
    render(<Bench rowCount={0} isLoading={false} />);
    expect(screen.getByRole("button", { name: /pr[óo]xima p[áa]gina/i })).toBeDisabled();
  });
});

describe("o formulário fora de rota (syncUrl desligado) não toca na URL", () => {
  it("paginar não escreve nada", () => {
    const sink = { search: "" };
    const Spy = locationSpy(sink);
    const { result } = renderHook(
      () => {
        const writeUrl = useUrlParams(false);
        return useDataTable<Row>({
          tableId: "t2",
          data: ROWS,
          columns: COLUMNS,
          scrollRef: { current: null },
          listRef: { current: null },
          mode: "server",
          rowCount: 200,
          defaultPageSize: 20,
          getRowId: (r: Row) => r.id,
          syncUrl: false,
          writeUrl,
        });
      },
      {
        wrapper: ({ children }) => (
          <MemoryRouter initialEntries={["/x"]}>
            <Spy />
            {children}
          </MemoryRouter>
        ),
      },
    );

    act(() => {
      result.current.table.setPageIndex(1);
    });

    expect(sink.search).toBe("");
    expect(result.current.table.getState().pagination.pageIndex).toBe(1);
  });
});
