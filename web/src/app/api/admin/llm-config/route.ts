import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth';
import { getLlmConfig, saveLlmConfig, resetLlmConfig, isValidLlmConfig } from '@/lib/llm-config';
import { callLlmWithConfig } from '@/lib/llm';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// 获取当前 LLM 配置（未保存时回退到环境变量/默认值）
export async function GET() {
  if (!(await verifyAuth())) {
    return NextResponse.json({ error: '未授权' }, { status: 401 });
  }
  return NextResponse.json({ config: getLlmConfig() });
}

// 保存配置（全量替换，含 apiKey）
export async function PUT(request: NextRequest) {
  if (!(await verifyAuth())) {
    return NextResponse.json({ error: '未授权' }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  if (!isValidLlmConfig(body)) {
    return NextResponse.json(
      { error: '配置无效：provider 必须是 openai/anthropic，且需提供 apiBaseUrl、apiKey、model，temperature(0-2)，maxTokens(正整数)' },
      { status: 400 },
    );
  }
  return NextResponse.json({ config: saveLlmConfig(body) });
}

// POST 动作：reset 恢复默认；test 用传入的（未保存的）配置测试连接
export async function POST(request: NextRequest) {
  if (!(await verifyAuth())) {
    return NextResponse.json({ error: '未授权' }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const action = body?.action;

  if (action === 'reset') {
    return NextResponse.json({ config: resetLlmConfig() });
  }

  if (action === 'test') {
    const cfg = body?.config;
    if (!isValidLlmConfig(cfg) || !cfg.apiKey.trim()) {
      return NextResponse.json(
        { ok: false, error: '请先填写完整的配置（含 apiKey）再测试连接' },
        { status: 400 },
      );
    }
    try {
      const reply = await callLlmWithConfig(
        [
          { role: 'system', content: '你是一个连接测试助手。请只回复两个字符：OK' },
          { role: 'user', content: 'Ping' },
        ],
        { temperature: 0, maxTokens: 16 },
        cfg,
      );
      return NextResponse.json({ ok: true, reply: reply.slice(0, 200) });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return NextResponse.json({ ok: false, error: msg }, { status: 502 });
    }
  }

  return NextResponse.json({ error: `未知操作: ${action}` }, { status: 400 });
}
