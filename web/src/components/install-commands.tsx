'use client';

import { useState } from 'react';
import { CopyButtonWithTracking } from '@/components/copy-button-with-tracking';
import type { Plugin } from '@/lib/types';
import { SUPPORTED_TOOLS, TOOL_MAP } from '@/lib/types';

interface Props {
  plugin: Plugin;
  marketplaceName: string;
  marketplaceUrl: string;
}

export function InstallCommands({ plugin, marketplaceName, marketplaceUrl }: Props) {
  const tools = plugin.compatibility || SUPPORTED_TOOLS.map((t) => t.id);
  const [selectedTool, setSelectedTool] = useState(tools[0]);

  const tool = TOOL_MAP[selectedTool];
  if (!tool) return null;

  const installCmd = tool.installCmd(plugin.name, marketplaceName);
  const mpCmd = tool.marketplaceCmd(marketplaceUrl);

  return (
    <div>
      {/* 工具选择 tabs */}
      <div className="flex items-center gap-1 mb-3 flex-wrap">
        {tools.map((tid) => {
          const t = TOOL_MAP[tid];
          if (!t) return null;
          return (
            <button
              key={tid}
              onClick={() => setSelectedTool(tid)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                selectedTool === tid
                  ? 'bg-brand-600 text-white'
                  : 'bg-[var(--background)] text-[var(--muted)] hover:text-[var(--foreground)] border border-[var(--border)]'
              }`}
            >
              {t.shortName}
            </button>
          );
        })}
      </div>

      {/* 安装命令 */}
      <div className="flex items-center gap-2 bg-[var(--background)] border border-[var(--border)] rounded-lg px-4 py-3">
        <code className="text-sm text-brand-500 flex-1 overflow-x-auto whitespace-nowrap">{installCmd}</code>
        <CopyButtonWithTracking text={installCmd} pluginName={plugin.name} />
      </div>
      <p className="text-xs text-[var(--muted)] mt-1.5">
        首次使用需先添加 marketplace: <code className="text-brand-500">{mpCmd}</code>
      </p>
    </div>
  );
}
