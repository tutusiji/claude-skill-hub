'use client';

import { useState } from 'react';
import { ChevronRight, ChevronDown, Folder, FolderOpen, FileText, FileCode, FileJson } from 'lucide-react';

interface FileTreeNode {
  name: string;
  type: 'directory' | 'file';
  size: number;
  children?: FileTreeNode[];
}

function getFileIcon(name: string) {
  if (name.endsWith('.json')) return FileJson;
  if (name.endsWith('.md') || name.endsWith('.txt')) return FileText;
  if (name.endsWith('.js') || name.endsWith('.ts') || name.endsWith('.py') || name.endsWith('.sh')) return FileCode;
  return FileText;
}

function formatSize(bytes: number): string {
  if (bytes === 0) return '-';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function TreeNode({ node, depth }: { node: FileTreeNode; depth: number }) {
  const [expanded, setExpanded] = useState(depth < 2);
  const isDir = node.type === 'directory';

  return (
    <div>
      <button
        onClick={() => isDir && setExpanded(!expanded)}
        className={`w-full flex items-center gap-1.5 px-2 py-1 rounded text-xs hover:bg-[var(--background)] transition-colors ${!isDir ? 'cursor-default' : 'cursor-pointer'}`}
        style={{ paddingLeft: `${depth * 12 + 8}px` }}
      >
        {isDir ? (
          <>
            {expanded ? (
              <ChevronDown className="w-3 h-3 shrink-0 text-[var(--muted)]" />
            ) : (
              <ChevronRight className="w-3 h-3 shrink-0 text-[var(--muted)]" />
            )}
            {expanded ? (
              <FolderOpen className="w-3.5 h-3.5 shrink-0 text-brand-500" />
            ) : (
              <Folder className="w-3.5 h-3.5 shrink-0 text-brand-500" />
            )}
          </>
        ) : (
          <>
            <span className="w-3 shrink-0" />
            {(() => {
              const Icon = getFileIcon(node.name);
              return <Icon className="w-3.5 h-3.5 shrink-0 text-[var(--muted)]" />;
            })()}
          </>
        )}
        <span className={`flex-1 text-left truncate ${isDir ? 'font-medium' : 'text-[var(--muted)]'}`}>
          {node.name}
        </span>
        {!isDir && (
          <span className="text-[var(--muted)] text-[10px] tabular-nums shrink-0">
            {formatSize(node.size)}
          </span>
        )}
      </button>
      {isDir && expanded && node.children && node.children.length > 0 && (
        <div>
          {node.children.map((child, i) => (
            <TreeNode key={i} node={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

export function FileTree({ tree }: { tree: FileTreeNode[] }) {
  if (!tree || tree.length === 0) {
    return (
      <div className="text-xs text-[var(--muted)] text-center py-4">
        暂无文件信息
      </div>
    );
  }

  return (
    <div className="space-y-0.5">
      {tree.map((node, i) => (
        <TreeNode key={i} node={node} depth={0} />
      ))}
    </div>
  );
}
