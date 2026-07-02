import { readFileSync, writeFileSync, existsSync, mkdirSync, unlinkSync, readdirSync, statSync } from 'fs';
import { join, isAbsolute, basename } from 'path';
import { execSync } from 'child_process';
import type { Plugin, PluginSkill, PluginCommand } from './types';
import { findPluginRoot } from './validator';

// ─── Directory Setup ───────────────────────────────────────
function resolveDir(envVar: string | undefined, fallback: string): string {
  if (!envVar) return join(process.cwd(), fallback);
  return isAbsolute(envVar) ? envVar : join(process.cwd(), envVar);
}

export const DATA_DIR = resolveDir(process.env.DATA_DIR, 'data');
export const UPLOAD_DIR = resolveDir(process.env.UPLOAD_DIR, 'uploads');
export const PUBLISHED_PLUGINS_DIR = join(DATA_DIR, 'plugins');

mkdirSync(DATA_DIR, { recursive: true });
mkdirSync(UPLOAD_DIR, { recursive: true });
mkdirSync(PUBLISHED_PLUGINS_DIR, { recursive: true });

// ─── File Paths ────────────────────────────────────────────
const SUBMISSIONS_FILE = join(DATA_DIR, 'submissions.json');
const PLUGIN_STATS_FILE = join(DATA_DIR, 'plugin-stats.json');
const PLUGIN_STATUS_FILE = join(DATA_DIR, 'plugin-status.json');
const DOWNLOAD_LOG_FILE = join(DATA_DIR, 'download-log.json');
const PUBLISHED_PLUGINS_FILE = join(DATA_DIR, 'published-plugins.json');

// ─── Types ─────────────────────────────────────────────────
export interface Submission {
  id: string;
  name: string;
  employeeId: string;
  email: string;
  department: string;
  description: string;
  filename: string;
  filepath: string;
  status: 'pending' | 'approved' | 'rejected' | 'published';
  createdAt: string;
}

export interface PublishedPlugin extends Plugin {
  submissionId: string;
  publishedAt: string;
  contributor: { name: string; department: string };
}

export interface DownloadLogEntry {
  pluginName: string;
  timestamp: string;
}

// ─── Init ──────────────────────────────────────────────────
function initFile(filepath: string, defaultValue: unknown) {
  if (!existsSync(filepath)) {
    writeFileSync(filepath, JSON.stringify(defaultValue, null, 2));
  }
}

initFile(SUBMISSIONS_FILE, []);
initFile(PLUGIN_STATS_FILE, {});
initFile(PLUGIN_STATUS_FILE, {});
initFile(DOWNLOAD_LOG_FILE, []);
initFile(PUBLISHED_PLUGINS_FILE, []);

// ─── Helpers ───────────────────────────────────────────────
function readJSON<T>(filepath: string): T {
  return JSON.parse(readFileSync(filepath, 'utf-8'));
}

