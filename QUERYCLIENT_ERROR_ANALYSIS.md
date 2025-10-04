# QueryClient "No QueryClient set" Error - Root Cause Analysis

## Executive Summary

The "No QueryClient set" error occurs in **production builds only** due to a race condition between module initialization and QueryClient creation. The issue stems from how Vite bundles and loads JavaScript chunks in production, where React Query hooks can be executed before the global QueryClient is properly initialized.

## Root Cause

### 1. **Module Loading Race Condition**
- **Development**: All code loads synchronously from source files - no issue
- **Production**: Code is split into chunks and loaded asynchronously
- **Problem**: React Query hooks in lazy-loaded components can execute before `main.tsx` sets up the global QueryClient

### 2. **Current Implementation Flow**
```
Production Build Loading Sequence:
1. index.html loads → react-vendor.js + query-vendor.js
2. main.js executes → creates QueryClient
3. Lazy routes load → may use hooks BEFORE step 2 completes
```

### 3. **Evidence**
- Build succeeds (no compilation errors)
- Error message found in `dist/assets/index-*.js`: "No QueryClient set"
- Error only occurs in production builds
- TESTING_COMPLETE.md shows testing was done but issue persists

## Problematic Patterns Identified

### Pattern 1: Vite Chunk Splitting
**File**: `/home/kennedy/ankaa/apps/web/vite.config.ts`
```typescript
manualChunks: (id) => {
  if (id.includes("@tanstack/react-query")) {
    return "react-vendor";  // ❌ Separate chunk, async load
  }
}
```
**Issue**: React Query is in a separate chunk that may not load before components need it.

### Pattern 2: Global QueryClient Storage
**File**: `/home/kennedy/ankaa/apps/web/src/main.tsx` (lines 8-49)
```typescript
const queryClient = (() => {
  const client = new QueryClient({...});
  if (typeof window !== "undefined") {
    (window as any).__REACT_QUERY_CLIENT__ = client;  // ❌ Timing-dependent
  }
  return client;
})();
```
**Issue**: Relies on synchronous execution which isn't guaranteed in production.

### Pattern 3: Lazy Component Wrapper
**File**: `/home/kennedy/ankaa/apps/web/src/utils/lazy-with-query-client.tsx`
```typescript
function QueryClientWrapper({ children }: { children: React.ReactNode }) {
  let queryClient: QueryClient | null = null;
  try {
    queryClient = useQueryClient();  // ❌ Can fail if provider not mounted
  } catch {
    queryClient = getGlobalQueryClient();  // ❌ May be null if main.tsx not executed
  }
}
```
**Issue**: Fallback logic doesn't guarantee a QueryClient exists.

### Pattern 4: App Structure
**File**: `/home/kennedy/ankaa/apps/web/src/App.tsx`
- 200+ lazy-loaded route components
- Each wrapped in `<Suspense>` but not all in QueryClientProvider scope
- Some components may render before provider is ready

## Why It Works in Development

1. **No code splitting**: All modules load from source synchronously
2. **No chunk optimization**: Vite dev server serves files on-demand
3. **HMR**: Hot Module Replacement ensures proper initialization order
4. **Different module resolution**: Direct imports vs bundled chunks

## Failed Solutions (from TESTING_COMPLETE.md)

1. ✅ IIFE for QueryClient creation - **Good**, but not sufficient
2. ✅ Global window storage - **Helpful**, but timing still an issue
3. ⚠️ Removed `useQueryErrorStats` hook - **Removed symptoms**, not cause
4. ⚠️ LazyWithQueryClient wrapper - **Added complexity**, didn't fix race condition

## Recommended Solutions

### Solution 1: Inline React Query (Recommended)
**Prevents chunk splitting for critical dependencies**

```typescript
// vite.config.ts
manualChunks: (id) => {
  // DO NOT split React Query - keep it with main bundle
  if (id.includes("@tanstack/react-query")) {
    return undefined; // Let Vite include it in main bundle
  }
  // ... other chunks
}
```

**Pros**: Simple, guaranteed load order
**Cons**: Slightly larger initial bundle (~30KB gzipped)

### Solution 2: Preload Critical Chunks
**Force React Query to load before app mounts**

```html
<!-- index.html -->
<link rel="modulepreload" href="/assets/react-vendor-*.js">
<link rel="modulepreload" href="/assets/query-vendor-*.js">
```

