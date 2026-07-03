import { notFound } from 'next/navigation';
import { ArrowLeft, Package, Tag, GitBranch, FileCode, ExternalLink, Github, Shield, User, Sparkles, Flame, Layers } from 'lucide-react';
import Link from 'next/link';
import { CopyButtonWithTracking } from '@/components/copy-button-with-tracking';
import { PluginSidebar } from '@/components/plugin-sidebar';
import registry from '@/lib/registry.json';
import { getPublishedPlugins } from '@/lib/published-plugins';
import { getPluginStats } from '@/lib/storage';
import type { Plugin } from '@/lib/types';
import { CATEGORY_LABELS } from '@/lib/types';

const staticPlugins = registry as Plugin[];

export function generateStaticParams() {
  return staticPlugins.map((p) => ({ name: p.name }));
}

export const dynamicParams = true;

export default async function PluginDetailPage({ params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;

  // 1. Check static registry
  let plugin: Plugin | undefined = staticPlugins.find((p) => p.name === name);

  // 2. Fallback: check dynamically published plugins
  if (!plugin) {
    const published = getPublishedPlugins();
    plugin = published.find((p) => p.name === name);
  }

  if (!plugin) notFound();

  // 根据类型生成不同的安装命令
  const isSkillPack = plugin.type === 'skills';
  const installCmd = `claude plugin install ${plugin.name}@skill-hub`;
  const marketplaceCmd = `claude plugin marketplace add https://joox.cc:7504/skill-hub.git`;
  const categoryLabel = CATEGORY_LABELS[plugin.category] || plugin.category;

  // Get download count
  const stats = getPluginStats();
  const downloadCount = stats[plugin.name] || 0;

  // Related plugins: same category, exclude self, limit to 3
  const allPlugins = [...staticPlugins, ...getPublishedPlugins().filter(
    (p) => !staticPlugins.some((s) => s.name === p.name)
  )];
  const related = allPlugins
    .filter((p) => p.category === plugin.category && p.name !== plugin.name)
    .slice(0, 3);

  return (
    <main className="max-w-6xl mx-auto px-6 py-8">
      <Link href="/" className="inline-flex items-center gap-1 text-sm text-[var(--muted)] hover:text-[var(--foreground)] mb-6 transition-colors">
        <ArrowLeft className="w-4 h-4" />
        返回插件市场
      </Link>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
        {/* ─── 主内容区 ─── */}
        <div className="space-y-6 min-w-0">
          {/* Plugin Header */}
          <div className="card p-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <h1 className="text-xl font-bold">{plugin.name}</h1>
                  {plugin.type === 'skills' && (
                    <span className="inline-flex items-center gap-1 text-xs text-blue-500 bg-blue-500/10 px-2 py-0.5 rounded-full">
                      <Layers className="w-3 h-3" />
                      纯技能包
                    </span>
                  )}
                  {plugin.featured && (
                    <span className="inline-flex items-center gap-1 text-xs text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded-full">
                      <Sparkles className="w-3 h-3" />
                      精选
                    </span>
                  )}
                </div>
                <p className="text-sm text-[var(--muted)]">{plugin.description}</p>
              </div>
            </div>

            {/* Metadata Row */}
            <div className="flex items-center gap-4 text-xs text-[var(--muted)] mb-4 flex-wrap">
              <span className="inline-flex items-center gap-1">
                <Tag className="w-3 h-3" />
                {categoryLabel}
              </span>
              {plugin.author?.name && (
                <span className="inline-flex items-center gap-1">
                  <User className="w-3 h-3" />
                  {plugin.author.name}
                </span>
              )}
              {plugin.license && (
                <span className="inline-flex items-center gap-1">
                  <Shield className="w-3 h-3" />
                  {plugin.license}
                </span>
              )}
            </div>

            {/* Keywords */}
            {plugin.keywords && plugin.keywords.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-4">
                {plugin.keywords.map((kw) => (
                  <span key={kw} className="px-2 py-0.5 text-xs rounded bg-[var(--background)] text-[var(--muted)] border border-[var(--border)]">
                    {kw}
                  </span>
                ))}
              </div>
            )}

            {/* Install Command */}
            <div className="flex items-center gap-2 bg-[var(--background)] border border-[var(--border)] rounded-lg px-4 py-3">
              <code className="text-sm text-brand-500 flex-1">{installCmd}</code>
              <CopyButtonWithTracking text={installCmd} pluginName={plugin.name} />
            </div>
            <p className="text-xs text-[var(--muted)] mt-1.5">
              首次使用需先添加 marketplace: <code className="text-brand-500">{marketplaceCmd}</code>
            </p>

            {/* External Links */}
            {(plugin.homepage || plugin.repository) && (
              <div className="flex items-center gap-3 mt-3">
                {plugin.homepage && (
                  <a
                    href={plugin.homepage}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-[var(--muted)] hover:text-brand-500 transition-colors"
                  >
                    <ExternalLink className="w-3 h-3" />
                    主页
                  </a>
                )}
                {plugin.repository && (
                  <a
                    href={plugin.repository}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-[var(--muted)] hover:text-brand-500 transition-colors"
                  >
                    <Github className="w-3 h-3" />
                    仓库
                  </a>
                )}
              </div>
            )}
          </div>

          {/* Skills */}
          {plugin.skills && plugin.skills.length > 0 && (
            <div className="card p-6">
              <h2 className="text-sm font-semibold mb-4 flex items-center gap-2">
                <FileCode className="w-4 h-4 text-brand-500" />
                技能 ({plugin.skills.length})
              </h2>
              <div className="space-y-3">
                {plugin.skills.map((skill) => (
                  <div key={skill.name} className="border-l-2 border-[var(--border)] pl-4">
                    <h3 className="text-sm font-medium">{skill.name}</h3>
                    <p className="text-xs text-[var(--muted)] mt-1">{skill.description}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Commands */}
          {plugin.commands && plugin.commands.length > 0 && (
            <div className="card p-6">
              <h2 className="text-sm font-semibold mb-4 flex items-center gap-2">
                <GitBranch className="w-4 h-4 text-brand-500" />
                命令 ({plugin.commands.length})
              </h2>
              <div className="space-y-2">
                {plugin.commands.map((cmd) => (
                  <div key={cmd.name} className="flex items-center gap-3">
                    <code className="text-xs px-2 py-1 rounded bg-[var(--background)] text-brand-500 border border-[var(--border)]">
                      /{cmd.name}
                    </code>
                    <span className="text-xs text-[var(--muted)]">{cmd.description}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Related Plugins */}
          {related.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <Package className="w-4 h-4 text-brand-500" />
                相关插件
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {related.map((rp) => (
                  <Link
                    key={rp.name}
                    href={`/plugins/${rp.name}`}
                    className="card p-4 group block"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <Package className="w-3.5 h-3.5 text-brand-500 shrink-0" />
                      <h3 className="font-medium text-xs group-hover:text-brand-500 transition-colors">
                        {rp.name}
                      </h3>
                    </div>
                    <p className="text-xs text-[var(--muted)] line-clamp-2">
                      {rp.description}
                    </p>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ─── 右侧边栏 ─── */}
        <aside className="space-y-4 lg:sticky lg:top-6 lg:self-start">
          <PluginSidebar
            pluginName={plugin.name}
            version={plugin.version}
            category={categoryLabel}
            license={plugin.license}
            downloadCount={downloadCount}
            skillsCount={plugin.skills?.length || 0}
          />
        </aside>
      </div>
    </main>
  );
}
