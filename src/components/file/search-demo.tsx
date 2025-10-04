import React, { useState, useCallback, useMemo, useRef, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { IconSearch, IconBug, IconCircleCheck, IconSparkles } from "@tabler/icons-react";
import { useSearchInput } from "@/hooks";

// Simple debounce utility
function createDebounce<T extends (...args: any[]) => any>(func: T, wait: number) {
  let timeout: NodeJS.Timeout | null = null;
  const debounced = (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
  debounced.cancel = () => {
    if (timeout) {
      clearTimeout(timeout);
      timeout = null;
    }
  };
  return debounced;
}

export function SearchDemo() {
  // OLD PATTERN (with dual state - causes backspace issues)
  const [displaySearchText, setDisplaySearchText] = useState("");
  const [searchingFor, setSearchingFor] = useState("");

  // NEW PATTERN (single state - no backspace issues)
  const [fixedSearchInput, setFixedSearchInput] = useState("");
  const [urlSearch, setUrlSearch] = useState("");

  // Old pattern debounce
  const oldDebouncedSearch = useMemo(
    () =>
      createDebounce((value: string) => {
        setSearchingFor(value);
      }, 300),
    [],
  );

  // New pattern debounce
  const newDebouncedUrlUpdate = useMemo(
    () =>
      createDebounce((search: string) => {
        setUrlSearch(search.trim());
      }, 300),
    [],
  );

  // HOOK PATTERN (Best solution)
  const {
    inputValue: hookInputValue,
    handleInputChange: hookHandleChange,
    clearSearch: hookClearSearch,
    isDebouncing,
  } = useSearchInput({
    paramName: "hookSearch",
    debounceMs: 300,
  });

  // Old pattern handler (problematic)
  const handleOldSearch = useCallback(
    (value: string) => {
      setDisplaySearchText(value); // Immediate UI update
      oldDebouncedSearch(value); // Debounced backend call
    },
    [oldDebouncedSearch],
  );

  // New pattern handler (fixed)
  const handleNewSearch = useCallback(
    (value: string) => {
      setFixedSearchInput(value); // Single source of truth
      newDebouncedUrlUpdate(value); // Debounced URL/API update
    },
    [newDebouncedUrlUpdate],
  );

  // Simulate the problematic effect in old pattern
  useEffect(() => {
    // This is what causes issues in the old pattern
    if (searchingFor !== displaySearchText) {
      // This can interfere with typing, especially backspace
      setDisplaySearchText(searchingFor);
    }
  }, [searchingFor]); // This creates circular dependency potential

  const resetDemo = () => {
    setDisplaySearchText("");
    setSearchingFor("");
    setFixedSearchInput("");
    setUrlSearch("");
    hookClearSearch();
  };

  return (
    <div className="space-y-6 p-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <IconBug className="h-5 w-5 text-destructive" />
            Search Input Backspace Issue Demo
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* OLD PATTERN - PROBLEMATIC */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <IconBug className="h-4 w-4 text-destructive" />
              <h3 className="font-semibold text-destructive">OLD PATTERN (Problematic)</h3>
            </div>
            <div className="space-y-2">
              <div className="relative">
                <IconSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                <Input type="text" placeholder="Try typing and backspacing here..." value={displaySearchText} onChange={(e) => handleOldSearch(e.target.value)} className="pl-10" />
              </div>
              <div className="text-sm text-muted-foreground space-y-1">
                <div>
                  <strong>Display State:</strong> "{displaySearchText}"
                </div>
                <div>
                  <strong>Search State:</strong> "{searchingFor}"
                </div>
                <div className="text-destructive">
                  <strong>Issue:</strong> Dual state with useEffect can cause cursor jumps and interference during backspace
                </div>
              </div>
            </div>
          </div>

          {/* NEW PATTERN - FIXED */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <IconCircleCheck className="h-4 w-4 text-green-600" />
              <h3 className="font-semibold text-green-600">NEW PATTERN (Fixed)</h3>
            </div>
            <div className="space-y-2">
              <div className="relative">
                <IconSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                <Input
                  type="text"
                  placeholder="Type and backspace smoothly here!"
                  value={fixedSearchInput}
                  onChange={(e) => handleNewSearch(e.target.value)}
                  className="pl-10 border-green-200 focus:border-green-400"
                />
              </div>
              <div className="text-sm text-muted-foreground space-y-1">
                <div>
                  <strong>Input State:</strong> "{fixedSearchInput}"
                </div>
                <div>
                  <strong>URL/API State:</strong> "{urlSearch}"
                </div>
                <div className="text-green-600">
                  <strong>Solution:</strong> Single input state + debounced URL updates. No circular dependencies!
                </div>
              </div>
            </div>
          </div>

          {/* HOOK PATTERN - BEST SOLUTION */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <IconSparkles className="h-4 w-4 text-blue-600" />
              <h3 className="font-semibold text-blue-600">HOOK PATTERN (Best Solution)</h3>
            </div>
            <div className="space-y-2">
              <div className="relative">
                <IconSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                <Input
                  type="text"
                  placeholder="useSearchInput hook - clean and simple!"
                  value={hookInputValue}
                  onChange={hookHandleChange}
                  className="pl-10 border-blue-200 focus:border-blue-400"
                />
                {isDebouncing && <div className="absolute right-3 top-1/2 transform -translate-y-1/2 text-blue-500 text-xs">Searching...</div>}
              </div>
              <div className="text-sm text-muted-foreground space-y-1">
                <div>
                  <strong>Hook Input:</strong> "{hookInputValue}"
                </div>
                <div>
                  <strong>Debouncing:</strong> {isDebouncing ? "Yes" : "No"}
                </div>
                <div className="text-blue-600">
                  <strong>Benefits:</strong> All complexity hidden in reusable hook. Zero boilerplate!
                </div>
              </div>
              <Button onClick={hookClearSearch} variant="outline" size="sm" className="border-blue-200 text-blue-600 hover:bg-blue-50">
                Clear Hook Search
              </Button>
            </div>
          </div>

          <div className="pt-4 border-t">
            <h4 className="font-semibold mb-2">Pattern Comparison:</h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div className="space-y-2">
                <h5 className="font-medium text-destructive">❌ Old Pattern Issues:</h5>
                <ul className="space-y-1 text-muted-foreground">
                  <li>• Dual state management</li>
                  <li>• Complex useEffect syncing</li>
                  <li>• Circular dependency risks</li>
                  <li>• Cursor position issues</li>
                  <li>• ~30+ lines of code</li>
                </ul>
              </div>
              <div className="space-y-2">
                <h5 className="font-medium text-green-600">✅ Manual Fix Benefits:</h5>
                <ul className="space-y-1 text-muted-foreground">
                  <li>• Single source of truth</li>
                  <li>• No circular dependencies</li>
                  <li>• Smooth backspace behavior</li>
                  <li>• Manual debounce control</li>
                  <li>• ~15-20 lines of code</li>
                </ul>
              </div>
              <div className="space-y-2">
                <h5 className="font-medium text-blue-600">🚀 Hook Pattern Advantages:</h5>
                <ul className="space-y-1 text-muted-foreground">
                  <li>• Zero boilerplate code</li>
                  <li>• Reusable across components</li>
                  <li>• Built-in TypeScript support</li>
                  <li>• Automatic cleanup</li>
                  <li>• Just 1 line of code!</li>
                </ul>
              </div>
            </div>
          </div>

          <Button onClick={resetDemo} variant="outline" className="mt-4">
            Reset Demo
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Implementation Details</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <h4 className="font-semibold mb-2">useSearchInput Hook Usage:</h4>
              <pre className="bg-muted p-3 rounded text-sm overflow-x-auto">
                {`// Import the hook
import { useSearchInput } from '@/hooks';

// Use in component - that's it!
const { inputValue, handleInputChange, clearSearch, isDebouncing } = useSearchInput({
  paramName: 'searchingFor', // Optional: default is 'searchingFor'
  debounceMs: 500            // Optional: default is 500ms
});

// In your JSX
<input
  value={inputValue}
  onChange={handleInputChange}
  placeholder="Search..."
/>
{isDebouncing && <span>Searching...</span>}
<button onClick={clearSearch}>Clear</button>`}
              </pre>
            </div>
            <div>
              <h4 className="font-semibold mb-2">Manual Pattern Code (Before Hook):</h4>
              <pre className="bg-muted p-3 rounded text-sm overflow-x-auto">
                {`// Single state for input display
const [searchInput, setSearchInput] = useState(() =>
  searchParams.get("search") || ""
);

// Debounced URL update function
const debouncedUpdateUrl = useMemo(
  () => createDebounce((search: string) => {
    setSearchParams(prev => {
      const params = new URLSearchParams(prev);
      if (search.trim()) {
        params.set("search", search.trim());
      } else {
        params.delete("search");
      }
      return params;
    }, { replace: true });
  }, 300),
  [setSearchParams]
);

// Simple change handler
const handleSearchChange = useCallback((value: string) => {
  setSearchInput(value); // Immediate UI update
  debouncedUpdateUrl(value); // Debounced URL update
}, [debouncedUpdateUrl]);

// Sync with URL only when needed (browser back/forward)
useEffect(() => {
  const urlSearch = searchParams.get("search") || "";
  if (urlSearch !== searchInput) {
    setSearchInput(urlSearch);
  }
}, [searchParams.get("search")]);`}
              </pre>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
