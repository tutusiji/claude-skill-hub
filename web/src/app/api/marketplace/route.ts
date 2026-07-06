import { NextResponse } from 'next/server';
import { getPublishedPlugins } from '@/lib/storage';
import registry from '@/lib/registry.json';
import type { Plugin } from '@/lib/types';

export const runtime = 'nodejs';

export async function GET() {
  // 合并静态 registry 和动态已发布插件
  const staticPlugins = registry as Plugin[];
  const dynamicPlugins = getPublishedPlugins();
  const staticNames = new Set(staticPlugins.map(p => p.name));
  const allPlugins = [...staticPlugins, ...dynamicPlugins.filter(p => !staticNames.has(p.name))];

  // 构建 marketplace.json 格式
  const marketplace = {
    name: 'skill-hub',
    description: '内部 Claude Code 技能市场 — 浏览、搜索并安装内部技能和插件',
    owner: {
      name: 'Skill Hub',
    },
    plugins: allPlugins.map((p) => {
      const isSkillPack = p.type === 'skills';
      return {
        name: p.name,
        description: p.description,
        category: p.category,
        version: p.version,
        source: {
          source: 'url',
          url: `${process.env.NEXT_PUBLIC_APP_URL || 'https://joox.cc:7504'}/api/plugins/${p.name}/download-zip`,
        },
      };
    }),
  };

  return NextResponse.json(marketplace, {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache',
    },
  });
}
