import { NextRequest, NextResponse } from 'next/server';
import { getPluginDir, incrementInstall } from '@/lib/storage';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// 安装意向：用户复制安装命令（install 命令直接拉取 marketplace git 仓库，
// 不经服务器，无法统计真实安装，这里记录复制命令这一意向行为）
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  const { name } = await params;
  if (!getPluginDir(name)) {
    return NextResponse.json({ error: '插件不存在' }, { status: 404 });
  }

  const count = incrementInstall(name);
  return NextResponse.json({ success: true, name, installs: count });
}
