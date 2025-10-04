import { usePageTracker } from "@/hooks/use-page-tracker";
import { UnderConstruction } from "@/components/navigation/under-construction";

export function MyProfilePage() {
  // Track page access
  usePageTracker({
    title: "Meu Perfil",
    icon: "user",
  });

  return <UnderConstruction title="Meu Perfil" />;
}
