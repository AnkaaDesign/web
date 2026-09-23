/**
 * G4 (lado web) — extrai as formas de consulta que o web REALMENTE manda à API
 * e grava `api/contracts/queries/web.json`, que `api/tests/query-contract.test.ts`
 * passa pelo zod da rota → validador do DMMF (G1) → Prisma, numa transação
 * desfeita no banco clonado.
 *
 * Como acha as formas (análise estática com o compilador do TypeScript, sem
 * rodar o app):
 *
 *   1. toda propriedade `include:` de src/ (fora do Truck Studio) cujo valor dá
 *      para avaliar estaticamente — objeto literal, constante `*_INCLUDE`
 *      (exportada ou não), `as const`/`as never`, spreads de constantes locais,
 *      membros de enum (`TASK_QUOTE_STATUS.APPROVED` → "APPROVED");
 *   2. sobe da propriedade até a chamada que a leva à API (`useTasks`,
 *      `getTaskById`, `useBudgets`…; tabela CHAMADAS abaixo). Se o objeto é
 *      guardado numa variável antes (`const params = useMemo(() => ({…}))` e
 *      depois `useTasks(params)`, ou `{ ...baseParams }`), segue a variável
 *      (até dois saltos); um `include:` DENTRO de outra árvore de include não
 *      é consulta, é parte da de cima;
 *   3. a consulta é o objeto que contém o `include`: as chaves irmãs
 *      (`where`, `orderBy`, `select`, filtros) entram quando também são
 *      estáticas; as que dependem de estado de tela saem e ficam listadas em
 *      `omitidas` (o teste valida o formato, não o valor).
 *
 * Um `cond && {…}` ou `cond ? A : B` dentro do include vira a forma MÁXIMA (os
 * dois ramos juntos): o contrato que interessa é "toda chave que o web pode
 * pedir existe".
 *
 * Só vão para `formas` os modelos cujo schema o teste da api registra (Task,
 * Budget, Airbrushing, Customer, File e, desde a revisão da Fase A, User,
 * Item, Supplier e ChangeLog). O resto sai em `semSchema`, para o dono
 * do teste registrar quando quiser — o teste lê apenas `formas`.
 *
 * Rodar (Node ≥ 23, que remove os tipos sozinho):
 *   node scripts/extract-query-contracts.ts            # grava ../api/contracts/queries/web.json
 *   node scripts/extract-query-contracts.ts --out x.json
 *   node scripts/extract-query-contracts.ts --check    # só compara; sai 1 se o arquivo está velho
 */
