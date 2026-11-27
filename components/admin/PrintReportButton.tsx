"use client";

import { Icon } from "@/components/member/icons";
import { buttonClass } from "@/components/ui/styles";

export function PrintReportButton() {
  return (
    <button type="button" onClick={() => window.print()} className={buttonClass("primary")}>
      <Icon name="printer" className="h-4 w-4" />
      Print or save as PDF
    </button>
  );
}
