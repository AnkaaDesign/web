import { useCallback, useEffect, useRef } from "react";

interface UseInfiniteScrollProps {
  hasNextPage?: boolean;
  fetchNextPage: () => void;
  isFetchingNextPage?: boolean;
}

interface UseInfiniteScrollReturn {
  lastElementRef: (node: HTMLElement | null) => void;
}

export function useInfiniteScroll({ hasNextPage, fetchNextPage, isFetchingNextPage }: UseInfiniteScrollProps): UseInfiniteScrollReturn {
  const observer = useRef<IntersectionObserver | null>(null);

  const lastElementRef = useCallback(
    (node: HTMLElement | null) => {
      if (isFetchingNextPage) return;
      if (observer.current) observer.current.disconnect();

      observer.current = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting && hasNextPage) {
          fetchNextPage();
        }
      });

      if (node) observer.current.observe(node);
    },
    [isFetchingNextPage, fetchNextPage, hasNextPage],
  );

  // Cleanup observer on unmount
  useEffect(() => {
    return () => {
      if (observer.current) {
        observer.current.disconnect();
      }
    };
  }, []);

  return { lastElementRef };
}