**Pros**: Maintains code splitting benefits
**Cons**: Requires build hash injection, complex setup

### Solution 3: Synchronous Provider Setup
**Initialize QueryClient in a way that blocks rendering**

```typescript
// main.tsx
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// Create client BEFORE any dynamic imports
const queryClient = new QueryClient({...});

// Store globally IMMEDIATELY
(window as any).__REACT_QUERY_CLIENT__ = queryClient;

// Import App AFTER QueryClient is ready
import("./App").then(({ default: App }) => {
  createRoot(document.getElementById("root")!).render(
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  );
});
```

**Pros**: Guaranteed initialization order
**Cons**: Delays initial render, more complex bootstrap

### Solution 4: Remove Lazy Loading for Provider Contexts
**Eagerly load all context providers**

```typescript
// App.tsx
// ❌ Don't lazy load these:
import { ThemeProvider } from "@/contexts/theme-context";
import { AuthProvider } from "@/contexts/auth-context";
import { FavoritesProvider } from "@/contexts/favorites-context";

// ✅ Keep lazy loading for routes:
const HomePage = lazy(() => import("@/pages/home"));
```

**Pros**: Contexts always available
**Cons**: Current implementation doesn't lazy-load contexts (already correct)

## Recommended Action Plan

### Phase 1: Immediate Fix (Recommended)
1. **Inline React Query with main bundle**
   ```bash
   # Edit vite.config.ts - remove React Query from manualChunks
   # This ensures it loads synchronously with the main app
   ```

2. **Verify fix**
   ```bash
   npm run build
   npm run preview
   # Test all lazy-loaded routes
   ```

### Phase 2: Validation
1. Check network waterfall in production build
2. Verify no "No QueryClient set" errors in console
3. Test lazy route navigation
4. Verify Suspense boundaries work correctly

### Phase 3: Optimization (Optional)
1. If bundle size is a concern, implement Solution 2 (preload)
2. Add performance monitoring for chunk loading
3. Consider splitting other large dependencies (lodash, zod, etc.)

## Files to Modify

1. **Primary**:
   - `/home/kennedy/ankaa/apps/web/vite.config.ts` - Update manualChunks

2. **Secondary** (if needed):
   - `/home/kennedy/ankaa/apps/web/index.html` - Add modulepreload links
   - `/home/kennedy/ankaa/apps/web/src/main.tsx` - Already correct

3. **Cleanup** (optional):
   - `/home/kennedy/ankaa/apps/web/src/utils/lazy-with-query-client.tsx` - Can be removed after fix
   - `/home/kennedy/ankaa/apps/web/TESTING_COMPLETE.md` - Archive or update

## Testing Checklist

- [ ] Build completes without errors
- [ ] No console errors in production build
- [ ] Lazy-loaded routes load correctly
- [ ] Navigation between routes works
- [ ] React Query hooks work in all components
- [ ] No performance regression (check bundle size)
- [ ] Verify on multiple browsers (Chrome, Firefox, Safari)
- [ ] Test with slow network throttling
- [ ] Verify Suspense fallbacks show correctly

## Additional Notes

### Why This Is Hard to Debug
1. **Environment-specific**: Only happens in production
2. **Timing-dependent**: May work 90% of the time, fail 10%
3. **Asynchronous**: Race conditions are non-deterministic
4. **Build tool abstraction**: Vite's chunk splitting is opaque

### Similar Issues in the Wild
- [React Query #3476](https://github.com/TanStack/query/issues/3476)
- [Vite #7821](https://github.com/vitejs/vite/issues/7821)
- Multiple Stack Overflow posts about QueryClient initialization

### Prevention for Future
1. **Always test production builds** before deploying
2. **Use static analysis** to detect provider issues
3. **Monitor bundle sizes** after dependency changes
4. **Document critical dependencies** that shouldn't be split

## Conclusion

The "No QueryClient set" error is a **production-specific race condition** caused by Vite's chunk splitting strategy. The most reliable fix is to **inline React Query with the main bundle** to ensure it loads before any components that depend on it. This trades a small bundle size increase (~30KB) for guaranteed correctness.

**Recommended immediate action**: Modify `vite.config.ts` to prevent React Query from being split into a separate chunk.
