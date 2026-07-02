import { NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth';
import { getSubmissions } from '@/lib/storage';

export async function GET() {
  if (!(await verifyAuth())) {
    return NextResponse.json({ error: '未授权' }, { status: 401 });
  }

  const submissions = getSubmissions().sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt)
  );

  return NextResponse.json({ submissions });
}
