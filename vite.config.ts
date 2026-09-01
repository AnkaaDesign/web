// Global UI scale is applied via postcss-pxtorem (postcss.config.js) + an 80%
// root font-size (index.css) — see those files for rationale.
import { defineConfig, type Plugin, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { execSync } from "child_process";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function getGitHash(): string {
  try {
    return execSync("git rev-parse --short HEAD", { encoding: "utf8" }).trim();
  } catch {
    return "dev";
  }
}

function buildVersionPlugin(hash: string): Plugin {
  return {
    name: "build-version",
    generateBundle() {
      this.emitFile({
        type: "asset",
        fileName: "version.json",
        source: JSON.stringify({ hash, buildTime: new Date().toISOString() }),
      });
    },
  };
}

function htmlEnvReplace(apiUrl: string): Plugin {
  return {
    name: "html-env-replace",
    transformIndexHtml(html) {
      if (process.env.NODE_ENV !== 'production') {
        console.log(`[htmlEnvReplace] Using API URL: ${apiUrl}`);
      }
      return html.replace(/%VITE_API_URL%/g, apiUrl);
    },
  };
}

export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  // Set the third parameter to '' to load all env regardless of the `VITE_` prefix.
  const env = loadEnv(mode, process.cwd(), '');
  const apiUrl = env.VITE_API_URL || "http://localhost:3030";
  const appHash = getGitHash();

  return {
    plugins: [react(), htmlEnvReplace(apiUrl), buildVersionPlugin(appHash)],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
        "@components": path.resolve(__dirname, "./src/components"),
        "@hooks": path.resolve(__dirname, "./src/hooks"),
        "@pages": path.resolve(__dirname, "./src/pages"),
        "@utils": path.resolve(__dirname, "./src/utils"),
        "@lib": path.resolve(__dirname, "./src/lib"),
        "@layouts": path.resolve(__dirname, "./src/layouts"),
        "@constants": path.resolve(__dirname, "./src/constants"),
        "@types": path.resolve(__dirname, "./src/types"),
        "@schemas": path.resolve(__dirname, "./src/schemas"),
        "@api-client": path.resolve(__dirname, "./src/api-client"),
        "react-native": "react-native-web",
      },
      dedupe: ["react", "react-dom", "@tanstack/react-query", "axios"],
    },
    define: {
      global: "globalThis",
      __APP_HASH__: JSON.stringify(appHash),
    },
    optimizeDeps: {
      exclude: ["react-native"],
      include: [
        "react",
        "react-dom",
        "@tanstack/react-query",
        "react-router-dom",
        "zod",
        "react-hook-form",
        "@hookform/resolvers/zod",
        "axios",
        "pdfjs-dist",
      ],
      esbuildOptions: {
        format: 'esm',
      },
    },
    build: {
      emptyOutDir: false,
      target: "es2022",
      // Enable source maps for production debugging
      sourcemap: mode === "production" ? "hidden" : true,
      // Minification settings
      minify: mode === "production" ? "esbuild" : false,
      // Increase chunk size warning limit to reduce noise for intentionally large chunks
      chunkSizeWarningLimit: 1000,
      // Copy service worker to output directory
      copyPublicDir: true,
      commonjsOptions: {
        transformMixedEsModules: true,
        // Global default stays non-strict (perf) — but @mmote/niimbluelib's compiled
        // CJS has real circular requires (packets/abstraction.js <-> print_tasks <->
        // printer_models.js) that only resolve correctly under Node's lazy require()
        // order. Rollup's default (non-strict) commonjs interop reorders/hoists module
        // evaluation and can execute printer_models.js's top-level `LabelType.Perforated`
        // access before packets/payloads.js has populated the LabelType enum, throwing
        // "Cannot read properties of undefined (reading 'Perforated')" at runtime in the
        // production bundle (this doesn't happen in `pnpm dev`, which pre-bundles deps
        // via esbuild instead of Rollup). Scoping strictRequires to just this package
        // forces call-order-preserving require semantics for it, without touching the
        // non-strict default for the rest of the app's CJS deps.
        strictRequires: [/@mmote\/niimbluelib/],
        include: [/node_modules/],
      },
      rollupOptions: {
        output: {
          // Let Vite handle ALL chunking automatically
          // This ensures correct module loading order for React and its ecosystem
          chunkFileNames: "assets/[name]-[hash].js",
          entryFileNames: "assets/[name]-[hash].js",
          assetFileNames: "assets/[name]-[hash].[ext]",
        },
      },
    },
    server: {
      host: '0.0.0.0', // Listen on all network interfaces
      port: 5173,
      open: true,
      fs: {
        strict: false,
      },
      // A árvore de assets do Truck Studio (~300 MB de geometria, HDRI e mapas
      // PBR) saiu de `public/` e é servida pela API sob `/studio-assets/`.
      // Este proxy existe para que o loop local continue SAME-ORIGIN, que é o
      // padrão de `VITE_STUDIO_ASSETS_BASE` (`/studio-assets/v1`):
      //   - sem preflight de CORS em cada .glb/.hdr/.webp;
      //   - o three.js pede `crossOrigin="anonymous"` por padrão, e livery.ts
      //     ainda lê os PNGs de painel com `getImageData()` — de outra origem
      //     sem cabeçalho de CORS o canvas fica CONTAMINADO e a medição da
      //     janela vazada falha em silêncio;
      //   - o dev reproduz o que o nginx faz em produção (mesmo prefixo,
      //     mesma origem), em vez de um caminho feliz que só existe local.
      // Apontar `VITE_STUDIO_ASSETS_BASE` para uma origem absoluta continua
      // funcionando e simplesmente não passa por aqui.
      // O LOCAL GANHA DO REMOTO, e essa regra existe porque sem ela editar um
      // asset do studio nesta máquina não tem como ser visto nesta máquina.
      //
      // `web/public/environments/` continua sendo onde os cenários são
      // AUTORADOS (`tools/env-build/build_industrial_park.py` escreve o
      // `set.glb` ali), mas o app pede tudo sob `/studio-assets/v1`, que este
      // proxy manda para a API. Resultado: reconstruir o distrito e abrir o
      // localhost mostrava a versão de PRODUÇÃO, sem nenhum erro que dissesse
      // isso — o arquivo novo estava a dois diretórios de distância do que a
      // página baixava.
      //
      // `bypass` devolvendo um caminho faz o Vite servir de `public/`; devolver
      // undefined segue para a API. Então o que existe local é servido local e
      // os ~300 MB que não estão aqui continuam vindo de produção, que é o
      // arranjo que permite trabalhar num cenário sem baixar a árvore inteira.
      proxy: {
        "/studio-assets": {
          target: apiUrl,
          changeOrigin: true,
          // NENHUM ASSET DO STUDIO PODE SER FIXADO EM CACHE NO DEV.
          //
          // A produção manda `Cache-Control: public, max-age=31536000,
          // immutable` — correto lá, porque lá o arquivo só muda junto com o
          // deploy. Em dev é uma armadilha: enquanto este proxy encaminhava
          // tudo, o navegador guardou a resposta de PRODUÇÃO debaixo do URL do
          // localhost, por um ano. `immutable` significa "não revalide nunca",
          // inclusive em F5 — então o dev server passou a ser reconstruído,
          // servido e ignorado, sem nenhum erro em lugar nenhum. Um cenário
          // inteiro foi refeito várias vezes contra um arquivo que o navegador
          // já tinha decidido não perguntar mais.
          //
          // Reescrever o cabeçalho na saída do proxy custa uma cópia de rede por
          // reload e elimina a classe inteira de "reconstruí e não mudou nada".
          configure(proxy) {
            proxy.on("proxyRes", (proxyRes) => {
              proxyRes.headers["cache-control"] = "no-store";
              delete proxyRes.headers["etag"];
              delete proxyRes.headers["expires"];
            });
          },
          bypass(req) {
            const m = (req.url || "").match(/^\/studio-assets\/v\d+(\/[^?]*)/);
            if (!m) return undefined;
            const rel = decodeURIComponent(m[1]);
            if (rel.includes("..")) return undefined;
            return fs.existsSync(path.join(__dirname, "public", rel))
              ? rel
              : undefined;
          },
        },
      },
    },
    // Vitest. Without this block Vitest falls back to `environment: "node"` and never loads
    // `src/test/setup.ts` — which is written for a browser (it mocks matchMedia,
    // IntersectionObserver, URL.createObjectURL and registers the jest-dom matchers). Every
    // component test therefore died inside `userEvent.setup()` on a missing `document`, taking
    // 55 tests with it, while the pure-logic suites passed and hid it.
    test: {
      environment: "jsdom",
      setupFiles: ["./src/test/setup.ts"],
      // Run tests in the timezone the app is actually used in. The CI/dev box is UTC,
      // where a whole class of calendar-date bugs simply does not reproduce: a bare
      // "2026-07-30" formatted in UTC is the 30th, but in São Paulo (UTC-3) it is the
      // 29th. Pinning this is what makes those assertions mean anything.
      env: { TZ: "America/Sao_Paulo" },
      // The suites import `describe`/`it`/`expect` from "vitest" explicitly; globals stay off so
      // that convention keeps being enforced.
      globals: false,
      css: false,
    },
  };
});