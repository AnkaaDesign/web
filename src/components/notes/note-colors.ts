// note-colors.ts
// Paleta compartilhada das notas — nomes persistidos no campo `color` da Note.
// Estilo escolhido para bom contraste de texto em claro/escuro (o texto é
// sempre forçado escuro sobre os fundos pastéis).
//
// IMPORTANT: as chaves precisam bater EXATAMENTE com o enum da API NOTE_COLORS
// (yellow | pink | blue | green | orange | purple) — outros valores são
// rejeitados (400).
export const NOTE_COLOR_CLASSES: Record<string, { card: string; dot: string; label: string }> = {
  yellow: { card: "bg-yellow-200 border-yellow-400", dot: "bg-yellow-300 border-yellow-500", label: "Amarelo" },
  orange: { card: "bg-orange-200 border-orange-400", dot: "bg-orange-300 border-orange-500", label: "Laranja" },
  pink: { card: "bg-pink-200 border-pink-400", dot: "bg-pink-300 border-pink-500", label: "Rosa" },
  purple: { card: "bg-purple-200 border-purple-400", dot: "bg-purple-300 border-purple-500", label: "Roxo" },
  blue: { card: "bg-sky-200 border-sky-400", dot: "bg-sky-300 border-sky-500", label: "Azul" },
  green: { card: "bg-green-200 border-green-400", dot: "bg-green-300 border-green-500", label: "Verde" },
};

export const NOTE_COLOR_NAMES = Object.keys(NOTE_COLOR_CLASSES);

export function colorClasses(color: string) {
  return NOTE_COLOR_CLASSES[color] ?? NOTE_COLOR_CLASSES.yellow;
}

// Converte o HTML leve do corpo da nota em texto plano para prévias (board mode)
// e para busca. Remove tags e normaliza espaços/entidades básicas.
export function stripHtml(html: string | null | undefined): string {
  if (!html) return "";
  if (typeof document !== "undefined") {
    const el = document.createElement("div");
    el.innerHTML = html;
    return (el.textContent || el.innerText || "").replace(/\s+/g, " ").trim();
  }
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
