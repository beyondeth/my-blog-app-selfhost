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
    <div className={`rounded-3xl border border-[#D9E0EA] p-5 shadow-sm hover:shadow-md transition-shadow duration-300 bg-white dark:border-[#4B5563] dark:bg-[#262626] ${className}`}>
      {title && (
        <h3 className="text-lg font-semibold text-[#1B2430] dark:text-[#E6EDF3] mb-5">
          {title}
        </h3>
      )}
      {children}
    </div>
  );
});

export default SidebarSection; 
