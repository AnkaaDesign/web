import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { IconClipboardList, IconLoader2, IconCheck } from "@tabler/icons-react";

import { routes, SECTOR_PRIVILEGES } from "../../../constants";
import type { Topic, TopicBatchUpdateFormData } from "../../../types";
import { useTopics, useTopicBatchMutations, useSkills } from "../../../hooks";

import { PrivilegeRoute } from "@/components/navigation/privilege-route";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Combobox } from "@/components/ui/combobox";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { usePageTracker } from "@/hooks/common/use-page-tracker";
import { toast } from "@/components/ui/sonner";

type Row = {
  id: string;
  title: string;
  skillId: string;
  order: number;
  isActive: boolean;
  dirty: boolean;
};

export const TopicBatchEditPage = () => {
  usePageTracker({ title: "Editar Tópicos em Lote", icon: "clipboard-list" });
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const filterIds = useMemo(() => searchParams.get("ids")?.split(",").filter(Boolean) ?? null, [searchParams]);

  const { data, isLoading } = useTopics({
    limit: 500,
    orderBy: [{ skillId: "asc" }, { order: "asc" }],
    include: { skill: true } as any,
    ...(filterIds ? { where: { id: { in: filterIds } } } : {}),
  } as any);

  const { data: skillsData } = useSkills({ limit: 200, isActive: true, orderBy: { order: "asc" } });
  const skillOptions = useMemo(
    () =>
      (skillsData?.data ?? []).map((s) => ({
        value: s.id,
        label: s.name,
      })),
    [skillsData],
  );

  const initialRows = useMemo<Row[]>(
    () =>
      (data?.data ?? []).map((t: Topic) => ({
        id: t.id,
        title: t.title,
        skillId: t.skillId,
        order: t.order,
        isActive: t.isActive,
        dirty: false,
      })),
    [data],
  );

  const [rows, setRows] = useState<Row[]>([]);
  if (rows.length === 0 && initialRows.length > 0) setRows(initialRows);

  const { batchUpdateAsync, batchUpdateMutation } = useTopicBatchMutations();
  const dirtyCount = rows.filter((r) => r.dirty).length;

  const update = (id: string, patch: Partial<Row>) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch, dirty: true } : r)));
  };

  const handleSave = async () => {
    const dirty = rows.filter((r) => r.dirty);
    if (dirty.length === 0) {
      toast.info("Nenhuma alteração para salvar");
      return;
    }
    const payload: TopicBatchUpdateFormData = {
      topics: dirty.map((r) => ({
        id: r.id,
        data: { title: r.title, skillId: r.skillId, order: r.order, isActive: r.isActive },
      })),
    };
    try {
      const res = await batchUpdateAsync(payload);
      toast.success(`${res?.data?.totalSuccess ?? dirty.length} tópico(s) atualizado(s)`);
      navigate(routes.administration.topic.root);
    } catch (err) {
      toast.error("Erro ao salvar em lote");
      if (process.env.NODE_ENV !== "production") console.error(err);
    }
  };

  return (
    <PrivilegeRoute requiredPrivilege={[SECTOR_PRIVILEGES.ADMIN, SECTOR_PRIVILEGES.HUMAN_RESOURCES, SECTOR_PRIVILEGES.PRODUCTION_MANAGER]}>
      <div className="h-full flex flex-col gap-4 bg-background px-4 pt-4">
        <PageHeader
          title="Editar Tópicos em Lote"
          icon={IconClipboardList}
          breadcrumbs={[
            { label: "Início", href: routes.home },
            { label: "Administração" },
            { label: "Tópicos", href: routes.administration.topic.root },
            { label: "Editar em lote" },
          ]}
          actions={[
            {
              key: "cancel",
              label: "Cancelar",
              onClick: () => navigate(routes.administration.topic.root),
              variant: "outline" as const,
            },
            {
              key: "save",
              label: `Salvar (${dirtyCount})`,
              icon: IconCheck,
              onClick: handleSave,
              variant: "default" as const,
              disabled: dirtyCount === 0,
              loading: batchUpdateMutation.isPending,
            },
          ]}
          className="flex-shrink-0"
        />

        <div className="flex-1 overflow-y-auto pb-6">
          <Card>
            <CardHeader>
              <CardTitle>{rows.length} tópico(s) carregados</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex items-center justify-center py-10">
                  <IconLoader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Título</TableHead>
                      <TableHead className="w-72">Competência</TableHead>
                      <TableHead className="w-24">Ordem</TableHead>
                      <TableHead className="w-24 text-center">Ativo</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((r) => (
                      <TableRow key={r.id} className={r.dirty ? "bg-accent/30" : ""}>
                        <TableCell>
                          <Input
                            value={r.title}
                            onChange={(value) => update(r.id, { title: (value as string) ?? "" })}
                            transparent
                          />
                        </TableCell>
                        <TableCell>
                          <Combobox
                            value={r.skillId}
                            onValueChange={(v) => update(r.id, { skillId: (v as string) ?? r.skillId })}
                            options={skillOptions}
                            searchable
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            value={r.order}
                            onChange={(value) => update(r.id, { order: Number(value) || 0 })}
                            transparent
                          />
                        </TableCell>
                        <TableCell className="text-center">
                          <Switch
                            checked={r.isActive}
                            onCheckedChange={(v) => update(r.id, { isActive: v })}
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </PrivilegeRoute>
  );
};

export default TopicBatchEditPage;
