// commemorative-dates.ts
// ===========================================================================
// FONTE ÚNICA das DATAS COMEMORATIVAS pt-BR do calendário unificado de RH.
// (O calendário em /departamento-pessoal/calendario lê este arquivo via
//  getCommemorativesForDay(); não há cadastro no servidor — quem quiser
//  adicionar/remover uma data comemorativa edita as tabelas abaixo.)
//
// Duas famílias:
//   • FIXAS  — recorrem todo ano no mesmo dia/mês. Tabela FIXED_DATES, chave
//     "MM-DD" → lista de nomes. Editar aqui para incluir/remover.
//   • MÓVEIS — caem em dias diferentes a cada ano, então são CALCULADAS:
//       – Carnaval, Sexta-feira Santa, Páscoa e Corpus Christi derivam do
//         domingo de Páscoa (algoritmo computus de Butcher/Meeus em
//         easterSunday()); ex.: Corpus Christi = Páscoa + 60 dias.
//       – Dia das Mães / Dia dos Pais = 2º domingo de maio/agosto
//         (nthSundayOfMonth()).
//     Ver movableDatesForYear() — as datas são computadas e cacheadas por ano.
//
// FERIADOS OFICIAIS (Natal, Corpus Christi, Independência…) NÃO vêm daqui —
// vêm do Secullum (useSecullumHolidays, categoria ciano própria). Como várias
// comemorativas coincidem com feriados (Natal, Ano Novo, Corpus Christi,
// Finados…), o calendário NÃO renderiza a comemorativa quando já existe um
// feriado equivalente no mesmo dia: ver dedupeAgainstHolidays() / a barra de
// feriado "vence". Assim 04/06 mostra só "CORPUS CHRISTI" (feriado), não a
// duplicata "Corpus Christi" (comemorativa).
// ===========================================================================

export interface CommemorativeDate {
  name: string;
  /** Aniversário de fundação da empresa — recebe rótulo próprio no cartão. */
  isCompanyAnniversary?: boolean;
}

// ---------------------------------------------------------------------------
// Aniversário da EMPRESA
// ---------------------------------------------------------------------------
// TODO: não existe hoje nenhuma entidade/configuração no servidor guardando a
// data de fundação da empresa (verificado: prisma/schema.prisma não tem campo
// founding/fundação). Quando esse cadastro existir, substituir esta constante
// pela leitura do servidor. Preencher com { month: 1-12, day: 1-31 } para o
// aniversário aparecer no calendário; null = oculto.
export const COMPANY_FOUNDING: { month: number; day: number } | null = null;
export const COMPANY_ANNIVERSARY_LABEL = "Aniversário da Empresa";

// ---------------------------------------------------------------------------
// Datas fixas — chave "MM-DD"
// ---------------------------------------------------------------------------
const FIXED_DATES: Record<string, string[]> = {
  "01-01": ["Ano Novo"],
  "03-08": ["Dia da Mulher"],
  "05-01": ["Dia do Trabalho"],
  "06-12": ["Dia dos Namorados"],
  "06-13": ["Festa Junina — Santo Antônio"],
  "06-24": ["Festa Junina — São João"],
  "06-29": ["Festa Junina — São Pedro"],
  "09-07": ["Independência do Brasil"],
  "10-12": ["Nossa Senhora Aparecida", "Dia das Crianças"],
  "11-02": ["Finados"],
  "11-15": ["Proclamação da República"],
  "11-20": ["Dia da Consciência Negra"],
  "12-25": ["Natal"],
};

// ---------------------------------------------------------------------------
// Computus — domingo de Páscoa (algoritmo de Butcher/Meeus, calendário
// gregoriano). Carnaval, Sexta-feira Santa e Corpus Christi derivam dele.
// ---------------------------------------------------------------------------
export function easterSunday(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31); // 3 = março, 4 = abril
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

/** N-ésimo domingo de um mês (month 0-based, nth 1-based). */
function nthSundayOfMonth(year: number, month: number, nth: number): Date {
  const first = new Date(year, month, 1);
  const offset = (7 - first.getDay()) % 7; // dias até o 1º domingo
  return new Date(year, month, 1 + offset + (nth - 1) * 7);
}

const dayKey = (d: Date): string =>
  `${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

// Cache por ano das datas móveis (computadas uma única vez por render-cycle).
const movableCache = new Map<number, Map<string, string[]>>();

function movableDatesForYear(year: number): Map<string, string[]> {
  const cached = movableCache.get(year);
  if (cached) return cached;

  const easter = easterSunday(year);
  const map = new Map<string, string[]>();
  const push = (date: Date, name: string) => {
    const key = dayKey(date);
    map.set(key, [...(map.get(key) ?? []), name]);
  };

  push(addDays(easter, -47), "Carnaval"); // terça-feira de Carnaval
  push(addDays(easter, -2), "Sexta-feira Santa");
  push(easter, "Páscoa");
  push(addDays(easter, 60), "Corpus Christi");
  push(nthSundayOfMonth(year, 4, 2), "Dia das Mães"); // 2º domingo de maio
  push(nthSundayOfMonth(year, 7, 2), "Dia dos Pais"); // 2º domingo de agosto

  movableCache.set(year, map);
  return map;
}

/**
 * Todas as datas comemorativas (fixas + móveis + aniversário da empresa)
 * que caem no dia informado.
 */
export function getCommemorativesForDay(date: Date): CommemorativeDate[] {
  const key = dayKey(date);
  const result: CommemorativeDate[] = [];

  for (const name of FIXED_DATES[key] ?? []) result.push({ name });
  for (const name of movableDatesForYear(date.getFullYear()).get(key) ?? []) {
    result.push({ name });
  }
  if (
    COMPANY_FOUNDING &&
    COMPANY_FOUNDING.month === date.getMonth() + 1 &&
    COMPANY_FOUNDING.day === date.getDate()
  ) {
    result.push({ name: COMPANY_ANNIVERSARY_LABEL, isCompanyAnniversary: true });
  }
  return result;
}

// ---------------------------------------------------------------------------
// Dedupe comemorativa × feriado
// ---------------------------------------------------------------------------
// Normaliza um rótulo para comparação tolerante: minúsculas, sem acentos,
// sem pontuação e com espaços colapsados. Assim "CORPUS CHRISTI" (feriado
// Secullum, caixa-alta) casa com "Corpus Christi" (comemorativa), e
// "Nossa Senhora Aparecida" casa com "Nossa Sra. Aparecida", etc.
function normalizeName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // remove diacríticos
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ") // pontuação → espaço
    .trim();
}

/**
 * Remove as comemorativas que coincidem com um FERIADO oficial do mesmo dia
 * (comparação por nome normalizado) — nesses dias o feriado "vence" e a barra
 * comemorativa duplicada é suprimida. `holidayNames` são as descrições dos
 * feriados Secullum que caem no dia (ex.: ["Corpus Christi"]).
 *
 * O aniversário da empresa NUNCA é deduplicado (não é feriado nacional).
 */
export function dedupeAgainstHolidays(
  commemoratives: CommemorativeDate[],
  holidayNames: string[],
): CommemorativeDate[] {
  if (holidayNames.length === 0) return commemoratives;
  const holidaySet = new Set(holidayNames.map(normalizeName));
  return commemoratives.filter(
    (c) => c.isCompanyAnniversary || !holidaySet.has(normalizeName(c.name)),
  );
}
