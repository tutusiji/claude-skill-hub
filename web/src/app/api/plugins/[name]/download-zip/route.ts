import { NextRequest, NextResponse } from 'next/server';
import { existsSync } from 'fs';
import { join, basename } from 'path';
import { execSync } from 'child_process';
import { getPluginDir, incrementDownload } from '@/lib/storage';
import { tmpdir } from 'os';
import { readFileSync, unlinkSync } from 'fs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  const { name } = await params;
  const pluginDir = getPluginDir(name);

  if (!pluginDir) {
    return NextResponse.json({ error: '插件文件不存在' }, { status: 404 });
  }

  // 创建临时 ZIP 文件
  const tmpZip = join(tmpdir(), `${name}-${Date.now()}.zip`);
  try {
    execSync(`cd "${join(pluginDir, '..')}" && zip -qr "${tmpZip}" "${basename(pluginDir)}"`, { stdio: 'pipe' });
  } catch {
    return NextResponse.json({ error: '打包失败' }, { status: 500 });
  }

  if (!existsSync(tmpZip)) {
    return NextResponse.json({ error: '打包失败' }, { status: 500 });
  }

  // 记录下载
  incrementDownload(name);

  const fileBuffer = readFileSync(tmpZip);
  unlinkSync(tmpZip);

  return new NextResponse(fileBuffer, {
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${name}.zip"`,
    },
  });
}
