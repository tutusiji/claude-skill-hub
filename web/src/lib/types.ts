export interface PluginSkill {
  name: string;
  description: string;
  path: string;
}

export interface PluginCommand {
  name: string;
  description: string;
}

export interface Plugin {
  name: string;
  description: string;
  source: string;
  version: string;
  category: string;
  type?: 'plugin' | 'skills';
  keywords?: string[];
  author?: { name: string; email?: string };
  skills?: PluginSkill[];
  commands?: PluginCommand[];
  featured?: boolean;
  homepage?: string;
  repository?: string;
  license?: string;
  compatibility?: string[]; // 支持的工具列表，如 ['claude-code', 'codex', 'opencode']
}

// ─── 支持的 AI 编程工具 ────────────────────────────
export interface ToolInfo {
  id: string;
  name: string;
  shortName: string;
  vendor: string;
  installCmd: (pluginName: string, marketplace: string) => string;
  marketplaceCmd: (marketplaceUrl: string) => string;
  configDir: string;
  skillFile: string;
}

export const SUPPORTED_TOOLS: ToolInfo[] = [
  {
    id: 'claude-code',
    name: 'Claude Code',
    shortName: 'Claude',
    vendor: 'Anthropic',
    installCmd: (name, mp) => `claude plugin install ${name}@${mp}`,
    marketplaceCmd: (url) => `claude plugin marketplace add ${url}`,
    configDir: '.claude/',
    skillFile: 'SKILL.md',
  },
  {
    id: 'codex',
    name: 'Codex CLI',
    shortName: 'Codex',
    vendor: 'OpenAI',
    installCmd: (name, _mp) => `codex --plugin ${name}`,
    marketplaceCmd: (url) => `codex config set marketplace ${url}`,
    configDir: '.codex/',
    skillFile: 'AGENTS.md',
  },
  {
    id: 'kimi-code',
    name: 'Kimi Code',
    shortName: 'Kimi',
    vendor: 'Moonshot',
    installCmd: (name, mp) => `kimi plugin install ${name}@${mp}`,
    marketplaceCmd: (url) => `kimi plugin marketplace add ${url}`,
    configDir: '.kimi/',
    skillFile: 'SKILL.md',
  },
  {
    id: 'opencode',
    name: 'OpenCode',
    shortName: 'OpenCode',
    vendor: 'Open Source',
    installCmd: (name, _mp) => `opencode plugin add ${name}`,
    marketplaceCmd: (url) => `opencode config set marketplace ${url}`,
    configDir: '.opencode/',
    skillFile: 'AGENTS.md',
  },
  {
    id: 'codewhale',
    name: 'CodeWhale',
    shortName: 'CodeWhale',
    vendor: 'CodeWhale',
    installCmd: (name, mp) => `codewhale plugin install ${name}@${mp}`,
    marketplaceCmd: (url) => `codewhale plugin marketplace add ${url}`,
    configDir: '.codewhale/',
    skillFile: 'SKILL.md',
  },
];

export const TOOL_MAP: Record<string, ToolInfo> = Object.fromEntries(
  SUPPORTED_TOOLS.map((t) => [t.id, t])
);

export function getToolLabel(toolId: string): string {
  return TOOL_MAP[toolId]?.shortName || toolId;
}

export function getInstallCommands(plugin: Plugin, marketplaceName: string, marketplaceUrl: string): Array<{ tool: string; cmd: string }> {
  const tools = plugin.compatibility || SUPPORTED_TOOLS.map((t) => t.id);
  return tools.map((tid) => {
    const tool = TOOL_MAP[tid];
    if (!tool) return { tool: tid, cmd: '' };
    return { tool: tool.shortName, cmd: tool.installCmd(plugin.name, marketplaceName) };
  });
}

export const CATEGORIES = [
  'developer-tools',
  'devops',
  'security',
  'testing',
  'documentation',
  'data',
  'productivity',
  'utilities',
] as const;

export const CATEGORY_LABELS: Record<string, string> = {
  'developer-tools': '开发工具',
  'devops': 'DevOps',
  'security': '安全',
  'testing': '测试',
  'documentation': '文档',
  'data': '数据',
  'productivity': '效率',
  'utilities': '实用工具',
};

export type SortOption = 'default' | 'name-asc' | 'name-desc' | 'skills-desc' | 'category';

export type ViewMode = 'grid' | 'list';
