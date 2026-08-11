import { readFileSync, existsSync, readdirSync, statSync, writeFileSync, mkdirSync } from 'fs';
import { join, basename, relative } from 'path';
import { callLlm, isLlmConfigured, parseJsonFromLlm } from './llm';
import { DATA_DIR } from './storage';

// ─── 类型定义 ──────────────────────────────────────────────

export type AiRuleCategory = 'security' | 'privacy' | 'external-call' | 'dangerous-code' | 'data-exfiltration' | 'other';
export type AiRuleSeverity = 'high' | 'medium' | 'low';

export interface AiReviewRule {
  id: string;
  name: string;
  category: AiRuleCategory;
  severity: AiRuleSeverity;
  description: string;
  // 正则模式（快速扫描，本地执行，匹配行号）
  patterns?: string[];
  // 需要 LLM 深度分析的 prompt 模板（传入文件内容，返回违规描述）
  llmPrompt?: string;
  // 是否启用
  enabled?: boolean;
}

export interface AiFinding {
  ruleId: string;
  ruleName: string;
  category: AiRuleCategory;
  severity: AiRuleSeverity;
  file: string;
  line?: number;
  snippet?: string;
  description: string;
}

export interface AiReviewResult {
  passed: boolean;
  riskLevel: 'high' | 'medium' | 'low' | 'none';
  findings: AiFinding[];
  filesScanned: number;
  regexChecked: boolean;
  llmChecked: boolean;
  llmError?: string;
  scannedAt: string;
}

// ─── 扫描文件扩展名 ───────────────────────────────────────

const SCAN_EXTENSIONS = /\.(md|json|js|ts|jsx|tsx|py|sh|bash|zsh|yaml|yml|txt|mjs|cjs)$/;
const MAX_FILE_SIZE = 100 * 1024; // 100KB

// ─── 默认规则集 ───────────────────────────────────────────

