import { NextResponse } from 'next/server';
import { getPluginStats, getPluginStatusMap, getRecentDownloads } from '@/lib/storage';

export async function GET() {
  const stats = getPluginStats();
  const statusMap = getPluginStatusMap();
  const recent = getRecentDownloads(20);

  // Compute top downloads
  const sorted = Object.entries(stats)
    .sort((a, b) => b[1] - a[1])
    .map(([name, count]) => ({ name, count }));

  return NextResponse.json({
    stats,
    topDownloads: sorted,
    statusMap,
    recentDownloads: recent,
  });
}
