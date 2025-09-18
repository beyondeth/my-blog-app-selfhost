'use client';

import React, { memo } from 'react';
import { LucideIcon } from 'lucide-react';

interface DMSidebarButtonProps {
  icon: LucideIcon;
  label: string;
  isActive: boolean;
  isCollapsed: boolean;
  onClick: () => void;
  variant?: 'default' | 'danger';
}

const DMSidebarButton: React.FC<DMSidebarButtonProps> = memo(({
  icon: Icon,
  label,
  isActive,
  isCollapsed,
  onClick,
  variant = 'default'
}) => {
  const baseClasses = `
    relative
    w-full
    flex
    items-center
    justify-center
    p-3
    rounded-xl
    transition-all
    duration-200
    group
  `;

  const variantClasses = {
    default: isActive
      ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
      : 'text-gray-400 hover:bg-gray-700/50 hover:text-white',
    danger: 'text-gray-400 hover:bg-red-600/20 hover:text-red-400'
  };

  return (
    <button
      onClick={onClick}
      className={`${baseClasses} ${variantClasses[variant]}`}
      aria-label={label}
      title={isCollapsed ? label : undefined}
    >
      <Icon className="w-5 h-5" />

      {/* Tooltip for collapsed state */}
      {isCollapsed && (
        <div className="
          absolute
          left-full
          ml-2
          px-2
          py-1
          bg-gray-900
          text-white
          text-sm
          rounded
          whitespace-nowrap
          opacity-0
          group-hover:opacity-100
          pointer-events-none
          transition-opacity
          z-50
        ">
          {label}
        </div>
      )}

      {/* Active indicator */}
      {isActive && (
        <div className="
          absolute
          left-0
          top-1/2
          -translate-y-1/2
          w-1
          h-8
          bg-blue-400
          rounded-r-full
        " />
      )}
    </button>
  );
});

DMSidebarButton.displayName = 'DMSidebarButton';

export default DMSidebarButton;