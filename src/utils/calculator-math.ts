// calculator-math.ts
// Avaliador seguro de expressões aritméticas para a Calculadora
// (/ferramentas/calculadora). NUNCA usa eval()/Function() — tokenizer +
// parser descendente recursivo + avaliação de AST.
//
// Gramática:
//   expr    := term (("+" | "-") term)*
//   term    := unary (("*" | "/") unary)*
//   unary   := "-" unary | postfix
//   postfix := primary ("%")*
//   primary := NUMBER | "(" expr ")"
//
// Semântica do "%" (comportamento clássico de calculadora):
//   • em soma/subtração, percentual do operando esquerdo:
//       100 + 10%  = 110      (100 + 100×0,10)
//       200 - 25%  = 150
//   • em multiplicação/divisão (e isolado), fração simples:
//       200 × 10%  = 20       (200 × 0,10)
//       50%        = 0,5
//
// Números aceitam vírgula OU ponto como separador decimal (pt-BR first).

export type EvalResult = { ok: true; value: number } | { ok: false; error: string };

// ---------------------------------------------------------------------------
// Tokenizer
// ---------------------------------------------------------------------------

type Token =
  | { kind: "num"; value: number }
  | { kind: "op"; op: "+" | "-" | "*" | "/" }
  | { kind: "percent" }
  | { kind: "lparen" }
  | { kind: "rparen" };

function tokenize(input: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  while (i < input.length) {
    const ch = input[i];
    if (ch === " " || ch === "\t") {
      i++;
      continue;
    }
    if (ch === "(") {
      tokens.push({ kind: "lparen" });
      i++;
      continue;
    }
    if (ch === ")") {
      tokens.push({ kind: "rparen" });
      i++;
      continue;
    }
    if (ch === "%") {
      tokens.push({ kind: "percent" });
      i++;
      continue;
    }
    // Aliases visuais ×/÷/− vindos do teclado da UI.
    if (ch === "+" || ch === "-" || ch === "−") {
      tokens.push({ kind: "op", op: ch === "−" ? "-" : (ch as "+" | "-") });
      i++;
      continue;
    }
    if (ch === "*" || ch === "×") {
      tokens.push({ kind: "op", op: "*" });
      i++;
      continue;
    }
    if (ch === "/" || ch === "÷") {
      tokens.push({ kind: "op", op: "/" });
      i++;
      continue;
    }
    if (/[0-9.,]/.test(ch)) {
      let j = i;
      let sawDecimal = false;
      let raw = "";
      while (j < input.length && /[0-9.,]/.test(input[j])) {
        const c = input[j];
        if (c === "." || c === ",") {
          if (sawDecimal) throw new Error("Número inválido");
          sawDecimal = true;
          raw += ".";
        } else {
          raw += c;
        }
        j++;
      }
      if (raw === "." || raw === "") throw new Error("Número inválido");
      const value = Number(raw);
      if (!Number.isFinite(value)) throw new Error("Número inválido");
      tokens.push({ kind: "num", value });
      i = j;
      continue;
    }
    throw new Error(`Caractere inválido: "${ch}"`);
  }
  return tokens;
}

// ---------------------------------------------------------------------------
// Parser (AST)
// ---------------------------------------------------------------------------

type Node =
  | { type: "num"; value: number }
  | { type: "neg"; inner: Node }
  | { type: "percent"; inner: Node }
  | { type: "bin"; op: "+" | "-" | "*" | "/"; left: Node; right: Node };

class Parser {
  private pos = 0;
  constructor(private readonly tokens: Token[]) {}

  parse(): Node {
    if (this.tokens.length === 0) throw new Error("Expressão vazia");
    const node = this.parseExpr();
    if (this.pos < this.tokens.length) throw new Error("Expressão inválida");
    return node;
  }

  private peek(): Token | undefined {
    return this.tokens[this.pos];
  }

  private parseExpr(): Node {
    let left = this.parseTerm();
    for (;;) {
      const t = this.peek();
      if (t?.kind === "op" && (t.op === "+" || t.op === "-")) {
        this.pos++;
        const right = this.parseTerm();
        left = { type: "bin", op: t.op, left, right };
      } else {
        return left;
      }
    }
  }

  private parseTerm(): Node {
    let left = this.parseUnary();
    for (;;) {
      const t = this.peek();
      if (t?.kind === "op" && (t.op === "*" || t.op === "/")) {
        this.pos++;
        const right = this.parseUnary();
        left = { type: "bin", op: t.op, left, right };
      } else {
        return left;
      }
    }
  }

  private parseUnary(): Node {
    const t = this.peek();
    if (t?.kind === "op" && t.op === "-") {
      this.pos++;
      return { type: "neg", inner: this.parseUnary() };
    }
    if (t?.kind === "op" && t.op === "+") {
      this.pos++;
      return this.parseUnary();
    }
    return this.parsePostfix();
  }

  private parsePostfix(): Node {
    let node = this.parsePrimary();
    while (this.peek()?.kind === "percent") {
      this.pos++;
      node = { type: "percent", inner: node };
    }
    return node;
  }

  private parsePrimary(): Node {
    const t = this.peek();
    if (!t) throw new Error("Expressão incompleta");
    if (t.kind === "num") {
      this.pos++;
      return { type: "num", value: t.value };
    }
    if (t.kind === "lparen") {
      this.pos++;
      const inner = this.parseExpr();
      if (this.peek()?.kind !== "rparen") throw new Error("Parêntese não fechado");
      this.pos++;
      return inner;
    }
    throw new Error("Expressão inválida");
  }
}

// ---------------------------------------------------------------------------
// Avaliação
// ---------------------------------------------------------------------------

function evalNode(node: Node): number {
  switch (node.type) {
    case "num":
      return node.value;
    case "neg":
      return -evalNode(node.inner);
    case "percent":
      // Percentual "solto" (fora de soma/subtração) = fração simples.
      return evalNode(node.inner) / 100;
    case "bin": {
      const left = evalNode(node.left);
      // Em soma/subtração, X ± Y% significa X ± X·(Y/100).
      if ((node.op === "+" || node.op === "-") && node.right.type === "percent") {
        const pct = evalNode(node.right.inner) / 100;
        return node.op === "+" ? left + left * pct : left - left * pct;
      }
      const right = evalNode(node.right);
      switch (node.op) {
        case "+":
          return left + right;
        case "-":
          return left - right;
        case "*":
          return left * right;
        case "/":
          if (right === 0) throw new Error("Divisão por zero");
          return left / right;
      }
    }
  }
}

/** Avalia a expressão sem lançar — retorna { ok, value | error }. */
export function evaluateExpression(input: string): EvalResult {
  try {
    const value = evalNode(new Parser(tokenize(input)).parse());
    if (!Number.isFinite(value)) return { ok: false, error: "Resultado inválido" };
    return { ok: true, value };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Expressão inválida" };
  }
}

/**
 * Formata o resultado em pt-BR (vírgula decimal), com até 10 casas e sem
 * zeros à direita. Corrige ruído binário (0,1 + 0,2 → 0,3).
 */
export function formatCalcResult(value: number): string {
  // 12 dígitos significativos suprimem o ruído de ponto flutuante sem
  // arredondar resultados "reais" visíveis numa calculadora de mesa.
  const cleaned = Number(value.toPrecision(12));
  return cleaned.toLocaleString("pt-BR", {
    maximumFractionDigits: 10,
    useGrouping: false,
  });
}
