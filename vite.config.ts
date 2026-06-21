// Global UI scale is applied via postcss-pxtorem (postcss.config.js) + an 80%
// root font-size (index.css) — see those files for rationale.
import { defineConfig, type Plugin, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
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
        strictRequires: false,
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
    },
  };
});