"use client";

import { cn } from "@/lib/utils";

export interface SidebarViewTabOption<T extends string> {
  value: T;
  label: string;
}

interface SidebarViewTabsProps<T extends string> {
  options: SidebarViewTabOption<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
}

export default function SidebarViewTabs<T extends string>({
  options,
  value,
  onChange,
  className,
}: SidebarViewTabsProps<T>) {
  return (
    <div
      className={cn(
        "flex rounded-2xl border border-[#D9E0EA] bg-white p-1 dark:border-[#4B5563] dark:bg-[#262626]",
        className,
      )}
      role="tablist"
      aria-label="사이드바 보기 전환"
    >
      {options.map((option) => {
        const isActive = option.value === value;

        return (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={isActive}
            data-sidebar-view-tab={option.value}
            data-state={isActive ? "active" : "inactive"}
            onClick={() => onChange(option.value)}
            className={cn(
              "flex-1 rounded-xl px-3 py-2 text-sm font-medium transition-colors",
              isActive
                ? "bg-[#264653] text-white dark:bg-[#6CC3B2] dark:text-[#0E141B]"
                : "text-[#4B5563] hover:bg-[#EEF3F8] dark:text-[#C7D1DD] dark:hover:bg-[#1A232E]",
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
