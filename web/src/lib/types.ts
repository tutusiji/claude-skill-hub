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
