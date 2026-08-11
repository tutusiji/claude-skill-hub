import { readFileSync, writeFileSync, existsSync, mkdirSync, unlinkSync, readdirSync, statSync } from 'fs';
import { join, isAbsolute, basename } from 'path';
import { execSync } from 'child_process';
import type { Plugin, PluginSkill, PluginCommand } from './types';
import { findPluginRoot, type PluginRootType } from './validator';

// ─── Directory Setup ───────────────────────────────────────
function resolveDir(envVar: string | undefined, fallback: string): string {
  if (!envVar) return join(process.cwd(), fallback);
  return isAbsolute(envVar) ? envVar : join(process.cwd(), envVar);
}

export const DATA_DIR = resolveDir(process.env.DATA_DIR, 'data');
export const UPLOAD_DIR = resolveDir(process.env.UPLOAD_DIR, 'uploads');
export const PUBLISHED_PLUGINS_DIR = join(DATA_DIR, 'plugins');
export const STATIC_PLUGINS_DIR = resolveDir(process.env.STATIC_PLUGINS_DIR, 'plugins');

mkdirSync(DATA_DIR, { recursive: true });
mkdirSync(UPLOAD_DIR, { recursive: true });
mkdirSync(PUBLISHED_PLUGINS_DIR, { recursive: true });

// ─── Marketplace Sync ─────────────────────────────────────
// 同步脚本路径：可用 SYNC_SCRIPT_PATH 环境变量覆盖（默认为生产路径）。
const SYNC_SCRIPT_PATH = process.env.SYNC_SCRIPT_PATH || '/root/projects/claude-skill-hub/scripts/sync-marketplace.sh';

function syncMarketplace() {
  try {
    execSync(`bash "${SYNC_SCRIPT_PATH}"`, { timeout: 30000 });
  } catch (e) {
    console.error('marketplace sync failed:', e);
  }
}

// ─── Plugin Directory Resolver ─────────────────────────────
// 查找插件目录：先查已发布插件目录，再查静态插件目录
export function getPluginDir(pluginName: string): string | null {
  // 路径穿越防护:拒绝空、过长、含路径分隔符或纯点号的名字。
  // `..` 会被 join 解析到上级目录,曾导致 /api/plugins/../download-zip 泄漏整个 data/ 目录。
  // 不强制小写——纯 skill 包的 cleanName 可能含大写,只要不是穿越就放行。
  if (
    !pluginName ||
    pluginName.length > 256 ||
    pluginName === '.' ||
    pluginName === '..' ||
    /[\\/]/.test(pluginName) ||
    pluginName.includes('\0')
  ) {
    return null;
  }
  // 1. Published plugins (动态上架)
  const publishedPath = join(PUBLISHED_PLUGINS_DIR, pluginName);
  if (existsSync(publishedPath) && statSync(publishedPath).isDirectory()) {
    return publishedPath;
  }
  // 2. Static plugins (随仓库分发)
  const staticPath = join(STATIC_PLUGINS_DIR, pluginName);
  if (existsSync(staticPath) && statSync(staticPath).isDirectory()) {
    return staticPath;
  }
  return null;
}

// ─── File Paths ────────────────────────────────────────────
const SUBMISSIONS_FILE = join(DATA_DIR, 'submissions.json');
const PLUGIN_STATS_FILE = join(DATA_DIR, 'plugin-stats.json');
const PLUGIN_INSTALLS_FILE = join(DATA_DIR, 'plugin-installs.json');
const PLUGIN_LIKES_FILE = join(DATA_DIR, 'plugin-likes.json');
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
  category?: string; // 用户上传时选择的分类（平台元数据，非插件规范字段）
  filename: string;
  filepath: string;
  status: 'pending' | 'approved' | 'rejected' | 'published';
  createdAt: string;
}

