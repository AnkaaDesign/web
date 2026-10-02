import { apiClient } from "./axiosClient";

// Truck-body label sheets: the API renders the sheet and prints it on the office Epson itself,
// with the photo-paper settings fixed server-side (see api task-label module).

export interface LabelPrinterStatus {
  /** reachable and able to take a sheet right now */
  ready: boolean;
  state: "idle" | "processing" | "stopped" | "unreachable";
  model: string | null;
  /** pt-BR, translated from the printer's own reasons (paper, ink, cover…) */
  messages: string[];
}

export interface LabelPrintJobStatus {
  jobId: number;
  state: "pending" | "held" | "processing" | "stopped" | "canceled" | "aborted" | "completed" | "unknown";
  done: boolean;
  success: boolean;
  messages: string[];
}

/** The sheet loaded in the printer — shared by every user: which slots were already printed. */
export interface LabelSheet {
  /** changes when someone starts a new sheet */
  sheetId: string;
  startedAt: string;
  usedSlots: number[];
  updatedAt: string;
}

interface Envelope<T> {
  success: boolean;
  message: string;
  data: T;
}

// polling and the print itself report inline in the dialog: no success toasts
const quiet = { metadata: { suppressToast: true } } as Record<string, unknown>;

export const taskLabelService = {
  async getPrinterStatus(): Promise<LabelPrinterStatus> {
    const res = await apiClient.get<Envelope<LabelPrinterStatus>>("/task-labels/printer", quiet);
    return res.data.data;
  },
  async print(labels: { slot: number; taskId: string }[]): Promise<{ jobId: number }> {
    const res = await apiClient.post<Envelope<{ jobId: number }>>("/task-labels/print", { labels }, quiet);
    return res.data.data;
  },
  async getSheet(): Promise<LabelSheet> {
    const res = await apiClient.get<Envelope<LabelSheet>>("/task-labels/sheet", quiet);
    return res.data.data;
  },
  async startNewSheet(): Promise<LabelSheet> {
    const res = await apiClient.post<Envelope<LabelSheet>>("/task-labels/sheet/new", {}, quiet);
    return res.data.data;
  },
  async releaseSlots(slots: number[]): Promise<LabelSheet> {
    const res = await apiClient.post<Envelope<LabelSheet>>("/task-labels/sheet/release", { slots }, quiet);
    return res.data.data;
  },
  async getJob(jobId: number): Promise<LabelPrintJobStatus> {
    const res = await apiClient.get<Envelope<LabelPrintJobStatus>>(`/task-labels/jobs/${jobId}`, quiet);
    return res.data.data;
  },
};
