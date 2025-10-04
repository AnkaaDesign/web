#!/bin/bash

# Ankaa Web Build Testing Script
# This script tests different build configurations to identify issues

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Create test results directory
RESULTS_DIR="./test-build-results"
mkdir -p "$RESULTS_DIR"

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Ankaa Web Build Configuration Tests${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Function to log results
log_result() {
    local test_name=$1
    local status=$2
    local details=$3
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')

    echo "[$timestamp] $test_name: $status" >> "$RESULTS_DIR/test-log.txt"
    if [ -n "$details" ]; then
        echo "  Details: $details" >> "$RESULTS_DIR/test-log.txt"
    fi
    echo "" >> "$RESULTS_DIR/test-log.txt"
}

# Function to clean build artifacts
clean_build() {
    echo -e "${YELLOW}Cleaning build artifacts...${NC}"
    rm -rf dist
    rm -rf node_modules/.vite
    rm -rf .vite
    echo -e "${GREEN}✓ Build artifacts cleaned${NC}"
    echo ""
}

# Function to build with specific env
build_with_env() {
    local env_file=$1
    local test_name=$2
    local extra_flags=$3

    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BLUE}Test: $test_name${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

    # Clean before build
    clean_build

    # Copy env file
    if [ -f "$env_file" ]; then
        cp "$env_file" .env
        echo -e "${YELLOW}Using environment: $env_file${NC}"
        cat .env
        echo ""
    else
        echo -e "${RED}✗ Environment file not found: $env_file${NC}"
        log_result "$test_name" "FAILED" "Environment file not found"
        return 1
    fi

    # Build
    echo -e "${YELLOW}Building...${NC}"
    local build_start=$(date +%s)

    if npm run build $extra_flags > "$RESULTS_DIR/${test_name}-build.log" 2>&1; then
        local build_end=$(date +%s)
        local build_time=$((build_end - build_start))

        echo -e "${GREEN}✓ Build successful (${build_time}s)${NC}"

        # Check dist size
        local dist_size=$(du -sh dist | cut -f1)
        echo -e "${YELLOW}Dist size: $dist_size${NC}"

        # List generated files
        echo -e "${YELLOW}Generated files:${NC}"
        ls -lh dist/assets/ | head -20

        # Check index.html for API URL
        echo -e "${YELLOW}Checking index.html for API URL...${NC}"
        if grep -q "window.__ANKAA_API_URL__" dist/index.html; then
            local api_url=$(grep "window.__ANKAA_API_URL__" dist/index.html)
            echo -e "${GREEN}✓ API URL found: $api_url${NC}"
        else
            echo -e "${RED}✗ API URL not found in index.html${NC}"
        fi

        # Save dist to results
        cp -r dist "$RESULTS_DIR/${test_name}-dist"

        log_result "$test_name" "SUCCESS" "Build time: ${build_time}s, Size: $dist_size"
        echo -e "${GREEN}✓ Test completed successfully${NC}"
        echo ""
        return 0
    else
        echo -e "${RED}✗ Build failed${NC}"
        echo -e "${RED}Build log:${NC}"
        tail -50 "$RESULTS_DIR/${test_name}-build.log"
        log_result "$test_name" "FAILED" "See ${test_name}-build.log for details"
        echo ""
        return 1
    fi
}

# Function to test with preview server
test_preview() {
    local test_name=$1
    local dist_dir=$2

    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BLUE}Preview Test: $test_name${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

    # Copy dist
    rm -rf dist
    cp -r "$dist_dir" dist

    echo -e "${YELLOW}Starting preview server...${NC}"
    echo -e "${YELLOW}Press Ctrl+C to stop and continue to next test${NC}"
    echo ""
    echo -e "${GREEN}Test the application at: http://localhost:4173${NC}"
    echo -e "${GREEN}Check browser console for errors${NC}"
    echo ""

    npm run preview || true

    echo ""
    read -p "Did you observe any errors? (y/n): " has_error
    read -p "Enter error details (or press Enter to skip): " error_details

    if [ "$has_error" = "y" ]; then
        log_result "$test_name Preview" "FAILED" "$error_details"
    else
        log_result "$test_name Preview" "SUCCESS" "No errors observed"
    fi

    echo ""
}

# Initialize log
echo "Ankaa Web Build Tests - $(date)" > "$RESULTS_DIR/test-log.txt"
echo "Node Version: $(node --version)" >> "$RESULTS_DIR/test-log.txt"
echo "npm Version: $(npm --version)" >> "$RESULTS_DIR/test-log.txt"
echo "========================================" >> "$RESULTS_DIR/test-log.txt"
echo "" >> "$RESULTS_DIR/test-log.txt"

# Test 1: Build with Test API URL
build_with_env ".env.test" "test-api" ""

# Test 2: Build with Production API URL
build_with_env ".env.production" "production-api" ""

# Test 3: Build with Source Maps
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}Test: Source Maps Build${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

clean_build
cp .env.production .env

# Temporarily modify vite.config.ts to enable source maps
cat > vite.config.sourcemap.ts << 'EOF'
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

  const baseAliases: Record<string, string> = {
    "@": path.resolve(__dirname, "./src"),
    "@components": path.resolve(__dirname, "./src/components"),
    "@hooks": path.resolve(__dirname, "./src/hooks"),
    "@pages": path.resolve(__dirname, "./src/pages"),
    "@utils": path.resolve(__dirname, "./src/utils"),
    "@lib": path.resolve(__dirname, "./src/lib"),
    "@layouts": path.resolve(__dirname, "./src/layouts"),
    "react-native": "react-native-web",
  };

  if (isDevelopment) {
    Object.assign(baseAliases, {
      "@ankaa/types": path.resolve(__dirname, "../../packages/types/src"),
      "@ankaa/api-client": path.resolve(__dirname, "../../packages/api-client/src"),
      "@ankaa/constants": path.resolve(__dirname, "../../packages/constants/src"),
      "@ankaa/hooks": path.resolve(__dirname, "../../packages/hooks/src"),
      "@ankaa/schemas": path.resolve(__dirname, "../../packages/schemas/src"),
      "@ankaa/utils": path.resolve(__dirname, "../../packages/utils/src"),
      "@ankaa/services": path.resolve(__dirname, "../../packages/services/src"),
    });
  } else {
    Object.assign(baseAliases, {
      "@ankaa/types": path.resolve(__dirname, "../../packages/types/dist/src"),
      "@ankaa/api-client": path.resolve(__dirname, "../../packages/api-client/dist/src"),
      "@ankaa/constants": path.resolve(__dirname, "../../packages/constants/dist"),
      "@ankaa/hooks": path.resolve(__dirname, "../../packages/hooks/dist/src"),
      "@ankaa/schemas": path.resolve(__dirname, "../../packages/schemas/dist/src"),
      "@ankaa/utils": path.resolve(__dirname, "../../packages/utils/dist/src"),
      "@ankaa/services": path.resolve(__dirname, "../../packages/services/dist"),
    });
  }

  return {
    plugins: [react(), htmlEnvReplace()],
    resolve: {
      alias: baseAliases,
      dedupe: ["axios", "@ankaa/api-client"],
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
        "lodash/debounce",
        "@radix-ui/react-popover",
        "react-hook-form",
        "@hookform/resolvers/zod",
        "zod",
        "@ankaa/hooks",
        "axios",
        "@ankaa/api-client",
      ],
      esbuildOptions: {
        define: {
          global: "globalThis",
        },
      },
    },
    build: {
      commonjsOptions: {
        transformMixedEsModules: true,
        include: [/packages\/.*\/dist/, /node_modules/],
      },
      rollupOptions: {
        output: {
          manualChunks: {
            "react-vendor": ["react", "react-dom"],
            "query-vendor": ["@tanstack/react-query"],
            "form-vendor": ["react-hook-form", "@hookform/resolvers/zod"],
            "ui-vendor": ["@radix-ui/react-popover"],
            "utils-vendor": ["lodash", "zod"],
          },
        },
      },
      chunkSizeWarningLimit: 1000,
      sourcemap: true, // ALWAYS ENABLED FOR THIS TEST
    },
    server: {
      port: 5174,
      host: true,
      hmr: {
        overlay: true,
      },
      watch: {
        usePolling: false,
        ignored: ["**/node_modules/**", "**/.git/**", "**/dist/**", "**/build/**"],
      },
    },
  };
});
EOF

