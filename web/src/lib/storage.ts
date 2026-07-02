import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, isAbsolute } from 'path';

// ─── Directory Setup ───────────────────────────────────────
function resolveDir(envVar: string | undefined, fallback: string): string {
  if (!envVar) return join(process.cwd(), fallback);
  return isAbsolute(envVar) ? envVar : join(process.cwd(), envVar);
}

export const DATA_DIR = resolveDir(process.env.DATA_DIR, 'data');
export const UPLOAD_DIR = resolveDir(process.env.UPLOAD_DIR, 'uploads');

mkdirSync(DATA_DIR, { recursive: true });
mkdirSync(UPLOAD_DIR, { recursive: true });

// ─── File Paths ────────────────────────────────────────────
const SUBMISSIONS_FILE = join(DATA_DIR, 'submissions.json');
const PLUGIN_STATS_FILE = join(DATA_DIR, 'plugin-stats.json');
const PLUGIN_STATUS_FILE = join(DATA_DIR, 'plugin-status.json');
const DOWNLOAD_LOG_FILE = join(DATA_DIR, 'download-log.json');

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
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
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

// ─── Helpers ───────────────────────────────────────────────
function readJSON<T>(filepath: string): T {
  return JSON.parse(readFileSync(filepath, 'utf-8'));
}

function writeJSON(filepath: string, data: unknown) {
  writeFileSync(filepath, JSON.stringify(data, null, 2));
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

export function updateSubmissionStatus(id: string, status: 'approved' | 'rejected') {
  const all = getSubmissions();
  const sub = all.find((s) => s.id === id);
  if (sub) {
    sub.status = status;
    writeJSON(SUBMISSIONS_FILE, all);
  }
  return sub;
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