import ts from "typescript";
import { execSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const WEB = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DEFAULT_OUT = resolve(WEB, "../api/contracts/queries/web.json");

type Json = null | boolean | number | string | Json[] | { [k: string]: Json };
type Rota = { modelo: string; rota: string; schema: string | null; unica: boolean };

/** Chamada → rota. `schema: null` = o teste da api ainda não registra esse schema. */
const CHAMADAS: Record<string, Rota> = {};
function registrar(nomes: string[], rota: Rota): void {
  for (const n of nomes) CHAMADAS[n] = rota;
}
registrar(["useTasks", "useTasksInfinite", "getTasks"], {
  modelo: "Task", rota: "GET /tasks", schema: "task.taskGetManySchema", unica: false,
});
registrar(["useTaskDetail", "getTaskById"], {
  modelo: "Task", rota: "GET /tasks/:id", schema: "task.taskQuerySchema", unica: true,
});
registrar(["useBudgets", "getBudgets"], {
  modelo: "Budget", rota: "GET /budgets", schema: "budget.budgetGetManySchema", unica: false,
});
registrar(["useAirbrushings", "useAirbrushingsInfinite", "getAirbrushings"], {
  modelo: "Airbrushing", rota: "GET /airbrushings", schema: "airbrushing.airbrushingGetManySchema", unica: false,
});
registrar(["useAirbrushing", "useAirbrushingDetail", "getAirbrushingById"], {
  modelo: "Airbrushing", rota: "GET /airbrushings/:id", schema: "airbrushing.airbrushingQuerySchema", unica: true,
});
registrar(["useCustomers", "useCustomersInfinite", "getCustomers"], {
  modelo: "Customer", rota: "GET /customers", schema: "customer.customerGetManySchema", unica: false,
});
registrar(["useCustomer", "useCustomerDetail", "getCustomerById"], {
  modelo: "Customer", rota: "GET /customers/:id", schema: "customer.customerQuerySchema", unica: true,
});
registrar(["useFiles", "useFilesInfinite", "getFiles"], {
  modelo: "File", rota: "GET /files", schema: "file.fileGetManySchema", unica: false,
});
registrar(["useFile", "getFileById"], {
  modelo: "File", rota: "GET /files/:id", schema: "file.fileQuerySchema", unica: true,
});
// Revisão da Fase A (R-B-11): as rotas com mais consultas em `semSchema`.
registrar(["useUsers", "useUsersInfinite", "getUsers"], {
  modelo: "User", rota: "GET /users", schema: "user.userGetManySchema", unica: false,
});
registrar(["useUser", "getUserById"], {
  modelo: "User", rota: "GET /users/:id", schema: "user.userQuerySchema", unica: true,
});
registrar(["useItems", "useItemsInfinite", "getItems"], {
  modelo: "Item", rota: "GET /items", schema: "item.itemGetManySchema", unica: false,
});
registrar(["useItem", "getItemById"], {
  modelo: "Item", rota: "GET /items/:id", schema: "item.itemQuerySchema", unica: true,
});
registrar(["useSuppliers", "useSuppliersInfinite", "getSuppliers"], {
  modelo: "Supplier", rota: "GET /suppliers", schema: "supplier.supplierGetManySchema", unica: false,
});
registrar(["useSupplierDetail", "getSupplierById"], {
  modelo: "Supplier", rota: "GET /suppliers/:id", schema: "supplier.supplierQuerySchema", unica: true,
});
registrar(["useChangeLogs", "useChangeLogsInfinite", "getChangeLogs"], {
  modelo: "ChangeLog", rota: "GET /changelogs", schema: "changelog.changeLogGetManySchema", unica: false,
});

/**
 * Opções do react-query que os hooks aceitam misturadas aos parâmetros da
 * consulta: não vão à API, então não entram na forma.
 */
const OPCOES_DO_HOOK = new Set([
  "enabled", "refetchInterval", "refetchOnWindowFocus", "refetchOnMount", "refetchOnReconnect",
  "staleTime", "gcTime", "cacheTime", "keepPreviousData", "placeholderData", "retry", "suspense",
  "notifyOnChangeProps",
]);

/** Pastas que declaram schemas/tipos de include (zod), não consultas. */
const FORA = ["/src/schemas/", "/src/types/", "/src/pages/tools/truck-studio/"];

// ─── avaliação estática ──────────────────────────────────────────────────────

class Dinamico extends Error {}

function carregarPrograma(): ts.Program {
  const cfgPath = join(WEB, "tsconfig.app.json");
  const cfg = ts.readConfigFile(cfgPath, ts.sys.readFile);
  if (cfg.error) throw new Error(ts.flattenDiagnosticMessageText(cfg.error.messageText, "\n"));
  const parsed = ts.parseJsonConfigFileContent(cfg.config, ts.sys, WEB, undefined, cfgPath);
  return ts.createProgram({ rootNames: parsed.fileNames, options: { ...parsed.options, noEmit: true } });
}

function nomeDaChave(name: ts.PropertyName): string {
  if (ts.isIdentifier(name) || ts.isStringLiteral(name) || ts.isNumericLiteral(name)) return name.text;
  if (ts.isComputedPropertyName(name) && ts.isStringLiteralLike(name.expression)) return name.expression.text;
  throw new Dinamico(`chave calculada: ${name.getText()}`);
}

function juntar(a: Json, b: Json): Json {
  const obj = (x: Json): x is { [k: string]: Json } => !!x && typeof x === "object" && !Array.isArray(x);
  if (obj(a) && obj(b)) {
    const out: { [k: string]: Json } = { ...a };
    for (const [k, v] of Object.entries(b)) out[k] = k in out ? juntar(out[k], v) : v;
    return out;
  }
  // true ∪ {include:…} = o objeto (pede a relação E os filhos)
  if (a === true && obj(b)) return b;
  if (obj(a) && b === true) return a;
  return b;
}

function criarAvaliador(checker: ts.TypeChecker) {
  const emCurso = new Set<ts.Node>();

  function declaracaoDe(id: ts.Identifier): ts.Declaration | undefined {
    let sym = checker.getSymbolAtLocation(id);
    if (!sym) return undefined;
    if (sym.flags & ts.SymbolFlags.Alias) sym = checker.getAliasedSymbol(sym);
    return sym.valueDeclaration ?? sym.declarations?.[0];
  }

  function literalDoTipo(node: ts.Expression): Json | undefined {
    const t = checker.getTypeAtLocation(node);
    if (t.isStringLiteral()) return t.value;
    if (t.isNumberLiteral()) return t.value;
    return undefined;
  }

  function avaliar(node: ts.Expression): Json | undefined {
    if (
      ts.isAsExpression(node) || ts.isSatisfiesExpression(node) || ts.isParenthesizedExpression(node) ||
      ts.isTypeAssertionExpression(node) || ts.isNonNullExpression(node)
    ) {
      return avaliar(node.expression);
    }
    if (ts.isStringLiteralLike(node)) return node.text;
    if (ts.isNumericLiteral(node)) return Number(node.text);
    if (node.kind === ts.SyntaxKind.TrueKeyword) return true;
    if (node.kind === ts.SyntaxKind.FalseKeyword) return false;
    if (node.kind === ts.SyntaxKind.NullKeyword) return null;
    if (ts.isPrefixUnaryExpression(node) && node.operator === ts.SyntaxKind.MinusToken && ts.isNumericLiteral(node.operand)) {
      return -Number(node.operand.text);
    }
    if (ts.isIdentifier(node)) {
      if (node.text === "undefined") return undefined;
      const decl = declaracaoDe(node);
      if (decl && ts.isVariableDeclaration(decl) && decl.initializer && ts.isVariableDeclarationList(decl.parent) &&
          decl.parent.flags & ts.NodeFlags.Const) {
        if (emCurso.has(decl)) throw new Dinamico(`ciclo em ${node.text}`);
        emCurso.add(decl);
        try {
          return avaliar(decl.initializer);
        } finally {
          emCurso.delete(decl);
        }
      }
      const lit = literalDoTipo(node);
      if (lit !== undefined) return lit;
      throw new Dinamico(`identificador não constante: ${node.text}`);
    }
    if (ts.isPropertyAccessExpression(node)) {
      const lit = literalDoTipo(node); // membro de enum, `as const`
      if (lit !== undefined) return lit;
      const base = avaliar(node.expression);
      if (base && typeof base === "object" && !Array.isArray(base) && node.name.text in base) return base[node.name.text];
      throw new Dinamico(`acesso não constante: ${node.getText()}`);
    }
    if (ts.isArrayLiteralExpression(node)) {
      const out: Json[] = [];
      for (const el of node.elements) {
        if (ts.isSpreadElement(el)) {
          const v = avaliar(el.expression);
          if (!Array.isArray(v)) throw new Dinamico(`spread de não-array: ${el.getText()}`);
          out.push(...v);
        } else {
          const v = avaliar(el);
          if (v !== undefined) out.push(v);
        }
      }
      return out;
    }
    if (ts.isObjectLiteralExpression(node)) {
      let out: { [k: string]: Json } = {};
      for (const p of node.properties) {
        if (ts.isPropertyAssignment(p)) {
          const v = avaliar(p.initializer);
          if (v !== undefined) out[nomeDaChave(p.name)] = v;
        } else if (ts.isShorthandPropertyAssignment(p)) {
          const decl = checker.getShorthandAssignmentValueSymbol(p)?.valueDeclaration;
          if (!decl || !ts.isVariableDeclaration(decl) || !decl.initializer) throw new Dinamico(`atalho não constante: ${p.name.text}`);
          const v = avaliar(decl.initializer);
          if (v !== undefined) out[p.name.text] = v;
        } else if (ts.isSpreadAssignment(p)) {
          const v = avaliar(p.expression);
          if (v && typeof v === "object" && !Array.isArray(v)) out = juntar(out, v) as { [k: string]: Json };
          else if (v !== undefined && v !== false && v !== null) throw new Dinamico(`spread de não-objeto: ${p.getText()}`);
        } else {
          throw new Dinamico(`membro não suportado: ${p.getText().slice(0, 40)}`);
        }
      }
      return out;
    }
    // `cond && X` e `cond ? A : B`: a forma MÁXIMA
    if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken) {
      return avaliar(node.right);
    }
    if (ts.isConditionalExpression(node)) {
      const a = avaliar(node.whenTrue);
      const b = avaliar(node.whenFalse);
      if (a === undefined) return b;
      if (b === undefined || b === false || b === null) return a;
      return juntar(a, b);
    }
    // `x.include || {…}` / `?? {…}`: o padrão que o hook usa quando ninguém passa nada
    if (ts.isBinaryExpression(node) &&
        (node.operatorToken.kind === ts.SyntaxKind.BarBarToken || node.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken)) {
      return avaliar(node.right);
    }
    // `useMemo(() => ({…}), [...])`: o valor é o que a função devolve
    if (ts.isCallExpression(node) && ["useMemo", "React.useMemo"].includes(node.expression.getText())) {
      const fn = node.arguments[0];
      if (fn && ts.isArrowFunction(fn)) {
        if (!ts.isBlock(fn.body)) return avaliar(fn.body);
        const ret = fn.body.statements.find(ts.isReturnStatement);
        if (fn.body.statements.length === 1 && ret?.expression) return avaliar(ret.expression);
      }
    }
    throw new Dinamico(`expressão não estática: ${node.getText().slice(0, 60).replace(/\s+/g, " ")}`);
  }

  return { avaliar };
}

