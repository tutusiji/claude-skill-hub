import { NextResponse } from 'next/server';
import { getPublishedPlugins } from '@/lib/storage';

export async function GET() {
  const plugins = getPublishedPlugins();
  return NextResponse.json({ plugins });
}
