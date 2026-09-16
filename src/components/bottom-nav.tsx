"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3Icon,
  CalendarIcon,
  CalendarRangeIcon,
  NotebookPenIcon,
  PiggyBankIcon,
  ReceiptIcon,
} from "lucide-react";
import { cn } from "cn";
import { encodeMonthParam } from "@/lib/date-range";

function currentMonthHref(base: string) {
  const now = new Date();
  return `${base}/${encodeMonthParam(now.getFullYear(), now.getMonth())}`;
}

const NAV_ITEMS = [
  {
    href: "/calendar",
    label: "캘린더",
    icon: CalendarIcon,
    match: (path: string) => path.startsWith("/calendar"),
  },
  { href: "/", label: "일일정산", icon: NotebookPenIcon, match: (path: string) => path === "/" },
  {
    href: "/weekly",
    label: "주간정산",
    icon: CalendarRangeIcon,
    match: (path: string) => path.startsWith("/weekly"),
  },
  {
    href: currentMonthHref("/monthly"),
    label: "월말정산",
    icon: ReceiptIcon,
    match: (path: string) => path.startsWith("/monthly"),
  },
  {
    href: currentMonthHref("/budget-plan"),
    label: "예산계획",
    icon: PiggyBankIcon,
    match: (path: string) => path.startsWith("/budget-plan"),
  },
  {
    href: "/stats",
    label: "통계",
    icon: BarChart3Icon,
    match: (path: string) => path.startsWith("/stats"),
  },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t-[0.5px] border-border bg-background">
      <div className="mx-auto flex max-w-xl lg:max-w-4xl">
        {NAV_ITEMS.map((item) => {
          const isActive = item.match(pathname);
          const Icon = item.icon;
          return (
            <Link
              key={item.label}
              href={item.href}
              className={cn(
                "flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] lg:gap-1 lg:py-3 lg:text-sm",
                isActive ? "text-primary" : "text-muted-foreground"
              )}
            >
              <Icon className="size-5 lg:size-6" />
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
