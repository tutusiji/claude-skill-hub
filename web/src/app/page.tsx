'use client';

import { useState, useMemo, useEffect } from 'react';
import { SearchBar } from '@/components/search-bar';
import { CategoryFilter } from '@/components/category-filter';
import { PluginCard } from '@/components/plugin-card';
import { StatsBar } from '@/components/stats-bar';
import { FeaturedSection } from '@/components/featured-section';
import { SortControl } from '@/components/sort-control';
import { ViewToggle } from '@/components/view-toggle';
import { TagFilter } from '@/components/tag-filter';
import registry from '@/lib/registry.json';
import type { Plugin, SortOption, ViewMode } from '@/lib/types';

const staticPlugins = registry as Plugin[];

const TOP_TAG_COUNT = 15;

interface StatsResponse {
  stats: Record<string, number>;
  topDownloads: Array<{ name: string; count: number }>;
  statusMap: Record<string, boolean>;
}

export default function HomePage() {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<string | null>(null);
  const [tag, setTag] = useState<string | null>(null);
  const [sort, setSort] = useState<SortOption>('default');
  const [view, setView] = useState<ViewMode>('grid');
  const [statsData, setStatsData] = useState<StatsResponse | null>(null);
  const [publishedPlugins, setPublishedPlugins] = useState<Plugin[]>([]);

  // Fetch stats + published plugins on mount
  useEffect(() => {
    fetch('/api/stats')
      .then((res) => res.json())
      .then((data) => setStatsData(data))
      .catch(() => {});
    fetch('/api/published-plugins')
      .then((res) => res.json())
      .then((data) => setPublishedPlugins(data.plugins || []))
      .catch(() => {});
  }, []);

  // Merge static registry + dynamically published plugins
  const allPlugins = useMemo(() => {
    const existingNames = new Set(staticPlugins.map((p) => p.name));
    return [...staticPlugins, ...publishedPlugins.filter((p) => !existingNames.has(p.name))];
  }, [publishedPlugins]);

  // Collect top tags by frequency
  const allTags = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const p of allPlugins) {
      for (const k of p.keywords || []) {
        counts[k] = (counts[k] || 0) + 1;
      }
    }
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, TOP_TAG_COUNT)
      .map(([tag]) => tag);
  }, [allPlugins]);

  // Filter out unpublished plugins
  const visiblePlugins = useMemo(() => {
    if (!statsData?.statusMap) return allPlugins;
    return allPlugins.filter((p) => statsData.statusMap[p.name] !== false);
  }, [statsData, allPlugins]);

  const allCategories = useMemo(
    () => [...new Set(visiblePlugins.map((p) => p.category))].sort(),
    [visiblePlugins]
  );

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const p of visiblePlugins) {
      counts[p.category] = (counts[p.category] || 0) + 1;
    }
    return counts;
  }, [visiblePlugins]);

  const tagCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const p of visiblePlugins) {
      for (const k of p.keywords || []) {
        counts[k] = (counts[k] || 0) + 1;
      }
    }
    return counts;
  }, [visiblePlugins]);

  // Top 3 hot plugins by download count
  const hotNames = useMemo(() => {
    if (!statsData?.topDownloads) return new Set<string>();
    return new Set(statsData.topDownloads.slice(0, 3).map((p) => p.name));
  }, [statsData]);

  const filtered = useMemo(() => {
    let result = visiblePlugins.filter((p) => {
      if (category && p.category !== category) return false;
      if (tag && !(p.keywords || []).includes(tag)) return false;
      if (!query) return true;
      const q = query.toLowerCase();
      return (
        p.name.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q) ||
        p.keywords?.some((k) => k.toLowerCase().includes(q)) ||
        p.skills?.some((s) => s.name.toLowerCase().includes(q) || s.description.toLowerCase().includes(q))
      );
    });

    switch (sort) {
      case 'name-asc':
        result = [...result].sort((a, b) => a.name.localeCompare(b.name));
        break;
      case 'name-desc':
        result = [...result].sort((a, b) => b.name.localeCompare(a.name));
        break;
      case 'skills-desc':
        result = [...result].sort((a, b) => (b.skills?.length || 0) - (a.skills?.length || 0));
        break;
      case 'category':
        result = [...result].sort((a, b) => {
          const catCmp = a.category.localeCompare(b.category);
          return catCmp !== 0 ? catCmp : a.name.localeCompare(b.name);
        });
        break;
    }

    return result;
  }, [query, category, tag, sort, visiblePlugins]);

  return (
    <main className="max-w-7xl mx-auto px-6 py-8">
      {/* Stats Bar */}
      <div className="mb-8">
        <StatsBar plugins={visiblePlugins} />
      </div>

      {/* Featured Section */}
      <div className="mb-8">
        <FeaturedSection plugins={visiblePlugins} />
      </div>

      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-1">插件市场</h1>
        <p className="text-sm text-[var(--muted)]">
          {filtered.length === visiblePlugins.length
            ? `${visiblePlugins.length} 个插件 — 浏览、搜索并安装到 Claude Code。`
            : `${filtered.length} / ${visiblePlugins.length} 个插件匹配当前筛选条件。`}
        </p>
      </div>

      {/* Search + Controls */}
      <div className="mb-4 space-y-3">
        <div className="flex items-center gap-3">
          <div className="flex-1">
            <SearchBar value={query} onChange={setQuery} />
          </div>
          <SortControl value={sort} onChange={setSort} />
          <ViewToggle value={view} onChange={setView} />
        </div>
        <CategoryFilter
          categories={allCategories}
          selected={category}
          onSelect={setCategory}
          counts={categoryCounts}
        />
        <TagFilter
          tags={allTags}
          selected={tag}
          onSelect={setTag}
          counts={tagCounts}
        />
      </div>

      {/* Results */}
      {filtered.length === 0 ? (
        <div className="text-center py-20 text-[var(--muted)]">
          <p className="text-sm">未找到插件。试试其他搜索词或分类。</p>
        </div>
      ) : view === 'grid' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((plugin) => (
            <PluginCard
              key={plugin.name}
              plugin={plugin}
              view="grid"
              downloadCount={statsData?.stats?.[plugin.name] || 0}
              isHot={hotNames.has(plugin.name)}
            />
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((plugin) => (
            <PluginCard
              key={plugin.name}
              plugin={plugin}
              view="list"
              downloadCount={statsData?.stats?.[plugin.name] || 0}
              isHot={hotNames.has(plugin.name)}
            />
          ))}
        </div>
      )}
    </main>
  );
}
