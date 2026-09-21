import React, { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "./button";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";
import { Badge } from "./badge";
import { Checkbox } from "./checkbox";
import { IconCheck, IconChevronDown, IconPlus, IconSearch, IconX, IconLoader2, IconArrowDown } from "@tabler/icons-react";
import { cn } from "../../lib/utils";
import { useDebouncedValue } from "@/hooks/common/use-debounced-value";

export interface ComboboxOption {
  value: string;
  label: string;
  description?: string;
  disabled?: boolean;
  metadata?: any;
  // Extended properties for specific use cases
  unicode?: string;
  brand?: string;
  category?: string;
  [key: string]: any;
}

interface ComboboxProps<TData = ComboboxOption> {
  // Core props
  value?: string | string[];
  onValueChange?: (value: string | string[] | null | undefined) => void;
  options?: TData[];

  // Mode configuration
  mode?: "single" | "multiple";
  async?: boolean;

  // Async configuration
  queryKey?: unknown[];
  queryFn?: (searchTerm: string, page?: number) => Promise<{ data: TData[]; hasMore?: boolean; total?: number }>;
  initialOptions?: TData[];
  minSearchLength?: number;
  debounceMs?: number;
  staleTime?: number;
  pageSize?: number;

  // Create functionality
  allowCreate?: boolean;
  onCreate?: (value: string) => void | Promise<void> | TData | Promise<TData>;
  createLabel?: (value: string) => string;
  isCreating?: boolean;
  queryKeysToInvalidate?: unknown[][];

  // Custom empty action (shown when no results, alternative to allowCreate)
  customEmptyAction?: {
    label: string;
    icon?: React.ReactNode;
    onClick: () => void;
  };

  // Display customization
  placeholder?: string;
  emptyText?: string;
  searchPlaceholder?: string;
  loadingText?: string;

  // Option configuration
  getOptionValue?: (option: TData) => string;
  getOptionLabel?: (option: TData) => string;
  getOptionDescription?: (option: TData) => string | undefined;
  isOptionDisabled?: (option: TData) => boolean;

  // UI configuration
  disabled?: boolean;
  searchable?: boolean;
  clearable?: boolean;
  className?: string;
  triggerClassName?: string;
  required?: boolean;

  // Custom rendering
  renderOption?: (option: TData, isSelected: boolean) => React.ReactNode;
  renderValue?: (option: TData | TData[]) => React.ReactNode;
  formatDisplay?: "category" | "brand";
  // When true (single mode + renderOption), the option fills the whole row with no
  // built-in check/padding — renderOption owns the full row (incl. its own selected marker).
  fullWidthOption?: boolean;

  // Loading states
  loading?: boolean;

  // Form integration
  name?: string;

  // Multi-select specific
  singleMode?: boolean;
  showCount?: boolean;
  hideDefaultBadges?: boolean;

  // Fixed content rendered between search and scrollable list
  fixedTopContent?: React.ReactNode | ((searchTerm: string) => React.ReactNode);

  // Open on mount (for auto-opening newly added rows)
  defaultOpen?: boolean;
}

export const Combobox = React.memo(function Combobox<TData = ComboboxOption>({
  value,
  onValueChange,
  options: propOptions,
  mode = "single",
  async = false,
  queryKey,
  queryFn,
  initialOptions = [],
  minSearchLength = 1,
  debounceMs = 300,
  staleTime: _staleTime = 5 * 60 * 1000,
  pageSize: _pageSize = 20,
  allowCreate = false,
  onCreate,
  createLabel = (value) => `Criar "${value}"`,
  isCreating = false,
  queryKeysToInvalidate = [],
  customEmptyAction,
  placeholder = "Selecione uma opção",
  emptyText = "Nenhuma opção encontrada",
  searchPlaceholder = "Pesquisar...",
  loadingText = "Carregando...",
  getOptionValue = (option: any) => option.value,
  getOptionLabel = (option: any) => option.label,
  getOptionDescription = (option: any) => option.description,
  isOptionDisabled = (option: any) => option.disabled || false,
  disabled = false,
  searchable = true,
  clearable = true,
  className,
  triggerClassName,
  required: _required = false,
  renderOption,
  renderValue,
  formatDisplay,
  fullWidthOption = false,
  loading: externalLoading,
  name,
  singleMode = false,
  showCount = true,
  hideDefaultBadges = false,
  fixedTopContent,
  defaultOpen = false,
}: ComboboxProps<TData>) {
  const [open, setOpen] = useState(defaultOpen);
  const [search, setSearch] = useState("");

  // Log search state changes - commented to reduce noise
  // useEffect(() => {
  //   console.log('[Combobox] Search state updated:', search);
  // }, [search]);
  const [isClosing, setIsClosing] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [allAsyncOptions, setAllAsyncOptions] = useState<TData[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const debouncedSearch = useDebouncedValue(search, debounceMs);
  const queryClient = useQueryClient();

  // Use refs for getter functions and initialOptions to prevent infinite loops in useEffect dependencies
  const getOptionValueRef = useRef(getOptionValue);
  const getOptionLabelRef = useRef(getOptionLabel);
  const getOptionDescriptionRef = useRef(getOptionDescription);
  const isOptionDisabledRef = useRef(isOptionDisabled);
  const initialOptionsRef = useRef(initialOptions);

  // Cache to maintain all items that have been loaded or selected - persists across filter changes
  const allItemsCacheRef = useRef<Map<string, TData>>(new Map());

  // Update refs when props change (without triggering effects)
  useEffect(() => {
    getOptionValueRef.current = getOptionValue;
    getOptionLabelRef.current = getOptionLabel;
    getOptionDescriptionRef.current = getOptionDescription;
    isOptionDisabledRef.current = isOptionDisabled;
    initialOptionsRef.current = initialOptions;
  }, [getOptionValue, getOptionLabel, getOptionDescription, isOptionDisabled, initialOptions]);

  const isMultiple = mode === "multiple";
  const selectedValues = useMemo(() => {
    if (!value) return [];
    return Array.isArray(value) ? value : [value];
  }, [value]);

  // This effect must be defined AFTER useQuery to access refetch
  // We'll move it after the useQuery hook

  // Async query for first page
  // Debug logging - commented to reduce noise
  // useEffect(() => {
  //   if (async) {
  //     console.log('[Combobox Debug]', {
  //       search,
  //       debouncedSearch,
  //       queryKey: queryKey ? [...queryKey, debouncedSearch, 1] : ["combobox", debouncedSearch, 1],
  //       enabled: async && !!queryKey && !!queryFn,
  //       hasQueryFn: !!queryFn,
  //       minSearchLength,
  //       currentSearchLength: debouncedSearch.length,
  //     });
  //   }
  // }, [search, debouncedSearch, async, queryKey, queryFn, minSearchLength]);

  const { data: asyncResponse, isLoading: isLoadingOptions, refetch: _refetch } = useQuery<{ data: TData[]; hasMore?: boolean; total?: number }>({
    queryKey: queryKey ? [...queryKey, debouncedSearch, 1] : ["combobox", debouncedSearch, 1],
    queryFn: async () => {
      // console.log('[Combobox] queryFn called with:', { debouncedSearch, page: 1 });

      if (!queryFn) {
        // console.log('[Combobox] No queryFn, returning initial options');
        return { data: initialOptions || [], hasMore: false };
      }

      // Check minimum search length
      if (debouncedSearch.length < minSearchLength) {
        // If minSearchLength is 0, we should still call the query function with empty search
        // to get initial data (like when the dropdown opens)
        if (minSearchLength === 0) {
          // console.log('[Combobox] Calling queryFn with empty search (minSearchLength=0)');
          const result = await queryFn("", 1);
          // console.log('[Combobox] Result from empty search:', result);
          // Handle backward compatibility - if queryFn returns an array directly
          if (Array.isArray(result)) {
            return { data: result, hasMore: false };
          }
          return result;
        }
        // If minSearchLength > 0, return initial options without making a request
        // console.log('[Combobox] Search too short, returning initial options');
        return { data: initialOptions || [], hasMore: false };
      }

      // console.log('[Combobox] Calling queryFn with search:', debouncedSearch);
      const result = await queryFn(debouncedSearch, 1);
      // console.log('[Combobox] Result from search:', result);

      // Handle backward compatibility - if queryFn returns an array directly
      if (Array.isArray(result)) {
        return { data: result, hasMore: false };
      }
      return result;
    },
    enabled: async && !!queryKey && !!queryFn,
    staleTime: 0, // Always fetch fresh data when query key changes
    gcTime: 0, // Don't cache results between searches (formerly cacheTime)
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });

  // Track if we've done initial mount
  const hasInitializedRef = useRef(false);

  // Initialize with initialOptions on mount ONLY (not when options become empty during search)
  useEffect(() => {
    const currentInitialOptions = initialOptionsRef.current;
    if (!hasInitializedRef.current && async && currentInitialOptions && currentInitialOptions.length > 0) {
      hasInitializedRef.current = true;
      setAllAsyncOptions(currentInitialOptions);
    }
  }, [async]);

  // ─── initialOptions QUE CHEGAM DEPOIS ────────────────────────────────────
  //
  // O efeito acima roda uma vez e depende só de `async`, então ele só vê
  // `initialOptions` que já existam no primeiro render. Quem preenche essa lista
  // buscando o item SELECIONADO por id — o caso do seletor de cliente numa tela
  // de edição — só a entrega quando a requisição volta, e aí não havia mais
  // nenhum efeito para recebê-la: nem o cache nem `allAsyncOptions` eram
  // atualizados, e o gatilho continuava mostrando o placeholder.
  //
  // O sintoma era caro e passava por perda de dado: todo cliente fora da
  // primeira página da lista (ordenada por nome, 50 por vez) abria a edição do
  // orçamento com "Selecione um cliente", como se o vínculo tivesse sumido —
  // num cadastro de ~300 clientes, a maioria deles. O valor SEMPRE esteve no
  // formulário; faltava o rótulo.
  //
  // Mexer no cache não bastaria: ele é um ref, e a resolução do rótulo é um
  // `useMemo` que não observa refs. Por isso este efeito também escreve no
  // estado — é o que faz o gatilho recalcular.
  const initialOptionValues = (initialOptions || [])
    .map(opt => {
      try {
        return String(getOptionValueRef.current(opt));
      } catch {
        return '';
      }
    })
    .join('|');
  useEffect(() => {
    const currentInitialOptions = initialOptionsRef.current;
    if (!async || !currentInitialOptions || currentInitialOptions.length === 0) return;
    let added = false;
    currentInitialOptions.forEach(opt => {
      const itemValue = getOptionValueRef.current(opt);
      if (!allItemsCacheRef.current.has(itemValue)) {
        allItemsCacheRef.current.set(itemValue, opt);
        added = true;
      }
    });
    if (!added) return;
    setAllAsyncOptions(prev => {
      const known = new Set(prev.map(item => getOptionValueRef.current(item)));
      const missing = currentInitialOptions.filter(
        opt => !known.has(getOptionValueRef.current(opt)),
      );
      return missing.length > 0 ? [...missing, ...prev] : prev;
    });
  }, [async, initialOptionValues]);

  // Freshest `value` for the async option-merge effect below, which must not re-run on selection.
  const valueRef = useRef(value);
  valueRef.current = value;

  // Reset pagination when search changes
  //
  // ⚠️ `hasMore` TAMBÉM zera aqui, e essa linha é a correção de um defeito que
  // custava uma página inteira de opções.
  //
  // A lista some (as opções da busca anterior são descartadas acima), o
  // contêiner encolhe e o navegador dispara um `scroll` — e o `onScroll` da
  // lista chama `loadMore()` assim que passa de 85%. Nesse instante a página 1
  // da NOVA busca ainda está no ar, mas `hasMore` guardava a resposta da busca
  // ANTERIOR: ainda era `true`. Resultado, com `currentPage` já de volta a 1:
  // um pedido de PÁGINA 2 da busca nova antes de a página 1 chegar.
  //
  // Quem chegasse por último ganhava. Se a página 1 chegasse depois, o efeito
  // de `asyncResponse` SUBSTITUI a lista pela página 1 — e as 20 linhas da
  // página 2 evaporavam, enquanto `currentPage` continuava em 2. O próximo
  // "carregar mais" pedia a 3: aquelas 20 linhas ficavam inalcançáveis, e para
  // quem estava rolando a lista parecia ter parado de carregar.
  //
  // Zerado, o `loadMore` não tem como disparar antes da página 1 da busca nova
  // — e quando ela chega, ela mesma diz se há mais.
  useEffect(() => {
    // console.log('[Combobox] Search changed, resetting pagination. debouncedSearch:', debouncedSearch);
    setCurrentPage(1);
    setHasMore(false);
    // Clear options for new search to show loading state
    // Don't re-add initialOptions here - let the async query handle it
    if (debouncedSearch !== '') {
      setAllAsyncOptions([]);
    }
  }, [debouncedSearch]);

  // Update all options when first page loads or search changes
  useEffect(() => {
    // console.log('[Combobox] asyncResponse changed:', asyncResponse);
    if (asyncResponse) {
      // Start with fetched data
      let newOptions = asyncResponse.data || [];

      // Add all fetched items to the cache
      newOptions.forEach((item: TData) => {
        const itemValue = getOptionValueRef.current(item);
        allItemsCacheRef.current.set(itemValue, item);
      });

      // If we have initialOptions, add them to cache
      const currentInitialOptions = initialOptionsRef.current;
      if (currentInitialOptions && currentInitialOptions.length > 0) {
        currentInitialOptions.forEach(opt => {
          const itemValue = getOptionValueRef.current(opt);
          if (!allItemsCacheRef.current.has(itemValue)) {
            allItemsCacheRef.current.set(itemValue, opt);
          }
        });
      }

      // Get current selected values. Read through a ref, NOT the prop: `value` used to be a dep of
      // this effect, and since the effect unconditionally replaces the option list with page 1,
      // every selection threw away the pages the user had scrolled in — while `currentPage` kept
      // its count, so the next "carregar mais" skipped a page outright and those rows became
      // unreachable. Selecting must not reset paging.
      const latestValue = valueRef.current;
      const currentSelectedValues = Array.isArray(latestValue) ? latestValue : (latestValue ? [latestValue] : []);

      // Merge in selected items from cache that aren't in the current response
      // ONLY when there's no active search - this ensures selected items show when dropdown opens
      // but don't pollute search results when user is searching for something else
      if (!debouncedSearch || debouncedSearch.trim() === '') {
        const fetchedValues = new Set(newOptions.map((item: TData) => getOptionValueRef.current(item)));
        currentSelectedValues.forEach(selectedValue => {
          if (!fetchedValues.has(selectedValue) && allItemsCacheRef.current.has(selectedValue)) {
            const cachedItem = allItemsCacheRef.current.get(selectedValue);
            if (cachedItem) {
              newOptions = [cachedItem, ...newOptions];
            }
          }
        });
      }

      // Deduplicate items based on their value to prevent duplicate key warnings
      const deduplicatedData = newOptions.filter(
        (item: TData, index: number, self: TData[]) => {
          const itemValue = getOptionValueRef.current(item);
          return index === self.findIndex((t: TData) => getOptionValueRef.current(t) === itemValue);
        }
      );

      // console.log('[Combobox] Setting allAsyncOptions for search:', debouncedSearch, 'data:', deduplicatedData);
      // Always replace options when we get new results (don't append on first page)
      setAllAsyncOptions(deduplicatedData);
      setHasMore(asyncResponse.hasMore || false);
    } else if (asyncResponse === null) {
      // Query returned null/undefined - clear the options
      // console.log('[Combobox] Query returned null, clearing options');
      setAllAsyncOptions([]);
      setHasMore(false);
    }
  }, [asyncResponse, debouncedSearch]); // getOptionValue, initialOptions and value are read via refs

  // ─── AS DUAS TRAVAS DO "CARREGAR MAIS" ───────────────────────────────────
  //
  // `isLoadingMore` é ESTADO, e estado só vale no render seguinte. Uma rolagem
  // de roda dispara vários `scroll` no mesmo quadro, e todos leem o mesmo
  // `false` do fechamento — a mesma página saía pedida duas ou três vezes.
  // A trava de verdade é um ref, que muda no ato.
  const loadMoreLockRef = useRef(false);

  // O SENTINELA — uma linha invisível no FIM da lista, observada pelo
  // `IntersectionObserver`.
  //
  // ⚠️ Substitui a conta de porcentagem no `onScroll` do contêiner. Aquela conta
  // presumia saber QUEM rola: ela lia `scrollTop/clientHeight/scrollHeight` de
  // um elemento específico e só funcionava se fosse exatamente ele a rolar.
  // Bastava um ancestral com `overflow` (um popover, um contêiner de diálogo,
  // uma mudança de layout) para a roda do usuário rolar OUTRA caixa: a conta
  // nunca passava de 85%, `loadMore` nunca disparava, e a lista parecia ter
  // parado de carregar — sem erro, sem log, sem nada para depurar.
  //
  // O observador não pergunta quem rola. Ele pergunta "o fim da lista apareceu?",
  // que é a pergunta que de fato interessa, e o navegador responde sozinho.
  const sentinelaRef = useRef<HTMLDivElement | null>(null);
  // E o termo buscado MAIS RECENTE, para descartar a resposta de uma página que
  // foi pedida para uma busca que já não está na tela: sem isto, as linhas de
  // "azul" entravam no fim da lista de "verde".
  const debouncedSearchRef = useRef(debouncedSearch);
  debouncedSearchRef.current = debouncedSearch;

  // Load more function
  const loadMore = useCallback(async () => {
    if (!queryFn || loadMoreLockRef.current || isLoadingMore || !hasMore) return;

    loadMoreLockRef.current = true;
    const requestedSearch = debouncedSearch;
    setIsLoadingMore(true);
    try {
      const nextPage = currentPage + 1;
      const result = await queryFn(requestedSearch, nextPage);

      // A busca mudou enquanto esta página vinha: a resposta é de outra lista.
      if (debouncedSearchRef.current !== requestedSearch) return;

      // Handle backward compatibility
      if (Array.isArray(result)) {
        // Add items to cache
        result.forEach(item => {
          const itemValue = getOptionValue(item);
          allItemsCacheRef.current.set(itemValue, item);
        });

        // Deduplicate when adding more items
        setAllAsyncOptions((prev) => {
          const combined = [...prev, ...result];
          // Remove duplicates based on option value
          const seen = new Set();
          return combined.filter((item) => {
            const value = getOptionValue(item);
            if (seen.has(value)) {
              return false;
            }
            seen.add(value);
            return true;
          });
        });
        setHasMore(false);
      } else {
        // Add items to cache
        (result.data || []).forEach(item => {
          const itemValue = getOptionValue(item);
          allItemsCacheRef.current.set(itemValue, item);
        });

        // Deduplicate when adding more items
        setAllAsyncOptions((prev) => {
          const combined = [...prev, ...(result.data || [])];
          // Remove duplicates based on option value
          const seen = new Set();
          return combined.filter((item) => {
            const value = getOptionValue(item);
            if (seen.has(value)) {
              return false;
            }
            seen.add(value);
            return true;
          });
        });
        setHasMore(result.hasMore || false);
      }

      setCurrentPage(nextPage);
    } catch (error) {
      if (process.env.NODE_ENV !== 'production') {
        console.error("Error loading more options:", error);
      }
    } finally {
      loadMoreLockRef.current = false;
      setIsLoadingMore(false);
    }
  }, [queryFn, isLoadingMore, hasMore, currentPage, debouncedSearch]);

  // `rootMargin` de 120px: pede a página seguinte um pouco ANTES de o fim
  // aparecer, para que a lista não trave visivelmente ao chegar no fundo.
  //
  // `open` está nas dependências porque o conteúdo do popover só existe no DOM
  // enquanto ele está aberto — sem isso o observador se prenderia a um nó morto
  // e nunca mais dispararia depois do primeiro fechamento.
  useEffect(() => {
    if (!async || !open || !hasMore) return;
    const alvo = sentinelaRef.current;
    if (!alvo || typeof IntersectionObserver === "undefined") return;

    const observador = new IntersectionObserver(
      entradas => {
        if (entradas.some(e => e.isIntersecting)) void loadMore();
      },
      { rootMargin: "120px" },
    );
    observador.observe(alvo);
    return () => observador.disconnect();
  }, [async, open, hasMore, loadMore]);

  // Determine options source
  const options = async ? allAsyncOptions : propOptions || [];
  const loading = async ? isLoadingOptions && currentPage === 1 : externalLoading;

  // Debug what options we're using - commented to reduce noise
  // useEffect(() => {
  //   if (async) {
  //     console.log('[Combobox] Options being used:', {
  //       async,
  //       optionsLength: options.length,
  //       allAsyncOptionsLength: allAsyncOptions.length,
  //       propOptionsLength: propOptions?.length,
  //       options: options.slice(0, 3), // Show first 3 for debugging
  //     });
  //   }
  // }, [async, options, allAsyncOptions, propOptions]);

  // Filter options - only filter locally for non-async mode
  const filteredOptions = useMemo(() => {
    // For async mode, server already returns filtered results
    if (async) return options;

    // For non-async mode, perform local filtering
    if (!searchable || !search) return options;

    const searchLower = search.toLowerCase();
    return options.filter((option) => {
      const label = getOptionLabel(option).toLowerCase();
      const description = getOptionDescription(option)?.toLowerCase() || "";
      return label.includes(searchLower) || description.includes(searchLower);
    });
  }, [async, options, search, searchable, getOptionLabel, getOptionDescription]);

  // Get selected option(s)
  const selectedOptions = useMemo(() => {
    // First, try to find in current options
    const foundInOptions = options.filter((option) => selectedValues.includes(getOptionValue(option)));

    // If we found all selected values, return them
    if (foundInOptions.length === selectedValues.length) {
      return foundInOptions;
    }

    // Otherwise, check the cache for missing items
    // This handles the case where a newly created item hasn't made it to options state yet
    const result: TData[] = [...foundInOptions];
    const foundValues = new Set(foundInOptions.map(opt => getOptionValue(opt)));

    selectedValues.forEach(selectedValue => {
      if (!foundValues.has(selectedValue) && allItemsCacheRef.current.has(selectedValue)) {
        const cachedItem = allItemsCacheRef.current.get(selectedValue);
        if (cachedItem) {
          result.push(cachedItem);
          foundValues.add(selectedValue);
        }
      }
    });

    return result;
  }, [options, selectedValues, getOptionValue]);

  const formatOptionLabel = useCallback(
    (option: TData) => {
      const label = getOptionLabel(option);
      const optionAny = option as any;

      if (formatDisplay === "category" && optionAny.category) {
        return `${label} (${optionAny.category})`;
      }
      if (formatDisplay === "brand") {
        const parts = [];
        if (optionAny.unicode) parts.push(optionAny.unicode);
        parts.push(label);
        const brandNames = Array.isArray(optionAny.brands) ? optionAny.brands.map((b: any) => b?.name ?? b).filter(Boolean).join(", ") : optionAny.brand;
        if (brandNames || optionAny.category) {
          parts.push(`(${brandNames || optionAny.category})`);
        }
        return parts.join(" ");
      }
      return label;
    },
    [getOptionLabel, formatDisplay],
  );

  const handleSelect = useCallback(
    (optionValue: string) => {
      if (isClosing) return;

      // Find the full option object and add it to cache
      const selectedOption = options.find(opt => getOptionValue(opt) === optionValue);

      if (selectedOption) {
        allItemsCacheRef.current.set(optionValue, selectedOption);
      }

      if (isMultiple) {
        const newValues = selectedValues.includes(optionValue) ? selectedValues.filter((v) => v !== optionValue) : [...selectedValues, optionValue];
        onValueChange?.(newValues);
      } else {
        const newValue = value === optionValue ? undefined : optionValue;
        onValueChange?.(newValue);

        setIsClosing(true);
        requestAnimationFrame(() => {
          setOpen(false);
          setSearch("");
          setIsClosing(false);
        });
      }
    },
    [isClosing, isMultiple, selectedValues, value, onValueChange, options, getOptionValue],
  );

  const handleCreate = useCallback(async () => {
    if (isClosing || !onCreate || !search.trim()) {
      return;
    }

    const searchValue = search.trim();

    try {
      // Call onCreate and get the newly created item
      const createdItem = await onCreate(searchValue);

      // If onCreate returned the created item, process it
      if (createdItem) {
        const itemValue = getOptionValueRef.current(createdItem as TData);

        // Validate the extracted value
        if (!itemValue || (typeof itemValue === 'string' && itemValue.trim() === '')) {
          setIsClosing(false);
          return;
        }

        // Add to cache immediately (synchronous)
        allItemsCacheRef.current.set(itemValue, createdItem as TData);

        // Add to allAsyncOptions state FIRST so it's in the options when we select
        if (async) {
          setAllAsyncOptions(prev => {
            // Check if it already exists to avoid duplicates
            const exists = prev.some(item => getOptionValueRef.current(item) === itemValue);
            if (exists) {
              return prev;
            }
            return [createdItem as TData, ...prev];
          });
        }

        // Invalidate related query keys to refresh data
        if (queryKeysToInvalidate.length > 0) {
          try {
            await Promise.all(queryKeysToInvalidate.map((key) => queryClient.invalidateQueries({ queryKey: key })));
          } catch (error) {
            // Query invalidation failed
          }
        }

        // CRITICAL: Wait for React to process the state updates
        // We need to ensure options and cache are fully updated before selecting
        await new Promise(resolve => setTimeout(resolve, 100));

        // Call onValueChange to update the form field
        onValueChange?.(itemValue);

        // Wait longer for React Hook Form to process the update and trigger re-renders
        await new Promise(resolve => setTimeout(resolve, 300));

        // Close the popover
        setIsClosing(true);

        requestAnimationFrame(() => {
          setOpen(false);
          setSearch("");
          // Reset isClosing after a delay
          setTimeout(() => {
            setIsClosing(false);
          }, 150);
        });
      }
    } catch (error) {
      setIsClosing(false);
    }
  }, [isClosing, onCreate, search, queryKeysToInvalidate, queryClient, async, onValueChange]);

  const handleClear = useCallback(
    (e?: React.MouseEvent) => {
      e?.stopPropagation();
      onValueChange?.(isMultiple ? [] : undefined);
      setSearch("");
    },
    [isMultiple, onValueChange],
  );

  const handleSelectAll = useCallback(() => {
    const allValues = filteredOptions.filter((option) => !isOptionDisabled(option)).map((option) => getOptionValue(option));
    onValueChange?.(allValues);
  }, [filteredOptions, isOptionDisabled, getOptionValue, onValueChange]);

  const handleClearAll = useCallback(() => {
    onValueChange?.([]);
  }, [onValueChange]);

  const triggerContent = useMemo(() => {
    if (renderValue) {
      return renderValue(isMultiple ? selectedOptions : selectedOptions[0]);
    }

    // For multiple mode, use selectedValues.length (from form value) for counts
    // since selectedOptions may not include items from unpaginated pages
    if (isMultiple) {
      if (selectedValues.length === 0) {
        return <span className="opacity-70">{placeholder}</span>;
      }
      if (singleMode && selectedOptions.length > 0) {
        const label = formatOptionLabel(selectedOptions[0]);
        return showCount && selectedValues.length > 1 ? `${label} +${selectedValues.length - 1}` : label;
      }
      return showCount ? `${selectedValues.length} selecionado${selectedValues.length !== 1 ? "s" : ""}` : placeholder;
    }

    if (selectedOptions.length === 0) {
      return <span className="opacity-70">{placeholder}</span>;
    }

    const formattedLabel = formatOptionLabel(selectedOptions[0]);
    return formattedLabel;
  }, [renderValue, selectedOptions, selectedValues, placeholder, isMultiple, singleMode, showCount, formatOptionLabel]);

  const showCreateOption = allowCreate && search.trim() && filteredOptions.length === 0 && !filteredOptions.some((opt) => getOptionLabel(opt).toLowerCase() === search.toLowerCase());

  // Extract height class from className if provided, default to h-10
  const heightClass = useMemo(() => {
    if (!className) return "h-10";

    const heightMatch = className.match(/\bh-\d+(?:\.\d+)?\b/);
    return heightMatch ? heightMatch[0] : "h-10";
  }, [className]);

  // Remove height class from className to avoid conflicts
  const classNameWithoutHeight = useMemo(() => {
    if (!className) return "";
    return className.replace(/\bh-\d+(?:\.\d+)?\b/g, "").trim();
  }, [className]);

  return (
    <div className={cn("w-full", classNameWithoutHeight)}>
      <Popover
        open={open}
        onOpenChange={(newOpen) => {
          if (!isClosing) {
            setOpen(newOpen);
            if (!newOpen) {
              setSearch("");
            }
          }
        }}
      >
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            aria-haspopup="listbox"
            aria-label={name || "Select option"}
            className={cn(
              "group w-full justify-between text-foreground bg-transparent",
              heightClass,
              "hover:bg-accent hover:text-white",
              "data-[state=open]:bg-accent data-[state=open]:text-white",
              triggerClassName,
            )}
            data-state={open ? "open" : "closed"}
            disabled={disabled}
            type="button"
          >
            <span className="truncate flex-1 text-left">{triggerContent}</span>
            <div className="flex items-center ml-2 gap-1">
              {clearable && !isMultiple && selectedValues.length > 0 && !disabled && (
                <span
                  role="button"
                  tabIndex={0}
                  className="h-4 w-4 shrink-0 opacity-50 hover:opacity-100 rounded-sm hover:bg-destructive/20"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleClear(e);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      e.stopPropagation();
                      handleClear();
                    }
                  }}
                  aria-label="Limpar seleção"
                >
                  <IconX className="h-4 w-4" />
                </span>
              )}
              <IconChevronDown className="h-4 w-4 shrink-0 opacity-50" />
            </div>
          </Button>
        </PopoverTrigger>

        <PopoverContent
          className="w-[var(--radix-popover-trigger-width)] min-w-[200px] p-0"
          align="start"
          onOpenAutoFocus={(e) => e.preventDefault()}
          onWheel={(e) => {
            // Prevent wheel events from bubbling to the modal
            e.stopPropagation();
          }}
        >
          <div className="flex flex-col max-h-[400px]">
            {searchable && (
              <div className="flex items-center border-b dark:border-border/30 px-3 py-2 gap-2">
                <IconSearch className="h-4 w-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder={searchPlaceholder}
                  value={search}
                  onChange={(e) => {
                    const newValue = e.target.value;
                    // console.log('[Combobox] Search input onChange:', { oldValue: search, newValue });
                    setSearch(newValue);
                  }}
                  className="border-0 p-0 h-auto focus-visible:ring-0 focus-visible:ring-offset-0 bg-transparent outline-none w-full"
                  onClick={(e) => e.stopPropagation()}
                  onKeyDown={(e) => {
                    // Prevent closing on Enter
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      e.stopPropagation();
                    }
                  }}
                  autoFocus
                />
              </div>
            )}

            {isMultiple && filteredOptions.length > 0 && (
              <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1 px-3 py-2 border-b dark:border-border/30">
                <span className="text-sm text-muted-foreground min-w-0 truncate">
                  {selectedValues.length} de {filteredOptions.length} selecionados
                </span>
                <div className="flex gap-1 shrink-0">
                  <Button variant="ghost" size="sm" onClick={handleSelectAll} className="h-auto py-1 px-2">
                    Selecionar todos
                  </Button>
                  <Button variant="ghost" size="sm" onClick={handleClearAll} className="h-auto py-1 px-2">
                    Limpar
                  </Button>
                </div>
              </div>
            )}

            {typeof fixedTopContent === 'function' ? fixedTopContent(search) : fixedTopContent}

            <div
              className="max-h-[15rem] overflow-y-auto overflow-x-hidden scrollbar-thin scrollbar-thumb-gray-400 scrollbar-track-gray-100"
              style={{
                overscrollBehavior: "contain",
                WebkitOverflowScrolling: "touch",
                willChange: "scroll-position",
              }}
              onPointerDown={(e) => {
                // Ensure pointer events work properly
                e.stopPropagation();
              }}
              // Sem `onScroll`: quem pede a próxima página é o sentinela do fim
              // da lista (ver `sentinelaRef`). A conta de porcentagem que morava
              // aqui só funcionava quando ERA ESTE o elemento que rolava.
            >
              <div className="p-2">
                {!isMultiple && clearable && selectedValues.length > 0 && (
                  <div
                    role="button"
                    tabIndex={0}
                    className="w-full flex items-center px-2 py-2 text-sm rounded-sm cursor-pointer hover:bg-accent hover:text-accent-foreground"
                    onClick={handleClear}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        handleClear();
                      }
                    }}
                  >
                    <IconX className="mr-2 h-4 w-4" />
                    <span className="truncate">Limpar seleção</span>
                  </div>
                )}

                {showCreateOption && (
                  <div
                    role="button"
                    tabIndex={0}
                    className={cn(
                      "w-full flex items-center px-2 py-2 text-sm rounded-sm cursor-pointer hover:bg-accent hover:text-accent-foreground",
                      isCreating && "opacity-50 cursor-not-allowed",
                    )}
                    onClick={(_e) => {
                      if (!isCreating) {
                        handleCreate();
                      }
                    }}
                    onKeyDown={(e) => {
                      if ((e.key === "Enter" || e.key === " ") && !isCreating) {
                        e.preventDefault();
                        handleCreate();
                      }
                    }}
                  >
                    <IconPlus className="mr-2 h-4 w-4" />
                    <span className="truncate">{createLabel(search.trim())}</span>
                    {isCreating && <IconLoader2 className="ml-2 h-4 w-4 animate-spin" />}
                  </div>
                )}

                {/* Custom empty action button */}
                {customEmptyAction && filteredOptions.length === 0 && !loading && (
                  <div
                    role="button"
                    tabIndex={0}
                    className="w-full flex items-center px-2 py-2 text-sm rounded-sm cursor-pointer hover:bg-accent hover:text-accent-foreground"
                    onClick={(e) => {
                      e.stopPropagation();
                      customEmptyAction.onClick();
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        customEmptyAction.onClick();
                      }
                    }}
                  >
                    {customEmptyAction.icon || <IconPlus className="mr-2 h-4 w-4" />}
                    <span className="truncate">{customEmptyAction.label}</span>
                  </div>
                )}

                {loading ? (
                  <div className="px-2 py-8 text-center text-sm text-muted-foreground">
                    <IconLoader2 className="h-4 w-4 animate-spin mx-auto mb-2" />
                    {loadingText}
                  </div>
                ) : filteredOptions.length === 0 && !showCreateOption && !customEmptyAction ? (
                  <div className="px-2 py-8 text-center text-sm text-muted-foreground">{emptyText}</div>
                ) : (
                  filteredOptions.map((option) => {
                    const optionValue = getOptionValue(option);
                    const isSelected = selectedValues.includes(optionValue);
                    const isDisabled = isOptionDisabled(option);
                    const description = getOptionDescription(option);

                    // Full-width option: renderOption owns the entire row (no built-in
                    // check/padding), so a colored option fully paints the row.
                    if (fullWidthOption && renderOption && !isMultiple) {
                      return (
                        <div
                          key={optionValue}
                          role="option"
                          aria-selected={isSelected}
                          tabIndex={isDisabled ? -1 : 0}
                          className={cn(
                            "group w-full overflow-hidden rounded-sm cursor-pointer",
                            isDisabled && "opacity-50 cursor-not-allowed",
                          )}
                          onClick={isDisabled ? undefined : () => handleSelect(optionValue)}
                          onKeyDown={(e) => {
                            if ((e.key === "Enter" || e.key === " ") && !isDisabled) {
                              e.preventDefault();
                              handleSelect(optionValue);
                            }
                          }}
                        >
                          {renderOption(option, isSelected)}
                        </div>
                      );
                    }

                    return (
                      <div
                        key={optionValue}
                        role="option"
                        aria-selected={isSelected}
                        tabIndex={isDisabled ? -1 : 0}
                        className={cn(
                          "group w-full flex items-center px-2 py-2 text-sm rounded-sm cursor-pointer",
                          "hover:bg-accent hover:text-accent-foreground",
                          isDisabled && "opacity-50 cursor-not-allowed",
                          isSelected && !isMultiple && "bg-accent text-accent-foreground",
                        )}
                        onClick={isDisabled ? undefined : () => handleSelect(optionValue)}
                        onKeyDown={(e) => {
                          if ((e.key === "Enter" || e.key === " ") && !isDisabled) {
                            e.preventDefault();
                            handleSelect(optionValue);
                          }
                        }}
                      >
                        {isMultiple ? (
                          <Checkbox checked={isSelected} disabled={isDisabled} className="mr-2" onClick={(e) => e.stopPropagation()} />
                        ) : (
                          <IconCheck className={cn("mr-2 h-4 w-4", isSelected ? "opacity-100" : "opacity-0")} />
                        )}

                        <div className="flex-1 truncate">
                          {renderOption ? (
                            renderOption(option, isSelected)
                          ) : (
                            <div>
                              <div className="truncate">{formatOptionLabel(option)}</div>
                              {description && (
                                <div className={cn(
                                  "text-xs truncate",
                                  isSelected && !isMultiple ? "text-accent-foreground/80" : "text-muted-foreground group-hover:text-accent-foreground/80"
                                )}>
                                  {description}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}

                {/* O fim da lista. `aria-hidden`: é gatilho, não conteúdo. */}
                {async && hasMore && <div ref={sentinelaRef} aria-hidden className="h-px w-full" />}

                {/* O botão continua — rolar é o caminho comum, clicar é o que
                    resta para teclado, leitor de tela e para quem prefere. */}
                {async && hasMore && (
                  <div className="pt-2 pb-1 px-1 border-t dark:border-border/30 mt-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="w-full h-8 justify-center"
                      onClick={(e) => {
                        e.stopPropagation();
                        loadMore();
                      }}
                      disabled={isLoadingMore}
                    >
                      {isLoadingMore ? (
                        <>
                          <IconLoader2 className="h-4 w-4 animate-spin mr-2" />
                          Carregando...
                        </>
                      ) : (
                        <>
                          <IconArrowDown className="h-4 w-4 mr-2" />
                          Carregar mais
                        </>
                      )}
                    </Button>
                  </div>
                )}

                {/* Loading indicator for additional pages */}
                {async && isLoadingMore && currentPage > 1 && (
                  <div className="px-2 py-2 text-center text-sm text-muted-foreground">
                    <IconLoader2 className="h-4 w-4 animate-spin mx-auto" />
                  </div>
                )}
              </div>
            </div>
          </div>
        </PopoverContent>
      </Popover>

      {!hideDefaultBadges && isMultiple && selectedOptions.length > 0 && !singleMode && (
        <div className="flex flex-wrap gap-1 mt-2">
          {selectedOptions.map((option) => {
            const optionValue = getOptionValue(option);
            return (
              <Badge
                key={optionValue}
                variant="secondary"
                className="text-xs group hover:bg-destructive hover:text-destructive-foreground cursor-pointer"
                onClick={() => handleSelect(optionValue)}
              >
                {formatOptionLabel(option)}
                <IconX className="ml-1 h-3 w-3 opacity-50 group-hover:opacity-100" />
              </Badge>
            );
          })}
        </div>
      )}
    </div>
  );
}) as <TData = ComboboxOption>(props: ComboboxProps<TData>) => React.ReactElement;
