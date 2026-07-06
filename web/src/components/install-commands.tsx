'use client';

import { CopyButtonWithTracking } from '@/components/copy-button-with-tracking';
import type { Plugin } from '@/lib/types';
import { SUPPORTED_TOOLS } from '@/lib/types';

interface Props {
  plugin: Plugin;
  marketplaceName: string;
  marketplaceUrl: string;
}

/**
 * 安装命令:Claude Code 为主要支持路径,自动生成;其他工具手动适配。
 * 详见使用指南(/guide)。
 */
export function InstallCommands({ plugin, marketplaceName, marketplaceUrl }: Props) {
  const claude = SUPPORTED_TOOLS.find((t) => t.id === 'claude-code');
  if (!claude) return null;

  const installCmd = claude.installCmd(plugin.name, marketplaceName);
  const mpCmd = claude.marketplaceCmd(marketplaceUrl);
  const otherTools = SUPPORTED_TOOLS
    .filter((t) => t.id !== 'claude-code')
    .map((t) => t.shortName)
    .join(' / ');

  return (
    <div>
      {/* Claude Code 安装命令(自动) */}
      <div className="flex items-center gap-2 bg-[var(--background)] border border-[var(--border)] rounded-lg px-4 py-3">
        <code className="text-sm text-brand-500 flex-1 overflow-x-auto whitespace-nowrap">{installCmd}</code>
        <CopyButtonWithTracking text={installCmd} pluginName={plugin.name} />
      </div>
      <p className="text-xs text-[var(--muted)] mt-1.5">
        首次使用需先添加 marketplace: <code className="text-brand-500">{mpCmd}</code>
      </p>

      {/* 其他工具手动适配 */}
      <p className="text-xs text-[var(--muted)] mt-2">
        其他工具({otherTools}):请<a href="/guide" className="text-brand-500 hover:underline">手动安装</a>
        {' '}— 下载插件包后放到对应工具的 skills 目录。
      </p>
    </div>
  );
}
