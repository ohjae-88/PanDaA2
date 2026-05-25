"use client";

import { useState } from "react";
import { Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { UnifiedDialog } from "./unified-dialog";

export function UnifiedButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="ghost" size="sm" onClick={() => setOpen(true)} title="통합 저장 / 불러오기">
        <Save className="h-4 w-4" /> 통합 저장/불러오기
      </Button>
      <UnifiedDialog open={open} onClose={() => setOpen(false)} />
    </>
  );
}