function writeJSON(filepath: string, data: unknown) {
  writeFileSync(filepath, JSON.stringify(data, null, 2));
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

// ─── Submissions ───────────────────────────────────────────
export function getSubmissions(): Submission[] {
  return readJSON<Submission[]>(SUBMISSIONS_FILE);
}

export function getSubmission(id: string): Submission | undefined {
  return getSubmissions().find((s) => s.id === id);
}

export function addSubmission(sub: Submission) {
  const all = getSubmissions();
  all.push(sub);
  writeJSON(SUBMISSIONS_FILE, all);
}

export function updateSubmissionStatus(id: string, status: Submission['status']) {
  const all = getSubmissions();
  const sub = all.find((s) => s.id === id);
  if (sub) {
    sub.status = status;
    writeJSON(SUBMISSIONS_FILE, all);
  }
  return sub;
}

export function deleteSubmission(id: string): { success: boolean; error?: string } {
  const all = getSubmissions();
  const sub = all.find((s) => s.id === id);
  if (!sub) return { success: false, error: '未找到提交' };

  // Delete uploaded file
  const fullFilepath = join(UPLOAD_DIR, sub.filepath);
  if (existsSync(fullFilepath)) {
    try { unlinkSync(fullFilepath); } catch { /* ignore */ }
  }

  // Remove from submissions
  writeJSON(SUBMISSIONS_FILE, all.filter((s) => s.id !== id));

  // Also unpublish if published
  const published = getPublishedPlugins();
  const pluginEntry = published.find((p) => p.submissionId === id);
  if (pluginEntry) {
    writeJSON(PUBLISHED_PLUGINS_FILE, published.filter((p) => p.submissionId !== id));
    const pluginDir = join(PUBLISHED_PLUGINS_DIR, pluginEntry.name);
    if (existsSync(pluginDir)) {
      try { execSync(`rm -rf "${pluginDir}"`); } catch { /* ignore */ }
    }
  }

  return { success: true };
}

// ─── Publish Submission ────────────────────────────────────
export function publishSubmission(id: string): { success: boolean; plugin?: PublishedPlugin; error?: string } {
  const sub = getSubmission(id);
  if (!sub) return { success: false, error: '未找到提交' };
  const fullFilepath = join(UPLOAD_DIR, sub.filepath);
  if (!existsSync(fullFilepath)) return { success: false, error: '上传文件不存在' };

  const tmpDir = join(DATA_DIR, 'tmp', id);
  mkdirSync(tmpDir, { recursive: true });

  try {
    // Extract archive
    const lower = fullFilepath.toLowerCase();
    if (lower.endsWith('.zip')) {
      execSync(`unzip -q -o "${fullFilepath}" -d "${tmpDir}"`, { stdio: 'pipe' });
    } else if (lower.endsWith('.tar.gz') || lower.endsWith('.tgz')) {
      execSync(`tar -xzf "${fullFilepath}" -C "${tmpDir}"`, { stdio: 'pipe' });
    } else {
      return { success: false, error: '不支持的文件格式' };
    }

    // Find plugin root (contains .claude-plugin/plugin.json) — 递归搜索，支持嵌套 ZIP
    const pluginRoot = findPluginRoot(tmpDir);
    if (!pluginRoot) return { success: false, error: '未找到有效的插件结构（缺少 .claude-plugin/plugin.json）' };

    // Read plugin.json manifest
    const manifest = JSON.parse(readFileSync(join(pluginRoot, '.claude-plugin', 'plugin.json'), 'utf-8'));
    const pluginName = manifest.name;
    if (!pluginName) return { success: false, error: 'plugin.json 缺少 name 字段' };

    // Move to published plugins directory
    const destDir = join(PUBLISHED_PLUGINS_DIR, pluginName);
    if (existsSync(destDir)) {
      execSync(`rm -rf "${destDir}"`);
    }
    execSync(`mv "${pluginRoot}" "${destDir}"`);

    // Read skills
    const skills: PluginSkill[] = [];
    const skillsDir = join(destDir, 'skills');
    if (existsSync(skillsDir)) {
      for (const entry of readdirSync(skillsDir)) {
        const skillPath = join(skillsDir, entry);
        if (statSync(skillPath).isDirectory()) {
          const skillMd = join(skillPath, 'SKILL.md');
          if (existsSync(skillMd)) {
            const content = readFileSync(skillMd, 'utf-8');
            const fm = parseFrontmatter(content);
            skills.push({
              name: fm.name || entry,
              description: fm.description || '',
              path: `skills/${entry}/SKILL.md`,
            });
          }
        }
      }
    }

    // Read commands
    const commands: PluginCommand[] = [];
    const commandsDir = join(destDir, 'commands');
    if (existsSync(commandsDir)) {
      for (const entry of readdirSync(commandsDir)) {
        if (entry.endsWith('.md')) {
          const cmdContent = readFileSync(join(commandsDir, entry), 'utf-8');
          const cmdName = entry.replace(/\.md$/, '');
          const fm = parseFrontmatter(cmdContent);
          commands.push({ name: cmdName, description: fm.description || '' });
        }
      }
    }

    // Build PublishedPlugin object
    const plugin: PublishedPlugin = {
      name: manifest.name,
      description: manifest.description || '',
      source: `./plugins/${manifest.name}`,
      version: manifest.version || '1.0.0',
      category: manifest.category || 'developer-tools',
      keywords: manifest.keywords || [],
      author: manifest.author,
      skills: skills.length > 0 ? skills : undefined,
      commands: commands.length > 0 ? commands : undefined,
      homepage: manifest.homepage,
      license: manifest.license,
      submissionId: id,
      publishedAt: new Date().toISOString(),
      contributor: { name: sub.name, department: sub.department },
    };

    // Save to published-plugins.json (replace if exists)
    const published = getPublishedPlugins();
    writeJSON(PUBLISHED_PLUGINS_FILE, [...published.filter((p) => p.name !== pluginName), plugin]);

    // Update submission status
    updateSubmissionStatus(id, 'published');

    return { success: true, plugin };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : String(e) };
  } finally {
    try { execSync(`rm -rf "${tmpDir}" 2>/dev/null || true`); } catch { /* ignore */ }
  }
}

export function getPublishedPlugins(): PublishedPlugin[] {
  return readJSON<PublishedPlugin[]>(PUBLISHED_PLUGINS_FILE);
}

// ─── Plugin Stats ──────────────────────────────────────────
export function getPluginStats(): Record<string, number> {
  return readJSON<Record<string, number>>(PLUGIN_STATS_FILE);
}

export function incrementDownload(pluginName: string) {
  const stats = getPluginStats();
  stats[pluginName] = (stats[pluginName] || 0) + 1;
  writeJSON(PLUGIN_STATS_FILE, stats);

  const log = getDownloadLog();
  log.push({ pluginName, timestamp: new Date().toISOString() });
  if (log.length > 200) log.splice(0, log.length - 200);
  writeJSON(DOWNLOAD_LOG_FILE, log);
}

// ─── Plugin Status (publish/unpublish) ─────────────────────
export function getPluginStatusMap(): Record<string, boolean> {
  return readJSON<Record<string, boolean>>(PLUGIN_STATUS_FILE);
}

export function isPluginPublished(pluginName: string): boolean {
  const map = getPluginStatusMap();
  return map[pluginName] !== false; // default true
}

export function setPluginPublished(pluginName: string, published: boolean) {
  const map = getPluginStatusMap();
  map[pluginName] = published;
  writeJSON(PLUGIN_STATUS_FILE, map);
}

// ─── Download Log ──────────────────────────────────────────
export function getDownloadLog(): DownloadLogEntry[] {
  return readJSON<DownloadLogEntry[]>(DOWNLOAD_LOG_FILE);
}

export function getRecentDownloads(limit = 20): DownloadLogEntry[] {
  const log = getDownloadLog();
  return log.slice(-limit).reverse();
}
