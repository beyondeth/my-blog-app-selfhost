"use client";

import React, { ReactNode } from 'react';

interface SidebarSectionProps {
  title: string;
  children: ReactNode;
  className?: string;
}

const SidebarSection = React.memo(function SidebarSection({ 
  title, 
  children, 
  className = "" 
}: SidebarSectionProps) {
  return (
    <div className={`bg-white rounded-xl border border-gray-200 p-5 shadow-sm hover:shadow-md transition-shadow duration-300 ${className}`}>
      <h3 className="text-lg font-semibold text-gray-900 mb-5 flex items-center gap-2">
        <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
        {title}
      </h3>
      {children}
    </div>
  );
});

export default SidebarSection; 