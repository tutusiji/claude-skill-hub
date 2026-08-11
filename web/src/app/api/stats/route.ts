import { NextResponse } from 'next/server';
import { getPluginStats, getPluginInstalls, getPluginStatusMap, getRecentDownloads } from '@/lib/storage';

export async function GET() {
  const stats = getPluginStats();
  const installs = getPluginInstalls();
  const statusMap = getPluginStatusMap();
  const recent = getRecentDownloads(20);

  // Compute top downloads (ZIP 下载)
  const sorted = Object.entries(stats)
    .sort((a, b) => b[1] - a[1])
    .map(([name, count]) => ({ name, count }));

  // Compute top install intents（复制安装命令）
  const sortedInstalls = Object.entries(installs)
    .sort((a, b) => b[1] - a[1])
    .map(([name, count]) => ({ name, count }));

  return NextResponse.json({
    stats,
    installs,
    topDownloads: sorted,
    topInstalls: sortedInstalls,
    statusMap,
    recentDownloads: recent,
  });
}
