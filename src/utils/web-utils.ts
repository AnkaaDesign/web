// Browser-specific utilities for the web app

// =====================
// File Download Helper
// =====================

export const downloadFile = async (
  url: string,
  filename?: string,
  options: {
    method?: "GET" | "POST";
    headers?: Record<string, string>;
    body?: any;
    onProgress?: (progress: number) => void;
  } = {},
): Promise<void> => {
  const { method = "GET", headers = {}, body, onProgress } = options;

  try {
    const response = await fetch(url, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...headers,
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      throw new Error(`Erro no download: ${response.status} ${response.statusText}`);
    }

    const contentLength = response.headers.get("Content-Length");
    const total = contentLength ? parseInt(contentLength, 10) : 0;
    let loaded = 0;

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error("Não foi possível iniciar o download");
    }

    const chunks: Uint8Array[] = [];

    while (true) {
      const { done, value } = await reader.read();

      if (done) break;

      chunks.push(value);
      loaded += value.length;

      if (onProgress && total > 0) {
        onProgress((loaded / total) * 100);
      }
    }

    const blob = new Blob(chunks as BlobPart[]);
    const downloadUrl = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = downloadUrl;
    link.download = filename || "download";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    URL.revokeObjectURL(downloadUrl);
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') {
      console.error("Erro no download do arquivo:", error);
    }
    throw new Error("Falha no download do arquivo");
  }
};
