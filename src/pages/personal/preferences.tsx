import { usePageTracker } from "@/hooks/use-page-tracker";
import { UnderConstruction } from "@/components/navigation/under-construction";

export function PreferencesPage() {
  // Track page access
  usePageTracker({
    title: "Preferências",
    icon: "settings",
  });

  return <UnderConstruction title="Preferências" />;
}
