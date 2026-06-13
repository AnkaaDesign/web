import type { ReactNode } from "react";
import type { MedicalExam } from "@/types/medical-exam";

export interface MedicalExamColumn {
  key: string;
  header: string;
  accessor: (exam: MedicalExam) => ReactNode;
  sortable?: boolean;
  className?: string;
  align?: "left" | "center" | "right";
}
