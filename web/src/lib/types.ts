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
  keywords?: string[];
  author?: { name: string; email?: string };
  skills?: PluginSkill[];
  commands?: PluginCommand[];
  featured?: boolean;
  homepage?: string;
  repository?: string;
  license?: string;
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
