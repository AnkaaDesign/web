import React from "react";
import { Badge } from "@/components/ui/badge";
import { TABLE_LAYOUT } from "@/components/ui/table-constants";
import { cn } from "@/lib/utils";

export interface CalculationColumn {
  key: string;
  header: string;
  accessor: (row: any) => React.ReactNode;
  sortable: boolean;
  className?: string;
  align?: "left" | "center" | "right";
}

interface CalculationRow {
  id: string;
  date: string;
  entrada1?: string;
  saida1?: string;
  entrada2?: string;
  saida2?: string;
  entrada3?: string;
  saida3?: string;
  normais?: string;
  faltas?: string;
  ex50?: string;
  ex100?: string;
  ex150?: string;
  dsr?: string;
  dsrDeb?: string;
  not?: string;
  exNot?: string;
  ajuste?: string;
  abono2?: string;
  abono3?: string;
  abono4?: string;
  atras?: string;
  adian?: string;
  folga?: string;
  carga?: string;
  justPa?: string;
  tPlusMinus?: string;
  exInt?: string;
  notTot?: string;
  refeicao?: string;
}

// Helper function to render time values with proper formatting
const renderTimeValue = (value: string | undefined) => {
  if (!value || value === "" || value === "null" || value === null) {
    return <span className="text-muted-foreground">-</span>;
  }

  // Handle special values like "Day Off" or folga
  if (value.toLowerCase().includes("day off") || value.toLowerCase().includes("folga")) {
    return (
      <Badge variant="secondary" className="text-xs">
        Folga
      </Badge>
    );
  }

  return <span className="text-sm">{value}</span>;
};

// Helper function to render hour values with styling
const renderHourValue = (value: string | undefined) => {
  if (!value || value === "" || value === "null" || value === null) {
    return <span className="text-muted-foreground">-</span>;
  }

  // Check if it's a positive or negative value for styling
  const isNegative = value.startsWith("-");
  const isPositive = !isNegative && value !== "00:00";

  return (
    <span
      className={`text-sm ${
        isNegative
          ? "text-red-600"
          : isPositive
          ? "text-green-600"
          : "text-muted-foreground"
      }`}
    >
      {value}
    </span>
  );
};

// Helper function to format date
const renderDate = (value: string | undefined) => {
  if (!value) return <span className="text-muted-foreground">-</span>;

  // Parse the date and format as DD/MM/YYYY - Day
  // Input format from Secullum is already DD/MM/YYYY - keep it as is
  const parts = value.split(" - ");
  const formattedDate = parts[0];
  const dayOfWeek = parts[1];

  // Convert day abbreviation to Portuguese proper case
  const dayMap: { [key: string]: string } = {
    "Mon": "Seg",
    "Tue": "Ter",
    "Wed": "Qua",
    "Thu": "Qui",
    "Fri": "Sex",
    "Sat": "Sáb",
    "Sun": "Dom",
    "Monday": "Seg",
    "Tuesday": "Ter",
    "Wednesday": "Qua",
    "Thursday": "Qui",
    "Friday": "Sex",
    "Saturday": "Sáb",
    "Sunday": "Dom",
    "Segunda": "Seg",
    "Terça": "Ter",
    "Quarta": "Qua",
    "Quinta": "Qui",
    "Sexta": "Sex",
    "Sábado": "Sáb",
    "Domingo": "Dom"
  };

  const displayDay = dayOfWeek ? (dayMap[dayOfWeek] || dayOfWeek) : "";
  const displayText = displayDay ? `${formattedDate} - ${displayDay}` : formattedDate;

  return <span className="text-sm whitespace-nowrap">{displayText}</span>;
};

