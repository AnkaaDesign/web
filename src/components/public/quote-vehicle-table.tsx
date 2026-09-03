import type { ReactNode } from "react";
// `BRAND_COLORS` e não um token de tema: as páginas públicas rodam em
// `force-light`, e um token aqui renderiza branco sobre branco.
import { BRAND_COLORS } from "@/config/company";
import { TRUCK_CATEGORY_LABELS, IMPLEMENT_TYPE_LABELS } from "@/constants";
import { quoteTasks } from "@/utils/quote-tasks";

/**
 * A TABELA DE IDENTIFICAÇÃO DOS VEÍCULOS.
 *
 * ESPELHA `.vehicle-table` do PDF assinado
 * (`api/src/modules/common/signature/document/quote-html.builder.ts`). As duas
 * têm de mostrar as MESMAS colunas na MESMA ordem: a página pública é onde o
 * cliente confere antes de assinar, e o PDF é o que ele assina — divergir entre
 * elas é a classe de defeito que faz alguém aprovar uma coisa e receber outra.
 *
 * POR QUE TABELA E NÃO PROSA
 *   A identificação vinha escrita dentro do parágrafo de abertura: "…no veículo
 *   nº de série: 39239, placa: a registrar, chassi: 953677TGXTR031467,
 *   categoria: Truck, implemento: Refrigerado." Dois problemas, e o segundo já
 *   valia antes de existir orçamento multitarefa:
 *
 *     1. Um orçamento pode cobrir sessenta caminhões, e a prosa viraria um
 *        parágrafo de vinte linhas em que ninguém acha nada.
 *     2. O que o leitor FAZ com esses campos é conferi-los um a um contra o
 *        documento do caminhão. Em prosa, as lacunas "a registrar" caem em
 *        posições diferentes a cada orçamento e o olho precisa varrer a frase
 *        para achar o chassi. Em coluna, ele desce.
 *
 * ⚠️ CORES EXPLÍCITAS, não tokens de tema: as páginas públicas rodam em
 * `force-light`, e um token de tema aqui renderiza branco sobre branco.
 */

interface QuoteVehicleTableProps {
  /** O orçamento — aceita `tasks` (atual) e `task` (grafo antigo/em cache). */
  quote: { tasks?: any[] | null; task?: any | null } | null | undefined;
  className?: string;
}

/** O marcador de cadastro tardio. Visível de propósito — ver `lateSlotHtml`. */
function ARegistrar(): ReactNode {
  return (
    <span className="italic" style={{ color: BRAND_COLORS.textGray }}>
      a registrar
    </span>
  );
}

export function QuoteVehicleTable({ quote, className }: QuoteVehicleTableProps) {
  const tasks = quoteTasks<any>(quote);
  if (tasks.length === 0) return null;

  const labelOf = (map: Record<string, string>, value?: string | null) =>
    value ? (map[value as keyof typeof map] ?? value) : null;

  const anyCategory = tasks.some((t) => !!labelOf(TRUCK_CATEGORY_LABELS as any, t?.truck?.category));
  const anyImplement = tasks.some(
    (t) => !!labelOf(IMPLEMENT_TYPE_LABELS as any, t?.truck?.implementType),
  );

  // Série, placa e chassi saem SEMPRE — com valor, ou com o espaço reservado
  // para ele. Categoria e implemento só ganham coluna se ALGUM veículo os tiver:
  // são classificação, não identidade, e uma coluna inteira de travessões não
  // informa nada.
  const columns: Array<{ key: string; label: string }> = [
    { key: "serialNumber", label: "Nº de série" },
    { key: "plate", label: "Placa" },
    { key: "chassis", label: "Chassi" },
    ...(anyCategory ? [{ key: "category", label: "Categoria" }] : []),
    ...(anyImplement ? [{ key: "implement", label: "Implemento" }] : []),
  ];

  // A coluna "#" só a partir de dois veículos: com um só ela numeraria uma
  // linha, o que é ruído; com sessenta é o que permite dizer "o veículo 37".
  const showIndex = tasks.length > 1;

  const cell = (task: any, column: string): ReactNode => {
    switch (column) {
      case "serialNumber":
        return task?.serialNumber ? <strong>{task.serialNumber}</strong> : <ARegistrar />;
      case "plate":
        return task?.truck?.plate ? <strong>{task.truck.plate}</strong> : <ARegistrar />;
      case "chassis":
        return task?.truck?.chassisNumber ? (
          <strong>{task.truck.chassisNumber}</strong>
        ) : (
          <ARegistrar />
        );
      case "category": {
        const label = labelOf(TRUCK_CATEGORY_LABELS as any, task?.truck?.category);
        return label ? <strong>{label}</strong> : <span style={{ color: BRAND_COLORS.textGray }}>—</span>;
      }
      case "implement": {
        const label = labelOf(IMPLEMENT_TYPE_LABELS as any, task?.truck?.implementType);
        return label ? <strong>{label}</strong> : <span style={{ color: BRAND_COLORS.textGray }}>—</span>;
      }
      default:
        return null;
    }
  };

  return (
    // `overflow-x-auto` porque a tabela tem cinco colunas e a página pública é
    // aberta no telefone: sem isso o corpo da página rola na horizontal, o que
    // desloca o cabeçalho e o rodapé junto.
    <div className={`mt-3 overflow-x-auto ${className ?? ""}`}>
      <table className="w-full text-sm" style={{ borderCollapse: "collapse" }}>
        <thead>
          <tr>
            {showIndex && (
              <th
                className="text-left font-bold uppercase tracking-wide"
                style={{
                  color: BRAND_COLORS.primaryGreen,
                  fontSize: "0.65rem",
                  borderBottom: `1px solid ${BRAND_COLORS.primaryGreen}`,
                  padding: "0 0.5rem 0.35rem 0",
                  width: "2rem",
                }}
              >
                #
              </th>
            )}
            {columns.map((c) => (
              <th
                key={c.key}
                className="text-left font-bold uppercase tracking-wide whitespace-nowrap"
                style={{
                  color: BRAND_COLORS.primaryGreen,
                  fontSize: "0.65rem",
                  borderBottom: `1px solid ${BRAND_COLORS.primaryGreen}`,
                  padding: "0 0.75rem 0.35rem 0",
                }}
              >
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {tasks.map((task, i) => (
            <tr key={task?.id ?? i} style={{ borderBottom: "1px dotted #ccc" }}>
              {showIndex && (
                <td
                  className="align-baseline tabular-nums"
                  style={{ color: BRAND_COLORS.textGray, padding: "0.35rem 0.5rem 0.35rem 0" }}
                >
                  {i + 1}
                </td>
              )}
              {columns.map((c) => (
                <td
                  key={c.key}
                  className="align-baseline"
                  style={{ color: BRAND_COLORS.textDark, padding: "0.35rem 0.75rem 0.35rem 0" }}
                >
                  {cell(task, c.key)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
