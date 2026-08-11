'use client';

import { useState } from 'react';
import { Copy, Check } from 'lucide-react';

interface CopyButtonWithTrackingProps {
  text: string;
  pluginName: string;
}

export function CopyButtonWithTracking({ text, pluginName }: CopyButtonWithTrackingProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);

    // 记录安装意向（复制安装命令），与 ZIP 下载分开计数
    try {
      await fetch(`/api/plugins/${pluginName}/install`, { method: 'POST' });
    } catch {
      // Silent fail — don't block copy
    }
  };

  return (
    <button
      onClick={handleCopy}
      className="p-1.5 text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
      title="复制安装命令"
    >
      {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
    </button>
  );
}
