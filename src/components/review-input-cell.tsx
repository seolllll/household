"use client";

import { useState } from "react";
import { cn } from "cn";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

interface ReviewInputCellProps {
  value: string;
  onChange: (value: string) => void;
  onBlur: () => void;
  /** true면 평소엔 말줄임표로 표시하고 클릭 시 여러 줄 입력(Textarea)으로 확장 (피드백용). */
  expandable?: boolean;
}

/** 오차원인/피드백 입력칸: 값이 채워지면 테두리를 숨겨 텍스트처럼 보이게 하고, 포커스 중엔 다시 테두리를 보여준다. */
export function ReviewInputCell({ value, onChange, onBlur, expandable }: ReviewInputCellProps) {
  const [editing, setEditing] = useState(false);
  const borderless = value !== "" && !editing;

  if (expandable && editing) {
    return (
      <Textarea
        autoFocus
        rows={3}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={() => {
          setEditing(false);
          onBlur();
        }}
        className="w-full text-sm"
      />
    );
  }

  return (
    <Input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onFocus={() => setEditing(true)}
      onBlur={() => {
        if (!expandable) setEditing(false);
        onBlur();
      }}
      className={cn("w-full", expandable && "truncate", borderless && "border-transparent")}
    />
  );
}
