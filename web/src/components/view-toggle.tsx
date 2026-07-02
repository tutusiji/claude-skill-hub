'use client';

import { LayoutGrid, List } from 'lucide-react';
import type { ViewMode } from '@/lib/types';
import { cn } from '@/lib/utils';

interface ViewToggleProps {
  value: ViewMode;
  onChange: (value: ViewMode) => void;
}

export function ViewToggle({ value, onChange }: ViewToggleProps) {
  return (
    <div className="flex items-center bg-[var(--card)] border border-[var(--border)] rounded-lg p-0.5">
      <button
        onClick={() => onChange('grid')}
        className={cn(
          'p-1.5 rounded-md transition-colors',
          value === 'grid'
            ? 'bg-brand-600 text-white'
            : 'text-[var(--muted)] hover:text-[var(--foreground)]'
        )}
        title="网格视图"
      >
        <LayoutGrid className="w-3.5 h-3.5" />
      </button>
      <button
        onClick={() => onChange('list')}
        className={cn(
          'p-1.5 rounded-md transition-colors',
          value === 'list'
            ? 'bg-brand-600 text-white'
            : 'text-[var(--muted)] hover:text-[var(--foreground)]'
        )}
        title="列表视图"
      >
        <List className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
