import { NextRequest, NextResponse } from 'next/server';
import { incrementDownload } from '@/lib/storage';

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  const { name } = await params;
  incrementDownload(name);
  return NextResponse.json({ success: true });
}
