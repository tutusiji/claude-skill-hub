import Link from 'next/link';
import { Package, Tag, FileCode, User, Shield } from 'lucide-react';
import type { Plugin, ViewMode } from '@/lib/types';
import { CATEGORY_LABELS } from '@/lib/types';
import { cn } from '@/lib/utils';

interface PluginCardProps {
  plugin: Plugin;
  view?: ViewMode;
}

export function PluginCard({ plugin, view = 'grid' }: PluginCardProps) {
  const categoryLabel = CATEGORY_LABELS[plugin.category] || plugin.category;
  const skillCount = plugin.skills?.length || 0;

  if (view === 'list') {
    return (
      <Link
        href={`/plugins/${plugin.name}`}
        className="card p-4 flex items-center gap-4 group block"
      >
        <div className="flex items-center gap-2 shrink-0 w-48">
          <Package className="w-4 h-4 text-brand-500 shrink-0" />
          <h3 className="font-semibold text-sm group-hover:text-brand-500 transition-colors truncate">
            {plugin.name}
          </h3>
        </div>
        <p className="text-xs text-[var(--muted)] flex-1 line-clamp-1">
          {plugin.description}
        </p>
        <div className="flex items-center gap-3 shrink-0">
          <span className="inline-flex items-center gap-1 text-xs text-[var(--muted)]">
            <Tag className="w-3 h-3" />
            {categoryLabel}
          </span>
          {skillCount > 0 && (
            <span className="inline-flex items-center gap-1 text-xs text-[var(--muted)]">
              <FileCode className="w-3 h-3" />
              {skillCount}
            </span>
          )}
          {plugin.author?.name && (
            <span className="inline-flex items-center gap-1 text-xs text-[var(--muted)]">
              <User className="w-3 h-3" />
              {plugin.author.name}
            </span>
          )}
          <span className="text-xs text-[var(--muted)] font-mono">v{plugin.version}</span>
        </div>
      </Link>
    );
  }

  return (
    <Link href={`/plugins/${plugin.name}`} className="card p-5 block group">
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <Package className="w-4 h-4 text-brand-500 shrink-0" />
          <h3 className="font-semibold text-sm group-hover:text-brand-500 transition-colors">
            {plugin.name}
          </h3>
          {plugin.featured && (
            <span className="text-xs text-amber-500" title="精选">★</span>
          )}
        </div>
        <span className="text-xs text-[var(--muted)] font-mono">v{plugin.version}</span>
      </div>
      <p className="text-xs text-[var(--muted)] line-clamp-2 mb-3">
        {plugin.description}
      </p>
      <div className="flex items-center gap-3 flex-wrap">
        <span className="inline-flex items-center gap-1 text-xs text-[var(--muted)]">
          <Tag className="w-3 h-3" />
          {categoryLabel}
        </span>
        {skillCount > 0 && (
          <span className="inline-flex items-center gap-1 text-xs text-[var(--muted)]">
            <FileCode className="w-3 h-3" />
            {skillCount} 技能
          </span>
        )}
        {plugin.license && (
          <span className="inline-flex items-center gap-1 text-xs text-[var(--muted)]">
            <Shield className="w-3 h-3" />
            {plugin.license}
          </span>
        )}
      </div>
    </Link>
  );
}
