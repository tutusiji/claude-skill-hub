'use client';

import { useState, useMemo } from 'react';
import { SearchBar } from '@/components/search-bar';
import { CategoryFilter } from '@/components/category-filter';
import { PluginCard } from '@/components/plugin-card';
import registry from '@/lib/registry.json';
import type { Plugin } from '@/lib/types';

const plugins = registry as Plugin[];

export default function HomePage() {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<string | null>(null);

  const allCategories = useMemo(
    () => [...new Set(plugins.map((p) => p.category))].sort(),
    []
  );

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const p of plugins) {
      counts[p.category] = (counts[p.category] || 0) + 1;
    }
    return counts;
  }, []);

  const filtered = useMemo(() => {
    return plugins.filter((p) => {
      if (category && p.category !== category) return false;
      if (!query) return true;
      const q = query.toLowerCase();
      return (
        p.name.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q) ||
        p.keywords?.some((k) => k.toLowerCase().includes(q)) ||
        p.skills?.some((s) => s.name.toLowerCase().includes(q) || s.description.toLowerCase().includes(q))
      );
    });
  }, [query, category]);

  return (
    <main className="max-w-7xl mx-auto px-6 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold mb-1">插件市场</h1>
        <p className="text-sm text-[var(--muted)]">
          {plugins.length} 个插件 — 浏览、搜索并安装到 Claude Code。
        </p>
      </div>

      <div className="mb-6 space-y-4">
        <SearchBar value={query} onChange={setQuery} />
        <CategoryFilter
          categories={allCategories}
          selected={category}
          onSelect={setCategory}
          counts={categoryCounts}
        />
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-20 text-[var(--muted)]">
          <p className="text-sm">未找到插件。试试其他搜索词或分类。</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((plugin) => (
            <PluginCard key={plugin.name} plugin={plugin} />
          ))}
        </div>
      )}
    </main>
  );
}
