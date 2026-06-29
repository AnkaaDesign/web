import { ItemDetailPage } from "@/components/inventory/item/detail-page";

// Item (Produto) detail page, migrated onto the generic DetailPage base system. The
// PrivilegeRoute (WAREHOUSE) and usePageTracker live inside ItemDetailPage.
const ProductDetailsPage = () => {
  return <ItemDetailPage />;
};

export default ProductDetailsPage;
