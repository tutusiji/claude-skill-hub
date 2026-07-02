import { readFileSync, existsSync, readdirSync, statSync, mkdtempSync, rmSync } from 'fs';
import { join, dirname, basename } from 'path';
import { tmpdir } from 'os';
import { execSync } from 'child_process';

export interface ValidationResult {
  passed: boolean;
  errors: string[];
  warnings: string[];
  summary: {
    pluginName?: string;
    version?: string;
    description?: string;
    category?: string;
    skillsCount: number;
    commandsCount: number;
    filesScanned: number;
  };
}

// ─── Schema 定义（从 scripts/schemas/ 内联，避免运行时文件依赖）──────────
interface SchemaProperty {
  type: string;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
}
interface Schema {
  required: string[];
  properties: Record<string, SchemaProperty>;
}
const PLUGIN_SCHEMA: Schema = {
  required: ['name', 'version', 'description'],
  properties: {
    name: { type: 'string', minLength: 1, maxLength: 64, pattern: '^[a-z0-9][a-z0-9-]*$' },
    version: { type: 'string', pattern: '^\\d+\\.\\d+\\.\\d+$' },
    description: { type: 'string', minLength: 10 },
    category: { type: 'string' },
    keywords: { type: 'array' },
    author: { type: 'object' },
  },
};

const SECRET_PATTERNS = [
  /(?:sk-|AKIA|ghp_|gho_|ghs_)[A-Za-z0-9]{20,}/,
  /-----BEGIN (?:RSA |EC )?PRIVATE KEY-----/,
  /[a-zA-Z0-9+/]{40,}={0,2}.*password/i,
];

const SCAN_EXTENSIONS = /\.(md|json|js|ts|py|sh|yaml|yml|txt)$/;

// ─── 工具函数 ──────────────────────────────────────────────

function validateAgainstSchema(obj: Record<string, unknown>, schema: Schema, label: string): string[] {
  const errs: string[] = [];
  for (const field of schema.required) {
    if (!(field in obj)) {
      errs.push(`${label}: 缺少必填字段 "${field}"`);
    }
  }
  if (schema.properties) {
    for (const [key, prop] of Object.entries(schema.properties)) {
      if (key in obj) {
        const val = obj[key];
        if (prop.type === 'string' && typeof val !== 'string') {
          errs.push(`${label}: 字段 "${key}" 必须是字符串`);
        } else if (prop.type === 'array' && !Array.isArray(val)) {
          errs.push(`${label}: 字段 "${key}" 必须是数组`);
        } else if (prop.type === 'object' && (typeof val !== 'object' || Array.isArray(val))) {
          errs.push(`${label}: 字段 "${key}" 必须是对象`);
        } else if (prop.pattern && typeof val === 'string' && !new RegExp(prop.pattern).test(val)) {
          errs.push(`${label}: 字段 "${key}" 格式不正确 (需匹配 ${prop.pattern})`);
        } else if (prop.minLength && typeof val === 'string' && val.length < prop.minLength) {
          errs.push(`${label}: 字段 "${key}" 长度不足，至少 ${prop.minLength} 个字符`);
        }
      }
    }
  }
  return errs;
}

