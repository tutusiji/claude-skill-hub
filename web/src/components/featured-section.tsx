import Link from 'next/link';
import { Sparkles, Package, ArrowRight } from 'lucide-react';
import type { Plugin } from '@/lib/types';
import { CATEGORY_LABELS } from '@/lib/types';

interface FeaturedSectionProps {
  plugins: Plugin[];
}

export function FeaturedSection({ plugins }: FeaturedSectionProps) {
  const featured = plugins.filter((p) => p.featured);
  if (featured.length === 0) return null;

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <Sparkles className="w-4 h-4 text-amber-500" />
        <h2 className="text-sm font-semibold">精选推荐</h2>
        <span className="text-xs text-[var(--muted)]">{featured.length} 个精选插件</span>
      </div>
      <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1 scrollbar-thin">
        {featured.map((plugin) => (
          <Link
            key={plugin.name}
            href={`/plugins/${plugin.name}`}
            className="card p-4 min-w-[260px] max-w-[260px] group shrink-0 border-l-2 border-l-amber-500/50"
          >
            <div className="flex items-start justify-between mb-2">
              <div className="flex items-center gap-2">
                <Package className="w-4 h-4 text-amber-500 shrink-0" />
                <h3 className="font-semibold text-sm group-hover:text-amber-500 transition-colors">
                  {plugin.name}
                </h3>
              </div>
              <span className="text-xs text-[var(--muted)] font-mono">v{plugin.version}</span>
            </div>
            <p className="text-xs text-[var(--muted)] line-clamp-2 mb-3">
              {plugin.description}
            </p>
            <div className="flex items-center justify-between">
              <span className="text-xs text-[var(--muted)]">
                {CATEGORY_LABELS[plugin.category] || plugin.category}
              </span>
              <span className="text-xs text-[var(--muted)] flex items-center gap-1">
                {(plugin.skills?.length || 0)} 技能
                <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
              </span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
