/**
 * Centralized backup path presets for the backup management system.
 *
 * These paths represent server-side directories that the backup system
 * will include when creating system-level backups. They are sent to the
 * API as parameters for backup creation.
 *
 * NOTE: Ideally these would come from the API (the server knows its own
 * filesystem layout). This config centralizes them in one place until
 * that API endpoint is implemented.
 *
 * The APP_ROOT env var (VITE_APP_ROOT) allows configuring the application
 * root directory without hardcoding a specific user's home path.
 */

const APP_ROOT = import.meta.env.VITE_APP_ROOT || "/home/kennedy/ankaa";

/**
 * Preset path options for system backup configuration UI.
 * Each priority level includes a set of server directories to back up.
 */
export const BACKUP_PRESET_PATH_OPTIONS: Array<{
  value: string;
  label: string;
  paths: string[];
}> = [
  {
    value: "critical",
    label: "Criticos (Configs principais)",
    paths: ["/etc/nginx", "/etc/ssl", `${APP_ROOT}/.env`, `${APP_ROOT}/apps/api/.env`],
  },
  {
    value: "high",
    label: "Alta prioridade (Sistema completo)",
    paths: ["/etc/nginx", "/etc/ssl", "/etc/samba", "/etc/systemd/system", "/var/www"],
  },
  {
    value: "medium",
    label: "Media prioridade (Logs, www)",
    paths: ["/var/log/nginx", "/var/www"],
  },
  {
    value: "low",
    label: "Baixa prioridade (Temporarios)",
    paths: ["/tmp"],
  },
];

/**
 * Priority-based path map for the API client's getPathsByPriority method.
 * Each priority level accumulates paths from higher priorities.
 */
export const BACKUP_PRIORITY_PATH_MAP: Record<string, string[]> = {
  critical: [APP_ROOT, `${APP_ROOT}/.env`, `${APP_ROOT}/apps/api/.env`],
  high: [
    `${APP_ROOT}/apps`,
    `${APP_ROOT}/packages`,
    `${APP_ROOT}/scripts`,
    "/etc/nginx",
    "/etc/ssl",
  ],
  medium: [
    `${APP_ROOT}/docs`,
    `${APP_ROOT}/test-examples`,
    "/var/log/nginx",
    "/var/www",
  ],
  low: [`${APP_ROOT}/node_modules`, `${APP_ROOT}/.git`, "/tmp"],
};
