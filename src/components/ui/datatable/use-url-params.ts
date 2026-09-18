import { useCallback, useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";

/**
 * UM ESCRITOR SÓ PARA A QUERY STRING DA TABELA — e que ACUMULA.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * POR QUE ISTO PRECISA EXISTIR
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * `setSearchParams(fn)` do react-router PARECE o `setState` do React e não é.
 * A implementação (6.30.1) é:
 *
 *     const setSearchParams = useCallback((nextInit, opts) => {
 *       const next = createSearchParams(
 *         typeof nextInit === "function" ? nextInit(searchParams) : nextInit
 *       );
 *       navigate("?" + next, opts);
 *     }, [navigate, searchParams]);
 *
 * O `searchParams` que o `fn` recebe é o CAPTURADO NAQUELE RENDER — não uma fila
 * que se acumula. Duas chamadas no mesmo tick partem da MESMA base, e a segunda
 * navega por cima da primeira: a primeira escrita simplesmente some.
 *
 * Havia dois escritores independentes na tabela (um no motor, outro no
 * componente) e vários pares de escritas no mesmo tick. O que se perdia:
 *
 *  · ORDENAR — o motor escrevia `sort` e, logo em seguida, apagava `page`
 *    (ordenar invalida a página). A segunda chamada partia da base SEM `sort`,
 *    então a ordem nunca chegava à URL. Numa lista em modo servidor a consulta
 *    sai da URL: o cabeçalho mostrava a seta nova e o servidor continuava
 *    devolvendo a ordem antiga. "Mudei e continuou errado."
 *  · FILTRAR — o componente escrevia `filters` e o motor apagava `page` em
 *    seguida; o filtro sumia da URL (a consulta ainda saía certa, porque vem do
 *    estado, mas recarregar ou compartilhar o link perdia o recorte).
 *
 * A correção é um acumulador com vida de um tick: a primeira escrita clona o
 * `searchParams` corrente, as seguintes mutam ESSE objeto, e o buffer é
 * descartado no commit — quando o `searchParams` do render já traz tudo.
 *
 * ⚠️ USE UMA INSTÂNCIA SÓ POR TABELA. Dois `useUrlParams()` são dois buffers, e
 * duas escritas no mesmo tick vindas de buffers diferentes voltam a se apagar —
 * que é exatamente o defeito acima. Por isso o `DataTable` cria o escritor e o
 * passa para o motor em vez de cada um criar o seu.
 */
export type UrlParamWriter = (mutate: (params: URLSearchParams) => void) => void;

export function useUrlParams(syncUrl: boolean): UrlParamWriter {
  const [searchParams, setSearchParams] = useSearchParams();

  /** O que a URL será depois das escritas já feitas NESTE tick. Nulo entre ticks. */
  const pending = useRef<URLSearchParams | null>(null);
  /** O `searchParams` do render corrente — a base quando não há nada pendente. */
  const current = useRef(searchParams);
  current.current = searchParams;

  // Descarta o acumulado a cada commit: daí em diante a base é o `searchParams`
  // do render, que já reflete o que foi navegado. Sem lista de dependências de
  // propósito — precisa rodar em TODO commit, inclusive num em que a URL não
  // mudou (uma escrita que resultasse na mesma string não re-renderizaria por
  // `location.search`, e um buffer preso aqui envenenaria a próxima escrita).
  useEffect(() => {
    pending.current = null;
  });

  return useCallback(
    (mutate: (params: URLSearchParams) => void) => {
      if (!syncUrl) return;
      const base = pending.current ?? new URLSearchParams(current.current);
      mutate(base);
      pending.current = base;
      // Cópia: o objeto navegado não pode ser o mesmo que continuará sendo mutado
      // pelas próximas escritas deste tick.
      setSearchParams(new URLSearchParams(base), { replace: true });
    },
    [setSearchParams, syncUrl],
  );
}