const DEFAULT_RULES: AiReviewRule[] = [
  // ── 密钥泄露类（高风险）──
  {
    id: 'secrets-api-keys',
    name: 'API 密钥泄露检测',
    category: 'security',
    severity: 'high',
    description: '检测硬编码的 API Key、令牌和凭证',
    llmPrompt: '检测隐藏或混淆的 API 密钥：base64/hex/URL 编码还原后的密钥、字符串分段拼接的密钥、运行时从配置/环境变量兜底并硬编码的真实密钥、形似真实凭据的示例值（sk-、AKIA、ghp_ 等前缀）。给出具体文件、行号与还原方式。',
    patterns: [
      'sk-[A-Za-z0-9]{20,}',
      'AKIA[0-9A-Z]{16}',
      'ghp_[A-Za-z0-9]{20,}',
      'gho_[A-Za-z0-9]{20,}',
      'ghs_[A-Za-z0-9]{20,}',
      'glpat-[A-Za-z0-9\\-_]{20,}',
      'xox[baprs]-[A-Za-z0-9-]{10,}',
      'AIza[0-9A-Za-z\\-_]{35}',
    ],
    enabled: true,
  },
  {
    id: 'secrets-private-keys',
    name: '私钥泄露检测',
    category: 'security',
    severity: 'high',
    description: '检测硬编码的私钥（RSA、EC 等）',
    llmPrompt: '检测代码中嵌入的私钥材料：PEM 头之外的其他编码形式（base64/hex 还原的 RSA/EC/Ed25519 私钥）、以密钥数字参数字面量出现的 RSA 私钥、无头文件的长随机字符串私钥。给出具体文件、行号与还原方式。',
    patterns: [
      '-----BEGIN (?:RSA |EC |DSA |ED25519 )?PRIVATE KEY-----',
      '-----BEGIN OPENSSH PRIVATE KEY-----',
      '-----BEGIN PGP PRIVATE KEY BLOCK-----',
    ],
    enabled: true,
  },
  {
    id: 'secrets-passwords',
    name: '硬编码密码检测',
    category: 'security',
    severity: 'high',
    description: '检测代码中硬编码的密码和凭证',
    patterns: [
      '(?:password|passwd|pwd)\\s*[:=]\\s*["\'][^"\']{6,}["\']',
      '(?:api[_-]?key|secret|token)\\s*[:=]\\s*["\'][^"\']{8,}["\']',
    ],
    llmPrompt: '检测代码中隐藏的敏感凭据：base64 / 十六进制 / 字符串拼接 / 多种编码组合还原后的 API Key、密码、token，或明显为真实凭据的硬编码值；给出具体文件、行号与还原方式。',
    enabled: true,
  },

  // ── 数据外泄类（高风险）──
  {
    id: 'exfil-fetch',
    name: '数据外发检测 (fetch / XHR)',
    category: 'data-exfiltration',
    severity: 'high',
    description: '检测通过 fetch、XMLHttpRequest 等向外发送数据的行为',
    patterns: [
      'fetch\\s*\\(',
      'XMLHttpRequest',
      'navigator\\.sendBeacon',
      'axios\\.(?:get|post|put|delete|request)',
      '\\$\\.ajax\\(',
    ],
    llmPrompt: '判断代码中是否存在"把本地敏感数据发送到外部"的行为：读取文件/环境变量/token 后，通过 fetch、XMLHttpRequest、WebSocket 或图片信标上传到外部 URL；给出具体文件、行号与完整发送链路。',
    enabled: true,
  },
  {
    id: 'exfil-websocket',
    name: 'WebSocket / WebRTC 检测',
    category: 'data-exfiltration',
    severity: 'medium',
    description: '检测 WebSocket、WebRTC 等长连接外发通道',
    llmPrompt: '判断 WebSocket/WebRTC 连接是否用于外泄本地敏感数据：建连后把文件内容、环境变量、键盘输入、剪贴板、token 等推送或发送到远端；区分正常实时协作/推送功能与数据外泄，给出文件、行号与数据来源和去向。',
    patterns: [
      'new\\s+WebSocket\\s*\\(',
      'new\\s+RTCPeerConnection\\s*\\(',
      'wss?://',
    ],
    enabled: true,
  },
  {
    id: 'exfil-img-beacon',
    name: '图片信标检测',
    category: 'data-exfiltration',
    severity: 'low',
    description: '检测通过图片 src 等方式的隐式数据外发',
    llmPrompt: '判断是否存在图片信标等隐蔽外发通道：用 new Image()、<img> src、CSS url()、navigator.sendBeacon 或动态加载资源把本地数据拼进 URL 查询参数/请求体/请求头后发送到外部；给出文件、行号与拼接的数据来源。',
    patterns: [
      'new Image\\(\\)',
      '\\.src\\s*=\\s*["\']https?://.*\\?',
    ],
    enabled: true,
  },

  // ── 外部 API 调用类（中风险）──
  {
    id: 'external-urls',
    name: '外部 URL 引用',
    category: 'external-call',
    severity: 'medium',
    description: '列出所有引用的外部 URL，确认是否为必要调用',
    llmPrompt: '审查引用的所有外部 URL：是否存在可疑域名（URL 混淆、编码域名、可疑子域、指向未知服务器的回调地址），是否与上传数据、下载并执行代码、回传凭据等敏感行为关联；对每个可疑 URL 给出文件、行号与用途。',
    patterns: [
      'https?://[^\\s"\'<>)]+',
    ],
    enabled: true,
  },
  {
    id: 'external-fs',
    name: '文件系统访问',
    category: 'external-call',
    severity: 'medium',
    description: '检测对本地文件系统的读写操作',
    llmPrompt: '判断文件系统操作是否触及敏感目标：读取 ~/.ssh、~/.aws、/etc/passwd、.env、密钥/凭据文件后外发或写入日志；写入可执行文件、篡改配置、写自启脚本等危险行为；给出文件、行号与完整路径。',
    patterns: [
      'require\\s*\\(\\s*["\']fs["\']\\s*\\)',
      "from\\s+['\"]fs['\"]",
      'Deno\\.(?:readTextFile|writeTextFile|readFile|writeFile)',
      'Bun\\.file\\(',
      'FileReader',
      'showOpenFilePicker',
      'showSaveFilePicker',
    ],
    enabled: true,
  },
  {
    id: 'external-shell',
    name: '系统命令执行',
    category: 'external-call',
    severity: 'high',
    description: '检测执行系统命令的代码',
    llmPrompt: '判断命令执行是否可被注入或用于恶意行为：把不可信输入（网络数据、用户输入、文件名）拼进 exec/spawn/sh -c 命令、下载并执行远程脚本、反弹 shell、通过命令读取敏感文件后外发；给出文件、行号与命令构造链路。',
    patterns: [
      'require\\s*\\(\\s*["\']child_process["\']\\s*\\)',
      "from\\s+['\"]child_process['\"]",
      'exec(?:Sync)?\\s*\\(',
      'spawn(?:Sync)?\\s*\\(',
      'Bun\\.shell\\(',
      'Deno\\.run\\(',
      '\\bsh\\s+-c\\s+["\']',
    ],
    enabled: true,
  },

  // ── 危险代码类（中风险）──
  {
    id: 'danger-eval',
    name: '危险函数：eval / Function 构造器',
    category: 'dangerous-code',
    severity: 'high',
    description: '检测 eval()、Function() 构造器等代码注入风险',
    patterns: [
      '\\beval\\s*\\(',
      'new\\s+Function\\s*\\(',
      'setTimeout\\s*\\(\\s*["\']',
      'setInterval\\s*\\(\\s*["\']',
    ],
    llmPrompt: '判断是否存在"从外部获取代码再执行"的危险链路：通过网络请求/文件读取得到内容后，交给 eval、new Function、import 动态执行，或把不可信输入拼进命令执行；给出具体文件、行号与执行链路。',
    enabled: true,
  },
  {
    id: 'danger-dom-xss',
    name: 'DOM XSS 风险',
    category: 'dangerous-code',
    severity: 'high',
    description: '检测可能导致 XSS 的 DOM 操作',
    llmPrompt: '判断是否存在 DOM XSS：把不可信输入（URL 参数、postMessage 消息、用户输入、本地存储数据）写入 innerHTML/outerHTML/document.write/insertAdjacentHTML，或用作 href/src 的 javascript: 伪协议等可执行上下文；给出文件、行号与数据流向。',
    patterns: [
      '\\.innerHTML\\s*=',
      'document\\.write\\s*\\(',
      'document\\.writeln\\s*\\(',
      '\\.outerHTML\\s*=',
      'insertAdjacentHTML',
    ],
    enabled: true,
  },
  {
    id: 'danger-script-inject',
    name: '脚本标签注入',
    category: 'dangerous-code',
    severity: 'high',
    description: '检测动态创建 script 标签的行为',
    llmPrompt: '判断是否从外部加载并执行脚本：动态创建 script 标签指向远程 URL、内联第三方脚本、JSONP 或动态 import 引入不可信代码；给出文件、行号与脚本来源。',
    patterns: [
      'createElement\\s*\\(\\s*["\']script["\']\\s*\\)',
      '<script',
    ],
    enabled: true,
  },
  {
    id: 'danger-rce-chain',
    name: '远程代码执行链路（LLM）',
    category: 'dangerous-code',
    severity: 'high',
    description: '组合链路：外部拉取代码 + 动态执行，或读取敏感文件后外发。正则扫描无法发现此类跨函数/跨文件的组合',
    llmPrompt: '综合审查整个代码库，找出"组合攻击链路"：1) 从网络/外部源获取代码或数据，再通过 eval、Function、child_process 等动态执行；或 2) 读取本地敏感文件（密钥/配置/.env）后通过网络发送到外部。这是跨函数/跨文件的组合，单条正则无法覆盖。务必给出具体文件路径、行号与完整链路描述。',
    enabled: true,
  },

  // ── 隐私收集类（中风险）──
  {
    id: 'privacy-clipboard',
    name: '剪贴板访问',
    category: 'privacy',
    severity: 'medium',
    description: '检测对系统剪贴板的读写操作',
    llmPrompt: '判断剪贴板访问是否窃取用户数据：在无用户交互或后台时读取剪贴板并外发/持久化，或把剪贴板内容写入网络请求；区分必要的复制粘贴功能，给出文件、行号与数据去向。',
    patterns: [
      'navigator\\.clipboard',
      'execCommand\\s*\\(\\s*["\'](?:copy|cut|paste)["\']\\s*\\)',
    ],
    enabled: true,
  },
  {
    id: 'privacy-geolocation',
    name: '地理位置获取',
    category: 'privacy',
    severity: 'medium',
    description: '检测对用户地理位置信息的获取',
    llmPrompt: '判断地理位置获取是否用于追踪：取得 geolocation 后上传到外部服务器、存储并持续上报、与用户身份关联；区分页面必要的位置功能，给出文件、行号与数据去向。',
    patterns: [
      'navigator\\.geolocation',
      'getCurrentPosition',
      'watchPosition',
    ],
    enabled: true,
  },
  {
    id: 'privacy-media',
    name: '摄像头/麦克风访问',
    category: 'privacy',
    severity: 'high',
    description: '检测对摄像头、麦克风等媒体设备的访问',
    llmPrompt: '判断摄像头/麦克风是否被滥用：在无明确用户提示时启动 getUserMedia、把媒体流通过 WebRTC/录制上传到外部、静默采集画面声音；给出文件、行号与媒体流去向。',
    patterns: [
      'getUserMedia',
      'getDisplayMedia',
      'navigator\\.mediaDevices',
    ],
    enabled: true,
  },
  {
    id: 'privacy-storage',
    name: '本地存储访问',
    category: 'privacy',
    severity: 'low',
    description: '检测对 localStorage、sessionStorage、IndexedDB 的访问',
    llmPrompt: '判断本地存储访问是否窃取数据：读取 localStorage/sessionStorage/IndexedDB/cookie 中的敏感信息（token、用户数据、历史）后外发到外部或写入日志/上传；区分正常缓存读写，给出文件、行号与数据去向。',
    patterns: [
      'localStorage',
      'sessionStorage',
      'indexedDB',
      'document\\.cookie',
    ],
    enabled: true,
  },
];

