import { PageHeader } from "@/components/ui/page-header";
import { IconPlus, IconBeach, IconUsersGroup } from "@tabler/icons-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { VacationList } from "@/components/personnel-department/vacation/list";
import { VacationGroupList } from "@/components/personnel-department/vacation-group/list/vacation-group-list";
import { PrivilegeRoute } from "@/components/navigation/privilege-route";
import { FAVORITE_PAGES, routes, SECTOR_PRIVILEGES } from "../../../constants";
import { usePageTracker } from "@/hooks/common/use-page-tracker";
import { useNavigate } from "react-router-dom";

const VacationListPage = () => {
  usePageTracker({ title: "Férias", icon: "vacation" });
  const navigate = useNavigate();

  return (
    <PrivilegeRoute requiredPrivilege={[SECTOR_PRIVILEGES.ACCOUNTING, SECTOR_PRIVILEGES.HUMAN_RESOURCES, SECTOR_PRIVILEGES.ADMIN]}>
      <div className="h-full flex flex-col gap-4 bg-background px-4 pt-4">
        <PageHeader
          variant="list"
          title="Férias"
          favoritePage={FAVORITE_PAGES.RECURSOS_HUMANOS_FERIAS_LISTAR}
          breadcrumbs={[{ label: "Início", href: "/" }, { label: "Departamento Pessoal" }, { label: "Férias" }]}
          actions={[
            {
              key: "create",
              label: "Novas Férias",
              icon: IconPlus,
              onClick: () => navigate(routes.personnelDepartment.vacations.create),
              variant: "default" as const,
            },
          ]}
          className="flex-shrink-0"
        />
        <Tabs defaultValue="individuais" className="flex-1 min-h-0 pb-6 flex flex-col gap-4">
          <TabsList className="flex-shrink-0 self-start">
            <TabsTrigger value="individuais" className="gap-2">
              <IconBeach className="h-4 w-4" /> Individuais
            </TabsTrigger>
            <TabsTrigger value="coletivas" className="gap-2">
              <IconUsersGroup className="h-4 w-4" /> Coletivas
            </TabsTrigger>
          </TabsList>
          <TabsContent value="individuais" className="flex-1 min-h-0 flex flex-col mt-0">
            <VacationList className="h-full" />
          </TabsContent>
          <TabsContent value="coletivas" className="flex-1 min-h-0 flex flex-col mt-0">
            <VacationGroupList className="h-full" />
          </TabsContent>
        </Tabs>
      </div>
    </PrivilegeRoute>
  );
};

export default VacationListPage;
