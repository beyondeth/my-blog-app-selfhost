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
    <div className={`border border-gray-200 rounded-lg p-4 sm:p-6 bg-white ${className}`}>
      <h3 className="text-base sm:text-sm font-medium text-gray-900 mb-3 sm:mb-4">{title}</h3>
      {children}
    </div>
  );
});

export default SidebarSection; 