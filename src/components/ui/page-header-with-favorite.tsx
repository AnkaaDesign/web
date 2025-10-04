import { PageHeader } from "./page-header";
import type { BaseEntity } from "./page-header";

// PageHeaderWithFavorite now simply passes through to PageHeader
// since PageHeader now has favoritePage support built-in
export function PageHeaderWithFavorite<T extends BaseEntity = BaseEntity>(props: Parameters<typeof PageHeader<T>>[0]) {
  // Simply pass all props through to PageHeader
  return <PageHeader {...props} />;
}
