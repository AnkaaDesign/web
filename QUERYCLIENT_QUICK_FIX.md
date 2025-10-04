# QueryClient Error - Quick Fix Guide

## 🚨 Emergency Response (2 minutes)

If you see: `Error: No QueryClient set, use QueryClientProvider to set one`

### Immediate Fix

```bash
# 1. Check the problematic hook
cat packages/hooks/src/query-error-monitor.ts | grep -A 20 "useQueryErrorStats"

# 2. Verify it's commented out (should see //)
# Lines 138-159 should have // at the start

# 3. Rebuild
cd /home/kennedy/ankaa/apps/web
npm run build

# 4. Test locally
npm run preview
# Open http://localhost:4173 and check console
```

### Verify Fix Worked

Open browser console and check:
```javascript
// Should see this log:
"[QueryClient] Initialized and stored globally"

// Should be true:
window.__QUERY_CLIENT_INITIALIZED__ === true

// Should be object:
typeof window.__REACT_QUERY_CLIENT__ === "object"
```

---

## 🔍 Root Cause Quick Check

```bash
# Search for hooks using React Query at module level
cd /home/kennedy/ankaa
rg "const.*useQuery" packages/hooks/src/ | grep -v "export"

# Should return ZERO results outside function bodies
```

---

## ✅ Prevention Checklist

Before adding new hooks to `@ankaa/hooks`:

```typescript
// ❌ BAD - This will cause the error
const data = useQueryClient(); // At module level
export const myCache = data.getQueryCache();

// ✅ GOOD - This is safe
export function useMyHook() {
  const client = useQueryClient(); // Inside hook
  // ... rest of hook
}
```

**Rules:**
1. No `useQueryClient()` calls at module level
2. No state initialization that accesses QueryClient
3. Always use lazy initialization: `useState(() => ...)`
4. Test with `npm run build` before committing

---

## 🛠️ Build Verification Script

```bash
#!/bin/bash
# Save as: check-queryclient.sh

echo "🔍 Checking QueryClient setup..."

# Check for module-level React Query usage
echo ""
echo "1️⃣ Checking for unsafe React Query usage..."
UNSAFE=$(rg "const.*useQuery|const.*useMutation" packages/hooks/src/ --type ts | grep -v "export function" | grep -v "//")
if [ -z "$UNSAFE" ]; then
  echo "   ✅ No unsafe usage found"
else
  echo "   ❌ Found unsafe usage:"
  echo "$UNSAFE"
  exit 1
fi

# Build the app
echo ""
echo "2️⃣ Building production bundle..."
cd apps/web
npm run build > /dev/null 2>&1
if [ $? -eq 0 ]; then
  echo "   ✅ Build successful"
else
  echo "   ❌ Build failed"
  exit 1
fi

# Check bundle for QueryClient
echo ""
echo "3️⃣ Checking bundle for QueryClient..."
if grep -q "__REACT_QUERY_CLIENT__" dist/index.html; then
  echo "   ✅ QueryClient global variable found"
else
  echo "   ⚠️  QueryClient global variable not found (check index.html)"
fi

# Preview test
echo ""
echo "4️⃣ Starting preview server..."
echo "   👉 Open http://localhost:4173 and check console for:"
echo "      '[QueryClient] Initialized and stored globally'"
echo ""
npm run preview

echo ""
echo "✅ All checks passed!"
```

**Usage:**
```bash
chmod +x check-queryclient.sh
./check-queryclient.sh
```

---

## 📊 Current Status

### ✅ Working Configuration

**File:** `apps/web/src/main.tsx` (Lines 8-49)
- QueryClient created in IIFE
- Stored globally immediately
- Created BEFORE any imports

**File:** `packages/hooks/src/query-error-monitor.ts`
- `useQueryErrorStats` hook commented out (Lines 138-159)
- No module-level React Query access

**File:** `apps/web/vite.config.ts`
- React Query bundled with React vendor chunk
- Deduplicated across all modules

### 🎯 Success Metrics

- ✅ Build completes in ~42 seconds
- ✅ No console errors in production
- ✅ Preview server works
- ✅ QueryClient initialized on first render
- ✅ All lazy-loaded routes work

---

## 🔧 Common Issues & Solutions

### Issue 1: Error still appears after fix

**Solution:**
```bash
# Clear build cache
rm -rf apps/web/dist
rm -rf apps/web/node_modules/.vite

# Clear package build
cd packages/hooks
rm -rf dist
npm run build

# Rebuild app
cd ../../apps/web
npm run build
```

### Issue 2: Different error in production

**Check:**
```bash
# Build with source maps
cd apps/web
npx vite build --sourcemap

# Inspect exact error location
# Error stack trace will show original source files
```

### Issue 3: Lazy-loaded component fails

**Solution:**
```typescript
// Use the safe lazy loader
import { lazyWithQueryClient } from '@/utils/lazy-with-query-client';

// Instead of:
// const MyPage = lazy(() => import('./MyPage'));

// Use:
const MyPage = lazyWithQueryClient(() => import('./MyPage'));
```

---

## 📞 Support

If error persists after all fixes:

1. **Check commit history:**
   ```bash
   git log --oneline --grep="QueryClient" -5
   ```

2. **Compare with working version:**
   ```bash
   git diff 4f902a0a apps/web/src/main.tsx
   git diff 4f902a0a packages/hooks/src/query-error-monitor.ts
   ```

3. **Revert to known good state:**
   ```bash
   git checkout 4f902a0a
   npm run build
   ```

4. **Check full documentation:**
   See `QUERYCLIENT_ANALYSIS.md` for detailed explanation

---

**Last Updated:** 2025-10-03
**Working Commit:** 4f902a0a
**Status:** ✅ RESOLVED