// ─── 规则持久化 ───────────────────────────────────────────

const RULES_FILE = process.env.AI_REVIEW_RULES_FILE
  || join(DATA_DIR, 'ai-review-rules.json');

let cachedRules: AiReviewRule[] | null = null;

export function getAiReviewRules(): AiReviewRule[] {
  if (cachedRules) return cachedRules;

  // 尝试从数据文件加载
  if (RULES_FILE && existsSync(RULES_FILE)) {
    try {
      const saved = JSON.parse(readFileSync(RULES_FILE, 'utf-8'));
      if (Array.isArray(saved) && saved.length > 0) {
        cachedRules = saved;
        return cachedRules;
      }
    } catch { /* fall back to defaults */ }
  }

  cachedRules = [...DEFAULT_RULES];
  return cachedRules;
}

export function saveAiReviewRules(rules: AiReviewRule[]): void {
  cachedRules = rules;
  if (RULES_FILE) {
    try {
      mkdirSync(join(RULES_FILE, '..'), { recursive: true });
      writeFileSync(RULES_FILE, JSON.stringify(rules, null, 2));
    } catch (e) {
      console.error('Failed to save AI review rules:', e);
    }
  }
}

export function resetAiReviewRules(): AiReviewRule[] {
  cachedRules = [...DEFAULT_RULES];
  if (RULES_FILE) {
    try {
      writeFileSync(RULES_FILE, JSON.stringify(cachedRules, null, 2));
    } catch { /* ignore */ }
  }
  return cachedRules;
}