// ─── de onde a consulta sai ──────────────────────────────────────────────────

function nomeDaChamada(call: ts.CallExpression): string | undefined {
  const e = call.expression;
  if (ts.isIdentifier(e)) return e.text;
  if (ts.isPropertyAccessExpression(e)) return e.name.text;
  return undefined;
}

function atravessavel(n: ts.Node): boolean {
  return (
    ts.isObjectLiteralExpression(n) || ts.isAsExpression(n) || ts.isSatisfiesExpression(n) ||
    ts.isParenthesizedExpression(n) || ts.isSpreadAssignment(n) || ts.isPropertyAssignment(n) ||
    ts.isTypeAssertionExpression(n) || ts.isNonNullExpression(n) || ts.isConditionalExpression(n) ||
    (ts.isBinaryExpression(n) && n.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken)
  );
}

/**
 * Sobe de um nó até a chamada que o leva à API. Devolve a rota, ou o nome da
 * chamada desconhecida mais próxima (para `semSchema`), ou nada.
 */
function rotaDe(
  inicio: ts.Node,
  checker: ts.TypeChecker,
  saltos = 0,
): { rota?: Rota; chamada?: string } {
  let n: ts.Node = inicio;
  let chamadaDesconhecida: string | undefined;
  while (n.parent) {
    const p = n.parent;
    if (ts.isCallExpression(p) && p.arguments.includes(n as ts.Expression)) {
      const nome = nomeDaChamada(p);
      if (nome && CHAMADAS[nome]) return { rota: CHAMADAS[nome] };
      // useMemo(() => ({…})) e afins: o valor é o retorno da função
      chamadaDesconhecida ??= nome;
      if (nome === "useMemo" || nome === "useCallback") {
        n = p;
        continue;
      }
      return { chamada: chamadaDesconhecida };
    }
    if (ts.isArrowFunction(p) && p.body === n) {
      n = p;
      continue;
    }
    if (ts.isReturnStatement(p) || ts.isBlock(p)) {
      // `() => { return {…} }` dentro de useMemo
      const fn = ts.findAncestor(p, x => ts.isArrowFunction(x) || ts.isFunctionExpression(x));
      if (fn && fn.parent && ts.isCallExpression(fn.parent) && ["useMemo", "useCallback"].includes(nomeDaChamada(fn.parent) ?? "")) {
        n = fn.parent;
        continue;
      }
      return { chamada: chamadaDesconhecida };
    }
    if (ts.isVariableDeclaration(p) && p.initializer === n && ts.isIdentifier(p.name) && saltos < 2) {
      // segue a variável: onde ela é passada (direto ou por spread)?
      const sym = checker.getSymbolAtLocation(p.name);
      const sf = p.getSourceFile();
      let achada: { rota?: Rota; chamada?: string } = {};
      const visitar = (x: ts.Node): void => {
        if (achada.rota) return;
        if (ts.isIdentifier(x) && x !== p.name && checker.getSymbolAtLocation(x) === sym) {
          const r = rotaDe(x, checker, saltos + 1);
          if (r.rota) achada = r;
          else achada.chamada ??= r.chamada;
        }
        ts.forEachChild(x, visitar);
      };
      visitar(sf);
      return achada.rota ? achada : { chamada: achada.chamada ?? chamadaDesconhecida };
    }
    if (atravessavel(p)) {
      n = p;
      continue;
    }
    return { chamada: chamadaDesconhecida };
  }
  return { chamada: chamadaDesconhecida };
}

