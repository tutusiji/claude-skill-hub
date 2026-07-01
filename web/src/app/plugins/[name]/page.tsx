import { notFound } from 'next/navigation';
import { ArrowLeft, Package, Tag, GitBranch, FileCode } from 'lucide-react';
import Link from 'next/link';
import { CopyButton } from '@/components/copy-button';
import registry from '@/lib/registry.json';
import type { Plugin } from '@/lib/types';

const plugins = registry as Plugin[];

export function generateStaticParams() {
  return plugins.map((p) => ({ name: p.name }));
}

export default async function PluginDetailPage({ params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  const plugin = plugins.find((p) => p.name === name);
  if (!plugin) notFound();

  const installCmd = `/plugin install ${plugin.name}@internal-skill-hub`;

  return (
    <main className="max-w-4xl mx-auto px-6 py-8">
      <Link href="/" className="inline-flex items-center gap-1 text-sm text-[var(--muted)] hover:text-[var(--foreground)] mb-6 transition-colors">
        <ArrowLeft className="w-4 h-4" />
        返回插件市场
      </Link>

      <div className="card p-6 mb-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h1 className="text-xl font-bold mb-1">{plugin.name}</h1>
            <p className="text-sm text-[var(--muted)]">{plugin.description}</p>
          </div>
          <span className="text-xs text-[var(--muted)] font-mono shrink-0 ml-4">v{plugin.version}</span>
        </div>

        <div className="flex items-center gap-4 text-xs text-[var(--muted)] mb-4">
          <span className="inline-flex items-center gap-1">
            <Tag className="w-3 h-3" />
            {plugin.category}
          </span>
          {plugin.author?.name && (
            <span className="inline-flex items-center gap-1">
              <Package className="w-3 h-3" />
              {plugin.author.name}
            </span>
          )}
        </div>

        {plugin.keywords && plugin.keywords.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-4">
            {plugin.keywords.map((kw) => (
              <span key={kw} className="px-2 py-0.5 text-xs rounded bg-[var(--background)] text-[var(--muted)] border border-[var(--border)]">
                {kw}
              </span>
            ))}
          </div>
        )}

        <div className="flex items-center gap-2 bg-[var(--background)] border border-[var(--border)] rounded-lg px-4 py-3">
          <code className="text-sm text-brand-500 flex-1">{installCmd}</code>
          <CopyButton text={installCmd} />
        </div>
      </div>

      {plugin.skills && plugin.skills.length > 0 && (
        <div className="card p-6 mb-6">
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
    </main>
  );
}
