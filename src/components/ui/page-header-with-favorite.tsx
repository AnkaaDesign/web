import { PageHeader as BasePageHeader } from "./page-header";
import type { BaseEntity } from "./page-header";

// PageHeader now simply passes through to PageHeader
// since PageHeader now has favoritePage support built-in
export function PageHeader<T extends BaseEntity = BaseEntity>(props: Parameters<typeof BasePageHeader<T>>[0]) {
  // Simply pass all props through to PageHeader
  return <BasePageHeader {...props} />;
}
