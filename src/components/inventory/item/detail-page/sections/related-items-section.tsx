import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { IconPackage, IconChevronRight } from "@tabler/icons-react";
import type { Item } from "../../../../../types";
import { Link } from "react-router-dom";
import { routes } from "../../../../../constants";

/** Number of related items (the section is hidden when this is 0). */
export function relatedItemsCount(item: Item): number {
  return (item.relatedItems || []).length + (item.relatedTo || []).length;
}

/** Body of the legacy RelatedItemsCard (without the outer Card chrome) — the DetailPage section
 *  provides the title. A horizontally-scrolling row of related-product cards. */
export function RelatedItemsSection({ item }: { item: Item }) {
  const relatedItems = item.relatedItems || [];
  const relatedTo = item.relatedTo || [];
  const allRelated = [...relatedItems, ...relatedTo];

  // No related products → return null so the base drops the whole "Produtos Relacionados" card.
  if (allRelated.length === 0) {
    return null;
  }

  return (
    <div className="relative">
      <div className="overflow-x-auto pb-4">
        <div className="flex gap-4 w-max">
          {allRelated.map((relatedItem) => (
            <Link key={relatedItem.id} to={routes.inventory.products.details(relatedItem.id)} className="block">
              <Card className="w-64 h-32 hover:shadow-sm transition-all duration-300 cursor-pointer border-border">
                <CardContent className="p-4 h-full flex flex-col justify-between">
                  {/* Top Section */}
                  <div className="space-y-1">
                    <div className="flex items-start justify-between gap-2">
                      <h4 className="font-medium text-sm line-clamp-1 flex-1">{relatedItem.name}</h4>
                      <Badge variant={relatedItem.isActive ? "default" : "secondary"} className="text-xs px-1.5 py-0 h-5">
                        {relatedItem.isActive ? "Ativo" : "Inativo"}
                      </Badge>
                    </div>
                    {((relatedItem.brands && relatedItem.brands.length > 0) || relatedItem.category) && (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        {relatedItem.brands && relatedItem.brands.length > 0 && <span className="truncate">{relatedItem.brands.map((b) => b.name).join(", ")}</span>}
                        {relatedItem.brands && relatedItem.brands.length > 0 && relatedItem.category && <span className="font-enhanced-unicode">•</span>}
                        {relatedItem.category && <span className="truncate">{relatedItem.category.name}</span>}
                      </div>
                    )}
                  </div>

                  {/* Bottom Section */}
                  <div className="flex items-end justify-between">
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <IconPackage className="h-3.5 w-3.5" />
                      <span className="text-xs font-medium">{relatedItem.quantity} un</span>
                    </div>
                    <IconChevronRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>

      {allRelated.length > 3 && <div className="absolute right-0 top-0 bottom-4 w-20 bg-gradient-to-l from-background to-transparent pointer-events-none" />}
    </div>
  );
}