// ─── 第一层：正则扫描 ─────────────────────────────────────

function scanFileWithRegex(
  filePath: string,
  relativePath: string,
  rules: AiReviewRule[],
): AiFinding[] {
  const findings: AiFinding[] = [];

  // 跳过大文件
  try {
    if (statSync(filePath).size > MAX_FILE_SIZE) return findings;
  } catch { return findings; }

  let content: string;
  try {
    content = readFileSync(filePath, 'utf-8');
  } catch { return findings; }

  const lines = content.split('\n');

  for (const rule of rules) {
    if (rule.enabled === false) continue;
    if (!rule.patterns || rule.patterns.length === 0) continue;

    for (const patternStr of rule.patterns) {
      try {
        const regex = new RegExp(patternStr, 'i');
        for (let i = 0; i < lines.length; i++) {
          if (regex.test(lines[i])) {
            findings.push({
              ruleId: rule.id,
              ruleName: rule.name,
              category: rule.category,
              severity: rule.severity,
              file: relativePath,
              line: i + 1,
              snippet: lines[i].trim().slice(0, 200),
              description: `${rule.description}（匹配模式: ${patternStr}）`,
            });
            // 每个规则每个文件最多报 5 处，避免刷屏
            const countForRule = findings.filter(f => f.ruleId === rule.id && f.file === relativePath).length;
            if (countForRule >= 5) break;
          }
        }
      } catch { /* 非法正则，跳过 */ }
    }
  }

  return findings;
}

function collectFiles(dir: string, baseDir: string, files: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry.startsWith('.') || entry === 'node_modules') continue;
    const fullPath = join(dir, entry);
    try {
      const stat = statSync(fullPath);
      if (stat.isDirectory()) {
        collectFiles(fullPath, baseDir, files);
      } else if (stat.isFile() && SCAN_EXTENSIONS.test(entry)) {
        files.push(fullPath);
      }
    } catch { /* ignore */ }
  }
  return files;
}

// ─── 第二层：LLM 深度审查 ─────────────────────────────────