export interface PublishedPlugin extends Plugin {
  submissionId: string;
  publishedAt: string;
  contributor: { name: string; department: string };
  // 已发布插件解压后的绝对路径，供 sync-marketplace.sh 定位文件复制。
  // 未设置时同步脚本回退到 {DATA_DIR}/plugins/{name}。
  extractedPath?: string;
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
initFile(PLUGIN_INSTALLS_FILE, {});
initFile(PLUGIN_LIKES_FILE, {});
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

// 从目录名或上传文件名推导干净的包名：
// 去掉归档扩展名、尾部 "-main"/"-master"、尾部版本号（如 -1.0.5 / .1.0.5）
function derivePackageName(source: string): string {
  return source
    .replace(/\.(zip|tar\.gz|tgz)$/i, '')
    .replace(/-(main|master)$/, '')
    .replace(/[-.]\d+\.\d+\.\d+$/, '')
    .trim();
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
    // Sync to Git marketplace repo
    syncMarketplace();
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

  // 包装目录（单 skill 平铺包）在 tmpDir 之外，用于 finally 清理
  let wrappedDir: string | null = null;

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

    // Find plugin root — 递归搜索，支持嵌套 ZIP、纯 skill 集合包、单 skill 平铺包
    const pluginRoot = findPluginRoot(tmpDir);
    if (!pluginRoot) return { success: false, error: '未找到有效的插件/技能结构（需要 .claude-plugin/plugin.json 或 skills/ 目录或 SKILL.md）' };

    // Read manifest — 从 plugin.json 或自动生成
    let manifest: Record<string, unknown>;
    if (pluginRoot.type === 'plugin') {
      manifest = JSON.parse(readFileSync(join(pluginRoot.path, '.claude-plugin', 'plugin.json'), 'utf-8'));
    } else if (pluginRoot.type === 'skills') {
      // 纯 skill 集合包：从目录名自动生成元数据。
      // 若 skills/ 直接位于 zip 根目录（pluginRoot.path === tmpDir），dirname 是
      // submission id，无意义——回退到上传文件名推导包名。
      const nameSource = pluginRoot.path === tmpDir ? sub.filename : basename(pluginRoot.path);
      const cleanName = derivePackageName(nameSource);
      let description = `Skill collection from ${cleanName}`;
      const readmePath = join(pluginRoot.path, 'README.md');
      if (existsSync(readmePath)) {
        const readme = readFileSync(readmePath, 'utf-8');
        const lines = readme.split('\n').filter(l => l.trim() && !l.startsWith('#') && !l.startsWith('!'));
        if (lines.length > 0) description = lines[0].trim().slice(0, 200);
      }
      manifest = { name: cleanName || 'skill-collection', version: '1.0.0', description };
    } else {
      // 单 skill 平铺包：优先从 SKILL.md frontmatter 取 name/version/description。
      // 平铺包解压后根目录往往是 tmp 目录，dirname 是其 basename（submission id），
      // 无意义——frontmatter 缺失时同样回退到上传文件名推导包名。
      const nameSource = pluginRoot.path === tmpDir ? sub.filename : basename(pluginRoot.path);
      const cleanName = derivePackageName(nameSource);
      const skillMdPath = join(pluginRoot.path, 'SKILL.md');
      const fm = existsSync(skillMdPath) ? parseFrontmatter(readFileSync(skillMdPath, 'utf-8')) : {};
      manifest = {
        name: fm.name || cleanName || 'skill',
        version: fm.version || '1.0.0',
        description: fm.description || `Skill: ${cleanName}`,
      };
    }
    const pluginName = manifest.name as string;
    if (!pluginName) return { success: false, error: '插件缺少 name 字段' };

    // 对单 skill 平铺包进行结构包装，使其符合 plugin 标准（便于 marketplace 分发）
    let sourceDir = pluginRoot.path;
    if (pluginRoot.type === 'skill') {
      // 包装目录必须建在 tmpDir 之外（同级）：平铺包解压后 SKILL.md 直接在
      // tmpDir 根下，pluginRoot.path === tmpDir，若把 wrappedDir 建在 tmpDir 内，
      // cp 会把源目录复制进自身子目录，报 "cannot copy directory into itself"。
      wrappedDir = join(DATA_DIR, 'tmp', `wrapped-${pluginName}`);
      mkdirSync(wrappedDir, { recursive: true });
      // 生成 .claude-plugin/plugin.json
      const claudePluginDir = join(wrappedDir, '.claude-plugin');
      mkdirSync(claudePluginDir, { recursive: true });
      writeFileSync(join(claudePluginDir, 'plugin.json'), JSON.stringify({
        name: pluginName,
        version: manifest.version || '1.0.0',
        description: manifest.description || '',
        category: sub.category || 'developer-tools',
      }, null, 2));
      // 创建 skills/<pluginName>/ 并将原始目录所有内容复制进去
      const destSkillDir = join(wrappedDir, 'skills', pluginName);
      mkdirSync(destSkillDir, { recursive: true });
      execSync(`cp -r "${pluginRoot.path}/." "${destSkillDir}/"`);
      sourceDir = wrappedDir;
    }

    // Move to published plugins directory
    const destDir = join(PUBLISHED_PLUGINS_DIR, pluginName);
    if (existsSync(destDir)) {
      execSync(`rm -rf "${destDir}"`);
    }
    execSync(`mv "${sourceDir}" "${destDir}"`);

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
    const m = manifest as Record<string, any>;
    const plugin: PublishedPlugin = {
      name: m.name,
      description: m.description || '',
      source: `./plugins/${m.name}`,
      version: m.version || '1.0.0',
      category: sub.category || m.category || 'developer-tools', // 优先使用用户上传时选择的分类
      type: pluginRoot.type, // 'plugin' 或 'skills'
      keywords: m.keywords || [],
      author: m.author,
      skills: skills.length > 0 ? skills : undefined,
      commands: commands.length > 0 ? commands : undefined,
      homepage: m.homepage,
      license: m.license,
      extractedPath: destDir,
      submissionId: id,
      publishedAt: new Date().toISOString(),
      contributor: { name: sub.name, department: sub.department },
    };

    // Save to published-plugins.json (replace if exists)
    const published = getPublishedPlugins();
    writeJSON(PUBLISHED_PLUGINS_FILE, [...published.filter((p) => p.name !== pluginName), plugin]);

    // Update submission status
    updateSubmissionStatus(id, 'published');

    // Sync to Git marketplace repo (for claude plugin marketplace add)
    syncMarketplace();

    return { success: true, plugin };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : String(e) };
  } finally {
    try { execSync(`rm -rf "${tmpDir}" 2>/dev/null || true`); } catch { /* ignore */ }
    // 包装目录在 tmpDir 之外（同级），失败时一并清理
    if (wrappedDir) {
      try { execSync(`rm -rf "${wrappedDir}" 2>/dev/null || true`); } catch { /* ignore */ }
    }
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

// ─── Plugin Copy-Command Counts（复制安装命令次数）──────────
// 与下载（ZIP）分开统计：`claude plugin install` 直接从 marketplace git
// 仓库拉取，不经过 web 服务器，无法统计真实安装。这里只记录用户点击
// "复制安装命令"按钮的次数，作为安装意向的近似指标（非真实安装数）。
export function getPluginInstalls(): Record<string, number> {
  return readJSON<Record<string, number>>(PLUGIN_INSTALLS_FILE);
}

export function getPluginInstallCount(pluginName: string): number {
  const installs = getPluginInstalls();
  return installs[pluginName] || 0;
}

export function incrementInstall(pluginName: string): number {
  const installs = getPluginInstalls();
  installs[pluginName] = (installs[pluginName] || 0) + 1;
  writeJSON(PLUGIN_INSTALLS_FILE, installs);
  return installs[pluginName];
}

// ─── Plugin Likes ──────────────────────────────────────────
export function getPluginLikes(): Record<string, number> {
  return readJSON<Record<string, number>>(PLUGIN_LIKES_FILE);
}

export function getPluginLikeCount(pluginName: string): number {
  const likes = getPluginLikes();
  return likes[pluginName] || 0;
}

export function incrementLike(pluginName: string): number {
  const likes = getPluginLikes();
  likes[pluginName] = (likes[pluginName] || 0) + 1;
  writeJSON(PLUGIN_LIKES_FILE, likes);
  return likes[pluginName];
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

// ─── Edit Published Plugin ─────────────────────────────────
export function editPublishedPlugin(
  pluginName: string,
  updates: { description?: string; category?: string }
): { success: boolean; error?: string } {
  const published = getPublishedPlugins();
  const plugin = published.find((p) => p.name === pluginName);
  if (!plugin) return { success: false, error: '未找到已上架插件' };

  if (updates.description !== undefined) plugin.description = updates.description;
  if (updates.category !== undefined) plugin.category = updates.category;

  writeJSON(PUBLISHED_PLUGINS_FILE, published);

  // Sync to Git marketplace repo
  syncMarketplace();

  return { success: true };
}
