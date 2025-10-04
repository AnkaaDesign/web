// packages/hooks/src/usePrice.ts

import { useQuery } from "@tanstack/react-query";
import { createEntityHooks } from "./createEntityHooks";
import { priceQueryKeys } from "./queryKeys";
import { itemPriceService } from "../api-client";
import type { PriceGetManyFormData, PriceCreateFormData, PriceUpdateFormData, PriceBatchCreateFormData, PriceBatchUpdateFormData, PriceBatchDeleteFormData } from "../schemas";
import type {
  Price,
  PriceGetManyResponse,
  PriceGetUniqueResponse,
  PriceCreateResponse,
  PriceUpdateResponse,
  PriceDeleteResponse,
  PriceBatchCreateResponse,
  PriceBatchUpdateResponse,
  PriceBatchDeleteResponse,
} from "../types";

// =====================
// Price Hooks
// =====================

export const priceHooks = createEntityHooks<
  PriceGetManyFormData,
  PriceGetManyResponse,
  PriceGetUniqueResponse,
  PriceCreateFormData,
  PriceCreateResponse,
  PriceUpdateFormData,
  PriceUpdateResponse,
  PriceDeleteResponse,
  PriceBatchCreateFormData,
  PriceBatchCreateResponse<Price>,
  PriceBatchUpdateFormData,
  PriceBatchUpdateResponse<Price>,
  PriceBatchDeleteFormData,
  PriceBatchDeleteResponse
>({
  queryKeys: priceQueryKeys,
  service: {
    getMany: itemPriceService.getItemPrices.bind(itemPriceService),
    getById: itemPriceService.getItemPriceById.bind(itemPriceService),
    create: itemPriceService.createItemPrice.bind(itemPriceService),
    update: itemPriceService.updateItemPrice.bind(itemPriceService),
    delete: itemPriceService.deleteItemPrice.bind(itemPriceService),
    batchCreate: itemPriceService.batchCreateItemPrices.bind(itemPriceService),
    batchUpdate: itemPriceService.batchUpdateItemPrices.bind(itemPriceService),
    batchDelete: itemPriceService.batchDeleteItemPrices.bind(itemPriceService),
  },
  relatedQueryKeys: [],
});

// =====================
// Individual Hooks
// =====================

export const {
  useInfiniteList: useInfinitePriceList,
  useList: usePriceList,
  useDetail: usePriceDetail,
  useMutations: usePriceMutations,
  useBatchMutations: usePriceBatchMutations,
} = priceHooks;

// =====================
// Special Price Hooks
// =====================

export const useLatestPriceByItemId = (itemId: string) => {
  return useQuery({
    queryKey: priceQueryKeys.latestByItem(itemId),
    queryFn: () => itemPriceService.getLatestPriceByItemId(itemId),
    enabled: !!itemId,
  });
};

export const usePriceHistory = (itemId: string, limit?: number) => {
  return useQuery({
    queryKey: priceQueryKeys.historyByItem(itemId, limit),
    queryFn: () => itemPriceService.getPriceHistory(itemId, limit),
    enabled: !!itemId,
  });
};
