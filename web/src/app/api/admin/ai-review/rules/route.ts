import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth';
import {
  getAiReviewRules,
  saveAiReviewRules,
  resetAiReviewRules,
  type AiReviewRule,
} from '@/lib/ai-review';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// 获取所有审查规则
export async function GET() {
  if (!(await verifyAuth())) {
    return NextResponse.json({ error: '未授权' }, { status: 401 });
  }

  const rules = getAiReviewRules();
  return NextResponse.json({ rules });
}

// 更新审查规则（全量替换）
export async function PUT(request: NextRequest) {
  if (!(await verifyAuth())) {
    return NextResponse.json({ error: '未授权' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const rules = body.rules as AiReviewRule[];

    if (!Array.isArray(rules)) {
      return NextResponse.json({ error: 'rules 必须是数组' }, { status: 400 });
    }

    // 基本校验
    for (const rule of rules) {
      if (!rule.id || !rule.name || !rule.category || !rule.severity) {
        return NextResponse.json(
          { error: '每条规则必须包含 id、name、category、severity 字段' },
          { status: 400 },
        );
      }
    }

    saveAiReviewRules(rules);
    return NextResponse.json({ success: true, rules: getAiReviewRules() });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 400 },
    );
  }
}

// 重置为默认规则（POST /reset 则单独建一个，这里用 action 字段或单独路由）
// 使用 POST body.action = 'reset'
export async function POST(request: NextRequest) {
  if (!(await verifyAuth())) {
    return NextResponse.json({ error: '未授权' }, { status: 401 });
  }

  try {
    const body = await request.json();
    if (body.action === 'reset') {
      const rules = resetAiReviewRules();
      return NextResponse.json({ success: true, rules });
    }
    return NextResponse.json({ error: '未知操作' }, { status: 400 });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 400 },
    );
  }
}
