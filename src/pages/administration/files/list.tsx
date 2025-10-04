import { PageHeader } from "@/components/ui/page-header";
import { IconFileText } from "@tabler/icons-react";
import { FileList } from "@/components/file/file-list";
import { FAVORITE_PAGES } from "../../../constants";

export const FileListPage = () => {
  return (
    <div className="space-y-6">
      <PageHeader
        variant="list"
        title="Arquivos"
        icon={IconFileText}
        favoritePage={FAVORITE_PAGES.ADMINISTRACAO_ARQUIVOS_LISTAR}
        breadcrumbs={[{ label: "Início", href: "/" }, { label: "Administração", href: "/administracao" }, { label: "Arquivos" }]}
      />
      <FileList />
    </div>
  );
};