export function createCalculationColumns(): CalculationColumn[] {
  return [
    {
      key: "date",
      header: "DATA",
      accessor: (row: CalculationRow) => renderDate(row.date),
      sortable: true,
      className: cn(TABLE_LAYOUT.firstDataColumn.className, "w-36"),
      align: "left",
    },
    {
      key: "entrada1",
      header: "ENTRADA 1",
      accessor: (row: CalculationRow) => renderTimeValue(row.entrada1),
      sortable: false,
      className: "w-24",
      align: "center",
    },
    {
      key: "saida1",
      header: "SAÍDA 1",
      accessor: (row: CalculationRow) => renderTimeValue(row.saida1),
      sortable: false,
      className: "w-24",
      align: "center",
    },
    {
      key: "entrada2",
      header: "ENTRADA 2",
      accessor: (row: CalculationRow) => renderTimeValue(row.entrada2),
      sortable: false,
      className: "w-24",
      align: "center",
    },
    {
      key: "saida2",
      header: "SAÍDA 2",
      accessor: (row: CalculationRow) => renderTimeValue(row.saida2),
      sortable: false,
      className: "w-24",
      align: "center",
    },
    {
      key: "entrada3",
      header: "ENTRADA 3",
      accessor: (row: CalculationRow) => renderTimeValue(row.entrada3),
      sortable: false,
      className: "w-24",
      align: "center",
    },
    {
      key: "saida3",
      header: "SAÍDA 3",
      accessor: (row: CalculationRow) => renderTimeValue(row.saida3),
      sortable: false,
      className: "w-24",
      align: "center",
    },
    {
      key: "normais",
      header: "NORMAL",
      accessor: (row: CalculationRow) => renderHourValue(row.normais),
      sortable: true,
      className: "w-24",
      align: "center",
    },
    {
      key: "faltas",
      header: "FALTAS",
      accessor: (row: CalculationRow) => renderHourValue(row.faltas),
      sortable: true,
      className: "w-24",
      align: "center",
    },
    {
      key: "ex50",
      header: "EX50%",
      accessor: (row: CalculationRow) => renderHourValue(row.ex50),
      sortable: true,
      className: "w-24",
      align: "center",
    },
    {
      key: "ex100",
      header: "EX100%",
      accessor: (row: CalculationRow) => renderHourValue(row.ex100),
      sortable: true,
      className: "w-24",
      align: "center",
    },
    {
      key: "ex150",
      header: "EX150%",
      accessor: (row: CalculationRow) => renderHourValue(row.ex150),
      sortable: true,
      className: "w-24",
      align: "center",
    },
    {
      key: "dsr",
      header: "DSR",
      accessor: (row: CalculationRow) => renderHourValue(row.dsr),
      sortable: true,
      className: "w-24",
      align: "center",
    },
    {
      key: "dsrDeb",
      header: "DSR.Deb",
      accessor: (row: CalculationRow) => renderHourValue(row.dsrDeb),
      sortable: true,
      className: "w-24",
      align: "center",
    },
    {
      key: "not",
      header: "NOT.",
      accessor: (row: CalculationRow) => renderHourValue(row.not),
      sortable: true,
      className: "w-24",
      align: "center",
    },
    {
      key: "exNot",
      header: "EXNOT",
      accessor: (row: CalculationRow) => renderHourValue(row.exNot),
      sortable: true,
      className: "w-24",
      align: "center",
    },
    {
      key: "ajuste",
      header: "AJUSTE",
      accessor: (row: CalculationRow) => renderHourValue(row.ajuste),
      sortable: true,
      className: "w-24",
      align: "center",
    },
    {
      key: "abono2",
      header: "ABONO2",
      accessor: (row: CalculationRow) => renderHourValue(row.abono2),
      sortable: true,
      className: "w-24",
      align: "center",
    },
    {
      key: "abono3",
      header: "ABONO3",
      accessor: (row: CalculationRow) => renderHourValue(row.abono3),
      sortable: true,
      className: "w-24",
      align: "center",
    },
    {
      key: "abono4",
      header: "ABONO4",
      accessor: (row: CalculationRow) => renderHourValue(row.abono4),
      sortable: true,
      className: "w-24",
      align: "center",
    },
    {
      key: "atras",
      header: "ATRASO",
      accessor: (row: CalculationRow) => renderHourValue(row.atras),
      sortable: true,
      className: "w-24",
      align: "center",
    },
    {
      key: "adian",
      header: "ADIANT.",
      accessor: (row: CalculationRow) => renderHourValue(row.adian),
      sortable: true,
      className: "w-24",
      align: "center",
    },
    {
      key: "folga",
      header: "FOLGA",
      accessor: (row: CalculationRow) => renderHourValue(row.folga),
      sortable: true,
      className: "w-24",
      align: "center",
    },
    {
      key: "carga",
      header: "CARGA",
      accessor: (row: CalculationRow) => renderHourValue(row.carga),
      sortable: true,
      className: "w-24",
      align: "center",
    },
    {
      key: "justPa",
      header: "JUSTPA.",
      accessor: (row: CalculationRow) => renderTimeValue(row.justPa),
      sortable: false,
      className: "w-24",
      align: "center",
    },
    {
      key: "tPlusMinus",
      header: "T+/-",
      accessor: (row: CalculationRow) => renderHourValue(row.tPlusMinus),
      sortable: true,
      className: "w-24",
      align: "center",
    },
    {
      key: "exInt",
      header: "EXINT",
      accessor: (row: CalculationRow) => renderHourValue(row.exInt),
      sortable: true,
      className: "w-24",
      align: "center",
    },
    {
      key: "notTot",
      header: "NOT.TOT.",
      accessor: (row: CalculationRow) => renderHourValue(row.notTot),
      sortable: true,
      className: "w-24",
      align: "center",
    },
    {
      key: "refeicao",
      header: "REFEIÇÃO",
      accessor: (row: CalculationRow) => {
        const value = row.refeicao;
        if (!value || value === "" || value === "0") {
          return <span className="text-muted-foreground">-</span>;
        }
        return <span className="text-sm">{value}</span>;
      },
      sortable: true,
      className: "w-24",
      align: "center",
    },
  ];
}