function parseFrontmatter(content: string): Record<string, string> {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return {};
  const fm: Record<string, string> = {};
  for (const line of match[1].split('\n')) {
    const idx = line.indexOf(':');
    if (idx > 0) {
      const key = line.slice(0, idx).trim();
      const val = line.slice(idx + 1).trim().replace(/^["']|["']$/g, '');
      fm[key] = val;
    }
  }
  return fm;
}

function scanSecrets(dir: string, pluginName: string, errors: string[]): number {
  let filesScanned = 0;
  function scanDir(d: string) {
    for (const entry of readdirSync(d)) {
      const fullPath = join(d, entry);
      const stat = statSync(fullPath);
      if (stat.isDirectory() && !entry.startsWith('.') && entry !== 'node_modules') {
        scanDir(fullPath);
      } else if (stat.isFile() && SCAN_EXTENSIONS.test(entry)) {
        filesScanned++;
        const content = readFileSync(fullPath, 'utf-8');
        for (const pattern of SECRET_PATTERNS) {
          if (pattern.test(content)) {
            errors.push(`插件 "${pluginName}": 在 ${entry} 中检测到潜在密钥泄露`);
          }
        }
      }
    }
  }
  scanDir(dir);
  return filesScanned;
}

// ─── 解压 ──────────────────────────────────────────────────

function extractArchive(filepath: string, destDir: string): void {
  const lower = filepath.toLowerCase();
  if (lower.endsWith('.zip')) {
    execSync(`unzip -q -o "${filepath}" -d "${destDir}"`, { stdio: 'pipe' });
  } else if (lower.endsWith('.tar.gz') || lower.endsWith('.tgz')) {
    execSync(`tar -xzf "${filepath}" -C "${destDir}"`, { stdio: 'pipe' });
  } else if (lower.endsWith('.tar')) {
    execSync(`tar -xf "${filepath}" -C "${destDir}"`, { stdio: 'pipe' });
  } else {
    throw new Error(`不支持的文件格式，请上传 .zip 或 .tar.gz 文件`);
  }
}

// 查找插件根目录：优先找 .claude-plugin/plugin.json，回退找 skills/ 目录（纯 skill 包）
// 递归搜索，支持 ZIP 内任意深度的嵌套目录（如 skills-main/skills-main/...）
export type PluginRoot = { path: string; type: 'plugin' | 'skills-only' };

function hasSkillsDir(dir: string): boolean {
  const skillsDir = join(dir, 'skills');
  if (!existsSync(skillsDir)) return false;
  try {
    return readdirSync(skillsDir).some(f => {
      const p = join(skillsDir, f);
      return statSync(p).isDirectory() && existsSync(join(p, 'SKILL.md'));
    });
  } catch { return false; }
}

export function findPluginRoot(dir: string): PluginRoot | null {
  // 优先：检查当前目录是否有 .claude-plugin/plugin.json
  if (existsSync(join(dir, '.claude-plugin', 'plugin.json'))) {
    return { path: dir, type: 'plugin' };
  }
  // 回退：检查当前目录是否有 skills/ + SKILL.md（纯 skill 包）
  if (hasSkillsDir(dir)) {
    return { path: dir, type: 'skills-only' };
  }
  // 递归检查所有子目录
  for (const entry of readdirSync(dir)) {
    if (entry.startsWith('.') || entry === 'node_modules') continue;
    const fullPath = join(dir, entry);
    try {
      if (statSync(fullPath).isDirectory()) {
        const found = findPluginRoot(fullPath);
        if (found) return found;
      }
    } catch { continue; }
  }
  return null;
}

// ─── 主验证函数 ────────────────────────────────────────────

export function validatePluginDir(pluginPath: string, rootType: 'plugin' | 'skills-only' = 'plugin'): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const summary: ValidationResult['summary'] = {
    skillsCount: 0,
    commandsCount: 0,
    filesScanned: 0,
  };

  let manifest: Record<string, unknown>;

  if (rootType === 'skills-only') {
    // 纯 skill 包：没有 plugin.json，从目录名自动生成元数据
    const dirName = basename(pluginPath);
    // 剥离常见后缀：-main, -master, -6.1.0 等版本号
    const cleanName = dirName.replace(/-(main|master)$/, '').replace(/[-.]\d+\.\d+\.\d+$/, '');
    // 尝试从 README.md 提取描述
    let description = `Skill collection from ${cleanName}`;
    const readmePath = join(pluginPath, 'README.md');
    if (existsSync(readmePath)) {
      const readme = readFileSync(readmePath, 'utf-8');
      // 取第一个非空非标题行作为描述
      const lines = readme.split('\n').filter(l => l.trim() && !l.startsWith('#') && !l.startsWith('!'));
      if (lines.length > 0) description = lines[0].trim().slice(0, 200);
    }
    manifest = { name: cleanName, version: '1.0.0', description };
    warnings.push('此包为纯 skill 集合（无 .claude-plugin/plugin.json），已自动生成插件元数据');
  } else {
    // 标准 plugin 包：读取 .claude-plugin/plugin.json
    const manifestPath = join(pluginPath, '.claude-plugin', 'plugin.json');
    if (!existsSync(manifestPath)) {
      errors.push('缺少 .claude-plugin/plugin.json 文件');
      return { passed: false, errors, warnings, summary };
    }

    try {
      manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'));
    } catch (e) {
      errors.push(`plugin.json JSON 解析失败: ${e instanceof Error ? e.message : String(e)}`);
      return { passed: false, errors, warnings, summary };
    }

    // Schema 校验（仅对有 plugin.json 的包）
    errors.push(...validateAgainstSchema(manifest, PLUGIN_SCHEMA, 'plugin.json'));

    // name 与目录名一致（兼容版本化目录名，如 superpowers-6.1.0）
    const dirName = basename(pluginPath);
    const manifestName = manifest.name as string | undefined;
    if (manifestName) {
      const baseDirName = dirName.replace(/[-.]\d+\.\d+\.\d+$/, '');
      if (manifestName !== dirName && manifestName !== baseDirName) {
        errors.push(`plugin.json 的 name "${manifestName}" 与目录名 "${dirName}" 不一致`);
      }
    }
  }

  // 公共：填充 summary
  summary.pluginName = manifest.name as string | undefined;
  summary.version = manifest.version as string | undefined;
  summary.description = manifest.description as string | undefined;
  summary.category = manifest.category as string | undefined;

  // 4. 检查 skills 目录
  const skillsDir = join(pluginPath, 'skills');
  if (existsSync(skillsDir)) {
    const skills = readdirSync(skillsDir).filter(f => statSync(join(skillsDir, f)).isDirectory());
    if (skills.length === 0) {
      warnings.push('skills/ 目录存在但没有子目录');
    }
    for (const skill of skills) {
      const skillMd = join(skillsDir, skill, 'SKILL.md');
      if (!existsSync(skillMd)) {
        warnings.push(`技能 "${skill}" 缺少 SKILL.md 文件`);
      } else {
        const content = readFileSync(skillMd, 'utf-8');
        if (!content.startsWith('---')) {
          warnings.push(`技能 "${skill}" 的 SKILL.md 缺少 YAML frontmatter`);
        } else {
          const fm = parseFrontmatter(content);
          if (!fm.name) {
            warnings.push(`技能 "${skill}" 的 SKILL.md frontmatter 缺少 name 字段`);
          }
          if (!fm.description) {
            warnings.push(`技能 "${skill}" 的 SKILL.md frontmatter 缺少 description 字段`);
          }
        }
        summary.skillsCount++;
      }
    }
  } else {
    warnings.push('缺少 skills/ 目录 — 插件应至少包含一个技能');
  }

  // 5. 检查 commands 目录（可选）
  const commandsDir = join(pluginPath, 'commands');
  if (existsSync(commandsDir)) {
    const commands = readdirSync(commandsDir).filter(f => f.endsWith('.md'));
    summary.commandsCount = commands.length;
  }

  // 6. 密钥扫描
  summary.filesScanned = scanSecrets(pluginPath, (manifest.name as string) || basename(pluginPath), errors);

  return {
    passed: errors.length === 0,
    errors,
    warnings,
    summary,
  };
}

// ─── 解压 + 验证（从上传文件）────────────────────────────

export function validateUploadedFile(filepath: string): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const summary: ValidationResult['summary'] = {
    skillsCount: 0,
    commandsCount: 0,
    filesScanned: 0,
  };

  // 创建临时目录
  const tempDir = mkdtempSync(join(tmpdir(), 'skill-hub-validate-'));

  try {
    // 解压
    try {
      extractArchive(filepath, tempDir);
    } catch (e) {
      errors.push(`解压失败: ${e instanceof Error ? e.message : String(e)}`);
      return { passed: false, errors, warnings, summary };
    }

    // 查找插件根目录（支持 plugin 包和纯 skill 包）
    const pluginRoot = findPluginRoot(tempDir);
    if (!pluginRoot) {
      errors.push('未找到 .claude-plugin/plugin.json 或 skills/ 目录 — 请确保压缩包包含正确的插件或技能结构');
      errors.push('期望结构 A (插件): my-plugin/.claude-plugin/plugin.json + my-plugin/skills/...');
      errors.push('期望结构 B (纯技能): my-skills/skills/<skill-name>/SKILL.md');
      return { passed: false, errors, warnings, summary };
    }

    // 执行验证
    return validatePluginDir(pluginRoot.path, pluginRoot.type);
  } finally {
    // 清理临时目录
    rmSync(tempDir, { recursive: true, force: true });
  }
}
