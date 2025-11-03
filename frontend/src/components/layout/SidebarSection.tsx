"use client";

import React, { ReactNode } from 'react';

interface SidebarSectionProps {
  title: string | ReactNode;
  children: ReactNode;
  className?: string;
}

const SidebarSection = React.memo(function SidebarSection({
  title,
  children,
  className = ""
}: SidebarSectionProps) {
  return (
    <div className={`rounded-xl border border-border p-5 shadow-sm hover:shadow-md transition-shadow duration-300 bg-card dark:bg-[rgb(38,38,38)] ${className}`}>
      {title && (
        <h3 className="text-lg font-semibold text-foreground mb-5">
          {title}
        </h3>
      )}
      {children}
    </div>
  );
});

export default SidebarSection; 