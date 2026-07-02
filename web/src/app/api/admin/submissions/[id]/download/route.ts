import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth';
import { getSubmission, UPLOAD_DIR } from '@/lib/storage';
import { readFileSync } from 'fs';
import { join } from 'path';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await verifyAuth())) {
    return NextResponse.json({ error: '未授权' }, { status: 401 });
  }

  const { id } = await params;
  const sub = getSubmission(id);
  if (!sub) {
    return NextResponse.json({ error: '未找到提交' }, { status: 404 });
  }

  const filepath = join(UPLOAD_DIR, sub.filepath);
  try {
    const fileBuffer = readFileSync(filepath);
    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${encodeURIComponent(sub.filename)}"`,
      },
    });
  } catch {
    return NextResponse.json({ error: '文件不存在' }, { status: 404 });
  }
}
