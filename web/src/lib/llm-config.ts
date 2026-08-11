// LLM 配置持久化 — 管理员可在后台「大模型配置」页运行期修改，保存到 data/llm-config.json
// 未保存配置文件时回退到环境变量 AI_REVIEW_API_URL / AI_REVIEW_API_KEY / AI_REVIEW_MODEL（保持旧的 OpenAI 兼容行为）
// 注意：apiKey 明文存于 DATA_DIR/llm-config.json（运行时数据目录，web/data/ 已在 .gitignore 中，不会被提交到 git）

import { existsSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'fs';
import { join, dirname } from 'path';
import { DATA_DIR } from './storage';

export type LlmProvider = 'openai' | 'anthropic';

export interface LlmConfig {
  provider: LlmProvider;
  apiBaseUrl: string;
  apiKey: string;
  model: string;
  temperature: number;
  maxTokens: number;
}

export const LLM_CONFIG_FILE = join(DATA_DIR, 'llm-config.json');

const PROVIDERS: readonly LlmProvider[] = ['openai', 'anthropic'];

// 各 provider 的默认端点与模型（管理员切换 provider 时用于预填）
export const PROVIDER_PRESETS: Record<LlmProvider, { apiBaseUrl: string; model: string }> = {
  openai: { apiBaseUrl: 'https://api.openai.com/v1', model: 'gpt-4o-mini' },
  anthropic: { apiBaseUrl: 'https://api.anthropic.com', model: 'claude-sonnet-4-5' },
};

export const DEFAULT_LLM_CONFIG: LlmConfig = {
  provider: 'openai',
  apiBaseUrl: PROVIDER_PRESETS.openai.apiBaseUrl,
  apiKey: '',
  model: PROVIDER_PRESETS.openai.model,
  temperature: 0.2,
  maxTokens: 2048,
};

export function isValidLlmConfig(c: unknown): c is LlmConfig {
  if (!c || typeof c !== 'object') return false;
  const o = c as Record<string, unknown>;
  return (
    PROVIDERS.includes(o.provider as LlmProvider) &&
    typeof o.apiBaseUrl === 'string' && o.apiBaseUrl.trim().length > 0 &&
    typeof o.apiKey === 'string' &&
    typeof o.model === 'string' && o.model.trim().length > 0 &&
    typeof o.temperature === 'number' && o.temperature >= 0 && o.temperature <= 2 &&
    typeof o.maxTokens === 'number' && Number.isInteger(o.maxTokens) && o.maxTokens >= 1 && o.maxTokens <= 128000
  );
}

function normalize(c: Partial<LlmConfig>): LlmConfig {
  return {
    provider: PROVIDERS.includes(c.provider as LlmProvider) ? (c.provider as LlmProvider) : DEFAULT_LLM_CONFIG.provider,
    apiBaseUrl: (c.apiBaseUrl ?? '').trim() || DEFAULT_LLM_CONFIG.apiBaseUrl,
    apiKey: c.apiKey ?? '',
    model: (c.model ?? '').trim() || DEFAULT_LLM_CONFIG.model,
    temperature:
      typeof c.temperature === 'number'
        ? Math.min(2, Math.max(0, c.temperature))
        : DEFAULT_LLM_CONFIG.temperature,
    maxTokens:
      typeof c.maxTokens === 'number' && Number.isInteger(c.maxTokens)
        ? Math.min(128000, Math.max(1, c.maxTokens))
        : DEFAULT_LLM_CONFIG.maxTokens,
  };
}

let cached: LlmConfig | null = null;

export function getLlmConfig(): LlmConfig {
  if (cached) return cached;

  // 1) 优先使用保存的配置文件（管理员在后台写入；一旦存在即作为权威来源）
  if (existsSync(LLM_CONFIG_FILE)) {
    try {
      const raw = JSON.parse(readFileSync(LLM_CONFIG_FILE, 'utf-8')) as Partial<LlmConfig>;
      if (raw && typeof raw === 'object' && typeof raw.apiKey === 'string') {
        cached = normalize(raw);
        return cached;
      }
    } catch {
      // 文件损坏则回退
    }
  }

  // 2) 未保存 → 回退到环境变量
  const env: Partial<LlmConfig> = {};
  if (process.env.AI_REVIEW_API_URL) env.apiBaseUrl = process.env.AI_REVIEW_API_URL;
  if (process.env.AI_REVIEW_API_KEY) env.apiKey = process.env.AI_REVIEW_API_KEY;
  if (process.env.AI_REVIEW_MODEL) env.model = process.env.AI_REVIEW_MODEL;
  cached = normalize({ ...DEFAULT_LLM_CONFIG, ...env });
  return cached;
}

export function saveLlmConfig(config: LlmConfig): LlmConfig {
  if (!isValidLlmConfig(config)) {
    throw new Error('LLM 配置无效：请检查 provider、apiBaseUrl、apiKey、model、temperature(0-2)、maxTokens(正整数)');
  }
  const normalized = normalize(config);
  try {
    mkdirSync(dirname(LLM_CONFIG_FILE), { recursive: true });
    writeFileSync(LLM_CONFIG_FILE, JSON.stringify(normalized, null, 2));
  } catch (e) {
    console.error('Failed to save LLM config:', e);
  }
  cached = normalized;
  return normalized;
}

// 恢复默认：删除配置文件，使 getLlmConfig 重新回退到环境变量/默认值
export function resetLlmConfig(): LlmConfig {
  try {
    if (existsSync(LLM_CONFIG_FILE)) rmSync(LLM_CONFIG_FILE);
  } catch (e) {
    console.error('Failed to reset LLM config:', e);
  }
  cached = null;
  return getLlmConfig();
}
