'use client';

import { ReactNode } from 'react';
import { ArrowUp, ArrowDown, Minus } from 'lucide-react';
import { formatNumber } from '@/hooks/useMcpTracking';

interface McpStatsCardProps {
  title: string;
  value: number | string;
  icon: ReactNode;
  trend?: 'up' | 'down' | 'stable';
  trendValue?: number;
  color?: string;
  bgColor?: string;
}

export default function McpStatsCard({
  title,
  value,
  icon,
  trend,
  trendValue,
  color = 'text-gray-600',
  bgColor = 'bg-white',
}: McpStatsCardProps) {
  const getTrendIcon = () => {
    switch (trend) {
      case 'up':
        return <ArrowUp className="h-4 w-4 text-green-500" />;
      case 'down':
        return <ArrowDown className="h-4 w-4 text-red-500" />;
      case 'stable':
        return <Minus className="h-4 w-4 text-gray-500" />;
      default:
        return null;
    }
  };

  const getTrendColor = () => {
    switch (trend) {
      case 'up':
        return 'text-green-600';
      case 'down':
        return 'text-red-600';
      case 'stable':
        return 'text-gray-600';
      default:
        return 'text-gray-600';
    }
  };

  return (
    <div className={`${bgColor} rounded-lg shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow`}>
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <p className={`text-sm font-medium ${color}`}>{title}</p>
          <div className="mt-2 flex items-baseline">
            <p className="text-3xl font-bold text-gray-900">
              {typeof value === 'number' ? formatNumber(value) : value}
            </p>
            {trend && trendValue !== undefined && (
              <div className="ml-3 flex items-center">
                {getTrendIcon()}
                <span className={`ml-1 text-sm font-medium ${getTrendColor()}`}>
                  {trendValue > 0 ? '+' : ''}{trendValue}%
                </span>
              </div>
            )}
          </div>
        </div>
        <div className={`ml-4 p-3 rounded-full ${bgColor === 'bg-white' ? 'bg-gray-50' : ''}`}>
          {icon}
        </div>
      </div>
    </div>
  );
}