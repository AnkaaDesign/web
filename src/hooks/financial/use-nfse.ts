import { useQuery } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { nfseService } from '@/api-client/nfse';

export const nfseKeys = {
  all: ['nfse'] as const,
  list: (filters: any) => ['nfse', 'list', filters] as const,
  detail: (id: number) => ['nfse', 'detail', id] as const,
  pdf: (id: number) => ['nfse', 'pdf', id] as const,
};

export function useNfseList(filters: {
  dataEmissaoInicial?: string;
  dataEmissaoFinal?: string;
  situacao?: number;
  numeroDocumentoInicial?: number;
  numeroDocumentoFinal?: number;
  page?: number;
  limit?: number;
}) {
  return useQuery({
    queryKey: nfseKeys.list(filters),
    queryFn: () => nfseService.list(filters),
  });
}

export function useNfseDetail(elotechNfseId: number) {
  return useQuery({
    queryKey: nfseKeys.detail(elotechNfseId),
    queryFn: () => nfseService.detail(elotechNfseId),
    enabled: !!elotechNfseId,
  });
}

/**
 * Fetches the NFSe PDF via authenticated API client and returns a blob URL.
 * This avoids the auth issue with direct URL access (pdfjs / window.open).
 */
export function useNfsePdfBlob(elotechNfseId: number) {
  const blobUrlRef = useRef<string | null>(null);

  const query = useQuery({
    queryKey: nfseKeys.pdf(elotechNfseId),
    queryFn: async () => {
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = null;
      }
      const response = await nfseService.getPdf(elotechNfseId);
      const blob = response.data instanceof Blob
        ? response.data
        : new Blob([response.data], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      blobUrlRef.current = url;
      return url;
    },
    enabled: !!elotechNfseId,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    return () => {
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = null;
      }
    };
  }, []);

  return query;
}
