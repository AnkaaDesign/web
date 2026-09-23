#!/usr/bin/env bash
# G14 (web) — PORTÃO ÚNICO ANTES DO DEPLOY DO WEB.
#
# Não há CI neste repositório: quem faz o deploy roda isto e COLA O RESUMO FINAL
# na mensagem do deploy. Qualquer passo vermelho = não sobe. E o deploy do web
# sobe com `pnpm run build:with-tsc` (tsc -b antes do vite), nunca com o
# `build` puro: o vite emite com erro de tipo.
#
# Roda, em primeiro plano e um de cada vez (a máquina divide CPU com os runners):
#   G0   tipo real (tsc -b)
#   G6   catraca do resíduo (truck) e do identificador colado a texto de tela
#   G4   as formas de consulta extraídas (../api/contracts/queries/web.json) em dia
#   G5   a cópia do contrato gerado pela api (src/generated/contracts) em dia
#   a suíte do vitest
#
# Uso:
#   scripts/pre-deploy.sh            tudo
#   scripts/pre-deploy.sh --rapido   sem a suíte do vitest (atalho local; NÃO vale para deploy)
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

RAPIDO=0
for arg in "$@"; do
  case "$arg" in
    --rapido) RAPIDO=1 ;;
    *) echo "argumento desconhecido: $arg" >&2; exit 2 ;;
  esac
done

# "rótulo|pesado(0/1)|comando"
PASSOS=(
  "G0 tipo (tsc -b)|0|pnpm exec tsc -b"
  "G6 resíduo truck + texto de tela (catraca)|0|bash scripts/guard-residual.sh"
  "G4 formas de consulta extraídas em dia|0|node scripts/extract-query-contracts.ts --check"
  "G5 cópia do contrato da api em dia|0|if [[ -f ../api/scripts/export-contracts.ts ]]; then cd ../api && npx tsx scripts/export-contracts.ts --check --out ../web/src/generated/contracts; else echo '⚠ sem ../api: cópia do contrato NÃO conferida'; fi"
  "vitest (suíte inteira)|1|pnpm exec vitest run"
)

LOG_DIR="${PRE_DEPLOY_LOG_DIR:-/tmp/ankaa-web-pre-deploy-$(date +%Y%m%d-%H%M%S)}"
mkdir -p "$LOG_DIR"

resumo=()
falhas=0
inicio_total=$(date +%s)

for passo in "${PASSOS[@]}"; do
  IFS='|' read -r rotulo pesado comando <<<"$passo"
  if [[ "$RAPIDO" == "1" && "$pesado" == "1" ]]; then
    resumo+=("  -    $rotulo (pulado: --rapido)")
    continue
  fi
  log="$LOG_DIR/$(echo "$rotulo" | tr -c 'A-Za-z0-9' '_' | cut -c1-60).log"
  printf '▶ %s … ' "$rotulo"
  ini=$(date +%s)
  if bash -c "$comando" >"$log" 2>&1; then
    dt=$(($(date +%s) - ini))
    echo "ok (${dt}s)"
    resumo+=("  ok   $rotulo (${dt}s)")
  else
    dt=$(($(date +%s) - ini))
    echo "FALHOU (${dt}s) — $log"
    tail -n 25 "$log" | sed 's/^/      /'
    resumo+=("  FAIL $rotulo (${dt}s) — $log")
    falhas=$((falhas + 1))
  fi
done

total=$(($(date +%s) - inicio_total))
echo
echo "════════ pre-deploy do web — $(git rev-parse --short HEAD) ($(git rev-parse --abbrev-ref HEAD)) — $(date '+%F %T') ════════"
printf '%s\n' "${resumo[@]}"
if [[ "$RAPIDO" == "1" ]]; then
  echo "  ⚠ --rapido: este resumo NÃO vale para deploy."
fi
if [[ "$falhas" -gt 0 ]]; then
  echo "  ✗ $falhas passo(s) vermelho(s) em ${total}s — NÃO SOBE. Logs: $LOG_DIR"
  exit 1
fi
echo "  ✓ tudo verde em ${total}s. Logs: $LOG_DIR"
echo "  Deploy: pnpm run build:with-tsc (nunca o build puro)."
