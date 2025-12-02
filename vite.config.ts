import { defineConfig, type Plugin, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function htmlEnvReplace(apiUrl: string): Plugin {
  return {
    name: "html-env-replace",
    transformIndexHtml(html) {
      console.log(`[htmlEnvReplace] Using API URL: ${apiUrl}`);
      return html.replace(/%VITE_API_URL%/g, apiUrl);
    },
  };
}

export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  // Set the third parameter to '' to load all env regardless of the `VITE_` prefix.
  const env = loadEnv(mode, process.cwd(), '');
  const apiUrl = env.VITE_API_URL || "http://localhost:3030";

  return {
    plugins: [react(), htmlEnvReplace(apiUrl)],
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
      ],
      esbuildOptions: {
        format: 'esm',
      },
    },
    build: {
      target: "es2022",
      // Enable source maps for production debugging
      sourcemap: mode === "production" ? "hidden" : true,
      // Minification settings
      minify: mode === "production" ? "esbuild" : false,
      // Increase chunk size warning limit to reduce noise for intentionally large chunks
      chunkSizeWarningLimit: 1000,
      commonjsOptions: {
        transformMixedEsModules: true,
        strictRequires: false,
        include: [/node_modules/],
      },
      rollupOptions: {
        external: [],
        output: {
          manualChunks: (id) => {
            // React core - must load first
            if (id.includes("node_modules/react/") ||
                id.includes("node_modules/react-dom/") ||
                id.includes("node_modules/react/jsx-runtime")) {
              return "vendor-react";
            }

            // React ecosystem libraries
            if (id.includes("@tanstack/react-query") ||
                id.includes("react-router-dom") ||
                id.includes("react-hook-form") ||
                id.includes("@hookform/resolvers")) {
              return "vendor-react-libs";
            }

            // Radix UI components
            if (id.includes("@radix-ui")) {
              return "vendor-radix-ui";
            }

            // Icon libraries
            if (id.includes("lucide-react") || id.includes("@tabler/icons-react")) {
              return "vendor-icons";
            }

            // Utility libraries
            if (id.includes("clsx") ||
                id.includes("tailwind-merge") ||
                id.includes("class-variance-authority")) {
              return "vendor-utils";
            }

            // Chart libraries
            if (id.includes("echarts") ||
                id.includes("recharts") ||
                id.includes("@react-three")) {
              return "vendor-charts";
            }

            // Data processing libraries
            if (id.includes("lodash") ||
                id.includes("papaparse") ||
                id.includes("xlsx") ||
                id.includes("jszip")) {
              return "vendor-data";
            }

            // PDF and file handling
            if (id.includes("jspdf") ||
                id.includes("html2canvas") ||
                id.includes("react-pdf")) {
              return "vendor-pdf";
            }

            // Date utilities
            if (id.includes("date-fns") || id.includes("react-day-picker")) {
              return "vendor-date";
            }

            // DnD kit
            if (id.includes("@dnd-kit")) {
              return "vendor-dnd";
            }

            // All other node_modules
            if (id.includes("node_modules")) {
              return "vendor-other";
            }
          },
          // Ensure correct import order
          format: "es",
          chunkFileNames: "assets/[name]-[hash].js",
          entryFileNames: "assets/[name]-[hash].js",
          assetFileNames: "assets/[name]-[hash].[ext]",
        },
      },
    },
    server: {
      port: 5173,
      open: true,
      fs: {
        strict: false,
      },
    },
  };
});