#!/bin/bash

# QueryClient Verification Script
# Checks for common issues that cause "No QueryClient set" errors
# Usage: ./verify-queryclient.sh

set -e

echo "🔍 QueryClient Health Check"
echo "=============================="
echo ""

# Color codes
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

ERRORS=0
WARNINGS=0

# Change to web app directory
cd "$(dirname "$0")"
echo "📁 Working directory: $(pwd)"
echo ""

# Check 1: Module-level React Query usage (only check top-level, not inside functions)
echo "1️⃣  Checking for unsafe React Query usage in hooks..."
# This check is intentionally simple - looking for React Query calls at the TOP of files
# We check query-error-monitor specifically since that's where the issue was
if grep -q "^const.*useQuery\|^export const.*useQuery.*(" ../../packages/hooks/src/query-error-monitor.ts 2>/dev/null; then
  echo -e "   ${RED}❌ Found module-level React Query usage in query-error-monitor.ts${NC}"
  ERRORS=$((ERRORS + 1))
else
  echo -e "   ${GREEN}✅ No unsafe module-level usage found${NC}"
fi
echo ""

# Check 2: Verify useQueryErrorStats is commented
echo "2️⃣  Checking query-error-monitor.ts..."
if grep -q "^// function useQueryErrorStats" ../../packages/hooks/src/query-error-monitor.ts; then
  echo -e "   ${GREEN}✅ useQueryErrorStats is properly commented out${NC}"
elif grep -q "^function useQueryErrorStats" ../../packages/hooks/src/query-error-monitor.ts; then
  echo -e "   ${RED}❌ useQueryErrorStats is NOT commented out${NC}"
  echo "   This will cause QueryClient initialization errors!"
  ERRORS=$((ERRORS + 1))
else
  echo -e "   ${GREEN}✅ useQueryErrorStats not found (removed)${NC}"
fi
echo ""

# Check 3: Verify main.tsx initialization
echo "3️⃣  Checking main.tsx QueryClient initialization..."
if grep -q "const queryClient = (() => {" src/main.tsx; then
  echo -e "   ${GREEN}✅ QueryClient uses IIFE initialization${NC}"
else
  echo -e "   ${RED}❌ QueryClient not using IIFE${NC}"
  ERRORS=$((ERRORS + 1))
fi

if grep -q "__REACT_QUERY_CLIENT__" src/main.tsx; then
  echo -e "   ${GREEN}✅ QueryClient stored globally${NC}"
else
  echo -e "   ${YELLOW}⚠️  QueryClient not stored globally${NC}"
  WARNINGS=$((WARNINGS + 1))
fi
echo ""

# Check 4: Verify index.html has API URL script
echo "4️⃣  Checking index.html for API URL script..."
if grep -q "__ANKAA_API_URL__" index.html; then
  echo -e "   ${GREEN}✅ API URL script tag found${NC}"
else
  echo -e "   ${YELLOW}⚠️  API URL script tag not found${NC}"
  WARNINGS=$((WARNINGS + 1))
fi
echo ""

# Check 5: Verify vite.config.ts has correct dedupe
echo "5️⃣  Checking vite.config.ts for React Query dedupe..."
if grep -q "@tanstack/react-query" vite.config.ts; then
  echo -e "   ${GREEN}✅ React Query in dedupe list${NC}"
else
  echo -e "   ${YELLOW}⚠️  React Query not deduped${NC}"
  WARNINGS=$((WARNINGS + 1))
fi
echo ""

# Check 6: Verify lazy-with-query-client exists
echo "6️⃣  Checking for safe lazy loading utility..."
if [ -f "src/utils/lazy-with-query-client.tsx" ]; then
  echo -e "   ${GREEN}✅ lazy-with-query-client.tsx exists${NC}"
else
  echo -e "   ${YELLOW}⚠️  lazy-with-query-client.tsx not found${NC}"
  WARNINGS=$((WARNINGS + 1))
fi
echo ""

# Check 7: Build test
echo "7️⃣  Testing production build..."
if npm run build > /tmp/queryclient-build.log 2>&1; then
  echo -e "   ${GREEN}✅ Build successful${NC}"
  BUILD_SIZE=$(du -sh dist | cut -f1)
  echo "   📦 Build size: $BUILD_SIZE"
else
  echo -e "   ${RED}❌ Build failed${NC}"
  echo "   Check /tmp/queryclient-build.log for details"
  tail -20 /tmp/queryclient-build.log
  ERRORS=$((ERRORS + 1))
fi
echo ""

# Check 8: Verify dist output
echo "8️⃣  Checking build artifacts..."
if [ -d "dist" ]; then
  if [ -f "dist/index.html" ]; then
    echo -e "   ${GREEN}✅ index.html built${NC}"

    # Check if API URL was replaced
    if grep -q "%VITE_API_URL%" dist/index.html; then
      echo -e "   ${YELLOW}⚠️  API URL placeholder not replaced${NC}"
      echo "   This is OK for local builds, but should be replaced in production"
      WARNINGS=$((WARNINGS + 1))
    else
      echo -e "   ${GREEN}✅ API URL replaced in HTML${NC}"
    fi
  else
    echo -e "   ${RED}❌ index.html not found in dist${NC}"
    ERRORS=$((ERRORS + 1))
  fi

  # Check for main bundle
  MAIN_BUNDLE=$(find dist/assets -name "index-*.js" | head -1)
  if [ -n "$MAIN_BUNDLE" ]; then
    BUNDLE_SIZE=$(du -h "$MAIN_BUNDLE" | cut -f1)
    echo -e "   ${GREEN}✅ Main bundle built${NC} ($BUNDLE_SIZE)"
  else
    echo -e "   ${RED}❌ Main bundle not found${NC}"
    ERRORS=$((ERRORS + 1))
  fi
else
  echo -e "   ${YELLOW}⚠️  dist directory not found (build may have failed)${NC}"
fi
echo ""

# Summary
echo "=============================="
echo "📊 Summary"
echo "=============================="
if [ $ERRORS -eq 0 ] && [ $WARNINGS -eq 0 ]; then
  echo -e "${GREEN}✅ All checks passed!${NC}"
  echo ""
  echo "🚀 Ready to deploy!"
  echo ""
  echo "Next steps:"
  echo "  1. npm run preview  # Test locally"
  echo "  2. git push         # Deploy to production"
  exit 0
elif [ $ERRORS -eq 0 ]; then
  echo -e "${YELLOW}⚠️  ${WARNINGS} warning(s) found${NC}"
  echo ""
  echo "Build should work, but review warnings above."
  exit 0
else
  echo -e "${RED}❌ ${ERRORS} error(s) found${NC}"
  if [ $WARNINGS -gt 0 ]; then
    echo -e "${YELLOW}⚠️  ${WARNINGS} warning(s) found${NC}"
  fi
  echo ""
  echo "Fix errors before deploying!"
  echo ""
  echo "📖 See QUERYCLIENT_QUICK_FIX.md for solutions"
  exit 1
fi
