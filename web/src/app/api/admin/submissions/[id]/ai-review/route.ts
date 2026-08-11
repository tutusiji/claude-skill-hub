import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth';
import { getSubmission, UPLOAD_DIR } from '@/lib/storage';
import { runAiReview } from '@/lib/ai-review';
import { join } from 'path';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { execSync } from 'child_process';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await verifyAuth())) {
    return NextResponse.json({ error: '未授权' }, { status: 401 });
  }

  const { id } = await params;
  const submission = getSubmission(id);

  if (!submission) {
    return NextResponse.json({ error: '提交记录不存在' }, { status: 404 });
  }

  const filepath = join(UPLOAD_DIR, submission.filepath);

  // 解压到临时目录
  const tempDir = mkdtempSync(join(tmpdir(), 'skill-hub-ai-review-'));
  try {
    const lower = filepath.toLowerCase();
    if (lower.endsWith('.zip')) {
      execSync(`unzip -q -o "${filepath}" -d "${tempDir}"`, { stdio: 'pipe' });
    } else if (lower.endsWith('.tar.gz') || lower.endsWith('.tgz')) {
      execSync(`tar -xzf "${filepath}" -C "${tempDir}"`, { stdio: 'pipe' });
    } else {
      return NextResponse.json({ error: '不支持的文件格式' }, { status: 400 });
    }

    // 运行 AI 审查
    const result = await runAiReview(tempDir);

    return NextResponse.json(result);
  } finally {
    // 清理临时目录
    rmSync(tempDir, { recursive: true, force: true });
  }
}
