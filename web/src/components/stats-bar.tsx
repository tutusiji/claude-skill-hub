import { Package, FileCode, Tags, Users } from 'lucide-react';
import type { Plugin } from '@/lib/types';
import { CATEGORY_LABELS } from '@/lib/types';

interface StatsBarProps {
  plugins: Plugin[];
}

export function StatsBar({ plugins }: StatsBarProps) {
  const totalSkills = plugins.reduce((sum, p) => sum + (p.skills?.length || 0), 0);
  const totalCategories = new Set(plugins.map((p) => p.category)).size;
  const totalAuthors = new Set(plugins.map((p) => p.author?.name).filter(Boolean)).size;

  const stats = [
    { icon: Package, label: '插件总数', value: plugins.length, color: 'text-brand-500' },
    { icon: FileCode, label: '技能总数', value: totalSkills, color: 'text-emerald-500' },
    { icon: Tags, label: '分类数', value: totalCategories, color: 'text-amber-500' },
    { icon: Users, label: '贡献者', value: totalAuthors, color: 'text-sky-500' },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {stats.map((stat) => (
        <div
          key={stat.label}
          className="card p-4 flex items-center gap-3"
        >
          <div className={`p-2 rounded-lg bg-[var(--background)] ${stat.color}`}>
            <stat.icon className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xl font-bold leading-tight">{stat.value}</div>
            <div className="text-xs text-[var(--muted)]">{stat.label}</div>
          </div>
        </div>
      ))}
    </div>
  );
}
