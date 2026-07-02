'use client';

import { useState, useEffect } from 'react';
import { Download, Link2, Check, Loader2, HardDrive, Tag, FolderTree, Layers } from 'lucide-react';
import { FileTree } from './file-tree';

interface FileTreeNode {
  name: string;
  type: 'directory' | 'file';
  size: number;
  children?: FileTreeNode[];
}

interface PluginSidebarProps {
  pluginName: string;
  version: string;
  category: string;
  license?: string;
  downloadCount: number;
  skillsCount: number;
}

export function PluginSidebar({
  pluginName, version, category, license, downloadCount, skillsCount,
}: PluginSidebarProps) {
  const [tree, setTree] = useState<FileTreeNode[] | null>(null);
  const [loadingTree, setLoadingTree] = useState(true);
  const [shared, setShared] = useState(false);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    fetch(`/api/plugins/${encodeURIComponent(pluginName)}/filetree`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        setTree(data?.tree || []);
        setLoadingTree(false);
      })
      .catch(() => {
        setTree([]);
        setLoadingTree(false);
      });
  }, [pluginName]);

  const handleShare = async () => {
    const url = window.location.href;
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      const input = document.createElement('input');
      input.value = url;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      document.body.removeChild(input);
    }
    setShared(true);
    setTimeout(() => setShared(false), 2000);
  };

  const handleDownloadZip = () => {
    setDownloading(true);
    const a = document.createElement('a');
    a.href = `/api/plugins/${encodeURIComponent(pluginName)}/download-zip`;
    a.download = `${pluginName}.zip`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => setDownloading(false), 2000);
  };

  return (
    <>
      {/* 模块一：文件浏览 */}
      <div className="card p-4">
        <h3 className="text-xs font-semibold mb-3 flex items-center gap-1.5">
          <FolderTree className="w-3.5 h-3.5 text-brand-500" />
          文件浏览
        </h3>
        {loadingTree ? (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="w-4 h-4 animate-spin text-[var(--muted)]" />
          </div>
        ) : tree && tree.length > 0 ? (
          <div className="max-h-[400px] overflow-y-auto scrollbar-custom -mr-2 pr-2">
            <FileTree tree={tree} />
          </div>
        ) : (
          <p className="text-xs text-[var(--muted)] text-center py-3">文件信息不可用</p>
        )}
      </div>

      {/* 模块二：信息面板 */}
      <div className="card p-4">
        <h3 className="text-xs font-semibold mb-3 flex items-center gap-1.5">
          <Tag className="w-3.5 h-3.5 text-brand-500" />
          插件信息
        </h3>
        <div className="space-y-2 text-xs mb-4">
          <div className="flex justify-between">
            <span className="text-[var(--muted)]">版本</span>
            <span className="font-mono">v{version}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[var(--muted)]">分类</span>
            <span>{category}</span>
          </div>
          {license && (
            <div className="flex justify-between">
              <span className="text-[var(--muted)]">许可证</span>
              <span>{license}</span>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-[var(--muted)]">技能数</span>
            <span className="flex items-center gap-1">
              <Layers className="w-3 h-3" />
              {skillsCount}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-[var(--muted)]">下载量</span>
            <span className="flex items-center gap-1">
              <HardDrive className="w-3 h-3" />
              {downloadCount}
            </span>
          </div>
        </div>

        {/* 操作按钮 */}
        <div className="space-y-2">
          <button
            onClick={handleDownloadZip}
            disabled={downloading}
            className="w-full flex items-center justify-center gap-1.5 px-3 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
          >
            {downloading ? (
              <><Loader2 className="w-3.5 h-3.5 animate-spin" /> 打包中...</>
            ) : (
              <><Download className="w-3.5 h-3.5" /> 下载 ZIP 包</>
            )}
          </button>
          <button
            onClick={handleShare}
            className="w-full flex items-center justify-center gap-1.5 px-3 py-2 bg-[var(--background)] border border-[var(--border)] hover:border-brand-500 rounded-lg text-xs font-medium transition-colors"
          >
            {shared ? (
              <><Check className="w-3.5 h-3.5 text-emerald-500" /> 已复制链接</>
            ) : (
              <><Link2 className="w-3.5 h-3.5" /> 分享</>
            )}
          </button>
        </div>
      </div>
    </>
  );
}
