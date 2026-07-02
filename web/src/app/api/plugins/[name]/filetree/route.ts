import { NextRequest, NextResponse } from 'next/server';
import { readdirSync, statSync } from 'fs';
import { join } from 'path';
import { getPluginDir } from '@/lib/storage';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface FileTreeNode {
  name: string;
  type: 'directory' | 'file';
  size: number;
  children?: FileTreeNode[];
}

function buildTree(dir: string): FileTreeNode[] {
  const nodes: FileTreeNode[] = [];
  const entries = readdirSync(dir).sort();

  for (const entry of entries) {
    // 跳过隐藏文件和 node_modules
    if (entry === 'node_modules' || entry === '.git') continue;

    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);

    if (stat.isDirectory()) {
      nodes.push({
        name: entry,
        type: 'directory',
        size: 0,
        children: buildTree(fullPath),
      });
    } else {
      nodes.push({
        name: entry,
        type: 'file',
        size: stat.size,
      });
    }
  }
  return nodes;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  const { name } = await params;
  const pluginDir = getPluginDir(name);

  if (!pluginDir) {
    return NextResponse.json({ error: '插件文件不存在' }, { status: 404 });
  }

  const tree = buildTree(pluginDir);
  return NextResponse.json({ tree });
}
