import type { IconType } from "react-icons";
import { cn } from "@/lib/utils";

interface SidebarNodeIconProps {
  icon: IconType;
  isActive?: boolean;
  className?: string;
  iconClassName?: string;
}

export default function SidebarNodeIcon({
  icon: Icon,
  isActive = false,
  className,
  iconClassName,
}: SidebarNodeIconProps) {
  return (
    <span
      className={cn(
        "relative inline-flex h-4 w-4 shrink-0 items-center justify-center",
        className,
      )}
    >
      <Icon className={cn("h-4 w-4", iconClassName)} />
      {isActive ? (
        <span
          aria-hidden="true"
          className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-[#264653] shadow-[0_0_0_1px_rgba(255,255,255,0.65)] dark:border-[#0E141B] dark:bg-[#6CC3B2] dark:shadow-[0_0_0_1px_rgba(14,20,27,0.8)]"
        />
      ) : null}
    </span>
  );
}
