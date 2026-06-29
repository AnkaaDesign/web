import React from "react";
import { IconFile } from "@tabler/icons-react";
import { cn } from "@/lib/utils";
import { FileItem, useFileViewer, type FileViewMode } from "@/components/common/file";
import type { Task } from "@/types";
import { getApiBaseUrl } from "@/utils/file";

/** Element type of `task.baseFiles` / `task.projectFiles` (the `@/types` `File`). */
type TaskFile = NonNullable<Task["baseFiles"]>[number];

/**
 * The base + project files visible to the current user (each list privilege-gated) plus their
 * concatenation. Shared by the section body and the page-composed header actions (combined count
 * badge + "Baixar Todos") so both stay in sync.
 */
export function getVisibleTaskFiles(
  task: Task,
  canViewBase: boolean,
  canViewProject: boolean,
): { base: TaskFile[]; project: TaskFile[]; all: TaskFile[] } {
  const base = canViewBase && task.baseFiles ? task.baseFiles : [];
  const project = canViewProject && task.projectFiles ? task.projectFiles : [];
  return { base, project, all: [...base, ...project] };
}

/** Open each file's download endpoint in turn, staggered to avoid popup-blocking. */
export async function downloadAllTaskFiles(files: TaskFile[]): Promise<void> {
  const apiUrl = getApiBaseUrl();
  for (let i = 0; i < files.length; i++) {
    if (files[i].id) window.open(`${apiUrl}/files/${files[i].id}/download`, "_blank");
    if (i < files.length - 1) await new Promise((resolve) => setTimeout(resolve, 200));
  }
}

/**
 * One file group. The group LABEL ("Arquivos Base" / "Projetos") is only shown when more than one
 * group is present (`showTitle`); with a single group the section card title "Arquivos" already names
 * it, so the sub-label would be redundant. The grid/list view mode is controlled by the section header
 * (host-owned `view` prop); count + "Baixar Todos" also live in the section header.
 */
function FileSubsection({
  title,
  showTitle,
  files,
  view,
  onPreview,
  onDownload,
}: {
  title: string;
  showTitle: boolean;
  files: TaskFile[];
  view: FileViewMode;
  onPreview: (file: TaskFile) => void;
  onDownload: (file: TaskFile) => void;
}) {
  return (
    <div>
      {showTitle && (
        <div className="flex items-center gap-2 mb-3">
          <IconFile className="h-4 w-4 text-muted-foreground" />
          <h4 className="text-sm font-semibold">{title}</h4>
        </div>
      )}
      <div className={cn(view === "grid" ? "flex flex-wrap gap-3" : "grid grid-cols-1 gap-2")}>
        {files.map((file) => (
          <FileItem key={file.id} file={file} viewMode={view} onPreview={onPreview} onDownload={onDownload} showActions />
        ))}
      </div>
    </div>
  );
}

/**
 * "Arquivos" card body — bare (the host supplies the Card + title).
 * Renders the base-files and project-files subsections, each privilege-gated.
 * Returns null when there are no visible files at all.
 */
export function FilesSection({ task, canViewBase, canViewProject, view }: { task: Task; canViewBase: boolean; canViewProject: boolean; view: FileViewMode }): React.ReactNode {
  const fileViewer = useFileViewer();

  const { base: baseFiles, project: projectFiles } = getVisibleTaskFiles(task, canViewBase, canViewProject);

  if (baseFiles.length === 0 && projectFiles.length === 0) return null;

  const handleBaseFileClick = (file: TaskFile) => {
    const index = baseFiles.findIndex((f) => f.id === file.id);
    fileViewer.actions.viewFiles(baseFiles, index);
  };

  const handleProjectFileClick = (file: TaskFile) => {
    const index = projectFiles.findIndex((f) => f.id === file.id);
    fileViewer.actions.viewFiles(projectFiles, index);
  };

  const handleDownload = (file: TaskFile) => {
    fileViewer.actions.downloadFile(file);
  };

  const groups = [
    baseFiles.length > 0 ? { key: "base", title: "Arquivos Base", files: baseFiles, onPreview: handleBaseFileClick } : null,
    projectFiles.length > 0 ? { key: "projects", title: "Projetos", files: projectFiles, onPreview: handleProjectFileClick } : null,
  ].filter((g): g is NonNullable<typeof g> => g !== null);
  // Only label the groups when there's more than one — with a single group the "Arquivos" card title
  // already names it, so a "Arquivos Base" sub-label would just be redundant.
  const showTitle = groups.length > 1;

  return (
    <div className="space-y-6">
      {groups.map((g) => (
        <FileSubsection key={g.key} title={g.title} showTitle={showTitle} files={g.files} view={view} onPreview={g.onPreview} onDownload={handleDownload} />
      ))}
    </div>
  );
}
