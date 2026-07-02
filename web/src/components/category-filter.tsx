'use client';

import { cn } from '@/lib/utils';
import { CATEGORY_LABELS } from '@/lib/types';

interface CategoryFilterProps {
  categories: string[];
  selected: string | null;
  onSelect: (cat: string | null) => void;
  counts: Record<string, number>;
}

export function CategoryFilter({ categories, selected, onSelect, counts }: CategoryFilterProps) {
  return (
    <div className="flex flex-wrap gap-2">
      <button
        onClick={() => onSelect(null)}
        className={cn(
          'px-3 py-1.5 rounded-full text-xs font-medium transition-colors',
          selected === null
            ? 'bg-brand-600 text-white'
            : 'bg-[var(--card)] text-[var(--muted)] hover:text-[var(--foreground)] border border-[var(--border)]'
        )}
      >
        全部 ({Object.values(counts).reduce((a, b) => a + b, 0)})
      </button>
      {categories.map((cat) => (
        <button
          key={cat}
          onClick={() => onSelect(cat)}
          className={cn(
            'px-3 py-1.5 rounded-full text-xs font-medium transition-colors',
            selected === cat
              ? 'bg-brand-600 text-white'
              : 'bg-[var(--card)] text-[var(--muted)] hover:text-[var(--foreground)] border border-[var(--border)]'
          )}
        >
          {CATEGORY_LABELS[cat] || cat} ({counts[cat] || 0})
        </button>
      ))}
    </div>
  );
}
