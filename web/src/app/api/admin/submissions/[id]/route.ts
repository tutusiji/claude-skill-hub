import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth';
import { updateSubmissionStatus } from '@/lib/storage';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await verifyAuth())) {
    return NextResponse.json({ error: '未授权' }, { status: 401 });
  }

  const { id } = await params;
  const { status } = await request.json();

  if (!['approved', 'rejected'].includes(status)) {
    return NextResponse.json({ error: '无效状态' }, { status: 400 });
  }

  const sub = updateSubmissionStatus(id, status);
  if (!sub) {
    return NextResponse.json({ error: '未找到提交' }, { status: 404 });
  }

  return NextResponse.json({ success: true, submission: sub });
}
