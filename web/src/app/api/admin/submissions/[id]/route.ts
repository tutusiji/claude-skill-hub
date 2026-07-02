import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth';
import { updateSubmissionStatus, deleteSubmission } from '@/lib/storage';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await verifyAuth())) {
    return NextResponse.json({ error: '未授权' }, { status: 401 });
  }

  const { id } = await params;
  const { status } = await request.json();

  if (!['approved', 'rejected', 'published'].includes(status)) {
    return NextResponse.json({ error: '无效状态' }, { status: 400 });
  }

  const sub = updateSubmissionStatus(id, status);
  if (!sub) {
    return NextResponse.json({ error: '未找到提交' }, { status: 404 });
  }

  return NextResponse.json({ success: true, submission: sub });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await verifyAuth())) {
    return NextResponse.json({ error: '未授权' }, { status: 401 });
  }

  const { id } = await params;
  const result = deleteSubmission(id);

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
