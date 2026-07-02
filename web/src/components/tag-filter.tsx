'use client';

import { Hash, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TagFilterProps {
  tags: string[];
  selected: string | null;
  onSelect: (tag: string | null) => void;
  counts: Record<string, number>;
}

export function TagFilter({ tags, selected, onSelect, counts }: TagFilterProps) {
  if (tags.length === 0) return null;

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="flex items-center gap-1 text-xs text-[var(--muted)] shrink-0">
        <Hash className="w-3 h-3" />
        标签
      </span>
      {selected && (
        <button
          onClick={() => onSelect(null)}
          className="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full bg-brand-600 text-white"
        >
          {selected}
          <X className="w-3 h-3" />
        </button>
      )}
      {!selected && tags.map((tag) => (
        <button
          key={tag}
          onClick={() => onSelect(tag)}
          className={cn(
            'px-2 py-0.5 text-xs rounded-full border transition-colors',
            'bg-[var(--card)] text-[var(--muted)] border-[var(--border)] hover:text-[var(--foreground)] hover:border-[var(--hover-border)]'
          )}
        >
          {tag} <span className="text-[var(--muted)] opacity-60">({counts[tag] || 0})</span>
        </button>
      ))}
    </div>
  );
}
