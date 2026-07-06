import Link from 'next/link';
import { Package, Tag, FileCode, User, Shield, Download, Flame } from 'lucide-react';
import type { Plugin, ViewMode } from '@/lib/types';
import { CATEGORY_LABELS, SUPPORTED_TOOLS, TOOL_MAP } from '@/lib/types';
import { cn } from '@/lib/utils';

interface PluginCardProps {
  plugin: Plugin;
  view?: ViewMode;
  downloadCount?: number;
  isHot?: boolean;
}

// 工具名缩写映射，用于卡片上的紧凑显示
const TOOL_SHORT: Record<string, string> = {
  'claude-code': 'CC',
  'codex': 'Codex',
  'kimi-code': 'Kimi',
  'opencode': 'OC',
  'codewhale': 'CW',
};

export function PluginCard({ plugin, view = 'grid', downloadCount = 0, isHot = false }: PluginCardProps) {
  const categoryLabel = CATEGORY_LABELS[plugin.category] || plugin.category;
  const skillCount = plugin.skills?.length || 0;
  const tools = plugin.compatibility || SUPPORTED_TOOLS.map((t) => t.id);
  const showAllTools = tools.length >= 5;

  const ToolBadges = ({ className }: { className?: string }) => (
    <span className={cn('inline-flex items-center gap-0.5', className)}>
      {showAllTools ? (
        <span className="text-xs text-[var(--muted)] px-1.5 py-0.5 rounded bg-[var(--background)] border border-[var(--border)]">
          全平台
        </span>
      ) : (
        tools.map((tid) => (
          <span
            key={tid}
            className="text-xs text-[var(--muted)] px-1.5 py-0.5 rounded bg-[var(--background)] border border-[var(--border)]"
            title={TOOL_MAP[tid]?.name || tid}
          >
            {TOOL_SHORT[tid] || tid}
          </span>
        ))
      )}
    </span>
  );

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
          {isHot && <Flame className="w-3.5 h-3.5 text-orange-500 shrink-0" />}
        </div>
        <p className="text-xs text-[var(--muted)] flex-1 line-clamp-1">
          {plugin.description}
        </p>
        <div className="flex items-center gap-3 shrink-0">
          <ToolBadges />
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
          {downloadCount > 0 && (
            <span className="inline-flex items-center gap-1 text-xs text-[var(--muted)]">
              <Download className="w-3 h-3" />
              {downloadCount}
            </span>
          )}
          <span className="text-xs text-[var(--muted)] font-mono">v{plugin.version}</span>
        </div>
      </Link>
    );
  }

  return (
    <Link href={`/plugins/${plugin.name}`} className="card p-5 block group relative">
      {isHot && (
        <div className="absolute -top-2 -right-2 flex items-center gap-0.5 px-2 py-0.5 rounded-full bg-orange-500/20 text-orange-500 text-xs font-medium border border-orange-500/30">
          <Flame className="w-3 h-3" />
          HOT
        </div>
      )}
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
      <div className="flex items-center gap-2 flex-wrap">
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
        {downloadCount > 0 && (
          <span className="inline-flex items-center gap-1 text-xs text-[var(--muted)]">
            <Download className="w-3 h-3" />
            {downloadCount}
          </span>
        )}
        {plugin.license && (
          <span className="inline-flex items-center gap-1 text-xs text-[var(--muted)]">
            <Shield className="w-3 h-3" />
            {plugin.license}
          </span>
        )}
      </div>
      <div className="mt-2 pt-2 border-t border-[var(--border)]">
        <ToolBadges />
      </div>
    </Link>
  );
}
