import * as React from "react";

import { cn } from "@/lib/utils";

const Table = React.forwardRef<HTMLTableElement, React.HTMLAttributes<HTMLTableElement>>(({ className, ...props }, ref) => {
  const isNoWrapper = className?.includes("[&>div]:border-0");

  if (isNoWrapper) {
    return <table ref={ref} className={cn("w-full caption-bottom text-sm border-collapse", className)} {...props} />;
  }

  return (
    <div className="relative w-full overflow-auto">
      <table ref={ref} className={cn("w-full caption-bottom text-sm border-collapse", className)} {...props} />
    </div>
  );
});
Table.displayName = "Table";

const TableHeader = React.forwardRef<HTMLTableSectionElement, React.HTMLAttributes<HTMLTableSectionElement>>(({ className, ...props }, ref) => (
  <thead ref={ref} className={cn("[&_tr]:border-b-0 [&_tr]:bg-muted [&_tr]:hover:bg-muted", className)} {...props} />
));
TableHeader.displayName = "TableHeader";

const TableBody = React.forwardRef<HTMLTableSectionElement, React.HTMLAttributes<HTMLTableSectionElement>>(({ className, ...props }, ref) => (
  <tbody ref={ref} className={cn("", className)} {...props} />
));
TableBody.displayName = "TableBody";

const TableFooter = React.forwardRef<HTMLTableSectionElement, React.HTMLAttributes<HTMLTableSectionElement>>(({ className, ...props }, ref) => (
  <tfoot ref={ref} className={cn("border-t border-border bg-muted/50 font-medium [&>tr]:last:border-b-0", className)} {...props} />
));
TableFooter.displayName = "TableFooter";

const TableRow = React.forwardRef<HTMLTableRowElement, React.HTMLAttributes<HTMLTableRowElement>>(({ className, ...props }, ref) => (
  <tr
    ref={ref}
    className={cn(
      "border-b border-border transition-colors",
      "[tbody_&:nth-child(odd)]:bg-transparent",
      "[tbody_&:nth-child(even)]:bg-muted/50",
      "[tbody_&]:hover:bg-muted/70",
      "data-[state=selected]:bg-muted/80 data-[state=selected]:hover:bg-muted/90",
      className,
    )}
    {...props}
  />
));
TableRow.displayName = "TableRow";

const TableHead = React.forwardRef<HTMLTableCellElement, React.ThHTMLAttributes<HTMLTableCellElement>>(({ className, ...props }, ref) => (
  <th
    ref={ref}
    className={cn(
      "h-10 px-4 text-left align-middle font-bold uppercase text-xs text-foreground bg-muted",
      "[&:has([role=checkbox])]:pr-0 [&:has([role=checkbox])]:pl-0 [&:has([role=checkbox])]:w-12 [&:has([role=checkbox])]:min-w-12 [&:has([role=checkbox])]:max-w-12",
      "!border-r-0",
      className,
    )}
    {...props}
  />
));
TableHead.displayName = "TableHead";

const TableCell = React.forwardRef<HTMLTableCellElement, React.TdHTMLAttributes<HTMLTableCellElement>>(({ className, ...props }, ref) => (
  <td
    ref={ref}
    className={cn(
      "p-4 align-middle",
      "[&:has([role=checkbox])]:pr-0 [&:has([role=checkbox])]:pl-0 [&:has([role=checkbox])]:w-12 [&:has([role=checkbox])]:min-w-12 [&:has([role=checkbox])]:max-w-12",
      "!border-r-0",
      className,
    )}
    {...props}
  />
));
TableCell.displayName = "TableCell";

const TableCaption = React.forwardRef<HTMLTableCaptionElement, React.HTMLAttributes<HTMLTableCaptionElement>>(({ className, ...props }, ref) => (
  <caption ref={ref} className={cn("mt-4 text-sm text-muted-foreground", className)} {...props} />
));
TableCaption.displayName = "TableCaption";

export { Table, TableHeader, TableBody, TableFooter, TableHead, TableRow, TableCell, TableCaption };
