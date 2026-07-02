import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth';
import { setPluginPublished } from '@/lib/storage';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  if (!(await verifyAuth())) {
    return NextResponse.json({ error: '未授权' }, { status: 401 });
  }

  const { name } = await params;
  const { published } = await request.json();

  setPluginPublished(name, published);

  return NextResponse.json({
    success: true,
    plugin: name,
    published,
  });
}