// ─── extração ────────────────────────────────────────────────────────────────

const CHAVES_DE_ARVORE = new Set(["include", "select", "where", "orderBy"]);

/**
 * O `include:` está DENTRO de outra árvore de include (`truck: { include: … }`)?
 * Então ele é parte da forma de cima, não uma consulta. Vale também para a
 * árvore guardada numa variável (`const X_INCLUDE = { customer: { include } }`,
 * `const include = useMemo(() => ({ … }))`): a variável é um include se o nome
 * diz (`*include*`) ou se, no mesmo arquivo, ela é o valor de um `include:`.
 */
function aninhado(node: ts.Node, checker: ts.TypeChecker): boolean {
  let n: ts.Node = node;
  while (n.parent) {
    const p = n.parent;
    if (ts.isPropertyAssignment(p) && ts.isIdentifier(p.name) && CHAVES_DE_ARVORE.has(p.name.text)) return true;
    if (ts.isCallExpression(p) && !["useMemo", "React.useMemo"].includes(p.expression.getText())) return false;
    if (ts.isVariableDeclaration(p) && ts.isIdentifier(p.name)) {
      if (/include/i.test(p.name.text)) return true;
      const sym = checker.getSymbolAtLocation(p.name);
      let usadoComoInclude = false;
      const olhar = (x: ts.Node): void => {
        if (usadoComoInclude) return;
        if (ts.isIdentifier(x) && x !== p.name && checker.getSymbolAtLocation(x) === sym) {
          let up: ts.Node = x;
          while (up.parent && (ts.isAsExpression(up.parent) || ts.isParenthesizedExpression(up.parent) || ts.isSatisfiesExpression(up.parent))) up = up.parent;
          const pai = up.parent;
          if (pai && ts.isPropertyAssignment(pai) && pai.initializer === up && ts.isIdentifier(pai.name) && CHAVES_DE_ARVORE.has(pai.name.text)) usadoComoInclude = true;
          if (pai && ts.isShorthandPropertyAssignment(pai) && CHAVES_DE_ARVORE.has(pai.name.text)) usadoComoInclude = true;
        }
        ts.forEachChild(x, olhar);
      };
      olhar(p.getSourceFile());
      return usadoComoInclude;
    }
    if (ts.isFunctionDeclaration(p) || ts.isMethodDeclaration(p)) return false;
    n = p;
  }
  return false;
}

