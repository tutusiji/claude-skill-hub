// LLM 调用封装 — 支持 OpenAI 兼容接口 与 Anthropic Messages API
// 配置来源：管理员在后台「大模型配置」保存的 data/llm-config.json（优先），
// 未保存时回退到环境变量 AI_REVIEW_API_URL / AI_REVIEW_API_KEY / AI_REVIEW_MODEL

import { getLlmConfig, type LlmConfig, type LlmProvider } from './llm-config';

export interface LlmMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LlmOptions {
  temperature?: number;
  maxTokens?: number;
}

export function isLlmConfigured(): boolean {
  const c = getLlmConfig();
  return !!(c.apiBaseUrl.trim() && c.apiKey.trim());
}

// 追加路径：避免重复拼接（如 base 已以 /v1/messages 或 /chat/completions 结尾）
function joinUrl(base: string, ...paths: string[]): string {
  const clean = base.trim().replace(/\/+$/, '');
  const parts = paths.map((p) => p.replace(/^\/+|\/+$/g, ''));
  return [clean, ...parts].join('/');
}

// 发起请求并把网络层错误转成可读信息（连接失败比 HTTP 错误码更常见）
async function requestLlm(url: string, init: RequestInit): Promise<Response> {
  try {
    return await fetch(url, init);
  } catch (e) {
    const cause = (e as { cause?: { code?: string; message?: string } })?.cause;
    const code = cause?.code ? ` (${cause.code})` : '';
    throw new Error(`无法连接到 LLM 服务：${url}${code}`);
  }
}

export function buildEndpoint(provider: LlmProvider, apiBaseUrl: string): string {
  const base = apiBaseUrl.trim();
  if (provider === 'anthropic') {
    if (/\/messages\/?$/.test(base)) return base.replace(/\/+$/, '');
    if (/\/v1\/?$/.test(base)) return joinUrl(base, 'messages');
    return joinUrl(base, 'v1/messages');
  }
  if (/\/chat\/completions\/?$/.test(base)) return base.replace(/\/+$/, '');
  return joinUrl(base, 'chat/completions');
}

export async function callLlm(
  messages: LlmMessage[],
  options: LlmOptions = {},
): Promise<string> {
  return callLlmWithConfig(messages, options, getLlmConfig());
}

// 使用指定配置调用（供后台「测试连接」用未保存的表单值）
export async function callLlmWithConfig(
  messages: LlmMessage[],
  options: LlmOptions,
  config: LlmConfig,
): Promise<string> {
  if (!config.apiBaseUrl.trim() || !config.apiKey.trim()) {
    throw new Error('LLM 未配置（缺少 apiBaseUrl 或 apiKey）');
  }
  const endpoint = buildEndpoint(config.provider, config.apiBaseUrl);
  const temperature = options.temperature ?? config.temperature;
  const maxTokens = options.maxTokens ?? config.maxTokens;
  return config.provider === 'anthropic'
    ? callAnthropic(endpoint, config, messages, temperature, maxTokens)
    : callOpenAi(endpoint, config, messages, temperature, maxTokens);
}

async function callOpenAi(
  endpoint: string,
  config: LlmConfig,
  messages: LlmMessage[],
  temperature: number,
  maxTokens: number,
): Promise<string> {
  const res = await requestLlm(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.model,
      messages,
      temperature,
      max_tokens: maxTokens,
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`LLM 调用失败 (${res.status}): ${errText.slice(0, 500)}`);
  }

  const data = await res.json();
  const msg = data.choices?.[0]?.message;
  let content: unknown = msg?.content;
  // DeepSeek 推理模型有时把回答放在 reasoning_content，content 为空串
  if (typeof content !== 'string' || content.trim() === '') {
    const reasoning = msg?.reasoning_content;
    if (typeof reasoning === 'string' && reasoning.trim() !== '') content = reasoning;
  }
  if (typeof content !== 'string') {
    throw new Error('LLM 返回格式异常：缺少 choices[0].message.content');
  }
  return content;
}

async function callAnthropic(
  endpoint: string,
  config: LlmConfig,
  messages: LlmMessage[],
  temperature: number,
  maxTokens: number,
): Promise<string> {
  // Anthropic：system 消息放到顶层 system 字段，messages 只保留 user/assistant
  const system = messages.filter((m) => m.role === 'system').map((m) => m.content).join('\n\n');
  const rest = messages
    .filter((m) => m.role !== 'system')
    .map((m) => ({ role: m.role, content: m.content }));
  if (rest.length === 0) {
    throw new Error('Anthropic 需要至少一条 user 或 assistant 消息');
  }

  const res = await requestLlm(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': config.apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: config.model,
      ...(system ? { system } : {}),
      messages: rest,
      temperature,
      max_tokens: maxTokens,
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`LLM 调用失败 (${res.status}): ${errText.slice(0, 500)}`);
  }

  const data = await res.json();
  // 取第一个 type === 'text' 的 block（跳过 thinking 等扩展思考块，DeepSeek/带思考的 Claude 都会返回）
  const blocks = Array.isArray(data.content) ? data.content : [];
  const textBlock = blocks.find(
    (b: { type?: string; text?: string }) => b?.type === 'text' && typeof b.text === 'string',
  );
  const content = textBlock?.text;
  if (typeof content !== 'string') {
    throw new Error('LLM 返回格式异常：缺少 content 中 type=text 的文本块');
  }
  return content;
}

// 解析 LLM 返回的 JSON（兼容 ```json 包裹的情况）
export function parseJsonFromLlm(text: string): unknown {
  // 尝试直接解析
  try {
    return JSON.parse(text.trim());
  } catch { /* fall through */ }

  // 尝试提取 ```json ... ``` 块
  const match = text.match(/```(?:json)?\s*\n([\s\S]*?)\n```/i);
  if (match) {
    try {
      return JSON.parse(match[1].trim());
    } catch { /* fall through */ }
  }

  // 尝试找第一个 { 到最后一个 }
  const first = text.indexOf('{');
  const last = text.lastIndexOf('}');
  if (first >= 0 && last > first) {
    try {
      return JSON.parse(text.slice(first, last + 1));
    } catch { /* fall through */ }
  }

  throw new Error('无法从 LLM 响应中解析 JSON');
}
