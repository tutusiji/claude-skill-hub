import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth';
import { getSubmission, UPLOAD_DIR } from '@/lib/storage';
import { validateUploadedFile } from '@/lib/validator';
import { join } from 'path';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
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
  const result = validateUploadedFile(filepath);

  return NextResponse.json(result);
}