async function llmDeepReview(
  dir: string,
  rules: AiReviewRule[],
): Promise<{ findings: AiFinding[]; error?: string }> {
  const findings: AiFinding[] = [];

  if (!isLlmConfigured()) {
    return { findings, error: 'LLM 未配置，跳过深度审查' };
  }

  // 收集所有需要 LLM 审查的规则
  const llmRules = rules.filter(r => r.enabled !== false && r.llmPrompt);
  if (llmRules.length === 0) {
    return { findings };
  }

  // 收集所有待审查文件的内容（限大小）
  const files = collectFiles(dir, dir);
  const fileContents: Array<{ path: string; content: string }> = [];
  let totalSize = 0;
  for (const f of files) {
    try {
      const content = readFileSync(f, 'utf-8');
      if (totalSize + content.length > 50 * 1024) break; // 限制总输入 50KB
      fileContents.push({ path: relative(dir, f), content });
      totalSize += content.length;
    } catch { /* ignore */ }
  }

  if (fileContents.length === 0) return { findings };

  // 构造系统提示
  const rulesDescription = llmRules.map(r =>
    `- [${r.id}] ${r.name} (${r.severity}): ${r.llmPrompt || r.description}`
  ).join('\n');

  const systemPrompt = `你是一个代码安全审查助手。请审查以下 skill/插件代码文件是否存在安全风险。

需要逐条检查的规则：
${rulesDescription}

请逐条对照上述规则审查；某条规则在代码中无对应行为时不必报告，只报告有具体代码证据的发现，优先覆盖高风险规则。

请返回严格的 JSON 格式：
{
  "findings": [
    {
      "ruleId": "规则ID",
      "file": "文件路径",
      "line": 行号（可选）,
      "description": "具体违规描述"
    }
  ]
}

如果没有发现任何问题，返回 {"findings": []}。只返回 JSON，不要解释或其他文字。`;

  const userContent = fileContents.map(fc =>
    `=== 文件: ${fc.path} ===\n${fc.content}`
  ).join('\n\n');

  console.log(`[ai-review] LLM 深度审查调用：${llmRules.length} 条规则 / ${fileContents.length} 个文件 / ${totalSize} 字符`);

  try {
    const response = await callLlm([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userContent },
    ], { temperature: 0.1, maxTokens: 4096 });

    const parsed = parseJsonFromLlm(response) as { findings?: Array<{ ruleId: string; file: string; line?: number; description: string }> };
    const llmFindings = parsed.findings || [];
    console.log(`[ai-review] LLM 深度审查完成：返回 ${llmFindings.length} 条发现`);

    for (const f of llmFindings) {
      const rule = llmRules.find(r => r.id === f.ruleId);
      if (!rule) continue;
      findings.push({
        ruleId: rule.id,
        ruleName: rule.name,
        category: rule.category,
        severity: rule.severity,
        file: f.file,
        line: f.line,
        description: f.description,
      });
    }
  } catch (e) {
    return { findings, error: e instanceof Error ? e.message : String(e) };
  }

  return { findings };
}

// ─── 主审查函数 ───────────────────────────────────────────

export async function runAiReview(dir: string): Promise<AiReviewResult> {
  const rules = getAiReviewRules();
  const allFindings: AiFinding[] = [];

  // 第一层：正则扫描
  const files = collectFiles(dir, dir);
  for (const filePath of files) {
    const relPath = relative(dir, filePath);
    const fileFindings = scanFileWithRegex(filePath, relPath, rules);
    allFindings.push(...fileFindings);
  }

  // 第二层：LLM 深度审查（可选）
  let llmChecked = false;
  let llmError: string | undefined;
  if (isLlmConfigured()) {
    llmChecked = true;
    const llmResult = await llmDeepReview(dir, rules);
    if (llmResult.error) {
      llmError = llmResult.error;
    } else {
      // 去重：LLM 发现 + 正则发现（按 ruleId + file + line 去重）
      const seen = new Set(allFindings.map(f => `${f.ruleId}:${f.file}:${f.line || ''}`));
      for (const f of llmResult.findings) {
        const key = `${f.ruleId}:${f.file}:${f.line || ''}`;
        if (!seen.has(key)) {
          allFindings.push(f);
          seen.add(key);
        }
      }
    }
  }

  // 计算风险等级
  const highCount = allFindings.filter(f => f.severity === 'high').length;
  const mediumCount = allFindings.filter(f => f.severity === 'medium').length;
  let riskLevel: 'high' | 'medium' | 'low' | 'none' = 'none';
  if (highCount > 0) riskLevel = 'high';
  else if (mediumCount > 0) riskLevel = 'medium';
  else if (allFindings.length > 0) riskLevel = 'low';

  return {
    passed: highCount === 0, // 有高风险问题则不通过
    riskLevel,
    findings: allFindings.sort((a, b) => {
      const sevOrder = { high: 0, medium: 1, low: 2 };
      return sevOrder[a.severity] - sevOrder[b.severity];
    }),
    filesScanned: files.length,
    regexChecked: true,
    llmChecked,
    llmError,
    scannedAt: new Date().toISOString(),
  };
}