echo -e "${YELLOW}Building with source maps enabled...${NC}"
if npx vite build --config vite.config.sourcemap.ts > "$RESULTS_DIR/sourcemap-build.log" 2>&1; then
    echo -e "${GREEN}✓ Source map build successful${NC}"

    # Check for source maps
    echo -e "${YELLOW}Source map files:${NC}"
    find dist -name "*.map" -ls

    cp -r dist "$RESULTS_DIR/sourcemap-dist"
    log_result "Source Maps Build" "SUCCESS" "Source maps generated"
else
    echo -e "${RED}✗ Source map build failed${NC}"
    tail -50 "$RESULTS_DIR/sourcemap-build.log"
    log_result "Source Maps Build" "FAILED" "See sourcemap-build.log"
fi

rm vite.config.sourcemap.ts
echo ""

# Test 4: Complete Cache Clear and Rebuild
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}Test: Clean Rebuild (Full Cache Clear)${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

echo -e "${YELLOW}Clearing all caches and dependencies...${NC}"
rm -rf dist
rm -rf node_modules/.vite
rm -rf .vite
rm -rf node_modules/.cache
npm cache clean --force 2>/dev/null || true

# Clear workspace package dist
echo -e "${YELLOW}Clearing workspace package caches...${NC}"
rm -rf ../../packages/*/dist
rm -rf ../../packages/*/.turbo

echo -e "${YELLOW}Rebuilding workspace packages...${NC}"
cd ../.. && npm run build:packages > /dev/null 2>&1 || true
cd apps/web

echo -e "${GREEN}✓ Caches cleared${NC}"

cp .env.production .env
build_with_env ".env.production" "clean-rebuild" ""

# Summary
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Test Summary${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

cat "$RESULTS_DIR/test-log.txt"

echo ""
echo -e "${GREEN}All build tests completed!${NC}"
echo -e "${YELLOW}Results saved to: $RESULTS_DIR${NC}"
echo ""

# Ask if user wants to test with preview server
read -p "Would you like to test builds with preview server? (y/n): " test_preview_choice

if [ "$test_preview_choice" = "y" ]; then
    echo ""
    echo -e "${BLUE}Starting preview server tests...${NC}"
    echo ""

    # Test each successful build
    for dist_dir in "$RESULTS_DIR"/*-dist; do
        if [ -d "$dist_dir" ]; then
            test_name=$(basename "$dist_dir" | sed 's/-dist$//')
            test_preview "$test_name" "$dist_dir"
        fi
    done
fi

echo ""
echo -e "${GREEN}All tests completed!${NC}"
echo -e "${YELLOW}Full report: $RESULTS_DIR/test-log.txt${NC}"
echo ""
echo -e "${BLUE}Next steps:${NC}"
echo -e "1. Review test results in $RESULTS_DIR"
echo -e "2. Check browser console errors from preview tests"
echo -e "3. Compare working vs failing builds"
echo -e "4. Analyze source maps if errors occurred"
