import Link from 'next/link';
import { Package, Tag } from 'lucide-react';
import type { Plugin } from '@/lib/types';

export function PluginCard({ plugin }: { plugin: Plugin }) {
  return (
    <Link href={`/plugins/${plugin.name}`} className="card p-5 block group">
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <Package className="w-4 h-4 text-brand-500 shrink-0" />
          <h3 className="font-semibold text-sm group-hover:text-brand-500 transition-colors">
            {plugin.name}
          </h3>
        </div>
        <span className="text-xs text-[var(--muted)] font-mono">v{plugin.version}</span>
      </div>
      <p className="text-xs text-[var(--muted)] line-clamp-2 mb-3">
        {plugin.description}
      </p>
      <div className="flex items-center gap-2 flex-wrap">
        <span className="inline-flex items-center gap-1 text-xs text-[var(--muted)]">
          <Tag className="w-3 h-3" />
          {plugin.category}
        </span>
        {(plugin.skills?.length || 0) > 0 && (
          <span className="text-xs text-[var(--muted)]">
            {plugin.skills!.length} 个技能
          </span>
        )}
      </div>
    </Link>
  );
}