/** Caminho do primeiro `_count` no formato curto (sem `select`), se houver. */
function countSemSelect(v: Json, caminho = "include"): string | null {
  if (!v || typeof v !== "object" || Array.isArray(v)) return null;
  for (const [k, filho] of Object.entries(v)) {
    const aqui = `${caminho}.${k}`;
    if (k === "_count" && filho && typeof filho === "object" && !Array.isArray(filho) && !("select" in filho)) return aqui;
    const achado = countSemSelect(filho, aqui);
    if (achado) return achado;
  }
  return null;
}

type Forma = {
  id: string;
  rota: string;
  modelo: string;
  schema: string;
  origem: string;
  origens?: string[];
  omitidas?: string[];
  consulta: { [k: string]: Json };
};

function main(): void {
  const args = process.argv.slice(2);
  const outIdx = args.indexOf("--out");
  const out = outIdx >= 0 ? resolve(args[outIdx + 1]) : DEFAULT_OUT;
  const check = args.includes("--check");

  const program = carregarPrograma();
  const checker = program.getTypeChecker();
  const { avaliar } = criarAvaliador(checker);

  const porChave = new Map<string, Forma>();
  const semSchema: { origem: string; chamada: string | null; modelo?: string; rota?: string }[] = [];
  const naoEstaticas: { origem: string; motivo: string }[] = [];
  const foraDoTeste: { origem: string; rota: string; schema: string; motivo: string; consulta: { [k: string]: Json } }[] = [];

  const arquivos = program
    .getSourceFiles()
    .filter(sf => sf.fileName.startsWith(join(WEB, "src")) && !FORA.some(d => sf.fileName.includes(d)) && !/\.test\.tsx?$/.test(sf.fileName));

  for (const sf of arquivos) {
    const rel = relative(WEB, sf.fileName);
    const visitar = (node: ts.Node): void => {
      const ehInclude =
        (ts.isPropertyAssignment(node) || ts.isShorthandPropertyAssignment(node)) &&
        ts.isIdentifier(node.name) && node.name.text === "include" && ts.isObjectLiteralExpression(node.parent);
      if (ehInclude && !aninhado(node, checker)) {
        // `{ include }` (atalho): o valor é a variável de mesmo nome, não a propriedade
        let valor: ts.Expression = ts.isPropertyAssignment(node) ? node.initializer : (node as ts.ShorthandPropertyAssignment).name;
        if (ts.isShorthandPropertyAssignment(node)) {
          const decl = checker.getShorthandAssignmentValueSymbol(node)?.valueDeclaration;
          if (decl && ts.isVariableDeclaration(decl) && decl.initializer) valor = decl.initializer;
        }
        const linha = sf.getLineAndCharacterOfPosition(node.getStart()).line + 1;
        const nomeConst = ts.isShorthandPropertyAssignment(node)
          ? node.name.text
          : ts.isIdentifier(valor)
            ? valor.text
            : (ts.isAsExpression(valor) && ts.isIdentifier(valor.expression) ? valor.expression.text : null);
        const origem = `web/${rel}:${linha}${nomeConst ? ` (${nomeConst})` : ""}`;

        let include: Json | undefined;
        try {
          include = avaliar(valor);
        } catch (e) {
          if (e instanceof Dinamico) {
            // `include: options?.include` e afins: repasse, não forma
            if (!/identificador não constante|acesso não constante/.test(e.message) || ts.isObjectLiteralExpression(valor)) {
              naoEstaticas.push({ origem, motivo: e.message });
            }
            return;
          }
          throw e;
        }
        if (!include || typeof include !== "object" || Array.isArray(include) || !Object.keys(include).length) return;

        const { rota, chamada } = rotaDe(node.parent, checker);
        if (!rota || !rota.schema) {
          semSchema.push({ origem, chamada: chamada ?? null, ...(rota ? { modelo: rota.modelo, rota: rota.rota } : {}) });
          return;
        }

        // a consulta: o objeto que contém o include, com as irmãs estáticas
        const consulta: { [k: string]: Json } = {};
        const omitidas: string[] = [];
        for (const p of node.parent.properties) {
          if (p === node) {
            consulta.include = include;
            continue;
          }
          let chave: string;
          try {
            chave = p.name ? nomeDaChave(p.name as ts.PropertyName) : "";
          } catch {
            continue;
          }
          if (ts.isSpreadAssignment(p)) {
            omitidas.push(`...${p.expression.getText().slice(0, 40)}`);
            continue;
          }
          if (OPCOES_DO_HOOK.has(chave) || rota.unica) continue;
          try {
            const v = ts.isPropertyAssignment(p) ? avaliar(p.initializer) : ts.isShorthandPropertyAssignment(p) ? avaliar(p.name) : undefined;
            if (v !== undefined) consulta[chave] = v;
          } catch (e) {
            if (!(e instanceof Dinamico)) throw e;
            omitidas.push(chave);
          }
        }

        // `_count: { tasks: true }` sem `select`: o repositório da API o traduz
        // para `{ select: … }` (mapIncludeWithNestedHandling) ANTES do Prisma; o
        // teste de contrato vai direto ao Prisma e o recusaria sem motivo real.
        const contagem = countSemSelect(include);
        if (contagem) {
          foraDoTeste.push({
            origem,
            rota: rota.rota,
            schema: rota.schema,
            motivo: `${contagem}: o repositório da API traduz \`_count: {rel: true}\` para \`{ select }\`; o teste vai direto ao Prisma`,
            consulta,
          });
          return;
        }

        const chaveUnica = `${rota.schema}|${JSON.stringify(consulta)}`;
        const existente = porChave.get(chaveUnica);
        if (existente) {
          (existente.origens ??= [existente.origem]).push(origem);
          return;
        }
        porChave.set(chaveUnica, {
          id: "",
          rota: rota.rota,
          modelo: rota.modelo,
          schema: rota.schema,
          origem,
          ...(omitidas.length ? { omitidas } : {}),
          consulta,
        });
      }
      ts.forEachChild(node, visitar);
    };
    visitar(sf);
  }

  // ids estáveis: web.<modelo>.<arquivo>.<const ou linha>
  const usados = new Map<string, number>();
  const formas = [...porChave.values()]
    .sort((a, b) => a.origem.localeCompare(b.origem, "en"))
    .map(f => {
      const m = /^web\/src\/(.+?)\.(tsx?):\d+(?: \((\w+)\))?$/.exec(f.origem);
      const base = m
        ? `web.${f.modelo.toLowerCase()}.${m[1].replace(/\[|\]/g, "").split("/").slice(-2).join("/")}${m[3] ? `.${m[3]}` : ""}`
        : `web.${f.modelo.toLowerCase()}`;
      const n = (usados.get(base) ?? 0) + 1;
      usados.set(base, n);
      return { ...f, id: n === 1 ? base : `${base}#${n}` };
    });

  let fonte = "web";
  try {
    const branch = execSync("git rev-parse --abbrev-ref HEAD", { cwd: WEB, encoding: "utf8" }).trim();
    const hash = execSync("git rev-parse --short HEAD", { cwd: WEB, encoding: "utf8" }).trim();
    fonte = `web@${branch} (${hash})`;
  } catch {
    /* sem git: fica "web" */
  }

  const doc = {
    cliente: "web",
    descricao:
      "GERADO por web/scripts/extract-query-contracts.ts (P03) — não editar à mão; rode o extrator. " +
      "`formas`: toda consulta estática do web para um schema registrado no teste de contrato. " +
      "`semSchema`: consultas cuja rota o teste ainda não registra (fora do teste). " +
      "`naoEstaticas`: includes montados em tempo de execução (o extrator não os vê; o censo do G3 vê). " +
      "`foraDoTeste`: formas reais que o teste não sabe julgar ainda (motivo em cada uma).",
    fonte,
    formas,
    semSchema: semSchema.sort((a, b) => a.origem.localeCompare(b.origem, "en")),
    naoEstaticas: naoEstaticas.sort((a, b) => a.origem.localeCompare(b.origem, "en")),
    foraDoTeste: foraDoTeste.sort((a, b) => a.origem.localeCompare(b.origem, "en")),
  };
  // `fonte` muda a cada commit: o --check compara sem ela
  const semFonte = (d: typeof doc) => JSON.stringify({ ...d, fonte: undefined });
  const texto = JSON.stringify(doc, null, 2) + "\n";

  if (check) {
    const atual = existsSync(out) ? (JSON.parse(readFileSync(out, "utf8")) as typeof doc) : null;
    if (!atual || semFonte(atual) !== semFonte(doc)) {
      console.error(`${relative(process.cwd(), out)} está desatualizado: rode node scripts/extract-query-contracts.ts`);
      process.exit(1);
    }
    console.log(`${relative(process.cwd(), out)} em dia (${formas.length} formas).`);
    return;
  }
  writeFileSync(out, texto);
  console.log(
    `${formas.length} formas → ${relative(process.cwd(), out)} ` +
      `(${semSchema.length} sem schema registrado, ${naoEstaticas.length} não estáticas)`,
  );
}

main();
