'use client';

import { RefreshCw, ZoomIn, ZoomOut } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ZoomControlsProps {
  onZoomIn: () => void;
  onZoomOut: () => void;
  onReset: () => void;
  labels: {
    zoomIn: string;
    zoomOut: string;
    reset: string;
  };
  tone?: 'light' | 'dark';
}

export default function ZoomControls({
  onZoomIn,
  onZoomOut,
  onReset,
  labels,
  tone = 'light',
}: ZoomControlsProps) {
  const buttonClassName = cn(
    'flex h-11 w-11 items-center justify-center rounded-lg transition-colors',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
    tone === 'dark'
      ? 'bg-black/60 text-white hover:bg-black/80 focus-visible:ring-white focus-visible:ring-offset-black'
      : 'text-gray-800 hover:bg-gray-200 focus-visible:ring-blue-700 focus-visible:ring-offset-white',
  );

  return (
    <div
      className="flex items-center gap-1"
      role="group"
      aria-label={`${labels.zoomOut} / ${labels.zoomIn}`}
    >
      <button
        type="button"
        onClick={onZoomOut}
        className={buttonClassName}
        title={labels.zoomOut}
        aria-label={labels.zoomOut}
      >
        <ZoomOut className="h-5 w-5" aria-hidden="true" />
      </button>
      <button
        type="button"
        onClick={onZoomIn}
        className={buttonClassName}
        title={labels.zoomIn}
        aria-label={labels.zoomIn}
      >
        <ZoomIn className="h-5 w-5" aria-hidden="true" />
      </button>
      <button
        type="button"
        onClick={onReset}
        className={buttonClassName}
        title={labels.reset}
        aria-label={labels.reset}
      >
        <RefreshCw className="h-5 w-5" aria-hidden="true" />
      </button>
    </div>
  );
}
