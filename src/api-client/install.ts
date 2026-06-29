import { apiClient } from "./axiosClient";
import { getApiBaseUrl } from "@/config/api";

// ---------------------------------------------------------------------------
// Self-hosted native app distribution (mirrors api `system/install` module).
//   GET  /install/version          -> current published build per platform
//   GET  /install/history          -> superseded builds (ADMIN)
//   GET  /install/archive/:id      -> download an archived build (ADMIN)
//   POST /install/publish/{ios,android} -> ADMIN multipart upload
// ---------------------------------------------------------------------------

export type InstallPlatform = "ios" | "android";

export interface PlatformVersionInfo {
  version: string | null;
  build: string | null;
  sizeBytes: number;
  uploadedAt: string | null;
  available: boolean;
}

export interface InstallVersionResponse {
  ios: PlatformVersionInfo;
  android: PlatformVersionInfo;
}

export interface InstallHistoryEntry {
  id: string;
  platform: InstallPlatform;
  version: string;
  build: string;
  uploadedAt: string;
  sizeBytes: number;
  filename: string;
}

export interface PublishInstallInput {
  platform: InstallPlatform;
  file: File;
  version: string;
  build: string;
  onProgress?: (percent: number) => void;
}

export const installService = {
  async getVersion(): Promise<InstallVersionResponse> {
    const response = await apiClient.get<InstallVersionResponse>("/install/version");
    return response.data;
  },

  async getHistory(): Promise<InstallHistoryEntry[]> {
    const response = await apiClient.get<{ data: InstallHistoryEntry[] }>("/install/history");
    return response.data.data ?? [];
  },

  async publish({ platform, file, version, build, onProgress }: PublishInstallInput) {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("version", version);
    formData.append("build", build);

    const response = await apiClient.post(`/install/publish/${platform}`, formData, {
      headers: { "Content-Type": "multipart/form-data" },
      // Large binaries (50-300MB) — never time out the upload.
      timeout: 0,
      onUploadProgress: (event) => {
        if (onProgress && event.total) {
          onProgress(Math.min(100, Math.round((event.loaded / event.total) * 100)));
        }
      },
    });
    return response.data;
  },

  async downloadArchive(id: string): Promise<Blob> {
    const response = await apiClient.get(`/install/archive/${id}`, { responseType: "blob" });
    return response.data as Blob;
  },
};

/** Absolute public URLs used by the install page / QR codes (no auth). */
export const installUrls = {
  apk: () => `${getApiBaseUrl()}/install/android/app.apk`,
  ipa: () => `${getApiBaseUrl()}/install/ios/app.ipa`,
  manifest: () => `${getApiBaseUrl()}/install/manifest.plist`,
  iosOtaInstall: () =>
    `itms-services://?action=download-manifest&url=${getApiBaseUrl()}/install/manifest.plist`,
};
