import { defineConfig, Plugin } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function htmlEnvReplace(): Plugin {
  return {
    name: "html-env-replace",
    transformIndexHtml(html) {
      const apiUrl = process.env.VITE_API_URL || "http://localhost:3030";
      console.log(`[htmlEnvReplace] Using API URL: ${apiUrl}`);
      return html.replace(/%VITE_API_URL%/g, apiUrl);
    },
  };
}

export default defineConfig(({ mode }) => {
  const isDevelopment = mode === "development";

  return {
    plugins: [react(), htmlEnvReplace()],
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
      commonjsOptions: {
        transformMixedEsModules: true,
        strictRequires: false,
        include: [/node_modules/],
      },
      rollupOptions: {
        external: [],
        output: {
          manualChunks: {
            // React must be in its own chunk and load first
            "vendor-react": ["react", "react-dom", "react/jsx-runtime"],
            // React-related libraries in second chunk
            "vendor-react-libs": [
              "@tanstack/react-query",
              "react-router-dom",
              "react-hook-form",
              "@hookform/resolvers",
            ],
            // UI libraries
            "vendor-ui": [
              "@radix-ui/react-accordion",
              "@radix-ui/react-alert-dialog",
              "@radix-ui/react-checkbox",
              "@radix-ui/react-dialog",
              "@radix-ui/react-dropdown-menu",
              "@radix-ui/react-label",
              "@radix-ui/react-popover",
              "@radix-ui/react-select",
              "@radix-ui/react-separator",
              "@radix-ui/react-slot",
              "@radix-ui/react-switch",
              "@radix-ui/react-tabs",
              "@radix-ui/react-toast",
              "@radix-ui/react-tooltip",
              "lucide-react",
              "clsx",
              "tailwind-merge",
              "tailwindcss-animate",
              "class-variance-authority",
            ],
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