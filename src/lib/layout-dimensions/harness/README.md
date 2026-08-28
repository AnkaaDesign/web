# Bancada do cotador

Scripts de medição, não de produção. Rodam em Node sobre uma pasta de PDFs de
layout reais (baixe de `/srv/files/Clientes/*/Layouts/PDFs`).

Antes de rodar, empacote o módulo — os scripts importam um bundle ESM:

```sh
cd web
npx esbuild src/lib/layout-dimensions/index.ts \
  --bundle --format=esm --platform=node --outfile=/tmp/ldim/core.js
node src/lib/layout-dimensions/harness/run.mjs ~/layouts
```

`LIB` (padrão `/tmp/ldim`) e `PDFJS` são variáveis de ambiente.

| script | o que responde |
|---|---|
| `study.mjs <pasta>` | a que geometria o projetista ancora cada cota |
| `run.mjs <pasta>` | recall/precisão do cotador e cobertura das âncoras |
| `snaptest2.mjs <pasta> <mira_cm> <raio_cm>` | acerto do ímã da medição manual |
| `demo.mjs <pdf> <saída> <lado> <altura> <seções> [título]` | gera uma face cotada |
| `bench.mjs <pasta> [--save]` | portão de regressão: mede tudo, compara com `bench.baseline.json` e dá o veredito (ver `BENCH.md`) |

`DUMP=<trecho do nome>` em `run.mjs` imprime o diff cota a cota de um arquivo.
