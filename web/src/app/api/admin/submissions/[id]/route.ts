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

  // PATCH 只用于审核决策(approved/rejected);'published' 必须走 POST /publish,
  // 后者才会执行解压、写 published-plugins.json、同步 git marketplace 等副作用。
  // 允许 PATCH 直接置 published 会造成"状态已发布但文件不存在"的脏状态。
  if (!['approved', 'rejected'].includes(status)) {
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
