'use client';

import { ChevronDown, ArrowUpDown } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import type { SortOption } from '@/lib/types';
import { cn } from '@/lib/utils';

interface SortControlProps {
  value: SortOption;
  onChange: (value: SortOption) => void;
}

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: 'default', label: '默认排序' },
  { value: 'name-asc', label: '名称 A-Z' },
  { value: 'name-desc', label: '名称 Z-A' },
  { value: 'skills-desc', label: '技能数最多' },
  { value: 'category', label: '按分类' },
];

export function SortControl({ value, onChange }: SortControlProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const current = SORT_OPTIONS.find((o) => o.value === value);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-3 py-2 text-xs font-medium bg-[var(--card)] border border-[var(--border)] rounded-lg hover:border-[var(--hover-border)] transition-colors"
      >
        <ArrowUpDown className="w-3.5 h-3.5 text-[var(--muted)]" />
        {current?.label}
        <ChevronDown className={cn('w-3.5 h-3.5 text-[var(--muted)] transition-transform', open && 'rotate-180')} />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 z-50 w-44 bg-[var(--card)] border border-[var(--border)] rounded-lg shadow-lg overflow-hidden">
          {SORT_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => {
                onChange(opt.value);
                setOpen(false);
              }}
              className={cn(
                'w-full text-left px-3 py-2 text-xs hover:bg-[var(--card-hover)] transition-colors',
                value === opt.value && 'text-brand-500 font-medium bg-[var(--background)]'
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
