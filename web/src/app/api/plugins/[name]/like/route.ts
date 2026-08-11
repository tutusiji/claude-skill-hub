import { NextRequest, NextResponse } from 'next/server';
import { getPluginDir, incrementLike, getPluginLikeCount } from '@/lib/storage';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// 点赞
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ name: string }> },
) {
  const { name } = await params;
  if (!getPluginDir(name)) {
    return NextResponse.json({ error: '插件不存在' }, { status: 404 });
  }

  const count = incrementLike(name);
  return NextResponse.json({ success: true, name, likes: count });
}

// 查询点赞数
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ name: string }> },
) {
  const { name } = await params;
  if (!getPluginDir(name)) {
    return NextResponse.json({ error: '插件不存在' }, { status: 404 });
  }

  return NextResponse.json({ success: true, name, likes: getPluginLikeCount(name) });
}
