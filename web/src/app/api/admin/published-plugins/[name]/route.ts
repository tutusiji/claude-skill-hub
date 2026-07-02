import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth';
import { editPublishedPlugin } from '@/lib/storage';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  // Auth check
  const isAuth = await verifyAuth();
  if (!isAuth) {
    return NextResponse.json({ error: '未授权' }, { status: 401 });
  }

  try {
    const { name } = await params;
    const body = await request.json();
    const { description, category } = body as { description?: string; category?: string };

    if (description === undefined && category === undefined) {
      return NextResponse.json({ error: '未提供要更新的字段' }, { status: 400 });
    }

    const result = editPublishedPlugin(name, { description, category });
    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : '未知错误' },
      { status: 500 }
    );
  }
}
