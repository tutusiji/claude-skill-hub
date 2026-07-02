import { NextRequest, NextResponse } from 'next/server';
import { writeFileSync, mkdtempSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { validateUploadedFile } from '@/lib/validator';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file || file.size === 0) {
      return NextResponse.json(
        { error: '请上传文件' },
        { status: 400 }
      );
    }

    // 保存到临时文件
    const tempDir = mkdtempSync(join(tmpdir(), 'skill-hub-upload-'));
    const tempFile = join(tempDir, file.name.replace(/[^a-zA-Z0-9._-]/g, '_'));

    try {
      const arrayBuffer = await file.arrayBuffer();
      writeFileSync(tempFile, Buffer.from(arrayBuffer));

      // 执行验证
      const result = validateUploadedFile(tempFile);

      return NextResponse.json(result);
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : '未知错误';
    return NextResponse.json(
      { error: `验证失败：${message}` },
      { status: 500 }
    );
  }
}
